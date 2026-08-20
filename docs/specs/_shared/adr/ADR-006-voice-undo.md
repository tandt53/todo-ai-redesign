# ADR-006 — Voice-undo mechanism: closed phrase list, short-circuit before the model (OQ 6)

**Status:** accepted · 2026-08-16 · architect-agent (T-004) — architecture
half; design-agent owns the affordance/wording half.
**Amended:** 2026-08-17 (T-064, spec-agent) — **the closed phrase list shrinks
to `"undo"`**; `"hoàn tác"` is dropped per the owner decision recorded in
ADR-008. The Decision below is amended in place; the mechanism and every reason
for it are **unchanged**. See **§ Amendment (2026-08-17)** at the end for what
moved and what did not.

## Context

AC-5: saying "undo" undoes the newest applied turn and **never becomes a task
with that name**. (As written on 2026-08-16 the AC named two phrases,
"hoàn tác" / "undo"; see § Amendment.) Candidate mechanisms (11-uc §6.19): a
client-side closed phrase list vs a model `undo_turn` tool. The contract must
say whether the phrase short-circuits before model interpretation.

## Options considered

1. **Model `undo_turn` tool.** Handles paraphrases ("bỏ đi", "revert that"),
   but makes the core AC-5 guarantee probabilistic — a misclassification
   creates a task named "undo" — and drags undo through the model on every
   utterance. Rejected for v1.
2. **Client-side closed phrase list, exact match, short-circuit before any
   send** + a server-side guard as backstop. Deterministic; undo works even
   when the model/stub is down; guarantee holds by construction. Chosen.

## Decision

- **Yes — "undo" short-circuits before model interpretation.**
- **Phrase list (closed, shared constant `UNDO_PHRASES`):** exactly `"undo"`
  — one phrase, amended 2026-08-17 (§ Amendment) — matched on the **normalized
  full utterance** (trim, lowercase, Unicode NFC, strip terminal punctuation).
  Anything longer ("undo the last thing") is a normal turn for the model.
  Growing **or shrinking** the list is a docs/design/product decision; the
  mechanism doesn't change.
- **Client half:** on a match, the client sends **no turn**. It calls
  `POST /assistant/turn/{turn_id}/undo` with `via: "voice"` against the
  newest applied turn it renders. Stale affordance → the endpoint's visible
  AC-6 refusal. No applied turn known at all → the client renders the same
  refusal message locally (design-agent's catalogue), no server call, no
  task created (AC-8).
- **Server backstop (how the contract expresses it):** if a transcript
  normalizing into `UNDO_PHRASES` reaches `POST /assistant/turn` anyway, the
  server does **not** interpret and creates **no turn row**: it executes the
  undo path against the newest applied turn of the open session (or returns
  the refusal outcome) and records the result under the `client_turn_id` for
  dedupe — response `kind: "undo"` (api-contracts.md, processing rule 3).
  The turn-status machine is untouched because no turn exists; the outcome
  renders from the undone turn's `undo_result`, exactly as a tap undo.

## Consequences

- AC-5's "never a task named undo" holds even against a buggy client, and is
  testable in the API suite without any model: send `"undo"` as a turn,
  assert zero task mutations plus a real revert.
- The QA fixture table still carries undo-phrase rows asserting no
  interpretation call occurs (harness AI-call counter).
- Paraphrased undo intents fall through to the model and become no-match or
  clarify outcomes — honest, visible, and revisitable when F-002+ considers
  an `undo_turn` tool. This ADR fixes v1 semantics only.

## Amendment (2026-08-17) — the list shrinks to `"undo"`

**Trigger.** The owner decision of 2026-08-17
(`reports/owner-decision-2026-08-17-english-first.md`), recorded as **ADR-008**:
English is the product language for this phase. Alongside it the owner made one
follow-on call that is explicitly **not** UI copy — the Vietnamese spoken-undo
phrase `hoàn tác` is dropped, so F-001 AC-5's undo vocabulary becomes `undo`
only. AC-5 treats these phrases as **recognizer input vocabulary**, a category
F-001 § Conversation model's naming-convention paragraph deliberately separates
from UI copy. ADR-008 names this change and deliberately does **not** make it;
this note is where it lands.

**What changed.** `UNDO_PHRASES` was `{"undo", "hoàn tác"}`. It is now
`{"undo"}`. Nothing else in this ADR changes.

**What did not change, and is still correct.** The mechanism and every reason
for choosing it: a client-side **closed** phrase list over a model `undo_turn`
tool, **exact match on the normalized full utterance**, short-circuiting
**before** model interpretation, the client sending no turn, the server-side
guard as backstop creating no turn row, and the `kind: "undo"` response
contract. The Decision's own terms anticipated an edit of exactly this kind —
*"Growing the list is a docs/design/product decision; the mechanism doesn't
change"* — and shrinking it is that same decision class, taken by the owner
rather than by an agent. **Options considered** is left as written: it records
the reasoning available on 2026-08-16, including the rejected option's
Vietnamese paraphrase example, and rewriting it would destroy the record of why
the closed list won.

**Consequences of the shrink.**

- A `hoàn tác` utterance is no longer short-circuited. It falls through to the
  model as an ordinary turn and resolves as a no-match or clarify outcome —
  exactly the path Consequences above already describes for paraphrased undo
  intents. Honest and visible; no silent failure, and still no task created
  (AC-14).
- **AC-5's guarantee is untouched.** It is the guarantee that a phrase *in the
  list* never becomes a task, and the list is still closed and still matched
  exactly. A one-element list satisfies it the same way a two-element one did.
- The English `"undo"` needs no diacritic or tone-mark handling, so the
  normalization step (NFC, lowercase, trim, strip terminal punctuation) is now
  broader than this list strictly requires. It is kept as-is: it is the
  utterance-normalization contract the guard shares with the rest of the
  engine, not a Vietnamese affordance, and narrowing it would be a second,
  unasked-for change.

**Downstream, so the two halves describe one end state.**

- `docs/specs/assistant/api-contracts.md` processing rule 3 (voice-undo guard) —
  updated with this amendment, same task.
- `src/assistant/api/engine/normalize.ts`'s `UNDO_PHRASES` still carries the
  `'hoàn tác'` row — **T-073, backend-agent**, dispatched in parallel with this
  edit. Until it lands, code and contract disagree and the contract is the one
  that is right.
- The QA fixture table's `hoàn tác` row is the BUG-005 residue ADR-008
  § What this dissolves names; it follows **QA-expectations-last** per ADR-008
  § Sequencing.
