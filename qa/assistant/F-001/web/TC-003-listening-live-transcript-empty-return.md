# TC-003: Listening — live transcript streams; nothing recognized returns to idle and sends no turn

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-003 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-2, AC-29 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
While listening, a live transcript must render as words are recognized (into the composer per the mockup's listening state). Listening that ends with nothing recognized must return to idle visibly and send no turn. Uses the spec's injectable transcript source seam — no real audio.

## Preconditions
- Open session, idle. User `qaweb-tc003@qa.example.com`.
- Injectable `TranscriptSource` seam wired (spec Test strategy; platform web.md ports). Speech capability available, permission granted.
- Network layer instrumented to count `POST /assistant/turn` requests.

## Test steps
1. Activate `assistant-mic-button`. Assert listening state: `assistant-state-indicator` visible with "Đang nghe…", mic `aria-pressed="true"`.
2. Feed the transcript source incrementally: "push the" → "push the budget" → "push the budget review".
3. After each increment, read `assistant-composer-input` value.
4. Reset; tap mic again, then end the capture with an empty recognition result (seam: end-of-speech, zero words).

## Expected behaviour
- **AC-2 (live transcript)**: The composer text grows with each recognized increment — each partial appears while still listening, not only at the end.
- **AC-2 (empty recognition)**: Surface returns to idle with a visible cue — "Đang nghe…" indicator gone, mic back to available (`aria-pressed="false"`); **zero** `POST /assistant/turn` requests were made.
- **AC-29**: Only idle → listening → idle occurred; no thinking flash, no error, no message added to the conversation.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc003@qa.example.com |
| transcript script | fixture rows `WEB-T1` (incremental), `WEB-T2` (empty) |

## Notes
Mockup state `listening`: transcript renders in the composer (listening tint). Assert composer VALUE, not just styling — false-green guard.
