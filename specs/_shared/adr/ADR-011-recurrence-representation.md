# ADR-011 — Recurrence is six flat scalars, and a set is a canonical string

**Date**: 2026-08-19
**Status**: accepted
**Feature**: F-005 (AC-21, AC-25, AC-34, AC-46)

## Context

`F-005 AC-21` states the requirement and leaves the representation open:
*"recurrence is represented so that cloning, equality and diffing remain
correct — flat scalar columns, or deep copy on snapshot capture plus structural
comparison in modified-since. Which one is architecture's call."*

Four shipped mechanisms are scalar-only by construction:

| Mechanism | Why an object breaks it |
|---|---|
| `cloneTask` (`task-equals.ts`) | shallow spread — the undo snapshot and the live row would **share one object**, so editing the rule edits the snapshot and AC-34 and AC-5 both stop holding, invisibly, because the identity comparison passes for the same reason the bug exists |
| `taskEquals` `FIELDS` | `===` per field — two structurally equal rules compare unequal |
| `applyEdit` / `applyDelete` → `DiffRow.old/new` | writes whole field values; `data-model.md § assistant_turn` declares `{task_id, field, old\|null, new\|null}` with `null` as the *absent* sentinel |
| the four row constructors | build flat literals |

And the spec recorded one question it would not answer (architect F3):
**two of the six members are sets** — `recurrence.weekdays` (day-of-week) and
`recurrence.month_days` (int 1–31). A set on either side of a diff row collides
with the `null` sentinel and with F-001 AC-4's `old → new` rendering, and
`applyCreate` / `applyDelete` enumerate every non-null member — so it is
emitted on **every create and delete of a repeating task with a weekly or
monthly rule**, the ordinary case rather than an edge.

## Options considered

1. **Nested `recurrence` object + deep copy on capture + structural equality.**
   Honest to `## Data`'s dotted names; costs a change to `cloneTask`,
   `taskEquals` and the `DiffRow` contract at once, and leaves the diff-row
   question open — an object still cannot ride `old|null, new|null`.
2. **Flat scalar columns, sets stored as JSON arrays.** Flat in name only:
   `===` on two arrays is identity, so `taskEquals` is wrong for the two
   members that matter, and the diff row still carries a non-scalar.
3. **Flat scalar columns, sets stored as a canonical string.** Chosen. Every
   member is a scalar in storage, on the wire and in a diff row.
4. **Flat storage, structured wire.** Rejected: the wire object and the flat
   columns are the same fact in two shapes, hand-kept — **L-004** exactly, on a
   field whose whole hazard is that its copies drift silently.

## Decision

- **Six flat columns on `task`**, replacing the dotted names one-for-one:
  `repeat_frequency`, `repeat_interval`, `repeat_weekdays`, `repeat_month_days`,
  `repeat_until`, `repeat_count`. `## Data`'s `recurrence.x` is the requirement
  name; `repeat_x` is the field. The mapping is stated once, in
  `data-model.md § task — recurrence`.
- **The same six, flat, on the wire.** No assembly step, no second shape, one
  enumeration (`RECURRENCE_MEMBERS`) that the diff, the validator and the
  serializer all read.
- **A set member is stored as a canonical string** — validated, de-duplicated,
  sorted and joined on write, so two equal sets are byte-equal:
  - `repeat_weekdays`: `"mo,tu,we,th,fr,sa,su"` subset, in that fixed order.
    Example `"mo,th"`.
  - `repeat_month_days`: ascending integers, comma-joined. Example `"1,15,31"`.
  - A write whose value is not already canonical is **canonicalised, not
    refused** (`"th,mo"` → `"mo,th"`); a write naming a value outside the set
    is refused under AC-21's rule.
- **`taskEquals` and `cloneTask` are unchanged in kind.** Six field names join
  `FIELDS`; the shallow spread stays correct because every value is a string,
  a number or `null`. The snapshot-aliasing bug AC-21 names is not fixed — it
  is made unreachable.
- **A recurrence change is reported as per-member diff rows** (AC-21), one row
  per changed member, `field` = the flat column name, `old`/`new` the scalar or
  `null`. **This is the answer to the recorded diff-row question:** the set
  rides the row as its canonical string, so
  `data-model.md § assistant_turn`'s declared `{task_id, field, old|null,
  new|null}` **does not change**, and F-001 AC-4 renders `old → new` for a
  weekly rule exactly as it does for a title.
- **`null` keeps its one meaning — the member is absent.** An empty set is not
  representable and is not a state: a weekly rule with no weekdays is the rule
  *without* `repeat_weekdays`, and a write carrying `""` is refused.

## Consequences

- **Good:** the four scalar-only mechanisms need no redesign, so AC-34's
  replay/compare rules and AC-46's undo record keep working on the same
  primitives. Nothing new can alias.
- **Good:** the recorded diff-row question is closed without touching two
  documents this feature does not own (`data-model.md § assistant_turn`'s
  declaration and F-001 AC-4's rendering) — the constraint they impose is met
  rather than amended.
- **Bad:** a set needs a parse/format pair, and a hand-written stored value
  could in principle be non-canonical. The write path canonicalises, so the
  only producer of a non-canonical value is a seed path — which is the one
  place a test *wants* to construct one.
- **Bad:** `"mo,th"` reads worse in a raw store dump than `["mo","th"]`. Paid
  knowingly for exact equality.
- **Neutral:** the diff for a weekly→monthly change emits up to six rows. F-001
  AC-4 already renders a row per changed field; this is that behaviour, not a
  new one.
