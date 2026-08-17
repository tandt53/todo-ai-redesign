<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 1, design lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a62baa96cb50ed2bd -->

I have everything I need. Here are my Gate 1 design-lens findings on F-002.

---

## Design lens — F-002 talk-back, round 1

**Lens verdict on the briefing's framing question first:** the spec's decision that speaking is *not* a fifth state is right, and the absence of a dedicated "speaking" chrome is **correct restraint, not a gap** — a hearing user perceives the utterance through the channel it is delivered on, and painting an equaliser on the bubble would add an F-001 AC-29 edge for zero information. The gaps are not in showing that speech is happening. They are in the three places where the *screen* has to carry something the ear cannot: which messages speak at all, how the user stops one, and how the user distinguishes "off" from "broken".

```yaml
findings:
  - id: F1
    severity: HIGH
    acs: [AC-2, AC-3, AC-4]
    claim: >
      The spec never enumerates which of F-001's message kinds speak. AC-2 scopes speech
      to "a message already rendered on the conversation surface" and AC-4 scopes it by
      provenance (the turn just issued), but F-001's Conversation model defines eleven
      message kinds — applied, reverted, nothing-reverted, undo-refused, clarify question,
      confirm question, resolution outcome (four variants), no-match, boundary marker,
      queued-turn notice — and AC-3's guidance describes only applied-outcome shapes
      (counts, diffs, created/deleted titles). Whether a clarify question, a confirm
      question, an error or a no-match speaks is undecided, while the spec simultaneously
      delegates the wording "per message kind, as literals cited by row id" and makes the
      test parse that catalogue.
    consequence: >
      The set of catalogue rows is undefined, so nobody can build the catalogue the Test
      strategy's L-008 parser reads, and design-agent will pick the membership by itself in
      a later dispatch. This is L-008 one level up: with no enumerated row set, the only
      implementable reading of "one sentence per turn" is a composer that derives a sentence
      from any outcome — which produces fluent, unreviewed speech for exactly the kinds
      nobody listed. Two kinds are load-bearing either way: a spoken clarify/confirm question
      is the highest-value hands-free case in the feature, and it also interacts with AC-9
      (the mic must stay shut while the app asks, so the user must tap to answer) — a coherent
      design nobody has stated.
    would_not_be_a_finding_if: >
      An AC named the speaking subset of F-001's message taxonomy the way F-001 AC-19 names
      the announcing subset for the live region, or stated that every message kind of the
      just-issued turn speaks and that design owns one row per kind.
    directive: >
      Add to AC-3 (or a new AC) an explicit list of which message kinds produce an utterance
      and which are silent, using F-001's Conversation model list as the domain, so the
      components.md row set has a fixed membership.

  - id: F2
    severity: HIGH
    acs: [AC-13, AC-12, AC-6]
    claim: >
      AC-13's no-voice-for-the-declared-language case is "silent with no error surfaced",
      but unlike AC-12 it does not hide the on/off control — `speech.capability` carries
      `synthesis_available` and `voice_for_lang` as two separate booleans, and only the first
      one is given a rendering. A user on a device with synthesis but no Vietnamese voice
      sees a control reading ON and hears silence forever, with nothing on screen ever
      differing from a working install.
    consequence: >
      This is the feature's purest "off is indistinguishable from broken": the user's only
      diagnostic is to toggle the control they already have on. It also contradicts the
      established treatment of the identical situation one capability over — F-003 AC-4 and
      components.md's "Chưa có gói ngôn ngữ cho giọng nói" row rule that a recognizer present
      without a language pack is dimmed *with a stated cause, never hidden*, precisely
      because absence-without-explanation reads as breakage. F-002 makes the opposite call
      for the output half of the same problem, and does not say it is doing so.
    would_not_be_a_finding_if: >
      AC-13 stated what the on/off control renders when `voice_for_lang` is false — hidden
      like AC-12, or visible with a stated cause like the input-side precedent — or stated
      that the case is deliberately indistinguishable and why.
    directive: >
      Give the `synthesis_available: true` / `voice_for_lang: false` tuple its own named
      rendering in AC-13, and say explicitly whether it follows AC-12's hide rule or F-003
      AC-4's stated-cause rule.

  - id: F3
    severity: HIGH
    acs: [AC-9, AC-17, AC-12]
    claim: >
      AC-9's stop mechanism assumes the mic control is tappable, but F-001 gives the mic
      four modes — available, dimmed/permission, dimmed/transient, hidden — and talk-back
      keys off a *different* capability (synthesis) than the mic does (recognition). The
      spec addresses only the `available` mode. On a device with synthesis but no
      recognition the mic is not rendered at all (F-001 AC-20, "composer reflows") while
      talk-back is on by default on mobile; in the two dimmed modes a tap produces a
      permission or transient message rather than listening, and the spec does not say
      whether that tap also stops the utterance.
    consequence: >
      In three of the four mic modes AC-9 has no instantiation, and AC-17 names WCAG 1.4.2
      while resting its compliance on "AC-6's one-gesture off and AC-9's immediate stop" —
      so in those modes the only surviving stop is the off toggle, which silences the
      sentence by disabling the whole feature. A user who wants to stop one utterance has
      to turn the product's differentiator off, with no per-sentence stop to come back to.
      The mic's accessible name is also undefined during speech: components.md derives it
      from mode/state ("Nhấn để nói" / "Đang nghe — nhấn để dừng"), and while speaking the
      control would announce "tap to speak" for a gesture whose first effect is "stop".
    would_not_be_a_finding_if: >
      An AC stated what stops an utterance in each mic mode, or stated that talk-back is
      suppressed whenever the mic is not in `available` mode (which would make speech and
      the interrupt co-available by construction).
    directive: >
      Enumerate mic mode × speaking as four cases in AC-9, and either name the stop
      affordance for the non-available modes or make talk-back conditional on mic
      availability. Say what the mic control announces while an utterance is playing.

  - id: F4
    severity: MEDIUM
    acs: [AC-6, AC-12, AC-16, AC-17]
    claim: >
      The on/off control is required to exist and is never described. AC-6 requires it be
      reached "in one gesture from the conversation surface" and AC-17 requires it be
      "reachable on the conversation surface itself" — jointly that forces a persistent
      on-surface control, not a menu item — but the spec never names it as an affordance,
      lists no states for it, and gives it no home. The surface it must join already places
      three controls in the composer row (input, mic, send) and three in the topbar.
    consequence: >
      I cannot enumerate the states of the one control this feature adds, which is my lens's
      first question. Downstream, AC-12's "hidden, not disabled" makes it the *second*
      independently-hideable control in the composer row alongside F-001's hideable mic —
      four layout permutations, none acknowledged — and AC-16's web-only requirement that
      "the control's own description states that a screen reader already reads new messages"
      is a second, platform-differing rendering of a control that has no first rendering.
    would_not_be_a_finding_if: >
      The spec named the control and its state set (on · off · hidden), or stated that
      placement and states are entirely design's call while confirming the one-gesture,
      on-surface constraint is the only requirement on it.
    directive: >
      Add one AC or a Data/UI note that names the control, states that it is persistent on
      the conversation surface, and lists the states it must render — including the hidden
      case and whether its description differs per platform.

  - id: F5
    severity: MEDIUM
    acs: [AC-15, AC-17, AC-6]
    claim: >
      AC-15 suppresses speech while a screen reader is active and — correctly — refuses to
      write the user's preference. But AC-17 requires the control to expose "its on/off
      state", and in this case the stored preference (on) and the effective behaviour
      (nothing will ever speak) disagree. The spec does not say which one the control
      reports.
    consequence: >
      A VoiceOver/TalkBack user meets a control that announces itself as on and does
      nothing — the same failure mode as F2, arriving via a different door, and reaching the
      exact users AC-14 and AC-15 exist to protect. AC-17's 4.1.2 clause cannot be
      implemented without this decision, since "on/off state" has two candidate referents.
    would_not_be_a_finding_if: >
      AC-15 or AC-17 said whether the control reports the stored preference or the effective
      state, or specified a third rendering ("on, paused while a screen reader is active").
    directive: >
      State which value the control's exposed state reflects while suppressed, and whether
      the suppression is itself surfaced to the user.

  - id: F6
    severity: MEDIUM
    acs: [AC-4, AC-5]
    claim: >
      AC-4 admits any outcome of "a turn the user issued in the current foreground session"
      and excludes only session-read history and `replayed: true`. A turn cancelled while
      thinking meets both conditions to speak: F-001 AC-3 makes cancel client-local, the
      sent turn still completes, and its late outcome still renders as a message in the same
      foreground session with no replay flag.
    consequence: >
      The app speaks aloud about a turn the user explicitly cancelled and whose surface has
      already returned to idle — which is the unsolicited audio AC-4's own last sentence
      forbids. It is also inconsistent by accident: an offline turn replayed on reconnect
      within the same session is silent (F-003 AC-6's `replayed: true`), while a cancelled
      turn's late outcome speaks, though from the user's seat the two are the same event
      — an answer arriving for something they stopped waiting on.
    would_not_be_a_finding_if: >
      AC-4 excluded the late outcome of a cancelled turn, or stated that cancel is
      client-local so its outcome speaks like any other and named that as intended.
    directive: >
      Add the cancelled-then-late-outcome case to AC-4's exclusion list, or state explicitly
      that it speaks and why that is not unsolicited.

  - id: F7
    severity: LOW
    acs: [AC-7, AC-5, AC-11]
    claim: >
      An utterance that is stopped — headphones removed mid-sentence (AC-7), superseded by
      a newer message (AC-5), silenced by the ring switch — and an utterance that finished
      normally look and sound identical: nothing on screen changes in either case, and the
      spec adds no cue for any stop reason.
    consequence: >
      A user cannot tell they missed the second half of a sentence, and Out of Scope removes
      the recourse (no replay affordance, no resume). The consequence is bounded rather than
      severe because AC-2 guarantees the text counterpart is on screen, so nothing is lost
      — which is exactly the argument for leaving it uncued, and worth recording as a
      decision rather than an omission.
    would_not_be_a_finding_if: >
      The spec stated that a stopped utterance is deliberately uncued because AC-2's text
      counterpart carries the content, in any of the stop cases.
    directive: >
      Record in AC-5 or Out of Scope that stop is silent-and-uncued by design, resting on
      AC-2 — so a later reviewer does not read it as an unenumerated state.

checked:
  - "AC-1's cover-the-screen test implies no screen state at all — correctly, it is a device/manual criterion and needs no rendering"
  - "AC-6's persistence across reload/background/kill adds no new visible state beyond the control's own on/off"
  - "AC-8's web substitute (consent, no silent-switch signal) implies no new state — it constrains the default, which AC-16 renders"
  - "AC-10's mobile interruption implies no new visible state: the surface is in one of F-001's four throughout, and F-003 AC-7's mirror already renders"
  - "AC-11 (offline mid-sentence) implies no new state — F-001 AC-25's OfflineBanner and handover are unchanged"
  - "AC-14 confirmed non-conflicting: the live region and native announcement channels are unchanged, so no announcement state is added or removed"
  - "Speaking as a transient property rather than a fifth state survives contact with the existing layout — the composer, list, and message bubbles all stay live, and no F-001 AC-29 edge is added"
```

**Coverage note:** `acs_covered` lists all 17 ACs; none were skipped. The three HIGH findings each block a specific AC set rather than the feature — AC-2/AC-3/AC-4's spoken catalogue, AC-13's no-voice rendering, and AC-9/AC-17's stop mechanism.

```yaml
evidence:
  inputs_read:
    - specs/assistant/F-002-talk-back.md
    - specs/assistant/F-001-voice-assistant-view.md (## Conversation model, User Flow, Lifecycle, AC-3/AC-19/AC-20/AC-21/AC-22/AC-24/AC-29)
    - design/_shared/components.md (§MicControl incl. permission-copy rows, §Composer, §Message bubbles)
    - design/assistant/screens/voice-assistant-view.html (topbar, composer footer, voice-surface, 15 conv scenarios)
    - specs/assistant/F-003 (AC-4, AC-6, AC-7, AC-12 — read to confirm the language-pack precedent and the replayed-turn rule cited in F2 and F6)
    - .claude/agents/_ethos.md, _completion-protocol.md, _spec-review-protocol.md, specs/_shared/LEARNINGS.md
  ac_coverage:
    AC-1..AC-17: examined under the design lens; findings F1-F7 above, checked-list for the remainder
  commands_run:
    - cmd: "grep -n '## Conversation model' -A 80 specs/assistant/F-001-voice-assistant-view.md"
      exit: 0
      result: "four-state model + three mic modes + message taxonomy confirmed"
    - cmd: "grep -n 'AC-4\\*\\*\\|AC-6\\*\\*\\|AC-7\\*\\*\\|AC-12\\*\\*' specs/assistant/F-003*.md"
      exit: 0
      result: "F-003 AC-4 language-pack precedent (dimmed with stated cause, never hidden) confirmed"
  artifacts_written: []
  unresolved:
    - "tradeoff:lens-scope — placement of the on/off control (F4) borders on design-agent's own later dispatch; reported only as an enumeration gap the spec creates, not as a mockup critique"
```

---METRICS---
status: DONE
confidence: HIGH
lens: design
round: 1
findings_high: 3
findings_medium: 3
findings_low: 1
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17]
blockers: []
bugs_filed: []
