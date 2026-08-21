<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 2, tester-web lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a09a07832b2e5d717 -->

I have what I need. Verification changed two of my draft conclusions, so both are recorded below.

## Gate 1 round 2 — tester-web lens, F-002 talk-back

**Verdict:** 4 HIGH (1 re-raise, 3 new in changed text) · 0 MEDIUM · 0 LOW. My round-1 F2, F3, F4, F5, F6 all close. F1 closes in direction but not in substance — the record was declared, its fields were not.

### Closure check on round 1

| R1 finding | Status | Evidence |
|---|---|---|
| **F1** (HIGH) port declares what it receives, never what it records | **PARTIAL — re-raised as H1** | AC-18 + `speech.decision_log` are the right move. But the declared row is `{seq, message_id, decision, reason, at}` — no utterance, no `frame_id`, no `slots`, no `lang`. The clauses that carry the fix assert on fields the record does not have. |
| **F2** (HIGH) AC-9 exclusivity one-directional | **CLOSED** | AC-9 now states both directions; `listening` is in the `suppressed` vocabulary; "not queued for after listening" is explicit. |
| **F3** (MED) AC-14 has no observable; web default-off never exercises speech-on | **CLOSED** | AC-14 now names the announcement surface as the observable and forces `speech_prefs.enabled` true for the web case. F-001 TC-033/TC-034 already assert that live region, so the assertion has a real target. |
| **F4** (MED) AC-12/AC-13 incompatible on one tuple | **CLOSED** | Four-valued `voice_for_language`, AC-12 narrowed to `synthesis: absent`. The 4×2 matrix in Test strategy has no ambiguous cell left. |
| **F5** (MED) AC-3 bundles countable with uncountable | **CLOSED** | The uncountable half moved to AC-22 — a declared frame with at most one title slot cannot produce a listing, so "not a listing" is now structural rather than judged. Residue: nothing constrains a frame to one *sentence*; AC-3's countable rule is "one utterance", which a two-sentence frame satisfies. Not worth a round-2 finding. |
| **F6** (MED) web's stop-trigger set undefined | **CLOSED by construction** | The `stopped` vocabulary is closed and every reason traces to a platform-tagged AC, so web's reachable set derives: `user_stopped · mic_tap · superseded · not_visible · voice_unavailable`. |
| **AC-17 cross-cutting note** | **CLOSED in substance, mis-filed** | The clause is correct and 2.1.1/4.1.2 are called web-provable. But AC-17 appears in *only* the "No headless observable at all" bullet and in neither other category, so a reader building a coverage plan from the three categories still defers all of it. Also 1.4.2's mechanism (AC-6 + AC-20 controls) is DOM-provable and isn't named. Editorial, not a finding. **Correction to my own draft:** I first read "AC-17's F103 half" as a garbled token and nearly filed it. F103 is the W3C failure technique cited in F-001 AC-19 and F-003 AC-12. The reference is correct. |
| My two round-1 LOWs | **Cannot verify** | The round-1 report attributes only F2/F3/F4 and the cross-cutting note to tester-web in its routed list; the two LOWs are in the tally but preserved nowhere by id. Flagging as a process gap, not re-raising content I can't cite. |

### Findings

```yaml
findings:
  - id: H1
    severity: HIGH
    acs: [AC-18, AC-22, AC-23]
    claim: >
      speech.decision_log's declared row is {seq, message_id, decision, reason, at},
      which carries no utterance text, no frame_id, no slots and no lang — so AC-18(b)'s
      "a spoke entry with a non-empty utterance", AC-22's frame assertion and AC-23's
      per-utterance tag all assert on fields the only durable record does not have.
    consequence: >
      The one structure that persists across a run cannot answer what was said. The one
      that carries frame_id/slots/lang (speech.utterance) is a transient slot of size one,
      overwritten by the next message — so Test strategy's "asserts every spoken utterance
      is a declared frame with its slots filled" has nothing to iterate. AC-18(c) makes it
      worse by forbidding assertions on the model's own field, which is the only place
      those values live. This is round-1 F1 one level in: the port's recorded surface was
      declared and then given the fields for the silence half only.
    would_not_be_a_finding_if: >
      The decision_log row carried the utterance text plus frame_id, slots and lang on
      spoke entries, or ## Data declared a second appended record that does.
    directive: >
      Extend the spoke entry to {seq, message_id, decision, reason, frame_id, slots, lang,
      utterance, at}. Suppressed/stopped/degraded entries keep the current shape.

  - id: H2
    severity: HIGH
    acs: [AC-18, AC-2]
    claim: >
      AC-18's mandatory positive clause is quantified over one message ("an eligible
      message must produce a spoke entry"), while AC-2's new table closes an
      eleven-row kind vocabulary — and decision_log "appends one entry per message
      considered", so a kind that never reaches the decision point produces no entry at all.
    consequence: >
      A build that speaks applied outcomes and never wires reverted / nothing-reverted,
      undo-refused, failed-turn or the queued-turn notice passes AC-18(b) on one test,
      passes every silence AC, and leaves no log entry to contradict it. AC-18(a) fails
      "the AC that caused it" — but no AC caused it, so nothing fails. Those four kinds are
      exactly the ones C1 added because a user not looking at the screen needs them most,
      which means the C1 and C4 fixes do not compose: C1 closed the vocabulary, C4 made
      silence falsifiable for one member of it.
    would_not_be_a_finding_if: >
      AC-18(b) read "for every kind marked Speaks=yes in ## What speaks, and from what, an
      eligible message of that kind produces a spoke entry", or AC-2 required each such
      kind to be exercised under the permissive tuple.
    directive: >
      Quantify AC-18(b) over the closed table, and make decision_log append one entry per
      *rendered message of a speaking kind* rather than per message considered, so a kind
      that never reaches consideration is an absent entry the suite can assert on.

  - id: H3
    severity: HIGH
    acs: [AC-21, AC-1, AC-3]
    claim: >
      AC-21 ranks deleted highest in precedence but resolves every non-title-edit through
      "the client looks the id up in its own task list", and F-001 AC-4 states a delete is
      named by title in the outcome message precisely because "no row remains". The local
      lookup therefore misses on the top-precedence kind by construction, while
      turn.outcome.deleted_titles and created_titles — named in this spec's own
      ## API Touch Points — are never wired into the resolution rule.
    consequence: >
      Every delete degrades to the count-only fallback and fires degraded{no_title_resolved},
      including AC-21's own worked example ("deleted Call the dentist, and two more") and
      AC-1's three-task acceptance leg. The signal AC-21 added to make a chronically-missing
      client visible instead fires on the best-supported path, so it reads as normal.
      turn.diff cannot rescue it either — new is null for a delete. UndoResult has the same
      shape problem solved already: it carries {task_id, title} inline.
    would_not_be_a_finding_if: >
      AC-21 named deleted_titles / created_titles as the source for deletes and creates, or
      stated that the local list retains deleted rows until the utterance has composed.
    directive: >
      State the resolution order explicitly per kind: deleted_titles for deletes,
      created_titles for creates, turn.diff.new for title edits, local lookup only for
      non-title edits, UndoResult's inline titles for reverted. Reserve
      degraded{no_title_resolved} for the genuine miss.

  - id: H4
    severity: HIGH
    acs: [AC-4, AC-18]
    claim: >
      AC-4(b) makes document.visibilityState the eligibility gate and a mid-sentence stop
      trigger (stopped{reason: not_visible}) — the only web-specific stop this feature has —
      but Test strategy's injectable list is "capability, voice list, ringer/DND state,
      screen-reader state and completion callback". Visibility is absent from it, while the
      same section's enumerated matrix demands a "tab visible/hidden" dimension.
    consequence: >
      The condition cannot be driven at the tier where it is real. Verified in this repo's
      own browser tier: Playwright exposes no API for it, Emulation.setPageVisibilityState
      is absent from this Chromium build ("wasn't found"), and a second foregrounded page
      leaves the first reporting "visible". The only remaining route is redefining the
      property on the page, which proves the guard reads a stub, not that a hidden tab stops
      audio. Web's every other AC-7-class protection was already conceded to platform
      asymmetry, so this is the whole of web's involuntary-stop story resting on the one
      input the port cannot inject.
    would_not_be_a_finding_if: >
      Test strategy listed a visibility source among the port's injectables, or AC-4(b)
      named the surface's own visibility signal (a lifecycle callback the client owns)
      rather than document.visibilityState directly.
    directive: >
      Add an injectable visibility source to the SpeechOutput port alongside ringer and
      screen-reader state, and phrase AC-4(b) against that source so the browser property
      is one implementation of it.
```

### Checked and found nothing on

- **AC-9 / AC-20 stop, both directions** — tap-during-utterance and outcome-during-listening are structurally different tests with different preconditions (L-005 satisfied); AC-20(a)'s unresolved-`foregroundSync` assertion is stated as *not* awaiting, which is the L-005 remedy stated correctly.
- **AC-13's four states** — each is reachable as a distinct branch, and `resolving`'s bounded timeout gives the wait a terminating observable rather than a hang. OQ5 correctly holds the number.
- **AC-21's miss case is constructible on web** — the QA harness owns the fixture table (F-001 precedent), so an outcome citing a `changed_task_id` absent from the local list is seedable. The fallback branch is reachable; H3 is about it firing on the wrong branch.
- **AC-12 vs AC-16** — hidden control (no synthesis) and off-by-default (opt-in) are distinguishable observables: absent element vs present-and-off.
- **AC-5 supersede** — `stopped{reason: superseded}` plus AC-2's retained text gives a two-part assertion; not satisfiable by a build that drops both.
- **A speaking state is reachable in this project's browser tier** — I assumed headless Chromium had no voices and was wrong: 180 voices, `onstart` at 752ms, `onend` at 4085ms on `about:blank`. AC-20's DOM affordance and AC-17's 2.1.1/4.1.2 therefore have a constructible precondition here, which is why H4 is scoped to visibility alone rather than to the tier. Two cautions for whoever authors this: one utterance costs ~3.3s of real wall-clock that a FakeClock does not control, and this result is macOS-specific — a Linux CI box without a speech engine returns zero voices and never fires `onend`.

### Assessment of the two fixes the briefing asked me to judge

**AC-18 is the right instrument and is currently one notch short of working.** Its aim — make a never-speaking build fail a clause rather than satisfy four — is correct, and the closed vocabulary in a single physical list is the right call against L-004. It fails today for two independent reasons that are both cheap to fix: the record lacks the fields its own positive clause asserts on (H1), and the clause is quantified over one message rather than the kind vocabulary the C1 fix just closed (H2). Fix both and the tautology is genuinely dead; fix neither and AC-18 reads as protection while permitting the build it was written to catch.

**AC-9's second direction closes F2 cleanly.** No residue.

---

- Task: T-050
- Feature: F-002 talk-back
- Status: DONE (review dispatch — no artifacts by design, per `_spec-review-protocol.md`)
- Confidence: HIGH
- ACs examined: all 18 web-tagged (AC-1..AC-6, AC-9, AC-11..AC-14, AC-16..AC-18, AC-20..AC-23). AC-7, AC-10, AC-15, AC-19 are `(ios, android)` and outside this lens; AC-8 is withdrawn.
- Files written: none

```yaml
evidence:
  inputs_read:
    - .claude/agents/_ethos.md
    - .claude/agents/_completion-protocol.md
    - .claude/agents/_spec-review-protocol.md
    - .claude/agents/_qa-foundations.md
    - specs/_shared/LEARNINGS.md
    - docs/reports/gate1-review-F-002.md
    - specs/assistant/F-002-talk-back.md
    - qa/assistant/F-001/web/index.md
    - specs/assistant/data-model.md      # not in briefing — read to verify H3's deleted_titles claim rather than assert it
    - specs/_shared/platform/web.md      # not in briefing — to confirm which tier "node-verifiable" names
    - design/_shared/components.md       # structure only, to confirm row-id tables exist for AC-22's frames
  commands_run:
    - cmd: "node -e '<playwright probe: speechSynthesis voices, speak() lifecycle>'"
      exit: 0
      result: "180 voices; onstart 752ms; onend 4085ms — a speaking state IS reachable headless"
    - cmd: "node -e '<playwright probe: CDP setPageVisibilityState, second-tab focus>'"
      exit: 0
      result: "visibility stays 'visible'; Emulation.setPageVisibilityState wasn't found — H4's evidence"
  unresolved:
    - "tradeoff:round-2-narrowing — new findings held to HIGH per the dispatch; lower-value observations (AC-3 frame sentence count, AC-17's row placement, 1.4.2's unnamed web-provable mechanism) are in the prose, not filed"
    - "broken:round-1-record — my two round-1 LOWs are in the tally but preserved by no id, so closure is unverifiable for them"
```

---METRICS---
status: DONE
confidence: HIGH
lens: tester-web
round: 2
findings_high: 4
findings_medium: 0
findings_low: 0
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-11, AC-12, AC-13, AC-14, AC-16, AC-17, AC-18, AC-20, AC-21, AC-22, AC-23]
blockers: []
bugs_filed: []
