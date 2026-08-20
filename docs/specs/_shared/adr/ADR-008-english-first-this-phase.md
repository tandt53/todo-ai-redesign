# ADR-008 — English is the product language for this phase

**Status:** accepted · 2026-08-17 · product owner (decision), architect-agent
(write-up) · **the i18n half expires — see Review conditions**
**Supersedes:** the owner decision of **2026-08-16** recorded in
`reports/product-review-F-001-final-2026-08-16.md` finding **H1** — **for the
product's declared language only.** Both decisions stand as record; neither
report is edited. This one is current.
**Source of record:** `reports/owner-decision-2026-08-17-english-first.md`.

## Context

Product review H1 (2026-08-16) found the build shipping English copy against a
design system specifying Vietnamese — the app *listened* in Vietnamese and
*replied* in English — and escalated it as a product-owner call with **exactly
two paths**:

> (a) Localise the shipped strings to the Vietnamese `components.md` already
> specifies and re-render the mockups; or (b) amend `components.md` to declare
> English-first for the prototype and open a named localisation feature.

Path (a) was chosen then and is what `docs/design/_shared/components.md`,
`docs/specs/assistant/F-002-talk-back.md` AC-23 and `docs/specs/assistant/data-model.md`
currently encode. On 2026-08-17 the owner took **path (b)**. This is a change of
mind on a fork the pipeline already recorded and put to them — not a new fork,
and not a decision an agent may re-open on its own.

## Options considered

1. **Stay on path (a) — Vietnamese product, English deferred.** Rejected by the
   owner. It was the standing decision, so this ADR exists only because it was
   reversed.
2. **Path (b) with an i18n layer** — declare English-first *and* extract copy
   into per-language string tables now, so the next language is a data change.
   Rejected: it builds the mechanism for a capability (a second language) that
   this phase has explicitly deferred, and the tables would have exactly one
   populated column for the whole phase.
3. **Path (b) by direct replacement, no i18n layer** — chosen. Copy stays as
   literal strings where it lives today.

## Decision

**English is the product language.** The user speaks English, the assistant
replies in English, and all shipped copy is English. Other languages are a
**later, separately-named piece of work** — not a background obligation carried
by every feature in flight.

**Boundary of the supersession:** this ADR changes the *declared language* and
the copy that follows from it. It does not change AC-23's contract, which is
language-neutral — one declared source (`client.interface_language`), read by
both the synthesiser and the recognizer, never `navigator.language`, never a
per-port constant. Only the **value** the constant names moves, `vi-VN` →
`en-US`. It likewise does not license editing `reports/`, which are the
historical record of what was decided when.

**Direct replacement, no i18n layer** (the owner's second call, made at the same
time): copy is not extracted into per-language tables. Copy's owning artifact
remains `docs/design/_shared/components.md`, and the L-008 arrangement — consumers
store literals cited by row ID, tests parse the owning artifact at run time —
is unchanged and is what makes a whole-catalogue language swap tractable at all.

### The stated reason, corrected

The owner's stated reason was that **each language needs its own TTS**. True,
but it is the *cheapest* part, and the record should not imply the expense sits
there:

- **TTS is platform-provided.** Voices come from the OS or browser; the app
  bundles none. F-002 **AC-13** already models this as a four-valued runtime
  capability check (`available · installable · unsupported · resolving`), and
  `installable` exists precisely because Android downloads voice data
  separately. Adding a language costs no new synthesis work.
- **The expensive halves are recognition and interpretation.** STT quality
  varies sharply by language, and a voice-first product leans on it hardest.
  The interpreter is worse: today a 24-row fixture table, but a real model needs
  language-specific prompting and examples.
- **Plus language-specific text handling** — Vietnamese diacritic and tone-mark
  normalisation in `src/assistant/api/engine/normalize.ts`, and the `xoá`/`xóa`
  house-spelling split recorded as product-review M5.

So the decision is recorded as **deferring STT and interpretation, with TTS
coming along for the ride** — not as a TTS decision. Anyone re-costing the
second language should price the recognizer and the interpreter first.

## Consequences

- Good: one language to recognise, interpret, normalise and speak this phase.
  The declared-language constant becomes true rather than aspirational, and
  `_shared/model/format.ts` / `web/components/TaskListPane.tsx` — already
  formatting dates with `'en-US'` — stop being drift and become consistent.
- Good: three open items dissolve rather than needing work (below).
- Bad, and **accepted deliberately**: with no i18n layer, **a third language
  change is a third full pass** over the same surfaces. The cost is measured,
  not guessed — `reports/owner-decision-2026-08-17-english-first.md` counts 27
  lines in the owning artifact, 355 in the mockups, 365 in `src/`, 179 across 61
  `docs/qa/` files, 14 in `docs/specs/`. This is a tradeoff the owner priced and took; it
  is not an oversight and must not be reported as one.
- Neutral: the screenshot deck `reports/screens-by-flow.html` is Vietnamese
  throughout and is **recaptured** after the change lands, not edited.

### Review conditions for the no-i18n half (this expires; it does not rot)

Re-open the extraction question — and only that half; the English-first decision
itself is the owner's — when any of these becomes true:

- **A second language is actually scheduled.** The named localisation feature
  path (b) promised is the trigger; extract *then*, when there is a second
  column to fill.
- **A third whole-catalogue language change is proposed.** Two full passes are a
  priced tradeoff; a third is the point at which the pass costs more than the
  layer, and the arithmetic above is the input to that call.
- **Copy stops having one owning artifact.** The direct-replacement cost stays
  bounded only because `docs/design/_shared/components.md` owns every string and
  tests parse it (L-008). Copy authored in a second place — server-composed
  user-visible text, a second catalogue — makes a full pass unbounded, which is
  the M6 shape product review already flagged once.

**What would *not* change the answer:** finding the pass tedious, or a request
for a single translated string. The exception covers the whole catalogue moving
at once, which is the only thing direct replacement is cheap at.

## What this dissolves

- **BUG-005** (`docs/qa/_shared/bugs/BUG-005-fixture-table-only-understands-english.md`)
  — the fixture table being 22-of-24 English is now **correct**, not a defect.
  Mark it **RESOLVED-BY-DECISION** rather than fixed and keep it: it records why
  the table looks the way it does. Residue worth naming — the two Vietnamese
  rows (`hoàn tác`, `không`) are now the outliers, and F-001 AC-5's undo
  vocabulary drops `hoàn tác` per the same owner decision (recognizer input, a
  different category from UI copy — see ADR-006, which this ADR does **not**
  amend; that edit is a separately-scoped task).
- **product-review M5** (`reports/product-review-F-001-final-2026-08-16-v2.md`)
  — the `Xoá`/`Xóa` house-spelling split disappears with the Vietnamese copy.
  M6, its structural root cause (user-visible copy generated in two layers), is
  **not** dissolved: it is the condition the review clause above depends on.
- **F-002 Open Question 2** (mixed Vietnamese–English utterances) — moot for
  this phase; closed in the spec against this ADR rather than deleted.

## Sequencing

`docs/design/_shared/components.md` is the owning artifact and several tests parse it
at run time, so **design leads; implementers follow; QA expectations last**
(`reports/owner-decision-2026-08-17-english-first.md` § Sequencing). This ADR
and the spec edits that accompany it change only `docs/specs/`.
