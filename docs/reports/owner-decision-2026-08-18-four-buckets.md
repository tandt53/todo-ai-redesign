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

---

## Confirmed 2026-08-18 (second pass): overdue stays in Today

The owner raised *"maybe inbox có thể bao gồm overdue tasks"* and, put the choice
back with its cost, **confirmed the original answer**.

The cost was stated plainly: overdue in *both* Today and Inbox breaks the
disjointness that made the model feel simple twenty minutes earlier, so the real
choice was Today **or** Inbox, not both. Inbox-instead was the cleaner-on-paper
option — it dissolves all three problems the fold creates — and it was declined
in favour of keeping overdue where the user will actually see it.

So the fold stands, and **the three problems it creates are now work, not
trade-offs to argue about again**:

1. `open_all` is sourced from the Inbox count, an identity that held only while
   Inbox was a superset. A user whose tasks are all future-dated would be told
   *"All done — your list is clear"* with a full week ahead.
2. `groupTasks` files overdue rows under a **Later** heading, so Today would
   claim its overdue members are in the future. False, not merely unhelpful.
3. `LSM-OVERDUE-TODAY` double-counts: *"N tasks past their date … N more due
   today"* claims a disjointness that is gone. Against the live store today it
   would read **"7 tasks are past their date: … 7 more due today."**

Plus two structural consequences: selection rule 4 (`overdue ≥ 1 and
open_today = 0`) is now **unsatisfiable and its frame unreachable**, and the
Lists menu needs a **fourth row** or future-dated tasks are invisible with
nothing erroring — which would break AC-24's reachability bound.
