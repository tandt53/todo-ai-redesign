<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 2, dev-mobile lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a6c556c85db5d96a8 -->

I've read the protocols, the round-1 cluster report, revision 2 of the spec, and traced the three code files. Here is my round-2 return.

---

- **Task:** T-050
- **Feature:** F-002 talk-back
- **Phase:** `review-spec`, round 2 (final)
- **Lens:** dev (mobile)
- **Status:** DONE
- **Confidence:** HIGH
- **Files written:** none (review dispatch — `_spec-review-protocol.md` writes nothing)

## Closure check — my round-1 findings

| R1 | Where it landed | Verdict |
|---|---|---|
| **F1** HIGH — iOS silent-switch categories cannot record; `AVAudioSession` singleton unowned | AC-7 names `ambient`/`soloAmbient` and **forbids** keeping `playAndRecord`; AC-19 NEW assigns one arbiter | **Resolved.** The earpiece point landed verbatim in AC-7 (".defaultToSpeaker … quietly breaking AC-1"). AC-19 itself carries new defects — filed fresh below as H1/H2/M5, not re-raised as F1 |
| **F2** HIGH — Android TTS on the media stream; ringer does not silence it, DND does not suppress it | AC-7's Android half enumerates ringer `normal\|vibrate\|silent` + DND, suppresses client-side | **Resolved at the start gate.** Client-side pre-check is the mechanism that actually works — `AudioManager.getRingerMode()` returns exactly those three constants. The **mid-sentence** half is not resolved → new H4; the DND half is over-broad → new M1 |
| **F3** HIGH — `tapMic()` defers the whole tap behind `foregroundSync` | AC-20 NEW: stopping is not "new input", never gated; message carries its own stop | **Resolved.** Verified the citation is exact: `controller.ts:294–299` is the `foregroundSync` early-return. AC-20(b)'s mic-mode enumeration is wrong → new M2 |
| **F4** MED — mic four modes, talk-back keys off a different capability | AC-20(b) | Directive resolved; enumeration defective → M2 |
| **F6** MED — no-voice tuple is a dead control | AC-13 four-valued, AC-12 narrowed, aligned to F-003 AC-4 with the alignment stated | **Resolved** |
| **F7** MED — screen-reader activation mid-sentence not a stop trigger | AC-15 rewritten: start gate + subscription + foreground cadence | **Resolved.** The *signal* for the subscription has the same defect as the read → new M3 |
| **F8** MED — verification status lost F-003's third category | Three categories restored | **Resolved.** But AC-19's placement in bucket 3 contradicts AC-19's own text → H2 |
| **F9** LOW — AC-14 "never suppressed" collides with `suppressAnnouncements` | AC-14 names `controller.ts:74`, calls it a different subject, tells implementers not to "fix" it | **Resolved.** Line 74 verified: `private suppressAnnouncements = false` |
| **F5** MED, **F10** LOW | — | **Cannot verify.** Neither appears anywhere in `docs/reports/gate1-review-F-002.md` (dev-mobile is cited as F1, F2, F3, F4, F6, F7, F8, F9 only). Two of my round-1 findings have no recorded landing. Flagging as a process note for the orchestrator, not as a spec defect |

## Findings — new defects in changed material

```yaml
findings:
  - id: H1
    severity: HIGH
    acs: [AC-19, AC-7, AC-10]
    claim: >
      AC-19's "one arbiter module both ports call" requires taking audio-session
      ownership away from three shipped, gate-passed F-003 seams, and the seam it
      would have to take it from exposes no category API at all.
    consequence: >
      Today the session is owned by the recognizer port: `NativeSpeechModule.releaseAudioSession()`
      (rn-transcript-source.ts:41), `RNTranscriptSource.releaseAudioSession()` (:203-205),
      `MobileTranscriptSource.releaseAudioSession()` on the interface, and the interruption
      subscription lives on the controller (controller.ts:101-103), which also releases from
      two places (`onBackground` :216-220, `onAudioInterruption` :229-233). `NativeSpeechModule`
      has `start(locale)`/`stop()`/`releaseAudioSession()` and **no setCategory**, and
      `RNTranscriptSource.start()` necessarily configures the session behind any arbiter's back.
      So AC-19 is buildable only by editing those seams — which this spec's own Out of Scope
      forbids ("it would put this feature's agent inside two shipped, gate-passed ports") —
      or by standing a second owner beside the existing one, which is precisely the
      two-owners problem AC-19 exists to end. Earliest catch is C6 writer-subtree enforcement
      or a mobile implementer returning BLOCKED mid-build.
    would_not_be_a_finding_if: >
      AC-19 named the F-003 seam changes it requires and the spec's Out of Scope carved
      them in (as it did for the recognizer's language alignment, in the opposite direction),
      or AC-19 stated that the arbiter wraps rather than replaces the existing
      `releaseAudioSession` path and said which module keeps `setCategory`.
    directive: >
      Name the seam delta explicitly in AC-19 — `NativeSpeechModule` gains a category
      operation, `releaseAudioSession` moves to the arbiter, and `controller.ts:101-103`'s
      subscription moves with it — and add a matching Out-of-Scope line permitting exactly
      those edits, or declare AC-19 blocked on a prior F-003 task.

  - id: H2
    severity: HIGH
    acs: [AC-19, AC-18]
    claim: >
      AC-19's observable has no declared field, and `## Verification status` contradicts
      AC-19's own claim about it.
    consequence: >
      AC-19 says "it records the category in force at each `spoke` and each listening
      transition, so a build that never switches is caught by assertion rather than by a
      device." But `speech.decision_log` is declared `{seq, message_id, decision, reason, at}[]`
      with the note that the reason list "is the only one", and `speech.utterance` is
      `{message_id, frame_id, slots, lang, started_at}` — neither carries a category, and a
      listening transition is not a "message considered" so it produces no log entry at all.
      Meanwhile `## Verification status` files AC-19 under **"No headless observable at all"**.
      Both statements are in the same revision. The build that never switches category is
      exactly the cheap implementation AC-7 forbids, and AC-19 is the only thing standing
      between it and a device test nobody can run this phase (ADR-001, no store build).
    would_not_be_a_finding_if: >
      `## Data` declared a category/route field on `speech.decision_log` (or a sibling
      `audio_session` record), and `## Verification status` moved AC-19 to the middle
      category with the residue named as "the real AVAudioSession category" only.
    directive: >
      Add the category to the recorded surface in `## Data`, and reconcile
      `## Verification status` — AC-19 belongs in "node half proven, device residue named",
      the category-switch *decision* being the proven half.

  - id: H3
    severity: HIGH
    acs: [AC-18, AC-7]
    claim: >
      AC-18(a)'s "every silence is recorded with its specific reason" is unsatisfiable on
      iOS for AC-7's iOS half, because iOS exposes no API for the ring/silent switch.
    consequence: >
      AC-7's iOS mechanism is correct precisely because the OS does the silencing: with
      `ambient`/`soloAmbient` the hardware switch mutes playback and the app is never told.
      The client therefore cannot emit `suppressed{reason: os_silenced}` on iOS — it will
      emit `spoke` with a non-empty utterance while nothing comes out, and AC-18(b)'s
      mandatory positive assertion will pass on a silenced device. Two downstream costs:
      Ops' per-reason counter for `os_silenced` reads ~0 on iOS forever while being the
      commonest cause of silence there, and an implementer reading AC-18(a) literally will
      either poll something that does not exist or synthesise a fake signal. Android is the
      opposite case (the client decides, so it can record) — so the one reason value spans
      two mechanisms with opposite observability and the spec treats them as one.
    would_not_be_a_finding_if: >
      AC-18 scoped its recording obligation to silences the *client decides*, and stated
      that OS-level muting the platform does not expose (iOS silent switch) is out of the
      decision log by construction — with AC-7's iOS half saying the same.
    directive: >
      Add that exemption to AC-18 in one sentence, and mark `os_silenced` in `## Data` as
      Android-and-web-reachable only. Ops should note the iOS counter is structurally zero
      rather than leave someone to read it as "never happens".

  - id: H4
    severity: HIGH
    acs: [AC-7, AC-18]
    claim: >
      A mid-sentence `os_silenced` stop is required by two parts of the spec and by no AC,
      and the Android signal it would need is named nowhere.
    consequence: >
      `## Data`'s closed `stopped` vocabulary contains `os_silenced`, and the User Flow
      diagram puts "silent/DND" on the mid-utterance edge `U --> X[Stopped]`. AC-7's Android
      text specifies only a start-time read ("the client reads the ringer state ... and
      suppresses"), Open Question 3 asks only for the ringer/DND *state*, and the Test
      strategy's enumerated matrix is "Android ringer ×3 + DND" with no mid-utterance leg
      (contrast the screen-reader row, which does have "start/mid-utterance"). Implementer
      and QA will both build the start gate; `stopped{reason: os_silenced}` becomes a dead
      vocabulary value and a phone flipped to silent mid-sentence keeps talking. This is
      L-005's shape — one obligation, two doors, a guard at one — which this same revision
      correctly applied to AC-15 and did not apply here. The subscription requires signals
      not in OQ3's list: a `RINGER_MODE_CHANGED_ACTION` receiver and a DND observer, both
      distinct capabilities from a one-shot read.
    would_not_be_a_finding_if: >
      AC-7 stated that OS silencing is evaluated at utterance start only and the flow
      diagram and `stopped` vocabulary were corrected to match; or AC-7 required the
      subscription, OQ3 listed it as a capability, and the Test-strategy matrix gained a
      mid-utterance leg.
    directive: >
      Pick one and make all four places agree (AC-7 text, flow diagram, `stopped` vocabulary,
      Test-strategy matrix). If the subscription is in, add it to OQ3's blocking
      pre-implementation check alongside the category-switch question.

  - id: M1
    severity: MEDIUM
    acs: [AC-7]
    claim: >
      AC-7 treats Android DND as a boolean that silences media; it is neither.
    consequence: >
      `NotificationManager.getCurrentInterruptionFilter()` is four-plus-valued
      (`ALL | PRIORITY | NONE | ALARMS | UNKNOWN`) and can return `UNKNOWN`. Two problems.
      (a) There is no specified disposition for `UNKNOWN`, and AC-18 makes an unrecorded or
      wrongly-reasoned decision a failure, so the implementer has no legal move. (b) Under
      `PRIORITY` — the mode most people leave on a schedule — DND does not attenuate the
      media stream at all, so "suppresses on ... DND active" makes the feature silently dead
      for a large share of Android users all evening, which is the "turn it off and never
      back on" failure Open Question 1 already names.
    would_not_be_a_finding_if: >
      AC-7 enumerated the interruption-filter values it suppresses on and named the
      disposition for `UNKNOWN`, the way it already enumerates ringer mode three-valued.
    directive: >
      Enumerate DND by filter value, decide `UNKNOWN` explicitly (recommend: treat as
      not-suppressing and record it), and say whether `PRIORITY` suppresses.

  - id: M2
    severity: MEDIUM
    acs: [AC-20]
    claim: >
      AC-20(b) enumerates four mic modes that are not this codebase's four mic modes, and
      the count it draws from them is wrong in both directions.
    consequence: >
      The shipped union is `SpeechCapability = 'available' | 'none' | 'permission-denied' |
      'transient-failure'` (`_shared/ports/transcript-source.ts`), mapped by
      `speechCapabilityFrom()` (`mobile/model/permissions.ts`). AC-20 lists
      "available · dimmed · hidden · permission-denied": "dimmed" is not a mode (it is how
      *both* `permission-denied` and `transient-failure` render), and `transient-failure` —
      F-003 AC-4's recognizer-without-a-language-pack state, the one AC-13 is deliberately
      mirrored on — is missing. The derived claim "a mic-only stop has no instantiation in
      three of them" is false: `tapMic()` has live branches for `permission-denied`
      (:307-310, `onDeniedMicTap`) and `transient-failure` (:311-316, language-pack message);
      only `none` returns with nothing (:301). AC-20's directive survives this intact — the
      message must carry its own stop regardless — but a second vocabulary for one
      enumerated set is L-004's shape, and the Test strategy's enumerated matrix has no
      mic-mode axis at all, so whichever list QA reads is the one that gets covered.
    would_not_be_a_finding_if: >
      AC-20 cited `SpeechCapability`'s four values by name, or stated it was describing
      rendered appearance rather than the capability enum.
    directive: >
      Replace the list with the four `SpeechCapability` values, correct the count, and add
      a mic-mode axis to the Test-strategy matrix so AC-20's "reachable in every mic mode"
      is enumerated rather than asserted.

  - id: M3
    severity: MEDIUM
    acs: [AC-15]
    claim: >
      AC-15's new mid-utterance *subscription* has the same touch-exploration defect as the
      state read it correctly rejects, and Open Question 3's blocking check covers only the read.
    consequence: >
      AC-15 rightly says the Android signal must report spoken-feedback services and that
      RN's `AccessibilityInfo.isScreenReaderEnabled` maps to touch exploration. But RN's
      change event (`screenReaderChanged`) is derived from the same signal, and AC-15 now
      requires "subscribed to for the duration". OQ3 asks only for "a spoken-feedback
      screen-reader signal" — a package or native module that answers that for the one-shot
      read (e.g. `AccessibilityManager.getEnabledAccessibilityServiceList(FEEDBACK_SPOKEN)`)
      can still leave the *change* callback unbuildable, and the blocking pre-implementation
      check would pass. The mid-utterance door is the half AC-15 was rewritten to add, so it
      is the half most likely to ship as the start gate again.
    would_not_be_a_finding_if: >
      OQ3 named the change-notification capability separately from the state read, or AC-15
      stated a polling cadence as the fallback when no spoken-feedback change event exists.
    directive: >
      Split OQ3's screen-reader item into read + subscribe, and state the fallback
      (`AccessibilityManager.addAccessibilityStateChangeListener` re-filtered, or a stated
      poll interval) so the mid-utterance stop is not silently dropped at implementation.

  - id: M4
    severity: MEDIUM
    acs: [AC-4]
    claim: >
      AC-4(b) gives web a precise visibility predicate and mobile none, and mobile's
      visibility enum has three values with one unhandled today.
    consequence: >
      AC-4(b) reads "the surface is foregrounded **and visible** — on web
      `document.visibilityState === "visible"` …". On mobile the equivalent is
      `AppLifecycle.visibility(): 'active' | 'inactive' | 'background'`
      (`mobile/model/lifecycle.ts:11`), and the controller subscribes to only two of them:
      `if (v === 'active') … else if (v === 'background') …` (`controller.ts:97-100`) —
      `inactive` falls through to nothing. On iOS `inactive` is exactly the mid-utterance
      case that matters: the notification shade pulled down, an incoming-call banner, the
      app switcher. AC-4 gives no disposition, so an implementer decides whether the app
      keeps talking into a call banner, and AC-18 requires whichever choice with a recorded
      reason that the vocabulary supplies only as `not_visible`.
    would_not_be_a_finding_if: >
      AC-4(b) named the mobile predicate over `AppVisibility` the way it names
      `document.visibilityState` for web, including `inactive`.
    directive: >
      State the mobile predicate explicitly and say whether `inactive` stops the utterance
      (recommend: yes, `stopped{reason: not_visible}` — it is the same intent as a hidden tab).

  - id: M5
    severity: MEDIUM
    acs: [AC-19, AC-18, AC-9]
    claim: >
      AC-19 has no failure branch, and `## Data`'s closed reason vocabulary has no value for
      a category switch or session activation that the OS refuses.
    consequence: >
      Switching iOS category on a listen↔speak edge means deactivate → setCategory →
      setActive, and setActive routinely fails while another app still holds the session or
      a call is tearing down. AC-9's tap-then-speak makes this edge happen on every
      interruption of an utterance, so it is a common path, not an exotic one. AC-18 permits
      only the reasons in `## Data` and makes an unrecorded or wrongly-reasoned silence a
      failure of the AC that caused it — so a build hitting a real, ordinary platform error
      has no legal way to record it and violates AC-18 by construction. Nothing in AC-19
      says whether the utterance is dropped, retried, or degraded when the switch fails.
    would_not_be_a_finding_if: >
      `## Data` carried a `suppressed`/`stopped` reason for an unavailable audio session,
      and AC-19 stated the disposition of a failed switch.
    directive: >
      Add one reason value (e.g. `audio_session_unavailable`) and one sentence in AC-19
      naming the disposition. Note `gesture_required` already sets the precedent for
      "platform refused, surfaced rather than silent".

  - id: L1
    severity: LOW
    acs: [AC-10, AC-19]
    claim: >
      `AudioInterruptionEvent.phase: 'ended'` exists in the shipped port and is subscribed
      by nothing; AC-10 gives it no obligation for the speech session.
    consequence: >
      `controller.ts:101-103` acts only on `phase === 'began'`. For listening that is
      harmless because `start()` re-acquires. AC-10 says "on focus return speech does not
      resume and the mic returns to available" — correct — but under AC-19 the arbiter must
      re-acquire or re-set the category before the *next* utterance, and no AC says at which
      event. The nearest natural hook is the `ended` phase nobody consumes.
    would_not_be_a_finding_if: >
      AC-19 stated that the category is set at each utterance start regardless of prior
      state, making the `ended` phase irrelevant to speech.
    directive: >
      One clause in AC-19 saying whether the category is (re)asserted per utterance or held
      across interruptions.

  - id: L2
    severity: LOW
    acs: [AC-13, AC-11]
    claim: >
      AC-13's `resolving` state is scoped to the web voice list; Android's TTS engine init
      is equally asynchronous and gets no state.
    consequence: >
      `speech.capability` is "probed at runtime, re-resolved on foreground", but on Android
      the engine is not queryable until `TextToSpeech.OnInitListener` fires, and per-voice
      network dependence (`Voice.isNetworkConnectionRequired()` / the `notInstalled` feature)
      is unavailable before that. So `on_device` — which AC-11's preference rule keys on —
      and `voice_for_language` are both unknown for the first moments after boot, and AC-13
      describes `resolving` as covering "the web voice list loading asynchronously (dev-web F4)".
      An early eligible utterance on Android has no defined state.
    would_not_be_a_finding_if: >
      AC-13 described `resolving` as covering any asynchronous capability resolution rather
      than naming the web voice list as its cause.
    directive: >
      Broaden `resolving`'s definition by one clause to include Android engine
      initialisation; OQ5's timeout question then covers both.
```

## Checked, found nothing (anti-theatre)

```yaml
checked:
  - "AC-7's iOS forbidden category is named correctly — `ambient`/`soloAmbient` are the only
     categories the ring/silent switch attenuates, and both are non-recording, so the
     conflict with F-003's `record`/`playAndRecord` is stated accurately"
  - "AC-7's `.defaultToSpeaker` clause is correct and correctly scoped — it is a
     `playAndRecord`-only option, so it is descriptive of the forbidden path, not a
     requirement that would contradict the mandated `ambient`"
  - "AC-7's Android ringer enumeration matches the platform exactly:
     `AudioManager.RINGER_MODE_{NORMAL,VIBRATE,SILENT}`, three values, no fourth"
  - "AC-7's route-change stop is implementable on both platforms and already has a home in
     the shipped enum: `AudioInterruptionReason` includes `'route-change'`
     (mobile/model/lifecycle.ts:70) and AC-10's four causes map onto that union unchanged"
  - "AC-20's code citation is exact — `controller.ts:294-299` is the `foregroundSync`
     early-return, and hoisting the stop above it does not break F-003 AC-8, whose subject
     is `send()` (:437-444) and the begin-listening path (:322), both of which stay gated"
  - "AC-20's ungated stop does not conflict with `gateForeground`'s two ordering rules
     (:203-213) — the gate is installed synchronously and cleared by its installer; a stop
     that never reads `foregroundSync` is orthogonal to both"
  - "AC-14's `suppressAnnouncements` citation is exact (`controller.ts:74`) and its reading
     of the flag is correct — it is set only around `syncSession()` (:451-458) and gates
     `drainAnnouncements()` (:463), so it suppresses restored history, not live messages"
  - "AC-23's mobile drift citation is exact — `rn-transcript-source.ts:71` is
     `this.locale = opts.locale ?? 'vi-VN'`, and `boot.ts` threads `locale` with no caller
     supplying it, so the effective value is the default the AC names"
  - "AC-22's precedent citation is exact — `appliedHead()` is at `format.ts:70`, and it is
     genuinely the 'fixed frames with an enumerated numeric slot' shape the AC describes"
  - "AC-9's second direction (outcome arriving while listening renders silently, not queued)
     is implementable — the reducer already renders messages independently of capture, and
     `suppressed{reason: listening}` exists in the vocabulary"
  - "AC-6's `client.speech_prefs` device-local scoping raises no mobile-specific issue; the
     durable store (`HydratedDurableStore` over `AsyncKeyValueBackend`) already carries
     device-local client stores, and the 'survives process kill' residue is correctly named
     in Verification status rather than ticked"
  - "AC-10's de-allocation to the middle verification category is right — three of its four
     clauses run through `FakeAppLifecycle.interrupt()` (`ports/app-lifecycle.ts`) today"
  - "AC-1/AC-3/AC-21's spoken composition raises no mobile platform constraint; the
     client-side title resolution AC-21 specifies has the same data on both clients"
  - "AC-16 (web, no screen-reader detection) is correctly tagged web-only and imposes
     nothing on the mobile ports"
  - "AC-12's capability-not-platform-name rule matches the shipped precedent
     (`speechCapabilityFrom` derives, never platform-sniffs), so no new conflict"
  - "F-003 AC-1's no-fork rule holds in revision 2 — every divergence I found is tagged
     `ios`/`android` rather than hidden under `mobile`; AC-10's retag to `(ios, android)` landed"
```

## Notes for the orchestrator (not spec findings)

- **Two round-1 findings have no recorded landing.** `docs/reports/gate1-review-F-002.md` attributes dev-mobile F1, F2, F3, F4, F6, F7, F8, F9. My F5 (MEDIUM) and F10 (LOW) appear nowhere in the report and are not recoverable from any artifact in the repo — no per-lens round-1 return is stored, only the cluster synthesis. I cannot certify closure on them. If the round-1 dispatch transcripts survive, they are the only place to check; otherwise this is a gap in the Gate 1 record worth fixing before the next feature (store per-lens returns, not only clusters).
- **Pre-existing F-003 defect, noted not filed:** `tapMic()`'s cancel-while-listening branch (`controller.ts:302-305`) is also deferred behind `foregroundSync`, so F-001 AC-3's cancel waits on a network round trip in exactly the way AC-20 forbids for speech. That is F-003 surface, outside F-002's scope, and I am reporting it rather than folding it into a finding. AC-20's implementer will have to decide whether their hoisted stop branch also covers it; the spec should say it does not.
- **Round-2 severity discipline:** four HIGHs is more than I would like for a final round. Three of them (H1, H2, M5) are one subject — AC-19 is new, load-bearing, and the least finished AC in the revision. H3 and H4 are the two halves of AC-7 that the platform, not the wording, makes hard. If the gate closes on time rather than on findings, AC-19's observable (H2) is the single highest-value fix: without it, C7's whole resolution is unfalsifiable until a device exists, and ADR-001 says no device exists this phase.

## Evidence

```yaml
evidence:
  inputs_read:
    - .claude/agents/_ethos.md
    - .claude/agents/_completion-protocol.md
    - .claude/agents/_spec-review-protocol.md
    - specs/_shared/LEARNINGS.md
    - docs/reports/gate1-review-F-002.md
    - specs/assistant/F-002-talk-back.md
    - src/assistant/mobile/controller.ts
    - src/assistant/mobile/ports/native/rn-transcript-source.ts
    - src/assistant/mobile/model/lifecycle.ts
    - src/assistant/mobile/ports/app-lifecycle.ts          # not in briefing; read to verify AC-4/AC-10/AC-19 signal availability
    - src/assistant/mobile/ports/transcript-source.ts      # not in briefing; read to verify AC-20's mic-mode claim
    - src/assistant/mobile/model/permissions.ts            # same
    - src/assistant/_shared/ports/transcript-source.ts     # same — SpeechCapability is defined here
    - src/assistant/mobile/boot.ts                         # read to verify AC-23's locale drift claim
    - src/assistant/_shared/model/format.ts                # read to verify AC-22's appliedHead citation
  ac_coverage:
    # All 22 live ACs examined through the dev-mobile lens (AC-8 is withdrawn).
    AC-1:  examined — no mobile platform constraint; acceptance method now repeatable
    AC-2:  examined — four source objects are all client-side, no mobile constraint
    AC-3:  examined — no finding
    AC-4:  M4 — mobile visibility predicate undeclared, `inactive` unhandled
    AC-5:  examined — slot-of-one raises no platform issue
    AC-6:  examined — device-local persistence matches shipped durable store
    AC-7:  H3, H4, M1 — iOS unobservable silence, Android mid-sentence door, DND not boolean
    AC-9:  examined + M5 — second direction implementable; category-switch failure unhandled
    AC-10: L1 — `phase: 'ended'` consumed by nothing, no obligation stated
    AC-11: L2 — Android engine init has no `resolving` state
    AC-12: examined — capability-not-platform rule matches shipped precedent
    AC-13: examined + L2 — four-valued shape correct; `resolving` scoped web-only
    AC-14: examined — `suppressAnnouncements` citation verified exact, conflict correctly closed
    AC-15: M3 — subscription signal has the read's defect; OQ3 covers only the read
    AC-16: examined — web-only, imposes nothing on mobile
    AC-17: examined — 1.4.2 mechanism depends on AC-20, which M2 affects only in enumeration
    AC-18: H2, H3, M5 — no field for AC-19's datum; iOS silence unrecordable; vocabulary incomplete
    AC-19: H1, H2, M5, L1 — ownership unbuildable in scope, observable undeclared, no failure branch
    AC-20: M2 — mic-mode enumeration wrong; directive itself sound, code citation verified exact
    AC-21: examined — client-side resolution identical on both clients
    AC-22: examined — `format.ts:70` citation verified exact
    AC-23: examined — `rn-transcript-source.ts:71` citation verified exact
  commands_run:
    - cmd: "sed -n '60,90p' src/assistant/_shared/model/format.ts"
      exit: 0
      result: "appliedHead declared at line 70 — AC-22's citation confirmed"
    - cmd: "cat src/assistant/mobile/ports/app-lifecycle.ts src/assistant/mobile/ports/transcript-source.ts"
      exit: 0
      result: "AppVisibility 3-valued; SpeechCapability 4-valued; no category API on any port"
    - cmd: "cat src/assistant/mobile/model/permissions.ts src/assistant/_shared/ports/transcript-source.ts"
      exit: 0
      result: "speechCapabilityFrom maps to available|none|permission-denied|transient-failure"
    - cmd: "cat src/assistant/mobile/boot.ts"
      exit: 0
      result: "locale threaded from BootOptions, no caller supplies it → vi-VN default stands"
  artifacts_written: []
  unresolved:
    - "tradeoff:record-gap — round-1 dev-mobile F5 and F10 cannot be closure-checked; no per-lens round-1 return is stored in the repo and the cluster report does not carry them. Reported to the orchestrator rather than silently omitted."
```

**Memory read:** none relevant (no `memory/MEMORY.md` entry bears on this dispatch).

**Memory entry:**

```markdown
---
## 2026-08-17 | dev-mobile lens | T-050
Type: pattern
Tags: gate1, mobile, audio-session, spec-review
Summary: A Gate 1 finding of the form "nobody owns X" is only half-closed when a
revision names an owner — the other half is whether the named owner can hold X
where the codebase already puts it, and whether the ownership is observable
without a device. F-002's AC-19 named an arbiter for AVAudioSession but placed it
outside the seams that hold the session today, and asserted an observable no
declared field carries.
Lesson: When re-reviewing a revision that answers an ownership finding, trace the
new owner against the shipped modules that currently perform the duty, and check
the spec's own observable/verification sections agree that the new rule is
assertable. A revision can satisfy a finding's wording and leave its consequence
intact.
---
```

---METRICS---
status: DONE
confidence: HIGH
lens: dev-mobile
round: 2
findings_high: 4
findings_medium: 5
findings_low: 2
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23]
blockers: []
bugs_filed: []
