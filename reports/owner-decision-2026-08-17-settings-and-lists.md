# Owner decision, 2026-08-17 — the app needs settings, and the todo needs personal lists

**Reverses two earlier positions, one of which the owner names as their own mistake.**
Recorded here rather than edited into the specs quietly, because both were load-bearing
for decisions taken since.

Owner's words: *"Spec ban đầu tôi chọn ko có setting, đó là vô tình lỗi của tôi. App mà
ko có setting là thiếu. Todo mà ko có các list cá nhân thì càng thiếu."*

## What is reversed

**1. "No settings surface."** This was not a passing detail — it is cited as a premise in
at least three places, and each now rests on a withdrawn assumption:

- **F-002 AC-23** makes `client.interface_language` a build-time constant *because*
  "no settings surface is a deliverable of this feature or any other in flight."
- **ADR-008** (English-first) prices the no-i18n-layer choice partly on the same absence.
- **F-002 `## Out of Scope`** rules out voice/rate/persona settings as "a design
  deliverable that does not exist."

None of those is wrong *today* — a settings screen still does not exist — but they were
written as if it never would. They should be re-read as *deferred pending the settings
surface*, not as permanent.

**2. "Status is the only grouping."** A task's `status` is `inbox | today | done |
archived` (`api/types.ts:6`) and there is no project, list, tag or label field. The owner
is explicit that a todo app without personal lists is deficient.

## What this does NOT reverse

The **English-first** decision (ADR-008) stands. A settings surface makes a language
*picker* possible later; it does not by itself reopen the choice to ship English now.
ADR-008's own review conditions already say what would reopen it, and "a settings screen
now exists" is not among them — but it is worth re-reading them once the surface lands.

## Where the requirements already are

Neither of these needs to be invented. `todo-ai/docs/02-use-cases.md` already specifies
them, and the redesign has been citing that document (UC-20, UC-52) without it being in
the repo:

- personal lists / grouping and the manual todo operations — **UC-31 … UC-39**
- the surrounding conversational cases the redesign has built — UC-01 … UC-20

That is the migration the owner asked for in the same breath, and it is the right order:
bring the requirements in first, then spec against them.

## Consequences to route

- **T-093** (the hamburger is not a menu) moves from *observation* to *needed*.
- **T-094** (no hand-editing at any layer) is sharpened: personal lists is a **data-model**
  change, not only a UI one — a new field, plus every place that groups by `status`.
- F-002 AC-23's parenthetical reasoning needs a note that its premise was withdrawn, so a
  later reader does not treat "no settings exist" as a standing rule.
- Whether a language picker is in the first settings screen is a **separate** decision and
  should not ride along silently.
