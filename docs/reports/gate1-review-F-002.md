# Gate 1 — multi-lens review of F-002 talk-back
**Date:** 2026-08-17 · **Round:** 1 of max 2 · **Lenses:** 7/7 returned
**Tally:** 19 HIGH · 32 MEDIUM · 8 LOW · **0 lens-vs-lens conflicts**
**Lens set:** tester-web, tester-mobile, dev-web, dev-mobile, architect, design, product.
No api lens dispatched — F-002 carries zero api-tagged ACs by design, and C13 passed
before the lenses ran.

Per-lens: dev-web 4H/4M · tester-web 2H/4M/2L · design 3H/3M/1L · tester-mobile 4H/7M ·
architect 2H/4M/2L · dev-mobile 3H/5M/2L · product 1H/5M/1L. Every lens returned findings
or a checked list; none passed by silence.

## Convergence clusters — each is one revision item

**C1 — Which message kinds speak is never enumerated** [dev-web F2 · design F1 · architect F1]
AC-2 makes `turn.outcome` the sole source, but F-001's Conversation model has nine-to-eleven
message kinds and three carry no `turn.outcome` at all: **reverted** (renders from
`undo_result`/`UndoOutcome`), **undo-refused** (a 409 envelope; on the voice path no turn row
exists), and **failed-turn error** (`TurnOutcome.kind` has no error member). A voice undo is
the sharpest case — unambiguously "a turn the user issued", answered with `kind:"undo",
turn:null`. Consequence: the L-008 catalogue the Test strategy parses has undefined
membership, so design would pick it alone later; and the two kinds excluded are exactly what
a user not looking at the screen needs — *did my undo revert anything* and *did that fail*.

**C2 — `turn.outcome` has no title for an EDITED task** [architect F2]
`created_titles` and `deleted_titles` exist; edits yield `{task_id, field, old, new}` and the
contract forbids rendering uuids. **AC-1's acceptance test is literally one create and one
edit.** On screen F-001 AC-4 solves this because the list supplies the name; speech has no
list. This is the one place the "nothing from the server" claim is genuinely at risk — resolve
by granting a client-side lookup (and naming the miss case: filtered, archived, offline store)
or accept one added response field.

**C3 — AC-4 eligibility lets abandoned turns speak** [design F6 · tester-mobile F4 ·
architect F3 · product F6]
Four lenses, four different doors into one gap. A cancelled turn's late outcome (F-001 AC-3
makes cancel client-local, the turn still completes) speaks. A turn issued then backgrounded
speaks on return — and the Out of Scope rationale *asserts the opposite*, so an implementer
reading it concludes no guard is needed. An offline-queued turn delivered on reconnect has
`replayed: false`, so it speaks minutes later. On web the user can switch tabs during the
round trip and be spoken to in a window they left. Root cause: eligibility keys on `replayed`,
which expresses a dedupe fact, not AC-4's intent.

**C4 — Silence has five causes and one observable** [tester-mobile F5 · tester-web F1]
AC-7 (OS silenced), AC-12 (no capability), AC-13 (no voice), AC-15 (screen reader) all specify
*no sound*; a broken build produces it too. **Every one of these ACs is satisfied by a build
that never speaks at all** — the tautology shape Gate 3 caught in F-003's test file, now
living in the spec where no mutation check reaches it. Compounding: the spec declares what the
SpeechOutput port *receives* and never what it *records*, so the sole observable for "stopped
immediately" is the model clearing its own field — indistinguishable from forgetting the
platform. Ops asks for four stop/suppress counters no declared field can tell apart.

**C5 — The no-voice tuple is a dead control, against this project's own precedent**
[design F2 · tester-web F4 · architect F4 · dev-mobile F6]
`{synthesis_available: true, voice_for_lang: false}` + `enabled: true` is a consistent record
in which the control reads ON and nothing ever speaks. AC-12 hides only on missing *synthesis*,
so its own "no dead control" promise is violated by a state it permits. **F-003 AC-4 ruled the
identical situation one capability over** — recognizer present, no language pack — as *dimmed
with the cause stated, never hidden*, precisely because absence-without-explanation reads as
breakage. F-002 makes the opposite call for the output half and does not say it is doing so.
Android makes it worse: availability is three-way (available / missing-but-downloadable /
unsupported) and the declared shape has two booleans.

**C6 — The interface language has no declared source, and the repo holds three answers**
[dev-web F1 · architect F8]
AC-13 requires every utterance to declare a BCP-47 tag and forbids letting the engine guess,
but nothing in F-001, F-003, data-model or api-contracts declares where that value lives. In
code today: web recognition uses `navigator.language`, mobile hardcodes `vi-VN`, all shipped
copy is Vietnamese, `format.ts` pins `en-US`. On an English-locale machine the web client
would hand a Vietnamese sentence to an English voice — the exact failure AC-13 exists to
prevent, shipping as the default.

**C7 — The iOS audio session has two owners and no arbitration** [dev-mobile F1 · architect F6
· tester-mobile F7]
The only iOS categories the ring/silent switch silences (`ambient`, `soloAmbient`) **cannot
record**; F-003's recognizer needs `record`/`playAndRecord`. `AVAudioSession` is one
process-wide singleton. So AC-7 and F-003 AC-7 cannot both hold without switching category on
every listen↔speak edge, and no AC owns it. The cheap implementation (keep `playAndRecord`)
fails AC-7 outright *and* routes playback to the earpiece unless `.defaultToSpeaker` is set —
quietly breaking AC-1's cover-the-screen test. On Android, TTS defaults to the media stream,
which ringer mode does not silence and DND does not suppress: the default implementation
passes review and fails the AC on every device.

**C8 — AC-9's stop is unreachable on paths that already exist** [dev-mobile F3 (code-verified)
· design F3 · dev-mobile F4 · tester-web F2]
`MobileAssistantController.tapMic()` (controller.ts:294-299) defers the **whole tap** behind
F-003 AC-8's `foregroundSync`, so a tap to stop speech waits for a network round trip whenever
a foreground transition lands mid-utterance — orchestrator verified this on disk. Separately,
the mic has four modes and talk-back keys off a *different* capability, so in three of four
modes AC-9 has no instantiation and the only stop left is disabling the feature. And AC-9
states mutual exclusivity but defines only one direction — an outcome arriving while the mic
is already open has no specified disposition, while the Test strategy demands exactly that test.

**C9 — Screen-reader activation mid-sentence is not a stop trigger** [tester-mobile F3 ·
dev-mobile F7 · architect F7]
AC-15 gates only the *start*. Enabling VoiceOver/TalkBack mid-utterance — the moment a user
most needs it — leaves the app speaking over the screen reader, the exact doubling AC-15
exists to prevent, for exactly the user it protects. L-005's shape: one obligation, two doors,
a guard at one. Also unstated: the re-read cadence for screen-reader state across backgrounding.

**C10 — Literals vs counts is self-contradictory** [dev-web F3]
The spec mandates literals cited by row id and "never an interpolating template" (L-008),
while AC-3 requires a sentence carrying a count and a data-derived standout. A literal cannot
carry "five". The Test strategy compounds it by promising a test that requires every spoken
string to exist as a literal. The existing precedent (`appliedHead()`) is a third thing neither
rule describes: fixed frames with an enumerated numeric slot.

**C11 — Multi-change turns defeat AC-1's promise** [product F1]
AC-1 promises the listener can recount *which* task changed; AC-3 requires multi-task outcomes
to speak a count rather than an enumeration, with "the one that stands out" undefined. Both
are satisfied by "three tasks added", from which the user learns nothing. Multi-item utterances
are where the model most often mis-parses, so the differentiator is delivered for the easy case
and withdrawn for the hard one — and AC-1's own acceptance test scripts only single-task turns,
so the device pass ticks it green while the promise is unmet.

**C12 — Verification status lost F-003's third category** [tester-mobile F1 · dev-mobile F8]
F-003's list is three-way; F-002's is two-way. The missing category — *node half proven, device
residue named* — is where AC-5, AC-6, AC-9, AC-13 belong. AC-6's "survives process kill" is
verbatim the claim F-003 recorded as its highest-value device debt. F-003 protects itself with
"a ticked box is not a device pass either"; F-002 carries the identical claim with no caveat.
Conversely AC-10 is over-allocated to device: three of its four clauses are what F-003 AC-7
verified headlessly.

## Also routed (MEDIUM/LOW, no cluster)
AC-8 is not an AC (product F4 — its substance is a statement that a platform signal does not
exist; C2 would force a test asserting nothing) · web keeps speaking from a hidden tab, the
rejected behaviour is the default there (dev-web F6) · web voice list loads async so "no voice"
and "not loaded yet" are one observable, dropping the first utterance (dev-web F4) · iOS Safari
requires a user gesture per `speak()` and every utterance fires from a network callback
(dev-web F5, product F5) · `speech_prefs` account-scoped would ship web speaking without
consent, so OQ4 answers itself device-local (architect F5) · AC-14's "never suppressed" collides
with F-003's existing, correct `suppressAnnouncements` (dev-mobile F9) · AC-10 tagged `mobile`
where the platforms diverge most (tester-mobile F6) · Android ringer/DND states unenumerated and
OQ5 omits the Android stream (tester-mobile F7, dev-mobile F2) · AC-15's Android signal is
touch-exploration, neither necessary nor sufficient (tester-mobile F8) · AC-1's acceptance
method has no listener-language, prior-knowledge or pass threshold (tester-mobile F9) · AC-11's
"device-local" is false for Android network voices (tester-mobile F10) · AC-17 defers to device
two criteria the web tier already proves (tester-web, cross-cutting note) · AC-14 has no
observable for non-weakening and web's default-off means nothing exercises it (tester-web F3) ·
one composer or two is unstated, and two would fork the sentence (dev-web F8) · stop is
deliberately uncued and should say so (design F7) · Ops does not count the toggle (product F7).

## No conflicts to escalate
Product-agent examined the web-off/mobile-on default specifically for a product-vs-accessibility
clash and **found none**, recording three converging reasons for off-by-default on web and
putting its position on record so the human's escalation budget is not spent here. No other lens
gave an incompatible directive on any AC. Everything above routes automatically to one revision.

## One item for the human, not for a revision
**product F2 — approving F-002 is not approving ADR-11.** AC-4 restricts speech to a turn just
issued and AC-11 states no outcome exists to speak offline, so the spoken surface is exactly
empty offline — the one axis ADR-11 names as the open market position. The offline leg is
carried entirely by the excluded UC-20 AC-20.6 (spoken day summary from local data, no model).
Product's market check makes this sharper: a competitor already ships an offline voice task
manager with on-device NLP, and the 2026 on-device stack has removed the moat that made the
axis empty — the competitor set ADR-11 cites may be stale. Product agrees with excluding
AC-20.6 from F-002 and asks instead for one line in `## Purpose` plus a follow-on feature id
carrying the same binding-next commitment D1 gave F-002.

## Round plan
Round cap is 2. One revision to spec-agent covering C1–C12 and the MEDIUM list, then one
re-review, then the gate closes either way.

## Revision 2 changelog (T-049 — for round-2 lenses)

Spec is 224 lines / 22 live ACs (was 164 / 17). AC-8 retired in place rather than
renumbering — QA and F-003's parity table cite AC ids, so a mid-gate renumber would
break every round-1 finding reference.

| Cluster | Where it landed |
|---|---|
| C1 which kinds speak | AC-2 rewritten to name four source objects; new "What speaks, and from what" table |
| C2 edited-task title | AC-21 NEW — client resolves `changed_task_ids` against its own list (the lookup F-001 AC-4 already does), uses `diff.new` when the edited field is the title, names the miss case and records `degraded{no_title_resolved}`. No contract change |
| C3 AC-4 eligibility | AC-4 rewritten: four conditions, `replayed` demoted; the Out-of-Scope rationale that asserted the opposite is corrected |
| C4 silence tautology | AC-18 NEW + `speech.decision_log` with a closed reason vocabulary, and a **mandatory positive assertion**: under the fully-permissive tuple an eligible message must produce a `spoke` entry with a non-empty utterance. A build that never speaks now fails a clause |
| C5 dead control | AC-13 rewritten four-valued; AC-12 narrowed; aligned to F-003 AC-4's stated-cause precedent, and the spec says it is aligning |
| C6 interface language | AC-23 NEW + `client.interface_language`. The live drift (web `navigator.language`, mobile hardcoded `vi-VN`, copy Vietnamese) is recorded with file:line in Out of Scope — port alignment is F-001/F-003 surface, needs its own task |
| C7 audio session | AC-7 rewritten (iOS forbidden category named, Android ringer + DND enumerated); AC-19 NEW for session ownership |
| C8 stop unreachable | AC-20 NEW — stopping speech is not "new input" and is never gated by F-003 AC-8; the speaking message itself carries the stop so it survives every mic mode; AC-9 gains the second direction (outcome arriving while listening renders silently, not queued) |
| C9 screen reader mid-utterance | AC-15 rewritten: start gate + mid-utterance stop + re-read cadence + the correct per-platform signal |
| C10 literals vs counts | AC-22 NEW — declared frames by row id with a closed slot vocabulary (count + at most one title), adopting what `appliedHead()` already does; the impossible Test-strategy assertion corrected |
| C11 multi-change turns | AC-21 precedence rule; AC-1's acceptance method gains a 3-task leg, listener conditions and a pass bar |
| C12 verification status | Three categories restored; AC-10 de-allocated from device-only; AC-17 split |
| MEDIUM/LOW ×16 | All mapped in the spec's own changelog table |

**Deliberate deviation, declared:** the stop-reason vocabulary lives in one physical list
in `## Data`; Ops cites it rather than restating it. Two copies of an enumerated set is the
L-004 shape.

**Correction applied after revision 2** (orchestrator error, recorded rather than hidden):
the revision framed F-004 as inheriting D1's binding-next status. No owner decision exists —
that was product-agent's finding plus my relay. All four places now read *reserved, not
committed*. The two surviving "binding" claims are about F-002 itself and cite D1, where the
owner's commitment is recorded verbatim.

**Owner decision recorded this round:** opening the app with no network shows the task list
working with an offline banner (chosen over an error page); a drop mid-conversation leaves the
screen normal with a per-turn error. ADR-7's safety net stands as built — F-001 needs no change.

---

# Round 2 — the final review round (T-050)

Seven lenses re-read revision 2 against their own round-1 findings. **25 HIGH · 14 MEDIUM ·
5 LOW.** Round-1 closure is genuinely good — of 38 round-1 findings, 31 closed on the
evidence each lens asked for. The HIGH count is not a re-litigation of round 1; it is
concentrated almost entirely in the **four ACs revision 2 newly wrote** (AC-18, AC-19,
AC-21, AC-22), which is the pattern worth naming before the clusters.

| Lens | HIGH | MED | LOW | Round-1 closure |
|---|---|---|---|---|
| tester-mobile | 3 | 0 | 0 | 10 of 11 closed |
| tester-web | 4 | 0 | 0 | 5 of 6 closed |
| dev-web | 3 | 3 | 0 | 6 of 7 closed |
| dev-mobile | 4 | 5 | 2 | 7 of 9 closed (2 unverifiable — see §R-rec) |
| architect | 4 | 3 | 1 | closed |
| product | 3 | 1 | 2 | 5 of 7 closed |
| design | 4 | 2 | 0 | 5 of 7 closed (2 never routed — see §R-rec) |

**The pattern.** Every one of the four new ACs was written to make something falsifiable, and
each one asserts on a surface that does not exist yet. AC-18 asserts on log fields the log row
does not declare; AC-19 asserts a recorded audio category with no field to record it in and
requires a module topology the shipped ports forbid; AC-21 declares a precedence whose
top-ranked case routes to a lookup that must always miss; AC-22 closes a slot vocabulary
narrower than the kind vocabulary AC-2 opened in the same revision. This is not seven lenses
finding seven unrelated bugs. It is one shape: **revision 2 specified mechanism, and mechanism
has to agree with `## Data` and with the shipped code, which prose obligations did not.**

## Round-2 convergence clusters

### D1 — `speech.decision_log` cannot carry its own assertions (5 lenses, the dominant finding)
`tester-mobile F12 · tester-web H1 · dev-web H3 · dev-mobile H2 · architect H3`

The declared row is `{seq, message_id, decision, reason, at}`. AC-18(b) requires a `spoke`
entry **"with a non-empty utterance"** — there is no utterance field. AC-19 requires the
**audio category in force at each `spoke`** — there is no category field. AC-22's test
asserts **frame + slots** — neither is in the row, and the only place they live
(`speech.utterance`) is a transient slot of size one that AC-5 overwrites on supersession,
so a suite cannot iterate the utterances that already happened.

tester-mobile states the consequence most sharply: *"the only assertable half of AC-18(b) is
`decision === 'spoke'` — a model-written enum. A build that resolves eligibility correctly,
appends `spoke`, and never calls the platform synthesiser satisfies AC-18(b), and therefore
satisfies AC-7, AC-12, AC-13 and AC-15 exactly as it did in revision 1."* That is C4's
tautology reinstated inside the AC written to kill it.

dev-web adds the half that makes it web-specific and worse: **AC-18 never says at which
platform event `spoke` is appended.** `speechSynthesis.speak()` returns void and cannot fail
synchronously; the only honest evidence audio began is `utterance.onstart`. Three web cases
accept `speak()` and emit neither audio nor error — iOS Safari outside a live gesture,
Chromium after `cancel()` in the same tick (which *is* AC-5's supersede path), and a listed
but non-functional voice. AC-18(c) already forbids exactly this reasoning on the stop side
(*"never on the model clearing its own field"*); clause (b) needs the same rule.

**Fix:** extend the `spoke` entry to carry `frame_id`, `slots`, `lang`, the composed
utterance and the audio category in force; state that `spoke` is appended from the port's
**start callback**, not the call site; declare a no-start timeout and the reason it records.
Suppressed/stopped/degraded entries keep the current shape.

### D2 — AC-21's precedence misses deletes by construction (4 lenses)
`tester-web H3 · architect H1 · product H-1 · design N1`

AC-21 ranks **deleted highest**, then resolves the name via `turn.diff.new` (title-edits only)
or *"the client looks the id up in its own task list."* F-001 AC-4 names a delete by title
**precisely because no row remains locally**. So the top-precedence kind routes to the one
lookup guaranteed to miss — including AC-21's own worked example (*"deleted Call the dentist,
and two more"*) and AC-1's three-task acceptance leg. `turn.diff` cannot rescue it: `new` is
null for a delete. Meanwhile `turn.outcome.deleted_titles` and `created_titles` exist on the
wire, are cited in this spec's own `## API Touch Points`, and are never wired into the rule.

The sting is that `degraded{no_title_resolved}` — added to make a chronically-missing client
*visible* — now fires on the best-supported path, so it reads as normal operation. Product:
*"it ships looking like a data problem, not a spec bug — `degraded` is the spec's own word for
'working as designed'."*

design extends the same defect to the source objects AC-2 added: `turn.undo_result`, the
`409 UNDO_REFUSED` envelope, the failure envelope and the client-local queued notice carry no
`changed_task_ids` and no diff, so for **five of twelve speaking kinds the "which task" slot
has no defined filler at all.**

**Fix:** state resolution order per source — `deleted_titles` / `created_titles` from
`turn.outcome` first, `turn.diff.new` for title edits, local lookup only for non-title edits,
`UndoResult`'s inline `{task_id, title}` for reverts — and mark the remaining kinds count-only
in the `## What speaks, and from what` table. Reserve `degraded{no_title_resolved}` for the
genuine miss. No contract change; every field already exists.

### D3 — the slot vocabulary is narrower than the kind vocabulary (3 lenses)
`dev-web H2 · design N2 · design N3`

AC-22 closes slots at *"a count (integer) and at most one task title"*, in the same revision
AC-2 opened membership to twelve speaking kinds. Four kinds carry content that is neither:

- **Clarify question** — its entire content *is* the candidate set (`Message.kind:'question'
  .options`, composed as `Có ${n} việc khớp — bạn muốn việc nào?`). The only permitted
  sentence is *"two tasks match — which one do you want?"*. dev-web: *"talk-back speaks a
  question and withholds its answer set, on the turn where the model was least certain."*
- **No-match** — F-001 AC-14 requires the heard transcript quoted verbatim so *"a misheard word
  is distinguishable from an absent task"*. Spoken count-only, mishearing and genuine absence
  become the same sentence, in the channel where the user cannot see the quoted words.
- **Partial revert** — `UndoResult` is `{reverted[], skipped[], nothing_reverted}`: two lists,
  two counts. A 2-reverted/3-skipped revert has `nothing_reverted: false`, selects the success
  frame, and speaks *"hoàn tác 2 việc"* while three tasks silently stay deleted. F-001 AC-7
  forbids a revert rendering as a success when it was not one. design: **"this is not
  under-informing, it is misinforming"** — and no silence AC catches it, because the log
  correctly records `spoke`.
- **Unsupported-query** — `alternative` is a server-provided string with no slot.

**Fix:** widen the alphabet, keep the closure. Add a bounded ordered title-list slot, a
verbatim-transcript slot (user-authored text, so L-008's protection against model-authored
interpolation is untouched), and a second count bounded to the revert frames — or a
`partially_reverted` frame-selection rule beside `nothing_reverted`. Enumerate slots **per
kind, in the same table that enumerates the kinds.**

### D4 — AC-19's arbiter is not buildable inside this spec's own scope
`dev-mobile H1 (+H2, M5) · tester-mobile F12`

Audio-session ownership today lives in the **recognizer** port:
`NativeSpeechModule.releaseAudioSession()` (`rn-transcript-source.ts:41`),
`RNTranscriptSource.releaseAudioSession()` (`:203-205`), plus the interruption subscription on
`controller.ts:101-103`. `NativeSpeechModule` exposes `start(locale)` / `stop()` /
`releaseAudioSession()` and **no `setCategory` at all**, and `RNTranscriptSource.start()`
necessarily configures the session behind any arbiter's back. So AC-19 is buildable only by
editing three shipped, gate-passed F-003 seams — which this spec's own `## Out of Scope`
forbids — or by standing a second owner beside the existing one, **which is the two-owners
problem AC-19 exists to end.** Earliest catch would be C6 writer-subtree enforcement or a
mobile implementer returning BLOCKED mid-build.

AC-19 also has **no failure branch** (M5): the iOS switch is deactivate → setCategory →
setActive, and `setActive` routinely fails while another app holds the session or a call tears
down. AC-9 makes that edge fire on *every* interruption of an utterance. The closed reason
vocabulary has no value for it, so a build hitting an ordinary platform error violates AC-18
by construction.

**Fix:** name the seam delta explicitly in AC-19 (`NativeSpeechModule` gains a category
operation; `releaseAudioSession` moves to the arbiter; the `controller.ts:101-103` subscription
moves with it) and carve those edits into `## Out of Scope` — as the spec already did in the
opposite direction for the recognizer's language alignment. Add one reason value
(`audio_session_unavailable`) and state the disposition of a failed switch.

### D5 — `os_silenced` spans two mechanisms with opposite observability (3 lenses)
`dev-mobile H3 · tester-mobile F14 · product H-3`

AC-7's iOS mechanism is correct *precisely because the OS does the silencing*: with
`ambient`/`soloAmbient` the hardware switch mutes output and the app is never told. iOS
exposes no supported API for that switch. Therefore **the client cannot emit
`suppressed{os_silenced}` on iOS** — it will record `spoke` with a non-empty utterance while
nothing leaves the device. So AC-18(b)'s positive control, which the whole falsifiability
argument rests on, is real on Android and **vacuous on iOS**.

tester-mobile draws out the diagnostic cost: a device tester hearing silence cannot
distinguish (a) the switch correctly silencing, (b) AC-19 failing to leave `playAndRecord` so
audio went to the earpiece, (c) the TTS engine no-opping. *"Those three have opposite fixes and
one symptom"* — and AC-7's own text names (b) as the likely default failure. Ops' `os_silenced`
counter reads ~0 on iOS forever while being the commonest cause of silence there.

**Fix:** scope AC-18's recording obligation to silences the **client decides**; state that
OS-level muting the platform does not expose is out of the decision log by construction; mark
`os_silenced` Android-and-web-reachable only, and note the iOS counter is structurally zero
rather than leave someone to read it as "never happens". Verify the iOS case as a **pair** —
one run switch-silenced, one switch-ringing, same build, same tuple, AC-19's category captured
in both. *(Whether AC-7 should suppress on vibrate at all is a separate, owner-level question —
see §Human.)*

### D6 — `## Verification status` miscategorises three ACs (2 lenses)
`tester-mobile F13 · dev-mobile H2`

AC-7, AC-15 and AC-19 sit under **"No headless observable at all"**, yet each declares a
node-tier observable and each is named in `## Test strategy`'s enumerated matrix. This is the
C12 defect revision 2 *fixed for AC-10*, reintroduced for three other ACs in the same revision
— and it lands hardest on the mid-utterance screen-reader stop, the behaviour round-1 F3 was
raised to create. A QA agent allocating from this section reads AC-15 as device-lab-only,
writes no node case, and the mid-sentence stop ships with nothing asserting it. L-003 exactly:
*an AC whose only assertion lives in a tier nobody executes is uncovered in practice while
every coverage check reports it covered.*

**Fix:** move all three to category 2 with device residue named per AC — AC-7: the iOS
switch and real headphone removal (its Android ringer/DND suppression is node); AC-15: a real
VoiceOver/TalkBack not doubling (start gate and mid-utterance stop are node); AC-19: the real
`AVAudioSession` category and session release (the recorded category is node). Split AC-17 the
same way.

### D7 — AC-18(b) is quantified over one message, not over the closed table
`tester-web H2`

*"An eligible message must produce a `spoke` entry"* — one message. Meanwhile AC-2 closed an
eleven-row kind vocabulary and the log *"appends one entry per message considered"*, so a kind
that never reaches the decision point produces **no entry at all**. A build that speaks applied
outcomes and never wires reverted / undo-refused / failed-turn / queued-notice passes AC-18(b)
on one test, passes every silence AC, and leaves nothing to contradict it. AC-18(a) fails
"the AC that caused it" — but no AC caused it, so nothing fails. **The C1 and C4 fixes do not
compose:** C1 closed the vocabulary, C4 made silence falsifiable for one member of it.

**Fix:** quantify AC-18(b) over the closed table — *for every kind marked Speaks=yes* — and
append one entry per **rendered message of a speaking kind** rather than per message
considered, so an unwired kind is an absent entry the suite can assert on.

### D8 — AC-4(b)'s visibility gate is not drivable on web and undefined on mobile (2 lenses)
`tester-web H4 · dev-mobile M4`

`document.visibilityState` is web's **only** involuntary stop — every other AC-7-class
protection was conceded to platform asymmetry — and it is absent from `## Test strategy`'s
injectable list while the same section's matrix demands a tab visible/hidden dimension.
tester-web verified this in this repo's own browser tier rather than asserting it: Playwright
exposes no API, `Emulation.setPageVisibilityState` is **absent from this Chromium build**, and
a second foregrounded page leaves the first reporting `visible`. The only remaining route
redefines the property on the page, which proves the guard reads a stub.

On mobile the predicate is simply missing. `AppLifecycle.visibility()` is
`'active' | 'inactive' | 'background'` and the controller handles only two
(`controller.ts:97-100`) — `inactive` falls through. On iOS `inactive` is exactly the
mid-utterance case that matters: notification shade, incoming-call banner, app switcher.

**Fix:** add an injectable visibility source to the `SpeechOutput` port beside ringer and
screen-reader state and phrase AC-4(b) against **that** source, so the browser property is one
implementation of it. Name the mobile predicate over `AppVisibility` including `inactive`
(recommend: stops, `stopped{not_visible}` — same intent as a hidden tab).

### D9 — the stop affordance's identity is the message, and messages stop speaking
`design N4`

AC-20 binds the stop to *"the speaking message itself"*, but a message stops being the
speaking message through events the user does not control: AC-5 supersession, AC-4(b) tab
hide, AC-7 route change, AC-15 screen-reader activation. Under supersession a keyboard or
switch user reaching for message A's stop has it **destroyed under their hand** while the live
stop reappears on message B — more audio, no focus, and AC-17's WCAG 1.4.2 mechanism
momentarily absent. F-001 met this exact shape with `UndoAffordance`, whose "gone" state is a
*visible* removal plus a retained note; AC-20 reproduces the shape for a control whose removal
is silent and time-critical, and does not invoke that precedent.

**Fix:** make the stop's identity the **utterance**, not the message — one affordance present
exactly while `speech.utterance` is non-empty, placement still design's. Failing that, state
where focus goes across a supersession.

### D10 — a mid-sentence `os_silenced` stop is required by two places and by no AC
`dev-mobile H4`

`## Data`'s closed `stopped` vocabulary contains `os_silenced` and the User Flow diagram puts
"silent/DND" on the mid-utterance edge — but AC-7 specifies a **start-time read only**, OQ3
asks only for the state, and the test matrix has no mid-utterance leg (contrast the
screen-reader row, which has one). Implementer and QA both build the start gate;
`stopped{os_silenced}` becomes a dead vocabulary value and a phone flipped to silent
mid-sentence keeps talking. **L-005's shape** — one obligation, two doors, a guard at one —
which this same revision applied correctly to AC-15 and not here. The subscription needs
capabilities absent from OQ3: a `RINGER_MODE_CHANGED_ACTION` receiver and a DND observer.

**Fix:** pick one and make all four places agree (AC-7 text, flow diagram, `stopped`
vocabulary, test matrix). If the subscription is in, add it to OQ3's blocking check.

## Also routed — round 2 MEDIUM/LOW

| Item | AC | Fix |
|---|---|---|
| dev-mobile M1 | AC-7 | Android DND is not boolean: `getCurrentInterruptionFilter()` is `ALL\|PRIORITY\|NONE\|ALARMS\|UNKNOWN`. Under `PRIORITY` — the mode most people leave on a schedule — DND does not attenuate media at all, so "suppress on DND" kills the feature every evening. Enumerate by filter value; decide `UNKNOWN` explicitly |
| dev-mobile M2 | AC-20 | The four mic modes listed are not this codebase's four. Shipped: `SpeechCapability = available \| none \| permission-denied \| transient-failure`. "dimmed" is not a mode; `transient-failure` is missing; "no instantiation in three of them" is false (`tapMic()` has live branches at `:307-310` and `:311-316`; only `none` returns empty at `:301`). AC-20's directive survives — cite the real enum and add a mic-mode axis to the matrix |
| dev-mobile M3 | AC-15 | The new mid-utterance *subscription* has the same touch-exploration defect as the read AC-15 correctly rejects — RN's `screenReaderChanged` derives from the same signal, and OQ3's blocking check covers only the read. Split OQ3 into read + subscribe and state the poll fallback |
| dev-mobile L2 | AC-13 | `resolving` is scoped to the web voice list; Android's engine is not queryable until `OnInitListener` fires, so `on_device` (which AC-11 keys on) is unknown at boot too. Broaden by one clause |
| dev-mobile L1 | AC-10/19 | `AudioInterruptionEvent.phase: 'ended'` is subscribed by nothing; say whether the category is re-asserted per utterance or held |
| product M-1 | AC-23 | `client.interface_language` is defined as "the app's own interface-language setting" — **no such setting exists**, and no settings surface is a deliverable. An implementer reaches for `navigator.language`, the exact drift AC-23 exists to stop, reintroduced by AC-23's own wording. Make it a build-time constant for this phase |
| product L-1 | — | ADR-7 and ADR-11 are the *existing app's* ADRs; this repo has its own `ADR-007` on a different subject. F-001 disambiguates once; F-002 never does, in five citations |
| product L-2 | AC-3 | "an eval scenario penalises a listing answer" names an artifact that exists nowhere and has no owner. Decoration — the countable half carries the AC alone |
| dev-web M1/M2/M3, architect M1–M3 | various | Folded into D1/D3/D7 fixes; see the per-lens returns |
| design "not filed" ×3 | AC-13 | AC-13 mandates a CTA to install the voice; `components.md:56` deliberately gave the sibling case (F-003 AC-4's language pack) **words, no CTA**, under the over-promise rule. One of the two siblings diverges whichever way it is written. Also: `resolving` is an undescribed waiting state with no `decision_log` entry — the vocabulary is entirely terminal, so a build whose voice list never resolves records nothing until the timeout |

## §R-rec — round-1 findings dropped in consolidation, now recovered

**Four lenses independently reported that their round-1 findings had no recorded landing.**
This is an orchestrator defect, not a spec defect: the round-1 report stored only cluster
syntheses, so per-lens findings that did not cluster were lost. dev-mobile: *"Neither appears
anywhere in `docs/reports/gate1-review-F-002.md`. Flagging as a process note for the orchestrator."*
tester-web: *"the two LOWs are in the tally but preserved nowhere by id."* design:
*"raised at round 1 and appears in neither the report nor the changelog; it was dropped in
consolidation, not declined."*

**Structural fix applied this round:** every lens return for both rounds is now written
verbatim to `docs/reports/gate1-lenses/F-002/round{1,2}-{lens}.md` (14 files). Clusters remain the
routing instrument; the returns are the record. Future features should persist returns at
dispatch time, not at synthesis time.

The five lost findings, recovered from the round-1 dispatch transcripts and **routed into the
closing revision**:

| Lost | Sev | Substance |
|---|---|---|
| **dev-web F7** | MED | AC-5's mandated browser sequence — `cancel()` immediately followed by `speak()` — **is the sequence Chromium is known to drop**, and `cancel()` reports its end inconsistently (`end` in some engines, `error: 'canceled'\|'interrupted'` in others). A double with an injectable completion callback passes AC-5 and AC-9 in node while the real browser silently swallows the replacing sentence. *Independently rediscovered by dev-web's round-2 H3, which cites it — so this one returned on its own* |
| **dev-mobile F5** | MED | `AudioInterruptionReason` (`lifecycle.ts:70`) is a deliberately exhaustive union — `call \| system-assistant \| focus-loss \| route-change` — whose comment says *"an unlisted kind cannot silently take a different path."* AC-10 lists the first three; route-change lives in AC-7, under a **different platform tag**, for what is one code path arriving through one callback. L-005's shape arriving pre-built |
| **dev-mobile F10** | LOW | AC-7's "holds transient audio focus rather than ducking others indefinitely" conflates a focus *type* with a focus *release* failure, and as written rules out `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` — the mode actually fitted to a one-sentence utterance. The alternative pauses the user's music once per turn. Reword to constrain the release, not the ducking |
| **tester-web F7** | LOW | AC-2 bundles an observable guarantee with a mechanism guarantee ("never by reading the rendered text verbatim") that has no observable — for a single-task turn, compose-from-outcome and scrape-the-DOM are byte-identical. The one place they diverge observably is AC-3's multi-task turn, and AC-2 does not point at it |
| **tester-web F8** | LOW | AC-6 claims `speech_prefs` survives "reload, backgrounding and process kill" under one web+mobile tag. Web has no observable for process kill distinct from reload, so the AC gets ticked on weaker evidence than it states — the pattern `## Verification status` exists to prevent |

design's F4 and F5 were also never routed; design re-raised both itself at MEDIUM in round 2
(the on/off control is required by five ACs and described by none — placement, and the
control-vs-message split, are unstated while two independently hideable siblings now share the
composer row; and AC-17 exposes "on/off state" while four suppression states leave
`speech_prefs.enabled` true with nothing that will ever speak).

## §Human — three decisions the gate cannot make

Round cap is 2 and is now reached, so these do not get another review round.

1. **Is talk-back content, or is it incidental sound?** (`product H-3`, ties to OQ1.) AC-7
   currently picks the strictest possible reading on both platforms — Android suppresses on
   vibrate, silent *and* DND; iOS uses categories the ring/silent switch kills. Round 1 asked
   only that the ringer states be **enumerated**; the revision enumerated them and then picked
   a value set nobody chose. Platform convention for deliberate voice output runs the other
   way: navigation guidance and media survive vibrate and the iOS switch — only incidental UI
   sound does not. As written, the feature is dead in the most common all-day phone state, with
   no cause shown and the control still reading ON.
2. **iOS Safari's gesture refusal: surface it, or accept a silent failure?** (`product H-2`.)
   The spec says the result is `suppressed{gesture_required}`, *"surfaced rather than silent"* —
   but no AC requires any user-visible surfacing and the log is in-memory. On the only browser
   engine available on iOS, a user who deliberately opted in gets permanent silence with no
   cause. AC-13 already established this project's rule (*absence without explanation reads as
   breakage*) and applied it to one cause. Either extend that shape to `gesture_required`, or
   strike the word "surfaced" and record the silent failure as accepted with an owner.
3. **May a destructive confirmation be spoken without naming what it will delete?**
   (`design N3`.) F-001 AC-9 gates a multi-task delete on an affirmative and AC-10/13 let that
   affirmative arrive **by voice**. Under AC-22's current slots the spoken question is
   *"Xoá 3 việc?"* with no titles — so a user answering "vâng" deletes three tasks they were
   never told the names of. design: *"a product decision about a destructive action, not a
   design one — do not leave it to the frame author."*

## Gate disposition

**Round 2 is the last review round.** One closing revision to spec-agent covering D1–D10, the
MEDIUM/LOW table and the five recovered round-1 findings; then Gate 1 closes with no third
review. Architect's cost ordering stands: **D1 first** (it disarms the fix every silence AC now
depends on), then **D2** (the C2 fix does not cover its own top-precedence case), then **D3**,
then the rest.

The residual risk is stated plainly rather than left implicit: the closing revision lands
**unreviewed**, and rounds 1 and 2 both showed this spec introducing new defects in the act of
fixing old ones. The three §Human items are not blocked on that revision and can be answered
independently.

## §Human — answered 2026-08-17

All three were put to the product owner in plain terms (the concrete sentence each option
produces, not the AC ids) and all three came back the richer way. Recorded here as the
authoritative record; the spec carries them as dated decisions in its changelog.

| # | Question | Decision | What changes |
|---|---|---|---|
| 1 | Is talk-back content or incidental sound? | **Content** — *"vẫn nói, như Google Maps chỉ đường"* | AC-7 reverses: Android does **not** suppress on `vibrate`; DND still does. iOS moves to a category the ring/silent switch does not silence, the opposite of revision 2. Only user-off and DND stop it |
| 2 | iOS Safari gesture refusal — surface or accept? | **Surface it** | `gesture_required` gets a real AC in AC-13's stated-cause shape. The asymmetry note's word "surfaced" becomes true because an AC now carries it, rather than being struck |
| 3 | May a spoken destructive confirm omit the titles? | **No — it must name them** | D3's title-list slot is required, not merely permitted, for the confirm frame. Count-only is not a legal fallback there |

**Decision 1 partly dissolves D5.** The iOS half of `os_silenced` was unrecordable *because*
the spec had chosen to let the OS do the silencing through a category the app cannot observe.
With `playback`, the remaining suppressions — DND and user-off — are all client-decided and
therefore recordable, so AC-18's positive control stops being vacuous on iOS. The revision was
told to check whether D5's exemption clause is still needed at all before writing one.

**One residual, deliberately not inferred.** The chosen option named only DND and manual-off as
silencers, which reads as "Android `silent` ringer mode still speaks" — but the owner was asked
about **vibrate**, not about `silent` as a distinct state. The spec records the decision as
given and carries `silent` as an open question rather than extending the answer to cover it.
