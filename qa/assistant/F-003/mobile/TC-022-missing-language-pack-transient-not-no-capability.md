# TC-022: Missing language pack is the transient case (dimmed, cause stated) — not the no-capability case (hidden)

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-022 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-4, F-001 AC-22, F-001 AC-20 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
A recognizer that is **present but has no pack for the interface language** is F-001 AC-22's transient case — dimmed, with a message stating the cause — and not F-001 AC-20's no-capability case, which hides the mic. AC-4 names this classification explicitly because it is easy to get wrong: from the code's point of view both look like "recognition unavailable", but the user-visible consequence is opposite (retry later vs. this device can't).

## Preconditions
- Account `qamob-tc022@qa.example.com`; `TranscriptSource` reporting `capable: true` with the language pack unavailable.

## Test steps
1. Open the surface. Read the mic mode and message.
2. Compare against TC-012's no-capability rendering and TC-015's permission-denied rendering.
3. Type and send a turn.
4. Restore the pack; assert the mic returns to available with no restart.
5. Repeat with a generic transient recognizer failure ("service busy").

## Expected behaviour
- Mic is **dimmed**, present. Hidden = fail (that is the no-capability rendering and would tell the user their device can never do this).
- The message states the **transient cause** and is distinguishable from the permission-denied message (mockup `mic-transient`: `Nhận dạng giọng nói đang bận` / `Dịch vụ nhận dạng chưa phản hồi. Thường chỉ một lát là xong — micro sẽ tự bật lại.`).
- No `assistant-permission-cta` in this state — there is nothing for the user to grant. A permission CTA here is a defect.
- Typing is unaffected throughout.
- Recovery: the mic returns to **available** when recognition recovers, without a restart.
- The three unavailable-renderings are mutually distinguishable: dimmed+permission (CTA present), dimmed+transient (no CTA, cause stated), hidden+no-capability (no mic, no error).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc022@qa.example.com |
| matrix rows | `PM-TRANS-1` (service busy), `PM-TRANS-2` (missing language pack) |

## Notes
The distinguishability assertion is the real content here. A suite that only checked "mic is dimmed" would pass with all three states rendering the same message, which is exactly the bug this TC exists to catch.
