# TC-029: Audio interruption while listening = cancel-while-listening; audio session released; mic returns without re-prompting

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-029 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-7, AC-5, F-001 AC-3 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless (semantics) + device-lab (real call / Siri / route change) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The phone can take the microphone away mid-sentence. Every way it does so — incoming call, system assistant (Siri / Google Assistant), audio-focus loss, output-route change — behaves exactly as cancel-while-listening: capture stops, recognized-so-far text is preserved, **no turn is sent**, and the surface returns to idle visibly. Two further obligations are mobile-only: the audio session is released so the interrupting app is not blocked, and the mic returns to available when focus comes back **without re-prompting for permission**.

## Preconditions
- Account `qamob-tc029@qa.example.com`; `AppLifecycle` double able to emit each interruption kind and a focus-regain; audio-session spy; permission-request spy.

## Test steps
For each interruption kind — incoming call, system assistant, audio-focus loss, output-route change:
1. Tap the mic; emit two partials.
2. Emit the interruption.
3. Read: state, composer, request spy, audio-session spy.
4. Emit focus regain. Read the mic mode and the permission-request spy.
5. Tap the mic and drive a recognition to completion.

## Expected behaviour
- Capture stops on the interruption; the surface returns to **idle visibly** — the listening indicator is gone, not merely inert.
- Recognized-so-far text is preserved per AC-5: it is in the composer and in `client.pending_input`.
- **No turn is sent** — request spy reads zero for the interrupted listening session. All four kinds.
- The audio session is **released** (spy records a deactivate). Holding it would block the incoming call's audio, which is the user-hostile failure this clause exists to prevent.
- Step 4: the mic returns to **available** on focus regain, and the permission-request spy records **zero** new requests — an interruption is not a permission event.
- Step 5: capture works normally afterwards; no restart needed.
- An interruption while **thinking** (not listening) does not cancel the sent turn — its late outcome still renders (F-001 AC-3: cancel is client-local, a sent turn always completes).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc029@qa.example.com |
| interruption kinds | call, system assistant, audio-focus loss, output-route change |

## Notes
**Device-lab residue:** a real incoming call interrupting real capture, and a real Bluetooth/headphone route change, are device-lab items named in the spec's Test strategy. This tier proves that each interruption **event** produces the cancel-while-listening semantics; it does not prove that the RN audio-session bridge actually emits those events on a device. That mapping is the device-lab item.
