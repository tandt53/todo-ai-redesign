# TC-37: STT locus — the turn payload is recognized text only, never audio

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-37 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-20 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
AC-20's api half: speech-to-text runs on the client; the server receives recognized **text** only. The contract's request schema has no audio field and bodies are JSON — a request smuggling audio (binary content-type, or an undocumented audio field) must not be accepted as audio, and nothing audio-shaped is ever persisted or echoed.

## Preconditions
- User `QAAPI-U1`; session message snapshot taken.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1}; Content-Type: audio/webm | 4 KB of binary bytes | 400 | VALIDATION envelope — non-JSON body rejected (contract Conventions); no turn row created |
| 2 | POST | /assistant/turn | X-User-Id: {U1} | valid JSON body + extra `audio: "<32KB base64>"` field | 400 | unknown-field rejection (contract Conventions, pinned 2026-08-16): `VALIDATION` naming `audio`, zero side effects — and by construction **no audio data is persisted or echoed** (`GET /assistant/session` carries no `audio` key, no base64 blob, no turn row for this request) |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | normal UT-CREATE-1 body, `source: "voice"` | 200 | positive class: voice-sourced turns are plain text `transcript` — same schema as typed (AC-17's shared path, observed at the wire) |

## Expected behaviour
The server's audio-free guarantee is structural: schema has no audio field (step 3), non-JSON is refused (step 1), and an uninvited field never round-trips into storage (step 2). Vendor-side browser routing is out of app scope (spec's platform-asymmetry note) — this TC only pins **our** server.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| payloads | binary audio bytes; base64-stuffed JSON; clean voice turn |

## Notes
Step 2 pinned 2026-08-16 alongside TC-34 (was index OQ 4): unknown request fields are rejected `400 VALIDATION` on every endpoint. The persistence assertion (nothing audio-shaped ever stored or echoed) remains the AC-20 substance.
