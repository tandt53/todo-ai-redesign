<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 1, product lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a959a3acbdec3ad1c -->

I have everything I need. Here is my Gate 1 product lens return.

---

# Product lens — F-002 talk-back, Gate 1 round 1

**Task:** T-047 · **Feature:** F-002 · **Phase:** review-spec · **Lens:** product · **Round:** 1
**Files written:** none (per `_spec-review-protocol.md` — findings only)

## Independent re-derivation (done before reading the AC list)

From `## Purpose` + UC-20 alone I derived 16 requirements. Fourteen are in the spec, several in a stronger form than I wrote them (AC-4's prohibition on replayed/history audio and AC-5's size-one slot are both things I had as vague "don't be annoying" notes). Two are not:

- **"When does it speak?"** — I had it as a requirement; the spec has it as Open Question 1 with an interim decision. → F3.
- **The offline day summary (UC-20 AC-20.6)** — I had it as core to the market claim; the spec excludes it. → F2.

One thing was in the spec and not in mine, and it is the better call: making the spoken string a *second rendering of `turn.outcome`* rather than a read-aloud of the displayed text. I had assumed read-aloud. The spec's version is what makes AC-3 achievable at all.

## Direct answers to the two questions the briefing put to me

**1. Web off / mobile on — I do not conflict, and I want that on the record** so the human's escalation budget is not spent here. spec-agent predicted a product-vs-accessibility clash; there isn't one. Three independent reasons converge on off-by-default for web, and the spec only cites one of them:

- The screen-reader doubling risk is genuinely unmitigatable on web (the spec's reason).
- **Web cannot reliably do "default on" anyway.** Chrome only allows `speak()` if the frame has ever had user activation; WebKit requires `speak()` to run inside a user-gesture handler and silently drops it otherwise ([Chromium intent-to-remove](https://groups.google.com/a/chromium.org/g/blink-dev/c/WsnBm53M4Pc), [speechSynthesis field notes](https://talkrapp.com/speechSynthesis.html)). A default-on web build is asking for a guarantee the platform does not sell. This also produces F5 below.
- AC-16's opt-in is *better product* than mobile's default-on, not worse: it is the only moment in either client where the user is told the feature exists. Mobile's disclosure is the first utterance itself.

The honest consequence to record: **mobile is the only surface where this feature demonstrates itself by default.** Web adoption is bounded by whoever finds the toggle. That is acceptable, but it should be a stated expectation rather than a discovery after the device pass.

**2. Does this scope deliver AC-20.1's test?** For a single-task create and a single-task edit — yes, cleanly. AC-1 as written is the strongest AC in the set (user-outcome level, real constraint, observable by a third party). **For a turn that changes more than one task — no, and AC-3 is what stops it.** That is F1, and it is the one HIGH.

## Findings

```yaml
findings:
  - id: F1
    severity: HIGH
    acs: [AC-1, AC-3]
    claim: >
      AC-1 promises the listener can recount which task changed; AC-3 requires
      multi-task outcomes to speak a count rather than an enumeration
      ("created/deleted titles are counted, not enumerated past the one that
      stands out"). For any turn changing more than one task the two give
      incompatible directives, and "the one that stands out" is undefined.
    consequence: >
      A build satisfies both by speaking "three tasks added" — and the user
      learns nothing about what the app understood. Multi-item utterances
      ("add milk, eggs and bread") are exactly where the model most often
      mis-parses, so the differentiator is delivered for the easy case and
      withdrawn for the case that needed it. AC-1's acceptance test cannot
      catch this: it scripts one create and one edit, both single-task, so the
      device pass ticks AC-1 green while the promise is unmet. Two implementers
      will also read "stands out" differently, giving a per-client divergence
      F-003 AC-1 exists to prevent.
    would_not_be_a_finding_if: >
      AC-3 stated a rule for multi-change turns that keeps each change
      identifiable (e.g. "up to two changed titles are named, the remainder
      counted"), OR AC-1 explicitly scoped its promise to single-change turns
      and the spec said what the user is expected to do otherwise.
    directive: >
      Define the multi-change case in AC-3 with a countable cap instead of the
      undefined "stands out", and add a second acceptance case to AC-1 covering
      a turn that changes more than one task.

  - id: F2
    severity: MEDIUM
    acs: [AC-1, AC-4, AC-11]
    claim: >
      Excluding UC-20 AC-20.6 is the right call for this feature, but it leaves
      F-002 unable to demonstrate the market position ADR-11 claims. AC-4
      restricts speech to a turn the user just issued; AC-11 states plainly that
      offline "no new outcome exists to speak". The spoken surface is therefore
      exactly empty offline — the one axis ADR-11 names as the open position
      ("phone-first, spoken-first, and runs with no signal").
    consequence: >
      Sign-off on F-002 reads as "the differentiator shipped" when what shipped
      is spoken-first-when-online, which is what ADR-11 says every competitor
      already is. The offline leg is carried entirely by the excluded clause.
      Market check makes this sharper, not softer: SpeakToDo already ships a
      voice task manager advertising 100% offline operation with on-device NLP,
      so the offline axis is contested rather than empty, and the 2026 mobile
      stack (on-device SpeechAnalyzer, Gemini Nano) has removed the technical
      moat that made it empty. The competitor set in vision-voice-first.html
      that ADR-11 cites may simply be stale.
    would_not_be_a_finding_if: >
      ADR-11's position were phone-first + spoken-first alone, or the spec's
      ## Purpose stated that F-002 delivers the online half and named the
      feature that delivers the offline half.
    directive: >
      Keep AC-20.6 out of F-002 — I agree with every word of the exclusion
      rationale. Add one line to ## Purpose stating F-002 does not by itself
      establish ADR-11's offline leg, and create the follow-on feature id now
      with the same binding-next-feature commitment that D1 gave F-002. That
      mechanism is proven in this project; it is what put me here.

  - id: F3
    severity: MEDIUM
    acs: [AC-4, AC-6, AC-7]
    claim: >
      Open Question 1 ("when to speak") is marked undecided and owned by
      product, but AC-4 ships a hard answer — every eligible turn — with mobile
      defaulting to on. UC-20 names this exact combination as the reason people
      turn the feature off and never back on, and the spec's only mitigation is
      AC-6's binary off. Every incumbent has already rejected binary: Alexa has
      Brief Mode, Google has Speech Output "Brief", and Siri's default is
      "Spoken Responses: When Silent Mode is Off" — a *when*, not an on/off.
      The documented user complaint is verbatim this product's create turn
      (Alexa confirming each grocery item, "too many words for a repetitive task").
    consequence: >
      As written, the product ships the binary the industry converged away from,
      and the spec does not notice that it already owns the middle setting:
      AC-7 requires iOS to publish on a channel the ring/silent switch silences
      and Android to respect ringer/DND. That *is* Siri's rule, free, on both
      mobile platforms. Leaving OQ1 open means an implementer may satisfy AC-7
      without anyone recording that it answered OQ1, and the answer stays
      invisible to the human deciding whether the default is safe.
    would_not_be_a_finding_if: >
      AC-4 or OQ1 named AC-7's OS-silence rule as the "when" answer on mobile,
      or the spec argued why a middle setting is wrong for a one-sentence-per-
      turn product.
    directive: >
      Close OQ1 by stating that on mobile the OS silence state is the when-rule
      (already required by AC-7), and record that web has no equivalent — which
      is F6.

  - id: F4
    severity: MEDIUM
    acs: [AC-8, AC-16]
    claim: >
      AC-8 is not an acceptance criterion. Its substance is a statement that a
      platform signal does not exist ("the browser exposes neither a silent-
      switch signal nor a reliable headphone-removal signal"); ## Verification
      status concedes it "is verified by inspection of the platform, not by a
      test". Its one assertable clause duplicates AC-16.
    consequence: >
      AC-8 is tagged (web) and reviewer C2 requires at least one P1 test case
      per AC per tagged platform. A QA agent must either write a test that
      asserts nothing (which C12 is designed to catch) or leave a permanent
      coverage hole in the matrix. Either outcome trains the team to waive a
      mechanical gate, which is more expensive than the AC is worth.
    would_not_be_a_finding_if: >
      AC-8 named an observable that changes when the behaviour is wrong, or the
      spec placed the platform-limitation statement outside the AC list.
    directive: >
      Move AC-8's absence-of-signal statement into ## Composition with F-001 and
      F-003 (where the other platform-capability facts already live) and keep
      only the assertable clause — page-level mute and the off control stop
      speech — as an AC, or fold it into AC-16.

  - id: F5
    severity: MEDIUM
    acs: [AC-1, AC-12, AC-16]
    claim: >
      Open Question 5 makes the React Native synthesis capability a blocking
      pre-implementation check. There is no equivalent for web, and web has the
      same class of risk: Chrome allows speak() once the frame has ever had user
      activation, but WebKit requires speak() to be called inside a user-gesture
      handler. A turn outcome arrives from an awaited network response, not from
      inside the mic-tap handler.
    consequence: >
      If WebKit's rule bites, talk-back is inert on iOS Safari — the phone-first
      web platform — and AC-12's "no error surfaced" makes it inert *silently*.
      The feature would ship, pass every node-tier test (the SpeechOutput double
      has no autoplay policy), and be discovered dead on a real phone. This is
      the same failure shape OQ5 already treats as blocking for React Native;
      web just did not get the same question asked.
    would_not_be_a_finding_if: >
      A capability probe confirmed that an utterance issued after an awaited
      fetch still plays on current iOS Safari and Chrome Android, or the spec
      scoped web talk-back to desktop browsers.
    directive: >
      Extend OQ5 with a web arm and mark it blocking on the same terms: verify
      utterance-after-await on iOS Safari before build. Architect owns the
      mechanism; I am raising the product consequence, which is that AC-1 may be
      unreachable on the platform the market claim is aimed at.

  - id: F6
    severity: MEDIUM
    acs: [AC-4, AC-8]
    claim: >
      AC-4 restricts speech to "a turn the user issued in the current foreground
      session", but does not say whether the surface must still be visible when
      the utterance starts. On web the gap between issuing a turn and the
      outcome arriving is a network round trip, during which the user can switch
      tabs or applications; AC-7's OS-level guard does not exist on web (AC-8).
    consequence: >
      A web user issues a turn, switches to a meeting tab, and the app speaks
      into a window they are no longer looking at — the unintended speech AC-6
      and AC-8 are both written to prevent, arriving through the one path
      neither covers. It is also the residual of Open Question 1 on the only
      platform with no OS mitigation.
    would_not_be_a_finding_if: >
      AC-4 defined "foreground session" as including document visibility at
      utterance time, or AC-8 stated that unintended *context* (as distinct from
      unintended *start*) is accepted on web.
    directive: >
      Define "foreground" in AC-4 to include the surface being visible when the
      utterance begins. Page Visibility is available on web at no cost and is
      the natural substitute for the silent-switch signal AC-8 says web lacks.

  - id: F7
    severity: LOW
    acs: [AC-6, AC-16]
    claim: >
      ## Ops counts five things — utterances started, and four ways they stop or
      are suppressed. It does not count the on/off toggle itself, so the single
      outcome UC-20 names by name (turned off, never turned back on) and the
      single number that says whether web adoption happened at all (how many
      users ever opted in per AC-16) are the two the spec cannot see.
    consequence: >
      OQ1's interim decision cannot be evaluated later on evidence; it can only
      be re-argued. Force is limited: ADR-001 puts this at prototype grade with
      no distribution and no live users, so there is currently nobody to measure.
    would_not_be_a_finding_if: >
      Ops recorded enable/disable transitions, or the spec stated that toggle
      telemetry waits for distribution.
    directive: >
      Add enable→disable and disable→enable to the client-side counter list, or
      state explicitly that it is deferred until there are users.
```

## Checked and found nothing (anti-theatre)

- **All 17 ACs read on the quality spectrum.** AC-1 and AC-6 are at user-outcome level; AC-2, AC-4, AC-5, AC-14 are prohibitions, which is the assertable form and the right choice here; AC-17 names WCAG success criteria by number and refuses the 1.4.2 exemption rather than claiming it. Nothing sits at "code existence" or "feature presence". Only AC-8 fails the spectrum (F4). This is a materially stronger AC set than F-001's round 1.
- **Every AC I flagged is falsifiable by the acceptance test the spec itself names** — I did not need to invent a measurement for any of them except F1's multi-change case.
- **Scope minimalism vs. the differentiator claim** — the four Out of Scope exclusions other than AC-20.6 (barge-in, resume, replay, voice settings) are correctly scoped and each carries a "considered and rejected" that names the real cost. I tried to argue any of them back in and could not. Barge-in in particular: AC-9's mutual exclusivity is what keeps it *out* rather than *half-built*, which is the right structural choice.
- **AC-2's "text counterpart" when the spoken string differs from the displayed string.** The spoken sentence is a second rendering of `turn.outcome`, not the on-screen words, so a muted user gets more information rather than the same information. That satisfies UC-20 AC-20.2's purpose. There is no text record of *what was said* — but "re-reading an older message on demand" is explicitly out of scope, so I am not raising it. Recording it because a later replay feature will need to decide this.
- **Composition with F-001/F-003** — I checked each row for a narrowed promise and found none. The "speaking is not a fifth state" argument is correct and load-bearing: a blocking state would forbid AC-9, which is the one interrupt this feature does promise.
- **The web/mobile default asymmetry** — checked deliberately for a product-vs-accessibility conflict, found none. Reasoning above. Open Question 3 asks whether it is permanent; my answer is that it should be treated as permanent until a web screen-reader signal exists, which is unlikely to change for the privacy reason AC-16 already gives.

## AC-validator summary

17 of 17 ACs examined. Coverage of my four lenses: user advocate → F1, F3, F6; market analyst → F2; requirements challenger → F3, F5; AC validator → F1, F4. Web searches used: 3.

**Sources:** [Chromium — Intent to Remove: speechSynthesis.speak without user activation](https://groups.google.com/a/chromium.org/g/blink-dev/c/WsnBm53M4Pc) · [Lessons Learned Using the JavaScript speechSynthesis API](https://talkrapp.com/speechSynthesis.html) · [SpeakToDo — Voice Task Manager (offline)](https://play.google.com/store/apps/details?id=com.japality.s&hl=en_US) · [Fora Soft — Voice Recognition App Development: 2026 Playbook](https://www.forasoft.com/blog/article/voice-activated-mobile-apps-ai-nlp-integration) · [NN/g — Intelligent Assistants Have Poor Usability](https://www.nngroup.com/articles/intelligent-assistant-usability/) · [Popular Science — How to turn off your smart assistant's voice](https://www.popsci.com/get-your-digital-assistant-to-quiet-down/)

## Notes for the orchestrator

- **F1 is the only HIGH** and it blocks AC-1 and AC-3 only; the other 15 ACs can proceed.
- **F2 is a sign-off-level item, not a build blocker.** I considered rating it HIGH because it is the briefing's headline question, and rejected that: no AC becomes unbuildable. But it belongs on the human's checklist the same way F-001's screen-reader pass did — the human should know that approving F-002 is not approving ADR-11.
- **F5 overlaps the architect lens.** If architect raises the same capability risk, treat the agreement as evidence and not as confirmation — we are both reasoning from the same public platform docs.
- No conflict raised on the web/mobile default. If another lens raises one, my position is on record above and does not need me re-dispatched to state it.

```yaml
evidence:
  inputs_read:
    - /Users/tandt/projects/todo-ai-redesign/.claude/agents/_ethos.md
    - /Users/tandt/projects/todo-ai-redesign/.claude/agents/_completion-protocol.md
    - /Users/tandt/projects/todo-ai-redesign/.claude/agents/_qa-foundations.md
    - /Users/tandt/projects/todo-ai-redesign/.claude/agents/_spec-review-protocol.md
    - /Users/tandt/projects/todo-ai/docs/02-use-cases.md   # UC-20 in full, incl. edge table + open decisions
    - /Users/tandt/projects/todo-ai-redesign/specs/assistant/F-002-talk-back.md
    - /Users/tandt/projects/todo-ai/docs/01-architecture.md   # ADR-7, ADR-11, plus ADR-6/8/10/12 for context
    - /Users/tandt/projects/todo-ai-redesign/reports/product-review-F-001-final-2026-08-16-v2.md
  ac_coverage:
    AC-1..AC-17: examined; findings raised against AC-1, AC-3, AC-4, AC-6, AC-7, AC-8, AC-11, AC-12, AC-16
  commands_run:
    - cmd: "grep -n '^##' specs/assistant/F-002-talk-back.md"
      exit: 0
      result: "18 sections; spec is 164 lines"
    - cmd: "3 web searches (autoplay policy, competitor landscape, assistant verbosity)"
      exit: 0
      result: "all three produced evidence cited in F2, F3, F5"
  artifacts_written: []
  unresolved:
    - "tradeoff:lens-scope — F5's mechanism is architect territory; I raised only the product consequence and said so."
    - "tradeoff:prototype-grade — F7 is weakened by ADR-001 (no live users). Rated LOW for that reason rather than dropped."
```

---METRICS---
status: DONE
confidence: HIGH
lens: product
round: 1
findings_high: 1
findings_medium: 5
findings_low: 1
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17]
blockers: []
bugs_filed: []
