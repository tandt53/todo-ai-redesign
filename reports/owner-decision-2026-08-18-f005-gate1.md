# Owner decisions — F-005 Gate 1, round 1

**Date:** 2026-08-18. Four questions, four answers, all taking the recommended
option. Each was escalated because no lens could settle it.

## 1. Reminders — show them when the app opens

**Chosen:** when the user opens the app, reminders whose instant has passed are
shown. No scheduler, no push, no permission prompt, no dependency on UC-26.

This option **was not in the spec.** The spec offered ship-with-a-disclaimer or
withhold; the product lens found the third and it dissolves the contradiction
rather than choosing a side of it. AC-11 as written asks one control to say *"I
am the one that alerts you"* **and** *"reminders are not delivered yet"* — no copy
satisfies both, so what ships is either a promise the app breaks or a control
announcing its own uselessness.

The decisive fact was measured, not assumed: `reminder_at` is set on **zero rows
and read by nothing**. The spec's own Purpose calls a field with no consumer a
*write-only data path* and treats it as a defect; exposing it in the UI would have
made it a **user-visible** one.

**This was the blocking question.** It decides whether AC-11 exists at all —
"withhold" would have deleted AC-11, halved AC-10, and removed the reminder
clause from AC-27 along with the HIGH finding attached to it. Building it first
and deleting it after is the expensive order, which is why it was asked before
the revision rather than after.

## 2. Mobile — web-first, but the three leaks are plugged now

**Chosen:** the detail surface is web-only this phase; the behaviours that reach
the phone regardless are handled inside F-005.

**The question was first put to the owner on a false premise, and the correction
matters.** The spec argued against pulling mobile in because *"the phone is still
missing rename and delete on its rows"* — which stopped being true earlier the
same day (`mobile/components/TaskList.tsx` calls `editTask` and `removeTask`).
That stale sentence was the argument *against*, inherited faithfully from
`uc-coverage-map.md`, whose D8 rows are now corrected.

The owner was told the premise was wrong before answering, and chose web-first
anyway — so this is a decision on the facts, not on the stale ones.

**What "web-first" does not buy:** three behaviours are server-side or
shared-model and land on the phone whether or not the phone is in scope. A mobile
user who ticks a repeating task would get **a row they did not create, dated next
week, with no repeat indicator anywhere on that client and no way to see or end
the series.** A mobile tick on a parent would silently complete steps that client
never renders. And four ACs have their implementation in `src/assistant/_shared/`,
which the mobile client compiles.

Since platform tags decide which QA agents cover an AC, tagging these `(api)` and
`(api, web)` would mean **no mobile tier ever verifies them.** That is the leak
this answer closes.

## 3. Voice — the four value fields become reachable; structure stays by hand

**Chosen:** note, priority, due date and reminder are reachable by voice. Sub-task
structure and recurrence rules remain hand-only.

The product lens's finding was that AC-36's permitted half is **a permission, not
a capability**: the interpreter's 23 fixture rows contain exactly two edit rows,
changing title and status, and **not one touches a field this feature adds.** An
implementation that allowlists four fields and leaves every one unreachable
**passes AC-36 completely.**

On a product whose one-line purpose is *"the user talks to an AI assistant to
create, edit and delete todos"*, shipping six new field concepts that cannot be
spoken is the wrong default. The line is drawn at **values versus structure**:
values are what people say out loud; structure is what people arrange with their
hands, and "make this weekly" is the most misinterpretable sentence in the
feature.

Consequence to carry into the revision: **one fixture row per permitted field**,
so the allowlist is asserted rather than assumed.

## 4. Delete — the row's delete gains the undo it never had

**Chosen:** the missing undo on the list-row delete comes into F-005 rather than
being left to an unspecced surface.

After F-005 there would be two doors to one destructive action with **different
safety**: delete from the detail is reversible in place, delete from a row (web,
and now mobile) is not reversible at all. **Users do not model "which control did
I use" — they model "delete is undoable here."**

The spec's open question framed this as a matter of deliberateness (should the
detail have a delete at all); the product lens reframed it as safety and offered
the third option, which is what was taken.

Note the dependency this creates: **no route in the system can un-delete a task
today.** Both the architect and dev lenses found this independently — `DELETE`
soft-deletes, `PATCH` 404s on a deleted row, re-`POST` 409s, and the only
un-delete reverts a *turn*, which a hand delete never creates. So `## API Touch
Points`'s claim that the existing endpoints "carry all of it" is **false**, and
this answer makes closing that gap mandatory rather than optional.
