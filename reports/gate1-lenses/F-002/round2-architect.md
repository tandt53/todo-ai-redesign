<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 2, architect lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a0db56d3f9c6fc3c7 -->

I've read the protocols, the round-1 report, revision 2 of the spec, the two unchanged artifacts, and — to settle the load-bearing AC-21 claim — the shipped client code.

## Closure check on my round-1 findings

| # | Round 1 | Verdict |
|---|---|---|
| **F1** | Three kinds carry no `turn.outcome` | **Resolved in substance.** All three named with correct sources (`undo_result`, the 409 envelope, the failure envelope). Residue → M1 below. |
| **F2** | No title for an edited task | **Resolved for the edited case — the claim holds.** Verified on disk, not inferred: `MessageContext.titleFor` exists in `_shared` (`src/assistant/_shared/controller.ts:713`), already resolves ids against `state.tasks` with a `?? null` miss path, and is already consumed for message composition at `src/assistant/_shared/model/messages.ts:65,76,403` — not merely for row marking. The zero-contract-change claim survives. **But AC-21 breaks on its own top-precedence case** → H1. |
| **F3** | Eligibility keyed on `replayed` | **Resolved.** Four conditions, `replayed` demoted. Residue → M2. |
| **F4** | No-voice tuple = dead control | **Resolved.** AC-13 four-valued, visible-with-cause, aligned to F-003 AC-4 and says so. New interaction gap → M3. |
| **F5** | Account-scoped prefs vs AC-16 consent | **Resolved.** Device-local in `## Data`; does not collide with ADR-005 (server session/dedupe scope) — `client.permission_state` is already a per-user client store. |
| **F6** | Who owns the audio session | **Resolved.** AC-19 single arbiter; OQ3 correctly widened to "does the package permit the switch at all" and marked blocking. Its only node observable has no field → H3. |
| **F7** | Screen reader mid-utterance | **Resolved.** Both doors, subscription, foreground cadence, correct Android signal. |
| **F8** | Interface language has no source | **Resolved.** AC-23 + `client.interface_language`. → L1. |

## Findings

```yaml
findings:
  - id: H1
    severity: HIGH
    acs: [AC-21, AC-3, AC-1]
    claim: >
      AC-21 ranks deleted above edited above created, but its resolution rule cites only
      turn.diff (title-edits) and the client's own task list — never created_titles or
      deleted_titles. A deleted task is absent from the local list by construction, so the
      highest-precedence category always falls to the count-only miss path.
    consequence: >
      Every delete speaks "and two more" with degraded{no_title_resolved}, so AC-3's "count
      plus the one task AC-21 names" degenerates exactly where the user most needs the name,
      and AC-1's three-task leg fails its own pass bar. The round-1 gap was the *edited* case;
      deletes were fine because deleted_titles existed — the new rule ignores the field that
      solved it. Secondary: created_titles/deleted_titles are bare string[] with no task_id,
      so pairing them to a changed_task_ids entry needs a positional ordering no contract
      states (messages.ts already assumes one via createdIdx).
    would_not_be_a_finding_if: >
      AC-21 named deleted_titles and created_titles as the resolution sources for those two
      categories, or api-contracts.md stated the ordering that pairs those arrays to
      changed_task_ids, or AC-21 excluded deletes from its precedence.
    directive: >
      Extend AC-21's resolution rule to three sources by category — deleted → deleted_titles,
      created → created_titles (or diff.new), edited → diff.new / local lookup — and state the
      pairing rule, or add task_id to those arrays. No new endpoint needed either way.

  - id: H2
    severity: HIGH
    acs: [AC-2, AC-21, AC-22, AC-3]
    claim: >
      AC-2 now names four source objects, but AC-21 and AC-22 are written entirely over
      turn.outcome. A reverted / nothing-reverted message renders from UndoResult
      ({reverted:[{task_id,title}], skipped:[{task_id,title,reason}], nothing_reverted}),
      which has no changed_task_ids, no diff, and no deleted/edited/created categories — so
      no rule says which task it names.
    consequence: >
      "Did my undo revert anything" is the kind C1 was raised to include, and it is the one
      kind with no naming rule. An implementer applying AC-21 to the undone turn's original
      diff would speak "deleted X" for a message that *restored* X — an inversion, not a
      degradation. Compounding: a partial revert needs two counts (reverted N, skipped M),
      while AC-22's closed slot vocabulary permits one count plus at most one title, so no
      declared frame can express it. The cited precedent appliedHead()
      (src/assistant/_shared/model/format.ts:70) itself takes three counts.
    would_not_be_a_finding_if: >
      AC-21 stated a naming rule per source object, or the ## What speaks table's
      undo_result rows declared their own frame, or AC-22's slot vocabulary admitted more
      than one count.
    directive: >
      Give AC-21 a per-source clause (undo_result → reverted[0].title by its own order;
      nothing_reverted → no title) and widen AC-22's slot vocabulary to the counts the
      enumerated kinds actually need, or declare a per-kind frame with per-kind slots.

  - id: H3
    severity: HIGH
    acs: [AC-18, AC-19, AC-22]
    claim: >
      speech.decision_log's declared entry is {seq, message_id, decision, reason, at}, and
      two ACs assert on observables that shape cannot carry. AC-18(b) requires a `spoke`
      entry "with a non-empty utterance" — there is no utterance field. AC-19's only node
      observable is "records the category in force at each spoke and each listening
      transition" — there is no category field, and a listening transition is not a message,
      while the log is defined as one entry per message *considered*.
    consequence: >
      AC-18(b) is the mandatory positive clause that makes the four silence ACs falsifiable —
      the entire C4 fix rests on it, and as declared it is unassertable, because
      speech.utterance is transient and cleared. QA would assert on an invented field
      (ethos §9) or on the model field AC-18(c) explicitly forbids. AC-19 otherwise sits in
      "no headless observable at all", so losing this one leaves it device-only.
    would_not_be_a_finding_if: >
      The decision_log entry declared an utterance/frame_id+slots field and an audio-category
      field, or AC-19 named a second recorded surface for session transitions.
    directive: >
      Extend the entry to {seq, message_id, decision, reason, frame_id, slots, audio_category,
      at}, and state whether non-message events (listening transitions) append to this log or
      to a separate one.

  - id: H4
    severity: HIGH
    acs: [AC-18, AC-7, AC-9, AC-12, AC-13, AC-15, AC-16]
    claim: >
      The entry carries one `reason` and the spec declares no precedence over the vocabulary,
      while the Test strategy mandates an enumerated (not sampled) matrix — voice_for_language
      ×4 × synthesis ×2, ringer ×3 + DND, screen-reader × start/mid, tab visible/hidden —
      which guarantees cells where two or more suppression causes hold at once.
    consequence: >
      AC-18(a) states that silence recorded with "the wrong reason" fails the AC that caused
      it, so in a multi-cause cell every applicable AC demands its own reason and at most one
      can be satisfied. Two conforming implementations produce different logs, the enumerated
      matrix cannot be authored without picking an order, and Ops' per-reason counters shift
      with implementation order rather than with device behaviour.
    would_not_be_a_finding_if: >
      ## Data declared a precedence order over the suppression reasons, or `reason` were a
      list and AC-18(a) required all applicable reasons.
    directive: >
      Declare the reason precedence explicitly (a rank column on the vocabulary is enough), or
      make reason a set and say the entry records every cause that held.

  - id: M1
    severity: MEDIUM
    acs: [AC-2]
    claim: >
      The "What speaks, and from what" table is declared exhaustive and closed over message
      kinds, but its key does not match the rendered model. `info` — mic-permission and
      transient-recognition-failure guidance (F-001 AC-21/AC-22, src/assistant/_shared/types.ts
      kind:'info' with cta:'permission') — appears in neither the table nor F-001's own
      Conversation model list, so the closure rule silently makes it non-speaking. Conversely
      "queued-turn notice" is listed as a kind but is implemented as queued:true on the `user`
      kind, so the table names a row the model has no discriminator for.
    consequence: >
      A transient recognition failure is exactly the "did it even hear me" case the queued-turn
      row is justified by, delivered as total silence to a user not looking at the screen. And
      because the table is closed, design and QA inherit the omission as a decision rather than
      as an oversight.
    would_not_be_a_finding_if: >
      The table carried an `info` row (speaking or not, with the reason), and keyed the
      queued-turn row on the discriminator the model actually has.
    directive: >
      Add the `info` row with an explicit yes/no, and restate the queued-turn row as
      "user message with queued:true" so the catalogue is keyed on something checkable.

  - id: M2
    severity: MEDIUM
    acs: [AC-4, AC-18]
    claim: >
      AC-4(a) says "this foreground session" and AC-4(d) "the same uninterrupted foreground
      period", and no field in ## Data or data-model records which period a turn was issued in
      — although ## Data claims to enumerate every client-local concern this feature adds.
      Separately the vocabulary offers one reason, `not_eligible`, for all four conditions.
    consequence: >
      An implementer must invent the per-turn marker (client.outgoing_turn holds only the
      payload plus {sent_at, attempts}), and the two terms may or may not name the same thing.
      Observationally the four causes C3 was raised to separate — restored-by-session-read,
      hidden tab, cancelled turn, stale foreground period — collapse into one counter, so the
      C3 fix ships unverifiable per condition.
    would_not_be_a_finding_if: >
      ## Data declared a foreground-period identifier and AC-4 used one term for it, and the
      vocabulary carried a reason per condition.
    directive: >
      Add the per-turn field (in-memory is fine — say so), use one term, and split
      `not_eligible` into four reasons.

  - id: M3
    severity: MEDIUM
    acs: [AC-13, AC-11]
    claim: >
      speech.capability pairs a four-valued voice_for_language with a separate on_device bool,
      and their interaction is undefined. An Android language served only by a network voice
      has no representable value: `available` hides that it is network-only (AC-11's
      stopped{voice_unavailable} case), while `installable` means "state the cause and offer
      the install CTA" — i.e. do not speak — even though a usable network voice exists.
    consequence: >
      The two ACs are both true of the same record and give opposite directives. The Test
      strategy's enumerated matrix lists voice_for_language ×4 × synthesis ×2 and omits the
      on_device axis entirely, so AC-11's network-voice clause — added this revision from
      tester-mobile F10 — has no cell in the matrix that is declared exhaustive.
    would_not_be_a_finding_if: >
      voice_for_language carried a network-only value (or on_device were three-valued:
      on_device | network_only | none), and the matrix included that axis.
    directive: >
      Make the network-only case representable in speech.capability and add the axis to the
      enumerated matrix.

  - id: L1
    severity: LOW
    acs: [AC-23]
    claim: >
      client.interface_language is Required: yes and described as "the app's own
      interface-language setting", but nothing may write it — a settings surface is explicitly
      Out of Scope, and its only stated value is a default derived from shipped copy.
    consequence: >
      It is a build-time constant described as a setting; a later reader looks for the writer
      and finds none, and the row carries no durability contract (unlike speech_prefs via AC-6).
    would_not_be_a_finding_if: >
      The row said "constant this iteration; a settings surface is out of scope", or named
      its writer.
    directive: >
      Say it is a constant for now, and state its durability (or that it has none).
```

## Checked and found nothing (anti-theatre)

- **The zero-server-change claim holds.** Walked every AC against `api-contracts.md` and `data-model.md`: `changed_task_ids`, `diff`, `created_titles`, `deleted_titles` and `undo_result` are all on the wire and carry no "internal — never serialized" marker (unlike `post_apply`, `created_ids`, `pending_op`, `caused_resolutions`, `last_foreground_at`). No AC in revision 2 implies a new endpoint, request field, or response field. `## API Touch Points` is accurate.
- **AC-21's premise is true, verified by execution surface not by reading the spec** — `titleFor` at `src/assistant/_shared/controller.ts:713`, consumed at `src/assistant/_shared/model/messages.ts:65,76,403` with a `?? null` miss path. The lookup exists in `_shared`, so both clients inherit it.
- **`message_id` has a referent and is *not* a finding** — I expected one, since the voice-undo path creates no turn row (ADR-006) and the queued notice has no server object. The reducer already mints a client-local `m{n}` id for every message (`src/assistant/_shared/model/reducer.ts:82-84`), so an in-memory, client-local log keys cleanly.
- **All 18 reason tokens trace to an AC and back**; only AC-19's category and AC-18(b)'s utterance have no home (H3).
- **The L-004 deviation is the right call.** The vocabulary genuinely lives in one physical list; Ops cites it and does not restate it. Two matching lists would have been the drift shape.
- **Device-local `speech_prefs` does not contradict ADR-005** (server session/dedupe scope; `client.permission_state` is already per-user and client-local).
- **Deliberately not raised**: "AC-19's arbiter and AC-22's composer need an ADR" — an artifact that does not exist at Gate 1; and "MANIFEST `## Ownership` has no row for spoken frames in `design/_shared/components.md`" — pre-existing, and L-008 already set that precedent as the reference implementation.

## Answer to the briefing's cross-artifact question

**No — the two missing `data-model.md ## Client-side stores` rows are not the only gap, but they are the only *artifact* gap.** `api-contracts.md` correctly needs no change. The remaining gaps are inside `F-002` itself: the four HIGHs are all under-specification of the new machinery (AC-18/19/21/22), not drift against another file. Ranked by cost if the gate closes as-is: **H3 first** (it disarms the C4 fix that every silence AC now depends on), then **H1** (the C2 fix does not cover its own top-precedence case), then **H2**, then **H4**.

---METRICS---
status: DONE
confidence: HIGH
lens: architect
round: 2
findings_high: 4
findings_medium: 3
findings_low: 1
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23]
blockers: []
bugs_filed: []
