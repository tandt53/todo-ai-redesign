<!-- Gate 1 lens return, verbatim. F-002 talk-back, round 2, product lens.
     Written by the orchestrator so per-lens findings survive consolidation into clusters.
     Source: subagent a41eacca00266b4de -->

I have everything I need. Let me record my round-2 findings.

---

# Product lens — Gate 1 round 2, F-002 talk-back

**Verdict: CHANGES REQUESTED** (3 HIGH · 1 MEDIUM · 2 LOW). Two of the three HIGHs are **owner decisions, not spec-agent rewrites** — the gate closes this round, so they go to the human as-is.

Per the briefing I skipped the independent re-derivation and web search. One new technical claim in the revision (Android TTS defaults to the media stream, ringer does not silence it, DND does not suppress it) I checked against my own platform knowledge and **agree with** — no search needed; the disagreement is about the product choice built on top of it.

---

## 1. Closure check on my round-1 findings

| R1 | Landed as | Closed? |
|---|---|---|
| **F1** (HIGH — AC-1 promises *which* task, AC-3 requires a count; both satisfied by "three tasks added") | AC-21 precedence rule (deleted > edited > created, ties by `changed_task_ids` order) + AC-1 gains a three-task leg, listener conditions, 2-of-2 pass bar | **Closed structurally — defeated mechanically.** See H-1. |
| **F2** (offline leg / ADR-11 has no owner) | `## Purpose` ¶3 + Out of Scope + `index.md` + changelog | **Closed, and the correction is honest.** See §2. |
| **F3** (OQ1 open while AC-4 shipped a hard answer) | OQ1 kept open, AC-4's answer labelled **Interim** | **Closed** — but AC-7 now ships a *second, different* answer to OQ1. See H-3. |
| **F4** (AC-8 is not an AC) | Withdrawn in place, substance → asymmetry note, id retired not reused | **Closed.** The retire-don't-renumber call is right: every round-1 finding cites AC ids. |
| **F5** (no web arm on the capability check; WebKit needs `speak()` in a gesture handler, every utterance fires from a network callback) | Asymmetry note + `suppressed{reason: gesture_required}` | **NOT closed.** The substance moved to prose with no AC behind it, and the revision added a promise nothing enforces. See H-2. |
| **F6** (AC-4 doesn't require the surface visible at utterance start) | AC-4(b) `document.visibilityState === "visible"`, hiding mid-sentence stops it, `stopped{reason: not_visible}` in the vocabulary | **Closed**, exactly as asked. |
| **F7** (Ops doesn't count the toggle) | Ops: one counter for AC-6 transitions, on→off and off→on separately | **Closed.** |

---

## 2. Is the corrected F-004 framing honest? Yes — and I checked for other over-claims

I verified the "reserved, not committed" language in **all four** places (`F-002 ## Purpose` ¶3, `## Out of Scope`, the spec changelog row, `index.md` line 13). All four distinguish *product-agent finding + orchestrator relay* from *owner decision*, and the changelog records the mis-framing and its correction rather than hiding it. My `## Purpose` sentence survives verbatim, including the sharper half — "the gap between the two currently has no owner."

The two surviving "binding" claims are about **F-002 itself** and cite D1. I traced D1 to `F-001-voice-assistant-view.md:188`: *"the product owner accepted that on 2026-08-16 (Gate 1 D1) with a binding commitment: F-002 (talk-back, UC-20) is the immediately-next feature."* That is a real, dated, recorded owner commitment. The citation is accurate.

**Other over-claims: I found one, and it is the reverse shape** — not a claim made on the owner's behalf, but a decision *made without noticing it needed an owner*. That is H-3.

I also confirmed the revision does **not** lean on the new ADR-7 owner decision (offline banner vs error page) anywhere in F-002 — correctly, since that decision was about F-001's surface and settles nothing about the spoken day summary.

---

## 3. AC-18 — does the user ever learn *why* it went silent?

**The honest answer: no, and for 15 of the 18 reason values that is the right call. For three it is not, and two of those three are how the feature dies quietly in the field.**

`speech.decision_log` is in-memory, becomes an Ops counter, and has no user-facing half at all. Walking the closed vocabulary:

- **Self-evident to the user** (no surfacing needed): `disabled`, `listening`, `user_stopped`, `mic_tap`, `superseded`, `not_visible`, `not_eligible`, `audio_interruption`, `route_change`, `screen_reader_active`, `screen_reader_activated` — the user did the thing, or the thing is audible/visible on its own.
- **Already surfaced by an AC**: `no_synthesis` (AC-12 hides the control — nothing to offer, correct), `no_voice_for_language` (AC-13 keeps the control visible with the cause stated and a CTA — this is the project's own precedent, and it is good).
- **Not surfaced, and not self-evident**: **`gesture_required`** (H-2), **`os_silenced`** (H-3), and `voice_unavailable` (a network voice cutting out mid-sentence — text remains on screen per AC-2, so no information is lost; acceptable).

So the log is an engineering artifact *by design*, and that is defensible — but AC-13 proves this spec already knows the rule ("absence without explanation reads as breakage"). It applied that rule to one cause and left two uncovered. The two uncovered ones produce the identical user experience AC-12 and AC-13 exist to forbid: **a control that reads ON and never speaks.**

---

## 4. Findings

```yaml
findings:
  - id: H-1
    severity: HIGH
    acs: [AC-21, AC-1, AC-3]
    claim: >
      AC-21's resolution rule cannot produce AC-21's own worked example. Its precedence
      puts DELETED first, but its only two name sources are `turn.diff.new` (title-edits
      only) and "the client looks the id up in its own task list" — and for a delete no
      row remains locally, which is exactly why F-001 AC-4 has the server name deletes by
      title and why `turn.outcome` carries `deleted_titles` (data-model.md:89). AC-21
      never names `deleted_titles` or `created_titles` as sources, so the highest-precedence
      kind routes to the lookup that must always miss.
    consequence: >
      Every delete — the sharpest "did that actually work" case for a user not looking at
      the screen — speaks the count-only fallback and records `degraded{no_title_resolved}`,
      while the title sits unread in the payload. AC-1's promise is unmet for deletes; its
      three legs are create, edit and a 3-task turn, so no leg catches it, and the multi-change
      leg hits it whenever a delete wins precedence. It ships looking like a data problem,
      not a spec bug — `degraded` is the spec's own word for "working as designed".
    would_not_be_a_finding_if: >
      AC-21 named `turn.outcome.deleted_titles` / `created_titles` as the first resolution
      source ahead of the local lookup, or the spec stated that the client retains deleted
      rows long enough for AC-21 to resolve them.
    directive: >
      Reorder AC-21's resolution: `deleted_titles` / `created_titles` from `turn.outcome`
      first, then `turn.diff.new` for title-edits, then the local lookup, then the count-only
      fallback. Add a single-delete leg to AC-1's acceptance method. This changes no contract —
      the fields already exist.

  - id: H-2
    severity: HIGH
    acs: [AC-13, AC-18, AC-12]
    claim: >
      The asymmetry note states that when iOS Safari refuses the gesture the result is
      `suppressed{reason: gesture_required}`, "surfaced rather than silent" — but no AC
      requires any user-visible surfacing, and `speech.decision_log` is in-memory. The same
      note concedes that whether the gesture unlock survives a network round trip "is device
      debt, not a claim", so this is the acknowledged-uncertain path, not a hypothetical.
      (My round-1 F5 asked for the web arm to get a home; it got a prose paragraph.)
    consequence: >
      On the only browser engine available on iOS, a user opts talk-back on (AC-16 makes web
      opt-in, so they chose it deliberately), the device is fully capable, and nothing ever
      speaks with no cause shown. That is precisely the dead control AC-12 promises not to
      ship and AC-13 was rewritten to prevent — reproduced one cause over. An implementer
      violates no AC by building it silent, and a reviewer finds nothing wrong.
    would_not_be_a_finding_if: >
      An AC put `gesture_required` into AC-13's shape (control visible, cause stated), or the
      spec dropped the word "surfaced" and recorded silent-failure-on-iOS-Safari as an accepted
      risk with the owner named.
    directive: >
      Either extend AC-13 to cover `gesture_required` with a stated cause (design owns
      placement), or strike "surfaced rather than silent" and record the silent failure as
      accepted. Do not leave a promise in prose that no AC carries.

  - id: H-3
    severity: HIGH
    acs: [AC-7, AC-6, AC-16]
    claim: >
      AC-7 chooses, on both platforms, to treat talk-back as *incidental sound* rather than
      *content the user asked for* — Android suppresses on `vibrate`, `silent` or DND; iOS uses
      `ambient`/`soloAmbient` so the ring/silent switch kills it. The spec presents this as a
      platform fact ("the OS's silence wins"), but it is a product decision nobody made: round 1
      asked only that the ringer states be *enumerated*, and the revision enumerated them and
      then picked the strictest value set. The platform convention for deliberate voice output
      runs the other way — navigation guidance and media are not silenced by vibrate or by the
      iOS switch; only incidental UI sound is.
    consequence: >
      The differentiator is disabled in the single most common all-day phone state, with no
      cause shown (H-2's shape) and the control still reading ON. It also silently answers
      OQ1 — "when to speak" is open, its interim answer is "every eligible turn", and AC-7
      quietly ships "every eligible turn unless the ringer objects". Those two answers are in
      the same spec, neither cites the other, and the second is arguably the better one — which
      is the reason to decide it deliberately rather than inherit it.
    would_not_be_a_finding_if: >
      AC-7 recorded vibrate/silent-switch suppression as an owner decision with its reason, or
      suppressed only on `silent`/DND and iOS `playback`, or the user got a visible cause when
      suppressed. (Disprovable on evidence too: if the owner's intent is that talk-back is
      incidental sound, AC-7 is already right and needs only to say so.)
    directive: >
      Escalate to the product owner as one question with OQ1: is talk-back content (survives
      vibrate, like navigation voice) or incidental (silenced, like a chime)? Whichever way it
      goes, AC-7 states it as a decision and OQ1 closes or narrows against it. Not a spec-agent
      rewrite — an owner call.

  - id: M-1
    severity: MEDIUM
    acs: [AC-23]
    claim: >
      AC-23 defines `client.interface_language` as "the app's own interface-language setting",
      but no such setting exists — not in F-001, F-003, data-model.md's client-side stores, or
      any design surface, and `## Out of Scope` confirms no settings surface is a deliverable.
    consequence: >
      An implementer looks for the setting AC-23 names, does not find it, and reaches for the
      nearest available value — `navigator.language` — which is the exact drift AC-23 exists
      to stop, reintroduced by AC-23's own wording. (The user-facing half is nil for the
      prototype: all shipped copy is Vietnamese, so a fixed value is correct today.)
    would_not_be_a_finding_if: >
      AC-23 said the value is a build-time constant for this phase, defaulting to the shipped
      copy's language, with a user-facing setting explicitly out of scope.
    directive: >
      Replace "the app's own interface-language setting" with the constant-for-this-phase
      wording, and keep the existing `data-model.md ## Client-side stores` row request.
```

**LOW (2)**

- **L-1 — ADR namespace collision.** F-002 cites ADR-7 and ADR-11, which are the *existing app's* ADRs (`todo-ai docs/01-architecture.md`, per ADR-002's Supersedes line). This repo has its own `specs/_shared/adr/ADR-007-accept-metro-image-size-advisory.md` — a different subject. A reader resolving "ADR-7" against the local ADR directory lands on the wrong document. F-001 disambiguates once ("existing ADR-7"); F-002 never does, in five citations.
- **L-2 — AC-3's "an eval scenario penalises a listing answer"** names an artifact that exists nowhere and has no owner. It is decoration: the same clause's "one turn = one utterance = one sentence" is countable and carries the AC on its own.

---

## 5. AC quality spectrum — the six new ACs

| AC | Level | Flag | Note |
|---|---|---|---|
| **AC-18** decision log | Behavior verification | No | Clause (b)'s mandatory positive assertion is the strongest thing in the revision — it is what converts four jointly-satisfiable silence clauses into falsifiable ones. Residue named honestly: a `spoke` entry proves the *port* was handed a non-empty utterance, not that audio was produced; the spec allocates that to AC-1 (manual/device) rather than pretending otherwise. |
| **AC-19** single arbiter | Behavior verification | No | Observable ("records the category in force at each `spoke`") is a *what*, and catches a build that never switches by assertion. Its second sentence prescribes module topology — a *how* — but AVAudioSession's process-wide singleton forces it. Checked and cleared. |
| **AC-20** stop always reachable | Behavior verification → **user outcome** | No | The strongest of the six. "Never waits for the network" and "reachable in every mic mode" are both user-observable and both cite a real defect on disk. |
| **AC-21** which task is named | Behavior verification | **Yes — see H-1** | Deterministic and well-formed; the resolution rule is simply wrong for its own highest-precedence case. |
| **AC-22** one composer, frames | **Feature presence** | **FLAG** | "Every utterance is a declared frame with its slots filled" proves a frame was used — not that the sentence is understandable to someone who cannot see the screen. Passing AC-22 tells a user nothing. Mitigated, not fixed, by AC-1 being the user-outcome anchor; worth stating so nobody reports AC-22 green as evidence the sentences work. |
| **AC-23** one language source | Behavior verification | No (see M-1) | Sound structure; the wording undermines its own purpose. |

**None at code-existence level.** One at feature-presence (AC-22), flagged.

---

## 6. Anti-theatre checklist — examined, nothing found

- **Over-build check on the revision** (17→22 ACs, 164→224 lines): each new AC traces to a named round-1 cluster; no AC is present without a defect behind it. AC-19 and AC-22 prescribe *how* rather than *what* — both cleared, forced by a platform singleton and by F-003 AC-1's parity contract respectively.
- **"So what?" test** on each new AC: all six change something a user or an operator would notice, except AC-22 (see flag).
- **Goal coverage**: know what it understood (AC-1/2/3/21) · turn it off (AC-6) · stop it (AC-9/20) · don't talk over me (AC-5/9/15) · don't embarrass me (AC-7 — H-3). No user goal in UC-20's minimal scope is unrepresented.
- **Owner-decision audit**: every "binding"/"committed"/"decided" claim in the spec and index traced to a dated record. All accurate; the one problem is the reverse shape (H-3).
- **Round-1 conflict I was asked to close** (product-vs-accessibility on web-off/mobile-on): still no conflict. AC-16 now carries the reasoning and OQ4 carries only the forward-looking half. Closed, correctly.
- **Depth note:** I examined AC-1, 2, 3, 4, 6, 7, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23 at lens depth. AC-5, 9, 10, 14, 15 I read for cross-reference only — my round-1 lens found nothing on them and they are owned by the tester/dev/design lenses.

---

## 7. Routing

- **H-1** and **M-1** → spec-agent, mechanical, no contract change.
- **H-2** and **H-3** → **the human.** H-3 is an owner decision that should be asked together with OQ1; H-2 is a choice between adding a surfacing AC and accepting a silent failure on iOS Safari.
- No lens-vs-lens conflict from my side. H-3 does not contradict tester-mobile's round-1 enumeration request — enumeration stands whichever way the owner rules.

```
- Task: T-050
- Feature: F-002 talk-back
- Phase: review-spec (round 2, final)
- Result: CHANGES REQUESTED
- Report path: none — Gate 1 lenses write no files (_spec-review-protocol.md)
- HIGH issues: 3 — blocks AC-21, AC-1, AC-3, AC-13, AC-18, AC-7
- MEDIUM issues: 1 · LOW observations: 2
- AC quality flags: [AC-22 — feature-presence level]
- Round-1 closure: 5 of 7 closed · F1 closed-then-defeated (H-1) · F5 not closed (H-2)
```

---METRICS---
status: REJECT
confidence: HIGH
lens: product
round: 2
findings_high: 3
findings_medium: 1
findings_low: 2
files_created: []
files_modified: []
tests_passing: 0
tests_total: 0
acs_covered: [AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-11, AC-12, AC-13, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23]
blockers: []
bugs_filed: []
