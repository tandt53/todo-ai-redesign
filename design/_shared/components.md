# Component Inventory — todo-ai redesign (F-001)

All values come from `tokens.json` (referenced below as `color.*`, `motion.*`, …; theme resolved at runtime). Interaction behaviour cites the F-001 AC that fixes it — components render the spec's model, they do not reinterpret it. The surface has exactly four states (idle / listening / thinking / error, AC-29); everything below that looks stateful is a **message** or a **mode**, never a fifth state.

Accessibility floor for every interactive component (AC-19): keyboard operable (2.1.1), exposes name/role/value (4.1.2), visible label text == accessible name (2.5.3), contrast per §Contrast (1.4.3). Focus = 2px `color.focusRing` ring, offset 2px, never removed.

---

## MicControl (the orb) — signature component

Purpose: tap-to-talk entry; the one place `gradient.voice` lives. Circular, `radius.orb`, sits in the Composer.

**Surface-state renderings** (follow the four states, AC-29 — each transition has a visible cue):

| Surface state | Rendering |
|---|---|
| idle | quiet orb, `color.bg.raised` fill, mic icon `text.primary`, faint gradient ember (8% opacity) |
| listening | orb fills with `gradient.voice`, `shadow.glowListening`; aurora band blooms behind waveform; live transcript renders as words land (AC-2) |
| thinking | gradient contracts, slides violet-ward (`motion.stateTransition`), slow breath at `motion.duration_ms.auroraBreath`, `shadow.glowThinking` |
| error | glow off; orb rim `color.danger`; error message carries the retry (AC-24) — orb itself returns to idle rendering after the cue |

**Modes** (orthogonal to states — AC-20/21/22; the *message* states which cause, the orb only dims):

| Mode | Rendering | Behaviour |
|---|---|---|
| available | as above | tap → listening |
| dimmed — permission denied | 40% opacity, slash badge | tap → message telling user where to re-grant (AC-21); typing unaffected |
| dimmed — transient failure | 40% opacity, no slash | visible message names the transient cause, distinguishable from permission-denied (AC-22); auto-returns to available on recovery |
| hidden | not rendered, composer reflows | no capability, detected by capability never platform name (AC-20); no error shown |

Control states: default · hover (web: scale 1.04 `motion.easing.spring`) · focused (ring) · pressed (scale 0.94) · dimmed (above; still focusable — screen reader gets the cause) · hidden.
A11y: `role=button`; accessible name follows mode/state ("Tap to speak" / "Listening — tap to stop" / "Microphone needs permission"); state via `aria-pressed` + live-region announcements on state change.

### Permission copy — the eight combinations (F-003 AC-2 iOS · AC-3 Android)

Design owns these strings. `src/assistant/mobile/model/permissions.ts` owns only the selection logic — which permission tuple maps to which row — and cites rows by **ID**. Two capabilities have proper names that never vary and are never lowercased mid-sentence: **Microphone** and **Speech Recognition** (they are the names the OS itself uses in Settings, so a user hunting for the switch reads the same words on both screens). Every body closes on a fixed line, because typing is unaffected in *every* combination (AC-2): denial rows end "Typing still works as usual."; request rows end "Typing still works as usual if you would rather not grant it."

| ID | Combination | Head | Body (line 1) | CTA |
|---|---|---|---|---|
| **IOS-ASK** | mic + speech both `undetermined` — one message covering both grants, at the first talk attempt, never at app open | Asking for microphone access | todo-ai needs Microphone and Speech Recognition to hear what you say and write it down. Your words become text on the device itself. | — |
| **IOS-MIC** | mic `denied` · speech `granted` | Microphone needs permission | Microphone is off (Speech Recognition is already allowed). Turn Microphone on in Settings and the mic lights up again. | Open Settings |
| **IOS-MIC-UNASKED** | mic `denied` · speech `undetermined` — the mic dialog was refused, so the speech dialog was never reached | Microphone needs permission | Microphone is off — with no microphone there is nothing to hear, so todo-ai never got as far as asking about Speech Recognition. Turn Microphone on in Settings and the next time you talk it will ask for the one that is left. | Open Settings |
| **IOS-SPEECH** | mic `granted` · speech `denied` | Microphone needs permission | Speech Recognition is off (Microphone is already allowed). Turn Speech Recognition on in Settings and the mic lights up again. | Open Settings |
| **IOS-BOTH** | mic `denied` · speech `denied` | Microphone needs permission | Both Microphone and Speech Recognition are off. Turn both on in Settings and the mic lights up again. | Open Settings |
| **AND-ASK** | `RECORD_AUDIO` `undetermined` — first talk attempt | Asking for microphone access | todo-ai needs Microphone to hear what you say and write it down. Your words become text on the device itself. | — |
| **AND-DENIED** | denied, not permanent — the OS will still prompt | Microphone needs permission | todo-ai's Microphone permission is off. Tap “Allow microphone”, choose Allow, and the mic lights up again. | Allow microphone |
| **AND-PERMANENT** | permanently denied — the OS never prompts again | Microphone needs permission | todo-ai's Microphone permission is off and Android will not ask again. Turn it on in App info → Permissions and the mic lights up again. | Open app settings |

**Selection key.** Rows are chosen on the full tuple, never on the denied set alone — `denied` and `undetermined` are different facts and the copy distinguishes them. A tuple with **nothing denied** renders no message at all, whatever is still undetermined: mic `granted` · speech `undetermined` is the normal mid-flow state between the two dialogs, not a failure. `undetermined` is never "missing" (permission is requested at the first talk attempt, never at app open). The two tuples not listed are unreachable while the mic is requested first: speech cannot be answered before the mic dialog it precedes.

**CTA.** The label belongs to the row and is not a free choice. **"Allow microphone" promises a prompt, so it appears only on AND-DENIED** — the one row in the table where the OS will still show one. Every other row routes to Settings and says so in words, so the button never over-promises (AC-3).

All four iOS denial rows route to Settings, for two different reasons worth keeping straight. For IOS-MIC / IOS-SPEECH / IOS-BOTH it is because iOS *cannot* re-prompt: once a dialog is answered the OS returns the decision silently. For **IOS-MIC-UNASKED it is a deliberate choice, not a platform limit** — iOS *would* still show the speech dialog here, so a re-request is technically available. We decline it: speech recognition is inert without the microphone, so prompting for it changes nothing the user can perceive and spends the one dialog iOS has left on the wrong question. Settings is the only action that restores the feature. **Consequence for selection logic: on iOS the CTA is `settings` whenever any grant is denied — it must not be derived from "is some grant still askable", which is true in this tuple and yields the wrong button.**

Adjacent, same message family, **not** a permission combination — recognizer present but no pack for the interface language (F-003 AC-4 = F-001 AC-22's transient case: dimmed with a stated cause, never hidden):
**No speech language pack yet** — "This device can recognise speech but has not downloaded the English pack, so it cannot listen for now. Download the pack in system settings and the mic lights up again." + "Typing still works as usual." · no CTA.

## Composer

Purpose: voice + text parity — typed input takes the same interpretation path as speech (AC-17). Text field + MicControl + send. Bottom-docked, `color.bg.raised`, top hairline.

States: empty (placeholder "Say or type what needs doing…") · with-text (send activates) · focused · listening (interim transcript streams into the field, `color.voice.listening` caret) · restored (preserved words from cancel/interruption/background reappear here — AC-3, AC-26) · offline (input still works — local no-AI path, AC-25) · disabled: **never** (the composer is never locked; pending questions block nothing, AC-11).

## Message bubbles (conversation surface)

Chat layout is deliberately Zalo-familiar: user turns right-aligned, assistant left-aligned, `radius.bubble`, body text `text.primary` on `bg.raised` unless a tint is named. Newest at bottom. Every accent below also carries a text label — never colour-only.

| Bubble | Purpose + anatomy | Key states |
|---|---|---|
| UserTurn | the user's words (spoken or typed) — plain bubble, right side | default · queued (see QueuedTurnNotice) |
| Applied | AI applied a turn (AC-1, AC-4): per-field old→new diff rows (`diff.remove` strikethrough old on `removeTint`, `diff.add` new on `addTint`); creates labelled `NEW` with no fabricated old value; deletes named by title; count stated. Carries UndoAffordance | default · undone (marked, `text.muted`, Undo gone — AC-6) |
| Question — clarify | ≥2 matching tasks (AC-13): question text + OptionChips of the **actual candidates** | pending (left `question` accent bar on `questionTint`) · resolved (accent bar off, chips disabled) |
| Question — confirm | bulk delete (AC-9): names count + titles, affirmative/negative OptionChips | pending · resolved (same as clarify) |
| Outcome | resolution results, one bubble per resolution — variants: executed (full Applied anatomy incl. Undo, AC-11) · declined · declined-superseded · already-resolved · undo-refused with reason (AC-6) | variant is content, not colour; executed uses Applied styling |
| Reverted | undo result (AC-7): reverted tasks named; **skipped tasks named**; all-skipped renders "nothing was reverted" wording, never a success | default |
| NoMatch | no matching task (AC-14): message **quotes the heard transcript** in `font.family.body` italic so a mishearing is visible | default |
| Error | AI error (AC-24): `danger` accent bar, plain cause, Retry button (same `client_turn_id`, AC-16); user's words kept in Composer | default · retrying (spinner on button) |
| BoundaryMarker | session close (AC-28): full-width centered hairline marker, `text.muted`, close reason + the closed session's terminal outcomes (questions declined by name, late-resolved turns named). Exactly one per clean start | default |
| QueuedTurnNotice | turn in flight when connection dropped (AC-25): thin note under the UserTurn, "Waiting for the network — will send again" | queued · replaying · resolved (notice disappears, outcome renders) |

Empty conversation state: `font.family.display` line "Say it. I'll write it down." + one `text.muted` hint line. No fabricated sample messages.

## Spoken frames (F-002 talk-back — AC-22)

**Scope note:** this section belongs to **F-002**, not F-001. It is placed here because `specs/assistant/F-002-talk-back.md` AC-22 makes this file the owning artifact for spoken sentence frames, and its test **parses this section by row ID at run time** (L-008 — the assertion fails when the upstream artifact moves, which is the direction drift travels). Nothing above this section changes.

**⚠️ WORDING IS NOT YET WRITTEN — design-agent owns it.** Rows, IDs and slot contracts below are the **spec's** half (F-002 AC-22 + `## What speaks, and from what`); the **Utterance** column is design's deliverable and is deliberately empty. Until it is filled, AC-22's parse test has frames to find and no strings to assert — that is a real, visible dependency rather than a silent gap. spec-agent did not invent Vietnamese copy it does not own.

**The rule** (F-002 AC-22): one sentence per turn, assembled in `{src}/_shared/` by one composer for both clients. A frame is a **fixed string with named slots**, never a free template over model-authored text — the same discipline `appliedHead()` already follows in `src/assistant/_shared/model/format.ts:70`. An utterance that has no declared frame **fails** rather than shipping fluent text nobody reviewed.

**Slot vocabulary — closed, five types, no others:**

| Slot | Type | Notes |
|---|---|---|
| `count` | integer | the primary count |
| `count_secondary` | integer | **revert frames and landing frames** — `UndoResult.skipped.length` for `SPK-REVERTED-PARTIAL`; the unnamed of the two counts for `LSM-OVERDUE-TODAY` / `LSM-PROGRESS` (§ LandingSummary, which widened this cell and says why) |
| `title` | one task title | resolved per F-002 AC-21; never a uuid or draft-ref token (F-001 AC-4) |
| `title_list` | `{titles: string[] (≤ 3), overflow: integer}` | ordered; above 3, name the first 3 and let `overflow` carry the rest ("and N more") |
| `verbatim` | string, **passed through unmodified** | user- or server-authored text (heard transcript, server `alternative`) — quoted, never generated |

| ID | Message kind | Slots it accepts | Utterance |
|---|---|---|---|
| **SPK-APPLIED-1** | applied, one task | `title` | *design-agent* |
| **SPK-APPLIED-N** | applied, one operation, several tasks | `count`, `title` | *design-agent* |
| **SPK-APPLIED-MIXED** | applied, several operations in one turn | `count`, `title` | *design-agent* — mirrors `appliedHead()`'s multi-segment shape |
| **SPK-CLARIFY** | clarify question | `count`, **`title_list`** | *design-agent* — the candidate set **is** the content; a count-only clarify asks a question and withholds its answer set |
| **SPK-CONFIRM-DELETE** | confirm question (bulk delete) | `count`, **`title_list` (REQUIRED)** | *design-agent* — **owner decision 2026-08-17**: a destructive confirmation names the tasks. Count-only is **not** a legal fallback for this row. Shape: "Delete 3 tasks: A, B, C?" |
| **SPK-NOMATCH** | no-match | **`verbatim`** | *design-agent* — F-001 AC-14's heard transcript, so a mishearing stays distinguishable from an absent task |
| **SPK-UNSUPPORTED** | unsupported-query | **`verbatim`** | *design-agent* — the server's `alternative` string |
| **SPK-UNCLASSIFIABLE** | unclassifiable | none | *design-agent* |
| **SPK-RESOLUTION-DECLINED** | resolution — declined | `count` | *design-agent* |
| **SPK-RESOLUTION-SUPERSEDED** | resolution — declined-superseded | `count` | *design-agent* |
| **SPK-RESOLUTION-ALREADY** | resolution — already-resolved | none | *design-agent* |
| *(resolution — executed)* | — | — | no frame of its own: it carries the full applied anatomy, so it selects an **SPK-APPLIED-\*** row |
| **SPK-REVERTED** | revert, nothing skipped | `count`, `title` \| `title_list` | *design-agent* |
| **SPK-REVERTED-PARTIAL** | revert, **some reverted and some skipped** | `count`, `count_secondary`, `title_list` | *design-agent* — **F-001 AC-7**: a partial revert must never render as a success. This row exists because selecting on `nothing_reverted` alone spoke "undid 2 tasks" while three tasks stayed deleted |
| **SPK-REVERTED-NONE** | revert, `nothing_reverted: true` | none | *design-agent* — F-001 AC-7's "nothing was reverted" wording, spoken |
| **SPK-UNDO-REFUSED** | undo-refused (`409`) | none | *design-agent* |
| **SPK-FAILED-TURN** | failed turn (`500` / `502`) | none | *design-agent* |
| **SPK-QUEUED** | queued-turn notice (offline) | none | *design-agent* — silence here is the "did it even hear me" failure F-002 AC-1 exists to prevent |

**Frame selection for reverts is three-way, not two** (F-002 AC-22): `nothing_reverted: true` → SPK-REVERTED-NONE; `skipped` non-empty **and** `reverted` non-empty → SPK-REVERTED-PARTIAL; otherwise SPK-REVERTED.

**Also design's, and not frames** — two *visible* copy lines F-002 introduces, which belong with the message families above rather than in this table: **AC-13** `installable` / `unsupported` — cause stated in words, **no CTA**, matching the language-pack row at `components.md:56` under the over-promise rule; and **AC-24** iOS Safari gesture refusal — the control stays visible with a short line saying the browser blocked the audio and that tapping enables it, clearing on the next successful utterance (owner decision 2026-08-17). Neither is written here yet.

## OptionChip

Purpose: tappable answer to a question — tap sends the option's **literal text as a normal turn** (AC-10, AC-13); a tap binds explicitly to its question's turn. Pill (`radius.pill`), 1px `primary` border, `primary` text.
States: default · hover · focused · pressed · disabled (question resolved — stays visible for history, `text.muted` border) · loading (the sent chip shows the standard sending cue).

## UndoAffordance

Purpose: one-gesture undo of the newest applied turn (AC-5), by tap here or by voice ("undo"). Button inside Applied/executed bubbles: `primary` text + undo icon — violet because reverting is the assistant's own act.
States: default · hover · focused · pressed · gone (a newer applied turn or session close removes it visibly, AC-8 — the bubble keeps a `text.muted` "Undo window passed" note so history stays honest) · undone (replaced by "Undone" label).
A stale/voice undo outside the window renders AC-6's refusal Outcome — the affordance never fails silently.

## TaskRow (+ AI-change marker)

Purpose: the source of truth (F-001 Purpose) — flat row, `radius.taskRow` 0, no border/shadow; checkbox + title + due meta (`text.muted`, tabular).
**AI-change marker (AC-4):** rows in the current turn's `changed_task_ids` get an uppercase text label — `NEW` (`diff.add`) or `EDITED` (`diff.remove→add` per-field old→new on tap-expand) — plus a one-time tint flash (`addTint`/`removeTint`-family background, hold `diffFlashHold`, fade `diffFlashFade`). Only the turn's own changes are marked — hand edits and other turns' rows never attributed. No raw uuids or draft-ref tokens ever render.
States: default · hover · focused · pressed · done (strikethrough `motion` MO-3, 60% fade) · editing (inline, manual path) · flashing (above) · marker-expanded (diff visible) · empty list state ("No tasks yet — say one." + hint).
Manual path: create/edit/complete/delete all doable by touch with zero AI calls (AC-18).

## TaskList

Groups rows by day; hairline section headers (`font.size.label` uppercase `text.muted`). Works untouched when AI is off/erroring/offline (ADR-7). States: default · empty · offline (unchanged — the banner carries the news).

### Day groups after the four buckets (added 2026-08-18, T-128)

For ADR-009 § Amendment. `groupTasks` (`src/assistant/_shared/model/tasks.ts:200`) sorts a
collection's rows into `Today · {date}` · `Tomorrow · {date}` · `Later` · `Anytime` by testing
`dueToday`, then `isTomorrow`, then `due_at !== null`. An overdue row fails the first two and has a
date, so it lands in **`Later`** — a heading that reads *after tomorrow*. Once Today's predicate
widens to `<= today` that heading renders inside the Today collection, and in the live store, where
every dated open row is overdue and nothing is dated today, **the whole of Today renders under one
heading reading `Later`.** Not unhelpful — false, on the collection every account opens, about the
seven rows that are the entire observable effect of the amendment.

**One new group, `Overdue`, tested before `Later`:**

| Heading | Members | Carries a date |
|---|---|---|
| **`Overdue`** | dated **before** today | **no** |
| `Today · {date}` | dated today | yes |
| `Tomorrow · {date}` | dated tomorrow | yes |
| `Later` | dated after tomorrow | no |
| `Anytime` | no date | no |

**`Overdue` carries no date, and the rule that decides is already in the table.** A heading takes a
date when it names exactly one day and none when it names a span — which is why `Later` and
`Anytime` are already bare. Overdue is a span: the set reaches back as far as the account is old,
and one date over it would be true of one row. Grouping per past day instead is honest and turns
seven late tasks into seven single-row headings, burying the one fact that matters under a date
list. No row loses its date — § TaskRow already renders due meta, tabular — it stays at the
altitude where it is a fact about a task rather than a claim about a set.

**`Overdue` is the word, and it is deliberately not the summary's.** § LandingSummary says *"past
their date"* because a sentence can state a fact; a heading has to name a set, and a set needs a
noun. `Overdue` is the word this project's own record uses throughout and the word every app the
audience opens daily uses — recognition is a UX asset and a heading is not where the novelty budget
is spent. Rejected: `Missed` and `Behind`, which judge the user; `Past due`, a synonym with no
advantage; `Before today`, which recites the predicate instead of naming the set.

**One signal, not two: nothing on the row changes.** The heading carries lateness for the whole
set, so § TaskRow gets no overdue badge, no red date and no icon. Two signals for one meaning read
as alarm and dilute each other — and in the live store that badge would sit on seven rows out of
seven, an alarm with nothing to contrast against.

### Which collections group at all, and in what order

**Order first, because it needs no new principle.** `Overdue` sits **above** `Today · {date}`. The
group set is a time axis and it already runs earliest to latest; overdue is earlier than today, so
it extends the axis backwards by one step and the set stays monotonic —
`Overdue → Today → Tomorrow → Later → Anytime`, dateless tail last as it already is.

**This agrees with § LandingSummary's ranking, and it is not the same argument.** Worth separating,
because a shared conclusion is evidence rather than proof. There, ranking overdue first decides
whether a missed task is **named at all**: the summary is one sentence, and a set left out of it is
mentioned nowhere in the app. In a list every row is present at every ordering — nothing appears or
disappears, and order decides only what the eye meets first. That argument is about silence; this
one is about chronology, and this one is the weaker of the two. That is the right outcome: it needs
no appeal to priority, so nothing here rests on the ranking above surviving review.

**A heading earns its place only when the collection can produce more than one.** A heading true of
every row restates the collection's name in a different word; a heading a collection can never
produce is dead structure. Against the four buckets:

| Collection | Groups | Why |
|---|---|---|
| **Today** | `Overdue`, then `Today · {date}` | Two, both true. `Tomorrow`, `Later` and `Anytime` are unreachable here by the predicate. This is also the only surface anywhere that names a task as missed — `overdue` has no collection of its own (§ LandingSummary) |
| **Upcoming** | `Tomorrow · {date}`, then `Later` | Tomorrow is the actionable edge of a future collection. `Overdue`, `Today` and `Anytime` are unreachable. `Later` is coarse — routed below |
| **Inbox** | **none — flat** | Inbox *is* "no date", so `Anytime` is true of every row it can ever hold. That heading is the collection's name said a second time |
| **Done** | **none — flat** | The one that would ship a new falsehood — below |

**Done must not day-group, and `Overdue` is exactly why.** Done is the one status predicate, so it
holds rows with any date or none, including rows whose `due_at` is long past. Group Done by `due_at`
and a task finished this morning appears under **`Overdue`** because it was due last week. It is not
overdue; it is done. The fact a reader wants here is *when I finished*, which is `completed_at`,
which does not exist — § LandingSummary's "The one shape that is blocked" names the same missing
field for the same reason, and this is a second surface waiting on it. Note the shape: the fix for
one false heading would have introduced a fresh one on the collection nobody thought to check.

**Routed, not filled — `Later` is coarse on Upcoming.** Every Upcoming row is dated after today, so
`Later` catches everything that is not tomorrow: next week and next year under one word. Nothing
false renders, which is why it is not decided here. The honest alternatives — per-day headings, or a
this-week / later split — are layout judgements about a collection with **no member anywhere in the
live store**, and choosing between them against zero rows is choosing against nothing. It needs a
screens pass with seeded data, and it blocks nothing: the collection is correct and reachable
without it.

## OfflineBanner

Purpose: no half-running conversation (AC-25) — full-width thin note above the Composer, `bg.raised`, `question` accent text: "No connection — the list still works, and what you type is saved on the device." Shows queued-turn count when one is in flight.
States: offline · offline-with-queued (count) · replaying · hidden (online).

## NewMessageAffordance

Purpose: BUG-004 / **owner decision 2026-08-17** — when messages arrive while the user is not at the bottom, **the view does not move**; one control near the Composer says so, and tapping it scrolls to the newest message. **One control, however many messages arrived** — it never multiplies and there is never one per message.

Placement: a pill, horizontally centred, docked just above the Composer (above the OfflineBanner when that is showing). It **overlays** the last line of the conversation rather than reflowing it: an affordance that appears by pushing history upward moves the sentence the user is reading, which is the defect it exists to prevent. `radius.pill`, `shadow.raised`, `padding: sm lg`, `font.size.body` at `font.weight.emphasis`, down-arrow icon at `icon.size.sm`.

**Why the label carries a state.** The owner was offered a carve-out that would have scrolled a bulk-delete confirmation into view and declined it (decision rule 5), so a destructive question can sit unseen behind this one control while the app waits for an answer. That consistency was chosen knowingly, and its whole cost lands here: this control is the user's only indication that anything is pending. A label reading the same whether the app is idle or blocked on an answer would spend the consistency and return nothing. So the affordance **names its newest reason**: with nothing pending it reports a count; with a question pending off screen it stops reporting and asks, quoting the question's own head and taking the `question` accent that already means *open question* everywhere else in this catalogue. One control, one position, one action, one tap target — only the words and the accent change.

| ID | State | Shown when | Label | Rendering |
|---|---|---|---|---|
| **NMA-HIDDEN** | hidden | the newest message is on screen — after a tap, and after the user reaches the bottom by hand | — | not rendered; it holds no layout, so nothing reflows when it goes |
| **NMA-NEW** | new | ≥1 message arrived while the newest was off screen, and **no** question is pending off screen | `1 new message` · `{count} new messages` | `bg.raised`, 1px `hairline` border, `text.primary`, arrow `text.secondary` |
| **NMA-WAITING** | waiting on you | a question (clarify or confirm) is **pending** and off screen — whatever else also arrived | `Waiting for your answer — {question}` | `questionTint` fill, 1px `question` border, `question` text and arrow |

**Slots** (same closed vocabulary as §Spoken frames): `count` integer — the two literal forms above are the whole set, singular and plural, not a template over a noun. `{question}` is `verbatim`: the pending question's own head as §Message bubbles publishes it ("Delete 3 tasks?", "“Meeting” matches two tasks — which one?"), never re-worded for the pill. The label is one line where it fits and **two at most** where it does not (RN `numberOfLines={2}`); the accessible name keeps the whole string either way. The second line is not cosmetic: at 375px a single non-wrapping line ellipsises the question away and leaves "Waiting for your answer — Delete …", which announces that something is pending and withholds what — the exact failure this row exists to prevent. NMA-NEW never needs the second line.

**Precedence is one rule, not a special case.** NMA-WAITING outranks NMA-NEW whenever a question is pending, because a count cannot say the app is waiting. A question that has resolved — answered, or declined by a later unrelated turn (§Outcome *declined-superseded*) — is no longer pending, so the control falls back to NMA-NEW. **This is not the carve-out the owner declined:** the view still never moves on its own, for this message or any other.

**Tapping only scrolls.** It never answers, dismisses or resolves anything — the question's OptionChips remain the only way to answer (AC-10), so the pill cannot become a second, quieter answer path.

Control states: default · hover (web: fill lifts to `primaryTint`; NMA-WAITING keeps its own tint) · focused (ring) · pressed (scale 0.96) — the §Buttons behaviours, unchanged.

A11y: `role=button`; the accessible name is the visible label followed by the action, so the visible text is always a prefix of the name and never a replacement (2.5.3). Two literals, because the punctuation differs and a template would guess: NMA-NEW → `{label}, scroll to newest`; NMA-WAITING → `{label} Scroll to newest` (the label already ends in a question mark, so the action is a new sentence, not a clause). The dock is a `polite` live region, so a screen-reader user hears the control arrive **and** hears it change from NMA-NEW to NMA-WAITING. Keyboard: it sits in DOM order between the conversation and the Composer, so `Tab` out of the conversation reaches it before the input. Hit area follows the platform minimum (44pt / 48dp) via `hitSlop`; no content-width floor is published in §Touch, because those floors are measured from a shipped control and this one does not exist yet.

**It does not depend on motion.** Presence, wording and accent carry the whole meaning; under `prefers-reduced-motion` / reduce-motion the control appears and reads identically and only the scroll it triggers changes.

Testid: `assistant-new-message-affordance` — one id on the control in all three mockups, exercised by the `nma-new` and `nma-waiting` mockup states (the state names are the row IDs).

## SessionMarker

The idle-auto-close marker (AC-28) — same rendering family as BoundaryMarker; a resumed open session renders **no** marker (resume is visible by the conversation simply continuing). States: closed-idle · closed-with-declines (names them) · none.

## Buttons

Variants: primary (fill `primary`, text `text.onAccent`) · ghost (text `primary`, no fill) · danger (fill `danger`, text `text.onAccent` — confirm-delete contexts only).
States: default · hover · focused · pressed (scale 0.96) · disabled (40% opacity, no pointer) · loading (spinner replaces label, width locked).
Standard copy for standard actions: "Undo", "Retry", "Send", "Cancel" — no themed replacements ("Take it back", "Give it another go", "Off it goes" are all wrong, however well they fit the voice).

**One word per concept — the rule, not a preference.** The Vietnamese catalogue needed a house spelling (`Xoá` vs `Xóa`); that problem leaves with the Vietnamese and English supplies its own, synonym drift, which is worse because both spellings are correct and nothing looks broken. A user who is told "Delete 3 tasks?" and then reads "3 items removed" cannot tell whether the same thing happened. Fixed choices, binding on this catalogue, the mockups, and the strings implementers ship:

| Concept | The word | Never |
|---|---|---|
| removing a task | **delete** | remove, clear, discard, get rid of |
| a thing on the list | **task** | item, to-do, entry, note |
| reversing the last applied turn | **undo** (past tense "undone") | revert, roll back, take back, restore |
| the user's own typing | **type** | enter, write, input |
| the OS Settings app | **Settings**, capitalised | preferences, options — and lowercase when it is a section rather than the app: "site settings", "system settings" |
| the hardware, when naming an OS permission | **Microphone**, capitalised | mic (which is right everywhere else: "the mic lights up again") |
| the conversation surface, when named as a place | **Talk** | Chat, Assistant, Conversation, Home |
| the list surface, when named as a place | **Tasks** | List, My list, To-do, Todos |
| a grouping the user made | **list** | project, folder, category, tag, label |
| making one | **New list** (the row and the sheet title); the button says **Create** | Add list, Create new list — *"add" belongs to tasks ("Add task") and nothing else* |
| putting a task in a different list | **move** | assign, file, categorise |
| the dark/light choice | **theme** | appearance mode, dark mode toggle, colour scheme |
| **todo-ai's own settings screen** | **Settings** — see the collision note in § App shell | — |

## Drawer (carried, pending Open Question 1)

Assumption per spec OQ-1: drawer + full list stay reachable. Carries the existing app's drawer unchanged (active row = 7% `primary` tint — the one legal chrome tint). Not restyled in this feature; flagged for design review when OQ-1 resolves.

---

## Touch — minimum content widths (mobile, F-003 AC-9)

**A different kind of constraint from the platform touch minimums, and deliberately not in the same table.** AC-9's 44pt (iOS) / 48dp (Android) are a *hit-area* rule, satisfied by `hitSlop` without moving a painted pixel. The five numbers below are *content-width floors* — the narrowest the painted control can be carrying its shortest label. **Every one of them already exceeds both platform minimums, so none of them can ever bind the hit-area calculation.** They are layout truth and a regression tripwire; they are never the accessibility argument. Merging the two tables would invite exactly that misreading.

**The rule:** a floor is a multiple of 4 **at or below** the width the control renders — not the tightest such multiple. Under-stating is the safe direction, because an over-stated width under-computes the slop a genuinely narrow control would need and fails silently in the safe-looking direction. The remaining slack is deliberate on top of that: these widths are measured in an HTML mockup, while the control ships through React Native's platform text shaping, so the same string does not resolve to the same pixel. A floor pinned tight to the Chromium measurement would be brittle against that difference for no gain — the floor's job is to catch a control that has collapsed, not to describe it to a tenth of a point. Where a control's label varies by state, the floor comes from the **shortest** label it can carry.

| Element (catalogue id) | Min content width | Basis |
|---|---|---|
| `assistant-add-task-button` | **92** | icon + "Add task" at `font.size.meta`, `padding: xs sm` — mockup renders 94.2 |
| `assistant-task-row` | **320** | full-bleed row at the narrowest supported device width; **not** derived from the mockup, which paints 428 at its 430 design width |
| `assistant-undo-button` | **80** | icon + "Undo" at `font.size.body`, `padding: xs md` — mockup renders 83.4 |
| `assistant-retry-button` | **68** | "Retry" at `font.size.body`, `padding: sm lg` — mockup renders 72.4. The tightest multiple of 4 below that is 72, which leaves 0.4px; one step down keeps the slack this section calls deliberate |
| `assistant-permission-cta` | **136** | shortest of its three labels sets the floor: "Open Settings" renders 138.3 (`padding: sm lg`, body size). The other two are wider and do not bind — "Allow microphone" 166.8, "Open app settings" 169.3 |

**Re-measured 2026-08-17** for the English copy (T-062). Every floor moved, because every label did — English is shorter here than the Vietnamese it replaces, and a floor carried over unchanged would have stopped describing the control. That is the point of publishing the rendered figure next to the floor: the two are checkable against each other, so a stale floor is visible rather than merely wrong.

Heights are not published here: they are derived from `font.size` + `spacing` tokens at build time, so a type-scale change moves them automatically and a constant would go stale.

---

## Contrast — verified pairs (AC-19 / WCAG 1.4.3, AA ≥ 4.5:1 normal text)

Computed (not eyeballed) via WCAG 2.1 relative-luminance formula; every pair passed. Dark theme: `text.primary`(17.5/15.8), `text.secondary`(9.0/8.1), `text.muted`(5.6/5.0) on `bg.base`/`bg.raised`; `primary` 7.0/6.3; `voice.listening` 12.3/11.1; `danger` 7.7/6.9; `success`&`diff.add` 11.2/10.1; `question` 12.0/10.8 on base/raised; `text.onAccent` on `primary` 7.0, on `voice.listening` 12.3, on `danger` 7.7; accents on own tints: add 9.3, remove 6.8, question 9.9, listening 10.1, `text.primary` on `primaryTint` 15.6. Light theme: `text.primary` 15.5/16.6, `text.secondary` 7.8/8.4, `text.muted` 5.4/5.8 on `bg.base`/`bg.raised`; `primary` 6.1/6.5; `voice.listening` 4.6/4.8; `danger` 5.3/5.7; `success` 5.0/5.3; `question` 5.5/5.9; white on `primary` 6.5; accents on own tints: add 4.6, remove 4.8, question 5.1, listening 4.8, `text.primary` on `primaryTint` 13.7.
Rule for implementers: accent text is legal only on `bg.base`, `bg.raised`, or its own tint token — any new pairing must be re-verified before use. The `gradient.voice` surface never carries body text; the live transcript renders on `bg.base` beside it, `text.primary`.

---

# App shell — the surfaces outside the conversation

**Added 2026-08-17 (T-101), additive.** Nothing above this line changed except the § Buttons
house-word table, which gained rows at its foot. Structure, purpose and per-surface states are
in `design/_shared/information-architecture.md`; this section is the component half — what each
new thing renders and in which states. Mockup: `design/assistant/screens/app-shell.html`.

**Zero new tokens.** Every value below resolves to an existing entry in `tokens.json`. No new
colour, size, radius, shadow or motion token was added, so § Contrast is unchanged and complete
for these components: they reuse pairs it already verified.

**The "Settings" collision, and the tripwire.** § Buttons fixes **Settings** as the OS Settings
app, and four § MicControl permission rows send the user there in those words. todo-ai now has a
Settings screen of its own, also **Settings**. The two never co-occur on a rendered screen —
permission messages live on Talk, our Settings row lives in the Lists menu — so the ambiguity is
in the vocabulary and not in the pixels, and the permission strings are left byte-identical
(they are parsed by row ID at run time, L-008). **The moment a permission message renders inside
our Settings screen, the OS one must be qualified** — "system Settings" on iOS, "App info" on
Android. Whoever adds that row owes the qualification in the same change.

## PathSwitch

Purpose: the reciprocal one-tap move between the two paths, `todo-ai ADR-11`'s second path made
reachable from a failure. One control per surface, top bar, right-aligned. It is **not** a tab
bar: the bottom of the Talk surface belongs to the Composer and the mic orb.

| ID | On surface | Label | Rendering |
|---|---|---|---|
| **PS-TASKS** | Talk | `Tasks` + count badge | ghost button, list icon, `text.primary`; badge is a `radius.pill` `primaryTint` fill with `primary` text, `font.size.meta` tabular |
| **PS-TALK** | Tasks | `Talk` | ghost button, mic icon, `text.primary` |

**The count is open tasks due today** — the same number § TaskList's header publishes, never a
second definition of it. **Zero renders no badge**; the zero case is stated in words on the Tasks
surface ("Nothing left today"), where there is room to say it properly. A badge reading `0` is a
number pretending to be news.

States: default · hover · focused · pressed — § Buttons behaviours, unchanged.
A11y: `role=button`; accessible name is the visible label plus the count as a sentence —
`Tasks, 3 left today` / `Tasks` when there is no badge; `Talk`. The badge is never the whole
accessible name: a screen reader user must not have to guess what "3" counts.

**PS-TASKS is visible and enabled in every Talk failure state**, including the session-read
failure below. That is the whole point of it; a fallback control that disappears with the
surface it is meant to escape is not a fallback.

## ListsMenu

Purpose: choose which collection Tasks renders, make a list, reach Settings. Opened by the
hamburger on the Tasks surface. **A slide-over panel from the left at every width** — scrim,
`shadow.raised`, an explicit close control. Considered and rejected: a permanent rail at
≥ 1024px. It is navigation you visit and leave, not a frame you work inside, and two
presentations mean two behaviours to spec, build and test — one of which (the rail) has no close
control, so its testid can never resolve at desktop. One presentation, one contract.

Three row families, one rendering, different sources:

| ID | Family | Rows | Source |
|---|---|---|---|
| **LM-COLLECTION** | built-in | Today · Upcoming · Inbox · Done | `collectionCount(tasks, c, now)` per row — the four date predicates of ADR-009 § Amendment, **not** `task.status`, which §1 retired |
| **LM-LIST** | personal | the user's lists | **needs `lists` + `tasks.list_id`; no field exists** |
| **LM-ACTION** | actions | New list · Settings | New list needs the field; Settings does not |

Row anatomy: icon (`icon.size.md`) + name + count, `font.size.body`, `padding: sm md`,
`radius.sm`. Active row = 7% `primary` tint — the one legal chrome tint, carried unchanged from
§ Drawer. Counts are `text.muted`, tabular, and omitted at zero for the same reason PS-TASKS
omits its badge.

**The fourth row — Upcoming (added 2026-08-18, T-128).** ADR-009 § Amendment makes all four
collections date predicates and states this one as a requirement in architecture's own words: *the
Upcoming collection must be reachable from the Lists menu.* Without the row a future-dated task is
in no collection the user can open and **nothing errors**, and F-001 AC-24's reachability bound —
which used to rest on Inbox being a superset of every open task — now rests on the four buckets
being total, so all four have to be openable. Name, look and position are design's:

- **Name: `Upcoming`.** It is the word the owner decision, ADR-009 § Amendment and
  `information-architecture.md` §9 already use, and `todo-ai ADR-11` named it before any of them;
  picking a synonym now would be inventing a second name for a thing four artifacts have already
  agreed on. Rejected: **Later**, which is the heading `groupTasks` renders *inside* a list — one
  word naming two different sets on one screen is the collision this file refuses everywhere else;
  and **Scheduled**, which is accurate and is nobody's word for it.
- **Position: `Today · Upcoming · Inbox · Done`.** By time horizon — now, then ahead, then
  undated, then finished — which is the only order here with a reason behind it. Upcoming sits
  beside Today because they are the same kind of fact one day apart. **This inserts a row and moves
  none:** `COLLECTIONS` (`src/assistant/_shared/model/tasks.ts:42`) is already
  `['today', 'inbox', 'done']` and `ListsMenu.tsx` renders in that order, so the
  `Inbox · Today · Done` this table published was stale before the amendment touched it.
- **Look: no new anatomy.** Icon + name + count exactly as the other three, `icon.size.md`, Lucide
  `calendar-days` — Today already carries `clock`, and clock-versus-calendar reads as now-versus-
  ahead without a label. Count `text.muted`, tabular, **and omitted at zero like every other row.**

**Upcoming ships showing no count, and that is the rule working rather than a broken one.** ADR-009
§ Amendment measured the live store: 737 live rows, and **Upcoming has no member anywhere in it** —
nothing is dated in the future in any account. So the first thing every user and every reviewer
sees is a bare `Upcoming` row. Written down because a bare row is exactly what gets filed as a bug
on day one, and because it has a consequence for QA: **this row cannot be verified by replaying the
store.** A suite that reads live data will report Upcoming green having never rendered a member;
the first one has to be seeded.

**No new testid.** `menu-collection-row` is the LM-COLLECTION exemplar and each contract testid
appears exactly once (§ Testid catalogue). The Upcoming row carries that id like the other three.
There is no `menu-upcoming-row` and nothing should be written against one.

States: default · hover · focused · pressed · active (the collection now rendered) ·
**loading** (built-ins render immediately — they are derivable on device and must never wait on
a network; only the personal section skeletons, two rows) · **failed** (one line in the personal
section, "Couldn't load your lists" + Retry; built-ins and Settings still work) · **empty** (no
personal lists: the section is absent, `New list` carries the invitation — the menu is never
empty, it always holds the built-ins, New list and Settings).

**Navigation must never be the thing that breaks.** Every failure state above keeps the built-in
collections and the Settings row live, because a menu that fails closed strands the user with no
route to the second path.

## SettingsRow

Purpose: one preference per row on the Settings surface. Flat rows on `bg.base`, hairline
between, `padding: md lg` — no cards.

| Variant | Control | Used by |
|---|---|---|
| segmented | three-segment control, active segment `primaryTint` fill + `primary` text | Theme — Dark / Light / System |
| switch | pill track; on = `primary` fill, knob `text.onAccent`; off = `bg.hairline` track, knob `text.secondary` | Talk back (F-002 AC-6/AC-17) |
| static | label + `text.muted` value, not interactive | About |

States: default · hover · focused · pressed · **saving** (control shows the § Buttons loading
treatment in place) · **failed**.

**Failed is the row's most important state and it is not a toast.** The control **reverts
visibly** to its previous value and the row grows a second line in `danger`: "Couldn't save — tap
to try again". A preference that silently does not stick is the quietest failure an app can have;
the user finds out days later and blames the feature.

**Talk back ships with F-002, not before.** F-002 is written to revision 3 and unbuilt
(`uc-coverage-map.md` UC-20). The row is drawn so the surface has somewhere for it to land; a
switch that toggles nothing is worse than an absent one.

## ListEditorSheet

Purpose: name a new list. Bottom sheet on phones, centred dialog ≥ 1024px, `radius.sheet`,
`bg.raised`, `shadow.raised`. Title **New list**; text field; **Create** (primary) and **Cancel**
(ghost).

States: default (field focused, `Create` disabled until a name is typed) · typing · saving
(`Create` loading, width locked) · **failed** — inline under the field, `danger`, *"A list called
Work already exists."* — **and the sheet does not close.** The typed name is never discarded.

Depends entirely on a field that does not exist. Do not build this without `lists`.

## MessageTaskLink

Purpose: a task named inside a message bubble is a **door to the list** — tap it and the Tasks
surface opens with that row scrolled into view and flashed once. This is what makes the owner's
*"gắn các todo tại các message"* complete: a task you cannot open is only a description of one.

Rendering: the task title inside § Message bubbles gains an underline in `text.muted` at
1px offset 2px — the standard "this is a link" cue, no colour change, because the diff colours in
that bubble already carry meaning and a second signal on the same text would collide with
§ Colour rules 1. Hit area follows the platform minimum via `hitSlop`.

The arrival flash reuses AC-4's existing treatment — `motion.duration_ms.diffFlashHold` then
`diffFlashFade`, `addTint` / `removeTint` — moved from "whenever a turn applies" to "on arrival
from the message that changed it". Same cue, attached to the moment it informs.

States: default · hover (underline to `text.secondary`) · focused (ring) · pressed ·
**inert** (the task was deleted by this or a later turn — no underline, not focusable; a link to
a row that no longer exists is a promise the list cannot keep).

New behaviour, in no F-doc. It is the smallest useful part of `UC-52 AC-52.5 / 52.6`.

## Skeletons

Purpose: loading mirrors the real content's silhouette. **No spinner in a void anywhere in this
app** — the only spinner is the one § Buttons puts inside a button that was pressed.

| ID | Mirrors | Shape |
|---|---|---|
| **SK-ROW** | § TaskRow | checkbox square + two bars (title 62%, meta 24%), five rows under a **heading-shaped bar** — see the note below |
| **SK-BUBBLE** | § Message bubbles | three bubbles, alternating sides, 70% / 45% / 80% width |
| **SK-LISTROW** | LM-LIST | icon square + one bar at 55%, two rows |

Fill `bg.hairline` on `bg.raised`, `radius.sm`, a 1600ms opacity pulse between 100% and 55%.
Under `prefers-reduced-motion` the pulse stops and the bars hold at 78% — still visibly
placeholder, no motion. Skeletons carry no text and no testid: nothing about them is assertable
except that they are not the empty state.

**A loading surface never renders its empty state.** A returning user who sees "Say it. I'll
write it down." while their conversation is still loading reads it as history lost.

**SK-ROW's day header is a bar, not words** (changed 2026-08-18, T-128). The cell read *"five rows
under a real day header"*, and `TasksSurface.tsx:179` renders `todayGroupLabel(now)` — the literal
string `Today · {date}` — over every collection's skeleton. That already contradicted this section's
own rule two paragraphs up (*skeletons carry no text*); the four buckets make it visibly wrong
rather than merely inconsistent. On Inbox and Done nothing groups at all, on Upcoming the first
heading is `Tomorrow · {date}`, and on Today it is `Overdue` whenever anything is late — which in
the live store is always. **A skeleton cannot know which heading the read will produce, so it must
not assert one.** A bar at the heading's size and position mirrors the silhouette, which is all this
section ever asked for; the words were never part of the silhouette. Collections that render flat
(§ TaskList) skeleton flat, with no bar.

## InlineRetryBanner

Purpose: the failure that must not take the surface. Full-width strip at the top of a list,
`bg.raised`, 1px `danger` top-and-bottom hairline, `danger` icon, `text.primary` message,
ghost **Retry**.

Used when a refresh fails **and the known content is still worth showing**: "Couldn't refresh
your tasks — showing what's on this device" + Retry, with every locally-known task still
rendered and still editable.

**The list is never replaced by an error.** The Tasks surface is the fallback path for the whole
app (F-001 AC-24, AC-25); a fallback that blanks itself on a network error has failed at the one
job it has. The full-surface treatment below is only for the case where there is genuinely
nothing to show.

States: default · retrying (Retry takes the § Buttons loading treatment) · hidden.

## SurfaceError

Purpose: the failure that has nothing to attach to — the conversation's own session read fails,
so there is no thread to put an Error bubble in; or the task list fails with nothing on device.

Anatomy, centred, `bg.base`: one line at `font.size.title` naming what happened in plain words,
one `text.secondary` line naming the next thing to do, one primary **Retry**, and — this is the
part that is not decoration — **the other path stays reachable**: PS-TASKS / PS-TALK remains
visible and enabled in the top bar, and on the Tasks variant `Add task` stays live, because the
local no-AI path works offline (AC-25) and disabling a working control to look consistent is a
lie about what the app can do.

| ID | Surface | Line 1 | Line 2 |
|---|---|---|---|
| **SE-SESSION** | Talk | Couldn't load your conversation | Your tasks are unaffected. Try again, or carry on by hand. |
| **SE-TASKS** | Tasks | Couldn't load your tasks | Nothing is saved on this device yet. You can still add one by hand. |

It looks **calm**: body-size supporting text, one accent, one button. An error state that shouts
makes users abandon.

## Empty states — Tasks

Three, because they are three different facts and one message for all of them tells at least two
users something untrue.

| ID | When | Head | Action |
|---|---|---|---|
| **ET-FIRST** | no tasks anywhere | No tasks yet | `Add task`, plus one line offering the other path ("or say one, on Talk") — both doors: a user who arrived from a broken assistant needs the hand path, a user who arrived by curiosity needs to know the fast one exists |
| **ET-COLLECTION** | this collection is empty, others are not | Nothing in {list} | `Add task`. Never ET-FIRST's wording — telling a user with 40 tasks that they have none is the lie the generic empty state tells |
| **ET-DONE** | the Done collection is empty | Nothing completed yet | **none.** No action fills this list directly; inventing one would be a shrug dressed as an invitation |

`{list}` is a `verbatim` slot (§ Spoken frames' vocabulary) — the list's own name, never
re-worded.

**Upcoming's empty state is ET-COLLECTION, and it is the state every account is in today** (added
2026-08-18, T-128). No future-dated task exists anywhere in the live store (ADR-009 § Amendment),
so `Nothing in Upcoming` + `Add task` is not an edge case — it is the collection's default
appearance for every user until somebody dates something forward. That puts weight on a cell nobody
has filled: **what `Add task` does while viewing Upcoming has no derivable date.** See
§ LandingSummary's foot, *The cell this pass refuses to fill*. The empty state is drawn; its CTA's
behaviour is pending that decision and is **not** `Add task`-with-a-guessed-date.

## Testid catalogue — app shell

Controls that already exist keep their ids and simply render on a different surface:
`assistant-task-row`, `assistant-task-checkbox`, `assistant-add-task-button`,
`assistant-undo-button`, `assistant-retry-button`, `assistant-permission-cta`. **They are not
renamed** — § Touch publishes width floors against them which `src/assistant/mobile/model/touch.ts`
adopts and a test asserts row by row.

Genuinely new controls, and only those, take new ids:

| Testid | Control |
|---|---|
| `shell-tasks-button` | PS-TASKS |
| `shell-talk-button` | PS-TALK |
| `shell-lists-menu-button` | the hamburger on Tasks |
| `menu-collection-row` | LM-COLLECTION exemplar |
| `menu-list-row` | LM-LIST exemplar |
| `menu-new-list-button` | LM-ACTION — New list |
| `menu-settings-row` | LM-ACTION — Settings |
| `menu-retry-button` | ListsMenu failed state |
| `menu-close-button` | the panel's close control (every width — the menu is a slide-over everywhere) |
| `settings-back-button` | Settings → Lists menu |
| `settings-theme-control` | SettingsRow segmented |
| `settings-talkback-switch` | SettingsRow switch |
| `settings-row-retry` | SettingsRow failed |
| `list-editor-name-input` | ListEditorSheet field |
| `list-editor-create-button` | Create |
| `list-editor-cancel-button` | Cancel |
| `talk-session-retry-button` | SE-SESSION Retry |
| `talk-task-link` | MessageTaskLink exemplar |
| `tasks-list-retry-button` | InlineRetryBanner / SE-TASKS Retry |
| `tasks-empty-add-button` | ET-FIRST / ET-COLLECTION CTA (distinct from the header's `assistant-add-task-button`) |
| `tasks-rename-input` | inline rename, which ships on web today with no testid |
| `tasks-delete-button` | the row's delete control, which ships on web today with no testid |

**`assistant-drawer-button` is retired by this IA** — the hamburger stops toggling a pane and
becomes navigation to a different surface, which is a different control wearing the same glyph.
Its retirement lands with the spec pass, not before: the three existing F-001 mockups and the
tests that parse them are untouched by this section.

No content-width floor is published for any control above. § Touch's floors are measured from a
shipped control; none of these has shipped, and publishing a floor measured only in Chromium
would put a number into a table whose whole value is that its numbers are checkable.

---

## AppFrame — the one layout branch, and where it lands

**Added 2026-08-17 (T-105), additive**, for
`reports/owner-decision-2026-08-17-desktop-list-is-primary.md`. Nothing above this line moved,
was renamed or was reordered. Two cells changed content and are called out at the foot.

Mockups: `app-shell.html` (web, both sides of the branch) · `app-shell-ios.html` ·
`app-shell-android.html` (T-104 — phones, always below the branch).

**The branch is `tokens.json breakpoints.split`, and there is exactly one of it.**

| Width | Frame | PathSwitch | Settings |
|---|---|---|---|
| **below split** | one surface on screen: Talk **or** Tasks | present; one tap between them | replaces the surface |
| **at or above split** | Tasks in the centre, Talk in a `360–420px` right panel, both permanently on screen | **absent** | replaces the **centre**, never the panel |

**Tablet is not a third case.** `768` renders the below-split frame unchanged from `375`.
Splitting `768` leaves the panel about `330px` and the centre about `420px`: the centre loses the
day/row rhythm and the panel loses the diff row, which is the one thing the panel may not lose.
`768` is also iPad portrait — held, and used one-thing-at-a-time the way a phone is.

**The constraint that governs everything here:** the Applied bubble carries its **full per-field
diff at every width**, in the panel exactly as on a phone. The centre list is an addition and is
never what `F-001 AC-1` relies on. If the centre list were allowed to *be* the confirmation at
desktop, AC-1 would carry two mechanisms selected by viewport, tests would branch, and the branch
nobody runs is the one that rots. The same trap from the other side is already recorded under
§ PathSwitch: the `Tasks · N` count is a second confirmation and must never be specced as the
guarantee, because a number cannot say *which* task.

**Why PathSwitch is absent above the split, and why that strengthens rather than weakens it.**
A control that switches to what is already visible is a dead control. § PathSwitch's guarantee —
*visible and enabled in every Talk failure state* — is met more strongly at this width: the
second path is not one tap away, it is never left. `talk-failed` is the state to look at, and it
is the state that most justifies the split: the assistant is broken in the panel and the whole
todo is untouched and usable in the centre.
**Consequence for the id catalogue:** `shell-tasks-button` and `shell-talk-button` are
**below-split-only controls**. A desktop selector for either will not resolve, and should not.

**A container query, not a viewport media query.** The branch reads `.app`'s own width. It is
equivalent to a media query whenever the app fills the window and stays correct when it does not
(embedded, split-screen). One line for implementers: `container-type: inline-size` on the app
root. It is also what lets `app-shell.html` show the below-split frame — the `phone-talk` and
`phone-tasks` states — while being read in a desktop browser.

**The day-header gutter is withdrawn.** T-101 set day headers in a `180px` right-aligned gutter
beside their rows, on the premise that Tasks had the whole `1280`. It has the centre column now.
Day headers stack above their rows **at every width**, and the list keeps a `720px` measure
left-anchored against the checkbox rail. The width is used by the split, not by stretching a
task row's hairline across `830px`. Same reasoning § ListsMenu used to refuse a desktop rail:
one presentation, one behaviour to spec, build and test.

### Platform variants — what T-104 fixes, and the two places touch is not hover

The id catalogue above is **identical in all three shell mockups**, in the three spellings the
one source prop surfaces as: web `data-testid` · iOS `accessibilityIdentifier` · Android
`resource-id`. Android's `contentDescription` is never used for identity — TalkBack speaks it,
so an id parked there is read aloud instead of the message (F-003 AC-12).

Two renderings differ on the phones, and both differences are forced rather than stylistic:

| | Web | iOS / Android |
|---|---|---|
| `tasks-delete-button` | appears on row hover / focus-within | **always visible** in the row's trailing slot — a hover-revealed control does not exist on touch, and hiding it would publish an id no user can reach |
| `tasks-rename-input` | entered from a per-row control | entered by **tapping the task title**; a second per-row button would crowd the delete target |

**Both are drawn and neither ships today.** `uc-coverage-map` D8 records that mobile has two of
`AC-18`'s four manual operations. They are drawn so parity has a contract to close against —
not as a claim that the build has them.

**Platform chrome, token-first.** iOS takes a large title on Tasks (a place) and a compact bar on
Talk (a continuous thing), a bottom sheet with a grabber, a home indicator, and `44pt` targets.
Android takes one `56dp` M3 top app bar everywhere, rounded-square checkboxes, an outlined
`Add task`, the M3 switch and segmented button, a drag-handled bottom sheet, the gesture bar, and
`48dp` targets. Type, colour, spacing and radius stay `tokens.json` on both — platform paint
never wins over the design system.

**One presentation for the Lists menu on every platform**, per § ListsMenu. On Android that is
Material's own navigation drawer; on iOS it is borrowed, and we borrow it knowingly rather than
fork the id catalogue between a push and a sheet.

### Two cells above changed content in this pass

Neither is a rename, a reorder, or a new row.

1. **§ SurfaceError, SE-SESSION line 2** was *"Your tasks are still here — open Tasks, or try
   again."* It named a route only one of the two widths has: above the split the list is already
   on screen and there is nothing to open. Now *"Your tasks are unaffected. Try again, or carry
   on by hand."*, which is true at both. Not parsed by any test.
2. **The `menu-close-button` catalogue annotation** said *"≤ 1023px only"* — left over from the
   desktop rail this file rejected. The menu is a slide-over at every width and always carries
   its close control.

---

## LandingSummary — what Talk says when you open it (LSM-*)

**Added 2026-08-18 (T-114), additive**, for `reports/owner-decision-2026-08-18-landing-and-collections.md §1`
(a phone lands on Talk, and Talk must not be an empty room). Nothing above this line moved, was
renamed or was reordered. One cell above changed content and is called out at the foot.

Mockups: `app-shell.html` · `app-shell-ios.html` · `app-shell-android.html`, states
`talk-landing` · `talk-landing-overdue` · `talk-landing-clear-today` · `talk-landing-clear`.

**What it is.** One assistant message, rendered once per open at the foot of the thread, that
reports what the task list currently holds. It is **not a turn**: no `client_turn_id`, no row in
the turn log, no Undo, nothing applied. It is client-local and **not persisted** — a later
session read does not return it, so greetings never accumulate in history. New turns append below
it in the normal way, so it ages into the thread as "what the day looked like when you opened".

**It renders; it does not speak.** F-002 AC-4 restricts speech to a turn the user just issued, and
its `## What speaks, and from what` table already answers this case — *any message restored by a
session read* speaks **no**. Making this one talk would be shipping the spoken day summary, which
F-002 reserves as **F-004 and explicitly records as having no owner decision behind it**. So this
frame family lives beside § Spoken frames and borrows its machinery, and sits outside it: `SPK-*`
is what the app says out loud, `LSM-*` is what it writes on open. If the owner wants it spoken,
that is F-004 and it is a separate decision.

**It renders at every width**, in the panel at ≥ 1024px exactly as on a phone. One mechanism at
every width is the rule § AppFrame already holds the diff row to; a summary that appeared only
below the split would be a second behaviour selected by viewport, and the branch nobody runs is
the one that rots.

**No time-of-day salutation.** "Good morning" needs a clock, carries no information, and is wrong
for anyone opening the app at 11pm. The orientation *is* the greeting.

### The facts it may state, and where each comes from

It reports counts and names tasks it can read. It does not summarise, judge or predict (F-001
AC-14 / AC-15 — this product does not bluff).

| Fact | Definition | Source |
|---|---|---|
| `open_today` | open tasks dated **on or before** today — overdue included (ADR-009 § Amendment §3) | `collectionCount(tasks, 'today', now)` — **the same call the PathSwitch badge makes.** § PathSwitch fixes this as one number, never a second definition of it |
| `upcoming` | open tasks dated **after** today | `collectionCount(tasks, 'upcoming', now)` — **added 2026-08-18 (T-128)** |
| `inbox_count` | open tasks with **no date at all** | `collectionCount(tasks, 'inbox', now)` — **added 2026-08-18 (T-128).** This is what that call returns now that Inbox is a date predicate rather than a superset |
| `open_all` | every unfinished task | `open_today + upcoming + inbox_count`. **Not the Inbox count** — see below |
| `overdue` | open tasks whose `due_at` is strictly before the start of today | derivable from `due_at` + `status`, **no new field**. The predicate belongs beside `dueToday` in `src/assistant/_shared/model/tasks.ts`, not in the summary composer (L-004: one home per fact). **Now a strict subset of `open_today`, where the two used to be disjoint** |
| `done_today` | tasks completed today | **not readable.** See "The one shape that is blocked" below |

**`open_all` and `inbox_count` are two facts that were one number only by accident** (split
2026-08-18, T-128). The selection rule needs *every open task* — that is the whole basis on which
rows 1–2 are safe to fire. The copy in LSM-CLEAR-TODAY needs *the Inbox count* — "waiting in Inbox"
is a claim about a place, and a task dated next Tuesday is not in that place. While Inbox was a
superset of every open task, one expression served both readings and nothing distinguished them.
It is not a superset any more, the two readings now differ by exactly `upcoming`, and the cost of
not splitting them is not cosmetic in either direction: leave `open_all` on the Inbox count and a
user with a full week ahead is told **"All done — your list is clear."**; point the copy at the
corrected `open_all` and a user with nothing in Inbox is told **"3 tasks are waiting in Inbox."**
Both are false, and they are false about different things, which is what says these are two facts.
Give each a name and one home (L-004, applied before the drift rather than after it).

**Four facts, three calls.** `open_today`, `upcoming` and `inbox_count` are `collectionCount` on
the three open collections, and `open_all` is their sum — so the summary, the PathSwitch badge and
the Lists menu counts cannot disagree, because there is no second definition anywhere for them to
disagree with. `overdue` is the one predicate with no collection of
its own, deliberately: ADR-009 § Amendment folded it into Today rather than giving it a surface, so
the summary is the only place it is named at all. That is worth holding on to when reading the
ranking argument below.

`now` is the device clock, the same one `dueToday` already uses. The summary is a **message at a
timestamp, not a live counter** — if the user completes something afterwards it does not rewrite
itself, because messages in this thread never do. The live number is the PathSwitch badge.

### Which tasks get named, and how many

`title_list` from § Spoken frames' closed vocabulary, unchanged: **up to 3 titles, then `overflow`
carries the rest as "and N more"**. No new bound is invented here and none is needed — the reason
the spoken bound exists (a sentence naming eleven tasks is not a sentence anyone can act on) is
the same reason it applies to a sentence you read.

**Which three.** The first three of the set the frame counts, **in the order that set is already
published in** — `collectionTasks(tasks, 'today', now)` for the today frames, the overdue subset
in the same order for the overdue frames. Not a second ordering: if the Tasks surface ever gains a
sort, the summary inherits it by calling the same function, and the sentence and the list cannot
disagree about which task is first.

**The named set is always the counted set.** An overdue frame names overdue tasks, never today's —
a count of one set beside the titles of another is two facts wearing one sentence.

Named titles render as § MessageTaskLink, the same door to the list every other bubble's titles
are. They carry no `data-testid` of their own: `talk-task-link` is already the catalogue's
exemplar for that control and each contract testid appears exactly once (§ Testid catalogue).

**One difference from every other MessageTaskLink, and it is not cosmetic: inside the summary the
link is an inline element, not a `<button>`.** Everywhere else a MessageTaskLink sits on its own
diff row, where the browser's atomic layout of a button is harmless. In running text it is not:
measured in Chromium at 375px and 1280px, an atomic box cannot break mid-phrase, so the
punctuation after a title lands at the start of the next line — a line beginning with a bare
comma — and a title longer than the bubble overflows it rather than wrapping. Role, appearance,
behaviour and the testid contract are unchanged; only the box is. Implementers rendering the
summary body must use an inline element there.

### The frames

Same discipline as § Spoken frames: **fixed strings with named slots**, from that section's closed
vocabulary. Two literal forms per row where a noun changes with the count — singular and plural
are the whole set, never a template over a noun (§ NewMessageAffordance set this precedent; L-008
is why).

| ID | Selected when | Slots | Text |
|---|---|---|---|
| **LSM-AHEAD-1** | `open_today = 1` | `title` | `One task today: {title}.` |
| **LSM-AHEAD-N** | `open_today ≥ 2` | `count`, `title_list` | `{count} tasks today: {title_list}.` |
| **LSM-OVERDUE** | `overdue ≥ 1`, `count_secondary = 0` — **re-pointed 2026-08-18 (T-128)**; reached through selection rule 3, not the dead rule 4 | `count`, `title_list` | 1 → `One task is past its date: {title_list}. Nothing else is due today.` · ≥2 → `{count} tasks are past their date: {title_list}. Nothing else is due today.` |
| **LSM-OVERDUE-TODAY** | `overdue ≥ 1`, `count_secondary ≥ 1` | `count`, `count_secondary` (= `open_today − overdue`), `title_list` | 1 overdue, 1 other → `One task is past its date: {title_list}. One other is due today.` · 1 overdue, ≥2 others → `One task is past its date: {title_list}. {count_secondary} others are due today.` · ≥2 overdue, 1 other → `{count} tasks are past their date: {title_list}. One other is due today.` · ≥2 overdue, ≥2 others → `{count} tasks are past their date: {title_list}. {count_secondary} others are due today.` |
| **LSM-CLEAR-TODAY** | `overdue = 0`, `open_today = 0`, `inbox_count ≥ 1` | `count` (= **`inbox_count`**, re-bound 2026-08-18 T-128 — it was `open_all`) | 1 → `Nothing is due today. One task is waiting in Inbox.` · ≥2 → `Nothing is due today. {count} tasks are waiting in Inbox.` |
| **LSM-CLEAR** | `open_all = 0`, and the account has conversation history | none | `All done — your list is clear.` |
| **LSM-PROGRESS** | `done_today ≥ 1`, `overdue = 0`, `open_today ≥ 1` | `count`, `count_secondary`, `title_list` | 1 → `You've finished one today. {count_secondary} left: {title_list}.` · ≥2 → `You've finished {count} today. {count_secondary} left: {title_list}.` — **not selectable today; see below** |
| **LSM-CLEAR-AHEAD** | `overdue = 0`, `open_today = 0`, `inbox_count = 0` (so `upcoming ≥ 1`) — **added 2026-08-18 (T-128)** | `count` (= `upcoming`) | 1 → `Nothing is due today. One task is coming up.` · ≥2 → `Nothing is due today. {count} tasks are coming up.` |

In LSM-OVERDUE-TODAY and LSM-PROGRESS, `count` is the named set and `count_secondary` is the
unnamed one. Only one set is named per message: naming both needs two `title_list`s and produces a
paragraph, and the unnamed set is one tap away in Tasks.

**`count_secondary` is `open_today − overdue`, and the word carrying it is `others`, not `more`**
(changed 2026-08-18, T-128). The definition is architect's and it is arithmetic: with overdue
inside Today, `count_secondary = open_today` counted the overdue tasks a second time, and against
the live store the frame rendered *"7 tasks are past their date: … 7 more due today."* Subtracting
fixes the number. The word is a separate question and it fails a separate test.

*More* became true again once the sets were disjoint — and it still had to go, because
`title_list` spends the same word four words earlier. Above three titles it renders *"A, B, C and
4 more"*, so the message read *"…A, B, C and 4 more. 3 more due today."*: one word carrying two
referents in one breath, the first meaning *more of the set I am naming*, the second *a set I am
not naming at all*. A reader resolving the second *more* against the first gets 4 and 3 as
quantities of the same thing. `others` cannot be read that way, and it is the stronger word for
the fact besides — *other* **asserts** the disjointness whose loss was this frame's entire defect,
where *more* merely permits it. Cost: the row now carries four literals instead of two, because
two counts each vary singular-versus-plural. That is L-008's price and it is the right one — a
pluralising template over the noun is exactly how a combination nobody enumerated ships fluent
text nobody reviewed.

**When `count_secondary` is 0, LSM-OVERDUE speaks — the fixed definition needs somewhere to land.**
`open_today − overdue` is 0 whenever everything late and nothing dated today is open, which is the
live store's own state (7 overdue, nothing dated today). LSM-OVERDUE-TODAY would then read
*"7 tasks are past their date: … 0 others are due today."* — a numeral zero in a sentence, saying
in three words what one word says better. LSM-OVERDUE's *"Nothing else is due today."* is already
that sentence, written for this exact fact under the old model. So the frame keeps its ID, its
position and its text, and only its door changes: it was rule 4's, it is now rule 3's
`count_secondary = 0` branch. The dead rule below cost a row; it did not cost a sentence.

### Which shape applies — the selection rule

**Preconditions, both required, or there is no summary at all.** The task list must be readable
this open (from the server, or from the device when offline — either is a real read), and Talk
must not be in `talk-loading` or `talk-failed`, which own the surface while they last. A greeting
composed from a partial or stale read is the one thing this must never be: silence is honest,
a guessed count is not.

Then, **first match wins**:

| # | Condition | Frame |
|---|---|---|
| 1 | `open_all = 0` **and no conversation history** | **no summary** — § Message bubbles' empty-conversation invitation stands (`talk-empty`) |
| 2 | `open_all = 0` and history exists | **LSM-CLEAR** |
| 3 | `overdue ≥ 1` (which now implies `open_today ≥ 1`) | **LSM-OVERDUE-TODAY** when `count_secondary ≥ 1`; **LSM-OVERDUE** when `count_secondary = 0` |
| 4 | ~~`overdue ≥ 1` and `open_today = 0`~~ | **DEAD — unsatisfiable, 2026-08-18 (T-128).** Overdue lives inside Today, so `overdue ≥ 1` implies `open_today ≥ 1` and this condition can never hold. The row is kept, struck through, so that 1–8 still number what every reference to them numbers; it selects nothing, and LSM-OVERDUE is reached through row 3 |
| 5 | `done_today ≥ 1` and `open_today ≥ 1` | **LSM-PROGRESS** — unreachable while `done_today` is unreadable; falls through to 6/7 |
| 6 | `open_today ≥ 2` | **LSM-AHEAD-N** |
| 7 | `open_today = 1` | **LSM-AHEAD-1** |
| 8 | `open_today = 0` (so `upcoming + inbox_count ≥ 1`) | **LSM-CLEAR-TODAY** when `inbox_count ≥ 1`; **LSM-CLEAR-AHEAD** when `inbox_count = 0` |

**The rule is total, and that is the property to test. Re-proved 2026-08-18 (T-128) against the
four buckets — and the re-proof deleted a row rather than adding one.** After rows 1–2 remove
`open_all = 0`, every state with `overdue ≥ 1` is caught by row 3 alone, because overdue now lives
inside Today and `overdue ≥ 1` implies `open_today ≥ 1`; row 4's condition is the complement of an
implication that always holds, so it catches nothing. When `overdue = 0`, `open_today ≥ 2 | = 1 |
= 0` covers the remainder (rows 6–8). Every state still has exactly one frame — which is what
F-002 AC-22's "an unenumerated combination has no frame and therefore fails" demands, met by
enumerating rather than by failing. **Row 4 is vacuous, not missing**, and that is the difference
this re-proof was for.

Two rows now fan out to two frames each, and each fan-out splits **one variable in two
directions**, so it is total by inspection: row 3 on `count_secondary ≥ 1 | = 0`, row 8 on
`inbox_count ≥ 1 | = 0`. Neither introduces a state; each names which frame an already-owned state
takes. The requirement — *a future fact must re-prove this table is total, not merely add a row to
it* — is what forced both splits into existing rows and forced row 4 to be struck rather than
quietly deleted. `upcoming` was added as a fact and the table did not grow.

**Overdue still outranks everything except an empty list — but the reason changed, and the old
one is now false** (rewritten 2026-08-18, T-128; the sentence it replaces is preserved in the
changed-cells note at the foot). The argument used to be safety: `open_today` counted `status:
'today'` or a date of today, a task dated last Tuesday was in neither, and a rule keyed on
`open_today` alone congratulated a user who was behind. ADR-009 retired the status leg and its
§ Amendment folded overdue into Today, so **`open_today` sees those tasks now** and that failure
cannot occur through this door any more. The safety argument was not defeated; it was **absorbed
into the predicate**, which is the better place for it. Leaving the paragraph as written would have
left a live falsehood in the file justifying a rule that is still right.

What survives the absorption is naming, and it is enough. Demote row 3 and a user with seven late
tasks and two due today gets LSM-AHEAD-N: *"9 tasks today: A, B, C and 6 more."* Every number in it
is true, the titles are the right titles, and the word *late* never appears — the missed work is
folded anonymously into a count of the set that swallowed it. That is precisely what § "The named
set is always the counted set" exists to forbid, and it is worse here than elsewhere because
`overdue` is the one fact in the table with no collection of its own: fold it into a count in the
summary and the app has no surface anywhere that says a task was missed. Row 3 is the only frame
that names those tasks, so naming is now the whole argument for its rank. It is a weaker argument
than the one it replaces and it is sufficient: the ranking used to prevent a lie, and now it
prevents a silence.

**Mid-day is a fact, not a clock.** LSM-PROGRESS is selected by `done_today ≥ 1` — which can only
be true after the user has finished something today, which *is* mid-day — and the time is never
read. A clock-based rule would call 6am mid-day for a night shift and be wrong in the one sentence
the app opens with.

**Praise is reserved for a clear list, not a clear day.** LSM-CLEAR congratulates; LSM-CLEAR-TODAY
states the fact and names what is still waiting. "Well done" to someone with seven tasks in Inbox
is the generic empty state's lie (§ Empty states — Tasks, ET-COLLECTION) told in a greeting.

### What the awkward cases render

Every row here is a state a real account reaches, and each was chosen against a greeting that
reads well on a demo and lies on someone else's data.

| Case | Renders | Why not the obvious thing |
|---|---|---|
| Zero tasks ever, first open | **no summary** — the `talk-empty` invitation | A summary of nothing is an empty room with a sentence in it. There is nothing to orient toward and no achievement to congratulate |
| Zero tasks, but history exists (everything deleted or completed) | **LSM-CLEAR** | The account has done something; "All done" is true |
| Everything done | **LSM-CLEAR** | Same row — the summary counts open tasks, and "done" and "deleted" leave the same count |
| Tasks exist, none due today, none overdue, something in Inbox | **LSM-CLEAR-TODAY**, naming the Inbox count | Not LSM-CLEAR: the list is not clear, only the day is. If anything is also upcoming it goes unnamed — under-informing by one number, one tap from the Lists menu, and the trade this section makes everywhere |
| Tasks exist, **all of them dated in the future** | **LSM-CLEAR-AHEAD** — `Nothing is due today. {count} tasks are coming up.` | Not LSM-CLEAR: `open_all` counts Upcoming, so the list is not clear and nobody is congratulated for a week of work. Not LSM-CLEAR-TODAY: *"0 tasks are waiting in Inbox"* is false about the count and false about the place |
| Exactly one task today | **LSM-AHEAD-1** — `One task today: {title}.` | A separate literal, not `1 tasks today` and not a pluralising template |
| Everything overdue, nothing dated today | **LSM-OVERDUE**, reached through rule 3 | `count_secondary = 0` here, and the alternative sentence is *"0 others are due today"*. **This is the live store's own state** — 7 overdue rows, nothing dated today, nothing dated ahead (ADR-009 § Amendment) — so it is the frame most accounts would actually render, not a corner |
| Some overdue, some due today | **LSM-OVERDUE-TODAY**, naming the overdue ones | The overdue set is named because it is the one the user has already missed |
| 40 tasks today | **LSM-AHEAD-N** — `40 tasks today: A, B, C and 37 more.` | The count is honest and the bound is `title_list`'s existing 3 |
| Offline, tasks on the device | The frame the device list selects | The device list is a real read; § OfflineBanner carries the news that it may be stale. Nothing here claims to be fresh |
| The task read failed | **no summary** | The surface's own failure state stands (§ SurfaceError / § InlineRetryBanner). No count is better than a wrong one |
| Talk is loading or failed | **no summary** | Those states own the surface (IA §6, S1) |

### The one shape that is blocked, and on exactly what

The owner's second shape — *"you have finished X, Y left, which are …"* — needs a count of tasks
**completed today**. The `task` entity has no completion timestamp: its fields are `id, user_id,
title, due_at, reminder_at, priority, status, created_at, updated_at, deleted_at`
(`src/assistant/api/types.ts`). `updated_at` is *last touched*, so deriving `done_today` from it
counts a done task whose title was edited today and drops one completed today and edited tomorrow.
It would be right most of the time and quietly wrong the rest, which is the failure this product's
character is defined against — and it fails silently, because a plausible number looks exactly
like a correct one.

So LSM-PROGRESS is **written, drawn and not selectable**: rule 5 never fires and the summary falls
through to LSM-AHEAD-*, which is honest and slightly less warm. It needs one field —
`task.completed_at`, set when `status` becomes `done` and cleared when it leaves — which is a
data-model change and belongs to spec + architect, not to design. This is IA §7's line, applied to
a copy decision: draw it, name the field, do not build half of it.

**Routed, not assumed** (L-008's corollary — when the honest derivation is missing, route the case,
do not invent it): the owner asked for three shapes and today two of them are reachable. Whether
`completed_at` is worth a migration is the owner's call, not design's.

### One cell above changed content in this pass

Not a rename, a reorder, or a new row.

1. **§ Spoken frames, slot vocabulary, the `count_secondary` Notes cell** read *"**revert frames
   only** (`UndoResult.skipped.length`)"*. The alphabet is **deliberately widened, not composed
   around** (F-002 AC-22's own move when four kinds needed more than a count): LSM-OVERDUE-TODAY
   and LSM-PROGRESS each state two counts, one named and one not, and there is no way to say that
   with one count that is not a second sentence. The cell now reads *"revert frames and landing
   frames"* and names both sources. No new slot **type** was added — the vocabulary is still five,
   still closed. No `SPK-*` row changed.

---

## Four buckets — what this pass changed and the one cell it refuses to fill (T-128)

**Added 2026-08-18 (T-128), additive**, for `reports/owner-decision-2026-08-18-four-buckets.md`
§ Confirmed (second pass) and `specs/_shared/adr/ADR-009-today-is-a-date.md` § Amendment. **No row
ID above was moved, renamed or reordered.** One frame ID, two facts and one day-group heading were
added, one selection rule row died, and eleven cells changed content — all listed at the foot of
this section. The three surfaces the amendment disturbed have one home each: § LandingSummary for
the frames and facts, § ListsMenu for the fourth row, § TaskList for the day groups.

The owner considered moving overdue into Inbox, which would have dissolved every problem this
section addresses, and **confirmed keeping it in Today**. So none of what follows is an open
question about the model; it is the work the confirmed model owes.

### The cell this pass refuses to fill

**Creating a task while viewing Upcoming has no derivable date, and none is invented here.**

ADR-009 §4 fixes *creating in a collection puts it in that collection, by date*. For Today the
instant was derivable, because the collection is one day and that day's local start is the honest
answer. **Upcoming is not one day.** Its predicate is `due_at > today`, which names no instant.
Architect left the cell open deliberately; design does not close it either. Three answers exist and
each costs something real:

1. **The local start of tomorrow** — the least-committal instant satisfying the predicate, and it
   keeps §4 exactly. Costs a date the user never said, which is the objection the owner raised
   against every date-inventing option in this thread; and the task leaves Upcoming for Today by
   morning, so it does not even stay where it was created.
2. **`null`, with the composer saying it landed in Inbox** — invents nothing, breaks §4: the task
   disappears from the surface at the moment of creation, which is the one thing a create action
   must never look like.
3. **No composer on Upcoming at all** — coherent, and it has precedent: § Empty states ET-DONE
   gives Done no action because no action fills it directly. But Upcoming is not Done. An action
   *can* fill it; it just needs one more piece of information. And removing the composer makes
   ET-COLLECTION's `Add task` inapplicable on the one collection where **every account currently
   lands empty**, so the cost is paid by every user on day one.

**Design's recommendation, for the owner to take or leave: none of the three — ask.** The owner has
already answered this exact question on the other path: *"nghe user nói, nếu không có thông tin
ngày thì có thể hỏi lại; nếu user chưa chốt thì vẫn tạo task mà không có due date, mặc định vào
Inbox."* Ask, do not assume; create dateless only when the user declines to date it. The hand path
should follow the rule the voice path already has rather than grow a second one. Concretely: the
composer opened from Upcoming presents the date field **empty and first**, with no default sitting
in it. Pick a date and the task is in Upcoming, by §4. Decline and it is option 2 — **chosen rather
than done silently**, with the composer saying where it went. This invents no date and adds no rule
the owner has not already made. It is a recommendation and the call is the owner's.

**Today's code answers this by accident, which is why it is flagged loudly rather than left open
quietly.** `c === 'today' ? startOfTodayIso(now) : null` is option 2 with the notice removed: the
task lands in Inbox, outside the collection it was created in, and nothing says so. The Upcoming
row can ship before this cell is filled — an empty collection you can open is the fix for an
invisible one. ET-COLLECTION's CTA on Upcoming cannot.

### What is owed elsewhere, and is not written here

- **`Later` on Upcoming, and `completed_at` for Done.** Both are routed in § TaskList with the
  reason each is routed rather than decided: `Later` is coarse but renders nothing false, on a
  collection with no member in the live store to design against; Done's grouping needs the same
  missing `completed_at` that blocks LSM-PROGRESS. Neither blocks the implementation task — Done
  and Inbox render flat, which is an answer, not a deferral.
- **Mockup states.** § LandingSummary names four states — `talk-landing` · `talk-landing-overdue` ·
  `talk-landing-clear-today` · `talk-landing-clear`. LSM-CLEAR-AHEAD has no state among them, and
  `talk-landing-overdue` now needs to show the `count_secondary = 0` branch (LSM-OVERDUE) as well
  as the `≥ 1` one. The three `app-shell*.html` mockups owe the Lists menu's fourth row, the
  `Overdue` day heading, and the flat rendering of Inbox and Done; nothing in them was touched
  here.
- **The Upcoming member QA has to seed.** Not a design artifact, recorded because it is invisible
  from this file: the live store has no future-dated task, so every assertion about Upcoming and
  about LSM-CLEAR-AHEAD is vacuous against replayed data.

### Cells above that changed content in this pass

Eleven, and none of them is a new row:

1. **§ ListsMenu, LM-COLLECTION `Rows`** read *"Inbox · Today · Done"* and now reads
   *"Today · Upcoming · Inbox · Done"*. The published order was already stale — `COLLECTIONS` ships
   `['today', 'inbox', 'done']` — so this inserts one row and corrects a drifted cell.
2. **§ ListsMenu, LM-COLLECTION `Source`** read *"`task.status` — works today"*. ADR-009 §1 retired
   the status leg; the cell now names `collectionCount(tasks, c, now)`, the same call the badge and
   the summary make.
3. **§ LandingSummary, the `open_today` fact** read *"open tasks due today"*. It is *on or before*
   today now, overdue included. Same call, wider set.
4. **§ LandingSummary, the `open_all` fact** was sourced from `collectionCount(tasks, 'inbox',
   now)` on the stated ground that *"Inbox is a superset of Today"*. It is not a superset any more;
   the source is now the sum of the three open collections. This is the one changed cell that was
   producing a false sentence rather than a stale one.
5. **§ LandingSummary, LSM-OVERDUE's `Selected when`** read `overdue ≥ 1, open_today = 0`. That is
   unsatisfiable; the frame is now rule 3's `count_secondary = 0` branch. Its ID, position, slots
   and text are untouched.
6. **§ LandingSummary, LSM-OVERDUE-TODAY's text** rendered `{count_secondary} more due today` from
   `count_secondary = open_today`. It now renders `{count_secondary} others are due today` from
   `open_today − overdue`, in four literals rather than two.
7. **§ LandingSummary, LSM-CLEAR-TODAY's `count` slot** was `open_all` and is now `inbox_count`.
   Its text did not change, because the sentence was always about Inbox — only the number that
   filled it stopped being.
8. **§ LandingSummary, the "Overdue outranks everything" paragraph.** It read: *"`open_today`
   counts `status: 'today'` or a date of today; a task dated last Tuesday is in neither, so a rule
   keyed on `open_today` alone congratulates a user with three tasks past their date on their clear
   day."* Both clauses are now false — the status leg is retired and overdue is inside Today. The
   ranking is unchanged and its argument is rebuilt on naming rather than safety.
9. **§ LandingSummary's fact-table heading** read *"The four facts it may state"*. The table holds
   six now — `upcoming` and `inbox_count` joined it — so the number came out rather than being
   corrected to one that will go stale again the next time a fact is added.
10. **§ LandingSummary, two rows of § What the awkward cases render**, and **selection rule rows 3,
   4 and 8**. Row 4 is struck through and marked dead; rows 3 and 8 each name a two-way frame split
   in place of a single frame. The table still has eight numbered rows.
11. **§ Skeletons, SK-ROW's `Shape`** read *"five rows under a real day header"* and now reads
   *"under a heading-shaped bar"*. The words were already forbidden by the sentence two paragraphs
   below it — *skeletons carry no text* — and the four buckets turned a contradiction into a wrong
   heading on three of the four collections.

**Two sections gained additive blocks rather than changed cells:** § ListsMenu (the fourth row) and
§ TaskList (the `Overdue` heading and the per-collection grouping rule). Nothing in either was
rewritten.
