<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 1, tester-mobile lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a132e75ef4bc041e4 -->

I read the required protocol files, `LEARNINGS.md` (L-001…L-008), the F-002 spec, F-003's spec and mobile QA index, and `platform/mobile.md`. I wrote no files. Findings below.

---

## Lens: tester (mobile) — F-002 talk-back, Gate 1 round 1

**Headline:** the `## Verification status` list is **complete in coverage** (all 17 ACs are allocated: 11 node, 5 device, AC-8 by inspection — nothing is silently unaccounted for) but **not honest in structure**. F-003's list had *three* categories; F-002's has two. The missing third — *node-listed ACs that carry device residue on top of a real node half* — is the category F-003 called out explicitly ("A ticked box is not a device pass either"), and it is where AC-6, AC-9, AC-5 and AC-13 belong. The list also over-allocates in the other direction: AC-10 is 100% device, while its own mirror (F-003 AC-7) was node-verified with residue.

### What a node tier can actually establish, per the four items the briefing named

| Item | Node tier **can** establish | **Only** a device can |
|---|---|---|
| iOS silent switch · Android ringer/DND (AC-7) | that the model has no "silent" input it gates on, and that the port was asked for a specific category/usage value | that the chosen category/usage is one the hardware switch and the notification policy actually silence — **and that speech is audible with the switch off**, the positive control without which the test is vacuous |
| Headphone removal mid-sentence (AC-7) | that a route-change event delivered through `AppLifecycle` stops the utterance and clears the size-one slot | that the OS emits that event on removal, that the app's stop wins the race against iOS's default re-route, and that **nothing came out of the external speaker in the interval** |
| A real interrupting call (AC-10) | everything but one clause: stop-on-interruption, **no resume on return**, mic available without re-prompt, slot cleared — the same assertions F-003 AC-7 already made with the `AppLifecycle` double | that the OS emits an interruption for a real call, that the session was released far enough for the caller's audio to play, and that focus return does not re-prompt for permission |
| Screen-reader coexistence (AC-15) | that when the capability probe reports SR active *at utterance time*, no utterance is requested, and the stored preference is unchanged | that RN's SR signal is true for the specific service under test on each platform, and that nothing doubles when both speak |

### Findings

```yaml
findings:
  - id: F1
    severity: HIGH
    acs: [AC-5, AC-6, AC-9, AC-13]
    claim: >
      The Verification status list is binary (node-verifiable OR needs-a-device) where
      F-003's is three-way, so four ACs listed as node-verifiable carry device halves
      that now have no owner: AC-6's "survives process kill" is verbatim the claim
      F-003 named its highest-value device debt (item 3); AC-9's "no remaining audio
      after the tap" and AC-6's "stops that sentence immediately" are TTS-engine flush
      semantics (stopSpeaking at .immediate vs .word boundary) with no stated time
      bound; AC-9's "the mic is never open while the speaker is playing" is an audio-
      session hardware state, not a model invariant; AC-5's "two voices never overlap"
      depends on whether the platform cancel is synchronous; AC-13's silent path
      depends on the device's actual voice inventory.
    consequence: >
      A green node run will be read as "AC-6 verified" — which is precisely the false
      claim F-003 spent its Verification status section preventing. The kill case is
      the same one F-003 called out: an async write that is never awaited passes every
      headless test and loses the user's setting on a real device.
    would_not_be_a_finding_if: >
      The list carried F-003's third category (node half proven, device residue named)
      and placed AC-5, AC-6, AC-9 and AC-13 in it, or the device-debt list in the QA
      folder already enumerated these residues.
    directive: >
      Add the third category, list these four in it with the specific residue each
      carries, and state — as F-003 does — that "node-verifiable" there means the node
      half is proven, never that the AC is verified.

  - id: F2
    severity: MEDIUM
    acs: [AC-10]
    claim: >
      AC-10 is allocated wholly to the device column, but three of its four clauses are
      exactly what F-003 AC-7 verified headlessly with the AppLifecycle double: stop on
      interruption, no resume on focus return, mic returns available without
      re-prompting. Only "the interrupting app is not blocked" needs a device.
    consequence: >
      The no-resume clause — the one clause an implementer can get wrong in pure model
      code, and the one that distinguishes this feature from a resume-where-cut feature
      it explicitly does not ship — gets no test at all until a device pass that F-003's
      record shows may never happen. The mirrored AC on the same port ends up with
      strictly weaker coverage than the original.
    would_not_be_a_finding_if: >
      AC-10 appeared in both columns with its clauses split, or F-003 AC-7 had also been
      classified device-only.
    directive: >
      Split AC-10: node-verifiable for stop / no-resume / mic-available / slot-cleared;
      device for audio-session release observed against a real interrupting call.

  - id: F3
    severity: HIGH
    acs: [AC-15, AC-5, AC-6, AC-9, AC-7]
    claim: >
      AC-15 governs only the start of an utterance ("while a screen reader is active …
      produces no utterance"). Every enumerated stop trigger — the User Flow's X box,
      AC-5, AC-6, AC-7, AC-9 — lists off toggle, newer message, call/focus loss,
      headphone removal and silence, and never lists "a screen reader became active".
      A user enabling VoiceOver or TalkBack mid-sentence (triple-click, shortcut, the
      exact moment they need it) leaves the app speaking over the screen reader.
    consequence: >
      The one outcome AC-15 exists to prevent — the app and the screen reader talking
      at once — is reachable, and reachable specifically for the user AC-15 protects.
      This is L-005's shape: one obligation, two doors into the same room, and the
      guard standing at only one of them.
    would_not_be_a_finding_if: >
      Any stop-trigger list included screen-reader activation, or AC-15 said the
      suppression applies continuously to an utterance in flight rather than at
      request time.
    directive: >
      State that a screen-reader-active transition stops an in-flight utterance, and add
      it to the User Flow's stop set so the trigger enumeration stays one list.

  - id: F4
    severity: HIGH
    acs: [AC-4]
    claim: >
      "The current foreground session" is undefined for the mobile lifecycle F-003 AC-6
      owns. A turn issued, then backgrounded while thinking, whose outcome resolves and
      renders on return, is neither a session read nor served with replayed: true — so
      by AC-4's text it speaks. The Out of Scope rationale asserts the opposite ("AC-4's
      'only the turn just issued' already means the user is present when it starts"),
      which is false for exactly this path.
    consequence: >
      Unsolicited audio on reopening the app — which AC-4 itself calls "exactly the
      unintended speech AC-6 forbids". An implementer reading the Out of Scope rationale
      concludes no guard is needed, so the defect ships with a spec sentence behind it.
      Mobile is the only platform where this path is routine (F-003 AC-6 is entirely
      about it).
    would_not_be_a_finding_if: >
      AC-4 defined a foreground session boundary (e.g. speech is eligible only while the
      app has stayed foregrounded since the turn was issued), or named the
      background-then-return in-flight outcome as silent alongside replayed: true.
    directive: >
      Define the eligibility window in AC-4 in terms of an uninterrupted foreground
      period, and correct the Out of Scope rationale, which currently guarantees a case
      it does not cover.

  - id: F5
    severity: HIGH
    acs: [AC-7, AC-12, AC-13, AC-15]
    claim: >
      Four ACs specify the same observable — no sound — for four different reasons
      (OS silenced it, no synthesis capability, no voice for the language, screen reader
      active), and a fifth cause (the feature is simply broken) produces it too. The Ops
      section names per-cause counters that would discriminate them, but declares them
      in-process with no exporter (ADR-001), so on the tier where these ACs are actually
      judged — a manual device pass — the discriminator is unreadable. AC-7 additionally
      states no acceptance method and no positive control: it is the only prohibition
      about sound escaping to a speaker and its passing condition is silence.
    consequence: >
      Every one of these device ACs is satisfied by a build that never speaks at all.
      That is the Gate-3 M1 shape already recorded in the F-003 QA index — a constant
      compared with itself — moved from a test file into the spec, where no mutation
      check will find it. AC-7's headphone case is worse than vacuous-pass: its failure
      window is sub-second and its failure mode is private content played aloud in
      public, with no stated instrument for catching it.
    would_not_be_a_finding_if: >
      AC-7 named its acceptance method (a paired positive control — audible with the
      switch off, silent with it on — plus how leakage on route change is captured), or
      the Ops counters were reachable on a device build so a tester could tell which
      suppression fired.
    directive: >
      Give AC-7 an explicit method with a positive control, and make the suppression
      counters readable in a device build (a debug surface is enough) so "no sound" can
      be attributed to a cause rather than assumed.

  - id: F6
    severity: MEDIUM
    acs: [AC-10, AC-7]
    claim: >
      AC-10 is tagged (mobile) while its sibling AC-7 is correctly split (ios, android),
      yet AC-10's content is where the two platforms diverge most: "audio focus" is an
      Android concept with three loss kinds, iOS delivers AVAudioSession interruption
      began/ended with a shouldResume hint, and "releases the audio session" is
      setActive(false) on one and abandonAudioFocus on the other. AUDIOFOCUS_LOSS_
      TRANSIENT_CAN_DUCK — a duck, not a loss — has no specified outcome at all.
    consequence: >
      The spec's own Composition table states the rule this breaks: "every divergence is
      forced by a platform capability and is tagged ios/android rather than hidden under
      mobile". Under one tag, QA writes one test, and the ducking case (common on
      Android: a notification chime) gets neither a specified behaviour nor a test.
    would_not_be_a_finding_if: >
      AC-10 were tagged ios and android with per-platform clauses, or it stated that
      ducking is treated as a loss (or as no event) for this feature.
    directive: >
      Split AC-10 by platform as AC-7 already is, and say what a duck-request does.

  - id: F7
    severity: MEDIUM
    acs: [AC-7]
    claim: >
      AC-7's Android half — "respects the ringer/DND state" and "holds transient audio
      focus rather than ducking others indefinitely" — names no test matrix and no
      preconditions. Android's ringer has silent/vibrate/normal and DND has several
      policy modes, and TTS output on the media stream is silenced by none of them by
      default; which usage/stream the app publishes on decides the whole AC. Open
      Question 5 flags exactly this as a blocking pre-implementation check for the iOS
      category and omits the Android usage/stream, though it is the same class of
      blocker. The focus clause additionally needs a second app producing audio, which
      is never named as a precondition.
    consequence: >
      A device pass will test one ringer state, pass, and tick an AC whose other states
      were never reached — and the module choice that decides all of them will have been
      made without the check OQ-5 makes mandatory for iOS.
    would_not_be_a_finding_if: >
      AC-7 enumerated the ringer/DND states it must hold across, or OQ-5 covered the
      Android usage/stream alongside the iOS category.
    directive: >
      Enumerate the Android ringer/DND states in AC-7, name the second-app precondition
      for the focus clause, and extend OQ-5 to the Android side.

  - id: F8
    severity: MEDIUM
    acs: [AC-15]
    claim: >
      AC-15 treats "a screen reader is active" as one capability "detectable natively on
      both platforms". The primitives are not equivalent: iOS VoiceOver is a single
      boolean, while the Android signal is touch-exploration state, which is neither
      necessary nor sufficient for "a screen reader is speaking" — Select-to-Speak and
      Voice Access do not set it, and a TalkBack user on a braille display sets it while
      producing no speech at all.
    consequence: >
      On Android the suppression both over-fires (a braille-output user loses talk-back
      with no way to re-enable it, since AC-15 forbids writing the preference) and
      under-fires (a spoken-feedback service that does not enable touch exploration gets
      doubled audio, which is the failure AC-15 exists to prevent). A device pass that
      does not name which service it tested with proves nothing about the general claim.
    would_not_be_a_finding_if: >
      AC-15 named the detection primitive per platform and scoped its claim to the
      services that primitive actually covers.
    directive: >
      Name the per-platform signal in AC-15 and state which Android services the device
      pass must exercise.

  - id: F9
    severity: MEDIUM
    acs: [AC-1]
    claim: >
      AC-1 is the only AC carrying a stated acceptance method, and the method is not
      runnable as written: it needs a listener who does not already know the task list,
      a device whose voice speaks the interface language (the product ships Vietnamese
      per F-003's QA index, while the spec's example strings are English concept names),
      and a pass threshold ("recounts correctly" — how many listeners, how many turns,
      what counts as correct).
    consequence: >
      The AC that is the point of the feature is the one whose device pass a tester
      cannot construct or score, so it will either be skipped or ticked on a
      self-administered read-along, which tests nothing.
    would_not_be_a_finding_if: >
      AC-1 stated the listener's language and prior-knowledge condition and a pass
      criterion, or pointed at a run template that does.
    directive: >
      State the preconditions and the pass threshold in AC-1 alongside the existing
      cover-the-screen method.

  - id: F10
    severity: MEDIUM
    acs: [AC-11]
    claim: >
      AC-11 states "synthesis is device-local" as a platform fact rather than a
      constraint on the implementation. It is not universally true on Android, where
      voices can be network-required (Voice.isNetworkConnectionRequired) and the
      high-quality defaults historically were. Nothing in AC-13 (which declares a
      language, not a voice) or in the port design forces a locally-installed voice.
    consequence: >
      On a device using a network voice, airplane mode mid-sentence cuts the utterance
      dead — the exact behaviour AC-11 promises does not happen — and the node tier
      cannot see it, because the double is local by construction. The AC sits in the
      node-verifiable column where it is trivially satisfied.
    would_not_be_a_finding_if: >
      AC-11 required the synthesis port to select a voice that does not require network,
      or scoped its guarantee to locally-installed voices.
    directive: >
      Turn AC-11 into a constraint on voice selection, and move its device half into the
      residue category F1 asks for.

  - id: F11
    severity: MEDIUM
    acs: [AC-13, AC-12]
    claim: >
      AC-13's silent-rather-than-mis-speak path has no constructible device precondition:
      the spec never says how to produce a device that declares the interface language
      and has no voice for it. On Android this is not an exotic configuration — Vietnamese
      TTS data is a downloadable pack frequently absent on a device whose system locale is
      not Vietnamese, and F-003 Open Question 2 (minimum supported OS versions) is still
      open, so nobody has established the voice floor.
    consequence: >
      Mobile ships talk-back on by default (AC-15 rationale) into a population where the
      likely outcome on some Android devices is permanent silence with no error surfaced
      and the control still visible (AC-12 hides only on missing synthesis capability,
      not on missing voice) — indistinguishable, per F5, from every other silence.
    would_not_be_a_finding_if: >
      AC-13 named how the no-voice device is constructed for the device pass, or the
      spec stated a voice-availability floor for the supported OS versions.
    directive: >
      Name the construction method for the no-voice case, and resolve whether a missing
      voice should be visible to the user differently from a missing capability.
```

### Checked, nothing found

```yaml
checked:
  - "AC coverage of the Verification status list: all 17 ACs are allocated (11 node, 5 device, AC-8 by inspection) — nothing is silently unlisted"
  - "AC-4 correctly names the F-003 AC-6 kill-replay path (replayed: true) as silent — the mobile-specific case is handled, and handled by citing the upstream AC rather than restating it"
  - "AC-2's 'never by reading the rendered text verbatim' plus the Test strategy's parse-components.md-per-row-id rule is L-008's technique applied correctly; it is node-assertable in the direction drift travels"
  - "AC-14's node entry is honestly narrowed in the list itself ('that the announcement call still happens') rather than claimed whole"
  - "AC-3's countable acceptance (one turn = one utterance = one sentence) is assertable through the size-one slot; the 'what stands out' half is correctly left to an eval scenario"
  - "AC-9's exclusivity is required to be asserted from both directions as two structurally different tests, with a double whose stop callback never fires — that is L-005 and L-006 applied by the spec itself, and is the strongest paragraph in the Test strategy"
  - "AC-12's capability-not-platform-name rule reuses F-001 AC-20's shape; no platform-name branch is implied anywhere in the mobile ACs"
  - "AC-17's mobile instantiation of WCAG 1.4.2 is coherent with AC-15 (no speech under a screen reader, so the off control's reachability matters only for non-SR users) and is correctly placed in the device column"
  - "No mobile AC requires a simulator or emulator in the unit tier, so platform/mobile.md's no-simulator rule is not violated by any AC as written"
  - "AC-8 and AC-16 are web-tagged and were not examined under this lens"
```

`acs_covered` is 15 of 17: AC-8 and AC-16 are web-only and carry no mobile instantiation, so a mobile-tester lens has nothing to say about them beyond confirming that.

---METRICS---
status: DONE
confidence: HIGH
lens: tester-mobile
round: 1
findings_high: 4
findings_medium: 7
findings_low: 0
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-17]
blockers: []
bugs_filed: []
