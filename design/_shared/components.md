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
| `count_secondary` | integer | **revert frames only** (`UndoResult.skipped.length`) |
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
