# TC-024: WCAG 2.5.3 — visible labels match accessible names

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-024 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
AC-19 names WCAG 2.5.3 (Label in Name): for every control with a visible text label, the accessible name must CONTAIN that visible text — so voice-control users can activate what they see. Critical here because this is a voice-first product.

## Preconditions
- Open session. User `qaweb-tc024@qa.example.com`; staged: applied turn (Hoàn tác), confirm question (chips "Xoá N việc" / "Giữ lại"), clarify question (candidate chips), error ("Thử lại"), permission message ("Chỉ tôi chỗ bật"), add-task button ("Thêm việc").

## Test steps
1. For each visibly-labelled control — `assistant-undo-button` ("Hoàn tác"), `assistant-chip-affirm` ("Xoá N việc"), `assistant-chip-negative` ("Giữ lại"), each `assistant-option-chip` (candidate text), `assistant-retry-button` ("Thử lại"), `assistant-permission-cta` ("Chỉ tôi chỗ bật"), `assistant-add-task-button` ("Thêm việc") — read the visible text and compute the accessible name.
2. Compare: accessible name must include the visible label string (case-normalized).
3. Icon-only controls (mic, send, drawer, checkboxes) — assert they have NO conflicting visible text and their aria-labels stand alone (2.5.3 satisfied vacuously; the names themselves are TC-022's scope).

## Expected behaviour
- For every visibly-labelled control, visible text ⊆ accessible name. No aria-label that contradicts or omits the visible words (e.g. a "Hoàn tác" button whose aria-label is "quay lại" FAILS).
- Chip accessible names equal their literal option texts — the same literal text the tap sends as the answer turn (AC-10/AC-13 coherence: what you see = what you say = what is sent).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc024@qa.example.com |

## Notes
The see=say=send triangle makes this more than compliance: a mismatch here breaks voice-driven confirmation outright.
