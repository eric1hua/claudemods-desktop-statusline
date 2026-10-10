import type { Color, Register, SessionRateLimit } from 'claude-code'

// The two subscription windows, in display order
const WINDOWS = [
  { kind: 'five_hour', label: '5h' },
  { kind: 'seven_day', label: '7d' },
] as const

// Below this many columns the band drops the reset times
const NARROW_COLUMNS = 60

// Usage % -> threshold (<70 ok, 70-89 warn, >=90 critical), as the script does
type Level = 'ok' | 'warn' | 'critical'

function levelFor(percent: number): Level {
  if (percent >= 90) return 'critical'
  if (percent >= 70) return 'warn'
  return 'ok'
}

// Text colors are theme keys, so they follow the person's light or dark theme
const TEXT_COLOR: Record<Level, Color> = { ok: 'success', warn: 'warning', critical: 'error' }

// Bar fills sit in the middle of the range, readable on light and dark backgrounds
const BAR_FILL: Record<Level, string> = { ok: '#2f9e5b', warn: '#d4991a', critical: '#d64545' }

// A rounded track with a rounded fill; the track is a translucent grey for either theme
function barSvg(percent: number, level: Level): string {
  const width = 96
  const height = 8
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * width)
  const fill =
    filled > 0
      ? `<rect width="${Math.max(filled, height)}" height="${height}" rx="4" fill="${BAR_FILL[level]}"/>`
      : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<clipPath id="c"><rect width="${width}" height="${height}" rx="4"/></clipPath>` +
    `<g clip-path="url(#c)"><rect width="${width}" height="${height}" fill="#8e8e93" fill-opacity="0.25"/>${fill}</g>` +
    `</svg>`
  )
}

// Time until a reset, relative so it reads the same in any time zone: 3d 4h, 2h 14m, 9m
function untilReset(resetsAt: string | undefined, now: number): string | undefined {
  if (resetsAt === undefined) return undefined
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  const minutes = Math.ceil(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Keeps the reset countdowns current while the session sits idle
    $.clock.every(60_000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  // Redraws when a rate-limit window moves a whole point, appears or leaves
  on('session.measure', ($, e, next) => {
    if (e.changed.includes('rateLimits')) $.ui.invalidate('ui.render')
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The terminal keeps its own status line: the band is for the Desktop app and the IDE
    if (e.surface === 'terminal' || e.props.hasSurvey) return next(e)

    // Empty off a subscription (API-key billing) and before the first response
    const { rateLimits } = await $.session.usage()
    const windows = WINDOWS.flatMap(({ kind, label }) => {
      const limit = rateLimits.find((l: SessionRateLimit) => l.kind === kind)
      return limit === undefined ? [] : [{ kind, label, limit }]
    })
    if (windows.length === 0) return next(e)

    const now = await $.clock.now()
    const isNarrow = e.props.bodyColumns < NARROW_COLUMNS
    const { Box, Svg, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={3}>
        {windows.map(({ kind, label, limit }) => {
          const percent = Math.round(limit.percentUsed)
          const level = levelFor(percent)
          const reset = isNarrow ? undefined : untilReset(limit.resetsAt, now)
          const parts = [
            <Text dimColor>{label}</Text>,
            <Svg source={barSvg(percent, level)} alt={`${label} usage ${percent}%`} width={96} height={8} />,
            <Text color={TEXT_COLOR[level]} bold>{`${percent}%`}</Text>,
          ]
          if (reset !== undefined) parts.push(<Text dimColor>{`resets in ${reset}`}</Text>)
          return (
            <Box key={kind} flexDirection="row" alignItems="center" columnGap={1}>
              {parts}
            </Box>
          )
        })}
      </Box>
    )
  })
}
