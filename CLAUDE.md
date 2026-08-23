# CLAUDE.md

<!-- Project-specific guidance for Claude Code. Safe to customize freely. -->

## Project

[Short description of what this project is]

## Agent Orchestration

@.claude/ORCHESTRATION.md

## Known Blockers

- **design-check's render tier skips silently in the remote container.** Playwright 1.62.1
  expects chromium build `1234`; `/opt/pw-browsers` ships `1194`, so the browser will not
  launch and the layout, state, contrast and overflow checks never run — while the summary
  still reads `13 passed, 0 failed, 1 skipped`, which looks green. Run it as:
  `DESIGN_CHECK_BROWSER=/opt/pw-browsers/chromium-1194/chrome-linux/chrome bash .claude/tools/design-check/run-design-check.sh`
  With the browser reachable the real baseline is **175 passed, 0 failed, 4 skipped**.
  Not set in `.claude/settings.json` deliberately: the path is specific to this container,
  and pointing the variable at a binary that does not exist elsewhere would fail harder
  than the current fallback.

<!-- Add recurring issues here as agents surface them (e.g., "renderer registry has circular-dep risk — see BUG-001 pattern"). -->

## Custom Dispatch Rules

<!-- Project-specific agent routing beyond the default pipeline. -->

## Quick Commands

<!-- Project-specific aliases beyond the defaults in .claude/ORCHESTRATION.md. -->
