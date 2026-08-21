# Owner decision — creating a task while viewing Upcoming

**Date:** 2026-08-18
**Asked because:** ADR-009 §4 fixes *creating in a collection puts it in that
collection, by date*. For Today the instant is derivable — that day's local
start. **Upcoming is not one day.** Its predicate is `due_at > today`, which
names no instant, so §4 has nothing to resolve to. Architect left the cell open;
design-agent looked at it and refused to close it too, listing three answers
with their costs and recommending none of them.

## What the owner chose

> *"Cứ lưu không ngày, hiện thông báo 'Đã lưu vào Inbox'"*

Save it dateless, and say where it went.

This is **option 2 of design's three, taken deliberately rather than by
default** — which is the distinction that makes it acceptable. Design's own
objection to option 2 was never that a dateless task is wrong; it was that *"the
task disappears from the surface at the moment of creation, which is the one
thing a create action must never look like."* A notice is the answer to that
objection, not a decoration on it.

## The two it beat

1. **The local start of tomorrow** — least-committal instant satisfying the
   predicate, keeps §4 exactly. Rejected on the owner's own standing rule: it
   invents a date the user never said. It also does not even hold: the task
   leaves Upcoming for Today by morning, so the collection it was created in is
   not the collection it ends up in.
2. **No composer on Upcoming at all** — coherent, with precedent in Done, which
   has no create action because no action fills it directly. Rejected because
   Upcoming is not Done: an action *can* fill it, it just needs one more fact.
   And removing it costs the most on day one, since **every account currently
   lands on an empty Upcoming** — the CTA on that empty state would be the thing
   removed.

## What this does not settle

**Where the task went is now said; where it *should* have gone is still not
asked.** The owner's rule on the voice path is that the assistant asks for a
date when it hears none and creates dateless only if the user declines (T-127).
The hand path now does the second half without the first. That is a deliberate
smaller step, not an oversight: it makes the existing silence audible for the
cost of one component, and leaves the question of asking to the surface where
asking already has a specification.

Two other shapes were shown to the owner and not chosen, both recorded because
they remain available if the notice proves insufficient:

- **Upcoming as a sequence of days**, with a create action under each day
  heading, so the day supplies the date and the problem dissolves — the shape
  Todoist, Things and TickTick converge on. Costs a re-drawn surface.
- **A date field in the composer, empty and first**, with declining it producing
  option 2 explicitly. Costs a step on every create.

## Consequences

- The code already behaves this way (`dueAtForCollection` returns `null` for
  every collection but Today), so **nothing about where the task lands changes**.
  What changes is that it stops being silent. Recorded because a decision whose
  implementation is "add a message" is easy to mistake for a no-op.
- **This app has no toast, snackbar or transient notice of any kind** — not in
  `design/_shared/components.md`, not in `src/`. The decision introduces a new
  class of surface, which is why it is a design task (T-135) and not a one-line
  change.
- The path is not rare. ADR-009 § Amendment measured that no account holds a
  single future-dated task, so an empty Upcoming with an `Add task` CTA is
  **every user's first encounter with the collection**.
