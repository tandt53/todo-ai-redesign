# TC-011: Parity — AI error keeps the user's words, offers retry, leaves the list usable

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-011 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-23, F-001 AC-24, F-001 AC-16 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
When interpretation fails, the surface says so, offers retry, keeps the user's words, and leaves the whole list usable by hand. `transcript_raw` is persisted before interpretation is attempted, so a failed turn never loses what was said and retry does not require re-speaking — which on a phone is the difference between a recoverable hiccup and lost dictation.

## Preconditions
- Account `qamob-tc011@qa.example.com`; failure injection able to fail interpretation once, then succeed.

## Test steps
1. Send a turn whose interpretation fails once. Read the state, the message, and the composer.
2. Read the session history for the failed turn.
3. Tap `assistant-retry-button`. Capture the retried request.
4. Read the outcome and the list.
5. While in the error state (before retrying), perform a manual list operation.

## Expected behaviour
- The surface enters the error state and renders the error message with a retry affordance (mockup `error`: head `Chưa gửi được`, body stating nothing changed and the words are still in the composer, `Thử lại` button).
- The user's words are **kept** — the composer still holds the transcript; the user does not re-speak.
- The failed turn is recorded in session history with its transcript preserved (F-001 AC-23) — a reload/foreground read still shows it.
- Step 3: the retry carries the **same** `client_turn_id` as the original. `failed → pending` under that id, and it re-attempts rather than being deduped away (F-001 AC-16, per-status dedupe).
- Step 4: the retry succeeds and applies exactly once — the list shows one effect, not two.
- Step 5: the manual operation succeeds while the conversation is in error (F-001 AC-24).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc011@qa.example.com |
| injection | fail interpretation once, then succeed (canonical `fail_times: 1` row) |

## Notes
Per-status dedupe is the subtle half: a `failed` turn must re-attempt on the same id, while an `applied` one must not (TC-012). Getting these backwards produces either a dead retry button or a double-apply — both invisible unless both are asserted.
