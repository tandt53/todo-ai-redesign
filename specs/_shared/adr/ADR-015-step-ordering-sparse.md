# ADR-015 — Step order is a sparse integer, a move is one write, and the undo reads the move's own response

**Date**: 2026-08-19
**Status**: accepted
**Feature**: F-005 (AC-15, AC-14, AC-43, AC-26)

## Context

`F-005 AC-15` makes two requirements and leaves the representation open:

- **A move is one write.** *"Positions are represented so that moving one step
  among N changes **one** row — a sparse or fractional position; which is
  architecture's choice"* — because both alternatives break something already
  stated: N separate writes make AC-43's single-action undo reverse N writes
  with no stated grouping, and they render the intermediate orders to every
  other client through AC-3, the window AC-14 refused for POST-then-PATCH.
- **The order survives a restart and a delete**, because it lives on the step's
  own record — a **server row, not a client buffer**, which is why AC-41 exists.

And one question was recorded rather than answered (architect F5): **where a
reordered step's prior position comes from.** AC-15 gives it two sources in one
sentence pair — *"carried by the move's own response"* and *"a value the client
already holds"* — and two different contracts satisfy them, while the AC was
amended specifically to say *"no new record is owed"*, which only the second
reading makes true.

## Options considered

**For the position**

1. **Dense integers, renumbered on every move.** Simple to read; N writes per
   move, which AC-15 forbids as the default.
2. **Fractional (float) positions.** One write always, and precision degrades
   after repeated midpoint insertion; equality and diffing of floats is exactly
   the fragility ADR-011 spent an argument avoiding for recurrence.
3. **Sparse integers with a gap, renumbering only when a gap is exhausted.**
   Chosen. One write in the ordinary case, exact equality, and the rare
   renumber is a multi-row write the contract already has a rule for.

**For the prior position**

1. **A new record of the move** (an undo entry server-side). AC-15 says no new
   record is owed. Rejected.
2. **The client remembers the value it read before dragging.** It is a client
   buffer, and the row it describes may have been renumbered underneath.
3. **The move's 200 response carries the pre-write value.** Chosen — it is
   both sources at once, which is why the sentence pair could be read two ways:
   the response carries it, and *therefore* the client holds it.

## Decision

- **`step_order: integer`**, per parent, assigned by the server on append as
  `max(sibling step_order) + 1024`. First step is `1024`.
- **A move writes one row**: the server sets the moved step's `step_order` to
  the midpoint of its two new neighbours (or `neighbour ± 1024` at an end).
- **When the gap between neighbours is smaller than 2**, the server renumbers
  every sibling to fresh multiples of 1024 **in the same transaction** and
  **returns every row it changed** (AC-26's rule; `changed` in the response).
  The move is still one request and is undone as one unit.
- **The prior position comes from the move's own response and from nowhere
  else.** Every `200` from `PATCH /tasks/{id}` carries
  `prior: { <changed field>: <previous value> }` — the pre-write value of each
  field the write actually changed. The reorder undo replays
  `prior.step_order` through the same `PATCH`. **No new record, one source,
  and the undo's write path is the move's write path** — which is L-005's
  remedy rather than a second door onto ordering.
- **`step_order` is never derived from a date** (AC-15) and a **done** step
  keeps its position and can still be moved.
- **A create may supply `step_order` and the server preserves it** (AC-14's
  offline replay); a create that supplies none is appended last. This is
  `## Data`'s cell verbatim and is the reason `POST /tasks` accepts the field.
- **A drop where the step already was writes nothing**: the server compares the
  requested position against the current one and returns `200` with an empty
  `prior` — so AC-43's *no undo entry* and AC-16's *announces nothing* both have
  an observable, rather than depending on the client noticing.

## Consequences

- **Good:** the ordinary move is one row, exactly as AC-15 requires, and the
  intermediate-order window AC-14 refused for POST-then-PATCH never opens.
- **Good:** `prior` is uniform. It is defined for every `PATCH`, not
  special-cased for ordering, so a later hand-action undo for any field has the
  value it needs without a second contract.
- **Bad:** a renumber is an N-row write that a user cannot predict. It is rare
  (1024 halvings between two neighbours), it is atomic, and every changed row
  is returned — so no client sees an intermediate order. The cost is that one
  move in a long-lived list is slower than the rest.
- **Bad:** `prior` adds a small payload to every `PATCH` response. Bounded by
  the number of fields the write changed, which AC-2 makes small by construction
  (field-level writes).
- **Neutral:** gaps of 1024 are an arbitrary constant. Recorded in
  `data-model.md § task — steps` so it is one number in one place.
