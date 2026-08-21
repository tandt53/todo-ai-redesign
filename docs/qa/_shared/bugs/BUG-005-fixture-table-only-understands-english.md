# BUG-005 — the app replies in Vietnamese but only understands English

> **RESOLVED BY DECISION — 2026-08-17.** The product owner decided English is the
> product language for this phase (ADR-008 / `docs/reports/owner-decision-2026-08-17-english-first.md`).
> The fixture table being 22-of-24 English is therefore **correct**, and the
> premise of this report — that the app replies in a language it cannot hear —
> stops being true once the copy change lands.
>
> **Kept, not deleted**, because it is the only place that records *why* the
> table looks the way it does, and because one finding in it survives the
> decision: **the Vietnamese input path has never been executed end to end at
> any tier.** That was a coverage claim about a language, and it becomes a
> coverage claim about the *deferred localisation feature* — whoever picks that
> up inherits it. Two residues to clean up with the copy change: the rows
> `hoàn tác` and `không` are now the outliers in an otherwise English table.

- **Severity:** HIGH as a coverage gap, MEDIUM as a prototype defect
- **Found:** 2026-08-17 (T-057 follow-up), by sending a natural Vietnamese sentence to the running server
- **Status:** **RESOLVED BY DECISION, 2026-08-17** — not fixed, dissolved. See below.
- **Affects:** `src/assistant/api/ports/fixture-table.ts` — and, through it, every QA test case and fixture in the repo

## Reproduction (executed, not inferred)

`POST /assistant/turn` against the running prototype server:

| transcript | outcome |
|---|---|
| `thêm việc mua sữa` — natural Vietnamese | **`no_match`** |
| `add a task to buy milk` — English | `applied`, `created_titles: ["Buy milk"]` |

## What is wrong

`FIXTURE_TABLE` holds 24 utterances. **22 are English.** Only `hoàn tác` and
`không` are Vietnamese, and both are answer/undo keywords rather than task
commands.

All shipped UI copy is Vietnamese — that was an owner decision taken after
product review H1 (`docs/reports/product-review-F-001-final-2026-08-16.md`), which
found the build shipping English copy against a design system that specified
Vietnamese, and described the result as *"the app listens in Vietnamese and
replies in English."*

The current state is **that same defect mirrored**: the app now *replies* in
Vietnamese and *understands* only English. A Vietnamese user — the entire target
market for a voice-first Vietnamese todo app — gets `no_match` on their first
sentence.

## Why this is worse than a prototype limitation

The fixture table is not only the server's stub. It is the **shared vocabulary
every test is written against**:

- QA's e2e cases drive the app with these exact strings (`tests/assistant/e2e/F-001-voice-assistant-view.spec.ts` defines them as `U`).
- The mobile automation and the simulator scenarios use them too.
- So the Vietnamese input path has **never been executed end to end**, at any tier, by anything.

That is `LEARNINGS.md` L-003's shape again: a path nobody exercises, in a product
whose whole premise is that path.

Two consequences worth separating:

1. **Now** — no test proves a Vietnamese sentence produces anything. Normalisation
   (diacritics, tone marks, casing, the `xoá`/`xóa` split already recorded as
   product-review M5) is unexercised. `engine/normalize.ts` does carry Vietnamese
   handling; nothing keyed in Vietnamese reaches it.
2. **When the real interpreter lands** — every fixture-based expectation is in
   the wrong language, so the switchover silently changes what is being tested.

## Fix

Not "translate the table". The decision to make first is **what the fixture
vocabulary is for**, and it is an owner call:

- If fixtures are a stand-in for the model, they should be keyed in the language
  users actually speak, with the English strings kept only where a test needs a
  stable non-Vietnamese case.
- If they are deliberately English for developer convenience, that must be stated
  where the next QA author reads it, and a Vietnamese path must be covered
  separately — otherwise "we tested the assistant" is not true in the language it ships in.

Whichever way it goes, at least one end-to-end case must drive a natural
Vietnamese sentence through to an applied outcome, and it must be able to fail.

## Related

- `docs/reports/product-review-F-001-final-2026-08-16.md` H1 — the original English/Vietnamese inversion
- `docs/reports/product-review-F-001-final-2026-08-16-v2.md` M5 — `Xoá`/`Xóa` house-spelling split, still unresolved
- F-002 AC-23 — `client.interface_language` is a build-time constant `vi-VN`; this bug is the *input* half of the same subject
