# Owner decision, 2026-08-17 — the conversation screen stops showing the task list

Owner: *"cần design lại app cho đầy đủ ứng với các feature đã có"* and *"màn
conversation cũng phải design lại để ko hiển thị list các todo phía trên. Ta gắn
các todo tại các message là được rồi."*

## The decision

The conversation surface **no longer renders the task list**. Tasks appear
**inside the messages that changed them** — which the message bubbles already do
("Added 1 task · Buy milk", with the diff and the Undo affordance).

And the app is to be designed **as a whole**, against the feature set it actually
has, rather than screen by screen.

## This reverses F-001's stated reasoning, deliberately

The list sits beside the conversation today for a recorded reason, in
`AssistantScreen.tsx:29-31`: F-001 **AC-1 and AC-4** require an applied turn's
changes to be visible in the list **within the same turn**, which is why the list
was placed beside the conversation rather than behind navigation.

The owner's answer is that **the message bubble is that confirmation.** It already
names the task, shows the diff and carries Undo. A second rendering of the same
fact, permanently occupying half a phone screen, was the redundancy — not the
safeguard it was specced as.

**AC-1 and AC-4 therefore need restating, not deleting.** Their requirement — the
user can see what changed, in the same turn, without hunting — survives; the
mechanism that satisfies it changes. A spec pass that quietly drops them would
lose the guarantee; one that leaves them as written would contradict the build.

## What this pulls in with it

Removing the list from the conversation raises three questions that were
previously answered by "it is always on screen":

1. **Where does the full list live?** It must exist somewhere — `todo-ai ADR-11`
   is explicit that the list is the **second path** when the assistant fails, and
   the UC coverage map records that of the five surfaces ADR-11 names, two exist
   reduced and three do not exist at all. This decision makes that gap load-bearing
   rather than latent.
2. **Navigation now has to be real.** The hamburger currently only toggles the
   list; with the list on its own surface it becomes actual navigation. That is
   the same control the owner already flagged as "not a menu", and the same place
   the settings surface has to live.
3. **What does a task look like outside a turn?** In a message it is a diff. On a
   list surface it needs its own row treatment, and — per the settings-and-lists
   decision — personal lists as a grouping, which the data model does not have.

## Consequence for the current build

`TaskListPane` (web) and `TaskList` (mobile) are rendered by the conversation
screens today, and F-003's parity contract lists their behaviour among the ACs
holding identically. Both clients, the mockups, the testids and the QA cases that
assert on the list-beside-conversation layout are all affected. This is a
design-led change and should not start in code.

## Confirmed 2026-08-17: no list on the conversation at ANY width

Design raised the ambiguity honestly — the decision was written unconditionally while the
complaint that prompted it was about a phone, and reinstating a desktop split pane would have
been cheap and isolated. Put back to the owner, who confirmed: **remove it at every width.**

So the conversation surface has one job on every screen size, and `Tasks` is one tap away from
all of them. The design as drawn is correct and needs no revision on this point.

## Order

Design first — the whole app, against the UC coverage map, not one screen. Then
the spec pass that restates AC-1/AC-4 and gives the list surface its own ACs.
Then implementation. The UC map exists precisely so the design pass has the real
feature set in front of it instead of a screen-by-screen guess.
