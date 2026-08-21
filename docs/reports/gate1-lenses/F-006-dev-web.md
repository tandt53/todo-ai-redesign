# F-006 Gate 1 — dev (web) lens (T-182, 2026-08-21)

**Verdict:** 1 HIGH · 4 MEDIUM · 1 LOW · all 16 ACs read.
**Every line number and both measurements in `## Impact` verified against the working tree — all accurate.**

---

## F1 (HIGH) — AC-7, AC-9, AC-10, AC-11, AC-12 · this feature makes a step's parent disappear, and no AC says what then

AC-7 requires a lone deleted step's entry to be *"named by that parent"*. **AC-11 and
AC-12 make the parent's disappearance reachable — two ways, both new with this feature:**

- Delete step S alone (g1), delete parent P separately (g2) — `planDelete` sweeps only
  `liveSteps` (`plan.ts:713`), so S stays in g1 and P is its own entry — then *delete
  forever* on g2.
- Same setup, restore g1 and re-delete it: **AC-12 resets S's clock**, so P expires
  first and the trash read removes it.

In both, the entry survives with a `parent_id` pointing at no row. The client cannot
name it, and `restoreTask`'s parent invariant `continue`s past the missing row
(`app.ts:608`), so **AC-9 restores a parentless step — which the same file's comment
calls unreachable**: *"A step with no parent is in no collection and therefore
unreachable"* (`app.ts:602`). The user taps Restore and nothing appears anywhere.

*Earliest catch:* a web e2e against a fixture nobody will build — **0 deleted steps in
the store today.**

## F2 (MEDIUM) — AC-10, AC-7 · the remedy AC-10 offers does not exist for steps

*"The restored task is on screen and named after the restore, so a user who disagrees
can move it by hand."* `inCollection` (`tasks.ts:387`) gates steps out **before** the
done gate, so a restored step enters no collection and no count on either client. Even
with a live parent it appears only inside that parent's detail — not on screen after a
restore from the trash — and ADR-013 forbids rendering a step title in the undo path.

## F3 (MEDIUM) — AC-6, AC-8 · `## Data` forecloses the option `## API Touch Points` keeps open

`serializeTask` (`serialize.ts:165-189`) emits `deleted_at` and **not**
`delete_gesture_id`; `app.ts:180` records the omission as deliberate under ADR-012. A
web implementer told to group client-side **has no key**, and the plausible fallbacks —
matching `deleted_at`, or `parent_id` — are the two ADR-012 rejects by name.
**Architecture choosing "client-side" silently amends a Data row rather than picking an
option.**

## F4 (MEDIUM) — AC-3, AC-12 · no AC says where the CLIENT gets the expiry date

The `## Data` row names two readers of the 30-day constant, both server-side.
`deleted_at` reaches the client and the constant does not, **so the cheapest web
implementation computes `deleted_at + 30d` locally** — two homes for one constant
(L-004), and AC-3's equality claim then depends on client and server agreeing on both
instant and zone.

**Worse for the gate:** the e2e harness holds both clocks at one instant, so a divergent
implementation **passes its tests and drifts only in production**.

## F5 (MEDIUM) — AC-11 · "no new response shape is owed" is true of the wire, not the client

`applyWrite` (`controller.ts:948-976`) builds `new Set(result.removed ?? [])` and uses
it **only to skip rows already in `state.tasks`** — which by `## Impact` §3's own rule
can never hold a trash row. **Routing *delete forever* / *empty trash* through that path
is a no-op**; the destroyed entries stay on screen until the trash is re-read. *The
spec's reassurance is exactly what makes an implementer stop looking.*

## F6 (LOW) — AC-1 · §2's list is one item short, at the site that matters

`ListsMenu` is typed `active: Collection` / `onPick: (c: Collection) => void`
(`ListsMenu.tsx:94-96`), wired to `shell.pickCollection` (`App.tsx:130`). AC-1's row
**has nowhere to click through to without changing that contract**, so adding `'trash'`
to the union is the shortest path — which is what §2 exists to prevent.

---

## Checked, sound

- **`## Impact` §1's measurement is exact** — 45 non-test `deleted_at` lines across 16
  files, and all eleven cited line numbers resolve to the predicate claimed.
- **§3's warning is unmissable as written** — stated in the terms an implementer reads,
  not buried in a note. No finding.
- **AC-9 lands correctly on web with no new client code** — `applyWrite` pushes arrived
  rows with `deleted_at === null` onto `state.tasks`, which is what a restore returns.
- **AC-16** forces nothing contradicting `platform/web.md`; its 2.2.1 exclusion is
  correct — nothing this feature adds is withdrawn by time in front of the user.
- **AC-12's expiry is unit-testable through the existing `ControllerDeps.now` seam**,
  which the spec names rather than inviting a second one.

## Drift noted, not a finding against F-006

`platform/web.md § F-005` says `ShellSurface` is `'talk' | 'tasks' | 'settings'`. The
code declares **four** — `web/shell.ts:56` includes `'detail'`. Stale, and it matters
here because AC-2's surface has to be placed relative to that union.
