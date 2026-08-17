<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 2, dev-web lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent aff9ee5fd4d2f1b0d -->

I have everything I need. Here is my round-2 return.

---

# Gate 1 round 2 — dev-web lens — F-002 talk-back (revision 2)

## Part 1 — Closure check on my round-1 findings

| R1 | Landed in | Verdict |
|---|---|---|
| **F1** interface language, three sources | AC-23 + `client.interface_language` | **Resolved** — one declared BCP-47 value, `navigator.language` named and forbidden. One wording residue → M3 below |
| **F2** five message kinds have no `turn.outcome` | AC-2 rewritten + `## What speaks, and from what` | **Resolved for the four server-side sources**; the new table added an eleventh speaking row with no source object → **H1** |
| **F3** literals vs counts contradiction | AC-22 frames + slots | **Resolved as a contradiction** — frames-with-slots is coherent and matches `appliedHead()`. But the slot vocabulary it closes on is too narrow for three of the kinds the table requires to speak → **H2** |
| **F4** async voice list conflates "no voice" with "not loaded" | AC-13 `resolving` + OQ5 | **Resolved**, timeout correctly routed to OQ5. Not re-opened |
| **F5** iOS Safari per-call gesture (M) | Asymmetry note + `suppressed{gesture_required}` | **Partially** — the note is honest about the mechanism, but `gesture_required` is now a *contract-recorded* reason with no declared way to detect it. Folded into **H3** |
| **F6** hidden tab keeps speaking (M) | AC-4(b) + `stopped{not_visible}` | **Resolved** — both doors covered (ineligible at arrival, stops mid-sentence) |
| **F7** Chromium drops `speak()` after `cancel()` (M) | **nowhere** | **Unresolved and unrouted.** It appears neither in the round-1 report's `## Also routed` list nor in the changelog. Re-raised at MEDIUM → **M1** |
| **F8** one composer or two (M) | AC-22 first clause, `{src}/_shared/` | **Resolved** |

**Judgement the briefing asked for — is the F1 split honest?** Yes, on ownership. No F-002 AC is unsatisfiable while the recognizer drifts: every F-002 AC is about output, and output reads the declared value. Keeping an implementer out of two gate-passed ports is the right call. The one thing that is not honest is AC-23's own present-tense wording — see M3.

**Judgement the briefing asked for — is AC-18(b) implementable on web?** Not as written. See H3. It is implementable with one added sentence.

---

## Part 2 — Findings

```yaml
findings:
  - id: H1
    severity: HIGH
    acs: [AC-2, AC-22, AC-4, AC-5]
    claim: >
      The new "What speaks, and from what" table gives the queued-turn notice
      speaks: yes with "client-local; no server object", but AC-2 enumerates
      exactly four source objects and none of them is it — and in F-001 the
      queued notice is not a message at all: it is a <span
      data-testid="assistant-queued-notice"> rendered inside the user's own
      bubble (src/assistant/web/components/ConversationPane.tsx:174-189), keyed
      off Message.kind:'user' .queued (src/assistant/_shared/types.ts:96-105).
    consequence: >
      The shared composer AC-22 puts in {src}/_shared/ has eleven speaking kinds
      and one with no declared input, no frame source and no slot values, so a
      web implementer must invent them — the exact "plausible default" that
      starts spec drift. It is also the only kind whose trigger is the *user's
      own* message rendering rather than an outcome arriving, so AC-4's four
      conditions (all phrased about an outcome that "arrives") and AC-5's
      slot-of-one interaction with the real outcome later delivered on
      reconnect are both undefined for it. Separately it contradicts
      ## Purpose's "the spoken surface is exactly empty when there is no
      connection" — the claim the F-004 / ADR-11 human item rests on — since
      this row speaks precisely when there is no connection.
    would_not_be_a_finding_if: >
      AC-2 listed a fifth source object for the queued notice and said what it
      carries, or the table marked it speaks: no, or F-001's model had a
      distinct queued-notice message kind for it to render from.
    directive: >
      Either (a) name the client-local object the queued notice speaks from,
      state that its trigger is the user message's queued flag rather than an
      arriving outcome, give it a frame in AC-22's catalogue, and correct
      ## Purpose's offline claim; or (b) set it to speaks: no and record the
      "did it even hear me" gap AC-1 cites as the reason it was ruled out.

  - id: H2
    severity: HIGH
    acs: [AC-22, AC-2, AC-3, AC-1]
    claim: >
      AC-22 closes the slot vocabulary at "a count (integer) and at most one
      task title", but three kinds the table requires to speak carry content
      that is neither. The load-bearing one is the clarify question: its whole
      content is the candidate set (Message.kind:'question'.options /
      taskTitles, src/assistant/_shared/types.ts:123-135; composed as
      `Có ${n} việc khớp — bạn muốn việc nào?` in messages.ts:156-166), so the
      only sentence the vocabulary permits is "two tasks match — which one do
      you want?". Also unexpressible: no-match's `heard`, which F-001 AC-14
      requires quoted verbatim (ConversationPane.tsx:217-228, asserted at
      web/__tests__/app.test.tsx:430), and unsupported-query's `alternative`,
      a server-provided string (src/assistant/api/types.ts:63).
    consequence: >
      On the one path where the app asks the user for something, talk-back
      speaks a question and withholds its answer set — the user must look at
      the screen to answer, which is the exact inverse of AC-1's promise, on
      the turn where the model was least certain. The web implementer's only
      routes are to invent a title-list slot (violating AC-22's closed
      vocabulary, and reopening the L-008 hole AC-22 exists to close) or to
      ship the unanswerable sentence, and nothing in the spec forces either.
      Earliest catch today is AC-1's device recount at the very end.
    would_not_be_a_finding_if: >
      AC-22's slot vocabulary named a title-list slot (bounded, e.g. up to the
      two options F-001 renders) and a verbatim-transcript slot with the kinds
      permitted to use each, or the table marked clarify question / no-match /
      unsupported-query as speaks: no with the reason.
    directive: >
      Extend the closed slot vocabulary with the slots the enumerated kinds
      actually need — at minimum an ordered task-title list for the clarify
      frame — and state per row id which slots each frame accepts. Keep the
      closure; widen the alphabet. If clarify is instead ruled non-speaking,
      say so in the table and say what a non-looking user hears instead.

  - id: H3
    severity: HIGH
    acs: [AC-18, AC-5, AC-13]
    claim: >
      AC-18 never says at which platform event a `spoke` entry is appended, and
      on web there is no synchronous success signal: speechSynthesis.speak()
      returns void and cannot fail synchronously; the only honest evidence that
      audio began is utterance.onstart. Three web cases accept speak() and
      produce no audio and no error event — iOS Safari outside a live user
      gesture (the asymmetry note's own case), Chromium after cancel() in the
      same tick (AC-5's supersede path is literally cancel-then-speak — my
      round-1 F7), and an engine with a listed but non-functional voice.
    consequence: >
      A build that appends `spoke` at the call site satisfies AC-18(b) — the
      mandatory positive assertion that the entire spec leans on to make a
      never-speaking build fail — while emitting silence on web. C4's tautology
      is reinstated one level down, in the AC written to kill it. AC-18(c)
      already forbids exactly this reasoning for stops ("never on the model
      clearing its own field, which is indistinguishable from forgetting to
      call the platform"); clause (b) needs the same rule and does not have it.
      Related: `gesture_required` is in the closed vocabulary but no AC says
      how a gesture refusal is detected — on web it is only observable as
      "no start event within a bound", and no such bound is declared (OQ5
      covers the voice list, not this).
    would_not_be_a_finding_if: >
      AC-18 stated that `spoke` is appended from the port's utterance-start
      signal rather than from the call to speak, and declared the no-start
      bound after which the entry becomes a suppression with a named reason.
    directive: >
      Extend AC-18(c)'s "assert on the platform's recorded surface" rule to
      clause (b): `spoke` is recorded on the port's start callback with the
      started_at already declared on speech.utterance. Declare a no-start
      timeout and the reason it records, and state that on web
      gesture_required is inferred from that timeout because the platform
      emits no distinguishable signal. Add the web start-event double to the
      Test strategy's SpeechOutput port list.

  - id: M1
    severity: MEDIUM
    acs: [AC-5, AC-9, AC-18]
    claim: >
      Re-raised from round 1 (dev-web F7), which reached neither the report's
      routed list nor the changelog. On Chromium, speechSynthesis.cancel()
      immediately followed by speak() frequently leaves the new utterance
      unspoken, and speechSynthesis.speaking can read true while nothing is
      audible. AC-5 makes cancel-then-speak the normal path for every
      superseded message, and AC-9's stop-then-listen uses the same call pair.
    consequence: >
      The most common web sequence — two quick turns — is the one the platform
      drops, and per H3 it drops it silently. Without an AC acknowledging it,
      the implementer discovers it on a device, not in the node tier where
      every other AC-5 assertion lives.
    would_not_be_a_finding_if: >
      An AC or the platform-asymmetry note named the cancel-then-speak hazard
      and required the port to confirm the replacement utterance actually
      started, or the Verification status listed it as web device residue on
      AC-5.
    directive: >
      Add it to the ## Known platform asymmetries note beside the iOS Safari
      gesture case, and put AC-5 in the "node half proven, device residue
      named" category with this as the residue.

  - id: M2
    severity: MEDIUM
    acs: [AC-18, AC-21, AC-5]
    claim: >
      AC-18 says speech.decision_log "appends one entry per message
      considered", but two ACs require a second entry for the same message:
      AC-21 records degraded{no_title_resolved} on a message that also speaks,
      and AC-5 records stopped{superseded} on a message that already spoke.
    consequence: >
      Under one-entry-per-message a correctly degraded-but-spoken message has
      no `spoke` entry, so AC-18(b)'s mandatory positive assertion is red on a
      correct build; under multiple entries the "one entry per message" clause
      is false. The test author and the implementer will pick different
      readings, and the cheap reconciliation is to weaken the positive
      assertion to "spoke OR degraded" — which reopens C4. This lands on the
      first test in the file.
    would_not_be_a_finding_if: >
      AC-18 said a message may accumulate several ordered entries (its seq
      field already implies this), or made degraded a modifier on a spoke
      entry rather than a peer decision value.
    directive: >
      One sentence in AC-18 fixing the cardinality, and state which entry
      AC-18(b)'s positive assertion looks for when a message has more than one.

  - id: M3
    severity: MEDIUM
    acs: [AC-23]
    claim: >
      AC-23 states as present-tense fact that client.interface_language is
      "read by both the synthesiser and the recognizer", while the same spec's
      Out of Scope forbids touching web-speech-source.ts:50 and
      rn-transcript-source.ts:71 in this feature. After F-002 ships, exactly
      one of the two readers exists.
    consequence: >
      The AC body reads as an instruction to wire both ports; the Out of Scope
      bullet reads as a prohibition on doing so. That is the shape that sends
      an implementer into two gate-passed ports for a reason unrelated to
      speech output — the outcome the Out of Scope bullet was written to
      prevent. Secondary: AC-1's device method assumes the interface language
      is what the app actually runs in end to end, which on a non-matching web
      locale it is not.
    would_not_be_a_finding_if: >
      AC-23 said "the value the synthesiser reads, and the value the recognizer
      is to be aligned to in a follow-up (see Out of Scope)" rather than
      asserting both read it today.
    directive: >
      Re-word AC-23's second sentence to future-tense for the recognizer half
      and cross-reference the Out of Scope bullet, so the declaration and the
      prohibition read as one decision.
```

## Part 3 — Checked and found nothing (anti-theatre list)

- **AC-4(b)** web instantiation: `document.visibilityState === "visible"` is the right observable, guards both doors (arrival + mid-sentence), and `not_visible` is in the closed vocabulary. My F6 is fully closed.
- **AC-6** persistence on web (localStorage) — "off means nothing is synthesised, not synthesised-and-muted" is implementable and node-assertable through the port; correctly listed as device residue for process-kill.
- **AC-12/AC-13** capability split — `'speechSynthesis' in window` maps to `synthesis`, an empty-forever voice list maps to `resolving`→`unsupported` via OQ5's timeout. No dead-control state survives the four-valued shape. C5 is closed.
- **AC-14**'s web observable — forcing `speech_prefs.enabled` true in the web suite is the correct fix for default-off never exercising the case.
- **AC-17** 2.1.1 / 4.1.2 are provable against the rendered DOM on the web tier, correctly de-allocated from device debt.
- **AC-20**'s stop-on-the-message is web-implementable in every mic mode; clause (a) is mobile-only and outside this lens.
- **AC-21**'s client-side title resolution reuses a lookup the web client already performs for F-001 AC-4 — no contract change needed, and `## API Touch Points`' "no new field" claim now holds. C2 is closed.
- **AC-22**'s one-composer-in-`_shared` closes my F8; the frames-by-row-id shape matches `appliedHead()` (`format.ts:70`) as claimed.
- `Message.kind:'info'` (permission / transient-failure guidance) is absent from the new table and therefore silent under its closed rule. Defensible — F-001 AC-19's live region still announces it — and I am not raising it, but no one stated the choice.
- `format.ts` still pins `'en-US'` for date/time formatting. Not an F-002 defect: AC-22's slot vocabulary admits no formatted dates, so no formatted value reaches an utterance.

## Recommendation

Three HIGHs, all in material the revision introduced, and all three are one- to three-sentence fixes to ACs whose direction is right — H2 widens a vocabulary, H3 adds a recording-moment rule, H1 resolves a table row against `## Purpose`. None of them argues with a decision. The round cap is 2, so these route as the closing conditions rather than a third round.

---METRICS---
status: DONE
confidence: HIGH
lens: dev-web
round: 2
findings_high: 3
findings_medium: 3
findings_low: 0
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23]
blockers: []
bugs_filed: []
