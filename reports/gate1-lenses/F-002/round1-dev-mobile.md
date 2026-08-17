<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 1, dev-mobile lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a3614f2c726e8bd39 -->

I've read all four required files, both specs, and the mobile implementation. Writing nothing, as the lens contract requires.

## Gate 1 — F-002 talk-back · lens: dev (mobile) · round 1

**ACs examined:** AC-1 … AC-17 (all 17). Findings below are confined to my three lens questions: platform contradiction, where a required value comes from, and iOS/Android divergence hidden under a `mobile` tag.

```yaml
findings:
  - id: F1
    severity: HIGH
    acs: [AC-7, AC-9, AC-1, AC-10]
    claim: >
      On iOS the only audio-session categories the ring/silent switch silences are
      `ambient` and `soloAmbient`, and neither can record. F-003's recognizer needs
      `record`/`playAndRecord`. AVAudioSession is one process-wide singleton, so
      AC-7's iOS clause and F-003 AC-7's capture cannot both hold without switching
      the category on every listen↔speak transition — and no AC in either spec owns
      the category, the activation, or the output-route policy.
    consequence: >
      Two ports (`MobileTranscriptSource` and the `SpeechOutput` the Test strategy
      declares) will each call setCategory/setActive on the same singleton. The
      cheap implementation — keep `playAndRecord` so nothing has to switch — fails
      AC-7 outright (playAndRecord ignores the silent switch) and additionally
      routes playback to the **earpiece** unless `.defaultToSpeaker` is set, which
      quietly breaks AC-1's whole acceptance test (cover the screen, a listener
      recounts what changed). The opposite cheap implementation — `ambient` for
      speech — makes AC-7's "never re-routes to the external speaker" on headphone
      removal an unstated route decision. Earliest catch is a device pass, i.e.
      after both clients are built.
    would_not_be_a_finding_if: >
      An AC named the audio-session owner and the category each phase requires, or
      stated the required output route for an utterance, or Open Question 5 asked
      "who owns the session category and route" rather than only "which module".
    directive: >
      Add an AC (or extend AC-7) that states: one owner of the iOS audio session;
      the category held while speaking and while listening; that the transition is
      part of AC-9's exclusivity; and the required output route for an utterance.
      Widen Open Question 5 from module choice to session ownership — a module that
      *can* set the category still cannot arbitrate with the recognizer's module.

  - id: F2
    severity: HIGH
    acs: [AC-7]
    claim: >
      AC-7's Android half — "speech respects the ringer/DND state" — names no
      mechanism, and the platform gives it for free on no stream. Android TTS
      output defaults to the media stream (`STREAM_MUSIC` / `USAGE_ASSISTANT`),
      which ringer mode does not silence and which DND does not suppress by
      default. The iOS half names its mechanism precisely ("the audio session
      category is one the ring/silent switch silences"); the Android half is a
      one-word requirement over a choice with visible consequences.
    consequence: >
      The default implementation passes review and fails the AC on every device:
      phone on silent, app speaks. The two available fixes diverge observably —
      publishing on a notification-class stream changes routing and makes the
      volume rocker adjust a different stream than the user expects, while reading
      `AudioManager.getRingerMode()` and self-suppressing keeps media volume but
      needs a stated rule for what DND means. An implementer picking one is a
      per-platform behaviour call, which F-003 AC-1 explicitly forbids
      ("a divergence discovered during implementation is a spec question routed
      back through the orchestrator, never an implementer's local call").
    would_not_be_a_finding_if: >
      AC-7 named the Android mechanism (which stream/usage attribute, or an
      explicit "read ringer mode and suppress"), or stated that Android's
      instantiation of "the OS's silence wins" is ringer-mode only and DND is out
      of scope.
    directive: >
      Split AC-7 into `ios` and `android` rows as AC-8/AC-16 already do for web,
      and give the Android row a named mechanism and a stated DND scope. If DND
      readability is uncertain across OS versions, make that the open question
      rather than the AC.

  - id: F3
    severity: HIGH
    acs: [AC-9, AC-5]
    claim: >
      AC-9 requires the mic tap to stop a playing sentence "immediately: no
      remaining audio after the tap". The existing mobile entry point cannot do
      that. `MobileAssistantController.tapMic()` (src/assistant/mobile/controller.ts:294-299)
      opens with `if (this.foregroundSync !== null) { void this.foregroundSync.then(() => this.tapMic()); return }`
      — the whole tap is deferred behind F-003 AC-8's session read.
    consequence: >
      An utterance started by a turn the user just issued keeps playing for the
      duration of a `GET /assistant/session` round trip whenever a foreground
      transition lands during it — returning from a system dialog, Control Center,
      or the permission sheet all produce `active` and install the gate. The
      audio is device-local (AC-11) so nothing else stops it. AC-9 is then
      untrue on exactly the interrupt the feature promises, and the failure is
      network-latency-shaped, so a fast lab run hides it.
    would_not_be_a_finding_if: >
      AC-9 stated that stopping speech is not "new input" in AC-8's sense and is
      therefore never gated, or the spec stated that no utterance can be in flight
      across a foreground transition.
    directive: >
      Add to AC-9: stopping the utterance is not input and is never held behind
      the AC-8 foreground gate; only the begin-listening half is. This forces the
      tap to split into an ungated stop and a gated capture-start, which is also
      what F1 and F4 need.

  - id: F4
    severity: MEDIUM
    acs: [AC-9, AC-10]
    claim: >
      AC-9 says "activating the mic" stops speech, but on mobile a mic tap has
      five specified outcomes that are not "listening starts": an OS permission
      dialog (F-003 AC-2/AC-3), a Settings deep link (F-003 AC-3), a
      language-pack message (F-003 AC-4), a denial message, or nothing at all
      (capability `none`). The spec does not say which of these counts as
      activation, and it states no ordering between the stop and the capture start.
    consequence: >
      Both readings are wrong somewhere. If stop fires only when capture actually
      begins, the iOS microphone/speech-recognition dialogs appear **while the app
      is still speaking** — `AVSpeechSynthesizer` is not stopped by presenting a
      system dialog — which is the app talking over the OS. If stop fires at the
      tap, a permanently-denied user loses the sentence and gets no mic in
      exchange, with AC-9's "never resumed" making the loss final. Separately, with
      no ordering rule the implementer will stop and start in the same tick;
      activating a record category while the synthesizer is still tearing down can
      fail, and the user's tap then does nothing observable.
    would_not_be_a_finding_if: >
      AC-9 defined activation as the tap itself (or as capture actually beginning)
      and stated what happens to the utterance in the branches where listening
      never starts, plus required capture-start to wait on the stop's completion
      callback.
    directive: >
      Define "activating the mic" against F-003's actual tap outcomes, and add the
      ordering: stop → stop completes → capture starts. The Test strategy already
      declares a completion callback on the port; make an AC depend on it.

  - id: F5
    severity: MEDIUM
    acs: [AC-7, AC-10]
    claim: >
      One event source is split across two ACs with different platform tags and a
      different enumeration. `AudioInterruptionReason` (src/assistant/mobile/model/lifecycle.ts:70)
      is a deliberately exhaustive union — `call | system-assistant | focus-loss |
      route-change` — whose comment states "an unlisted kind cannot silently take a
      different path". AC-10 (`mobile`) lists the first three; route-change lives in
      AC-7 (`ios, android`). All four arrive through the same
      `lifecycle.onAudioInterruption` callback.
    consequence: >
      `onAudioInterruption` currently handles all four identically. Talk-back's
      handler must now treat one member differently from its three siblings on the
      strength of two ACs that never reference each other, and the two ACs carry
      different platform tags for what is one code path. This is L-005's shape
      arriving pre-built: one obligation, two doors, and only one of them named in
      each AC.
    would_not_be_a_finding_if: >
      AC-10 enumerated all four reasons (or explicitly deferred route-change to
      AC-7 by name), so that a reader of either AC sees the full set.
    directive: >
      Make AC-10 cite the same four reasons as F-003 AC-7 and state which are
      route-change and therefore also governed by AC-7, or move the headphone
      clause into AC-10 and leave AC-7 to silence/ringer only.

  - id: F6
    severity: MEDIUM
    acs: [AC-12, AC-13]
    claim: >
      Android reports language availability three ways — available, *missing data
      but downloadable*, and not supported — and the declared
      `speech.capability` shape (`{synthesis_available, voice_for_lang}`) has two
      booleans, so the app cannot represent the middle state. F-003 AC-4 requires
      the exactly analogous recognition case ("recognizer present, no pack for the
      interface language") to be the transient case with the cause stated; AC-13
      requires the synthesis case to be silent with no error surfaced.
    consequence: >
      On a device whose voice data is merely not downloaded, mobile talk-back is
      dead with the control visible and reading "on" — which is AC-12's own
      definition of a dead control, the thing it says to avoid by hiding. Two
      sibling specs then give opposite answers for the same platform fact on the
      same device, and neither reader can tell it was deliberate. Also unstated:
      Android's `TextToSpeech` only answers language queries after its async
      `onInit`, so "no voice for the declared language" is not knowable at the
      moment the control is first rendered.
    would_not_be_a_finding_if: >
      The spec said the asymmetry with F-003 AC-4 is intentional and why, or
      `speech.capability` carried a third value distinguishing missing-data from
      unsupported, or AC-12's hide rule explicitly covered `voice_for_lang: false`.
    directive: >
      State whether a missing-but-installable voice is AC-12's hidden case,
      AC-13's silent case, or F-003 AC-4's stated-cause case, and give
      `speech.capability` a shape that can carry the answer. Say when it is
      resolved relative to first render.

  - id: F7
    severity: MEDIUM
    acs: [AC-15, AC-5]
    claim: >
      AC-15 gates utterance *start* on screen-reader state, but names no stop
      condition for a screen reader turned on mid-sentence. Neither AC-5's cancel
      list, AC-6's, AC-7's, AC-9's, nor the User Flow's `X` box
      ("off toggle · newer message · call/focus loss · headphones out · silent")
      includes it, and both platforms push the change as an event
      (`AccessibilityInfo` screen-reader-changed) rather than only at query time.
    consequence: >
      VoiceOver or TalkBack begins reading the newly focused element while the
      app's own utterance continues — the exact double-speaking AC-15 exists to
      prevent, in the one window the AC does not cover. Mobile is default-on, so
      this is reachable by a user enabling a screen reader for the first time
      inside the app.
    would_not_be_a_finding_if: >
      AC-15 listed screen-reader activation among the stop conditions, or stated
      that suppression is evaluated only at utterance start and a sentence already
      in flight is allowed to finish.
    directive: >
      Add screen-reader activation to AC-15's (and the flow diagram's) stop set,
      or state the accepted overlap explicitly.

  - id: F8
    severity: MEDIUM
    acs: [AC-6]
    claim: >
      `## Verification status` lists AC-6 as Node-verifiable, but AC-6 claims the
      setting "survives reload, backgrounding and process kill" — the same
      kill-survival claim F-003 records as device debt, in its own words: "a
      storage write that is never awaited passes every headless test and still
      loses the user's words on a real device."
    consequence: >
      AC-6's box can be ticked green by a `DurableStore` double while the real
      write is never awaited before process death. F-003 protects itself with an
      explicit caveat on ticked ACs; F-002 carries the identical claim with no
      caveat, so the protection does not carry forward.
    would_not_be_a_finding_if: >
      Verification status split AC-6 into its node-verifiable half (off semantics,
      one gesture, immediate stop) and its device half (survives a real kill), as
      F-003's "A ticked box is not a device pass either" paragraph does.
    directive: >
      Move AC-6's kill-survival clause into the device-pass list, or split AC-6.

  - id: F9
    severity: LOW
    acs: [AC-14]
    claim: >
      AC-14 states F-003 AC-12's native announcement is "unchanged, never
      suppressed, never weakened". The shipped mobile controller does suppress it,
      correctly and by design: `MobileAssistantController.syncSession()`
      (src/assistant/mobile/controller.ts:451-458) sets `suppressAnnouncements`
      so restored history is marked announced without being spoken.
    consequence: >
      Read literally by a QA author or a C-check, AC-14 makes an existing,
      intentional F-003 behaviour look like a violation. The intended meaning is
      "never suppressed *by talk-back*", which is not what it says.
    would_not_be_a_finding_if: >
      AC-14 said "never suppressed by talk-back" or referenced the session-read
      suppression as pre-existing and out of its scope.
    directive: >
      Scope AC-14's "never suppressed" to talk-back's own effect.

  - id: F10
    severity: LOW
    acs: [AC-7]
    claim: >
      AC-7's Android clause — "holds transient audio focus rather than ducking
      others indefinitely" — conflates a focus *type* with a focus *release*
      failure, and as written rules out `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`.
    consequence: >
      Ducking transiently is the mode fitted to AC-3's one-sentence utterance; the
      alternative, `GAIN_TRANSIENT`, pauses the user's music once per turn. The AC
      forbids the better option while intending to forbid something else
      (never abandoning focus).
    would_not_be_a_finding_if: >
      AC-7 said the app requests focus with a transient duration and abandons it
      when the utterance ends, without constraining whether others duck or pause.
    directive: >
      Reword to constrain the release, not the ducking.
```

```yaml
checked:                     # examined through the mobile lens, no finding
  - "AC-2 / AC-3 (one sentence per turn, text counterpart): nothing here needs a
     server field or a native capability; composing client-side from turn.outcome
     is implementable on both platforms"
  - "AC-4 (only the turn just issued speaks): the mobile lifecycle case that
     worried me — background while thinking, outcome arrives via the next
     GET /assistant/session — is already covered by the 'history rendered from a
     session read is silent' clause, and F-003's replay path is named explicitly"
  - "AC-5 (slot of size one): AVSpeechSynthesizer.stopSpeaking(.immediate) and
     Android TextToSpeech.stop() both cancel without a queue; no platform
     obstacle to a size-one slot"
  - "AC-11 (connectivity loss mid-sentence): correct on both platforms —
     synthesis is device-local and unaffected by the radio"
  - "AC-15's detection premise: true on both platforms
     (UIAccessibility.isVoiceOverRunning / touch-exploration on Android), so the
     'detectable natively on both' claim holds. Only its mid-utterance timing is
     a finding (F7)"
  - "AC-16 / AC-8 (web-only rows): no mobile instantiation to contradict"
  - "AC-17 (WCAG): the mobile-relevant halves — off and stop reachable on the
     conversation surface, control exposes on/off state — map onto RN
     accessibility props with no platform obstacle; the F-103 device pass is
     already recorded as device debt"
```

**Two notes on scope.** I did not comment on mockups, testids, or any api-contract — none exist at Gate 1. I also did not re-litigate the three named decisions (speaking is not a fifth state; zero server involvement; mobile-on/web-off): all three survive my lens intact, and F1/F2 are about a mechanism the decisions leave open, not about the decisions.

**The one I would fix first** is F3 — it is not a judgement call. The gate that defers `tapMic()` is code already on disk, and AC-9's "immediately" is the feature's only interrupt promise.

```yaml
evidence:
  inputs_read:
    - .claude/agents/_ethos.md
    - .claude/agents/_completion-protocol.md
    - .claude/agents/_spec-review-protocol.md
    - specs/_shared/LEARNINGS.md
    - specs/assistant/F-002-talk-back.md
    - specs/assistant/F-003-mobile-surface.md
    - src/assistant/mobile/ports/transcript-source.ts
    - src/assistant/mobile/ports/native/rn-transcript-source.ts
    - src/assistant/mobile/controller.ts
    - src/assistant/mobile/ports/app-lifecycle.ts     # not in briefing; read to
    - src/assistant/mobile/model/lifecycle.ts         # confirm F5's union is
    - src/assistant/_shared/controller.ts             # exhaustive and F3's gate
  ac_coverage:
    AC-1:  "examined — F1 (earpiece route defeats the eyes-free acceptance test)"
    AC-2:  "examined — no finding (checked list)"
    AC-3:  "examined — no finding (checked list)"
    AC-4:  "examined — no finding (checked list)"
    AC-5:  "examined — F7 (stop set omits screen-reader activation); otherwise sound"
    AC-6:  "examined — F8 (kill-survival mis-listed as node-verifiable)"
    AC-7:  "examined — F1 (ios category), F2 (android ringer/DND), F5, F10"
    AC-8:  "examined — web-only, no mobile instantiation"
    AC-9:  "examined — F3 (foregroundSync gate), F4 (what counts as activation)"
    AC-10: "examined — F4, F5"
    AC-11: "examined — no finding (checked list)"
    AC-12: "examined — F6 (dead control when voice_for_lang is false)"
    AC-13: "examined — F6 (Android three-way availability vs two booleans)"
    AC-14: "examined — F9 (collides with existing syncSession suppression)"
    AC-15: "examined — F7"
    AC-16: "examined — web-only, no mobile instantiation"
    AC-17: "examined — no finding (checked list)"
  commands_run:
    - cmd: "grep -n \"tapMic\\|surface\\s*=\\|'listening'\" src/assistant/_shared/controller.ts"
      exit: 0
      result: "6 matches; located the shared tapMic at :204 to confirm F3's override chain"
  artifacts_written: []
  unresolved:
    - "tradeoff:read-beyond-briefing — I opened three files the briefing did not
       list (app-lifecycle.ts, model/lifecycle.ts, _shared/controller.ts). F3 and
       F5 are claims about code, and asserting them from the briefing's four files
       alone would have been reasoning about source I had not read."
    - "tradeoff:platform-knowledge — F2's DND half rests on Android behaviour I
       know but did not verify on a device: ringer mode does not silence the media
       stream (high confidence), and DND's effect on media varies by version and
       user setting (lower confidence). The finding's directive survives either
       way, since it asks the spec to name a mechanism rather than to pick mine."
    - "tradeoff:no-artifacts — a review dispatch writes nothing; per
       _spec-review-protocol.md this is the expected shape, not a failed dispatch."
links_to_record: {}
memory_read: "none relevant"
```

---METRICS---
status: DONE
confidence: MEDIUM
lens: dev-mobile
round: 1
findings_high: 3
findings_medium: 5
findings_low: 2
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17]
blockers: []
bugs_filed: []
