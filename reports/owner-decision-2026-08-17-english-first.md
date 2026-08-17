# Owner decision, 2026-08-17 — English is the product language for this phase

**Supersedes the owner decision of 2026-08-16** recorded in
`reports/product-review-F-001-final-2026-08-16.md` finding **H1**. Both are kept;
neither is edited. This one is current.

## What was decided

The app's language is **English**: the user speaks English, the assistant replies
in English, and all shipped copy is English. Other languages are a later,
separately-named piece of work.

Two follow-on calls made at the same time:

1. **Direct replacement, no i18n layer.** Copy stays as literal strings where it
   lives today; it is not extracted into per-language tables. The owner accepted
   the stated cost: a third language change would be a third full pass.
2. **The Vietnamese voice-undo phrase `hoàn tác` is dropped.** F-001 AC-5's undo
   vocabulary becomes `undo` only. (AC-5 treats these as *recognizer input*, not
   UI copy — a separate category from everything else here.)

## Why this is not a new question

Product review H1 on 2026-08-16 found the build shipping English against a design
system specifying Vietnamese, and put **exactly two paths** to the owner:

> (a) Localise the shipped strings to the Vietnamese `components.md` already
> specifies and re-render the mockups; or (b) amend `components.md` to declare
> English-first for the prototype and open a named localisation feature.

Path (a) was taken then. Path (b) is being taken now. The reversal is a change of
mind on a recorded fork, not a new fork.

## The owner's stated reason, and a correction worth recording

The reason given was that each language needs its own TTS. That is true but it is
the **cheapest** part, and the record should not imply otherwise:

- **TTS is platform-provided.** Voices come from the OS or browser; the app never
  bundles one. F-002 AC-13 already models this as a four-valued runtime capability
  check, and `installable` exists precisely because Android downloads voice data
  separately. Adding a language costs no new synthesis work.
- **The expensive halves are recognition and interpretation.** STT quality varies
  sharply by language, and it is the half a voice-first product leans on hardest.
  The interpreter is worse: today a 24-row fixture table, but a real model needs
  language-specific prompting and examples.
- **Plus language-specific text handling** — Vietnamese diacritic and tone-mark
  normalisation in `engine/normalize.ts`, and the `xoá`/`xóa` house-spelling split
  recorded as product-review M5.

So the decision is sound; the reason is better stated as **deferring STT and the
interpreter, with TTS coming along for the ride.**

## What this dissolves

- **BUG-005** (`qa/_shared/bugs/BUG-005-fixture-table-only-understands-english.md`)
  — the fixture table being 22-of-24 English is now **correct**, not a defect.
  Residue: the two Vietnamese rows (`hoàn tác`, `không`) are now the outliers.
  Mark the bug RESOLVED-BY-DECISION rather than fixed, and keep it: it records why
  the table looks the way it does.
- **product-review M5** — the `Xoá`/`Xóa` house-spelling split disappears with the
  Vietnamese copy.
- **F-002 OQ2** (mixed Vietnamese–English utterances) — moot for this phase.

## Scope, measured 2026-08-17

| Where | Lines carrying Vietnamese |
|---|---|
| `design/_shared/components.md` (owning artifact) | 27 |
| `design/assistant/screens/` (3 mockups) | 355 |
| `src/assistant/mobile/` | 240 |
| `src/assistant/web/` | 125 |
| `src/assistant/api/` (fixture table, normalize) | 22 |
| `qa/` (test expectations) | 179 across 61 files |
| `specs/` | 14 |

Plus the declared-language constants: F-002 **AC-23** and `data-model.md` change
`vi-VN` → `en-US`; `mobile/ports/native/rn-transcript-source.ts:71` hardcodes
`'vi-VN'`; `web/ports/web-speech-source.ts:50` reads `navigator.language`. Both
ports must read the one declared constant — that is AC-23's whole point and it is
unaffected by which language the constant names.

`_shared/model/format.ts` and `web/components/TaskListPane.tsx` already format
dates with `'en-US'`; those stop being drift and become consistent.

## Explicitly NOT rewritten

**`reports/` is historical record.** The earlier reviews describe what was true
when they were written, including H1's finding that the app shipped English copy.
Rewriting them would destroy the evidence of how the decision was reached. Only
forward-looking artifacts change: `design/`, `src/`, `qa/`, `specs/`.

The screenshot deck (`reports/screens-by-flow.html`) is Vietnamese throughout and
must be recaptured after the change lands, not edited.

## Sequencing

`design/_shared/components.md` is the owning artifact for copy and several tests
**parse it at run time** rather than hand-copying it (L-008). So design leads;
implementers follow; QA expectations last. `permissions.test.ts` will follow the
catalogue automatically — that design choice pays off here for the first time.
