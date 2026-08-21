# Owner decision, 2026-08-17 — on desktop the task list is the primary object

Owner: *"nếu là desktop thì ta có thể hiển thị AI chat ở right panel, ở giữa là
các todo."* Confirmed as a **repositioning**, not a layout tweak, plus one
constraint that keeps it cheap.

**Supersedes the confirmation given earlier the same day** that the list is removed
at every width. Both stand as record; this one is current. The earlier decision's
substance survives on mobile.

## What was decided

1. **Desktop: Tasks in the centre, chat in a right panel.** Opening the app on a
   wide screen shows your tasks first.
2. **The message bubble keeps its full diff at every width** — one mechanism, not
   two. The centre list is an addition, never the thing AC-1 relies on.

## This reverses the product's own thesis, deliberately

`UC-52` is titled *"Màn hội thoại (mặt chính)"* — the conversation **is** the main
surface — and `todo-ai ADR-11` exists to keep the list as the **fallback** when the
assistant fails. Putting the list in the centre makes it the primary object and the
assistant a panel: *a todo app with an AI assistant*, rather than *an AI assistant
for your todos*.

That is a different product thesis. It is also consistent with what the owner has
been saying all day — *"todo mà ko có các list cá nhân thì càng thiếu"* — and with
the UC coverage map's finding that of the five list surfaces ADR-11 names, two exist
reduced and three do not exist at all. The assistant was built; the todo underneath
it was not.

## Why constraint 2 is the load-bearing half

If the centre list were allowed to *be* the confirmation on desktop, `AC-1` would
carry **two mechanisms selected by viewport width** — spec branches, tests branch,
and the branch nobody runs is the one that rots. Keeping the full diff in the bubble
at every width means AC-1 has **one** mechanism everywhere and the centre list is a
bonus. Design flagged the same trap from the other side: the `Tasks · N` count is a
second confirmation and must never be specced as the guarantee, because a number
cannot say *which* task.

## Open, and not decided here

**What does mobile land on?** A phone has room for one surface. The peer-path design
stands — one tap between Talk and Tasks — but which one opens first was not asked and
is not answered by this decision. If the list is the primary object on desktop, landing
on the conversation on mobile is a defensible split (the phone is where you talk) or an
inconsistency (the primary object should be primary everywhere). Design should propose;
the owner decides.

## Consequence for work in flight

`T-103` (restating AC-1/AC-4/AC-15) was **stopped one minute in** — it had started on
the now-superseded premise that the message is the only place a result lives at every
width. It restarts after the design revision, not before.
