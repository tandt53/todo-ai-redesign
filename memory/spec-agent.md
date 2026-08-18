# spec-agent — procedural memory

Layer 5. Read fully at every dispatch. Keep under 100 lines: this is muscle
memory for this codebase, not a log.

---

## Adding a field to `task` touches thirteen places, five of which gate behaviour
**Context:** any spec that adds, renames or narrows a field on the task entity.
**Pattern/Lesson:** do not assume the field list lives in one place. Measured on
2026-08-18 while specifying F-005: **thirteen non-test sites enumerate the task's
fields, and five of them gate behaviour rather than merely carrying it.** The one
that matters most is `api/engine/apply.ts` — that tuple is **simultaneously the
assistant's write allowlist and the source of the turn's visible diff**, so a
field omitted there makes the engine mark a task changed, change nothing, and
emit an empty diff. That is an F-001 failure caused entirely by a new spec's
silence.
**Example:** `apply.ts` (diff + allowlist), `app.ts` `TASK_PATCH_FIELDS` and
`TASK_CREATE_FIELDS`, `task-equals.ts` (hand-kept, and its safety net currently
holds by the accident of `updated_at` being in it), `serialize.ts`.

## The validation guards the HTTP boundary; the turn path does not call it
**Context:** any AC of the form "an empty/invalid value is refused".
**Pattern/Lesson:** `taskChangesFrom` is where the field rules live, and
`applyEdit` never calls it — it assigns straight onto the row. So a rule written
against the endpoint is unguarded on the assistant's path. State field rules as
binding **the write**, not the endpoint, or say explicitly which path they cover.

## "Not expressible" needs an outcome, or it asserts nothing
**Context:** any clause saying a shape is unsupported or refused.
**Pattern/Lesson:** an absence is only assertable through what happens instead.
Write "a write carrying X is refused and the record is unchanged". Without it, a
test author guesses between 400, silently-ignored and coerced — and the wrong
guess passes against a system that silently drops the field.

## Check whether the refusal can even be attempted
**Context:** an AC refusing the assistant a capability.
**Pattern/Lesson:** F-005 AC-36 refused the assistant three structural fields —
and the interpretation type **cannot express them at all**, so no fixture row
could try, and the AC shipped asserting nothing. If the refusal is type-level,
say so and name the contract file as the observable; if it is runtime, the
AI-facing shape has to be able to carry the field.
