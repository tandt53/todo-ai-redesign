<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 1, architect lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a9088f3e06544aa28 -->

## Gate 1 — architect lens, F-002 (round 1)

**Verdict on the headline claim:** the "F-002 needs nothing from the server" claim is **right about the wire and wrong about its own source enumeration.** Every fact a spoken sentence needs is reachable client-side without a new endpoint or request field — with exactly one exception (the title of an *edited* task, F2). But AC-2 names `turn.outcome` as the sole source, and three of F-001's nine message kinds carry no `TurnOutcome` at all. Both gaps are fixable in the spec's own `## Data` section without touching the server, so the scoping assumption survives — it just is not yet true as written.

```yaml
findings:
  - id: F1
    severity: HIGH
    acs: [AC-2, AC-4, AC-5]
    claim: >
      AC-2 makes `turn.outcome` the only source a spoken sentence may be composed from, but
      three of the nine message kinds F-001's Conversation model enumerates carry no
      `turn.outcome`: **reverted** (renders from `turn.undo_result` / the undo endpoint's
      `UndoOutcome`), **undo-refused** (renders from a `409 UNDO_REFUSED` error envelope — no
      turn row exists at all on the voice path, ADR-006), and the **failed-turn error message**
      (`500 APPLY_FAILED` / `502 AI_ERROR` return `{error, turn}` and `TurnOutcome.kind` has no
      error member). A **voice undo** is the sharpest case: it is unambiguously "a turn the user
      issued in the current foreground session" per AC-4, yet `POST /assistant/turn` answers it
      with `kind: "undo"` and `turn: null`.
    consequence: >
      The spec never says whether these speak. An implementer either invents a second source
      (violating AC-2's letter and the L-008 literals-by-row-id rule, since design has no row for
      a message class the spec did not name) or ships them silent — which fails AC-1's purpose in
      the two cases where not looking at the screen matters most: "did my undo actually revert
      anything, or was everything skipped" and "did that turn fail". Earliest catch is a QA
      author asking which messages speak, after both clients are built.
    would_not_be_a_finding_if: >
      AC-2 enumerated the source set as `turn.outcome | turn.undo_result | UndoOutcome | the
      error envelope`, or an AC stated that reverted / undo-refused / failed messages are
      deliberately silent and gave the reason.
    directive: >
      Enumerate, in `## Data` or a new AC, which of F-001's nine message kinds speak and from
      which object each composes. All four sources already cross the wire, so this does not
      reopen `## API Touch Points`.

  - id: F2
    severity: HIGH
    acs: [AC-1, AC-2, AC-3]
    claim: >
      `TurnOutcome` for `kind: applied` is `{changed_task_ids, diff, created_titles,
      deleted_titles}`. There is **no title for an edited task**. `diff` is
      `{task_id, field, old|null, new|null}` — so an edit of `due_at` or `priority` yields a uuid
      and two field values and nothing nameable, while api-contracts.md's conventions forbid
      rendering uuids. AC-1's acceptance test is literally one create turn and one **edit** turn,
      with the listener recounting *which task changed*.
    consequence: >
      The spoken sentence for the most common mutation cannot name its subject from the source
      AC-2 permits. On screen F-001 AC-4 solves this by marking the row — the list supplies the
      title. Speech has no list, so the client must look the title up in its own task store,
      which is neither `turn.outcome` nor "a separate server field" and is a third source the
      spec never grants; and it has a real miss case (a task the local list does not hold —
      filtered, archived, or the F-001 AC-25 offline store). That titles are on the wire for
      creates and deletes but not edits is evidence the omission is incidental, not designed.
    would_not_be_a_finding_if: >
      The applied anatomy carried titles for `changed_task_ids` (a server change — which would
      contradict `## API Touch Points`), or AC-2/AC-3 stated that titles are resolved from the
      client's task list by `changed_task_ids` and specified what the sentence says when the id
      is not in that list.
    directive: >
      Decide which side supplies the edited title, and say so. This is the one place the
      "nothing from the server" claim is genuinely at risk — resolve it client-side by granting
      the lookup and naming the miss case, or accept one added response field and amend
      `## API Touch Points`.

  - id: F3
    severity: MEDIUM
    acs: [AC-4]
    claim: >
      AC-4's eligibility predicate keys on `replayed: true`, which does not express AC-4's own
      intent. `replayed` is set only on a **dedupe hit**; an offline-queued turn delivered on
      reconnect (`client.outgoing_turn`, F-001 AC-25/AC-27) is a *first* successful delivery and
      returns `replayed: false`, so it speaks — minutes after the user issued it, possibly in a
      meeting. Conversely, nothing marks a rendered message as spoken-eligible: F-003 AC-8's
      foreground sync re-renders the message list from `GET /assistant/session`, and neither the
      `Turn` shape nor any declared client store carries "I issued this, just now, in this
      foreground".
    consequence: >
      Two opposite defects from one missing field — a stale turn speaks unsolicited (exactly the
      unintended audio AC-6 forbids), and a live turn's message can be rebuilt by a foreground
      sync with its eligibility either lost or re-satisfied, re-speaking under AC-5's slot-of-one
      as a cancel-and-restart stutter. Both are timing-shaped and will surface on a device, not
      in the node tier.
    would_not_be_a_finding_if: >
      AC-4 defined eligibility as a client-latched property set when the client dispatches the
      turn and consumed once (a message speaks at most once in its lifetime), or `## Data`
      declared a per-message spoken/eligible marker with its lifetime.
    directive: >
      Define eligibility at the dispatch seam, not from `replayed`, and add the speak-at-most-
      once-ever rule — AC-5 currently governs concurrency only, not repeats.

  - id: F4
    severity: MEDIUM
    acs: [AC-12, AC-13, AC-15, AC-17]
    claim: >
      `speech.capability = {synthesis_available: true, voice_for_lang: false}` with
      `speech_prefs.enabled: true` is a consistent record in which AC-12 keeps the control
      **visible** (it hides only when synthesis is absent), AC-6 lets the user switch it on,
      AC-13 makes every turn silent with no error, and AC-17's 4.1.2 requires the control to
      expose its on/off state — which reads "on". AC-15's screen-reader suppression on mobile
      produces the same record from a different direction: preference on, nothing ever speaks.
    consequence: >
      AC-12's own promise of "no dead control" is violated by a state AC-12 permits. The user
      has a control that says on and a product that is permanently, silently mute, and no AC
      tells them why — the failure is indistinguishable from a broken build.
    would_not_be_a_finding_if: >
      AC-12's hide rule keyed on `synthesis_available && voice_for_lang`, or an AC stated what
      the control communicates while suppressed (by missing voice or by an active screen reader)
      and accepted that state explicitly.
    directive: >
      State the control's behaviour for the two suppressed-but-enabled records; either extend
      the hide rule or specify what the control reports.

  - id: F5
    severity: MEDIUM
    acs: [AC-6, AC-16]
    claim: >
      Open Question 4 (mine) asks whether `client.speech_prefs` is device-local or account-scoped
      per ADR-005. The two options are not equally open: AC-6 sets the default to `true` on
      mobile and AC-16 requires web speech to be enabled **only by explicit opt-in**. A single
      account-scoped `{enabled, updated_at}` carrying `true` from a mobile default — never an
      opt-in — arrives on web as enabled, breaking AC-16. The record as declared cannot
      distinguish "defaulted on" from "explicitly turned on".
    consequence: >
      Answering OQ4 with "account-scoped, per ADR-005 precedent" ships a web client that speaks
      without consent, which is the one thing AC-8 and AC-16 are built to prevent.
    would_not_be_a_finding_if: >
      The store carried an explicit `set_by_user` / null-`updated_at` distinction, or OQ4 were
      already resolved to device-local.
    directive: >
      Resolve OQ4 as **device-local** (the F-003 client-store precedent, not the ADR-005 session
      precedent), or add the field that separates default from explicit choice. The
      `data-model.md ## Client-side stores` row spec-agent deferred cannot be written until this
      is settled — the row's durability contract is the answer to OQ4.

  - id: F6
    severity: MEDIUM
    acs: [AC-7, AC-9, AC-10]
    claim: >
      AC-7 requires an iOS audio-session category the ring/silent switch silences, and AC-10
      requires releasing the session on interruption. F-003 AC-7 already gives the **recognizer**
      ownership of that same process-global session, with its own release-and-reacquire rule.
      The `## Composition` table asserts no F-003 AC is narrowed, but the spec never states who
      owns the category or when it is switched — and the categories are mutually exclusive in
      practice: a recording-capable category does not obey the silent switch, so a single
      app-wide choice fails AC-7 outright.
    consequence: >
      AC-9's exclusivity guarantees the two never run at once but says nothing about the
      resource between them. The likely implementation — set the category once at startup —
      silently fails AC-7 on a real device, and AC-7 is device-verified only, so nothing in the
      node tier catches it.
    would_not_be_a_finding_if: >
      An AC or Open Question 5 named the owner of the audio-session category and the handover
      rule between recognition and synthesis.
    directive: >
      Extend OQ 5 from "can the TTS module set the category" to "which component owns the
      category, and what is the transition on each of the four edges (speak start/end, listen
      start/end)". This is the pre-implementation blocking check OQ 5 already says it is.

  - id: F7
    severity: LOW
    acs: [AC-15, AC-12]
    claim: >
      AC-15 gates every utterance on "a screen reader is active", but no declared client-local
      concern carries that fact. `speech.capability` is `{synthesis_available, voice_for_lang}`
      only, and the spec states capability is re-resolved on foreground while saying nothing
      about re-reading screen-reader state — which the user can change while the app is
      backgrounded. The analogous F-003 store (`client.permission_state`) declares its re-read
      cadence explicitly.
    consequence: >
      A user who enables VoiceOver while the app is backgrounded returns to an app that talks
      over the screen reader until something else forces a re-probe — the exact doubling AC-15
      exists to prevent.
    would_not_be_a_finding_if: >
      `speech.capability` included a screen-reader-active member, or an AC stated the read
      cadence (per-utterance, or per-foreground as with `client.permission_state`).
    directive: >
      Add the flag to `speech.capability` (or its own row) and state when it is read.

  - id: F8
    severity: LOW
    acs: [AC-13]
    claim: >
      AC-13 requires every utterance to declare a BCP-47 tag — "the interface language" — and
      `speech.utterance.lang` must be filled from it. Nothing in `data-model.md`,
      `api-contracts.md` or F-001 declares where the interface language lives: no `locale` on
      `user`, no `Accept-Language`, no client store. F-001 AC-22 and F-003 AC-4 both reference
      "the interface language" as an existing concept without declaring it either.
    consequence: >
      The one thing AC-13 forbids — letting the engine guess — is what an implementer with no
      declared source will do. AC-13's silence-over-mis-speak rule also depends on comparing that
      tag against the platform voice list, so a wrong source produces wrong silence.
    would_not_be_a_finding_if: >
      Any of the three specs or the two contract files declared the interface-language source, or
      F-002's `## Data` added a row for it.
    directive: >
      Name the source in `## Data` (client-local is fine — this needs no server field). If it
      genuinely does not exist yet across all three features, that is a separate gap worth
      recording rather than inventing here.

checked:
  # Answering the briefing's headline claim: verified fact-by-fact against the contract.
  - "AC-2's no-audio-on-the-wire claim: holds. `POST /assistant/turn` carries `transcript` (text
     only, F-001 AC-20) and returns no media field; no endpoint gains a caller. The eight
     endpoints remain the complete surface."
  - "Counts and 'what stands out' (AC-3): available. `changed_task_ids` gives the count; `diff`
     carries `{field, old, new}` per task, so 'earliest nine' is derivable from the new `due_at`
     values without a server change."
  - "Created and deleted titles (AC-3): present on the wire as `created_titles` / `deleted_titles`.
     Edited titles are not — see F2."
  - "'That undo is available' (F-001 AC-19's required fact): derivable client-side, no field
     needed. F-001 AC-8's rule is mechanical — newest applied turn with non-empty
     `changed_task_ids` in the open session — and the client already computes it to show and hide
     the affordance."
  - "Question messages (AC-3, AC-4): `Question` carries `kind`, `task_titles`, `options`, so the
     confirm/clarify sentence composes from `turn.outcome` alone."
  - "no_match / unsupported_query: `heard_transcript` and `alternative` are both present."
  - "AC-11 (offline mid-sentence): consistent with the data model. Synthesis is device-local and
     no outcome exists to speak offline; nothing here needs a wire field."
  - "AC-14 (live region unchanged): no data-level conflict. F-001 AC-19 announces all nine message
     kinds with title-level detail; talk-back carrying strictly less is stated and deliberate."
  - "Speaking is not a fifth state: confirmed against F-001 AC-29's transition list — no edge in
     F-001's flow diagram is added or removed by any AC here."
  - "`client.speech_prefs` missing from `data-model.md ## Client-side stores` is the only gap of
     its kind. `speech.utterance` and `speech.capability` are transient/derived and that table
     holds only durable stores — all three existing rows have durability contracts — so they have
     no home there by design rather than by omission."
```

Two notes for the orchestrator. First, F1 and F2 together are the precise answer to the briefing's question: the "second rendering of the same object" argument is sound, but the object is `turn.outcome` **plus** `undo_result`, `UndoOutcome` and the error envelope — and it is missing one field the argument assumed (the edited task's title). Only F2 could force a server change; the rest are spec-text fixes. Second, F5 answers Open Question 4 with evidence rather than preference, and F6 asks that OQ 5 be widened before it is answered — both are addressed to `architect` in the spec's own OQ list.

---METRICS---
status: DONE
confidence: HIGH
lens: architect
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
