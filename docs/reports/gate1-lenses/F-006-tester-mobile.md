# F-006 Gate 1 — tester (mobile) lens (T-182, 2026-08-21)

**Verdict:** 2 HIGH · 4 MEDIUM · all 16 read, 12 `(mobile)` lensed.
**Could not check anything device-rendered — no suite in this repo has ever run on a simulator (`F-003 ## Verification status`), which is itself F4.**

---

## F1 (HIGH) — AC-2, AC-5 · the phone is the offline client, and the spec says "offline" zero times

AC-2 enumerates two states for a surface fed by a new server read, so **a failed or
offline read has nowhere to land except the empty state**, whose copy AC-2 fixes as
*"nothing has been deleted recently"*.

On the phone — the client that is routinely offline — a user whose trash read failed is
told their trash is empty, **a false statement about their own data, on the one surface
whose purpose is recovery.** And the test written from AC-2 as worded passes against a
read that returned nothing *because there was no network*. **A false green, in the one
place `## Test strategy` did not look for one.**

*Measured: F-006 contains the string "offline" **zero** times in 466 lines.*

## F2 (HIGH) — AC-1 · the placement half has no addressable observable on the phone

AC-1's whole content is *which kind of row* the entry is — peer to `Done`, in the views
group, never the filing group. `§ ListsMenu` settled this when Upcoming was added:
**"No new testid. There is no `menu-upcoming-row` and nothing should be written against
one."** The mobile tier's only Lists-menu observable is `expectedShellIds()`
(`a11y.ts:400-405`), which returns a **set** — a fifth row changes nothing in it.

**So the only assertion AC-1 admits is "the group gained a row" — which passes for a row
drawn anywhere in the menu including the filing group AC-1 forbids, and passes for the
fifth `Collection` member `## Impact` §2 calls the category error.** *The test certifies
the defect §2 exists to prevent.*

§9's owed-id list does not include the menu row; §10's routing table carries `§ ListsMenu`
but not `§ Testid catalogue — app shell`, which is the section that has to gain rows.

## F3 (MEDIUM) — AC-3, AC-12 · the constant has readers `## Data` does not name

`## Data` calls the 30 days *"read by both doors that reach a deleted row"* — both
server-side. AC-3 requires every entry to state *when it goes*, rendered on two clients.
**If the client derives it, it derives it against a clock and a zone** — and
`platform/mobile.md` fixes both rules: *"the zone: report, do not compute"*, and there are
already two inline clocks on this client plus a defaulted one that F-005 AC-44 exists to
stop becoming more. *The user reads "goes in 3 days" on a row the restore already refuses.*

## F4 (MEDIUM) — six ACs · twelve `(mobile)` tags and no mobile tier in `## Test strategy`

All four bullets are api/model observables. `F-003 ## Verification status` exists because
*"a ticked box on a mobile AC is not a device pass"*, and records that **no suite here has
ever run on a simulator, emulator or device.** F-005 answered this by *stating* the
node-testable / device-lab split and routing to F-003's existing debt list.

Left unstated, a phase-4 author has twelve mobile ACs and no rule, and both reachable
improvisations are known-bad: assert the prop instead of the observable (L-002), or tick a
box on a node run and report drawn behaviour as verified.

*On my reading:* AC-4, AC-6, AC-9, AC-10, AC-15 have headless observables; AC-1's
placement, AC-2's and AC-3's rendering, AC-7's presentation, AC-16's 2.5.1 and 4.1.2 do
not.

## F5 (MEDIUM) — AC-11 · no failed-write post-state for the only irreversible act

`platform/mobile.md` records that this client's three shared write methods *"apply an
optimistic change, `await`, and **discard** it — no read, no error branch, no refresh"*,
and that the obligation is a post-state: *"never a row that vanishes and returns at the
next refresh"*. **A confirmation reading *this cannot be undone*, followed by an
optimistic removal that silently reappears, is that exact failure on the one gesture where
the user is being asked to accept irreversibility.** The general rule exists; nothing in
F-006 points at it.

## F6 (MEDIUM) — AC-7, AC-9, AC-11 · the orphaned-step branch, unnamed in two ACs

Delete a step alone, delete the parent later, *Delete forever* the parent's entry — which
*"hard-removes exactly the rows the entry covers"* and does not cover the already-deleted
step. **The step entry now has a `parent_id` pointing at nothing**, so AC-7 has no name to
render and AC-9's parent invariant has no parent to restore.

*It is also the one pair of ACs with **zero** live-store instances, while `## Test
strategy` specifies fixtures for AC-6 and AC-13 and none for these — so nothing forces the
state to be constructed before someone hits it.*

---

## Checked, sound

- **AC-4's mobile half is genuinely assertable headlessly** — `inCollection()` never checks
  `deleted_at`, rows are excluded upstream, and `tasks-view.ts` is pure model code. The
  mutation the spec names turns the mobile suite red without a device. **The best-verified
  mobile claim in the spec.**
- **AC-15's instrument exists on this platform** — `tasks-surface.test.ts:37` filters for
  `POST /assistant/turn` and asserts 0 at four sites.
- **AC-16's 4.1.3 has a mobile path already built** — `announce.ts`'s `statusAnnouncement`
  was the widening for announcements with no `Message` behind them.
- **AC-1's no-count decision survives the menu's loading rule** — a countless row is
  derivable on device and needs nothing from the network to draw.
- **Fixtures for AC-6 and AC-13 are seedable from the live store** — 53 null-gesture rows,
  24 matching turns. Neither repeats the Upcoming problem.
- **No iOS/Android divergence found.**
