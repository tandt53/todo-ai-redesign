# CLAUDE.md

<!-- Project-specific guidance for Claude Code. Safe to customize freely. -->

## Project

<!-- The orchestrator reads this before turning any request into tasks. It is -->
<!-- what a priority is judged against: without it every request looks equally -->
<!-- urgent, because there is nothing for one to be more urgent THAN. -->
<!-- The owner's answers. They may ask for a draft, but the draft is not the -->
<!-- answer until they have said so — these are product decisions. -->
<!-- A line still in brackets is unanswered, and the orchestrator stops and asks -->
<!-- rather than guessing. -->

<!-- Confirmed by the owner 2026-08-23. -->

- **Is** — a todo app where saying one sentence does what filling in several
  fields would; typing does everything too, and always has. **It is in English**
  — the user speaks English, the assistant replies in English, shipped copy and
  test fixture data are English. No other language is planned
  (`owner-decision-2026-08-17-english-first.md`, `-2026-08-23-fixtures-are-english.md`).
  The language you are speaking to the owner is never the product's language.
- **For** — one person managing their own tasks, often with their hands busy —
  walking, cooking, in a meeting.
- **Must** — every basic action works with the AI off, broken, out of quota or
  offline (`02-use-cases.md`, group CORE). Quick-add draws the row in p95 ≤ 100 ms
  with no network wait. Nothing is lost: soft delete for 30 days, undo in place.
- **Is not** — not a tool for teams or projects: no assigning, no handing work to
  another person, no workflow status (`blocked` / `in-progress` were considered
  and declined — a single user has no counterparty to hand to). AI is never the
  only route to a basic action. No wake word and no always-on mic. **Not a
  product with a fixed set of replies:** the assistant writes its own sentences
  (`owner-decision-2026-08-21-the-model-authors-the-reply.md`). Predefined
  answers exist only as test scaffolding for a backend that cannot author yet —
  `_shared/model/messages.ts` is on its way out, not a feature. A hardcoded
  user-facing sentence is a template even when it is only a fallback.
- **Succeeds when** — a task gets created, found or completed in fewer taps and
  keystrokes than typing it out would take. That is the measure every use case in
  `02-use-cases.md` is already judged by.

`Is not` is the one most often skipped and the one that does the most work: it is
what makes a request refusable. Without it the only answer to "should we build
this?" is yes.

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
