# Owner decisions — the detail trap, and the message door

**Date:** 2026-08-18. Two questions, two answers, both taking the recommended
option. Neither was a lens finding: both were **found in composition** — each of
the ACs involved had already been reviewed and each is correct on its own.

Raised by spec-agent during T-145 (F-001 revision 5) and recorded there as
F-001 Open Questions 10 and 11. `specs/_shared/LEARNINGS.md` **L-015** carries
the durable half.

---

## 1. The detail never traps the user — closing always wins

**Chosen:** closing the task detail is **always available**. When a write has
failed, closing moves the user's value into a notice that **outlives the
detail**, so AC-2's guarantee — a failed value is never silently reverted —
survives the surface it was typed into.

**The state.** F-005 AC-2 requires the detail **not to close while a write is
unresolved**: on failure it stays, states what happened, and offers retry. Its
reasoning is sound and was product lens F10 — *"leaving a field is the gesture
that precedes closing, so the surface disappearing over its own write is the
likely case, and AC-2's last sentence has no field to leave the value in once
the surface is gone."* F-001 AC-24 requires the by-hand list to stay reachable
in **at most one action** from every conversation failure state, with the
reaching affordance *"neither hidden nor disabled by the failure being recovered
from"*. F-005 AC-45 puts the detail in the column the list occupies.

Compose them and the one action is unavailable.

**What made this worth an answer rather than a note:** a **server outage fails
both at once.** The save fails, so the detail holds; the turn fails, so the
conversation is in the state AC-24 exists for. This is not a rare interleaving —
it is the ordinary shape of an outage, and it is exactly when ADR-11's second
path is the thing keeping the product usable.

**What it costs.** The notice that outlives the detail **does not exist**. AC-2
named it and explicitly recorded not building it: *"the alternative — let it
close and report the failure somewhere that outlives the detail — needs a notice
family that does not exist and would put a per-field failure in a surface-scoped
component."* That was the right call against the case AC-2 was looking at. It is
the wrong call against this one, because the alternative here is not a lost value
but **a user with no route out during an outage**.

The two rejected options, recorded so neither is re-proposed as an oversight:
*close and discard the value loudly* — cheapest, and it takes typed work away at
the exact moment the app has already failed the user; *keep AC-2's hold and give
AC-24 an exception* — which spends the one guarantee ADR-11's second path exists
to make.

**Consequence to carry:** the notice family is now a design obligation, not a
road not taken. Where a per-field failure lives once its surface is gone is
design's to draw and F-005's to require.

## 2. The message door swaps the detail

**Chosen:** activating a task named in an assistant message, while a **different**
task's detail is open, **replaces the open detail with the named task's**.

**The state.** F-001 AC-31 makes every task the assistant names in a message a
door to that task. Above the split the conversation renders beside the detail
(F-005 AC-45), so the door is activatable while a detail is open. AC-31's
postcondition is stated layout-independently and stands; what has no entry is its
**route enumeration** — *"at or above it, the centre list only scrolls"* — for the
case where that column holds a detail.

Below the split the question does not arise: one surface shows at a time and the
conversation is not on screen.

**Why swap rather than close-and-scroll:** one context change instead of two, and
the user stays in the surface they were already working in. The door's promise is
*"here is that task"* — a detail **is** that task, and more of it than a scrolled
row.

**Why not inert:** that is the shape Gate 1 convergence 2 named — the assistant
reports changing a task and the link to it does nothing, with no explanation
available. AC-31 renders a task the list does not hold as plain text, and reusing
that here would make the door dead in the one arrangement where it is most
obviously alive.

**Two ACs the swap must respect, and they are already written:** F-005 AC-2 —
leaving a field is what saves it, so the swap must not discard an edit in flight;
F-005 AC-3 — a control the user currently has focus in is never overwritten while
it has focus.
