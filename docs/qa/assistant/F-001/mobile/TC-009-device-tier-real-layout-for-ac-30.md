# TC-009: Device tier — the AC-30 clauses only real layout can falsify

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-009 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS Simulator (iPhone 16 Pro, iOS 18.3) and an Android emulator |
| Acceptance criteria | AC-30 (b), (c), (d), (e), (f), (g) |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | not-automatable (blocked — no AC-30 scenario in `.mobile-app/`) |
| Automation file | — |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
This TC exists so the device-tier gap is **recorded rather than silently absorbed** into a
model-tier green. BUG-004 shipped precisely because a message rendered 176 units below the
fold satisfies every presence assertion in this repo; asserting the remaining clauses
where they cannot fail would repeat that mistake with better vocabulary. Each item below
names the clause, the observable, and why nothing off-device can produce it.

## Preconditions
- `.mobile-app/` builds and installs the app on a booted simulator/emulator.
- `.mobile-app/shoot-sim.sh` drives scenarios by deep link (`todoai://s/<name>`), because
  `simctl`/`adb` cannot tap.
- **Blocked on:** the scenario list in `.mobile-app/shoot-sim.sh` + `.mobile-app/App.tsx`
  publishes 17 scenarios and none of them is an AC-30 scenario. Three are needed:
  `nma-new` (messages arrive while scrolled up), `nma-waiting` (a bulk-delete confirmation
  arrives while scrolled up), and `follow-at-bottom` (a message arrives while at the
  bottom). `.mobile-app/` is mobile-agent's tooling, not a QA-owned path — see the
  follow-up in this task's return.

## Test steps (mobile, device)
1. **(b) — the message is actually on screen.** At the bottom, submit a turn. Capture the
   screen and confirm the newest message's frame lies inside the viewport, not merely
   that the node exists.
2. **(c) — the pane did not move.** Scroll up, note the message at the top edge and its
   offset from that edge, let a message arrive, and confirm the same message occupies the
   same offset within 1 logical unit.
3. **(d) — the node count.** Let five messages arrive while scrolled up and count the
   nodes carrying `assistant-new-message-affordance` in the rendered tree. Expected: 1.
4. **(d)/design — the pill overlays, it does not reflow.** Note the conversation's last
   line's frame before the pill appears and after. Expected: unchanged. "An affordance
   that appears by pushing history upward moves the sentence the user is reading, which
   is the defect it exists to prevent."
5. **(e) — the two-line clamp keeps the question legible.** At 375 pt width, render
   NMA-WAITING with the longest published clarify head and confirm the question is not
   ellipsised away. `numberOfLines={2}`; the failure this row exists to prevent is
   "Waiting for your answer — Delete …", which announces that something is pending and
   withholds what.
6. **(f) — tapping actually scrolls.** Tap the pill; confirm the surface ends at
   `distance_from_bottom ≤ 48` and the pill is gone.
7. **(g) — no intermediate frames.** With reduce-motion on, capture during each of the
   three mandated scrolls and confirm the final position is reached without animation
   frames — the absence of animation, not a shortened duration.
8. **VoiceOver / TalkBack.** Confirm the pill's accessible name is read, and that the
   polite dock announces the NMA-NEW → NMA-WAITING change.

## Expected behaviour
As stated per step above. Every one is a **position, a frame, a node count or a frame
sequence** — none of them is a presence assertion.

## Test data
| Field | Value |
|-------|-------|
| Device matrix | iPhone 16 Pro / iOS 18.3 (booted); one Android emulator |
| Narrow width | 375 pt |
| Arrivals for the count check | 5 |

## Notes
- Steps 1–7 are the exact set named as "NOT provable here" in the header of
  `tests/assistant/mobile/F-001-voice-assistant-view.spec.ts`. The model tier
  covers every clause's arithmetic and every published string; this TC covers what
  arithmetic cannot reach.
- Sibling device-lab debt for F-003 lives in TC-032/034/036/037/038 under
  `docs/qa/assistant/F-003/mobile/`. This is the F-001 entry in the same ledger.
