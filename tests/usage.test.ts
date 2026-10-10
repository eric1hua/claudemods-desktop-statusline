import { expect, mock, test } from 'claude-code/testing'
import type { On, SessionRateLimit } from 'claude-code'

const NOW = Date.parse('2026-10-10T12:00:00Z')

const bandProps = (bodyColumns: number) => ({
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
})

const band = (bodyColumns = 120) =>
  ({ component: 'AbovePrompt', props: bandProps(bodyColumns) }) as const

// Answers $.session.usage() beneath the plugin with these windows
function usageWith(on: On, rateLimits: SessionRateLimit[]) {
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits } }))
}

const LIMITS: SessionRateLimit[] = [
  { kind: 'five_hour', percentUsed: 42.4, resetsAt: '2026-10-10T14:14:00Z' },
  { kind: 'seven_day', percentUsed: 91, resetsAt: '2026-10-13T16:00:00Z' },
]

test('draws both windows with percent, threshold color and reset', async ($, on) => {
  mock.clock(on, { now: NOW })
  usageWith(on, LIMITS)
  for (const surface of ['desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ plugin: 'desktop-statusline', surface, ...band() })
    expect((await ui.find({ type: 'Text', text: '42%' }))?.props).toMatchObject({ color: 'success' })
    expect((await ui.find({ type: 'Text', text: '91%' }))?.props).toMatchObject({ color: 'error' })
    expect(await ui.find({ text: 'resets in 2h 14m' })).toBeDefined()
    expect(await ui.find({ text: 'resets in 3d 4h' })).toBeDefined()
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
    await ui.unmount()
  }
})

test('draws nothing in the terminal', async ($, on) => {
  mock.clock(on, { now: NOW })
  usageWith(on, LIMITS)
  // Stands for the engine's own band beneath the plugin
  on('ui.render', ($, e) => $.ui.resolve(e).Box({ key: 'engine-band' }))
  const ui = await $.ui.mount({ plugin: 'desktop-statusline', surface: 'terminal', ...band() })
  expect(await ui.find({ key: 'engine-band' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5h|7d|%/ })).toBeUndefined()
  await ui.unmount()
})

test('drops reset times at narrow widths', async ($, on) => {
  mock.clock(on, { now: NOW })
  usageWith(on, LIMITS)
  const ui = await $.ui.mount({ plugin: 'desktop-statusline', surface: 'desktop', ...band(40) })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()
  expect(await ui.find({ text: /resets/ })).toBeUndefined()
  await ui.unmount()
})

test('shows only the windows that have a reading', async ($, on) => {
  mock.clock(on, { now: NOW })
  usageWith(on, [{ kind: 'seven_day', percentUsed: 75 }])
  const ui = await $.ui.mount({ plugin: 'desktop-statusline', surface: 'desktop', ...band() })
  expect((await ui.find({ type: 'Text', text: '75%' }))?.props).toMatchObject({ color: 'warning' })
  expect(await ui.find({ text: '5h' })).toBeUndefined()
  expect(await ui.find({ text: /resets/ })).toBeUndefined()
  await ui.unmount()
})

test('draws nothing without rate-limit data (API-key billing)', async ($, on) => {
  mock.clock(on, { now: NOW })
  usageWith(on, [])
  // Stands for the engine's own band beneath the plugin
  on('ui.render', ($, e) => $.ui.resolve(e).Box({ key: 'engine-band' }))
  const ui = await $.ui.mount({ plugin: 'desktop-statusline', surface: 'desktop', ...band() })
  expect(await ui.find({ key: 'engine-band' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5h|7d|%/ })).toBeUndefined()
  await ui.unmount()
})
