<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 2, tester-mobile lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent aedb36581ce920c70 -->

I have everything I need. Here is my round-2 return.

---

## Task: T-050 · Feature: F-002 talk-back · Lens: tester-mobile · Round 2 of 2 (final)

**Status: DONE** · **Confidence: HIGH** · **3 HIGH, 0 MEDIUM, 0 LOW**

I examined all 22 live ACs of revision 2 (AC-1…AC-7, AC-9…AC-23; AC-8 retired). Three of my four round-1 HIGHs are closed. **F5 is not closed** and is re-raised at HIGH against the new AC ids. Two new HIGHs sit inside what revision 2 changed.

---

### Closure check on my round-1 findings

| R1 | Verdict | Evidence in revision 2 |
|---|---|---|
| **F1** (HIGH) verification status two-way | **CLOSED** | Three categories restored. I counted the allocation: 10 + 7 + 5 = **22 of 22 live ACs**, none orphaned, none double-listed. The "a ticked box is not a device pass either" caveat is carried from F-003. *But see F13 — three ACs are in the wrong category.* |
| **F2** (MED) AC-10 over-allocated | **CLOSED** | AC-10 moved to category 2 with the reason stated: three of four clauses are what F-003 AC-7 verified headlessly through the `AppLifecycle` double; only the real session release is device. |
| **F3** (HIGH) screen reader mid-sentence | **CLOSED as behaviour** | AC-15 now has start gate + duration subscription + `stopped{screen_reader_activated}` + foreground re-read cadence. Three doors, L-005-shaped. *Its verification allocation is F13.* |
| **F4** (HIGH) foreground session undefined | **CLOSED** | AC-4's four conditions; (d) "same uninterrupted foreground period" is exactly the mobile-lifecycle predicate that was missing, and the reconnect-minutes-later case is constructible against F-003's `Connectivity`/`AppLifecycle` doubles (TC-023/TC-040 already build it). The Out-of-Scope rationale that asserted the opposite is corrected. |
| **F5** (HIGH) silence tautology | **NOT CLOSED → F12** | AC-18 closes the *four-way ambiguity* — each silence now needs its own reason and can no longer borrow another AC's. It does **not** close the tautology, because the positive control it rests on is unassertable. See F12. |
| **F6** (MED) AC-10 tagged `mobile` | **CLOSED** | `(ios, android)`. AC-7, AC-15, AC-19 likewise. |
| **F7** (MED) Android ringer/DND | **CLOSED** | `normal \| vibrate \| silent` enumerated, DND named, suppression on all three, `suppressed{os_silenced}`. The stream question moved into OQ3 with an architect owner. |
| **F8** (MED) Android AT signal | **CLOSED as routed** | AC-15 rejects touch exploration by name; the exact API is OQ3, marked a blocking pre-implementation check. Correct destination — the node tier injects the state, so *which API produced it* can only be settled before implementation, not by a test. |
| **F9** (MED) AC-1 acceptance method | **CLOSED** | Listener speaks `client.interface_language`, has not seen the script, three legs incl. a three-task turn, pass bar 2-of-2. Repeatable. |
| **F10** (MED) network voices | **CLOSED** | AC-11 prefers on-device, and a network-only voice losing connectivity mid-sentence is `stopped{voice_unavailable}` rather than a silent truncation. `on_device: bool` added. |
| **F11** (MED) no constructible no-voice device | **CLOSED — by AC-23, not AC-13** | Worth recording: what makes the precondition constructible is that AC-23 turns interface language into a *declared client setting*, so a tester can point it at a tag with no installed voice. AC-13's four states alone would not have. The residual — no stated way to *set* that tag on a device, since a settings surface is out of scope — is named in Verification status ("a real engine lacking a voice no") and I am not re-opening it. |

---

### Findings

```yaml
findings:
  - id: F12
    severity: HIGH
    acs: [AC-18, AC-19, AC-22]
    re_raise_of: F5 (round 1, HIGH — same severity, new AC ids)
    claim: >
      AC-18(b)'s mandatory positive assertion, AC-19's recorded audio category and
      AC-22's frame-and-slots check all assert on payload that no declared field
      carries: `speech.decision_log`'s entry is `{seq, message_id, decision, reason,
      at}` — no utterance, no frame_id, no slots, no category — and `speech.utterance`
      is explicitly transient and a slot of size one, so it holds no record of any
      utterance that has already ended or been superseded.
    consequence: >
      The only assertable half of "an eligible message must produce a `spoke` entry
      with a non-empty utterance" is `decision === 'spoke'` — a model-written enum.
      A build that resolves eligibility correctly, appends `spoke`, and never calls
      the platform synthesiser satisfies AC-18(b), and therefore satisfies AC-7,
      AC-12, AC-13 and AC-15 exactly as it did in revision 1. This is the same
      failure AC-18(c) forbids on the stop side — "never on the model clearing its
      own field, which is indistinguishable from forgetting to call the platform" —
      left open on the positive side, which is the side the other four ACs depend on.
      AC-19 fares worse: it declares its own node observable ("records the category
      in force at each `spoke`") and there is no field to record it in, so the one
      clause that was meant to catch a build that never switches category is
      unassertable. AC-22's "every spoken utterance is a declared frame" cannot be
      asserted across a sequence at all, because superseded utterances (AC-5) leave
      the size-one slot before a test can read them. Earliest catch is C12 at Gate 2,
      after both clients are built — and C12 mutates source, so a build that logs
      correctly and speaks nothing may survive it too.
    would_not_be_a_finding_if: >
      `## Data`'s `speech.decision_log` row declared the payload the entry carries —
      at minimum `frame_id` + `slots` (or the composed text) on a `spoke` entry, and
      the audio category AC-19 names — and AC-18(b) required the `spoke` entry to be
      written from the port's post-dispatch path rather than by the model deciding to
      speak. Alternatively, if AC-18(b) had said the assertion is on the injected
      platform double's received call rather than on the log.
    directive: >
      Extend the `speech.decision_log` entry shape so a `spoke` entry carries the
      frame_id + slots actually handed to the platform and the audio category in force,
      and state in AC-18 that a `spoke` entry is written only after the synthesiser
      accepted the utterance. Also declare the "port reports not-speaking" surface
      AC-18(c) already relies on — it is referenced by an AC and appears in no section.

  - id: F13
    severity: HIGH
    acs: [AC-7, AC-15, AC-19]
    claim: >
      `## Verification status` places AC-7, AC-15 and AC-19 under "No headless
      observable at all", but each declares a node-tier observable and each is
      named in `## Test strategy`'s enumerated matrix: "Android ringer ×3 + DND"
      (AC-7's suppression decision), "screen-reader on/off × start/mid-utterance"
      (AC-15's mid-sentence stop), and AC-19's own text — "it records the category
      in force at each `spoke` ... so a build that never switches is caught by
      assertion rather than by a device". By the spec's own category definitions
      these are category 2, "node half proven, device residue named".
    consequence: >
      This is the C12 defect that revision 2 fixed for AC-10, reintroduced for three
      other ACs in the same revision — and it lands hardest on the one behaviour my
      round-1 F3 produced. A QA agent allocating work from `## Verification status`
      reads AC-15 as device-lab-only, writes no node case, and the mid-utterance
      screen-reader stop ships with nothing asserting it; the device pass then covers
      only "VoiceOver and the app do not double", which was already true in revision 1.
      L-003's corollary applies directly: an AC whose only assertion lives in a tier
      nobody executes is uncovered in practice while every coverage check reports it
      covered. Concretely, Android ringer=`vibrate` → `suppressed{os_silenced}` is a
      pure node case today and would not be written.
    would_not_be_a_finding_if: >
      AC-7, AC-15 and AC-19 were listed in the second category with their device
      residue named (as AC-5, AC-6, AC-9, AC-10, AC-11, AC-13, AC-20 already are), or
      the third category's heading said "the AC's headline claim needs a device" rather
      than "no headless observable at all" and the node halves were named per AC.
    directive: >
      Move AC-7, AC-15 and AC-19 to the second category, naming the device residue for
      each: AC-7 — the iOS ring/silent switch and real headphone removal (its Android
      ringer/DND suppression is node); AC-15 — a real VoiceOver/TalkBack not doubling
      (its start gate and mid-utterance stop are node, via the injected screen-reader
      state); AC-19 — the real `AVAudioSession` category and session release (the
      recorded category is node). AC-17 is already split this way in prose and would be
      clearer in category 2 for the same reason.

  - id: F14
    severity: HIGH
    acs: [AC-7, AC-18, AC-19]
    claim: >
      On iOS the fully-permissive tuple's last element — "not silenced" — is not a
      state the app can evaluate. AC-7's iOS mechanism is deliberately *not* to read
      the ring/silent switch (it picks `ambient`/`soloAmbient` and lets the OS silence
      the output), and iOS exposes no supported API for that switch, which is why the
      category approach was chosen. So when the switch is silent the app believes it
      spoke and `speech.decision_log` records `spoke` — the log affirms the exact case
      AC-7 forbids sound in.
    consequence: >
      AC-18(b)'s positive control, which the whole falsifiability argument rests on, is
      real on Android (ringer `normal` + DND off is the control) and vacuous on iOS: a
      `spoke` entry is produced whether or not any audio left the device. That leaves
      AC-7's iOS half with no observable at either tier — and the device-lab tester
      hearing silence has no way to distinguish (a) the switch correctly silencing,
      (b) AC-19 failing to leave `playAndRecord` so audio went to the earpiece,
      (c) the TTS engine no-opping. Those three have opposite fixes and one symptom.
      Compounding: AC-7's own text names (b) as the likely default failure mode and
      says it "quietly breaks AC-1" — so the most probable iOS defect is the one the
      device pass cannot name.
    would_not_be_a_finding_if: >
      The spec named what the iOS device tester observes instead of the switch — e.g.
      AC-19's recorded category asserted at each `spoke` on-device, or a positive
      control run with the switch in the ring position as the paired half of every
      silent-switch case — or if AC-18(b) scoped the fully-permissive tuple to the
      states the client can actually evaluate and said so, rather than listing "not
      silenced" as if it were readable on both platforms.
    directive: >
      State that the iOS silent-switch case is verified as a *pair* — one run with the
      switch silenced and one with it in the ring position, same build, same tuple —
      and that AC-19's recorded category is captured in both, so a silent iOS device
      distinguishes correct suppression from a category bug. Note explicitly in AC-18
      that "not silenced" is client-evaluable on Android only.
```

### Checked and found nothing on

- Every mobile-tagged AC names an observable that changes when the behaviour is wrong — **except** the three payload gaps in F12.
- Every prohibition's absence is assertable as a pair (silence + its specific reason), per AC-18(a). Audio escaping to a speaker after headphone removal is covered: `stopped{route_change}`, never re-routed, and the iOS earpiece trap is named inside AC-7 rather than left to the implementer.
- Platform symmetry: AC-7, AC-10, AC-15, AC-19 are `(ios, android)`; AC-16 is `(web)` and pairs with AC-15; AC-13's `installable` is scoped to Android with a reason. No AC silently holds on one platform only.
- Preconditions I could construct from what the spec describes: cancelled-turn late outcome (AC-4c), offline-queued turn on reconnect (AC-4d), outcome arriving while listening (AC-9), supersede mid-utterance (AC-5), Android ringer ×3 + DND (AC-7), all four `voice_for_language` states (AC-13, via AC-23's declared tag), title-miss fallback (AC-21), stop while `foregroundSync` is pending (AC-20a).
- AC-6's "survives process kill" is recorded as device residue in the same words F-003 recorded as its highest-value debt (`qa/assistant/F-003/mobile/index.md` debt item 3) — an unawaited storage write passing headless and losing the setting. Correctly not ticked as proven.
- AC-4's reason vocabulary collapses its four conditions into one `not_eligible` value. Each condition is still separately testable by constructing its precondition, so assertability holds; only the Ops counter cannot attribute a cause. Not raised — MEDIUM at most and the vocabulary was already routed this round.
- `speech.decision_log` is in-memory, so it does not survive AC-6's process-kill case. The node tier's double does, and the device half of AC-6 is already named as debt. Not raised.
- Out of scope for Gate 1 and deliberately not commented on: AC-20's stop-affordance testid and placement (design's dispatch, C14), whether the RN synthesis package permits AC-19's switching (OQ3, architect), the recognizer's `vi-VN`/`navigator.language` drift (recorded as follow-up, not this build).

### Open questions for the human

None requiring escalation. No lens-vs-lens conflict arises from these three: F12 and F13 ask spec-agent for shape and allocation changes only; F14 asks for one sentence of scoping plus a paired device procedure.

**Memory read:** L-002 (config-value assertions vs executed observables — F13, F14), L-003 (a tier nobody executes still counts as coverage — F13), L-005 (one obligation, two doors — AC-15's three doors verified), L-006 (a double whose setter fires the notification — AC-11's connectivity case), L-008 (parsed upstream catalogue — AC-22, and why F12 blocks it).

```
evidence:
  inputs_read:
    - .claude/agents/_ethos.md
    - .claude/agents/_completion-protocol.md
    - .claude/agents/_spec-review-protocol.md
    - .claude/agents/_qa-foundations.md
    - .claude/agents/qa-mobile-agent.md
    - specs/_shared/LEARNINGS.md
    - docs/reports/gate1-review-F-002.md
    - specs/assistant/F-002-talk-back.md
    - qa/assistant/F-003/mobile/index.md
  ac_coverage: all 22 live ACs examined; findings cite AC-7, AC-15, AC-18, AC-19, AC-22
  commands_run:
    - cmd: "ls .claude/agents/ docs/reports/ specs/assistant/ qa/assistant/F-003/mobile/"
      exit: 0
      result: "located all briefing inputs"
  artifacts_written: []
  unresolved:
    - "tradeoff:round-2-scope — MEDIUM/LOW already routed were verified, not re-opened, per the round-2 brief"
```

---METRICS---
status: DONE
confidence: HIGH
lens: tester-mobile
round: 2
findings_high: 3
findings_medium: 0
findings_low: 0
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23]
blockers: []
bugs_filed: []
