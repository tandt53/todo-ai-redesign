# TC-018: No match — reply quotes the heard transcript; zero task mutations (bounded)

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-018 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-14 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
A command matching no task applies zero task mutations and answers with a message quoting the heard transcript — so a misheard word is distinguishable from an absent task. Asserted in AC-14's bounded form: task table unchanged, no unrelated task edited, no task created.

## Preconditions
- Open session. User `qaweb-tc018@qa.example.com`; baseline seed tasks (nothing matching "badminton").
- Injectable transcript source (voice path). Turn stub: `no_match` outcome echoing `transcript_raw`.

## Test steps
1. Snapshot the full task list (row count, every title + meta).
2. Voice path: mic → feed "cross off the badminton game" (fixture `WEB-T5`) → end of speech.
3. Read the reply message and the list; diff against the snapshot.

## Expected behaviour
- **Transcript echo**: the reply quotes the heard words verbatim — the exact string "cross off the badminton game" appears (quoted styling per mockup) — and states nothing matched / nothing was changed, inviting re-say or type.
- **Bounded no-mutation check**: post-turn list diff is EMPTY — same row count, no title changed, no meta changed, no new row (in particular: no task named anything like "badminton"), no row removed.
- Surface back to idle; no undo affordance (nothing applied).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc018@qa.example.com |
| transcript | fixture row `WEB-T5` ("cross off the badminton game", no match) |

## Notes
The verbatim-echo assertion is the honesty core: a paraphrased echo would pass a weaker "some reply rendered" check but defeat the AC's purpose (mishearing visible to the user).
