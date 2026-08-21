# F-001 voice-assistant-view — mobile test cases (index)

**Authored + executed:** 2026-08-17 by qa-mobile-agent (T-084) · **Spec:**
`docs/specs/assistant/F-001-voice-assistant-view.md` rev 3, AC-30 (added post-Gate-1 from
`docs/reports/owner-decision-2026-08-17-new-message-affordance.md`, amended the same day with
clause (h)) · **Design:** `docs/design/_shared/components.md § NewMessageAffordance` ·
**Mockups:** `docs/design/assistant/screens/voice-assistant-view-{ios,android}.html`
(`nma-new`, `nma-waiting` states) · **Bug this AC resolves:**
`docs/qa/_shared/bugs/BUG-004-conversation-never-scrolls-to-newest-message.md`

**Automation:** `tests/assistant/mobile/F-001-voice-assistant-view.spec.ts`
(40 tests) — run with `npx vitest run tests/assistant/mobile`, per
`docs/specs/_shared/platform/mobile.md ## Test Harness`. No simulator, emulator or Metro.
**Namespace:** `qamob-ac30-`, one uuid user per test (foundations §10).

## Scope of this folder

This folder covers **AC-30 only**. AC-30 is the one F-001 acceptance criterion tagged
`(web, mobile)` that had no mobile coverage: F-001's `Links.tested_by.mobile` was empty
before this task. The rest of F-001's mobile-relevant behaviour is covered from the
F-003 side (`docs/qa/assistant/F-003/mobile/`), which carries the mobile parity block.

## The one thing these cases are built to avoid

BUG-004 shipped because **every existing test asserted that a message was PRESENT, never
that it was VISIBLE.** A message rendered 176 units below the fold satisfies every
presence assertion in this repo. So no case below asserts a presence. Each asserts a
number, a comparison, or a distinction between two published states — and each names, in
its own Notes, the part of its clause that only a device can falsify.

## Test cases (9, all P1, status active)

| TC | Title | AC-30 clause | Type | Tier |
|----|-------|--------------|------|------|
| TC-001 | "At the bottom" is a number, sampled before the append | (a) | boundary | model |
| TC-002 | At the bottom, the message arrives in view, no affordance | (b) | regression | model |
| TC-003 | Away from the bottom, the view holds still | (c) | negative | model |
| TC-004 | One affordance, however many messages | (d) | boundary | model |
| TC-005 | Waiting is distinguishable from arrived | (e) | accessibility | model + real server |
| TC-006 | Reaching the bottom dismisses it — tap or hand | (f) | happy | model |
| TC-007 | Reduced motion removes the animation from all three scrolls | (g) | accessibility | model + port double |
| TC-008 | Submit scrolls, anchored on the user's own append | (h) | happy | real server |
| TC-009 | The clauses only real layout can falsify | (b)(c)(d)(e)(f)(g) | edge | **device — blocked** |

## AC coverage

| AC | Clause | Covered by |
|----|--------|------------|
| AC-30 | (a) | TC-001 |
| AC-30 | (b) | TC-002, TC-007, TC-009 |
| AC-30 | (c) | TC-003, TC-009 |
| AC-30 | (d) | TC-004, TC-009 |
| AC-30 | (e) | TC-005, TC-009 |
| AC-30 | (f) | TC-006, TC-007, TC-009 |
| AC-30 | (g) | TC-007, TC-009 |
| AC-30 | (h) | TC-008, TC-006 (shared postcondition) |

Incidentally exercised: AC-3 (cancel-before-send appends nothing, TC-008), AC-9 and AC-13
(the pending questions clause (e) is about, TC-005), AC-19 (the pill is a control with a
name/role and a polite announcement, TC-005/TC-006/TC-007).

## Where each clause sits, and why

**Falsifiable at the model tier** — the arithmetic of (a) with its viewport samples, the
`scrollTop`-unchanged form of (c), the aggregated count for (d), the label/accent/
accessible-name for (e), both dismissal paths in (f), all three scroll paths for (g), and
(h)'s anchor on the user's own append.

**Only a device can falsify** — that a message is actually on screen, that the pill
overlays rather than reflows the pane, that the two-line clamp keeps the question legible
at 375, that a smooth scroll lands where it claims, that N arrivals paint exactly one
node, and that a tap on the pill scrolls. All of it is enumerated step by step in TC-009.

## Device-tier blocker

TC-009 cannot run today: `.mobile-app/shoot-sim.sh` publishes 17 deep-link scenarios and
none of them is an AC-30 scenario. Three are needed — `nma-new`, `nma-waiting`,
`follow-at-bottom`. `.mobile-app/` is mobile-agent's tooling and is not a QA-owned path,
so this is routed as a follow-up rather than done here.

## Upstream artifacts this suite parses (L-007, L-008)

Nothing design or the spec owns is retyped into the tests. Each of these is parsed at run
time by a parser that **throws** when it matches nothing, so the suite goes red when the
**owning** artifact moves — the direction drift actually travels:

| Fact | Owner | Parsed as |
|---|---|---|
| the at-bottom threshold (48) | `docs/specs/assistant/F-001-...md` AC-30 (a) | `` `distance_from_bottom ≤ N` `` |
| NMA-HIDDEN / NMA-NEW / NMA-WAITING labels | `docs/design/_shared/components.md` § NewMessageAffordance | the row's Label cell |
| the two accessible-name literals | same | `NMA-NEW → \`…\`` / `NMA-WAITING → \`…\`` |
| the dock's live-region politeness | same | ``The dock is a `polite` live region`` |
| the affordance testid | same + all three mockups | `Testid: \`…\`` |

## Proof the suite can fail

Checked by mutation at execute time (each mutation applied with a `cp` backup and
restored byte-identical — never `git checkout`, L-010):

| Mutation | Cases failed |
|---|---|
| `BOTTOM_SLACK 48 → 0` (exact-zero rule) | 7 |
| `BOTTOM_SLACK 48 → 400` (slack absorbs a row) | 12 |
| pending-question head forced to `null` (pill can only count) | 6 |
| below-fold slice returns every message (ignores the fold) | 1 |
| animate decision inverted (reduce-motion animates) | 6 |
| reaching the bottom never clears the count | 4 |
| design's NMA-WAITING wording changed upstream | 2 |
| the spec's own threshold moved to 64 | 7 |
