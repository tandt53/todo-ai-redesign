# Owner decision, 2026-08-18 — four buckets, all of them date filters

Owner: *"Tôi tưởng inbox và today chỉ là filter dựa theo due date thôi, sao lại
phức tạp thế nhỉ?"* — followed by: add **Upcoming**, and **overdue folds into
Today**.

## The model

| Bucket | Membership |
|---|---|
| **Done** | `status: 'done'` |
| **Today** | not done, `due_at` **on or before** today — overdue included |
| **Upcoming** | not done, `due_at` **after** today |
| **Inbox** | not done, **no `due_at`** |

**Total and disjoint.** Not done splits on has-a-date; dated splits on
past-or-today versus future. Every task has exactly one home and none is
stranded — which is the property the current model bought by other means.

## Why the previous model felt complicated, stated plainly

`Inbox` was **"every open task"**, not a date filter — so it contained Today, and
the two collections were of different kinds. That was not an oversight: with only
three buckets and no home for a future-dated task, making Inbox a superset was
the only way nothing fell out. **The complexity was the symptom of a missing
bucket**, and `todo-ai ADR-11` had named that bucket all along (Inbox · Today ·
**Upcoming** · Logbook). The UC coverage map recorded that two of those five
surfaces exist reduced and three do not exist; this builds one of the missing
three.

Worth recording so the next reader does not think anyone contradicted themselves:
the owner said *"Inbox là những việc chưa xong"* in the morning and *"Inbox và
Today chỉ là filter theo due date"* in the afternoon. Both are coherent — they
are answers to **different questions**, and the question that was never asked
until now is *where does a task due next week live?*

## Overdue folds into Today

Chosen over a separate overdue surface, on the argument that a task disappearing
from view is how it gets forgotten. Today therefore means *"needs attention now"*
rather than literally *"dated today"* — and that is a deliberate widening of the
word, not a bug to correct later.

## What this changes downstream

- **`inCollection` is rewritten**, and `Collection` gains `upcoming`. This is
  a **user-visible change to what Inbox holds**: from every open task to only the
  undated ones.
- **The landing summary's overdue shape needs re-reading.** Design made `overdue`
  a top-priority frame ranked above everything but an empty list, on the argument
  that a rule keyed on `open_today` alone would congratulate a user with overdue
  work. With overdue now **inside** Today that argument's premise changes — the
  count already includes them. Whether the greeting still names them separately is
  design's call, and it should be an explicit one.
- **The `Tasks · N` badge** counts open-today, which now includes overdue.
  Arguably more honest; still a change in what the number means.
- **T-124 is answered by construction.** The assistant creates dateless tasks, and
  Inbox now genuinely means *"no date yet"* rather than *"everything"* — so a task
  landing there is explainable rather than surprising. Combined with the owner's
  other answer — the assistant **asks** when it hears no date, and only creates
  dateless if the user does not commit — the behaviour is now something the app can
  account for out loud.

## The assistant's part, settled at the same time

*"Nghe user nói, nếu không có thông tin ngày thì có thể hỏi lại; nếu user chưa
chốt thì vẫn tạo task mà không có due date, mặc định vào Inbox."*

So: ask, do not assume. Create dateless only when the user declines to date it.
No date is invented on the user's behalf — which was the objection to option 1 in
the invisible-tasks question and remains the objection.
