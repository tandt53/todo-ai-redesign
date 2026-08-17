# TC-019: Typed composer input — same interpretation path as speech

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-019 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-17 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
Typing works exactly the same as speaking: typed composer input goes through the same interpretation path — same endpoint, same request shape (`source: "typed"`), same outcome anatomy. Parity is asserted by running the SAME utterance through both channels and comparing wire + UI results.

## Preconditions
- Open session. User `qaweb-tc019@qa.example.com`; baseline seed tasks; injectable transcript source; request capture on `POST /assistant/turn`.
- Turn stub: identical applied outcome for the utterance regardless of `source`.

## Test steps
1. Voice channel: mic → feed "qaweb add water the plants tonight" → end of speech. Capture the request; read outcome + list; undo to reset.
2. Typed channel: type the identical utterance into `assistant-composer-input`; send via `assistant-composer-send` (and once via Enter key). Capture the request; read outcome + list.
3. Compare the two captured requests and the two rendered outcomes.

## Expected behaviour
- **Same path**: both channels hit `POST /assistant/turn` with the same `transcript` string; only `source` differs (`voice` vs `typed`). No separate typed endpoint, no client-side parsing shortcut for typed input.
- **Same outcome anatomy**: applied bubble, list row, badges, Undo — identical structure in both runs.
- Send affordance honesty: `assistant-composer-send` is disabled (`aria-disabled="true"`) with an empty composer and enabled once text exists (mockup behaviour); Enter submits like the send button.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc019@qa.example.com |
| utterance | fixture row `WEB-U7` (simple create), fed to both channels |

## Notes
Typing must remain fully functional in every degraded mic state — asserted in TC-026/TC-027; this TC pins the equal-path core.
