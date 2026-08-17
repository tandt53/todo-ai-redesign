<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 1, dev-web lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a3746e19fbf8f900a -->

I read all four required files, the spec, and the four briefed source files. Findings below — I wrote nothing.

## Findings

```yaml
findings:
  - id: F1
    severity: HIGH
    acs: [AC-13]
    claim: >
      AC-13 requires every utterance to declare "the interface language" in BCP-47,
      but no artifact says where that value comes from, and the code already holds
      three conflicting answers.
    consequence: >
      The web client has to pick one at build time. The three candidates in the repo
      disagree: web recognition uses `navigator.language || 'en-US'`
      (web/ports/web-speech-source.ts:50), mobile recognition hardcodes `'vi-VN'`
      (mobile/ports/native/rn-transcript-source.ts:71), all shipped copy is Vietnamese
      (_shared/model/messages.ts, design/_shared/components.md), and format.ts pins
      `'en-US'` for every date/clock. A web client that resolves "interface language"
      as navigator.language will declare `en-US` on an English-locale machine and hand
      a Vietnamese sentence to an English voice — which is exactly the "wrong-language
      voice is harder to understand than no voice" failure AC-13 exists to prevent, and
      it ships as the *default* on web while mobile is unaffected. Earliest catch is a
      human listening to a device (AC-1), i.e. after both clients are built.
    would_not_be_a_finding_if: >
      The spec named the source of the language value — a `client.locale` row in ## Data,
      or "the app's copy language, currently vi-VN, is the declared language on both
      clients" — or Open Question 2 covered the *source* rather than only mixed-language
      sentences.
    directive: >
      Add the language value as a declared client-local field with one source of truth for
      both clients, and an AC constraining it, or state explicitly that it is the copy
      language of design/_shared/components.md and not the device locale.

  - id: F2
    severity: HIGH
    acs: [AC-2, AC-4]
    claim: >
      AC-2 defines the speakable set as messages "composed client-side from that message's
      `turn.outcome`", but five of the ten rendered message kinds have no `turn.outcome`,
      and one kind has it only sometimes.
    consequence: >
      The web client cannot decide which messages speak. Concretely, from
      _shared/types.ts and _shared/model/messages.ts: `error` (a failed turn has
      `turn.outcome === null`; the message is built from `turn.status`), `reverted`
      (built from `UndoOutcomeWire` — `TurnResponseWire.kind: 'turn' | 'undo'`, and an
      undo response carries `undo`, never `turn.outcome`), `boundary`, `info`
      (client-generated permission/transient guidance) and `user` all fall outside AC-2
      as written. Worse, `question` is rendered by two structurally different paths —
      `outcome.kind === 'question'` and `outcome === null && status === 'asked'` — so the
      *same on-screen message* speaks or stays silent depending on which server path
      produced it. Two of the excluded cases are the ones AC-1 most needs: a voice undo
      ("Đã hoàn tác — trừ 2 việc") and an AI error ("Chưa gửi được") are precisely what a
      user who is not looking at the screen has to hear. The gap is invisible at Gate 2
      because every included case will be covered and the coverage matrix will read full.
    would_not_be_a_finding_if: >
      The spec enumerated which message kinds speak (by the Conversation-model kind list
      F-001 already fixes), or AC-2 said "the message rendered for a turn the user issued"
      rather than naming `turn.outcome` as the sole input.
    directive: >
      Replace "from that message's `turn.outcome`" with an explicit per-kind table over
      F-001's message list — speaks / silent — including the undo (`reverted`) and error
      kinds, and resolve the question-message double provenance to one answer.

  - id: F3
    severity: HIGH
    acs: [AC-3, AC-2]
    claim: >
      "## Speaking in the conversation model" mandates literals cited by row id and
      "never an interpolating template" (L-008), while AC-3 requires a sentence carrying
      a count and a data-derived standout ("five tasks tomorrow, earliest nine").
    consequence: >
      These cannot both hold — a literal cannot carry "five" or "nine". The web
      implementer must choose, and either choice violates a written instruction: pure
      literals make AC-3 unimplementable, a free template is the thing L-008 was written
      to forbid. The existing precedent in `format.ts appliedHead()` is a third thing
      neither rule describes: fixed literal frames with a strictly enumerated numeric slot
      ("Đã sửa {n} việc"). The Test strategy compounds it by promising a test that
      "requires every spoken string to exist as a literal" — a test that cannot pass
      against any sentence containing a count.
    would_not_be_a_finding_if: >
      The spec distinguished interpolating the *varying category* (L-008's actual target —
      the case nobody enumerated) from filling enumerated numeric slots in a fixed literal
      frame, and named the permitted slot set.
    directive: >
      State the composition rule precisely: literal frames per message kind cited by row
      id, with an enumerated, closed slot list (count, one title, one time), and restate
      the AC-2 literal-assertion test as "every frame appears literally".

  - id: F4
    severity: HIGH
    acs: [AC-13, AC-12]
    claim: >
      `speech.capability.voice_for_lang` cannot be resolved on web at the moment AC-13
      needs it: `speechSynthesis.getVoices()` returns an empty array until the voice list
      loads asynchronously, and the `voiceschanged` event does not fire in engines where
      the list was already populated.
    consequence: >
      "No voice for the declared language" and "the voice list has not loaded yet" are
      the same observable, and AC-13's response to both is silence with no error. On
      Chromium the first turn after a page load therefore lands in the window where
      getVoices() is empty, so the feature's very first utterance — the one that tells
      the user it works — is dropped, silently and by spec. The Data table's
      "resolved at runtime by capability probe, re-resolved on foreground" describes a
      synchronous probe that the web platform does not offer for this half; the other
      half (`synthesis_available`) *is* synchronous, so one field with two resolution
      timings hides the problem.
    would_not_be_a_finding_if: >
      The spec gave `voice_for_lang` a third value (unresolved) with a stated behaviour —
      e.g. speak with the engine default and let the browser pick, or hold the utterance
      until the list resolves, or treat unresolved as speakable — or stated that
      voice availability is not probed at all on web.
    directive: >
      Split the capability row into a synchronous availability flag and an
      asynchronously-resolved voice flag with an explicit third state, and add an AC
      constraining what happens to a turn that arrives before it resolves.

  - id: F5
    severity: MEDIUM
    acs: [AC-16, AC-8, AC-12]
    claim: >
      The spec assumes the opt-in gesture (AC-16) is sufficient consent, but the platform
      requirement it collides with is a per-call one: WebKit/iOS Safari drops
      `speechSynthesis.speak()` that is not reached from a user-gesture call stack, and
      every talk-back utterance is issued from a network callback after the turn resolves,
      never from the tap.
    consequence: >
      On Safari and iOS browsers, talk-back can be enabled, report `synthesis_available:
      true`, show an enabled control, and produce no sound — and the failure is
      indistinguishable from AC-13's deliberate silence, so AC-12's "no error surfaced"
      rule actively hides it. The same gap leaves the Ops counters unable to separate
      "utterance started" from "utterance requested and dropped by the engine", which is
      the one stop-reason the caller cannot attribute itself.
    would_not_be_a_finding_if: >
      An AC required the enable gesture to perform the platform's audio unlock (the
      empty-utterance-inside-the-gesture pattern), or the spec stated that web talk-back is
      best-effort on gesture-restricted engines and named the observable.
    directive: >
      Add a web AC covering the unlock at enable time, and give the SpeechOutput port an
      end-reason vocabulary (finished / cancelled / never-started) rather than a bare
      completion callback, so a dropped utterance is countable.

  - id: F6
    severity: MEDIUM
    acs: [AC-6, AC-8]
    claim: >
      Out of Scope rejects "letting an in-flight sentence finish after backgrounding" and
      the User Flow lists "focus loss" as a stop trigger, but the only ACs that instantiate
      it are AC-7 (ios, android) and AC-10 (mobile); AC-8 waives web's OS-silence guarantee
      entirely. No web AC stops an utterance on tab hide or focus loss.
    consequence: >
      `speechSynthesis` keeps speaking from a hidden tab — the browser does not stop it —
      so on web the rejected behaviour is the default one, and it is worse than on mobile:
      a voice from one of twenty background tabs with no visible source and no control in
      view. The decision exists, is written down as rejected, and has nothing enforcing it
      on the platform where it is most disorienting.
    would_not_be_a_finding_if: >
      A `(web)`-tagged AC required a visibility/pagehide change to stop the utterance, or
      the spec stated that web deliberately lets a backgrounded sentence finish.
    directive: >
      Add the web instantiation of the stop-on-focus-loss rule, or record in AC-8 that web
      does not have it and why.

  - id: F7
    severity: MEDIUM
    acs: [AC-5, AC-9]
    claim: >
      AC-5 is listed as node-verifiable, but the browser sequence it mandates —
      `cancel()` immediately followed by `speak()` — is the sequence Chromium is known to
      drop, and `cancel()` reports its end inconsistently (`end` in some engines,
      `error: 'canceled' | 'interrupted'` in others).
    consequence: >
      A `SpeechOutput` double with an injectable completion callback will pass AC-5 and
      AC-9 in node while the real browser silently swallows the replacing sentence — the
      classic shape of L-002 and L-003: a green tier that was never pointed at the
      observable. Verification status will read "AC-5 covered" for the whole feature.
    would_not_be_a_finding_if: >
      Verification status moved the cancel-and-replace half of AC-5 to the device/browser
      list alongside AC-7 and AC-10, or named the browser-level check that settles it.
    directive: >
      Reclassify the cancel-then-replace observable as browser-verified, and require the
      port's end signal to distinguish finished from cancelled so AC-9's "never resumed"
      has an assertable observable.

  - id: F8
    severity: MEDIUM
    acs: [AC-2, AC-3]
    claim: >
      AC-2 says the spoken sentence is "composed client-side" but never says whether that
      is one composer shared by both clients or one per client.
    consequence: >
      The on-screen composer is already shared — `_shared/model/messages.ts` and
      `format.ts` build every message for web and React Native alike, which is what makes
      F-003 AC-1's no-fork rule enforceable. If the spoken composer is written per client,
      two clients will compose two different sentences from the same `turn.outcome` and
      nothing will detect it: the parity suite compares surfaces, not utterances, and
      F-003 AC-1 has no enforcement point for a fact that lives in two files (L-004 is
      this repo's own record of that shape). The port half has a settled precedent —
      `TranscriptSource` is in `_shared/ports/` with a web backing and a mobile backing —
      but a composer is model code, not a port, so the precedent does not answer it.
    would_not_be_a_finding_if: >
      The spec said the spoken sentence is composed once from the same input the on-screen
      message is composed from, with only the synthesis backing per-client.
    directive: >
      State "one composer, two renderings" explicitly in ## Speaking in the conversation
      model — same input as the on-screen builder, per-client code limited to the
      SpeechOutput backing.
```

## Checked, nothing found

- **AC-4's silence conditions are all knowable to the web client.** `replayed` is on the wire (`TurnResponseWire.replayed`, `_shared/types.ts:51`), and session-read history arrives through a structurally separate path (`sessionMessages` vs `turnOutcomeMessages`), so "current foreground session, not a session read, not replayed" is decidable without a new field.
- **AC-6's persistence is buildable on web** — `client.speech_prefs` sits beside the existing client stores and the `durable-store.ts` port already backs them; reload survival is localStorage-shaped, and process kill is not a distinct web case.
- **AC-11 is trivially true on web** — `speechSynthesis` is device-local; no network path exists to cut.
- **AC-12's "hidden, not disabled" is implementable on web** — `'speechSynthesis' in window` is a synchronous, non-sniffing probe, matching F-001 AC-20's rule. (Its second half, voice availability, is F4.)
- **AC-9's mutual exclusivity does not contradict the web platform** — recognition and synthesis are independent objects, so stopping one before starting the other is a client-side sequencing rule, not a platform fight.
- **AC-14 is unaffected on web** — the live region is DOM, orthogonal to the synthesis API, and nothing in this feature routes through it.
- **AC-17's keyboard operability is available** — the off toggle and the mic are ordinary focusable controls; F-001 AC-19 already requires it.
- **AC-1, AC-7, AC-10, AC-15 have no web instantiation** to assess from this lens (device/native-only or explicitly waived by AC-8/AC-16); I examined them only for spillover onto web and found none.

---METRICS---
status: DONE
confidence: HIGH
lens: dev-web
findings_high: 4
findings_medium: 4
findings_low: 0
round: 1
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17]
blockers: []
bugs_filed: []
