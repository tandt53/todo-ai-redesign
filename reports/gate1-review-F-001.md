# Gate 1 — multi-lens review of F-001 voice-assistant-view
**Date:** 2026-08-16 · **Round:** 1 of max 2 · **Lenses:** 9/9 returned
**Tally:** 19 HIGH · 45 MEDIUM · 15 LOW (79 findings) · 3 internal AC contradictions
**Status:** 2 decisions escalated to the human; everything else routes to one spec revision.

Lens totals — tester-api 3H/6M/2L · tester-web 1H/5M/2L · tester-mobile 3H/4M/1L ·
dev-backend 2H/5M · dev-web 1H/3M/2L · dev-mobile 2H/4M/1L · architect 2H/7M/2L ·
design 2H/4M/2L · product 3H/7M/3L. Every lens returned findings or a checked list;
none passed by silence.

## Convergence clusters (agreement — one revision item each)

C1 **Undo has no contract.** No endpoint, no undone state, no api tag on AC-4, no
window owner, no create/delete revert shape, no ordering rule vs later mutations
(LWW clobber), no relation to session close. [backend F1 · mobile F2 · web F1 ·
architect F1,F2,F7,F10 · tester-api F3 · product F1]

C2 **STT locus unstated** — on-device vs server decides the turn payload, iOS dual
permission, offline behaviour, Firefox no-API, Chrome-audio-to-Google privacy.
[tester-mobile F1 · backend F3 · web F2 · tester-api F1]

C3 **Idempotency/retry** — no client turn id; retry after timeout double-applies.
UC-25 AC-25.3 already mandates this and the coverage table claims UC-25 covered.
[backend F2 · tester-api F11 · product F3]

C4 **Mobile lifecycle unspecified** — kill/background/interrupt during
listening/thinking/confirming; "loses no words" needs a client-side pending store
the Data section doesn't declare; background+pending-confirmation is the AC-5×AC-13
contradiction. One ## Lifecycle paragraph resolves the family.
[tester-mobile F2,F3,F4 · dev-mobile F1,F3 · design F3]

C5 **pending_confirmation untyped; clarification answer has no route.** UC-54.7
already holds the answer ("a normal spoken turn") — lift verbatim. Also: unrelated
command while pending, silence owner. [backend F4 · web F4 · architect F4 · tester-api F5]

C6 **State lists disagree** — AC-7 says 7, Screen states says 9, flowchart implies
a third count; six implied states missing (reverted, undo-expired, cancelled,
session-auto-closed, resumed/clean, clarify+listening). [design Q1,F2 · tester-web F4]

C7 **Invisible outcomes** — bulk-delete decline routes silently to idle (AC-5×AC-7
contradiction); no-match doesn't echo the heard transcript (mis-heard
indistinguishable from absent); AC-3 diff undefined for create/delete.
[design F1,F6 · tester-mobile F6 · tester-web F2]

C8 **AC-10 empty-range clause requires the deferred UC-54 engine.** Narrow the
clause or widen scope — explicitly. [backend F7 · tester-api F7 · product F2]

C9 **Bundled ACs** — split AC-5 (4 guarantees), AC-8 (3, incl. bare WCAG → name the
concrete criteria), AC-10, AC-4. Rewrite unbounded prohibitions as bounded
presences. [tester-web F5,F6 + theme note · tester-api F9,F4 · product F7]

C10 **API test strategy is one sentence.** Define: stub replaces interpretation
ONLY (turn orchestration/gating/persistence real, or green suites test the stub);
canonical utterance→intent fixture table; failure injection; AI-call counter;
a speech test seam for web (injectable transcript source).
[tester-api F1,F2,F8 · tester-web F1]

C11 **Coverage-table overclaims** — UC-01..04 (latency, datetime, multi-task split,
decomposition), UC-05/09 (anaphora, snapshot freshness), UC-24 (offer-to-record),
UC-52 ("covered" without reading 11-uc-conversation.md — route that file into the
revision briefing). Downgrade to partial or add ACs. [product F4,F5,F6,F9]

C12 **Contract break understated** — "extends chat-intent" actually crosses the
ADR-9 no-real-ids boundary and adds server-side task writes; session table reuse
vs new entity + 30-turn limit fate; turn.status enum missing; AC-1×AC-5 same-turn
contradiction needs a carve-out; atomicity + confirm-time re-validation rules.
[architect F3,F5,F6,F8,F9 · backend F5,F6 · dev-mobile F6]

Also routed: cancel-before-execute (product F8 — market bar), no-speech exit
(product F13), permission-request timing (product F11), offline replay decision
(product F12), transient-recognition-unavailable state for Vietnamese (dev-mobile F5).

## Escalated to the human (genuine conflicts / product-owner calls)

**D1 — Speech output (UC-20) deferral reverses ADR-11.** [product F10]
**DECIDED 2026-08-16 by the product owner:** F-001 ships without voice output;
F-002 (talk-back, UC-20) is the immediately-next feature. Record in Out of Scope
WITH the ADR-11 acknowledgment and the F-002 commitment.

**D2 — AC-5 silence semantics.**
**DECIDED 2026-08-16 by the product owner (refined):** the pending confirmation is
a MESSAGE in the conversation, not an app state. It never blocks the app or other
commands. No timeout. Resolution rules: (a) an affirmative answer executes;
(b) a negative answer declines with a visible outcome message; (c) any unrelated
new command supersedes the confirmation — the bulk delete is treated as declined
and the new command proceeds normally; (d) session close with the question still
unanswered = declined. "Declined" always produces a visible outcome (cluster C7's
silent-decline fix applies here too). This also answers cluster C5's
"unrelated command while pending" question — no queuing, no modal, no lock.

## Round plan
Upon D1/D2 answers → one revision dispatch to spec-agent (this file + the two
answers + 11-uc-conversation.md in the briefing) → one re-review (round 2) → gate
closes either way (round cap).

## Revision 2 changelog (spec-agent, T-002b — for round-2 lenses)

Spec is now 191 lines / 29 ACs. Old→new AC map:

| Rev 1 | Rev 2 | Change |
|---|---|---|
| AC-1 | AC-1 | + atomicity (all-or-nothing); asking turns apply nothing — the question IS the same-turn result |
| AC-2 | AC-2 | + no-speech exit visible, sends no turn |
| — | AC-3 | NEW: cancel while listening/thinking; cancel never pretends |
| AC-3 | AC-4 | + diff shapes for create/delete; no internal refs render |
| AC-4 | AC-5–8 | SPLIT: undo contract — voice+tap; POST /assistant/turn/{turn_id}/undo + turn.undo_snapshot; skip-later-mutations with skipped tasks named; one-level session-bounded window |
| AC-5 | AC-9–12 | SPLIT per D2: confirmation is a message; resolution rules affirmative/negative/supersede/session-close, no timeout; every path visibly resolved; confirm-time re-validation |
| AC-6 | AC-13 | answer = normal turn, tap sends literal text (UC-54.7); supersede applies |
| AC-7 | AC-29 | ONE state count: 4 states, everything else is a message |
| AC-8 | AC-17–19 | SPLIT; WCAG 2.1.1, 4.1.2, 1.4.3, 2.5.3 named |
| AC-9 | AC-20–22 | SPLIT: client STT, text-only payload, permission timing, transient-recognition state, web/mobile offline asymmetry |
| AC-10 | AC-14, AC-15 | no-match bounded + echoes heard transcript; empty-range clause narrowed to Out of Scope |
| AC-11 | AC-23 | unchanged in substance |
| AC-12 | AC-24, AC-25 | SPLIT: AI error vs offline; offline replay = in-flight queue, offline input local path |
| AC-13 | AC-26–28 | SPLIT into Lifecycle: pending store, in-flight resolution, visible close/resume/stale-clean; background+question = nothing changes |
| — | AC-16 | NEW: turn.client_turn_id idempotency |

Structural: POST /assistant/turn/confirm REMOVED (answers are normal turns); /turn/{id}/undo added; turn.status enum + turn.question + turn.undo_snapshot + client.pending_input in Data; chat-intent/ADR-9 contract break stated; ## Test strategy (api) added; coverage table re-derived (6 rows downgraded to partial); D1 in Out of Scope with ADR-11 acknowledgment + F-002-next commitment.

## Round 2 results (T-002c, 2026-08-16)

9/9 lenses returned. **All round-1 clusters confirmed closed.** New/residual:
15 HIGH · 21 MEDIUM · 8 LOW, converging into 7 clusters. No lens-vs-lens
conflict; no owner decision required (product F1's micro-choice resolves from
D2's own logic — an unclassifiable answer is none of D2's four resolution
events, so the question simply stays pending).

Per-lens: tester-api 2H/4M/2L · tester-web 0H/4M · tester-mobile 4H ·
dev-backend 1H/2M/1L · dev-web 1H/1M/1L · dev-mobile 1H/2M · architect 4H/4M ·
design 1H/4M/1L · product 1H/3L.

### Round-2 HIGH clusters → one final revision (T-002d)

R1 **Cancel locus** [dev-web F1 · design F4 · architect F4 · tester-web F2(M)]
— DECISION (orchestrator, no lens dissent): cancel is CLIENT-LOCAL. No cancel
endpoint. The sent turn always runs to completion; cancel returns the surface
to idle with words kept. The late outcome always renders as a message:
applied → applied+Undo ("never pretends the cancel won"); question → the
question message still renders; failed → error message. A cancelled turn that
never reached the server renders nothing. Add cancel-racing-apply to the
failure-injection list.

R2 **One-shot resolution + ordering** [backend F1 · architect F2] — a question
resolves exactly once; server processes a session's turns serially in receipt
order; answers bind to the newest unresolved question (tap sets an explicit
binding); an answer arriving after resolution applies nothing and yields a
visible "already resolved" outcome — it NEVER executes the questioned delete.

R3 **Post-close outcome surface** [tester-api H2 · tester-mobile F4 ·
architect F8] — a clean start renders exactly one boundary message carrying
the closed session's terminal outcomes: close marker, questions declined by
name, and any turn resolved between last-foreground and close (applied/failed,
tasks named). Server returns these on GET /assistant/session (api tag).

R4 **Status machine + retry semantics** [tester-api H1 · architect F7 · F3] —
replace "single terminal transition" with the explicit list: pending →
applied|asked|failed; applied → undone; failed → pending on same-id retry.
Dedupe is per-status: applied/asked/undone replay the recorded outcome; failed
re-attempts. Dedupe scope is account-level with retention ≥ the replay window;
a post-close replay targets the new session and dedupe still recognizes the id.

R5 **Undo server enforcement** [architect F1] — server refuses undo of a
non-newest-applied or closed-session turn with a visible outcome; undo of an
already-undone turn is idempotent (same success outcome, no second revert);
window check + revert are one transaction.

R6 **Mobile parity** [tester-mobile F1,F2,F3 · dev-mobile F1,F2,F3] — AC-21
covers ALL permissions the platform requires for capture+recognition (dual on
iOS, single on Android; any denial = dimmed + re-grant); Lifecycle bullet:
audio interruption (call/Siri/focus loss) while listening = cancel-while-
listening semantics, text preserved; the speech test seam applies to web AND
mobile; the outgoing turn stays in the kill-surviving local store until the
server acks its client_turn_id.

R7 **Unclassifiable answer** [product F1] — only a clearly affirmative answer
executes; an unclassifiable utterance (not affirmative, not negative, not an
interpretable command) never executes and the question stays pending (D2:
still resolvable by answer, supersede, or session close). Fixture table must
carry ambiguous-answer rows asserting zero deletion.

### MEDIUM/LOW routing (append to spec ## Open Questions / small edits in same pass)

Same-pass edits (small, mechanical): AC-4 internal-ref shape + fixture row
(tester-web F3); AC-29 clause bounded to flowchart transitions (tester-web F4);
seam widened to capability/failure injection (tester-web F1); "sync" → concrete
read-back observable (tester-api M1); refusal observables for out-of-window
undo + closed-session turn (tester-api M2, overlaps R5); injectable idle-close
timer (tester-api M3); answer-classifier locus in stub boundary (tester-api M4,
overlaps R7); AC-7/AC-12 change-detection mechanism named once (backend F2 ·
architect F6); undo_snapshot pre-apply/same-transaction/create-derivation
(architect F5); idle-close owner (backend F3 → extend OQ2); web persistence
floor for pending input/queue (dev-web F2); mic-mode for AC-22 (design F1);
flowchart resolution/retry edges (design F2); executed = applied anatomy incl.
Undo (design F3); out-of-window voice undo visible outcome (design F5);
all-skipped undo renders nothing-reverted (design F6); UC-ref citation
normalization "UC-nn AC-nn.n" (3 lenses); atomicity failure injection
(tester-api L1); AC-4 only-turn-changes-marked (product F2); AC-09.2 → numbered
OQ (product F3); AC-15 refusal names the alternative (product F4).

### Gate plan
Round cap reached — no third lens round. T-002d: spec-agent folds R1–R7 + the
mechanical list above; orchestrator verifies by diff + spec-check; gate closes.
