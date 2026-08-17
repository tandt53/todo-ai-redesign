# BUG-006 — your own send lands short of the bottom, and the reply to it goes below the fold

## Metadata
| Field | Value |
|-------|-------|
| ID | BUG-006 |
| Filed | 2026-08-17 by qa-web-agent (T-085) |
| Severity | HIGH |
| Layer | web |
| Feature | F-001 (voice-assistant-view) — AC-30 clauses (h) and (b) |
| Failing test case | qa/assistant/F-001/web/TC-047-own-send-scrolls-to-bottom.md |
| Status | open |

## Summary
On the ordinary send path — the reply comes back quickly, which is every canonical
fixture row — the clause-(h) scroll stops **121 logical units short of the bottom**,
a `1 new message` affordance appears, and the assistant's reply to the turn the user
just sent is left below the fold.

That is BUG-004's user-visible symptom returning through a narrower door: you say
something, and nothing appears to happen.

## Reproduction steps
1. Open the assistant with a conversation long enough to overflow its pane
   (three `plan the week` turns is enough at 1280×720).
2. Scroll to the bottom by hand. Confirm `distance_from_bottom = 0` and no affordance.
3. Type `plan the week` and send.
4. Wait for the outcome message and let everything settle (measured at 2s; the state
   is stable from ~250ms onward and does not recover).

Reproduced **3 of 3** isolation runs of TC-047, and independently by four
one-off browser probes before the case existed. It reproduces from a
scrolled-up start and from a bottom start alike.

## Expected
AC-30(h): *"the surface scrolls to the bottom wherever it was, and the affordance is
cleared… `distance_from_bottom ≤ 48`, no affordance."* And, in the same clause:
*"having scrolled, the user is at the bottom by (a), so the assistant's reply to that
same turn arrives in view through (b) on its own."*

So: `distance_from_bottom ≤ 48`, zero affordance nodes, reply on screen.

## Actual
| Measurement | Before the send | After |
|---|---|---|
| `scroll_offset` | 424 | 623 |
| `content_height` | 1007 | 1327 |
| `viewport_height` | 583 | 583 |
| `distance_from_bottom` | **0** | **121** |
| affordance | none | `1 new message` |
| newest message inside the viewport | yes | **no** |

The scroll lands at 623 when the bottom is 744.

## Root cause — what the measurements point at
The scroll is **animated**, and the sample that decides clause (a) for the reply is
taken while it is still moving.

Frame-by-frame from a browser probe (`plan the week`, zero server delay, from a true
bottom; `t` in 50ms steps):

```
at bottom: top=424  sh=1007 ch=583  dfb=0    nma=null
t0:        top=424  sh=1138 ch=515  dfb=199  nma=null      <- user's own message appended;
                                                              the thinking indicator has also
                                                              shrunk the viewport 583 -> 515
t1:        top=474  sh=1327 ch=583  dfb=270  nma="1 new message"   <- the REPLY appends here,
                                                              mid-animation. dfb reads 270,
                                                              so clause (a) says "not at the
                                                              bottom" and clause (c) holds
                                                              the view.
t2..t4:    top=580 -> 614 -> 623 (the animation finishes at its ORIGINAL target)
t5..t15:   top=623  dfb=121  nma="1 new message"   <- stable, permanently short
```

Two things compound:

1. **The scroll target is computed once, from the pre-reply content height** (and
   during the transient thinking-state viewport of 515). `1138 − 515 = 623` — exactly
   where it lands. It is never recomputed after the reply appends.
2. **A scroll in flight makes the surface read as "not at the bottom"** for any
   message arriving during it, so the reply takes clause (c)'s branch (hold the view,
   show the affordance) instead of clause (b)'s.

Confirming evidence, and the reason this is a race rather than arithmetic: with
`prefers-reduced-motion: reduce` the identical scenario ends at
`distance_from_bottom = 0` with **no** affordance. The instant scroll has no window
to be interrupted in. TC-046 covers that path and passes.

Second confirming evidence: with a *delayed* reply (the 150ms and 2500ms QA fixture
rows) the defect does not reproduce, because the reply lands after the animation has
finished and clause (b) then follows it correctly. It is fast replies — every
canonical row, and any real backend that answers promptly — that break.

## Environment
- Run ID: `qa/assistant/runs/2026-08-17-web-ac30.md`
- Commit: `d497627` (working tree, AC-30 implementation uncommitted)
- Stack: TypeScript · React (web) · Playwright · Chromium (Desktop Chrome), 1280×720
- Harness: `qa/assistant/automation/harness/qa-test-server.ts`, restarted for this run

## Suggested next step
**web-agent.** Both halves need fixing, and either alone leaves a defect:

1. **Recompute the scroll target when content is appended during an in-flight scroll**,
   or re-issue the scroll after the reply's layout settles. Clause (h) states the
   postcondition as an end state (`distance_from_bottom ≤ 48`), not as "a scroll was
   started", so the obligation runs until the surface is actually there.
2. **Do not let an in-flight programmatic scroll count as "the user is not at the
   bottom."** Clause (a)'s sample is meant to answer "is the *user* at the bottom",
   and while the app's own scroll is animating, the honest answer is the position the
   scroll is heading for, not the position it is passing through. Sampling the target
   rather than the live offset fixes the reply's branch.

Both are the same shape as L-005: one obligation, several doors. Clause (h) and clause
(f) are already required to be one routine; the natural home for "keep going until
`distance_from_bottom ≤ 48`" is inside that routine, so every caller inherits it.

## Related
- **BUG-004** — the original omission this AC was written to resolve. Not a regression
  of it; the fix landed and left this window open.
- **AC-30(g)** passes on all three scroll paths (TC-044/045/046), so reduce-motion users
  never see this. That is worth stating plainly: the defect is invisible to exactly the
  configuration a developer testing accessibility would be running under.
- **qa-mobile-agent:** AC-30 is tagged `(web, mobile)` and clause (h) shipped on both
  clients. The mechanism here is animation-versus-append ordering, which React Native's
  `scrollToEnd({ animated: true })` shares. The mobile AC-30 pass
  (`qa/assistant/runs/2026-08-17-mobile-ac30.md`) ran at the **model tier with no
  simulator**, which is the one tier that cannot observe a scroll animation racing an
  append — so mobile is unverified for this defect rather than clear of it. Worth a
  matching case on the device tier (`.mobile-app/`); not assumed either way.
