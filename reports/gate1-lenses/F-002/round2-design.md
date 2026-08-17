<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 2, design lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent aa057dda71009faa1 -->

Confirmed. Here is my round-2 return.

---

- **Task:** T-050
- **Feature:** F-002 talk-back (revision 2)
- **Lens:** design · **Round:** 2 (final)
- **Status:** DONE · **Confidence:** HIGH
- **Files written:** none (review dispatch)

## Closure check on my round-1 findings

| R1 | Severity | Verdict | Where |
|---|---|---|---|
| F1 — which kinds speak is never enumerated | HIGH | **CLOSED** | `## What speaks, and from what` + AC-2 |
| F2 — no-voice tuple is a dead control | HIGH | **CLOSED at its core**, two residues | AC-13, AC-12 |
| F3 — AC-9's stop unreachable in 3 of 4 mic modes | HIGH | **CLOSED on existence**, new gap on continuity | AC-20 |
| F4 — the on/off control is never described | MEDIUM | **NEVER ROUTED — re-raised** | now AC-6/12/13/17/20 |
| F5 — exposed state vs stored preference | MEDIUM | **HALF ROUTED — re-raised** | AC-15 fixed the stored half only |
| F6 — cancelled turn's late outcome speaks | MEDIUM | **CLOSED** | AC-4(c) |
| F7 — stopped utterance is uncued | LOW | **CLOSED** | Out of Scope, with the reason stated |

**F1 is a real fix.** The table is a fixed, closed membership — twelve speaking kinds, two explicitly silent — and it names the source object per kind rather than delegating. I can build frame rows against it without picking membership alone. Combined with the resolution-outcome variants already enumerated in `design/_shared/components.md` §Message bubbles, the frame catalogue's row granularity resolves.

**F2's core is fixed** — the four-valued `voice_for_language` removes the `{true, false}` tuple that read ON with permanent silence, and `installable` is a genuine adoption of F-003 AC-4's stated-cause shape. Residue: `unsupported` still leaves a visible control reading ON that never speaks, with "no error surfaced" — the round-1 defect in a milder, annotated form, and the spec never says *where* "says so" is surfaced. That is F5's re-raise.

**F3's existence gap is fixed** and the de-gating from `foregroundSync` is exactly right. But binding the stop to *the speaking message* creates a lifetime problem the spec does not describe — see N4.

## New findings (HIGH only, in changed material)

```yaml
findings:
  - id: N1
    severity: HIGH
    acs: [AC-21, AC-2, AC-1, AC-18]
    claim: >
      AC-21's naming rule is written entirely against `turn.outcome` — precedence
      deleted > edited > created, resolution via `changed_task_ids` / `turn.diff.new`,
      miss recorded as `degraded{no_title_resolved}` — but AC-2 now names three other
      source objects, none of which carries `changed_task_ids` or a diff:
      `turn.undo_result`, the `409 UNDO_REFUSED` envelope, the `500`/`502` envelope,
      and the client-local queued-turn notice.
    consequence: >
      For five of the twelve speaking kinds the "which task" slot has no defined
      filler, and the degraded fallback is not even recordable because it is keyed on
      a local-list lookup those objects never perform. AC-1's new pass bar requires the
      listener to recount *which task* on every leg, so the two kinds F1 was raised to
      rescue — did my undo revert anything, did that fail — come back into the
      catalogue without a way to name their subject. Earliest catch is the design
      dispatch, where I would have to invent per-source precedence alone.
    would_not_be_a_finding_if: >
      AC-21 stated a filler per source object (e.g. `undo_result.reverted[].title` /
      `skipped[].title` with a stated precedence between the two lists), or the
      `## What speaks, and from what` table carried a "names which task" column
      marking the four non-outcome sources count-only.
    directive: >
      Extend AC-21 to the four source objects AC-2 declares — one line each, either
      naming the field the title comes from or declaring the kind count-only — and
      state which of `reverted[]` / `skipped[]` supplies the name.

  - id: N2
    severity: HIGH
    acs: [AC-22, AC-21, AC-3, AC-2]
    claim: >
      `UndoResult` is `{reverted: [{task_id,title}], skipped: [{task_id,title,reason}],
      nothing_reverted: bool}` — two lists and therefore two counts — while AC-22's
      closed slot vocabulary is "a count (integer) and at most one task title". A
      partial revert (2 reverted, 3 skipped) has `nothing_reverted: false`, so it
      selects the success frame and speaks "hoàn tác 2 việc". The three skipped tasks
      have no slot and vanish.
    consequence: >
      F-001 AC-7 requires the reverted message to name **every** skipped task and
      forbids a revert rendering as a success when it was not one. Spoken, a full
      revert and a partial revert are the same sentence, so the user who is not looking
      at the screen — the entire premise of AC-1 — is told work was undone that was
      not. This is not under-informing, it is misinforming, and no silence AC catches
      it: the decision log records `spoke`, correctly. The all-skipped case is safe
      (`nothing_reverted` selects its own frame); only the partial case is unwritable.
    would_not_be_a_finding_if: >
      The slot vocabulary admitted a second count, or an AC required a partial revert
      to select a distinct frame from a full revert (as `nothing_reverted` already does
      for the all-skipped case).
    directive: >
      Either add a second count slot bounded to the revert frames, or add a
      `partially_reverted` frame-selection rule alongside `nothing_reverted`, so a
      revert with a non-empty `skipped[]` can never speak the success frame.

  - id: N3
    severity: HIGH
    acs: [AC-22, AC-3, AC-2]
    claim: >
      AC-3's reasoning — a count, never a per-row reading, detail stays on screen — was
      derived for the *applied* kind and AC-22 then applies its slot vocabulary to all
      twelve. For two kinds the enumeration is not detail, it is the message: no-match
      exists to quote the heard transcript (F-001 AC-14: "a misheard word is
      distinguishable from an absent task") and the confirm question names count **and**
      titles (F-001 AC-9). Neither a transcript nor a title list is in the closed slot
      vocabulary.
    consequence: >
      No-match spoken as a count-only frame makes a mishearing and a genuinely absent
      task the same sentence — the one distinction that kind was designed to carry,
      erased in the channel where the user cannot see the quoted words. Worse for
      confirm: F-001 AC-9 gates a multi-task delete on an affirmative, AC-10/AC-13 let
      that affirmative arrive by voice, so a user answering "vâng" to "Xoá 3 việc?"
      deletes three tasks they were never told the names of. I cannot write either row
      under AC-22 as it stands, and neither is a placement question I can resolve alone.
    would_not_be_a_finding_if: >
      The slot vocabulary carried a verbatim-transcript slot restricted to the no-match
      frame (user-authored text, so L-008's protection against model-authored
      interpolation is untouched), and either a bounded title-list slot for the confirm
      frame or an AC stating a confirm question is not answerable while unread.
    directive: >
      Enumerate slots **per kind** in the same table that enumerates the kinds, and
      resolve these two explicitly. The confirm case is a product decision about a
      destructive action, not a design one — do not leave it to the frame author.

  - id: N4
    severity: HIGH
    acs: [AC-20, AC-17, AC-5, AC-4]
    claim: >
      AC-20 binds the stop affordance to "the speaking message itself", but a message
      stops being the speaking message through events the user does not control:
      AC-5 supersession by a newer message, AC-4(b) tab hide, AC-7 route change,
      AC-15 screen-reader activation. Nothing states what becomes of the control, or of
      focus on it, at that moment.
    consequence: >
      AC-17 names AC-20 as the required mechanism for WCAG 1.4.2 and 2.1.1. Under
      supersession a keyboard or switch user reaching for message A's stop has it
      destroyed under their hand and the live stop reappears on message B — more audio,
      no focus, the mechanism momentarily absent. F-001 already met this exact shape
      with UndoAffordance, whose "gone" state is a *visible* removal plus a retained
      note precisely so history stays honest; AC-20 reproduces the shape for a control
      whose removal is silent and time-critical, and does not invoke that precedent.
    would_not_be_a_finding_if: >
      AC-20 bound the stop to the utterance slot rather than to the message — one
      control with a stable identity, present exactly while `speech.utterance` is
      non-empty — or stated the focus and continuity behaviour across supersession.
    directive: >
      Make the stop's identity the utterance, not the message: one affordance whose
      presence tracks `speech.utterance`, with placement still mine. If it must stay
      per-message, add the continuity clause — where focus goes and whether the control
      persists across a supersession.

  - id: F4
    severity: MEDIUM       # RE-RAISED — round-1 F4, never routed
    acs: [AC-6, AC-12, AC-13, AC-17, AC-20]
    claim: >
      The on/off control is required by five ACs and described by none. Revision 2
      raised what it must render rather than lowering it: hidden (AC-12), on, off,
      installable-with-cause-and-CTA, unsupported-with-cause, resolving (AC-13), plus
      an exposed on/off state (AC-17) — and AC-20 adds a *second* new affordance.
      Placement is still unstated. The composer row is `input + mic + send`
      (`voice-assistant-view.html:925-935`, flex, max-width 720).
    consequence: >
      Two independently hideable siblings now sit in one row — the mic hides on absent
      recognition (F-001 AC-20), the toggle hides on absent synthesis (AC-12) — giving
      four reflow permutations no artifact describes. This finding was raised at round 1
      and appears in neither `reports/gate1-review-F-002.md` nor the revision's
      changelog; it was dropped in consolidation, not declined.
    would_not_be_a_finding_if: >
      The spec named the control's surface region and stated whether it is one control
      with six renderings or a control plus a message, as it does for the mic.
    directive: >
      One line fixing the region and the control-vs-message split. The renderings are
      mine to draw; which surface owns them is not.

  - id: F5
    severity: MEDIUM       # RE-RAISED — round-1 F5, half routed
    acs: [AC-17, AC-15, AC-13, AC-7]
    claim: >
      AC-15 now guarantees suppression never writes the stored preference — the half I
      raised. The other half is untouched: AC-17 requires the control to expose "its
      on/off state", and in four suppression states (`screen_reader_active`,
      `os_silenced`, `no_voice_for_language: unsupported`, `gesture_required`)
      `speech_prefs.enabled` is true while nothing will ever speak.
    consequence: >
      The control announces "on" to a screen-reader user in exactly the state where it
      is permanently mute, which is the dead control AC-12 promises not to ship, wearing
      an accessible name. AC-13's `unsupported` says the cause is stated but also says
      no error is surfaced, so the only place the cause can live is this control — and
      the spec never says it does.
    would_not_be_a_finding_if: >
      AC-17 distinguished the stored preference from the effective state, or AC-13 named
      the surface on which "says so" appears.
    directive: >
      State whether the exposed value is the preference or the effective state, and name
      where the suppression cause is read.
```

## Checked, found sound (anti-theatre)

- AC-2's table is a **closed membership**, not a delegation — 12 speaking kinds, 2 explicitly silent, source object named per row. F1's directive was met in substance.
- AC-21's degraded row **is writable**: for the `turn.outcome` source the count-only fallback is a frame I can author, and `degraded{no_title_resolved}` makes an always-missing client visible rather than merely terse. Creates and deletes carry `created_titles` / `deleted_titles`, so the miss narrows to edits of a non-title field — a small, real set.
- AC-22 pointing the frames at `design/_shared/components.md` and having the test **parse** that file by row id is the correct application of L-008 — drift is caught in the direction it travels. The precedent it cites (`appliedHead()`) is genuinely the third thing between literals and templates.
- AC-13's `installable` matches F-003 AC-4's stated-cause shape, and the spec says it is aligning rather than doing it silently.
- Speaking still adds **no fifth surface state** — F-001 AC-29's four are untouched and the flow diagram is explicitly an utterance lifecycle. Consistent with `components.md` §MicControl's state/mode split.
- AC-4(b) hidden tab, AC-4(c) cancelled turn, AC-16's web opt-in and control description: each is an implied state with a described outcome.
- AC-20 does give the stop an instantiation in all four mic modes, and de-gating it from `foregroundSync` is the right call.

## Noted, deliberately not filed as findings (round 2 is HIGH-only for new items)

1. **AC-13's CTA contradicts the precedent it cites.** `components.md:56` — the F-003 AC-4 language-pack row is words-not-button, **no CTA**, a deliberate choice under §CTA's over-promise rule. AC-13 mandates "a CTA to install the voice" for the sibling case. One of the two siblings will diverge whichever way I write the row. One wording decision, not a blocker.
2. **The `resolving` window is an undescribed state.** An eligible utterance waits (AC-13) with no rendering, no stop affordance yet (nothing is speaking), no `decision_log` entry — the vocabulary is entirely terminal — and a timeout that is OQ5. A build whose voice list never resolves is silent and records nothing until the timeout fires. I can draw the waiting state; I flag it because it is the one branch where AC-18's falsifiability machinery has a hole.
3. `components.md` is titled an F-001 inventory; AC-22 and the Test strategy both write F-002 frames into it. Correct choice — it is the shared inventory — but the title will want a line.

## Judgement asked for in the briefing

**Is the slot vocabulary sufficient for every kind the new table says speaks?** No — for three of the twelve. The applied family, resolution outcomes, questions-as-reports, unsupported-query, unclassifiable and the queued notice all write cleanly under count + one title. Partial revert (N2), no-match (N3) and confirm question (N3) do not, and AC-22 enumerated the kinds without enumerating the slots each kind needs — which is round-1 F1's shape one level down.

**Does AC-21's degraded case have a row I could write?** Yes, for the `turn.outcome` source. Not for the three source objects AC-2 added (N1).

---METRICS---
status: DONE
confidence: HIGH
lens: design
round: 2
findings_high: 4
findings_medium: 2
findings_low: 0
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23]
blockers: []
bugs_filed: []
