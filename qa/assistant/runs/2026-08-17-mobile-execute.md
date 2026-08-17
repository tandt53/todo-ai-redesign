# Mobile run record — F-003, execute pass (T-021)

**Date:** 2026-08-17 · **Agent:** qa-mobile-agent · **Phase:** execute
**Feature:** F-003 mobile-surface · **Platform:** mobile (ios + android)
**Trigger:** mobile-agent's T-019 landed `src/assistant/mobile/` and extracted the platform-neutral half of the web client into `src/assistant/_shared/`, so the mobile controller now *extends* the shared conversation controller rather than copying it. That extraction is what unblocked the 19 TC bodies this pass owed, and it is what makes AC-1's parity claim structurally checkable instead of merely asserted.

**Result: 111 / 111 PASS.** Two product bugs were found and both were fixed the same day: BUG-002 (filed by this suite) and BUG-001 (inherited, pinned by this suite, fixed by T-023). Zero flakes observed. Zero assertions weakened.

> **Amended 2026-08-17, after T-023 and T-026.** The pass originally ended
> 105/106 with BUG-002 red. Sections 1, 5, 6 and 7 are updated below; the
> triage log in §4 is the record of the original run and is unchanged.

---

## 1. Commands and real output

Original pass:

```
$ npx vitest run qa/assistant/automation/mobile
      Tests  1 failed | 105 passed (106)      # the 1 = BUG-002
$ npm run test:all
      Tests  1 failed | 414 passed (415)
$ npx tsc --noEmit
(exit 0)
$ npm run test:e2e
  36 passed (36.1s)
```

Final, after the BUG-002 fix, T-023 (BUG-001) and T-026:

```
$ npx vitest run qa/assistant/automation/mobile
 Test Files  1 passed (1)
      Tests  111 passed (111)

$ npm run test:all
      Tests  434 passed (434)
```

After the Gate 3 follow-up (M1 + M2 below):

```
$ npx vitest run qa/assistant/automation/mobile
      Tests  124 passed (124)
$ npm run test:all
      Tests  469 passed (469)
$ npx tsc --noEmit
(exit 0)
```

## 5b. Gate 3 follow-up — two false-green findings

**M1 — an assertion that could not fail.** AC-11's entire obligation in this file
was `expect(backIsBackgroundTransition()).toBe(true)`, and
`model/lifecycle.ts` declares that function `(): true`. A constant compared with
itself. product-agent proved it by mutating `backAction`'s keyboard-first clause:
this suite returned 111 passed while the implementer's own
`touch-keyboard-back.test.ts` went red. AC-10's neighbour assertion had the same
shape.

Replaced with `backAction`'s real decision table, a state-shape assertion for the
keyboard, and five behavioural TC-036 tests. The mutation that fooled the old
suite now reddens 2; inverting the clause reddens 3.

The shape is worth more than the fix: **a helper with a literal return type
reads like a named rule and tests like a tautology.** Nothing upstream separates
them — C2 counts AC-id references, C5 counts green runs, and neither reads an
assertion. The only defence is the question this file's own header asks: if the
implementation were broken, would this test notice? For that one, the answer had
always been no.

**M2 — three unlinked copies of AC-9's numbers.** Mockup CSS, `PAINTED`, and the
RN `StyleSheet` each stated the same six values with nothing connecting them; all
agreed, so no live defect, but any copy could drift silently. The suite now
parses the mockup at test time (the L-008 technique) and checks both other copies
against it, with a non-vacuity guard. Mutation: mockup drift reddens 1, `PAINTED`
drift reddens 2, `StyleSheet` drift reddens 1, a renamed selector reddens 2.

`components/styles.ts` had to be read as **text**, not imported — it pulls in
`react-native`, which is Flow-typed and unparseable by this tier. So that third
check was a drift detector, not a contract.

## 5c. Both M2 gaps closed the same day (T-040, T-041)

**The drift detector failed by succeeding.** mobile-agent's T-040 made
`styles.ts` derive all five boxes from a new `paintedBox()`, so the file holds
zero numeric dimensions — and the detector went red on its own non-vacuity guard
(`expected 0 to be >= 9`). That guard is the whole reason this read as a clean
signal instead of a silent pass over an empty set, which is the same failure
class as the tautologies removed in §5b.

**Retired, not inverted.** The inverted form already existed one tier down and
stronger: `touch-keyboard-back.test.ts` asserts `paintedBox(id) === PAINTED[id]`
**by import**, that each box is declared by derivation, and that no style block
restates a literal. Re-implementing it here would be a second copy of one check —
the duplication this whole thread has been removing (L-004). The handoff was
verified rather than assumed: re-introducing `const sendBox = { width: 32, height: 32 }`
leaves the QA suite green and reddens that unit test. The check moved tiers; it
did not disappear.

**The widths gap closed too.** Design published `components.md` § Touch — the
single source proposed last pass — so the four floors are now parsed and asserted
(`retry` corrected 96 → **80**; 96 had been `addTaskButton`'s number copied
across, which is exactly the signature of a hand-copied constant). Also asserted:
each floor under-states its rendered measurement (the direction § Touch calls
load-bearing) and each sits above both platform minimums, so none can bind the
hit-area calculation.

**One thing deliberately not asserted, and one flagged upward — both since
resolved.** See §5d.

`assistant-permission-cta`'s floor was unsettled (T-042), so rather than freeze
the known over-claim of 140 the test asserted the id stayed *absent* from the
published table. And § Touch read as if "rounded down to a multiple of 4" were
mechanical, while only `retry` (80 ≤ 81.9) was the largest such multiple.

## 5d. Both resolved the same day (T-042 + a § Touch restatement)

**The absence assertion fired.** Design measured all three labels the permission
CTA can carry and published **112**, taken from the shortest ("Mở Cài đặt",
renders 114.3) rather than from whichever mockup rendered. It is now a real
assertion; `PAINTED` was corrected 140 → 112 by mobile-agent concurrently, and
both had landed by the time this ran.

The interesting part is *why* 140 was wrong. It was not simply stale: it sat
**between** the shortest label (114.3) and the longest (183.9), which is what a
floor read off the wrong label looks like. A number below the longest label looks
entirely reasonable and is wrong for every state but one. So the suite now
asserts design's **general clause** rather than this one number — for any
published row carrying two or more label widths, the floor must be at or below
the smallest. Mutation: republishing the floor as 156 (a multiple of 4,
comfortably below the longest label, and wrong) reddens 3 tests. The next
varying-label control inherits that check without another round trip.

**The rounding slack is deliberate, and now documented rather than tightened.**
Design restated § Touch instead of changing the numbers: the floors are measured
in an HTML mockup while the control ships through React Native's text shaping, so
the same string does not resolve to the same pixel, and the slack absorbs a real
engine difference. The floor exists to catch a collapsed control, not to describe
it to a tenth of a point. That vindicates removing the tight-multiple assertion
last pass — it would have encoded a rule design never made, and would now be
fighting a documented one. The three stated invariants (`% 4 === 0`,
`<= rendered`, `> 48`) are all asserted; the tighter form still is not.

`test:all` breakdown — the mobile automation tier is the one this task owns; the
rest is regression evidence that the shared extraction did not cost anything:

| Tier | Tests | Result |
|---|---|---|
| mobile automation (`qa/assistant/automation/mobile`) | 106 | 105 pass, 1 fail (BUG-002) |
| mobile unit (`src/assistant/mobile/__tests__`) | 92 | pass |
| api unit (`src/assistant/api/__tests__`) | 73 | pass |
| web unit (`src/assistant/web/__tests__`) | 98 | pass |
| api automation (`qa/assistant/automation/api`) | 46 | pass |
| web e2e (Playwright, separate runner) | 36 | pass |

The single failure is **attributable to F-003 and is a filed product bug**, which
is the sanctioned outcome — not a red test left for someone else to tidy.

## 2. What the suite grew into

At the end of authoring this file had 32 assertions and one deliberate gate
standing in for 19 unwritten TC bodies. It now has 106.

| Part | What it proves | Needs the implementation? |
|---|---|---|
| A | contract preconditions — the 22-id catalogue parsed from the mockups, the enumerated permission matrix, the device-lab debt list, the honest-tiering rule, the canonical-table guard | no |
| B | the pure model — identity attribute, touch minimums and hit areas, permission grants/messages/CTAs, lifecycle constants, `DurableStore` survival | yes, model only |
| C | **new this pass** — the parity block and every conversation-driven lifecycle behaviour, driven end to end | yes, everything |

### How Part C runs

A **real assistant server, in-process**: `createApp({store, interpreter, clock})`
bound to `127.0.0.1` on an ephemeral port, one fresh server and one fresh uuid
user per test. Only **model interpretation** is stubbed (`QaMobileInterpreter`) —
the seam F-001's Test strategy explicitly grants. Orchestration, the confirmation
gate, persistence, per-status dedupe, undo, session lifecycle and the boundary
payload all run real.

That choice is the difference between checking AC-1 and asserting it. A stubbed
`fetch` would have let the mobile client agree with itself about what a turn
outcome looks like. Driving the same eight endpoints the web client drives means
a mobile fork of the reducer or the message vocabulary shows up as a failure
rather than as a passing test with different expectations.

Client under test: the `Surface` driver from `src/assistant/mobile/index.ts`
(controller + the four port doubles). React Native is never imported; the tier
stays simulator-free per `specs/_shared/platform/mobile.md ## Test Harness`.

The canonical utterance→intent table is **read, never copied** (L-004): the
grammar in the QA interpreter is the runtime realization of those rows against a
real per-turn handle context, and a guard test asserts every canonical row id it
mirrors still exists upstream. If a row is renamed or dropped, that goes red
rather than these TCs silently changing meaning.

## 3. The three authoring failures — how each resolved

### 3.1 TC-039, Android identity attribute — a spec defect, not a test bug

Authoring asserted `identityAttribute('android') === 'contentDescription'` (the
spec's and the mockup's wording at the time) and left it **red** rather than
patching it to `resource-id` to match the implementation. Routing it produced a
rewritten AC-12: identity rides one React Native `testID` prop, surfacing as
`accessibilityIdentifier` on iOS and `resource-id` on Android, while
`contentDescription` carries the *announcement* text. The decisive argument came
from this folder's own AC — an id parked on `contentDescription` is spoken by
TalkBack as "assistant-message-bubble" instead of the message, so AC-12's two
halves were mutually unsatisfiable as written.

This pass re-pointed the assertion, and added the half that was missing before:
a **negative** check that zero catalogue ids appear on `contentDescription` in
the Android mockup, plus per-attribute parsing so the identity check no longer
leans on the `data-testid` both mobile mockups keep for design-check. Before
that change, deleting every `resource-id` from the Android mockup would still
have passed the "iOS and Android carry the same values" test.

The lesson worth recording is not that QA guessed right — QA guessed *wrong*
about which side would move. It is that routing instead of patching put the
contradiction in front of the people who could fix it. A patched assertion would
have shipped a surface where the screen reader reads selector tokens aloud, with
every check in this repo green.

### 3.2 AC-9 hit areas — fixed by T-019, not a defect

Re-verified first thing, as the authoring note required. All 14 interactive ids
now meet the minimum as hit area on both platforms. `PAINTED` still records
several targets below the minimum (checkbox 22×22, send 36×36, add-task 96×26),
which is exactly why AC-9 measures hit area rather than painted size — those are
the elements whose `hitSlop` does the work.

### 3.3 The reducer gate — replaced by the 19 owed bodies

The gate is gone. TC-001..TC-012, TC-021..TC-023, TC-025, TC-027, TC-028,
TC-031 and TC-033 now have executing assertions, joined by the behavioural
halves of TC-013, TC-018..TC-020, TC-029, TC-035, TC-037 and TC-038 that Part B
could only reach as pure-model checks.

## 4. Triage log

`_qa-foundations` §8. Every failure observed during this pass, classified.

| # | Failing assertion | Re-runs | Classification | Action |
|---|---|---|---|---|
| 1 | `identityAttribute('android')` expected `contentDescription` | — | **stale expectation, resolved upstream** | Re-pointed to `resource-id` per the rewritten AC-12; negative half added. Not a weakening: the routing changed the spec, and the corrected contract is asserted from both sides. |
| 2 | TC-002 · "a mobile-only event moved the surface out of its state" | — | **script bug** | The sweep held `background`/`foreground` to "no transition". AC-8 makes a foreground render whatever the server reports, which is how the client-side error state clears — an AC-named transition. Narrowed the assertion to the events with no AC of their own (offline, keyboard, back). Fixed silently. |
| 3 | TC-004 · "the original turn must stay visible, marked undone" | — | **script bug** | Asserted against a message snapshot captured *before* the undo; the reducer produces new records. Re-read the message by `turnId` from current state. The product behaviour was correct all along. |
| 4 | TC-007 row 6 · deleted-count arithmetic | — | **script bug** | My formula ignored the hand-deleted task. Replaced with the assertion the AC actually makes: the outcome names exactly the two tasks it deleted and does not claim the one already gone. |
| 5 | TC-030 · `s.store.flush is not a function` | — | **script bug** | `makeDurableStore()` returns the synchronous `MemoryDurableStore`; `flush` belongs to `HydratedDurableStore`. Dropped the call. |
| 6 | **TC-030 · cold open dispatches a turn before the session read** | **3 / 3 fail** | **PRODUCT BUG** | Filed **BUG-002**, layer `mobile`, severity HIGH. Assertion left red. |

Four script bugs, one resolved-upstream expectation, one product bug. No flakes:
every failure was deterministic on first observation and stayed deterministic.

## 5. BUG-002 — the one that is real

`qa/_shared/bugs/BUG-002-cold-open-accepts-input-before-session-read.md`

**AC-8:** "Every foreground transition (resume **or cold open**) re-reads
`GET /assistant/session` **before** accepting new input."

`onForeground()` enforces that: it builds its reconciliation as one promise,
assigns it to `foregroundSync`, and `send()` / `tapMic()` wait on that gate.
`init()` performs the same reconciliation — its own comment says "A cold open
after a kill is the same reconciliation as a resume" — but never installs the
gate. So on a cold open `acceptingInput()` returns `true` and a turn typed while
the app is starting goes straight out.

Observed `/assistant/*` order, identical on all three isolation runs:

```
POST /assistant/turn
GET  /assistant/session
```

**FIXED 2026-08-17** — `init()` and `onForeground()` now install the AC-8 gate through a single shared installer, so neither can drift out of holding input. TC-030 is green.

**The consequence is what made this HIGH rather than a tidiness issue.** The
racing turn carries `session_id: null`, so the server opens a *new* session. The
subsequent read then reports that new session, and a previously closed session's
boundary message — the close marker, every question declined by the close named
with its task titles, every late outcome — is **never rendered**. Reproduced:
message kinds `["user","applied"]`, boundary count `0`, where F-001 AC-28 and
TC-031 require exactly one.

Both observables are asserted in the same test, gathered before either
expectation runs, so the failure reports the ordering *and* the lost boundary.
The fix is a one-line ordering change in `init()` (install the gate
synchronously, before the first `await`), and the test goes green when it lands.

## 6. BUG-001 — cited, not re-filed; then fixed, and the pin fired

TC-021's offline path passes everything it asserts: the mic stays **available**
offline (the deliberate mobile divergence from web), recognized text reaches the
composer verbatim, zero `/assistant/*` requests and zero AI calls happen while
offline, `assistant-offline-banner` renders, manual ops work, reconnecting clears
the banner.

The offline-created task still never reaches the server after reconnect. That is
**BUG-001**, filed against F-001 and inherited by F-003 through the shared
controller, with a fix queued as T-023 — so it is cited, not duplicated, per the
briefing.

It is pinned by a test named `KNOWN OPEN — ... (BUG-001, inherited)` that asserts
the *current, broken* behaviour on purpose, with the instruction written into the
assertion message:

> when T-023 fixes the replay, THIS TEST MUST GO RED, and the fix is to invert
> the assertion — not to delete it.

That is deliberate. An inherited bug with no test is a bug that becomes invisible
the moment someone closes it, and a suite that quietly goes green on a fix nobody
verified is exactly the failure L-003 records.

**T-023 fixed it later the same day and the pin fired as designed** — the failure
message carried its own routing instruction, so no investigation was needed. It
is now **five forward assertions** of the behaviour `api-contracts.md` specifies,
each derived from the contract clause rather than from the new implementation:

| Assertion | Contract clause |
|---|---|
| replays under **its own client-generated id**; the local marker is **removed**, not set false | "creates the task locally under a real id and replays the create on reconnect — no temporary-id mapping exists" |
| `409 TASK_ID_EXISTS` is an **ack**: marker clears, one task not two | "a client replaying its own create treats that 409 as already-synced (its ack)" |
| a second reconnect re-posts nothing and duplicates nothing | idempotence of the replay pass |
| creates replay **before** the queued turn — asserted through the **outcome**: the replayed turn *deletes* the replayed task instead of returning no-match | F-001 AC-25; a task missing from the server is missing from the turn's context |
| an offline **cold open** restores stored local tasks; the next local write does not wipe them | the adjacent path T-023 also closed |

The ordering assertion is the one worth keeping honest. Checking wire order alone
would be a sequence reader; asserting that the replayed turn can actually *see*
the replayed task is what makes it a bug detector.

### TC-040 — the gap the connectivity callback hides

Added after T-026 put `syncLocalTasks()` in mobile's `onForeground()`. Every
reconnect assertion in TC-021 drives `connectivity.set(true)`, which fires
`onChange` — so all of them pass whether or not the foreground path works. The
path users actually take is the other one: lose signal, background the app, come
back on wifi, where the OS never reports the transition to a foregrounded app.

TC-040 drives exactly that with a connectivity double whose `onChange` **never
fires**, so only the foreground can trigger the replay. Removing
`syncLocalTasks()` from `onForeground()` reddens TC-040 and leaves all 110 others
green — which is the justification for a separate TC rather than one more
assertion inside TC-021.

## 7. Mutation checks — proof these tests can fail

`_qa-foundations` §5: "If the implementation were broken, would this test
notice?" Checked by breaking things on purpose. Every source mutation was backed
up first and checksum-verified on restore — L-001, since this repo has no
baseline commit and `git checkout --` cannot restore an untracked file.

| Mutation | Expected to catch | Result |
|---|---|---|
| `replayQueued()` mints a fresh `client_turn_id` instead of reusing the stored one | TC-023 (replay reuses the id) and TC-027 (kill-surviving replay, effect exactly once) | **2 tests went red**, both the intended ones. `cksum` identical after restore. |
| TC-032 flipped to `Automation: automated` | the execute-phase tiering rule — a device-lab-only TC may never read `automated` | **2 tests went red** (the rule and its explicit second reading) |
| `reconnect()` order swapped (queued turn before local creates) | the BUG-001 ordering assertion | **1 test went red**, the intended one |
| `409 TASK_ID_EXISTS` treated as a failure instead of an ack | the BUG-001 collision assertion | **1 test went red**, the intended one |
| `syncLocalTasks()` removed from mobile's `onForeground()` | TC-040 | **1 test went red**, the intended one |

The first is the one that matters: the double-apply this whole mechanism exists
to prevent is invisible to a test that reads the client's own bookkeeping, so
both TCs assert the **server-side task count** as well as the id.

## 8. The honest-tiering rule, re-pointed rather than retired

At authoring the suite asserted that **no** TC read `Automation: automated`,
because nothing had executed. That gate has done its job. Deleting it would have
thrown L-003's lesson away, so it was replaced with the same principle pointed at
what is now true — three rules, all derived from the TC files themselves, no
hand-kept list:

1. A TC may read `automated` only if its **primary tier is `node-headless`**. A
   device-lab-first or manual-first TC does not become automated because this
   suite ran.
2. A TC may read `automated` only if this automation file **names its id**, so a
   TC cannot claim coverage no test refers to.
3. Every node-primary TC **must** read `automated`, because this run executed
   them all. A newly authored node TC with no test goes red.

Result: **34 of 39** TCs are `automated` + `active`. Five stay `manual`:
TC-032, TC-034, TC-036 (device-lab only) and TC-037, TC-038 (manual-first, with
their announcement-payload halves now node-asserted).

## 9. Device-lab and manual debt — restated, because a green tally is where debt goes to hide

105 passing assertions do not shrink this list by one item. It is reproduced in
full so the number above cannot be mistaken for coverage.

| # | Owed | ACs | TCs |
|---|---|---|---|
| 1 | Real permission dialogs + Settings / App-info deep links | AC-2, AC-3 | TC-013, TC-015–TC-020 |
| 2 | A real incoming call interrupting capture | AC-7 | TC-029 |
| 3 | **A real OS memory-pressure kill, incl. the storage flush before process death** | AC-5, AC-6 | TC-024, TC-026 |
| 4 | VoiceOver and TalkBack announcement | AC-12 | TC-037, TC-038 |
| 5 | Keyboard occlusion and rotation | AC-10 | TC-034 |
| 6 | System back and back-swipe | AC-11 | TC-036 |
| 7 | On-device recognition offline in the interface language | AC-4 | TC-021 |
| 8 | Touch-target measurement on a device | AC-9 | TC-032 |

Item 3 is still the highest-value one, and this run made it *more* pointed, not
less: the suite now proves the `DurableStore` contents outlive the model in nine
different scenarios. It proves nothing at all about whether AsyncStorage or MMKV
(Open Question 1) flushed to disk before the process died. An async write that is
never awaited passes all nine and loses the user's words on a real phone.

**AC-9, AC-10, AC-11 and AC-12 cannot reach full verification from this tier at
all.** F-003 is not done until a device pass runs.

## 10. Test data isolation

Namespace `qamob-`; every Part C test gets a fresh uuid `X-User-Id` and its own
in-process `MemoryStore`, so isolation is structural rather than conventional —
two tests cannot see each other's data even in principle. Seeded task titles
carry the `qamob-` prefix. No unscoped destructive operation is performed
anywhere in the suite. The canonical utterance table is read from
`qa/assistant/F-001/api/utterance-intent-fixtures.json`, never copied.

## 11. Files touched

| File | Change |
|---|---|
| `qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts` | 32 → 111 assertions: TC-039 re-pointed + negative half, per-attribute catalogue parsing, the whole of Part C, the re-pointed tiering rule |
| `qa/assistant/F-003/mobile/*.md` (40 TCs) | 35 flipped to `active` + `automated`; TC-039 rewritten for `resource-id` with the reasoning; TC-030 and TC-021 carry execution results; **TC-040 added** (foreground-as-reconnect) |
| `qa/assistant/F-003/mobile/index.md` | execute-phase status block, resolved drift items, BUG-002 entry, restated debt, corrected tally |
| `qa/_shared/bugs/BUG-002-cold-open-accepts-input-before-session-read.md` | new |
| `qa/assistant/runs/2026-08-17-mobile-execute.md` | this record |

No file under `src/` was modified. The two source mutations in §7 were backed up
and restored with verified checksums.

## 12. Recommended next steps

1. ~~**mobile-agent** — fix BUG-002~~ **Done 2026-08-17.** Both foreground entry
   points now install the AC-8 gate through one shared installer.
2. **mobile-agent / orchestrator** — `npx tsc --noEmit` is currently **red**, in
   `src/assistant/mobile/__tests__/lifecycle.test.ts` (lines 475–476): the
   recorded request `body` is typed `{}`, so `body['id']` / `body['title']` trip
   TS7053 under `noImplicitAny`. That file is T-026's and outside this task's
   write scope, so it is reported rather than touched. Every test passes; only
   the typecheck fails.
3. **Orchestrator / human** — schedule the device-lab pass. Item 3 (real kill +
   storage flush) first; it is the one where a headless-green suite is most
   likely to be wrong on a real phone.
4. **architect-agent** — add the announcement seam (`model/announce.ts`,
   `RecordingAnnouncer`) to `specs/_shared/platform/mobile.md`'s port list. It is
   now load-bearing for TC-037/TC-038 and was found by runtime inspection, which
   is not a durable contract. (Carried over from authoring; still open.)
5. **design-agent** — fold the per-combination Vietnamese permission copy into
   `design/_shared/components.md`. It currently lives only in the implementation.
   (Carried over from authoring; still open.)
