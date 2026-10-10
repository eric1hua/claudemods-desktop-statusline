# desktop-statusline

A Claude Code mod that shows your subscription usage as a band above the prompt, in the Desktop app's Code tab and in the terminal. It brings line 4 of [best-cc-statusline](https://github.com/eric1hua/best-cc-statusline) into the app's own interface.

```
5h ━━━━━━──────── 42%  resets in 2h 14m      7d ━━━━━━━━━━━━── 91%  resets in 3d 4h
```

- **Desktop / IDE:** rounded SVG bars. **Terminal:** text bars (`▓▓▓▓░░░░░░`).
- Green under 70%, yellow 70–89%, red 90% and up; percentages use your theme's colors.
- Reset times are relative, so they read the same in any time zone.
- Hidden when there is no rate-limit data (API-key billing, or before the first reply). Reset times drop below 60 columns.
- Redraws when a usage window moves, plus once a minute for the countdown. No git or network calls.

## Install

From a terminal Claude Code session:

```
/plugin install desktop-statusline --marketplace eric1hua/claudemods-desktop-statusline
```

Answer `y` to add the marketplace, then pick the user scope. Installed at user scope, it also loads in the Desktop app's Code tab.

### From a local clone

```bash
claude plugin marketplace add /path/to/claudemods-desktop-statusline
claude plugin install desktop-statusline@claudemods-desktop-statusline
```

A folder marketplace is read in place: edit the files, then run `/reload-plugins` in a session.

## Develop

```bash
claude plugin validate .
claude plugin test .
```

The data comes from `$.session.usage()` and the `session.measure` event of the [Claude Code mods API](https://code.claude.com/docs/en/plugins/mods/overview).
