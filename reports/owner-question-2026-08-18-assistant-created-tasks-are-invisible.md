# Open question, 2026-08-18 — a task the assistant creates does not appear on the screen the app opens on

**Found by web-agent during T-121, verified by the orchestrator. Not a regression
introduced by that task — a consequence of two decisions meeting.**

## The behaviour, in three steps

1. Open the app. It lands on **Today** (owner decision, 2026-08-18).
2. Say *"add a task to buy milk"*. The assistant creates it.
3. Open Tasks. **It is not there.**

Verified in code, not inferred: the interpreter creates with `due_at: null`
(`api/engine/apply.ts:48`, and no fixture row supplies a date —
`ports/fixture-table.ts:14`). Today is now exactly `isToday(t.due_at, now)`
(`_shared/model/tasks.ts:108`). A dateless task is in **Inbox**, and the app
opens on **Today**.

## Why the earlier fix does not cover it

When the owner chose Today as the default, the orchestrator resolved the
resulting collision with **add-in-context**: adding a task while viewing a
collection puts it in that collection. That was written for the **manual
composer**, and it works there.

The assistant is a different creation path and was never routed through it. So
the fix covers the *secondary* way tasks are made and misses the *primary* one —
in a product whose entire premise is that you talk to it.

The offline local-create path (F-001 AC-25) has the same shape.

## Why this is a product question, not a bug to fix quietly

Three answers are all defensible, and they say different things about what the
app is:

1. **The assistant dates what it creates as today** — "if you told me now, it is
   for now". Makes the primary path visible on the default surface. Costs: the
   app puts a date on something the user did not date, and every such task becomes
   **overdue tomorrow** — which is the landing summary's highest-priority shape.
   The app would start nagging about deadlines it invented.
2. **The assistant creates dateless, and the app opens on Inbox instead** —
   reverses the owner's default-collection answer, and Inbox is every open task,
   so the day has no shape.
3. **The assistant creates dateless, Today stays the default, and the confirmation
   message is the receipt** — the bubble already names the task, and AC-31 makes
   that name a link to its row. The user sees what happened; they just do not see
   it in Today, because it is not for today. Costs nothing, and requires believing
   that a task with no date genuinely does not belong on Today — which is the
   owner's own argument from this morning.

**The orchestrator's read is (3)**, because it is the only one that does not undo
a decision the owner just made, and because the owner's own reasoning —
*"if a task has no date, how would you know it is today?"* — applies with equal
force to a task the assistant created. But the user-visible effect is real and
the owner should see it before it ships.

## Status

Nothing has been changed to work around this. The code implements ADR-009 exactly
and the behaviour is asserted explicitly rather than left implicit, so whichever
answer is chosen, the test that encodes it is already the thing to edit.

**Related, already predicted:** ~20 assertions in
`qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts` expect
AI-created tasks to be visible on the landing collection. They will fail. That is
a QA task, and its outcome depends on this answer.
