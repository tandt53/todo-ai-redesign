# F-003 mobile-surface — mobile test cases (index)

**Authored:** 2026-08-16 (T-020, `phase: author`) · **Executed:** 2026-08-17 (T-021, `phase: execute`) — both by qa-mobile-agent · **Spec:** `specs/assistant/F-003-mobile-surface.md` rev 1 · **Parity source:** `specs/assistant/F-001-voice-assistant-view.md` rev 3
**Mockups:** `design/assistant/screens/voice-assistant-view-ios.html` + `-android.html` (22 ids, 17 states, copy in Vietnamese)
**Automation:** `qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts` — run with `npx vitest run qa/assistant/automation/mobile`
**Last executed:** 2026-08-17 (T-021, `phase: execute`; + Gate 3 follow-up; + T-040/T-041 re-point) — 123 passed, 0 failed
**Fixtures:** `qa/_shared/fixtures/mobile/F-003-mobile-fixtures.json` · **Namespace:** `qamob-` (users `qamob-tc{nnn}@qa.example.com`)
**Test cases:** 40, all P1 — 35 `active` + `automated`, 5 `manual` (device-lab / screen-reader debt)

---

## Automation status after the execute run — read this before quoting a number

**Run:** 2026-08-17 (T-021, `phase: execute`) · **Record:** `qa/assistant/runs/2026-08-17-mobile-execute.md`

```
npx vitest run qa/assistant/automation/mobile
→ Tests  123 passed (123)                 (re-run 2026-08-17 after T-040's de-duplication)

npm run test:all
→ Tests  468 passed (468)

npx tsc --noEmit
→ exit 0

npm run test:e2e
→ 36 passed (36)                          (F-001 web e2e — no regression)
```

Two product bugs were found and both are now closed:

| Bug | Found by | Status |
|---|---|---|
| [BUG-002](../../../_shared/bugs/BUG-002-cold-open-accepts-input-before-session-read.md) — cold open dispatches `POST /assistant/turn` **before** `GET /assistant/session`, losing the closed-session boundary | this suite (TC-030), triaged 3/3 in isolation | **fixed** — TC-030 green |
| [BUG-001](../../../_shared/bugs/BUG-001-offline-creates-never-replay.md) — offline creates never replay (inherited from F-001 via the shared controller) | pinned by this suite, cited not re-filed | **fixed by T-023** — the pin fired and is now 5 forward assertions of the contract (TC-021) |

The three failures standing at the end of authoring are all resolved:

| # | Authoring failure | Outcome at execute |
|---|---|---|
| 1 | `identityAttribute('android')` returned `resource-id`, spec said `contentDescription` | **Spec defect, not a test bug.** Routing it produced a rewritten AC-12 (identity on `testID` → `accessibilityIdentifier` / `resource-id`; announcement on `accessibilityLabel` → `contentDescription`), 22 ids moved in the Android mockup, and an updated `testid-contract.sh`. TC-039 now asserts the corrected contract **and** the negative half — no catalogue id may reappear on `contentDescription`. |
| 2 | `hitArea` / `meetsMinimum` null for all 14 interactive ids | **Fixed by T-019.** All 14 meet the minimum as hit area on both platforms. Not a defect. |
| 3 | conversation reducer entry point absent | **Landed (T-019).** The gate is gone; the 19 owed TC bodies are written and executing against a real in-process server. |

### The parity block is now covered, not owed

The gate test that stood in for TC-001..TC-012 has been replaced by real bodies.
They drive the mobile `Surface` against a **real assistant server** built from
`createApp({store, interpreter, clock})` on an ephemeral port — only model
interpretation is stubbed; orchestration, the confirmation gate, persistence,
per-status dedupe, undo and session lifecycle all run real. That is what makes
AC-1's parity claim checkable rather than asserted: mobile is exercised through
the same endpoints, the same reducer and the same message vocabulary as web.

**35 of 40 TCs now read `Automation: automated`.** The five that do not
(TC-032, TC-034, TC-036, TC-037, TC-038) are device-lab-first or manual-first
and stay `manual` — their node-testable halves execute, their device halves do
not. The suite enforces this mechanically now: a TC may read `automated` only if
its primary tier is `node-headless` **and** this automation file names its id,
and every node-primary TC must read `automated`. Flipping TC-032 to `automated`
turns the check red (verified by mutation).

## Gate 3 follow-up — two false-green findings, both closed (2026-08-17)

product-agent's Gate 3 pass found a false green in this suite and proved it by
mutation. Recorded here because the *shape* of both findings outlives the fixes.

**M1 — an assertion that could not fail.** AC-11's entire obligation in this file
was `expect(backIsBackgroundTransition()).toBe(true)`, against a function
declared `(): true`. A constant compared with itself. Mutating `backAction`'s
keyboard-first clause left this suite all-green while the implementer's own unit
test went red. AC-10's neighbour had the same shape.

Both are replaced: `backAction`'s real decision table, a state-shape assertion
for the keyboard, and **five behavioural TC-036 tests** (keyboard-first ordering,
session stays open, in-flight turn survives and applies once, composer text
survives, listening words kept and nothing sent). The mutation that fooled the
old suite now reddens 2 tests; inverting the clause reddens 3.

*The lesson:* a helper with a literal return type (`(): true`) cannot carry an
AC. It reads like a named rule and tests like a tautology — and the coverage
matrix cannot tell the difference, because C2 counts AC-id references and C5
counts green runs, and neither reads an assertion.

**M2 — three unlinked copies of AC-9's numbers.** The mockup CSS, `PAINTED`, and
the RN `StyleSheet` each stated the same six values, with nothing connecting
them. All agreed, so no live defect — but any copy could drift silently. The
automation now parses the mockup at test time (the L-008 technique) and checks
both other copies against it, with a non-vacuity guard so a dead regex fails
loudly. Every drift direction is caught independently (verified by mutation).
**Both gaps closed the same day.** T-040 made `styles.ts` derive its boxes from
`paintedBox()`, and design published § Touch in `components.md` as the source for
the four content-width floors.

That retired one QA check and added three. The `PAINTED` ↔ `StyleSheet` drift
detector went red on its own non-vacuity guard the moment T-040 landed — there
were no literals left to compare, so it **failed by succeeding**. It is retired
rather than inverted because
`src/assistant/mobile/__tests__/touch-keyboard-back.test.ts` now asserts the
stronger property *by import*, which this tier cannot do (`styles.ts` pulls in
Flow-typed `react-native`). Verified by mutation that the check really moved:
re-introducing a literal leaves this suite green and reddens that unit test.

In its place the suite parses `components.md` § Touch and asserts `PAINTED`'s
four floors against it, that each under-states its rendered measurement, and that
each sits above both platform minimums. `assistant-permission-cta` is
deliberately **not** asserted — its floor is unsettled (T-042), so the test
instead requires it to stay absent from the table, and fails when design
publishes one.

## Test cases

| TC | Title | ACs | Type | Targets | Tier |
|----|-------|-----|------|---------|------|
| TC-001 | Parity — applied turn, same-turn list update, attribution | AC-1, F-001 AC-1, AC-4 | happy | ios, android | node |
| TC-002 | Parity — four states only; bounded transitions | AC-1, F-001 AC-29, AC-11 | edge | ios, android | node |
| TC-003 | Parity — live transcript; empty return sends no turn | AC-1, F-001 AC-2 | happy | ios, android | node |
| TC-004 | Parity — undo shapes, visible refusal, idempotent replay | AC-1, F-001 AC-6, AC-8 | happy | ios, android | node |
| TC-005 | Parity — skipped tasks named; nothing-reverted never success | AC-1, F-001 AC-7 | negative | ios, android | node |
| TC-006 | Parity — delete boundary: 1 applies, 2 asks | AC-1, F-001 AC-9, AC-11 | boundary | ios, android | node |
| TC-007 | Parity — resolution matrix, 6 rows | AC-1, F-001 AC-10, AC-11, AC-12 | negative | ios, android | node |
| TC-008 | Parity — clarify candidates; tap sends literal text | AC-1, F-001 AC-13 | happy | ios, android | node |
| TC-009 | Parity — no-match quotes transcript; list question alternative | AC-1, F-001 AC-14, AC-15 | negative | ios, android | node |
| TC-010 | Parity — typed path parity; manual path zero AI calls | AC-1, F-001 AC-17, AC-18 | happy | ios, android | node |
| TC-011 | Parity — AI error keeps words; retry same id | AC-1, F-001 AC-23, AC-24, AC-16 | negative | ios, android | node |
| TC-012 | Parity — no capability hides mic; payload is text only | AC-1, F-001 AC-20 | edge | ios, android | node |
| TC-013 | iOS — both grants before first talk, one explanation | AC-2, F-001 AC-21 | happy | ios | node + device-lab |
| TC-014 | iOS matrix 1/4 — both granted → available | AC-2 | happy | ios | node |
| TC-015 | iOS matrix 2/4 — mic denied → dimmed, names microphone | AC-2, F-001 AC-21 | negative | ios | node + device-lab |
| TC-016 | iOS matrix 3/4 — speech denied → dimmed, names speech | AC-2, F-001 AC-21 | negative | ios | node + device-lab |
| TC-017 | iOS matrix 4/4 — both denied → still dimmed, never hidden | AC-2, F-001 AC-21, AC-20 | negative | ios | node + device-lab |
| TC-018 | Android matrix 1/3 — single grant, no second prompt | AC-3, F-001 AC-21 | happy | android | node + device-lab |
| TC-019 | Android matrix 2/3 — denied (not permanent), may re-request | AC-3, F-001 AC-21 | negative | android | node + device-lab |
| TC-020 | Android matrix 3/3 — permanently denied, must NOT re-request | AC-3, F-001 AC-21 | negative | android | node + device-lab |
| TC-021 | Offline never dims the mic; local no-AI path | AC-4, F-001 AC-25 | edge | ios, android | node + device-lab |
| TC-022 | Missing language pack = transient, not no-capability | AC-4, F-001 AC-22, AC-20 | boundary | ios, android | node |
| TC-023 | Queued turn replays visibly under the same id | AC-4, AC-6, F-001 AC-25, AC-16 | edge | ios, android | node |
| TC-024 | Kill while listening — pending input survives | AC-5, F-001 AC-26 | edge | ios, android | node + device-lab |
| TC-025 | Background while listening — no turn sent | AC-5, AC-7, F-001 AC-26, AC-3 | edge | ios, android | node |
| TC-026 | Kill while thinking — outgoing turn survives | AC-6, F-001 AC-27 | edge | ios, android | node + device-lab |
| TC-027 | Replay under the SAME client_turn_id; no double-apply | AC-6, F-001 AC-16 | security | ios, android | node |
| TC-028 | After kill, question + undo rebuild from the server read | AC-6, AC-8, F-001 AC-8, AC-10 | edge | ios, android | node |
| TC-029 | Audio interruption = cancel-while-listening; session released | AC-7, AC-5, F-001 AC-3 | edge | ios, android | node + device-lab |
| TC-030 | Foreground reads the session before accepting input | AC-8, F-001 AC-28 | happy | ios, android | node |
| TC-031 | Cold open on closed session — exactly ONE boundary message | AC-8, F-001 AC-28 | boundary | ios, android | node |
| TC-032 | Touch targets ≥ 44 pt / 48 dp as hit area | AC-9 | accessibility | ios, android | **device-lab** |
| TC-033 | Undo stays one gesture by touch | AC-9, F-001 AC-5 | happy | ios, android | node + device-lab |
| TC-034 | Keyboard never occludes; state-neutral; survives rotation | AC-10 | edge | ios, android | **device-lab** |
| TC-035 | Send from keyboard action and from the send button | AC-10, F-001 AC-17 | happy | ios, android | node + device-lab |
| TC-036 | System back never destructive; keyboard-first on Android | AC-11, AC-5, AC-6, F-001 AC-28 | negative | ios, android | **device-lab** |
| TC-037 | Every message announced to VoiceOver / TalkBack | AC-12, F-001 AC-19 | accessibility | ios, android | **manual** + node |
| TC-038 | Error announced immediately, not queued | AC-12, F-001 AC-19 | accessibility | ios, android | **manual** + node |
| TC-039 | Accessibility identity — 22 ids, platform-correct attribute | AC-12, AC-1 | accessibility | ios, android | node + device-lab |
| TC-040 | A foreground IS a reconnect — offline creates replay with no `onChange` | AC-4, AC-8, F-001 AC-25 | edge | ios, android | node |

## AC → TC coverage map

### F-003's own 12 ACs — every one has ≥ 1 P1 TC

| AC | Covered by |
|----|-----------|
| AC-1 (parity) | TC-001 … TC-012 (the whole parity block), TC-039 |
| AC-2 (iOS dual permission) | TC-013, **TC-014, TC-015, TC-016, TC-017** (matrix ×4) |
| AC-3 (Android single grant) | **TC-018, TC-019, TC-020** (matrix ×3) |
| AC-4 (offline divergence) | TC-021, TC-022, TC-023, TC-040 |
| AC-5 (kill while listening) | TC-024, TC-025, TC-029 |
| AC-6 (kill while thinking + replay) | TC-023, TC-026, **TC-027**, TC-028, TC-036 |
| AC-7 (audio interruption) | TC-025, TC-029 |
| AC-8 (foreground read) | TC-028, TC-030, TC-031, TC-040 |
| AC-9 (touch targets, one-gesture undo) | TC-032, TC-033 |
| AC-10 (keyboard) | TC-034, TC-035 |
| AC-11 (system back) | TC-036, TC-002 |
| AC-12 (screen reader + a11y identity) | TC-037, TC-038, TC-039 |

### F-001 ACs the parity table says apply on mobile — cited by F-001 id

**Hold identically (21).** Each is covered by a mobile TC citing its F-001 id:

| F-001 AC | Mobile TC |
|----------|-----------|
| F-001 AC-1 | TC-001 |
| F-001 AC-2 | TC-003 |
| F-001 AC-4 | TC-001 |
| F-001 AC-6 | TC-004 |
| F-001 AC-7 | TC-005 |
| F-001 AC-8 | TC-004, TC-028 |
| F-001 AC-9 | TC-006 |
| F-001 AC-10 | TC-007, TC-028 |
| F-001 AC-11 | TC-002, TC-006, TC-007 |
| F-001 AC-12 | TC-007 |
| F-001 AC-13 | TC-008 |
| F-001 AC-14 | TC-009 |
| F-001 AC-15 | TC-009 |
| F-001 AC-16 | TC-011, TC-023, TC-027 |
| F-001 AC-17 | TC-010, TC-035 |
| F-001 AC-18 | TC-010 |
| F-001 AC-20 | TC-012, TC-017, TC-022 |
| F-001 AC-22 | TC-022 |
| F-001 AC-23 | TC-011 |
| F-001 AC-24 | TC-011 |
| F-001 AC-29 | TC-002 |

**Hold with a mobile clause (6)** — the F-001 behaviour is verified alongside the clause:

| F-001 AC | → F-003 AC | Mobile TC |
|----------|-----------|-----------|
| F-001 AC-3 (cancel-while-listening) | AC-7 | TC-025, TC-029 |
| F-001 AC-5 (one-gesture undo) | AC-9 | TC-033, TC-004 |
| F-001 AC-19 (live region) | AC-12 | TC-037, TC-038 |
| F-001 AC-21 (permission request) | AC-2 / AC-3 | TC-013 … TC-020 |
| F-001 AC-25 (offline) | AC-4 | TC-021, TC-023, TC-040 |
| F-001 AC-28 (session lifecycle) | AC-8 | TC-030, TC-031, TC-036 |

**Moved wholesale (2):** F-001 AC-26 → **AC-5** (TC-024, TC-025) · F-001 AC-27 → **AC-6** (TC-026, TC-027, TC-028).

**Not tagged for mobile:** none. The parity table's "no F-001 AC is web-only and dropped" claim is honoured — every one of F-001's 29 ACs appears above, in one of the three dispositions.

### Permission matrix — enumerated, not sampled

| Row | Platform | State | Expected mic | TC |
|-----|----------|-------|--------------|-----|
| PM-IOS-1 | ios | mic granted + speech granted | available | TC-014 |
| PM-IOS-2 | ios | mic **denied** + speech granted | dimmed, names microphone | TC-015 |
| PM-IOS-3 | ios | mic granted + speech **denied** | dimmed, names speech recognition | TC-016 |
| PM-IOS-4 | ios | **both denied** | dimmed (never hidden) | TC-017 |
| PM-AND-1 | android | granted | available, one prompt only | TC-018 |
| PM-AND-2 | android | denied | dimmed, may re-request | TC-019 |
| PM-AND-3 | android | **permanently denied** | dimmed, **zero** re-requests | TC-020 |
| PM-CAP-0 | both | no capability | **hidden**, no error | TC-012 |
| PM-TRANS-1 | both | recognizer busy | dimmed, transient cause, recovers | TC-022 |
| PM-TRANS-2 | both | no language pack | dimmed, transient cause, recovers | TC-022 |

The iOS partial-denial rows (PM-IOS-2, PM-IOS-3) are the cases F-001's web suite
could never reach — web has one grant, so "one of two denied" does not exist
there. PM-IOS-4 vs PM-CAP-0 pins the dimmed/hidden boundary from both sides;
testing only one direction lets an implementation collapse the two modes and
still pass.

---

## Device-lab and manual debt — visible, not buried

The node tier cannot prove these. They are named in the spec's own
`## Test strategy (mobile)` and are reproduced here so the debt has a single
visible home. **None of them may be reported as automated coverage.**

| # | Owed | ACs | TCs | Why the node tier cannot claim it |
|---|------|-----|-----|-----------------------------------|
| 1 | Real permission dialogs + Settings deep link | AC-2, AC-3 | TC-013, TC-015–TC-020 | The port proves request *sequencing*; the OS sheet and the deep link are device behaviour |
| 2 | A real incoming call interrupting capture | AC-7 | TC-029 | The event can be emitted; that the RN audio bridge emits it on a device cannot |
| 3 | **A real OS memory-pressure kill, incl. the storage flush before process death** | AC-5, AC-6 | TC-024, TC-026 | **The highest-value item on this list.** The `DurableStore` double proves the contents outlive the model; it cannot prove AsyncStorage/MMKV (OQ-1) flushed to disk before the process died. An async write that is never awaited passes every headless test and loses the user's words on a real device |
| 4 | VoiceOver and TalkBack announcement | AC-12 | TC-037, TC-038 | AC-12 requires a real screen reader (W3C F103) — the same clause F-001 left open on web |
| 5 | Keyboard occlusion and rotation | AC-10 | TC-034 | Occlusion is rendered geometry; a prop assertion would test source text, not the observable (L-002) |
| 6 | System back and back-swipe | AC-11 | TC-036 | The *consequences* are node-assertable (TC-025, TC-030); that the real gesture routes to the background path is not |
| 7 | On-device recognition offline in the interface language | AC-4 | TC-021 | Depends on OS version and installed packs (spec Open Question 2) |
| 8 | Touch-target measurement on a device | AC-9 | TC-032 | There is no headless observable for a hit area; the model constants are a proxy, not the measurement |

**Tally after the execute run:** 40 TCs — **35** now read `Automation: automated`
(node-headless primary tier, assertions actually executed on 2026-08-17); **11**
of those 35 still carry a device-lab residue on top of their node half, so
`automated` there means *the node half runs*, never *the AC is fully verified*.
**3** are device-lab *only* (TC-032, TC-034, TC-036) and **2** are manual-first
with a node-testable payload half (TC-037, TC-038) — all five stay `manual`.

**This debt did not shrink because the suite went green.** AC-9, AC-10, AC-11 and
AC-12 still **cannot reach full verification from this tier at all**; they need a
device pass before anyone calls F-003 done. Item 3 remains the highest-value one:
the `DurableStore` double proves the contents outlive the model, and 105 passing
assertions do not make it prove that AsyncStorage/MMKV flushed to disk before the
process died.

---

## Drift, findings and requests

### 1. RESOLVED (2026-08-17) — Android accessibility identity attribute

Authoring left `identityAttribute('android') === 'contentDescription'` **red**
rather than patching it to match the implementation. Routing it found a real spec
defect: AC-12's two halves were mutually unsatisfiable, because one attribute
cannot carry both a machine identity and the announcement TalkBack speaks. The
decisive argument came from this folder's own AC — an id on `contentDescription`
is read aloud as "assistant-message-bubble" instead of the message.

architect-agent rewrote AC-12 (identity on one `testID` prop → `accessibilityIdentifier`
/ `resource-id`; announcement on `accessibilityLabel` → `contentDescription`),
design-agent moved all 22 ids in the Android mockup, and the orchestrator updated
`.claude/tools/design-check/testid-contract.sh`. TC-039 and the automation now
assert the corrected contract **and** the negative half: zero catalogue ids on
`contentDescription`, so the conflation cannot quietly return.

**The lesson worth keeping:** the value of that red test was not that QA guessed
right — QA guessed *wrong* about which side would move. It was that routing
instead of patching put the contradiction in front of the person who could fix
it. A patched assertion would have shipped a surface where TalkBack reads
selector tokens aloud, and every check in this repo would have been green.

### 2. RESOLVED (2026-08-17) — AC-9 hit areas are populated

Re-verified first thing at execute, as the authoring note required. All 14
interactive ids now meet the minimum as **hit area** on both platforms
(44 pt iOS / 48 dp Android); `hitArea` no longer returns nulls. Not a defect —
the module was simply half-landed during authoring, which is why it was reported
rather than filed.

`PAINTED` still records several targets below the minimum (checkbox 22×22, send
36×36, add-task 96×26), which is exactly the point of AC-9's "hit area rather
than painted size": those are the elements whose `hitSlop` does the work. The
**measurement on a device** remains device-lab debt (item 8) — the model
constants are a proxy, not the measurement.

### 3. RESOLVED — the announcement seam exists

Authoring flagged that the platform doc's port list (`TranscriptSource`,
`DurableStore`, `AppLifecycle`, `Connectivity`) has no announcement seam, which
would have made AC-12 100% manual — materially worse than F-001's web surface.
It turns out `model/announce.ts` (`announcementFor`, `announcementsFor`) and
`ports/app-lifecycle.ts` (`RecordingAnnouncer`) provide exactly that. **Request
to architect:** add it to `specs/_shared/platform/mobile.md`'s port list so it is
discoverable; QA found it by runtime inspection, which is not a durable contract.

### 4. RESOLVED (2026-08-17) — BUG-002, cold open accepted input before the session read

Filed this run: `qa/_shared/bugs/BUG-002-cold-open-accepts-input-before-session-read.md`
(layer `mobile`, HIGH, open). `onForeground()` gates input on the session read
via `foregroundSync`; `init()` runs the same reconciliation but never installs
the gate, so a cold open dispatches a turn before `GET /assistant/session`. The
consequence that costs the user something: the racing turn opens a new session,
so a previously closed session's boundary message — close marker, declined
questions named with their task titles, late outcomes — is never rendered.

TC-030's assertion was left **red** rather than weakened. **Fixed the same day —
TC-030 is green.**

### 5. Selector contract — no requests outstanding

All 39 TCs and the automation reference **only** ids from the 22-value catalogue,
asserted mechanically by the suite (`A. selector contract`), which fails on any
invented selector. The catalogue is identical across iOS, Android and web. No
element needed by any TC lacks an id, so there is nothing to send to design-agent
on that front.

### 6. Copy variants — a note for design-agent, not a blocker

The iOS mockup carries **one** permission message ("Một trong hai đang tắt" — one
of the two is off), but AC-2 requires the message to name *which* capability is
missing, which needs three variants (mic-only, speech-only, both). The Android
mockup likewise carries one message for two distinct states (denied vs
permanently denied, AC-3). The implementation already generates per-combination
Vietnamese copy and the suite asserts the three iOS messages are mutually
distinguishable — but that copy currently lives in the implementation rather than
in `design/_shared/components.md`, which F-001's Naming convention makes the
design system's to own. Worth folding back into the design system before it
drifts.

## Copy language

The product ships **Vietnamese**. Per F-001 `## Conversation model` ("Naming
convention"), the spec's English words are concept names, not shipped strings —
every quoted expectation in these TCs is traceable to the mockups or to
`design/_shared/components.md`. Seeded task titles are fixture data, not copy,
and carry the `qamob-` prefix.

## Test data isolation

Namespace `qamob-`, one account per TC (`qamob-tc{nnn}@qa.example.com`), per
`_qa-foundations` §10. No mobile TC performs an unscoped destructive operation.
The canonical utterance→intent table is **read** from
`qa/assistant/F-001/api/utterance-intent-fixtures.json`, never copied — the suite
asserts the mobile fixtures do not carry a twin of its rows, which is L-004's
lesson turned into a check.
