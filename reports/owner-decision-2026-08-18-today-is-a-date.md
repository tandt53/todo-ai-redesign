# Owner decision, 2026-08-18 — Today means a date, not a status

Owner: *"nếu task không có ngày thì sao mà biết được là hôm nay? nếu task được
tạo ở trong list today thì mặc định gán luôn today, nếu ko có due date thì ko
được hiển thị today, nếu nó được tick thì vẫn không count."*

## The model

1. **Today is exactly the tasks whose `due_at` is today.** No status leg.
2. **Creating a task while viewing Today sets `due_at` to today.**
3. **A task with no date is never in Today** — open or done.
4. **"Done today" is `status: 'done'` and `due_at` today.** A dateless task, even
   ticked, is never counted.

## Why this is the right answer, stated in the owner's own terms

*"If a task has no date, how would you know it is today?"* — that is the whole
argument, and the shipped model does not survive it. `dueToday` currently reads
`t.status === 'today' || isToday(t.due_at, now)`, so **Today means two different
things at once**: a date bucket and a status bucket. The status leg is the half
that cannot answer the question, and it is the half that made `done_today`
underivable — a dateless task that was on Today loses every marker the moment it
is ticked.

Removing the status leg costs a field nobody needs and buys the mid-day shape
back **without a data-model change**. `due_at` survives completion untouched
(`toggleTask` only writes `status`), so `done` + `due_at` today is exactly the
count that was missing.

## Consequence: `status: 'today'` becomes a value that means nothing

Membership in Today now comes from the date. That leaves `TaskStatus`'s `'today'`
member with no remaining job, and two live sites that write it:

- `_shared/controller.ts:574` — **un-completing a task sets `status: 'today'`**,
  which already sends an un-ticked Inbox task to Today regardless of where it came
  from. Under this model it would write a status that means nothing while *also*
  failing to put the task in Today (no date). Both halves are wrong; they should
  be fixed together, not separately.
- `_shared/testing/fixtures.ts:26` — a default in the shared fixtures.

Plus the enum itself in `api/types.ts:6` and `api/app.ts:38`, and the
`Collection` type in `tasks.ts`, which is a **different** three-value set that
happens to share the names. Those two must not be conflated while changing one.

Whether `'today'` is removed from `TaskStatus` or retained as a legacy value with
a migration is an architect call, not a design one. **What is decided here is the
behaviour, not the schema.**

## Also settled by this

The `addTask` contract change recorded on 2026-08-18 (add-in-context) is
confirmed and sharpened: on Today it sets the **date**, not the status.

## Not settled

Whether an existing dateless task can be *moved* to Today by hand, and what that
does — presumably sets today's date. No surface offers it today.
