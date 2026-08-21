<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 1, tester-web lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a558c498f6093e9ce -->

I have completed the required reads and the review. Returning findings only — no files written.

## Gate 1 — F-002 talk-back · lens: **tester (web)** · round 1

**Scope examined:** all 17 ACs. Web-tagged: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-11, AC-12, AC-13, AC-14, AC-16, AC-17 (14). AC-7 (ios, android), AC-10 (mobile), AC-15 (ios, android) were read only for composition — they are the mobile lens's to assess.

```yaml
findings:
  - id: F1
    severity: HIGH
    acs: [AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-12, AC-13]
    claim: >
      The Test strategy declares the SpeechOutput port entirely in terms of what a
      test injects (capability, voice list, completion callback, an inert stop
      callback) and never says what the double records. Every AC above needs an
      observable of what was *spoken* or *stopped*, and the only thing the spec
      declares is `speech.utterance` — a client-local model field with
      `{message_id, text, lang, started_at}` and no stop or end.
    consequence: >
      With the stop callback deliberately made inert (the L-006 construction the
      Test strategy itself prescribes for AC-9), the sole remaining observable for
      "the sentence stopped immediately" is the model clearing its own slot. That
      cannot distinguish "the platform was told to stop" from "we forgot the
      platform and cleared our field" — the exact failure L-002 names, and the one
      a user hears as audio that keeps playing after the tap. The same field cannot
      express AC-6's "nothing is synthesised at all — not synthesised-and-muted",
      AC-13's silence-instead-of-wrong-voice, or AC-4's "renders silently", all of
      which are claims about a call that must *not* have happened. The spec's own
      Ops section is the proof this is missing: it asks for counters of utterances
      "stopped by mic tap" vs "stopped by OS silence" vs "suppressed for missing
      capability or voice" — four distinct stop/suppress reasons that no declared
      field or port surface can currently tell apart.
    would_not_be_a_finding_if: >
      The Test strategy (or ## Data) declared that the port records an ordered log
      of `speak(message_id, text, lang)` and `stop(reason)` calls and stated that
      the ACs' observable is that log rather than `speech.utterance`; or
      `speech.utterance` carried a terminal field (`ended_at` + `stop_reason`) that
      the Ops counters and the stop ACs both read.
    directive: >
      Declare the port's recorded surface, not just its injections: an ordered call
      log of speak(message_id, text, lang) and stop(reason), asserted as the
      observable for AC-4/5/6/9/12/13, plus a stop_reason vocabulary that matches
      the Ops counter list one-to-one.

  - id: F2
    severity: HIGH
    acs: [AC-9, AC-4, AC-5]
    claim: >
      AC-9 states an invariant with two directions — "listening and speaking are
      mutually exclusive" — but specifies the outcome of only one of them. What
      happens when an eligible outcome arrives *while the mic is already open* is
      never stated: suppressed permanently, deferred until listening ends, or
      spoken anyway.
    consequence: >
      This state is reachable on web without any new mechanism. F-001 AC-3 (web) is
      explicit that a cancelled-while-thinking turn still completes server-side and
      its late outcome renders as a message; the user can cancel, tap the mic, and
      be mid-utterance-of-their-own when that message lands. AC-4 permits speaking
      it (the user did issue that turn in this session); AC-9 forbids it. The two
      readings have opposite observables — a speak call that never appears, versus
      one that appears after listening ends — so no test can be written, and the
      Test strategy nonetheless names this exact test as required ("an utterance
      being requested while listening"), meaning the suite will contain an
      assertion whose expected value was chosen by the implementer.
    would_not_be_a_finding_if: >
      AC-9 stated the disposition of an utterance requested while listening —
      dropped (and whether the message keeps its text per AC-5) or queued until
      idle — with a named observable.
    directive: >
      Add one clause to AC-9 fixing the second direction, and say which of AC-5's
      slot semantics apply to it (a suppressed utterance is presumably dropped, not
      queued, since AC-5 already forbids queueing).

  - id: F3
    severity: MEDIUM
    acs: [AC-14, AC-16]
    claim: >
      AC-14 requires F-001 AC-19's live region to be "unchanged, never suppressed,
      never weakened, never conditional on talk-back", but names no observable for
      non-weakening, and AC-16 makes web off-by-default — so nothing ever exercises
      the web surface in the speech-on configuration.
    consequence: >
      All 36 existing F-001 web tests, including the six that carry AC-19
      (TC-021..024, TC-033, TC-034 in `qa/assistant/F-001/web/index.md`), run
      against the default. On web that default is now "speech off", so the single
      most dangerous interaction this feature introduces — a screen-reader user
      receiving the live-region text and the utterance at once, or a live region
      quietly demoted to avoid the doubling — is covered by zero tests in the tier
      that can actually assert it. Mobile gets this coverage for free because its
      default is on; web is the platform where the gap is silent. Verification
      status already lists AC-14 as node-verifiable "(that the announcement call
      still happens)", which is the weaker of the two claims AC-14 makes.
    would_not_be_a_finding_if: >
      AC-14 named its observable as F-001's AC-19 assertions passing with
      `client.speech_prefs.enabled = true`, or the Test strategy stated that the
      web a11y TCs run in both speech configurations.
    directive: >
      Give AC-14 an observable: F-001 AC-19's live-region assertions (announcement
      of every message kind, error announced immediately, focus not moved) hold
      identically with speech enabled and with speech disabled — two runs of the
      same assertions, not one.

  - id: F4
    severity: MEDIUM
    acs: [AC-12, AC-13]
    claim: >
      AC-12 and AC-13 give incompatible readings of the same state. `speech.capability`
      is one object, `{synthesis_available, voice_for_lang}`; AC-12 says detection is
      by `speech.capability` and the control is *hidden*; AC-13 says a missing voice
      for the declared language is *silent with no error* — which presupposes a
      control that is visible and enabled but never produces sound.
    consequence: >
      Hidden and visible are different observables, and a web test must assert one.
      Choosing "visible" makes AC-12's own prohibition true — an on/off control that
      can never produce an utterance is the "dead control" AC-12 forbids. Choosing
      "hidden" contradicts AC-13's premise that the turn goes silent rather than
      erroring. Verification status lists both as node-verifiable, so this will be
      decided by whoever writes the test first.
    would_not_be_a_finding_if: >
      AC-13 stated the control's mode when `synthesis_available` is true and
      `voice_for_lang` is false, or AC-12 scoped its hide rule explicitly to
      `synthesis_available` alone.
    directive: >
      Say which of the two `speech.capability` booleans drives the hide rule, and
      state the control's mode in the synthesis-present / no-voice case.

  - id: F5
    severity: MEDIUM
    acs: [AC-3]
    claim: >
      AC-3 bundles a countable guarantee with an uncountable one and offers a single
      acceptance line for both. "One turn = one utterance" is countable from the
      port; "one sentence", "speaks the count and what stands out", "never a per-row
      reading", "not read field by field" are properties of the copy, and the spec
      routes their verification to "an eval scenario penalises a listing answer" —
      an artifact with no home in this project's harness.
    consequence: >
      The AC will be ticked on the countable half alone, because that is the half
      with an assertion. Worse, the natural reading invites a sentence-counting
      assertion (punctuation) over a shipped Vietnamese literal, which is testing
      source text rather than an observable (L-002). The spec elsewhere already has
      the right mechanism for this: AC-2 and the Test strategy say spoken strings are
      literals cited by row id in `design/_shared/components.md`, parsed by the test
      (L-008) — which makes "one sentence, summary not listing" a constraint on the
      design artifact, verified where it is owned.
    would_not_be_a_finding_if: >
      AC-3 were split into a countable AC (one eligible turn produces exactly one
      speak call) and a copy constraint verified by the parsed-literal check, or the
      "eval scenario" were named as a real, locatable artifact with an owner.
    directive: >
      Split AC-3. Keep the one-utterance-per-turn half as the testable AC; express
      the summarisation half as a constraint on the components.md rows, asserted by
      the same parser AC-2 already requires. Drop or locate the eval scenario.

  - id: F6
    severity: MEDIUM
    acs: [AC-8, AC-5, AC-6]
    claim: >
      The User Flow's stop node lists five triggers — off toggle · newer message ·
      call/focus loss · headphones out · silent — but on web only two of them have a
      web-tagged AC (AC-6, AC-5). Focus loss and page-hidden have no web AC at all,
      and AC-8's web substitute ("any page-level mute or the off control stops it")
      names a trigger the harness cannot drive: a browser tab mute is browser chrome,
      not scriptable from Playwright.
    consequence: >
      Two distinct testability problems. First, a QA agent writing web TCs from the
      flow diagram will assert that hiding the tab or losing window focus stops the
      utterance, and no AC requires it — so the test asserts a behaviour the
      implementer never owed, and the browser-tab case (user tabs away during
      "thinking", the outcome lands two seconds later and speaks into a hidden tab)
      is the cheapest and most common instance of exactly what Out of Scope says the
      feature avoids "because the user is present when it starts". Second,
      Verification status classifies all of AC-8 as "verified by inspection of the
      platform, not by a test" — correct for its absence-of-signal claim, but AC-8
      also contains a positive behavioural claim (page-level mute stops speech) that
      inspection cannot verify and no tier is assigned.
    would_not_be_a_finding_if: >
      A web-tagged clause stated whether a visibility change or window blur stops an
      in-flight utterance, and AC-8's positive stop claim were either given a
      drivable observable or moved out of an inspection-only AC.
    directive: >
      Add web's stop-trigger set explicitly (off control, newer message, mic tap,
      and a stated decision on document visibility / window blur), and separate
      AC-8's untestable-by-design absence claim from any positive claim about what
      stops speech.

  - id: F7
    severity: LOW
    acs: [AC-2]
    claim: >
      AC-2 bundles an observable guarantee (every spoken sentence has a text
      counterpart; muting loses zero information) with a mechanism guarantee
      (composed client-side from `turn.outcome`, "never by reading the rendered text
      verbatim") that has no observable of its own.
    consequence: >
      For a single-task turn where the summary equals the on-screen message, a
      compose-from-outcome implementation and a scrape-the-DOM implementation are
      byte-identical, so the mechanism clause can only be "verified" by reading
      source. The one place the two diverge observably is AC-3's multi-task turn,
      where the spoken summary must differ from the per-row detail on screen — but
      AC-2 does not point at it.
    would_not_be_a_finding_if: >
      AC-2 bound its mechanism clause to the multi-task case where spoken text and
      rendered text must differ, or dropped the clause as an implementation note.
    directive: >
      Keep the observable half in AC-2 (every logged utterance's `message_id`
      resolves to a rendered message); express the mechanism as the multi-task
      divergence assertion rather than a prohibition on how the string was built.

  - id: F8
    severity: LOW
    acs: [AC-6]
    claim: >
      AC-6 requires `client.speech_prefs` to survive "reload, backgrounding and
      process kill" under one web+mobile tag, with no per-platform instantiation.
    consequence: >
      F-001's ## Data was deliberately explicit that the same class of store
      "survives process kill (mobile) and tab close/reload (web: durable browser
      storage)", and F-003 carried the kill half. On web there is no observable for
      "process kill" distinct from reload, so the AC will be ticked on the weaker
      evidence while stating the stronger claim — the pattern F-003's Verification
      status exists to prevent.
    would_not_be_a_finding_if: >
      AC-6 or the ## Data row named web's instantiation (durable browser storage
      across tab close and reload) the way F-001's table does.
    directive: >
      State web's instantiation of persistence separately from mobile's, matching
      F-001's ## Data wording.

checked:
  - "AC-4's silence claims are assertable as absences once F1's call log exists: session-read history, F-001 AC-28's boundary message (constructible on web — F-001 TC-030 does it) and replayed turns (F-001 AC-25's queued replay, TC-029) are all reachable preconditions in the existing web harness."
  - "AC-13's no-voice-for-language precondition is constructible: the Test strategy's injectable voice list supplies it without a real speaker."
  - "AC-12's no-capability precondition is constructible by the same injection, and follows F-001 AC-20's precedent already covered by web TC-025."
  - "AC-11 (connectivity loss mid-sentence does not cut it off) has a clean web observable — offline transition drives no stop call — and reuses F-001 TC-029's offline setup."
  - "AC-9's mic-tap direction has a constructible in-flight precondition: an injectable completion callback that the test never fires keeps an utterance playing deterministically without a speaker."
  - "AC-16's web default-off and the control's description are node-verifiable as stated, via the parsed-literal check AC-2's Test strategy already requires."
  - "AC-1 is honestly classified as device/manual in ## Verification status; no web-tier claim is made for it."
  - "The Composition table's claim that no F-001 or F-003 AC is narrowed holds for every web-tagged F-001 AC I checked — nothing here weakens AC-3, AC-11, AC-19, AC-20, AC-25 or AC-28 as web behaviours."
```

**One cross-cutting note for the orchestrator, outside the finding list:** ## Verification status places all of **AC-17** in the "needs a real screen reader" bucket. Two of the criteria it names are already proven automatically on this project's web tier — 2.1.1 keyboard operability (F-001 TC-021) and 4.1.2 name/role/value (TC-022), both passing in `qa/assistant/F-001/web/index.md`. Deferring them wholesale grows the conditional-acceptance ledger for work the web tier can do today, and risks the automation never being written. AC-17's genuinely manual half is the announced on/off *state* against a real screen reader (W3C F103). Worth splitting when the spec is revised. I did not file this as a finding because it is a classification issue in ## Verification status rather than a defect in an AC, but it is the one thing here I would not want lost.

**Conflict watch (for the escalation rule):** F2 and F4 are both cases where two ACs in this spec give incompatible directives about one state. They are internal contradictions, not lens-vs-lens conflicts, so they route to spec-agent normally — but if the architect or design lens returns a directive that fixes one side of F4 only, the two halves need to be resolved together.

---METRICS---
status: DONE
confidence: HIGH
lens: tester-web
findings_high: 2
findings_medium: 4
findings_low: 2
round: 1
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17]
blockers: []
bugs_filed: []
