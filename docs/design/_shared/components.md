# Component Inventory — todo-ai redesign (F-001)

**Rewritten for visual language v2 in the sections the T-204 screens touch (2026-08-21).** v2
replaces colour, type, spacing, shape and layout completely (`DESIGN.md`, `tokens.json`,
`specimen.html`); **behaviour, copy and every element id are unchanged.** Where a section below
describes *appearance*, that description is v2's. Where it describes *behaviour*, it is the same
text it has always been. Six sections still carry v1 appearance and say so at their head —
§ ListsMenu, § SettingsRow, § ListEditorSheet, § Drawer, § Spoken frames, § Two axes — because
their screens are tranche 2 and rewriting an appearance before it is drawn is how a document
starts describing something nobody has seen.

**Three tokens v2 retired, and what says the same thing now:** `gradient.voice` and the whole
`voice.listening` / `voice.thinking` pair — the gradient is illegal under this direction and the
handoff never once rendered in the running app, so **one accent means *the assistant*** on both
halves of its turn. `success` / `diff.add` / `diff.remove` — state is never allowed to travel on
colour alone, so the `NEW` and `EDITED` labels were already carrying the meaning; the new value
now reads semibold in `text.primary` against the old struck through in `text.muted`, which a
colour-blind reader can follow by construction. `question` is renamed `attention` and keeps its
meaning exactly. Corner radius is **0** everywhere except a message bubble (4), the M3 switch
track and sheet handle (pill), and the mic and the FAB (circle).

All values come from `tokens.json` (referenced below as `color.*`, `motion.*`, …; theme resolved at runtime). Interaction behaviour cites the F-001 AC that fixes it — components render the spec's model, they do not reinterpret it. The surface has exactly four states (idle / listening / thinking / error, AC-29); everything below that looks stateful is a **message** or a **mode**, never a fifth state.

Accessibility floor for every interactive component (AC-19): keyboard operable (2.1.1), exposes name/role/value (4.1.2), visible label text == accessible name (2.5.3), contrast per §Contrast (1.4.3). Focus = 2px `color.focusRing` ring, offset 2px, never removed.

---

## MicControl (the orb) — signature component

Purpose: tap-to-talk entry. Circular (`radius.circle` — one of three shapes in the system that
keep a curve, because the shape *is* the control), `control.height.md` with the platform hit floor
met by padding, sits at the trailing end of the Composer.

**v2 retires the orb's glow, its gradient and its breath.** The one continuous animation left in
the whole system is the **listening rule**: a `border.mark` accent rule growing linearly along the
top of the Composer while the microphone is live, at `motion.duration_ms.rulegrow`. It is the only
thing on screen that moves without the user acting.

**Surface-state renderings** (follow the four states, AC-29 — each transition has a visible cue):

| Surface state | Rendering |
|---|---|
| idle | transparent fill, 1px `bg.rule` border, mic icon `text.secondary`. The quiet state is an outline, not a filled button — nothing is happening |
| listening | filled `accent`, icon `text.onAccent`; the listening rule grows along the Composer; the text input gives way to the live transcript, because while the microphone is live the Composer is not a text field (AC-2) |
| thinking | the same filled `accent`; the rule stops where it stopped and the state indicator reads `Thinking…`. **One accent covers both halves of the turn** — who is speaking is carried by side, ground and label in the message list, and was never carried by hue |
| error | the control returns to its idle outline; the error **message** carries the cause and the retry (AC-24). The control never turns red — a red microphone says *this control is broken* when what failed is the turn |

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

Purpose: voice + text parity — typed input takes the same interpretation path as speech (AC-17).
Text field + MicControl + send. Bottom-docked on `bg.base`, separated by a 1px `bg.rule` — a
boundary that carries meaning, so it is `rule` and not `hairline`. Its content sits in the
conversation's own content column, so the input's left edge lines up with the bubbles above it.

States: empty (placeholder "Say or type what needs doing.") · with-text (send activates) · focused · listening (**the input and send give way to the interim transcript**, at `font.size.lead`, with the words not yet committed in `text.muted`; a text field squeezed to a stub beside a transcript at 390px offers a control the user is not using) · restored (preserved words from cancel/interruption/background reappear here — AC-3, AC-26) · offline (input still works — local no-AI path, AC-25) · disabled: **never** (the composer is never locked; pending questions block nothing, AC-11).

## Message bubbles (conversation surface)

Chat layout is deliberately Zalo-familiar: user turns right-aligned on `bg.ink` in `text.onInk`,
assistant left-aligned on **`bg.sunken`** at **`radius.md`**. Every accent below also carries a text
label — never colour-only.

**Revised 2026-08-22 (T-211).** A bubble was a 1px box at `radius.bubble` 4. `radius.bubble` is
retired; a bubble is a **ground**, not a box (`tokens.json border.box_allowlist`), so the border is
gone and the ground carries it. The `border.mark` left rule on a bubble that changed something stays
— a left mark is one line and is not a box — and the corners on that edge square off to meet it.
**The per-field diff inside an assistant bubble is a ground too**: it was separated from the sentence
above by a hairline and is now `bg.base` at `radius.sm` inside the sunken bubble, which is one
painted line fewer per message and reads as a block rather than as a table.

**Newest at bottom, and the rule that makes it true is worth its own sentence because the build
dropped it.** The conversation container takes `margin-top: auto` inside its scroller — **not**
`align-items: flex-end`, which clips the top of an overflowing thread. A short thread therefore
sits *on* the Composer instead of floating at the ceiling. Measured in the shipped app before this
was redrawn: two bubbles at the top of the panel with **618px** of nothing between the last one and
the Composer at 1440, and **462px** at 390. Zalo, Momo and every messenger the audience opens daily
anchor a short thread to the bottom.

**A bubble that changed something carries a `border.mark` accent rule down its leading edge**, and
that is the only place the accent appears in the thread. `attention` marks a bubble that is asking;
`danger` marks one that is reporting a failure. One rule, one meaning, never two on one bubble.

| Bubble | Purpose + anatomy | Key states |
|---|---|---|
| UserTurn | the user's words (spoken or typed) — plain bubble, right side | default · queued (see QueuedTurnNotice) |
| Applied | AI applied a turn (AC-1, AC-4): per-field old→new diff rows — **old struck through in `text.muted`, new semibold in `text.primary`, no tint and no hue on either**, so the diff is legible without colour vision; creates labelled `NEW` with no fabricated old value; deletes named by title; count stated. The numeric face is used on the values that are times, dates or counts and **not** on a task title, which is user content in an arbitrary script. Carries UndoAffordance | default · undone (marked, `text.muted`, Undo gone — AC-6) |
| Question — clarify | ≥2 matching tasks (AC-13): question text + OptionChips of the **actual candidates** | pending (leading `attention` rule, question text in `attention` at semibold, bubble ground unchanged — a tinted fill plus a rule plus coloured text is three signals for one meaning) · resolved (rule off, chips disabled) |
| Question — confirm | bulk delete (AC-9): names count + titles, affirmative/negative OptionChips | pending · resolved (same as clarify) |
| Outcome | resolution results, one bubble per resolution — variants: executed (full Applied anatomy incl. Undo, AC-11) · declined · declined-superseded · already-resolved · undo-refused with reason (AC-6) | variant is content, not colour; executed uses Applied styling |
| Reverted | undo result (AC-7): reverted tasks named; **skipped tasks named**; all-skipped renders "nothing was reverted" wording, never a success | default |
| NoMatch | no matching task (AC-14): message **quotes the heard transcript** in `font.family.body` italic so a mishearing is visible | default |
| Error | AI error (AC-24): `danger` accent bar, plain cause, Retry button (same `client_turn_id`, AC-16); user's words kept in Composer | default · retrying (spinner on button) |
| BoundaryMarker | session close (AC-28): a full-width `bg.hairline` rule broken by one uppercase `font.size.label` word in `text.muted`, close reason + the closed session's terminal outcomes (questions declined by name, late-resolved turns named). Exactly one per clean start | default |
| QueuedTurnNotice | turn in flight when connection dropped (AC-25): thin note under the UserTurn, "Waiting for the network — will send again" | queued · replaying · resolved (notice disappears, outcome renders) |

Empty conversation state: `font.family.display` line "Say it. I'll write it down." + one `text.muted` hint line. No fabricated sample messages.

## Spoken frames (F-002 talk-back — AC-22)

> **Still v1 appearance.** Behaviour, copy and ids below are current; the *look* is the
> retired language, and it is rewritten when this surface is drawn — F-002 is specced and unbuilt, so there is no rendering to describe.

**Scope note:** this section belongs to **F-002**, not F-001. It is placed here because `docs/specs/assistant/F-002-talk-back.md` AC-22 makes this file the owning artifact for spoken sentence frames, and its test **parses this section by row ID at run time** (L-008 — the assertion fails when the upstream artifact moves, which is the direction drift travels). Nothing above this section changes.

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

Purpose: tappable answer to a question — tap sends the option's **literal text as a normal turn**
(AC-10, AC-13); a tap binds explicitly to its question's turn. **`radius.sm`** (a chip is a control),
`control.height.sm` with the platform hit floor met by padding, **`bg.sunken` ground and no border**,
`text.primary` label at `font.weight.semibold`. Pressed state is `text.primary` fill.

**Revised 2026-08-22 (T-211).** The chip was square with a 1px `bg.rule` box. Four chips in a row
were four boxes, which is `border.density_rule`'s symptom exactly; `border.separation_order` says
ground first, so the ground took over and the outline now returns only on focus.

**It is deliberately not accent-coloured.** A chip is the *user's* answer, and `accent` means the
assistant. The chip a user is choosing between should read as a control, not as something the
assistant is recommending.

States: default · hover · focused · pressed · disabled (question resolved — stays visible for history, `text.muted` border and label) · loading (the sent chip shows the standard sending cue).

## UndoAffordance

Purpose: one-gesture undo of the newest applied turn (AC-5), by tap here or by voice ("undo").
Button inside Applied/executed bubbles: the `accent-quiet` variant — `accent` text and a 1px
`accent` border on the bubble's own ground, with the undo icon. **It wears the accent because
reverting is the assistant's own act**, which is the same reason `put back` (§ Buttons, § CarriedNotice
CN-UNDO) wears none: a delete your own hand performed was never the assistant's.
States: default · hover · focused · pressed · gone (a newer applied turn or session close removes it visibly, AC-8 — the bubble keeps a `text.muted` "Undo window passed" note so history stays honest) · undone (replaced by "Undone" label).
A stale/voice undo outside the window renders AC-6's refusal Outcome — the affordance never fails silently.

## TaskRow (+ AI-change marker)

Purpose: the source of truth (F-001 Purpose) — a flat row with no border and no shadow at any state,
`control.height.lg` minimum, **separated from its neighbour by space and by nothing else.**

**Revised 2026-08-22 (T-211): the row separator is deleted, not restyled.** `time · checkbox · title`
is not a table, so `border.when_a_line_earns_it` case 2 does not reach it, and it is what Things 3 and
Apple Reminders draw between rows: nothing. Measured consequence — at 1920 five full-width hairlines
turned half-empty rows into stretched rules; `layout.ultra_answer` records the two renders that settled
it. **Hover and focus-within now paint a `bg.sunken` ground at `radius.md`** — a ground, not a box, and
the first thing `border.separation_order` reaches for.

**The marks sit beside the open affordance, not inside it** (same revision). Inside, the open button's
visible text ended in the urgency `!` while its accessible name did not — a WCAG 2.5.3 label-in-name
mismatch — and the mark's own meaning was never announced at all. Each mark now carries
`role="img"` and its own name (`High priority`, `2 steps`, `Repeats weekly`), and the open control's
label is exactly the task's title.

**Anatomy, left to right: the time rail, then the checkbox, then the title, then the trailing
delete.** The due time leads the row rather than trailing it — see § TimeRail, which is where the
whole novelty budget of this system is spent. A title **wraps to as many lines as it needs and the
row grows**; it is never truncated to protect a column, because clipping a task's own name to keep
a column tidy is the same mistake the 197px field made.
**AI-change marker (AC-4):** rows in the current turn's `changed_task_ids` get an uppercase
`font.size.label` marker — `NEW` on `accentTint` in `accent`, or `EDITED` on `bg.sunken` in
`text.secondary` (per-field old→new on tap-expand) — plus a one-time arrival cue. **The cue is a
`border.mark` `accent` rule down the row's leading edge, not a background tint**: a tinted row
changes the ground under the time and the title and costs both of them contrast, and it reads as a
selection rather than as news. Hold `diffFlashHold`, fade `diffFlashFade`. Only the turn's own changes are marked — hand edits and other turns' rows never attributed. No raw uuids or draft-ref tokens ever render.
States: default · hover · focused · pressed · done (strikethrough `motion` MO-3, 60% fade) · editing (inline, manual path) · flashing (above) · marker-expanded (diff visible) · empty list state ("No tasks yet — say one." + hint).
Manual path: create/edit/complete/delete all doable by touch with zero AI calls (AC-18).

### The row's mark budget — three marks, one line, one decision (added 2026-08-19, T-152)

F-005 asks the row for three new marked meanings at once: **AC-9's urgency**, **AC-17's remaining-step
count** and **AC-39's repeating-series indicator**. `## Impact` §8 asks design to decide the row
**once** rather than absorb three independent additions, and that is what this subsection is. **AC-43's
hand-action undo is not on the list** — the owner placed it in AC-47's notice family on 2026-08-19
(`docs/reports/owner-decision-2026-08-19-close-gate-one.md` §2), so it renders in `§ CarriedNotice` and never
on the row. This is the correction of the count `## Impact` §8 got wrong twice (design D23).

**None of the three carries colour.** `DESIGN.md ## Colour rules 5` records the decision and its
reasons; the short form is that the accent set is closed at five, this row already renders under a
`danger` Overdue heading on every row of Today in the live store and can also carry a `NEW`/`EDITED`
marker in green or red, and urgency has three levels that a single hue cannot encode. Each mark is
carried by **shape, weight and its accessible name** — which is also what AC-33's 1.4.3 requires of it
regardless of what colour it were given.

**The budget, stated as a rule rather than as three additions.** All three marks live in `.task-main`
— the baseline-aligned, wrapping line the title and the deadline meta already share — as inline
siblings **after** the title, in one fixed order:

> checkbox · **title** · urgency · deadline · repeat · steps · (delete control)

The order is not alphabetical and not arrival order. Urgency leads because it is the only item the
**user** set as emphasis and it changes how the title is read; the deadline follows because it is the
fact most often consulted; repeat explains where a row the user never typed came from; the step count
is a number about a different set and is last. **Four items is the ceiling.** A fifth marked meaning on
this row is refused until one of these is removed — the row's own record spent an explicit argument
keeping it clean (*"One signal, not two"*, Overdue, T-133) and a budget that can be topped up is not a
budget.

**Nothing drops at a narrow width.** `.task-main` already wraps (`flex-wrap: wrap`), so at
`breakpoints.mobile` the marks wrap under the title rather than being truncated or hidden: a mark that
disappears at one width is a mark the user cannot rely on, and the accessible name would then disagree
with the visible row. The ceiling on the wrap is **two lines at `breakpoints.mobile`** with all four
items present. **That figure is a requirement here and a measurement owed at `phase: screens`** — no
content-width floor is published for these marks, for § Touch's stated reason: its floors are measured
from a shipped control and none of these has shipped.

| ID | Mark | Rendering | Renders when | Renders nothing when | Accessible name |
|---|---|---|---|---|---|
| **TR-URGENCY** | urgency (AC-9) | **a single `!`** at `font.size.meta`, `font.weight.emphasis`, **`text.primary`** — the one item in this line that is not muted, which is the "weight" half of *shape, weight, name* | `priority` is **`high`** | `priority` is `none`, `low` or `medium` — see the decision below | the **row's** name carries the priority in all four states: `high priority` · `medium priority` · `low priority` · `no priority` — four literals, never assembled from the level name |
| **TR-REPEAT** | repeating series (AC-39) | Lucide `repeat` at `icon.size.sm`, `text.muted` | the task belongs to a **live** series — AC-25's `series_live`, read from the wire, never keyed off `series_id` | the repeat was cleared · the series ended by end-date or run count · the series was deleted (AC-30's fourth ending) — and a **completed occupant of a live series keeps the mark** | `repeats` |
| **TR-STEPS** | remaining steps (AC-17, **web only**) | Lucide `list-checks` at `icon.size.sm` + the count in tabular numerals at `font.size.meta`, `text.muted` | the task has ≥1 step outstanding; the count is that number, never `collectionCount` (L-004) | the task has no steps, or none outstanding | `1 step left` · `{count} steps left` — **two literals**, singular and plural, not a template over a noun (§ NewMessageAffordance's rule, L-008's reason) |

**One glyph, and only `high` wears it — the decision AC-9 hands to design *"within the one-glyph
vocabulary"*.** AC-9 fixes the vocabulary at **one glyph**, deliberately *"not Apple's graduated
`!` / `!!` / `!!!`"*, and 1.4.3 forbids carrying the difference in colour. That leaves the level
undistinguishable by any means the vocabulary allows, so the question is which of the four states render a
mark at all. **`high` renders the `!`; `none`, `low` and `medium` render nothing.** Three reasons:

1. **One glyph cannot render three levels perceivably.** Weight, opacity or size on a 13px `!` produces
   two states a user cannot reliably tell apart, and a mark that might mean *high* or might mean *medium*
   is worse than no mark: it asks the user to open the task to find out, which is the one thing AC-9
   exists to avoid.
2. **It is the AC's own reason for `none`, applied consistently.** AC-9 has `none` render nothing *"so
   the marks stay meaningful"*. `low` is the level a user picks to say *this one matters least*; marking
   it makes the mark mean *has a priority*, which is a fact about the data rather than a signal about the
   work. Marking two of four levels dilutes the one signal exactly as marking all of them would.
3. **It is the inheritance, not a reduction of it.** The source product had one top-level priority and one
   `!`; AC-9 tells this row to start there.

**All four states are distinguished in the accessible name regardless** (AC-9's own clause), and because
three of the four render no element, that name lives on the **row** — `assistant-task-row` — not on
`tasks-row-priority-mark`, which exists only in the `high` state. QA asserts `low`, `medium` and `none`
through the row's name and `high` through both. The cost of the clause is honest: an unmarked row
announces `no priority`, which is a word on every row that has none. It is stated because the AC requires
it, and it is where an owner who finds it noisy should look.

**Two documents disagree about whose call this is, and it is flagged rather than resolved here.** AC-9's
sub-bullet says it is *"design's within the one-glyph vocabulary"* (which is what this subsection has
just exercised); **OQ5** lists *"whether `low` and `medium` carry a mark at all, or only `high` does"*
among the things still the owner's. Nothing structural rides on it — if the owner rules that `low` and
`medium` do mark, they wear the **same single `!`**, the order, the ceiling and the ids are untouched, and
only the `renders nothing when` cell changes.

**Testids — web here, mobile owed to F-003.**

| Testid | Mark | Platform |
|---|---|---|
| `tasks-row-priority-mark` | TR-URGENCY | web |
| `tasks-row-repeat-mark` | TR-REPEAT | web |
| `tasks-row-steps-mark` | TR-STEPS | web |

All three sit on non-interactive elements, exactly like `tasks-save-notice` and
`assistant-offline-banner`: the mark **is** the deliverable of AC-9, AC-17 and AC-39, so a catalogue
that skipped it would leave the one observable each AC has untestable. **They are deliberately not in
§ Testid catalogue — app shell**, because that catalogue is mirrored one-for-one into
`src/assistant/mobile/model/a11y.ts SHELL_A11Y_IDS` and TR-STEPS is `(web)`; putting a web-only id
there would make the mirror assert an id the phone must never carry.

**What is owed to F-003 and is not invented here.** AC-9 and AC-39 are `(web, mobile)`, so the phone's
row gains **two** of the three marks (not TR-STEPS). `F-003` owns the mobile list and **its id catalogue
is closed and structurally asserted** (`ALL_A11Y_IDS`, 23, parsed from the two mockups in both
directions), so the mobile spellings of TR-URGENCY and TR-REPEAT are **F-003's amendment to make, not
this pass's** — recorded here as a named debt rather than as a pointer, because a pointer that names no
item is how an obligation gets believed-recorded (design D27). Until F-003 carries them, a QA author has
no legal selector for either mark on the phone and must not invent one.

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

**The heading is `color.danger`, and it is the one day heading that is not `text.muted`** (added
2026-08-18, T-133 — previously asserted only by `.day-head.overdue` in the three mockups, which
left the drawing as its sole authority). Size, weight, letter-spacing and position are every other
day head's exactly; **only the colour differs**, which is what keeps it one signal and leaves the
rows below untouched. The colour is doing the work the group was added for: the owner's question
was *does a task I missed still say it was missed*, and a muted grey label answers that too quietly
to count. It stays calm — a small uppercase label, no fill, no icon, no badge, nothing on any row.
`danger` on `bg.base` is a § Contrast-verified pair (7.7 dark / 5.3 light), so this introduces no
new pair.

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
produce is dead structure. Against the four rows the Lists menu opens:

| Collection | Groups | Why |
|---|---|---|
| **Today** | `Overdue`, then `Today · {date}` | Two, both true. `Tomorrow`, `Later` and `Anytime` are unreachable here by the predicate |
| **Upcoming** | `Tomorrow · {date}`, then `Later` | Tomorrow is the actionable edge of a future collection. `Overdue`, `Today` and `Anytime` are unreachable. `Later` is coarse — routed below |
| **Inbox** | **all five**, in the order above | **Rewritten 2026-08-18 (T-138).** Inbox is a container, not a date, so it holds rows from every cell of the date axis. It is the only collection that can produce all five headings — below |
| **Done** | **none — flat** | The one that would ship a new falsehood — below |

**Inbox groups, and the row it replaces was resting on a premise that no longer exists** (rewritten
2026-08-18, T-138, for ADR-009 § Amendment 2). This cell used to read *"none — flat: Inbox **is** 'no
date', so `Anytime` is true of every row it can ever hold."* Inbox is now the tasks filed into no
personal list, which says nothing about dates, so it can hold an overdue row, a today row, a
tomorrow row and a future row alongside its undated ones. `Anytime` stops being true of every row
and becomes what it is everywhere else: one group among five.

**The cost of leaving it flat is not a missing heading, it is a missing fact.** *One signal, not
two* put lateness in the group heading and deliberately nowhere else — no badge, no red date, no
icon on the row. A flat Inbox therefore renders its late rows with **no lateness signal anywhere on
the surface every account opens**, and that is not hypothetical: measured against the live store,
Inbox holds 716 rows of which **7 are overdue** and 709 are undated (ADR-009 § Amendment 2 § 4).
Flat, those 7 sit unmarked in the middle of 716. Grouped, they sit at the top under `Overdue` in
`color.danger`.

**So `Overdue` is more load-bearing than when it was specified, not less.** It was added for one
collection and now carries lateness on two — and on the second one it is the *only* thing carrying
it, because Inbox's rows are not otherwise ordered by date. Nothing about the heading changes: same
word, same `color.danger`, same size, weight and position, same silent rows beneath it. What
changes is how much rests on it, which is worth stating because the next person tempted to soften
it will be reading a rule written when it had half the job.

**The other four headings all earn their place on Inbox too**, which is the test this section
applies everywhere: `Today · {date}` separates what is due now from what is merely sitting there,
`Tomorrow · {date}` and `Later` say the same about work already dated forward, and `Anytime` — for
the first time — names a real subset rather than the whole collection. Today it names 709 of 716
rows, which looks like the heading-true-of-everything this section forbids and is not: the rule is
about what a collection *can* produce, and a heading that is true of 709 rows today is false of the
7 above it.

**Two collections now render the same rows under the same heading, and that is the model showing
through rather than a duplication bug.** The 7 overdue rows appear under `Overdue` in Today *and*
under `Overdue` in Inbox, because a task has a date cell and a filing cell at once (ADR-009
§ Amendment 2 § 1). Recorded because it is the first thing that looks wrong in a screenshot diff
and the first thing a reader will try to fix by removing one of the two.

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

### The Tasks surface title names the collection it is rendering (T-133)

Added 2026-08-18. Previously the rule existed only as `showState`'s `TITLES` map in the three shell
mockups, which made the drawing its sole authority.

The Tasks top bar's `h1` is the name of the collection currently on screen — `Today` · `Upcoming` ·
`Inbox` · `Done` — and it is **derived from the rendered collection, never typed per view.** A view
that can show one collection's rows under another's name is the class of falsehood ADR-009
§ Amendment exists to remove, and it is the cheapest one to reintroduce: four static headings in
four templates drift the first time a predicate moves.

**The string is the one § ListsMenu's LM-COLLECTION row already carries**, not a second spelling of
it — the § Buttons *one word per concept* rule applied to navigation. That is also what makes the
rule checkable rather than merely stated: **the title's text equals the active menu row's text.**

**Its domain is exactly the four built-in collections.** A personal list's name in this header is
blocked on `lists` + `tasks.list_id` (IA §7, § ListsMenu LM-LIST), so the title has four possible
values today and no fallback case to design.

## OfflineBanner

Purpose: no half-running conversation (AC-25) — a full-width note above the Composer on `bg.base`
inside a 1px `bg.rule`, with a `border.mark` `attention` rule down its leading edge and the icon in
`attention`; the sentence itself stays `text.secondary`, because a banner whose every word is
coloured reads as an alarm about something that is merely true: "No connection — the list still works, and what you type is saved on the device." Shows queued-turn count when one is in flight.
States: offline · offline-with-queued (count) · replaying · hidden (online).
**Its inset changed 2026-08-22 (T-218):** it pads `space.3` rather than `space.4`, and a marked
banner pads `space.3 − border.mark` on the leading side, so its icon lands on the text gutter like
every other block's leading item. See § The gutter rule — this is the one component the rule moved
outside the task detail, in all nine mockups, and nothing else about the banner changed.

## NewMessageAffordance

Purpose: BUG-004 / **owner decision 2026-08-17** — when messages arrive while the user is not at the bottom, **the view does not move**; one control near the Composer says so, and tapping it scrolls to the newest message. **One control, however many messages arrived** — it never multiplies and there is never one per message.

Placement: a pill, horizontally centred, docked just above the Composer (above the OfflineBanner when that is showing). It **overlays** the last line of the conversation rather than reflowing it: an affordance that appears by pushing history upward moves the sentence the user is reading, which is the defect it exists to prevent. `radius.sm` (a control; 2026-08-22, T-211), `shadow.overlay` (this is a layer floating over another, which is the one thing that shadow is legal for), `control.height.sm`, `font.size.meta` at `font.weight.semibold`, down-arrow icon at `icon.size.sm`.

**Why the label carries a state.** The owner was offered a carve-out that would have scrolled a bulk-delete confirmation into view and declined it (decision rule 5), so a destructive question can sit unseen behind this one control while the app waits for an answer. That consistency was chosen knowingly, and its whole cost lands here: this control is the user's only indication that anything is pending. A label reading the same whether the app is idle or blocked on an answer would spend the consistency and return nothing. So the affordance **names its newest reason**: with nothing pending it reports a count; with a question pending off screen it stops reporting and asks, quoting the question's own head and taking the `attention` accent that already means *needs your answer* everywhere else in this catalogue. One control, one position, one action, one tap target — only the words and the accent change.

| ID | State | Shown when | Label | Rendering |
|---|---|---|---|---|
| **NMA-HIDDEN** | hidden | the newest message is on screen — after a tap, and after the user reaches the bottom by hand | — | not rendered; it holds no layout, so nothing reflows when it goes |
| **NMA-NEW** | new | ≥1 message arrived while the newest was off screen, and **no** question is pending off screen | `1 new message` · `{count} new messages` | `bg.ink` fill, `text.onInk` label and arrow — the strongest ground in the system, because this control has to be seen over a thread |
| **NMA-WAITING** | waiting on you | a question (clarify or confirm) is **pending** and off screen — whatever else also arrived | `Waiting for your answer — {question}` | `attentionTint` fill, 1px `attention` border, `attention` text and arrow |

**Slots** (same closed vocabulary as §Spoken frames): `count` integer — the two literal forms above are the whole set, singular and plural, not a template over a noun. `{question}` is `verbatim`: the pending question's own head as §Message bubbles publishes it ("Delete 3 tasks?", "“Meeting” matches two tasks — which one?"), never re-worded for the pill. The label is one line where it fits and **two at most** where it does not (RN `numberOfLines={2}`); the accessible name keeps the whole string either way. The second line is not cosmetic: at 375px a single non-wrapping line ellipsises the question away and leaves "Waiting for your answer — Delete …", which announces that something is pending and withholds what — the exact failure this row exists to prevent. NMA-NEW never needs the second line.

**Precedence is one rule, not a special case.** NMA-WAITING outranks NMA-NEW whenever a question is pending, because a count cannot say the app is waiting. A question that has resolved — answered, or declined by a later unrelated turn (§Outcome *declined-superseded*) — is no longer pending, so the control falls back to NMA-NEW. **This is not the carve-out the owner declined:** the view still never moves on its own, for this message or any other.

**Tapping only scrolls.** It never answers, dismisses or resolves anything — the question's OptionChips remain the only way to answer (AC-10), so the pill cannot become a second, quieter answer path.

Control states: default · hover (web: NMA-NEW's ink fill lightens toward `text.secondary`; NMA-WAITING keeps its own tint) · focused (ring) · pressed (scale 0.96) — the §Buttons behaviours, unchanged.

A11y: `role=button`; the accessible name is the visible label followed by the action, so the visible text is always a prefix of the name and never a replacement (2.5.3). Two literals, because the punctuation differs and a template would guess: NMA-NEW → `{label}, scroll to newest`; NMA-WAITING → `{label} Scroll to newest` (the label already ends in a question mark, so the action is a new sentence, not a clause). The dock is a `polite` live region, so a screen-reader user hears the control arrive **and** hears it change from NMA-NEW to NMA-WAITING. Keyboard: it sits in DOM order between the conversation and the Composer, so `Tab` out of the conversation reaches it before the input. Hit area follows the platform minimum (44pt / 48dp) via `hitSlop`; no content-width floor is published in §Touch, because those floors are measured from a shipped control and this one does not exist yet.

**It does not depend on motion.** Presence, wording and accent carry the whole meaning; under `prefers-reduced-motion` / reduce-motion the control appears and reads identically and only the scroll it triggers changes.

Testid: `assistant-new-message-affordance` — one id on the control in all three mockups, exercised by the `nma-new` and `nma-waiting` mockup states (the state names are the row IDs).

## SessionMarker

The idle-auto-close marker (AC-28) — same rendering family as BoundaryMarker; a resumed open session renders **no** marker (resume is visible by the conversation simply continuing). States: closed-idle · closed-with-declines (names them) · none.

## Buttons

Variants, v2 (2026-08-21): **primary** (fill `accent`, text `text.onAccent`) · **accent-quiet**
(text `accent`, 1px `accent` border, no fill — Undo, and only actions that are the assistant's own)
· **secondary** (text `text.primary`, 1px `bg.rule`, no fill — this is what `neutral` became) ·
**ghost** (text `text.secondary`, no border, no fill) · **danger** (fill `danger`, text
`text.onAccent` — legal **only inside a confirmation** whose sentence has already named what goes)
· **danger-quiet** (text `danger`, 1px `danger` border — the action that *asks*). All at
**`radius.sm`** (2026-08-22, T-211 — a button is a control, and `radius.assign.sm` is what a control
takes; they were square), `control.height.md`, `control.padding_x.md`, with the platform hit floor met
by padding and never by painting a bigger control.
States: default · hover · focused · pressed (scale 0.96) · disabled (40% opacity, no pointer) · loading (spinner replaces label, width locked).

**Why `neutral` exists, because three variants were not a shortage until F-005** (added 2026-08-19, T-152). Every one of the three carried an assigned meaning through its fill or its text: `primary` and `ghost` were both the accent token, which § Colour rules 1 assigns to *the assistant* and § UndoAffordance fixes as *"the assistant's own act"*; `danger` is red. F-005 AC-43's hand-action undo is an action the user's own hand caused, and the AC forbids the accent for it **wherever it renders** — so it could wear none of the three, and the catalogue had no way to draw an action that means nothing beyond *this is a button*. `neutral` was that: built entirely from neutrals, adding no colour meaning, and reusable anywhere
an action must not claim one. **v2 keeps the requirement and renames the variant `secondary`**,
because in a system whose ground is white and whose structure is 1px rules, a neutral-fill button
and a bordered no-fill button are the same button drawn twice. It is `text.primary` on no fill
inside a 1px `bg.rule`; `bg.rule` on `bg.base` measures **3.00** and clears 1.4.11's 3:1 for a
non-text boundary, and the label clears 1.4.3 by a wide margin. Hover fills to `bg.sunken`. Zero new
tokens. States and focus/pressed/disabled/loading behaviour are the rows above, unchanged.
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
| **reversing a delete or a reorder the user performed by hand** (F-005 AC-43) | **put back** | undo, revert, restore, undelete, take back, bring back, recover |
| the date a task must be done by (F-005 AC-10) | **deadline** | due date, due, when, target, by-date |
| a task inside a task (F-005 AC-14 … AC-18) | **step** | subtask, sub-task, child, checklist item, item |

**The three rows added 2026-08-19 (T-152), and the first one needs its reasoning beside it.** `put back` is not a synonym for `undo` sneaking past the row above it — it is the row above's rule being *obeyed*: **undo** is bound to reversing the last applied **turn**, F-005 AC-43 defines a different mechanism (reversing a delete or a reorder the user's own hand performed), and one word per concept means the second mechanism gets its own word rather than sharing one. `§ SaveNotice` refused to carry an `Undo` action for exactly this reason, in writing, and that refusal stands. Note `take back` is forbidden **as a synonym for undo** and `put back` is close to it in shape — the difference is the whole point of the two rows, so they are read together: *undo* reverses what the assistant did, *put back* returns what your hand removed. The word has precedent outside this catalogue (Apple Photos' *Put Back* for recovering a deleted photo), which is what keeps it standard copy for a standard action rather than a themed replacement. It renders in `§ CarriedNotice` as CN-UNDO, in the `secondary` variant above, never in the accent.

**`deadline` and `step` are here because this pass publishes strings that use them.** F-005's own vocabulary is *deadline* and *step*, `§ CarriedNotice`'s literal message table names both, and a word that appears in published copy and not in this table is the drift the table exists to stop. `due_at` and `parent_id` remain the field names; these are the words the user reads.
## Drawer (carried, pending Open Question 1)

> **Still v1 appearance.** Behaviour, copy and ids below are current; the *look* is the
> retired language, and it is rewritten when this surface is drawn — nothing in tranche 1 renders it.

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

**Superseded by `DESIGN.md ## Contrast` for v2 — the numbers below are v1's and describe a palette
that no longer exists.** The current computed pairs live in `DESIGN.md`, are re-derived from
`tokens.json`, and are what `.claude/tools/design-check` reads its 4.5:1 threshold against. Kept
here as the record of what was measured before. Dark theme: `text.primary`(17.5/15.8), `text.secondary`(9.0/8.1), `text.muted`(5.6/5.0) on `bg.base`/`bg.raised`; `primary` 7.0/6.3; `voice.listening` 12.3/11.1; `danger` 7.7/6.9; `success`&`diff.add` 11.2/10.1; `question` 12.0/10.8 on base/raised; `text.onAccent` on `primary` 7.0, on `voice.listening` 12.3, on `danger` 7.7; accents on own tints: add 9.3, remove 6.8, question 9.9, listening 10.1, `text.primary` on `primaryTint` 15.6. Light theme: `text.primary` 15.5/16.6, `text.secondary` 7.8/8.4, `text.muted` 5.4/5.8 on `bg.base`/`bg.raised`; `primary` 6.1/6.5; `voice.listening` 4.6/4.8; `danger` 5.3/5.7; `success` 5.0/5.3; `question` 5.5/5.9; white on `primary` 6.5; accents on own tints: add 4.6, remove 4.8, question 5.1, listening 4.8, `text.primary` on `primaryTint` 13.7.
**One pair added 2026-08-19 (T-152)** for § Buttons' new `neutral` variant, computed by the same formula: `text.primary` on `bg.hairline` **13.28** dark / **13.34** light. It is a neutral-on-neutral pair, so the accent rule below does not bind it; the variant's 1px boundary is `text.muted` against `bg.raised` at **5.01** dark / **5.78** light, which clears 1.4.11's 3:1 for non-text. No accent gained a new ground and no new colour token exists, so every other pair in this section is unchanged and still complete.

Rule for implementers: accent text is legal only on `bg.base`, `bg.raised`, or its own tint token — any new pairing must be re-verified before use. The `gradient.voice` surface never carries body text; the live transcript renders on `bg.base` beside it, `text.primary`.

---

# App shell — the surfaces outside the conversation

**Added 2026-08-17 (T-101), additive.** Nothing above this line changed except the § Buttons
house-word table, which gained rows at its foot. Structure, purpose and per-surface states are
in `docs/design/_shared/information-architecture.md`; this section is the component half — what each
new thing renders and in which states. Mockup: `docs/design/assistant/screens/app-shell.html`.

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
| **PS-TASKS** | Talk | `Tasks` + count badge | square outline button, 1px `bg.rule`, list icon, `text.primary`; the badge is a **square `accent` fill with `text.onAccent`**, `font.size.meta` in the numeric face — the one place a count is loud, because it is the only peripheral evidence that the second path exists |
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

> **Still v1 appearance.** Behaviour, copy and ids below are current; the *look* is the
> retired language, and it is rewritten when this surface is drawn — the wide-frame Lists rail (§ AppFrame, tier 3) answers half of what this section is for and the slide-over is redrawn beside it.

Purpose: choose which collection Tasks renders, make a list, reach Settings. Opened by the
hamburger on the Tasks surface. **A slide-over panel from the left at every width** — scrim,
`shadow.raised`, an explicit close control. Considered and rejected: a permanent rail at
≥ 1024px. It is navigation you visit and leave, not a frame you work inside, and two
presentations mean two behaviours to spec, build and test — one of which (the rail) has no close
control, so its testid can never resolve at desktop. One presentation, one contract.

Three row families, one rendering, different sources:

| ID | Family | Rows | Source |
|---|---|---|---|
| **LM-COLLECTION** | built-in | Today · Upcoming · Done · Inbox | `collectionCount(tasks, c, now)` per row — **not** `task.status`, which ADR-009 §1 retired. **Three of the four are date-or-status predicates and the fourth, Inbox, is a container** (§ Amendment 2). All four are derivable on device, which is what this family means |
| **LM-LIST** | personal | the user's lists | **needs `lists` + `tasks.list_id`; no field exists** |
| **LM-ACTION** | actions | New list · Settings | New list needs the field; Settings does not |

Row anatomy: icon (`icon.size.md`) + name + count, `font.size.body`, `padding: sm md`,
`radius.sm`. Active row = 7% `primary` tint — the one legal chrome tint, carried unchanged from
§ Drawer. Counts are `text.muted`, tabular, and omitted at zero for the same reason PS-TASKS
omits its badge.

**The fourth row — Upcoming (added 2026-08-18, T-128).** ADR-009 § Amendment states this one as a
requirement in architecture's own words: *the Upcoming collection must be reachable from the Lists
menu.* Without the row a future-dated task is in no **date** collection the user can open and
**nothing errors**. Name, look and position are design's:

*What carries AC-24 changed under it, twice, and the row's own requirement did not* (annotated
2026-08-18, T-138). This paragraph read that AC-24's reachability bound *"used to rest on Inbox
being a superset of every open task and now rests on the four buckets being total."* Under
ADR-009 § Amendment 2 § 6 it rests on neither: the bound is carried by the **filing** axis, which
is total and every cell of which is openable — today that is Inbox alone. The Upcoming row's
requirement is **not retracted**, it is narrowed to what it always actually proved: without it a
future-dated task is unreachable *as a dated task*. Recorded rather than quietly rewritten, because
the same bound has now been justified three different ways and twice the reason expired without
anyone noticing.

- **Name: `Upcoming`.** It is the word the owner decision, ADR-009 § Amendment and
  `information-architecture.md` §9 already use, and `todo-ai ADR-11` named it before any of them;
  picking a synonym now would be inventing a second name for a thing four artifacts have already
  agreed on. Rejected: **Later**, which is the heading `groupTasks` renders *inside* a list — one
  word naming two different sets on one screen is the collision this file refuses everywhere else;
  and **Scheduled**, which is accurate and is nobody's word for it.
- **Position: `Today · Upcoming · Done`** (amended 2026-08-18, T-138 — it read
  `Today · Upcoming · Inbox · Done`). By time horizon — now, then ahead, then finished. Upcoming
  sits beside Today because they are the same kind of fact one day apart. The original cell placed
  Inbox third and justified it as *undated*; Inbox is not a date at all, and taking it out of this
  row leaves the horizon **unbroken** rather than damaged. Where it went is the next block.
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

### Where the Inbox row sits (decided 2026-08-18, T-138)

ADR-009 § Amendment 2 leaves this open in as many words, and it is a real question rather than a
default: the menu's four built-in rows **stopped being four of a kind.** Today, Upcoming and Done
are *views* — they answer *what is this task doing* from the task's own fields. Inbox is a
*container* — it answers *where does this task live*, and it is the first cell of an axis whose
other cells are the personal lists two families down. A menu that draws those five rows as one
uniform column is asserting a kinship that the model does not have, and it asserts it in the one
place a user reads the model at all.

**The decision: two visual groups. `Today · Upcoming · Done`, then a group break, then Inbox at
the head of the filing rows.**

```
Today        5          ← views + the gate: what a task is doing
Upcoming
Done         4
                        ← group break: space, no rule, no header
Inbox       16          ← filing: where a task lives. Always present
  Your lists            ← LM-LIST's existing sub-label, when lists exist
Work         5
Home         2

New list                ← LM-ACTION, unchanged
Settings
```

**Four things this buys, and the first is the one that decided it.**

1. **It answers the nested-count problem without a word of explanation.** Numbers look like they
   should add up when the rows carrying them look like siblings under one heading. Separate the
   groups and the arithmetic claim disappears: nobody adds `Today 5` to `Settings`, and nobody will
   add it across a group break either. See the next block for what the counts actually do.
2. **It is where the row has to end up anyway.** When `lists` ships, Inbox is the container you
   empty *into* the rows below it. Leaving it among the views now means moving it later — after
   users have learned where it is, which is a cost navigation should pay once and pay early.
3. **It makes the arrival of LM-LIST additive.** The filing group already exists with one row in
   it; lists append beneath Inbox. No new section appears, nothing reflows above.
4. **It repairs the horizon order it removes itself from.** `Today · Upcoming · Inbox · Done` was
   published as *now, ahead, undated, finished* and the third word is no longer true of Inbox.
   Taking Inbox out leaves *now, ahead, finished* — monotonic, and needing no new justification.

**What it costs, stated rather than implied.**

- **Today the filing group holds exactly one row**, so the break buys legibility for a structure
  the user cannot yet see. That is a real cost paid now against a payoff that lands with UC-41.
  It is accepted because the alternative pays it later *and* moves a learned row.
- **Inbox moves.** `COLLECTIONS` (`src/assistant/_shared/model/tasks.ts:42`) ships
  `['today', 'inbox', 'done']` and `ListsMenu.tsx` renders in that order, so this is the first
  change to this menu that reorders an existing row rather than inserting one. Reported to the
  implementation pass, not fixed here.
- **Done now sits above Inbox**, which reads oddly for one beat — finished work above the pile.
  It is the price of grouping by kind rather than by mood, and the group break is what makes it
  legible: Done ends one group, it does not precede Inbox within one.

**Rejected — leave Inbox where it is.** Cheapest, and it is genuinely arguable: the menu is small,
nobody sums sidebar counts on purpose, and moving a shipped row has a cost. It loses because the
uniform column is the thing that made *four of a kind* readable in the first place, and because
the move is deferred rather than avoided.

**Rejected — Inbox first, alone, above the views.** This is the shape several mature todo apps
use, and the argument for it is triage: Inbox is where you start, so it goes where you look first.
It loses for two reasons. It separates Inbox from the lists it files into — the two halves of one
axis at opposite ends of one menu, which is the same mistake as the uniform column wearing
different clothes. And it ranks the menu around a state that is explicitly temporary: Inbox holds
every open task **only** because nothing can be filed yet, and ADR-009 § Amendment 2 § 2 is
explicit that it narrows by itself. Ordering navigation around a number that is designed to shrink
is how the order becomes wrong quietly.

**The group break is space, not a rule or a header.** Whitespace groups before borders do, and a
header over the filing group would have to be a word true of both Inbox and the user's own lists —
`Lists` inside the Lists menu is self-referential, and `Your lists` is false of Inbox, which
belongs to the app. LM-LIST's existing `Your lists` sub-label stays exactly where it is, labelling
exactly what it always did, and is absent while there are no lists.

**The testid contract does not move, and that is not a convenience — it is the correct split.**
Inbox keeps `menu-collection-row`. LM-COLLECTION means *rows the app always has and computes on
device*; LM-LIST means *rows fetched per user, which can skeleton and can fail*. Inbox is a
built-in by that test whichever group it renders in, and the § ListsMenu states below depend on it
being one: in the **failed** state the personal section is a single error line and **Inbox still
renders its count**, because a menu whose failure strands every open task is exactly the failure
"Navigation must never be the thing that breaks" forbids. Visual grouping and contract family cut
across each other here, deliberately, and no new testid is added.

### The counts nest, and the menu shows them as they are

Inbox's number **contains** Today's and Upcoming's — a task has a date cell and a filing cell at
once, so it is counted on both axes. Measured: 716 + 7 + 0 + 21 = 744 against 737 live rows
(ADR-009 § Amendment 2 § 4). **The column no longer sums to a headcount, and it did before.**

**Shown as they are.** The two alternatives are worse in ways that are not close.

- **Suppressing Inbox's count is not available**, and the reason is already in this section: counts
  are *omitted at zero*. A number withheld for any other reason therefore renders as the claim
  *zero*, and hiding the largest true number in the menu behind a symbol that means "none" is a
  worse falsehood than the one it was avoiding.
- **Distinguishing it** — `716 (7 today)`, or a second count treatment — puts two numbers in one
  cell to explain the first, which is one signal explaining another rather than one signal per
  meaning, and it forks a count contract that is currently one line long.

**Why this does not read as arithmetic that does not add up: nothing in the menu ever claimed to be
a partition.** Each row is a label on a set; no row is labelled *everything*; there is no total.
The group break carries the rest — within the first group the rows are disjoint by construction,
and the second group's rows partition the open tasks exactly, which is the only place in this menu
where addition means anything at all. The overlap lives *between* the groups, which is precisely
where the break is drawn.

**And it is worth naming that this is expected**, for the same reason the bare Upcoming row is:
*the sidebar counts don't add up* is a plausible day-one bug report, and against the live store
it is off by exactly the 7 rows that are dated and unfiled. It is the model, not a defect.
**loading** (built-ins render immediately — they are derivable on device and must never wait on
a network; only the personal section skeletons, two rows) · **failed** (one line in the personal
section, "Couldn't load your lists" + Retry; built-ins and Settings still work) · **empty** (no
personal lists: the `Your lists` sub-label and its rows are absent, `New list` carries the
invitation — the menu is never empty, it always holds the built-ins, New list and Settings, and
**the filing group is never empty either, because Inbox is always in it**).

**Navigation must never be the thing that breaks.** Every failure state above keeps the built-in
collections and the Settings row live, because a menu that fails closed strands the user with no
route to the second path.

## SettingsRow

> **Still v1 appearance.** Behaviour, copy and ids below are current; the *look* is the
> retired language, and it is rewritten when this surface is drawn — Settings is a tranche-2 surface.

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

> **Still v1 appearance.** Behaviour, copy and ids below are current; the *look* is the
> retired language, and it is rewritten when this surface is drawn — the New-list sheet is a tranche-2 surface.

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
`diffFlashFade`, and in v2 the cue is § TaskRow's leading `accent` rule rather than a background
tint — moved from "whenever a turn applies" to "on arrival
from the message that changed it". Same cue, attached to the moment it informs.

States: default · hover (underline to `text.secondary`) · focused (ring) · pressed ·
**inert** (the task was deleted by this or a later turn — no underline, not focusable; a link to
a row that no longer exists is a promise the list cannot keep).

New behaviour, in no F-doc. It is the smallest useful part of `UC-52 AC-52.5 / 52.6`.

### The note that describes the door — replacement copy (added 2026-08-19, T-152)

**The shipped string is false in a state that is about to become ordinary.** Both clients render a note
on any message that carries a door; web ships it as *"tap a task to find it in the list"*
(`src/assistant/web/components/ConversationPane.tsx:131-136`, and the same string in all three
`app-shell*.html` mockups). It was made width-independent on purpose (IA §11) — *"open it in Tasks"* was
true only below the split. **F-001 AC-31 revision 6 and 7 falsify the replacement too:** with a detail in
the centre column the door produces a **detail**, not a row in a list, and revision 7 widens the gate so
that nearly every applied message now carries at least one door. F-001 AC-31 states the constraint and
routes the wording here, which is the convention.

**The constraint, restated so the copy can be checked against it:** the note must be true in **every**
state the door can be activated from. There are five, and the copy below was chosen by testing it against
all five rather than by reading well in one:

| State | What activating the door does | Is the copy true? |
|---|---|---|
| below the split, the collection on screen holds the row | navigates to Tasks, scrolls the row into view, flashes once | yes |
| below the split, it does not | switches to a collection that holds the row **first**, then the same (AC-31 rev 7) | yes |
| at or above the split, the centre holds the list | the centre list only scrolls and flashes — no navigation | yes — and this is the state *"find it in the list"* was written for and *"open it in Tasks"* failed |
| at or above the split, the centre holds a **different** task's detail | the detail changes subject to the named task (AC-31 rev 6, F-005 AC-48) | yes — and this is the state *"find it in the list"* fails, because there is no list on screen at any width while the detail is open (F-005 AC-45) |
| at or above the split, the centre holds **that** task's detail | nothing is replaced; the postcondition is already true (AC-31 rev 6) | yes — the user is already seeing it |

**The copy:** `tap a task to see it`

Rendered after the timestamp with the existing `·` separator, `font.size.meta`, `text.muted` — the
placement and styling are unchanged, only the words. It names the outcome the door actually guarantees
(*that task is now what you are looking at*) and promises no mechanism, which is what makes one string
true at every width and in every one of the five states. *Rejected, with the reason kept so it is not
re-proposed:* **"go to it"** implies travel and is false in the third and fifth states, where nothing
navigates; **"open it"** is false in the third, where the row is scrolled into view rather than opened;
and **naming the mechanism per state** is two strings selected by viewport, which is the discipline
AC-31's own constraint forbids.

**A link's accessible name is `{title}, see this task`** — the visible text is a prefix of the
accessible name, never a replacement (2.5.3), the same rule § NewMessageAffordance states. `{title}` is a
`verbatim` slot (§ Spoken frames' closed vocabulary).

### The note is not per-message any more, and that is the second half of the same call

AC-31 rev 7 notes that with the gate widened the note *"goes from occasional to near-permanent — also
design's call"*. Repeating one instruction under every bubble in the thread is the filler this catalogue
refuses elsewhere (§ NewMessageAffordance's *one control, however many messages arrived*): after the
first reading it removes no information, and the **underline is the persistent cue** — the note is the
one-time teaching.

**So: the note renders on the newest door-carrying message only.** Older bubbles keep their underlines
and drop the note. One note on screen at a time, at the bottom of the thread where the newest message
already sits (§ Message bubbles, *newest at bottom*), which is where the user is looking. It is derivable
from the thread — no new stored fact, nothing to persist, and no "has the user learned this yet" flag.

**And it renders only while at least one door in that message is live.** A message all of whose named
tasks are **inert** (deleted — plain text, not a control, per AC-31) carries no note, because an
instruction to tap something untappable is worse than silence.


## Skeletons

Purpose: loading mirrors the real content's silhouette. **No spinner in a void anywhere in this
app** — the only spinner is the one § Buttons puts inside a button that was pressed.

| ID | Mirrors | Shape |
|---|---|---|
| **SK-ROW** | § TaskRow | checkbox square + two bars (title 62%, meta 24%), five rows under a **heading-shaped bar** — see the note below |
| **SK-BUBBLE** | § Message bubbles | three bubbles, alternating sides, 70% / 45% / 80% width |
| **SK-LISTROW** | LM-LIST | icon square + one bar at 55%, two rows |
| **SK-DETAIL** | the F-005 task detail (IA § 6, S6) | one bar at 70% at title size, then five field-shaped pairs — a short label bar at 30% over a value bar at 55% — and one step-list block of three SK-ROW-shaped bars. Added 2026-08-19, T-152 |

Fill `bg.sunken` on `bg.base`, **`radius.xs`** for a bar and `radius.md` for a block that stands in
for a ground (2026-08-22, T-211 — a skeleton takes the shape of the thing it replaces, and the bubble
skeleton stopped being a box when the bubble did), **and no pulse.** v2's motion budget is spent
entirely on the listening rule; a loading state that breathes is a second thing moving without the
user acting. A skeleton row keeps the real row's silhouette exactly — a bar in the time rail, a
square where the checkbox goes, a bar where the title goes — so the list does not resize when the
read lands.
There is no reduced-motion clause to write, because there is no motion to collapse. Skeletons carry no text and no testid: nothing about them is assertable
except that they are not the empty state.

**A loading surface never renders its empty state.** A returning user who sees "Say it. I'll
write it down." while their conversation is still loading reads it as history lost.

**SK-DETAIL exists because the detail's empty state and its loading state are otherwise identical**
(F-005 AC-45's loading clause, design D8). Under AC-1 every field with no value renders as an **empty,
settable** control, so a detail that has not read the task yet looks exactly like a task with nothing on
it — a user's first look at their own task would be a lie that corrects itself a moment later. The rule
two paragraphs up already forbids that; SK-DETAIL is the shape that obeys it. Like every other skeleton
it carries **no text and no testid**, so it asserts none of the field labels — the same reason SK-ROW's
day header is a bar and not words.

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

Purpose: the failure that must not take the surface. A full-width block at the top of a list on
`bg.base` inside a 1px `bg.rule`, with a `border.mark` `danger` rule down its leading edge, a
`danger` icon, a `text.primary` head and a `text.secondary` sentence,
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

Anatomy — **left-aligned**, on `bg.base`, in the surface's own content column, and left-aligned is
the v2 change: centring an error puts it somewhere the eye has never been on this screen, and the
line under it starts at a different x from every other line the user has read. One line at
`font.size.title` naming what happened in plain words,
one `text.secondary` line naming the next thing to do, one primary **Retry**, and — this is the
part that is not decoration — **the other path stays reachable**: PS-TASKS / PS-TALK remains
visible and enabled in the top bar, and on the Tasks variant `Add task` stays live, because the
local no-AI path works offline (AC-25) and disabling a working control to look consistent is a
lie about what the app can do.

| ID | Surface | Line 1 | Line 2 |
|---|---|---|---|
| **SE-SESSION** | Talk | Couldn't load your conversation | Your tasks are unaffected. Try again, or carry on by hand. |
| **SE-TASKS** | Tasks | Couldn't load your tasks | Nothing is saved on this device yet. You can still add one by hand. |
| **SE-DETAIL** | Task detail (S6) | Couldn't load this task | Your other tasks are unaffected. Try again, or go back to the list. |

**SE-DETAIL added 2026-08-19 (T-152)**, for `F-005 AC-45` and IA §6's opening rule that a new surface
inherits no failure design. It takes the detail's column rather than the frame, so the conversation stays
rendered beside it above the split. The part that is not decoration applies unchanged: **the way back
stays live** — the close affordance is *neither hidden nor disabled by the failure being recovered from*
(AC-45, and `F-001 AC-24` revision 6, which exists for exactly this state) — and it is the only control
besides Retry.

It looks **calm**: body-size supporting text, one accent, one button. An error state that shouts
makes users abandon.

## Empty states — Tasks

Three, because they are three different facts and one message for all of them tells at least two
users something untrue.

Anatomy: **left-aligned, in the content column, at the same left edge as the head above it** —
v2's change, for § SurfaceError's reason. Head at `font.size.title` `font.weight.semibold`, one
`text.secondary` sentence at `font.size.body` capped at 44 characters of measure, then at most one
button. **No illustration and no icon**: an empty list is not an event.

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

## SearchField — inline search on the Tasks surface (F-009 AC-1, AC-2, AC-3, AC-14)

Purpose: filter the current collection's tasks by title. An inline text field that **replaces** the
surface title in the Tasks header — not a separate layer, not a modal, not a new surface. The field
expands from `shell-search-button`, takes focus, and narrows the list with every keystroke
(case-insensitive substring on `task.title` only — notes, steps and other fields are not searched).

**Anatomy:** the surface title hides; in its place, a standard field (`field.height` 44, `radius.sm`,
1px `bg.rule` border, `font.size.body`, `field.padding_x` inset) spans the available header width.
A close control (Lucide `x` at `icon.size.md`, `text.secondary`) sits at the field's trailing edge.
Placeholder: *"Search tasks"* in `text.muted`. **The close control and Escape both exit search** — the
field clears, the surface title returns, the full list is restored. T-227 already drew the field's CSS
in `app-shell.html` (`.search-field`, `data-search="open"`) — this section publishes it.

**Keyboard (AC-14):** `/` or the platform find shortcut (`Cmd+F` / `Ctrl+F`) focuses the field from
anywhere on the Tasks surface. `Escape` closes search. The field is a standard `<input>` in the tab
order; no custom keyboard handling beyond the shortcut.

**Completed tasks in search results (AC-2 interaction).** When `hide_completed` is true, completed
tasks are excluded from search results. When false, they appear. The mockup hides done rows
unconditionally (a demonstration shortcut), but **the implementer must follow the
`hide_completed` preference** — the mockup is not the rule for this behaviour, this sentence is.

States: **closed** (default — field hidden, surface title visible) · **open-empty** (field visible,
focused, no query, full list) · **open-filtering** (query typed, list narrowing live) ·
**open-no-results** (query typed, zero matches → § Empty states — Search below) · **focused**
(2px `focusRing` inset, border turns `accent`).

| Testid | Control |
|---|---|
| `tasks-search-input` | the search text field |
| `tasks-search-close` | the close control (exits search, restores list) |

## Empty states — Search (F-009 AC-3)

A variation of § Empty states — Tasks, specific to search. Same anatomy: **left-aligned, in the
content column**, `font.size.title` `font.weight.semibold` head, one `text.secondary` sentence at
`font.size.body`, capped at 44 characters of measure. **No illustration, no icon.**

| ID | When | Head | Action |
|---|---|---|---|
| **ET-SEARCH** | search query matches zero tasks in the current collection | No tasks matching "{query}" | **none** — the search field's close control is on screen; no CTA is needed |

`{query}` is a `verbatim` slot — the user's typed string, never re-worded, never truncated. The
empty state appears in the list area below the header while the search field remains open above it.

| Testid | Control |
|---|---|
| `tasks-no-results` | the no-results empty state container |

## OverflowMenu — the three-kind floating layer (F-009 AC-4, AC-5, AC-7, AC-8, AC-9, AC-14)

Purpose: a single floating menu holding **three different kinds of item at once** — a single-choice
group, a persisting toggle, and a plain action. Opens from `shell-overflow-button`, **anchored to
the trigger**: right edges aligned, `space.1` (4px) gap below. The button and menu share a
`position:relative` wrapper (`.overflow-anchor`) so the menu positions against the button, not
against the pane — T-247 fix for the measured 68px gap and 82px overhang the owner flagged.
Closes on selection, on tap outside, or on `Escape`.

**Shape:** `radius.lg` (16), `shadow.overlay`, `bg.base` ground. Menu width: `min(280px, 100vw − 2×gutter)`.
Scrim: none — the menu closes on outside tap, but no dimming; this is a lightweight popover, not a
dialog.

**Three item kinds, visually distinguished.** A menu that renders all three identically is the failure
mode — the user must know which items persist, which are exclusive, and which just fire.

| Kind | Items | Trailing control | Separation | Reason |
|---|---|---|---|---|
| **Single-choice group** | *Due date* · *Priority* · *Manual* | Lucide `check` at `icon.size.sm` in `accent` on the **active** option; others show no icon | Preceded by a section label *"Sort by"* in `font.size.meta` `text.muted` uppercase, same treatment as TaskList day headers | A checkmark is the universal indicator of "one of these is active" (iOS, Android, web select menus all use it). The `accent` colour is consistent with focus and primary action |
| **Persisting toggle** | *Hide completed* / *Show completed* | A switch control — the same M3-style pill track as § SettingsRow: on = `accent` fill, knob `text.onAccent`; off = `bg.hairline` track, knob `text.secondary` | Separated from the group above by `space.4` (16px) — space, not a rule (`border.separation_order`) | A switch signals *this persists and has two stable states*, which is exactly what `hide_completed` does. It is visually distinct from a checkmark, so the user cannot confuse "selecting a sort" with "toggling a filter" |
| **Plain action** | *Select* | nothing — bare text | Separated from the toggle above by `space.4` (16px) | No trailing control means *this does something and closes the menu*. The absence is the signal |

**Each menu item:** `control.height.md` (44), `padding: space.2 space.4` (8 16), `font.size.body`,
`text.primary`. Hover/pressed ground: `bg.sunken` at `radius.sm` (8). Focus: 2px `focusRing` inset.

**Manual sort disabled state (AC-5).** In Today, Upcoming, and Done, the *Manual* option is
**disabled**: 40% opacity **and** no border/control — `DESIGN.md ## Colour rules 3` requires both.
The option stays visible so the user knows the feature exists; it just cannot be activated. The
disabled row does not respond to hover or tap.

**Label flipping (AC-8).** The toggle row label reads *"Hide completed"* when `hide_completed` is
false, and *"Show completed"* when true. The switch position and the label agree — they are one
signal, not two (`DESIGN.md ## Colour rules 1`).

**Keyboard (AC-14).** Arrow keys navigate items. `Enter` or `Space` activates the focused item.
`Escape` closes. The menu traps focus while open — standard Radix UI `DropdownMenu` / `Popover`
behaviour.

States: **closed** (default) · **open** (the layer is visible, first item focused) · **open with
manual-disabled** (in Today/Upcoming/Done — the Manual option is visually disabled).

| Testid | Control |
|---|---|
| `overflow-menu` | the floating menu layer |
| `overflow-sort-due` | sort option: Due date |
| `overflow-sort-priority` | sort option: Priority |
| `overflow-sort-manual` | sort option: Manual (disabled in Today/Upcoming/Done) |
| `overflow-hide-completed` | toggle: Hide completed / Show completed |
| `overflow-select` | action: enter multi-select mode |

## SelectionMode on TaskRow (F-009 AC-9, AC-10)

Purpose: a mode overlay on the existing § TaskRow. When active, **every row shows a selection
checkbox** and a row tap toggles selection instead of opening the task.

**Entering:** the user taps *Select* in the overflow menu. **Exiting:** the *Done* button on the
§ BulkActionToolbar, or deselecting all tasks.

**Selection checkbox:** replaces the completion checkbox in the row's leading position. Same box
size (20px, `radius.sm`), same hit area (`control.minTarget`). Unchecked: 1px `bg.rule` border,
`bg.base` fill. Checked: `accent` fill, white `check` glyph. **The checkbox is the selection
control, not the completion control** — tapping it selects the row, it does not complete the task.
The existing `assistant-task-checkbox` is hidden during selection mode.

**Selected row ground:** `accentTint` at `radius.md` — same pattern as the hover ground
(`bg.sunken` at `radius.md`). **No padding override on the selected state.** The row's own
`space.2` (8px) horizontal padding provides the inset; the ground fills the row's padding box,
reaching the content-column edge (aligned with headings above). This means `cbLeft` and
`titleLeft` are identical for selected, unselected and done rows — selecting a row never shifts
its content. Consistent with `DESIGN.md ## Colour rules 5`: *"the row's ground means
selection."* The selection is carried by **both** the checkbox state and the row ground — two
signals, so it is not colour-only (`## Colour rules 3`). (T-248: the T-247 approach added
padding to `.selected` only, which shifted selected rows 4px right — the ground now extends
outward via the shared row padding instead.)

**Row trailing:** the delete control is hidden in selection mode. The row has no trailing
affordance — the bulk actions are in the toolbar, not per-row.

**Count display (AC-9):** a selected-count chip in the toolbar, not in the row. See
§ BulkActionToolbar.

States: **unselected** (checkbox unchecked, `bg.base` ground) · **selected** (checkbox checked,
`accentTint` ground) · **no-selection** (entering mode — all rows unselected, toolbar actions
disabled).

| Testid | Control |
|---|---|
| `tasks-select-checkbox` | selection checkbox exemplar (one per row, replaces completion checkbox in select mode) |

## BulkActionToolbar (F-009 AC-9, AC-10, AC-11, AC-13)

Purpose: a bottom-pinned toolbar that appears in selection mode. Shows the selected count and the
three bulk actions. Exits selection mode via the *Done* button.

**Shape:** pinned to the viewport bottom, full width, `bg.base` ground, `space.3` padding,
`bg.hairline` top border (decorative separation, not structural — `border.when_a_line_earns_it`
does not reach it, but the toolbar boundary needs a visual edge above scrolling content).

**Layout, left to right:** selected count → spacer → bulk action buttons → *Done* button.

**Selected count:** *"{n} selected"* in `font.size.body` `font.weight.semibold`, e.g. *"3 selected"*.
The count is always visible while the toolbar is on screen. Zero count: *"0 selected"* — drawn
explicitly, never absent.

**Bulk action buttons:** three, in `secondary` variant at `control.height.md`:
- *Complete* (Lucide `check` icon + label)
- *Delete* (Lucide `trash-2` icon + label)
- *Move to list* (Lucide `folder` icon + label)

**Disabled state (AC-10).** When zero tasks are selected, all three action buttons are disabled:
**40% opacity and no border** — both signals, per `DESIGN.md ## Colour rules 3`. A disabled button
does not respond to hover, tap, or keyboard activation. The *Done* button is **never** disabled.

**Done button:** `ghost` variant at `control.height.md`, label *"Done"*, right-aligned. Always
enabled — exits selection mode regardless of selection count.

States: **no-selection** (toolbar visible, all actions disabled, count reads "0 selected") ·
**some-selected** (actions enabled, count reads "{n} selected") · **action-in-progress** (an
action is executing — the triggering button shows the § Buttons loading treatment, width locked;
other actions disabled).

| Testid | Control |
|---|---|
| `tasks-bulk-toolbar` | the toolbar container |
| `tasks-select-count` | the selected-count display |
| `tasks-bulk-complete` | bulk complete button |
| `tasks-bulk-delete` | bulk delete button |
| `tasks-bulk-move` | bulk move-to-list button |
| `tasks-select-done` | Done button (exits select mode) |

## ConfirmDialog — bulk delete confirmation (F-009 AC-12)

Purpose: a blocking dialog that gates bulk delete of more than one task. Extends F-001 AC-9's
confirmation principle to the hand path. **A single selected task deletes immediately with undo
per F-005 AC-42** — no dialog.

**Shape:** centred dialog, `radius.lg` (16), `shadow.overlay`, `bg.base` ground, `bg.scrim`
backdrop. Width: `min(400px, 100vw − 2×gutter)`. **This is a dialog, not a conversation
message** (AC-12 is explicit).

**Platform divergence (§ Platform in DESIGN.md):**
- **Web:** centred dialog, two buttons.
- **iOS:** action sheet with destructive row in `danger`, `Cancel` separated.
- **Android:** M3 dialog, text buttons, destructive on the right.

**Web dialog anatomy:**
- Title: *"Delete {n} tasks?"* at `font.size.lead` `font.weight.semibold`.
- Body: the task titles as a comma-separated list in `text.secondary` at `font.size.body`, e.g.
  *"Buy milk, Order the cake, Collect the parcel."* — real titles, never "these tasks" or
  "the selected items".
- Buttons: *"Delete {n} tasks"* (`danger` variant) and *"Cancel"* (`secondary` variant). The
  destructive button names the count and the word *delete* — it never says "Confirm" or "OK".

**Focus:** the dialog traps focus. **`Cancel` receives initial focus** — this is the safe default
for a destructive action (the user must move to the destructive button deliberately). Not stated
in AC-12 but recorded here as the design's decision so the implementer does not guess. `Escape`
cancels.

**Single-task bypass (AC-12).** When exactly one task is selected, tapping *Delete* in the toolbar
deletes immediately with undo (per F-005 AC-42) — **no dialog appears**. The dialog gates only
`n > 1`. This state is not drawn as a separate mockup because the visible result is identical to
a single task delete from the row: the row disappears and the undo bar appears. The difference is
in the trigger (toolbar, not row control) and the bypass decision, both recorded here.

States: **closed** (default — no dialog) · **open** (dialog visible, scrim active, `Cancel`
focused) · **deleting** (*"Delete {n} tasks"* shows loading treatment, width locked; `Cancel`
disabled).

**Deleted tasks enter F-006's trash.** This is stated because it changes the confirmation's
severity: the action is reversible within the trash window, and the dialog is about preventing
mistakes, not about permanence.

| Testid | Control |
|---|---|
| `tasks-confirm-dialog` | the confirmation dialog |
| `tasks-confirm-delete` | the destructive confirm button |
| `tasks-confirm-cancel` | the cancel button |

## Testid catalogue — app shell

Controls that already exist keep their ids and simply render on a different surface:
`assistant-task-row`, `assistant-task-checkbox`,
`assistant-undo-button`, `assistant-retry-button`, `assistant-permission-cta`. **They are not
renamed** — § Touch publishes width floors against them which `src/assistant/mobile/model/touch.ts`
adopts and a test asserts row by row.

**`assistant-add-task-button` is retired from the shell by T-227** — the header's Add task button was
removed when Search and overflow replaced Talk and Add task in the Tasks header. Adding a task is now
the inline add row (`tasks-inline-add`), which is a different control. The id stays in `A11Y_IDS`
(the conversation catalogue) because it still exists on the conversation surface; what changes is
that it is no longer carried over to the shell.

Genuinely new controls, and only those, take new ids:

| Testid | Control |
|---|---|
| `shell-tasks-button` | PS-TASKS (below split only) |
| `shell-lists-menu-button` | the hamburger on Tasks |
| `shell-search-button` | Search icon button in the Tasks header (drawn T-227, published T-244) |
| `shell-overflow-button` | Overflow (⋯) icon button in the Tasks header (drawn T-227, published T-244) |
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
| `tasks-empty-add-button` | ET-FIRST / ET-COLLECTION CTA (the conversation's `assistant-add-task-button` was retired from the shell header by T-227) |
| `tasks-rename-input` | inline rename, which ships on web today with no testid |
| `tasks-delete-button` | the row's delete control, which ships on web today with no testid |
| `tasks-save-notice` | SN-ONE / SN-MANY — the notice itself (§ SaveNotice, added T-135) |
| `tasks-save-notice-dismiss` | SaveNotice's trailing dismiss control (added T-135) |
| `shell-carried-notices` | § CarriedNotice — the region itself; carries the region's accessible name and is what QA asserts the family's *presence on every surface* against (added T-152) |
| `shell-carried-notice` | one notice row exemplar — carries the message and the user's value (added T-152) |
| `shell-carried-notice-retry` | CN-FAILED / CN-OFFLINE Retry (added T-152) |
| `shell-carried-notice-undo` | CN-UNDO's `Put back` control — F-005 AC-43's offer, and the id `## Impact` §8(d) records as owed for an element that did not exist (added T-152) |
| `shell-carried-notice-dismiss` | any row's trailing dismiss control (added T-152) |
| `tasks-search-input` | § SearchField — the inline search text field (added T-244) |
| `tasks-search-close` | § SearchField — close control, exits search (added T-244) |
| `tasks-no-results` | § Empty states — Search — the no-results container (added T-244) |
| `overflow-menu` | § OverflowMenu — the floating menu layer (added T-244) |
| `overflow-sort-due` | § OverflowMenu — sort option: Due date (added T-244) |
| `overflow-sort-priority` | § OverflowMenu — sort option: Priority (added T-244) |
| `overflow-sort-manual` | § OverflowMenu — sort option: Manual (added T-244) |
| `overflow-hide-completed` | § OverflowMenu — toggle: Hide completed / Show completed (added T-244) |
| `overflow-select` | § OverflowMenu — action: enter multi-select mode (added T-244) |
| `tasks-select-checkbox` | § SelectionMode — selection checkbox exemplar (added T-244) |
| `tasks-bulk-toolbar` | § BulkActionToolbar — the toolbar container (added T-244) |
| `tasks-select-count` | § BulkActionToolbar — selected-count display (added T-244) |
| `tasks-bulk-complete` | § BulkActionToolbar — bulk complete button (added T-244) |
| `tasks-bulk-delete` | § BulkActionToolbar — bulk delete button (added T-244) |
| `tasks-bulk-move` | § BulkActionToolbar — bulk move-to-list button (added T-244) |
| `tasks-select-done` | § BulkActionToolbar — Done button, exits select mode (added T-244) |
| `tasks-confirm-dialog` | § ConfirmDialog — the confirmation dialog (added T-244) |
| `tasks-confirm-delete` | § ConfirmDialog — destructive confirm button (added T-244) |
| `tasks-confirm-cancel` | § ConfirmDialog — cancel button (added T-244) |
| `tasks-drag-handle` | § TaskRow — drag handle for manual reorder, visible only in manual sort (added T-247) |

**`shell-talk-button` is retired by T-227** — the PathSwitch Talk button was removed when the Talk
path changed from a bottom-bar tab to the voice FAB (below split) and the permanent panel (at
split and above). The Talk surface is no longer reached by a path switch; the FAB is
`assistant-voice-fab` and has its own identity, and the panel is always visible. The id stays in
`SHELL_A11Y_IDS` in `src/` until the implementation pass reconciles it; this catalogue no longer
publishes it.

**`assistant-drawer-button` is retired by this IA** — the hamburger stops toggling a pane and
becomes navigation to a different surface, which is a different control wearing the same glyph.
Its retirement lands with the spec pass, not before: the three existing F-001 mockups and the
tests that parse them are untouched by this section.

No content-width floor is published for any control above. § Touch's floors are measured from a
shipped control; none of these has shipped, and publishing a floor measured only in Chromium
would put a number into a table whose whole value is that its numbers are checkable.

**The counts (updated T-247 — drag-handle testid).** This table now has
**50** new-control rows (was 49; +1 for `tasks-drag-handle`). The carried-over list is still **6**.
**`src/assistant/mobile/model/a11y.ts SHELL_A11Y_IDS`** holds 29 and
needs updating: add `shell-search-button`, `shell-overflow-button`, `tasks-drag-handle` and the
20 F-009 ids; retire `shell-talk-button`. This is L-008's mechanism working in the direction drift actually travels — the
suite fails because the **upstream** artifact moved — and the fix belongs to whoever owns `src/`, not
to this file. All new ids are `(web, mobile)` like the components they belong to, so the
one-catalogue-three-spellings invariant holds.

**One asymmetry is deliberate and is recorded so it is not read as an omission.** § TaskRow's three mark
ids (`tasks-row-priority-mark`, `tasks-row-repeat-mark`, `tasks-row-steps-mark`) are **not** in this
table and are **web only**: TR-STEPS is `(web)` by AC-17, and the mobile spellings of the other two are
owed to F-003's closed catalogue rather than invented here (§ TaskRow, last paragraph). So at
`phase: screens` the **web** shell mockup gains eight ids and the two mobile shell mockups gain five. A
check that asserts the three mockups carry identical catalogues will fail on that difference; the
difference is the recorded debt, not a defect in the drawing.

**And one dependency the drawing pass cannot avoid.** § CarriedNotice renders on **every** surface,
including Talk and Settings, which only `app-shell*.html` draw. So F-005's `phase: screens` dispatch must
extend the three **shell** mockups with the CN-* states as well as drawing the detail; a family drawn only
in a detail mockup would be untestable in the two states — on Talk, on Settings — that are the whole
reason AC-47 rejected the Tasks banner stack.

---

## AppFrame — the one layout branch, and where it lands

**Added 2026-08-17 (T-105), additive**, for
`docs/reports/owner-decision-2026-08-17-desktop-list-is-primary.md`. Nothing above this line moved,
was renamed or was reordered. Two cells changed content and are called out at the foot.

Mockups: `app-shell.html` (web, both sides of the branch) · `app-shell-ios.html` ·
`app-shell-android.html` (T-104 — phones, always below the branch).

**There are now TWO branches, and the second is new in v2 (2026-08-21, T-204).**

| Width | Frame | PathSwitch | Settings |
|---|---|---|---|
| **below `breakpoints.split`** | one surface on screen: Talk **or** Tasks | present; one tap between them | replaces the surface |
| **`split` up to `wide`** | Tasks in the centre, Talk in a `measure.panel_max` right panel, both permanently on screen | **absent** | replaces the **centre**, never the panel |
| **`breakpoints.wide` and above** | a permanent **Lists rail** (`measure.rail`) joins on the left; Tasks takes what is left; Talk keeps its panel | **absent** | replaces the **centre**, never the rail and never the panel |

### Above the desktop width the app adds a column, never a gutter

`tokens.json layout.wide_rule`. The v1 frame stopped branching at `split`, and the consequence was
measured on 2026-08-21: `.tasks-col` was `max-width: 720px` with **no `margin: 0 auto`**, so at
1440 it left **300px** dead on one side and 0 on the other, and at 1920 it left **780px** — 52% of
the pane. Every check passed, because `design-check` tested horizontal overflow and nothing else,
and because `breakpoints` declared four widths and stopped at `desktop`. **The defect was in the
mockup too**, at identical measurements, so this was never implementation drift.

**One centring, and it is at the content column** (`layout.content_column_rule`). Each frame column
— Lists rail, Tasks pane, Talk panel — holds exactly **one** content column,
`min(pane − 2×gutter, its measure token)`, **centred in its pane**. Everything inside a content
column is left-aligned and nothing inside it centres again. Leftover width is therefore always
symmetric and always at one known level.

**Why the rail arrives at `wide` (1536) and not at `laptop` (1440).** 1536 is the narrowest frame
where `rail 240 + list_max 820 + 2×gutter + panel_max 420` fits. Bring the rail in at 1440 and a
user maximising their window watches the task list get *narrower* than it was one breakpoint
earlier — a regression wearing a feature's clothes.

**The rail is a frame column, not the S3 Lists menu.** It shows the same rows in the same order
(§ Two axes: `Today · Upcoming · Done`, a group break, then `Inbox` and the personal lists, with
`New list` and `Settings` at the foot) and it is what makes the hamburger absent at this width —
a control that opens what is already on screen is a dead control, the same argument § PathSwitch
makes one tier down. **Its rows carry no testid yet**, and that is a recorded debt rather than an
omission: the ids would have to be either `menu-collection-row` reused for a different control, or
new ones, and the second is a decision that belongs with the tranche-2 redraw of § ListsMenu.

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
**Consequence for the id catalogue:** `shell-tasks-button` is a **below-split-only control**. A
desktop selector for it will not resolve, and should not. (`shell-talk-button` was retired by T-227 —
the Talk path is now the voice FAB below split and the permanent panel at split and above; see
§ Testid catalogue.)

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

**Added 2026-08-18 (T-114), additive**, for `docs/reports/owner-decision-2026-08-18-landing-and-collections.md §1`
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
| `undated` | open tasks with **no date at all** | derivable from `due_at` + `status`, **no new field and no collection** — the `undated` cell of ADR-009 § Amendment 2's date axis, which has no surface of its own. The predicate belongs beside `dueToday` in `src/assistant/_shared/model/tasks.ts`, not in the summary composer (L-004). **Added 2026-08-18 (T-138)** — it is the fact `inbox_count` used to name |
| `inbox_count` | open tasks **filed into no personal list** — the Inbox **container** | `collectionCount(tasks, 'inbox', now)` — **same call, rebound 2026-08-18 (T-138).** The call did not move; the predicate underneath it did (ADR-009 § Amendment 2 § 2). This is the number § ListsMenu's Inbox row shows |
| `open_all` | every unfinished task | `open_today + upcoming + undated` — the three cells of the **date** axis, which is the axis that partitions. **Not the Inbox count** — see below, and INV-INBOX-FILING |
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

**They are exactly equal again today, and that is INV-INBOX-FILING's subject — never a reason to
re-merge them** (added 2026-08-18, T-138). Inbox now means *filed nowhere*; nothing can be filed,
so every open task is in Inbox, so `open_all` and `inbox_count` are the same number — 716 = 716
globally and in every one of the 193 accounts holding live tasks (ADR-009 § Amendment 2 § 4). **The
equality is a reading of the store, not a definition, and neither number may be sourced from the
other** (`docs/specs/assistant/data-model.md § INV-INBOX-FILING`). This paragraph is the physical place
a re-merge would land, which is why the note sits here and not only in the ADR: the split above was
made this morning *because* the two had stopped being equal, and anyone who notices they are equal
again and merges them reintroduces exactly the sentence the split was made to prevent — a user with
a full week ahead told **"All done — your list is clear."** The guard that works without anyone
remembering the rule is that the two expressions are not written the same: `open_all` is a sum over
the date axis, `inbox_count` is a single call on the filing axis. Keep them that way.

**Six facts, three calls** (was *four facts* until T-138; the count came out of the heading two
passes ago for this reason and is written here only because the shape matters). `open_today`,
`upcoming` and `inbox_count` are `collectionCount` on three collections — so the summary, the
PathSwitch badge and the Lists menu counts cannot disagree, because there is no second definition
anywhere for them to disagree with, and `inbox_count` is now literally the number § ListsMenu draws
on its Inbox row. `open_all` is a **sum**, over the date axis only. `overdue` and `undated` are the
two predicates with **no collection and no surface of their own**: ADR-009 § Amendment folded
overdue into Today, and § Amendment 2 leaves `undated` a cell of the date axis that nothing opens.
Both are named in sentences and nowhere else, which is worth holding on to when reading the ranking
argument below — and `undated` is the reason `open_all` can still be a sum at all now that
`inbox_count` measures the other axis.

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
| **LSM-CLEAR-TODAY** | `overdue = 0`, `open_today = 0`, `inbox_count ≥ 1` | `count` (= **`inbox_count`**, re-bound 2026-08-18 T-128 — it was `open_all`; **its meaning re-bound again T-138**, from the undated cell to the Inbox container) | 1 → `Nothing is due today. One task is waiting in Inbox.` · ≥2 → `Nothing is due today. {count} tasks are waiting in Inbox.` |
| **LSM-CLEAR** | `open_all = 0`, and the account has conversation history | none | `All done — your list is clear.` |
| **LSM-PROGRESS** | `done_today ≥ 1`, `overdue = 0`, `open_today ≥ 1` | `count`, `count_secondary`, `title_list` | 1 → `You've finished one today. {count_secondary} left: {title_list}.` · ≥2 → `You've finished {count} today. {count_secondary} left: {title_list}.` — **not selectable today; see below** |
| **LSM-CLEAR-AHEAD** | `overdue = 0`, `open_today = 0`, `inbox_count = 0`, `upcoming ≥ 1` — **added 2026-08-18 (T-128); `upcoming ≥ 1` promoted from an implication to a condition T-138** | `count` (= `upcoming`) | 1 → `Nothing is due today. One task is coming up.` · ≥2 → `Nothing is due today. {count} tasks are coming up.` — **not selectable until `lists` ships; see below** |

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

**LSM-CLEAR-TODAY keeps naming Inbox and is now selected by Inbox, which is what makes the
sentence survive lists** (decided 2026-08-18, T-138). Rebinding `inbox_count` to the container
forces a choice this frame had never had to make, because until today the two candidate numbers
were the same one:

- **Chosen — count `inbox_count`, select on `inbox_count ≥ 1`.** *The named set is always the
  counted set* is this section's own rule, and a frame selected on a variable other than the one it
  names breaks it one step earlier than the case that rule was written for. It is true in both
  worlds: the sentence claims a place, the number counts that place, and post-lists both narrow
  together. It also keeps the summary's number **identical to the number § ListsMenu draws on its
  Inbox row** — a user told *"7 tasks are waiting in Inbox"* who opens Inbox and finds 7 rows.
- **Rejected — select on `undated ≥ 1` and keep counting `inbox_count`.** Sound today and only
  today: post-lists an account can have undated tasks all filed into lists, and the frame would
  fire and render *"0 tasks are waiting in Inbox."* — a numeral zero that is also false about the
  place. Buying reachability for LSM-CLEAR-AHEAD with a sentence that will lie later is the trade
  this file refuses everywhere else.
- **Rejected — re-word the sentence to the date axis: *"{count} tasks have no date."*** Total in
  both worlds, and it fails on the door. `undated` is a cell with **no surface** — no menu row,
  nothing to open — so post-lists the sentence would name a set the user cannot go and look at,
  while its members sit scattered across lists reachable only through those lists (ADR-009
  § Amendment 2 § 6). It would also put a second number named *Inbox-ish* on Talk while the menu
  shows a different one, which is the two-surfaces-two-numbers failure the fact table exists to
  prevent.

**So LSM-CLEAR-AHEAD is dormant, not dead — and the distinction from rule 4 is the whole point.**
`inbox_count = 0` means *every open task is filed*, which today means *there are no open tasks*,
which rows 1–2 have already caught. So the frame selects nothing right now. That is **not** row
4's situation: row 4's condition is a contradiction in the model itself (overdue lives inside
Today, permanently), so it was struck through. This one is unsatisfiable only while `isFiled` is
constant `false`, and it **wakes the first time a task is filed** — the same category as
LSM-PROGRESS, which is written, drawn and blocked on `completed_at`. The frame therefore keeps its
ID, its slots, its text and its mockup state, and is labelled *blocked on `lists`* rather than
struck. Nothing observable is lost today: `upcoming` has no member anywhere in the live store, so
the state that would distinguish the two bindings is unreachable against real data either way.

**What this owes when `lists` ships, written down now because the last two versions of this
dependency were both found afterwards.** Rule 8 will need a third branch for the one state that
falls out of it: `inbox_count = 0`, `upcoming = 0`, `open_all ≥ 1` — everything the account has is
undated *and* filed. It is unreachable today (nothing can be filed), and it is not designed here,
because the honest frame for it names the filing axis and there is no menu, no list and no row to
name yet. Until then the table is total by the proof below; from then it is not, and this
paragraph is where the person who ships `lists` finds that out.

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
| 8 | `open_today = 0` (so `upcoming + undated ≥ 1`) | **LSM-CLEAR-TODAY** when `inbox_count ≥ 1`; **LSM-CLEAR-AHEAD** when `inbox_count = 0` — the second branch selects nothing until `lists` ships |

**The rule is total, and that is the property to test. Re-proved 2026-08-18 (T-128) against the
four buckets — and the re-proof deleted a row rather than adding one.** After rows 1–2 remove
`open_all = 0`, every state with `overdue ≥ 1` is caught by row 3 alone, because overdue now lives
inside Today and `overdue ≥ 1` implies `open_today ≥ 1`; row 4's condition is the complement of an
implication that always holds, so it catches nothing. When `overdue = 0`, `open_today ≥ 2 | = 1 |
= 0` covers the remainder (rows 6–8). Every state still has exactly one frame — which is what
F-002 AC-22's "an unenumerated combination has no frame and therefore fails" demands, met by
enumerating rather than by failing. **Row 4 is vacuous, not missing**, and that is the difference
this re-proof was for.

**Re-proved a second time, 2026-08-18 (T-138), against the two axes — and this time the table
neither grew nor lost a row.** Only two rows touch a fact this amendment moved. Row 8's parenthesis
is now `upcoming + undated ≥ 1`, because `open_all` is the sum of the **date** axis and
`inbox_count` is no longer one of its terms; the remainder after `open_today = 0` is therefore the
other two date cells, and the parenthesis states what it always meant. Row 8's *branch* still
splits `inbox_count` in two directions and so is still total by inspection — every state reaching
row 8 has either something in Inbox or nothing in it. Rows 1–7 do not mention `inbox_count` at all
and are untouched: `open_all`, `overdue`, `open_today` and `done_today` are all date-axis or status
facts, and this amendment moved neither axis. **The one thing that changed is which branch of row 8
is reachable:** `inbox_count = 0` now implies `open_all = 0` while nothing can be filed, so rows
1–2 always fire first and LSM-CLEAR-AHEAD is dormant. Dormant is not vacuous — the branch is
correct and its state is real, it is merely unreachable until `isFiled` can answer `true`. The
table is total today; the state that will break that totality is named in the block above, not
discovered later.

Two rows now fan out to two frames each, and each fan-out splits **one variable in two
directions**, so it is total by inspection: row 3 on `count_secondary ≥ 1 | = 0`, row 8 on
`inbox_count ≥ 1 | = 0`. Neither introduces a state; each names which frame an already-owned state
takes. The requirement — *a future fact must re-prove this table is total, not merely add a row to
it* — is what forced both splits into existing rows and forced row 4 to be struck rather than
quietly deleted. `upcoming` was added as a fact and the table did not grow; `undated` was added as
a fact and it did not grow either.

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
`overdue` is one of the two facts in the table with no collection of its own: fold it into a count
in the summary and **Talk** says nothing about missed work at all. Row 3 is the only frame that
names those tasks, so naming is now the whole argument for its rank. It is a weaker argument than
the one it replaces and it is sufficient: the ranking used to prevent a lie, and now it prevents a
silence.

*Narrowed 2026-08-18 (T-138): this paragraph used to say the app would have **no surface anywhere**
naming a missed task. That was already loose once § TaskList added the `Overdue` day heading, and
it is now doubly false — the heading renders on Today **and** on Inbox (§ TaskList). The claim is
true of Talk, which is the surface this rule governs, and it is left at that altitude. The rank is
unchanged.*

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
| Tasks exist, **all of them dated in the future** | **LSM-CLEAR-TODAY** — `Nothing is due today. {count} tasks are waiting in Inbox.` **(changed 2026-08-18, T-138 — it was LSM-CLEAR-AHEAD)** | Nothing can be filed, so those future-dated tasks **are** in Inbox and the sentence is true of them. Still not LSM-CLEAR: `open_all` counts Upcoming, so nobody is congratulated for a week of work. The cost is that the sentence does not say the tasks are dated — the same under-informing-by-one-number trade as the row above. LSM-CLEAR-AHEAD is the better sentence here and cannot be reached until a task can be filed out of Inbox |
| Tasks exist, all dated in the future, **and all filed into personal lists** | **LSM-CLEAR-AHEAD** — `Nothing is due today. {count} tasks are coming up.` | The state the frame was written for, and it needs `lists`. Listed as an unreachable row rather than omitted, because the frame is drawn in three mockups and a reader is owed the state that selects it |
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

**Added 2026-08-18 (T-128), additive**, for `docs/reports/owner-decision-2026-08-18-four-buckets.md`
§ Confirmed (second pass) and `docs/specs/_shared/adr/ADR-009-today-is-a-date.md` § Amendment. **No row
ID above was moved, renamed or reordered.** One frame ID, two facts and one day-group heading were
added, one selection rule row died, and eleven cells changed content — all listed at the foot of
this section. The three surfaces the amendment disturbed have one home each: § LandingSummary for
the frames and facts, § ListsMenu for the fourth row, § TaskList for the day groups.

The owner considered moving overdue into Inbox, which would have dissolved every problem this
section addresses, and **confirmed keeping it in Today**. So none of what follows is an open
question about the model; it is the work the confirmed model owes.

### The cell this pass refuses to fill

> **RESOLVED 2026-08-18 by the owner (T-135).** The recommendation below — *none of the three,
> ask* — was **not** taken. The owner chose **option 2**: *"Cứ lưu không ngày, hiện thông báo 'Đã
> lưu vào Inbox'"* — save it dateless and say where it went. That satisfies the condition this
> section attached to option 2 (**chosen rather than done silently**), and the notice it requires is
> specified in **§ SaveNotice**. Everything below stands as the record of what was weighed; read it
> as history, not as advice, and do not re-argue the choice from it.

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

---

## SaveNotice — the receipt for a task that did not stay (T-135)

**Added 2026-08-18 (T-135), additive**, for the owner's decision of 2026-08-18: *"Cứ lưu không
ngày, hiện thông báo 'Đã lưu vào Inbox'"* — save it dateless, and say where it went. That fills
§ Four buckets' *The cell this pass refuses to fill* with its **option 2, chosen rather than done
silently**, which is the condition that section put on it. **Nothing above this line was moved,
renamed or reordered.** Two new testids, three new mockup states, **zero new tokens** — so
§ Contrast is unchanged and complete for this component, which reuses pairs already verified
there. Two cells above changed content, one table gained two rows, and § TaskList gained two
paragraphs that were previously asserted only in the drawings; all four are listed at the foot.

### What it is for

Creating a task while viewing **Upcoming** derives no date (§ Four buckets), so the task is
created dateless and lands in **Inbox** — off the surface the user was looking at. Today's code
already does exactly this and says nothing (`c === 'today' ? startOfTodayIso(now) : null`). **The
whole component is the sentence that ends that silence.**

Note the scale before reading it as an edge case. ADR-009 § Amendment measured the live store:
**no account holds a single future-dated task**, so every user's first visit to Upcoming is an
empty collection with an `Add task` CTA (§ Empty states). This is not a corner of the app — it is
the collection's default first experience.

### It is not a toast, and § SettingsRow is why

§ SettingsRow says *"Failed is the row's most important state and it is not a toast… A preference
that silently does not stick is the quietest failure an app can have."* The rule underneath that
sentence is not *toasts are banned*. It is: **a message the user can miss may not be the only
place a fact lives.** SettingsRow's fact — your preference did not save — lives nowhere else, so
putting it somewhere missable is putting it nowhere.

Test this notice against the same rule and it passes. Its fact — the task is in Inbox — *does*
live elsewhere: the task is in Inbox, the Lists menu opens Inbox from this very screen, and the
row is there under its own title. Missing this message costs a moment of confusion; missing
SettingsRow's costs a setting that is silently not set. **So a transient message would be
permissible here** — and it is still not what ships, for a reason that has nothing to do with
that rule.

**The reason is the backdrop.** On Upcoming the notice's most common surface is
`Nothing in Upcoming` (§ Empty states), which looks **identical before and after the save**. A
message that removes itself after four seconds leaves a user who glanced away staring at an
unchanged empty screen — the same silent disappearance this component was built to end, delayed
by four seconds. **A component that exists because something vanished may not itself vanish on a
timer.**

So: a **persistent, dismissible strip**, not a toast. The owner chose the outcome — say where it
went — and the outcome is delivered more completely by a message that waits than by one that
races the user's attention.

**This component is not the home for F-005 AC-47's outliving notice, and the question was asked and
answered rather than left open** (added 2026-08-19, T-152). AC-47 needs the nearest thing this catalogue
has and it is this one — same strip class, and the no-self-dismiss argument three paragraphs up **is**
AC-47's rule, already reasoned. It is still a **sibling**, `§ CarriedNotice`, and not this component
widened. The four reasons are set out there; the one that decides it is **Lifetime rule 3 below** —
*leaving the surface … another collection, Settings, or Talk* clears this notice, which is precisely what
AC-47 forbids, and on a phone `PathSwitch` is one tap and is the app's primary gesture. Nothing in this
section changed for F-005; this paragraph exists so the next reader does not widen it by mistake.

### Anatomy and placement

It joins the **Tasks surface's banner stack**, the strip family § OfflineBanner and
§ InlineRetryBanner already occupy: top of the surface, below the top bar, **in flow**.
Full-width, `bg.raised`, 1px `bg.hairline` bottom hairline, `padding: sm gutter`, Lucide `inbox`
at `icon.size.sm` in `text.muted`, message at `font.size.meta` in `text.primary`, dismiss control at
the trailing edge.

**Why the stack and not a float.** (1) The class already exists — a full-width strip reporting one
fact about this list is precisely what both existing banners are. (2) Tasks has no composer to
dock above: the composer belongs to Talk, and at or above `breakpoints.split` Tasks is the centre
column while Talk is the right panel, so a bottom dock would be a new layout mechanism invented
for one message. (3) It renders identically on web, iOS and Android because the banner stack
already does.

**Why in flow, when § NewMessageAffordance deliberately overlays.** That component refuses to
reflow because it arrives while the user is *reading*, and pushing history upward moves the
sentence under their eyes. Here the user has just committed a create and is reading nothing; the
content below is a list of rows, not prose; and the reflow is itself informative — the surface
visibly changes, which on an empty Upcoming is the only change there is. The argument does not
transfer, and inverting it here is deliberate rather than an oversight.

**Order within the stack: condition first, consequence last.** InlineRetryBanner and OfflineBanner
report the state of the app; SaveNotice reports what the user just did. It renders **below both**,
nearest the list. The co-occurrence is real and drawn (`tasks-saved-offline`): the local no-AI
create path works offline (F-001 AC-25) and creates dateless too, so the offline banner and this
one appear together on the first try.

**Icon: `inbox`, not a tick.** A tick says *saved*, which the user knows — they pressed the button.
The news is the **destination**, so the icon is the one the destination wears in the Lists menu.
**no accent at all in v2** — green is retired (§ head), and the notice is a receipt rather than an alarm, so it sits on `bg.sunken` at `radius.md` **with no box at all** (2026-08-22, T-211 — a banner is a
ground on `border.box_allowlist`'s reading, not a box) and lets its words do the work; per
rule 3 the meaning never rests on the colour — the words carry it alone.

### The two rows

| ID | Shown when | Message |
|---|---|---|
| **SN-ONE** | one task has been saved off-surface since the last clear | `Saved to Inbox — it has no date yet.` |
| **SN-MANY** | `{count}` ≥ 2 | `{count} tasks saved to Inbox — they have no date yet.` |

**Slots:** `count`, integer, from § Spoken frames' closed vocabulary. **Two literals, not a
template over a noun** — § NewMessageAffordance's rule for L-008's reason: a template that
pluralises renders fluent text for cases nobody enumerated, and here there are exactly two. SN-MANY
needs no singular form because `count` ≥ 2 is its definition.

**Why the sentence has a second clause.** `Saved to Inbox` alone answers *where* and leaves
unanswered the question the user actually has — *why not here?* — on the surface they deliberately
opened. `it has no date yet` is the entire reason in five words, and **`yet` is load-bearing**: it
says the state is changeable without promising a control that does not exist.

**It never stacks.** One strip, however many saves — § NewMessageAffordance's rule and its reason:
a per-event notice multiplies into a column that obscures the list it is reporting on. A second
save replaces the message and increments the count.

### It carries no action, and the action it will carry

Four were weighed. The right one cannot be built, and the notice ships with none rather than with
the next best.

| Action | Verdict |
|---|---|
| **`Add a date`** | **Right, and unbuildable today.** The only action that makes the notice's own news stop being true: date the task inside Upcoming's predicate and it is in the collection the user was looking at. But there is no date-setting UI anywhere in this app — the manual create path is title-only, and `information-architecture.md` §9 puts a due-date picker out of scope while noting `due_at` itself exists and is patchable. Drawing the button now publishes a contract with no destination. |
| **`Open Inbox`** | Travel, and it repairs nothing. It moves the user off the surface they chose, to look at a task they still cannot date. Anyone who does want Inbox has the Lists menu, one tap away, already on this screen. |
| **`Undo`** | Wrong twice. The user wanted the task — they typed it and pressed the button; the mismatch is the date, not the existence. And § Buttons fixes **undo** as *reversing the last applied turn*, so spending it on a manual create gives one word two mechanisms, which is the drift that table exists to prevent. Removing a task by hand is **delete**, and offering Delete on a success notice is hostile. |
| **none** | **Ships.** |

**Reserved, not forgotten.** When a due-date affordance lands (`information-architecture.md` §9,
UC-34), SaveNotice gains `Add a date` as a ghost button before the dismiss control, targeting the
one task SN-ONE names. **SN-MANY does not gain it** — with two tasks there is no single referent,
and a button that silently picks the most recent is the guessing this catalogue refuses everywhere
else. Written now so the row lands as an addition rather than a redesign, and it uses
§ SettingsRow's precedent in the correct direction: the **place** is reserved in the catalogue, not
drawn as a dead control in the mockup.

### Where it fires, and where it must not

**One rule, not one event.** SaveNotice fires when a task the user just created **is not on the
surface they created it from, and nothing else on that surface says so.** Both clauses bind.

| Path | Fires | Why |
|---|---|---|
| manual create on **Upcoming** | **yes** | dateless → Inbox; the surface is unchanged and says nothing. The only site reachable today — and per § Empty states the collection's *default* appearance, not an edge case |
| manual create on **Upcoming, offline** | **yes** | same shape: the local no-AI path (AC-25) creates dateless too |
| manual create on **Today** | no | add-in-context dates it today (ADR-009 §4); the row appears where it was made |
| manual create on **Inbox** | no | dateless, and Inbox is where it lands — already on screen |
| **Done** | unreachable | § Empty states ET-DONE gives Done no create action, and the drawn surface carries no `Add task` |
| personal lists | blocked | needs `lists` + `tasks.list_id` (IA §7) |
| **assistant create** | **no** | the second clause — below |

**The assistant path is excluded by the second clause, not for being the assistant.**
`docs/reports/owner-question-2026-08-18-assistant-created-tasks-are-invisible.md` describes the
identical disappearance on the voice path, and the orchestrator's reading of it is that *the
confirmation message is the receipt*: the applied bubble names the task and § MessageTaskLink makes
that name a door to its row. That receipt is persistent, specific, and already on the surface the
user is standing on. A SaveNotice beside it would be a second control saying one thing — the
duplication § NewMessageAffordance refused with *one control, however many messages arrived*.

**That question is open and this section does not close it.** The rule above is phrased so the
owner's answer changes which paths satisfy it without changing the rule. One cell it decides,
recorded rather than guessed: **below `breakpoints.split` a user standing on Tasks cannot see the
bubble at all**, and whether that counts as *nothing on that surface says so* is exactly what the
answer settles.

**"A message that exists for one event is suspicious" — and this one is a rule with six tested
branches**, five of which say *no*. It picks up more when personal lists ship (creating inside a
list, moving between lists) without the rule changing.

### Lifetime — what removes it

**There is no timer.** WCAG 2.2.1 is not engaged, because there is no time limit to adjust; the
reduce-motion and screen-reader users who lose timed messages lose nothing here. Three things
clear it, all of them the user's own doing:

1. **Dismiss** — the trailing control.
2. **A newer save** — replaces the message and increments the count (SN-ONE → SN-MANY).
3. **Leaving the surface** — another collection, Settings, or Talk. The notice reports what is
   *not* on this screen; carried to another screen it answers a question nobody asked.

### Accessibility

A transient visual message is the classic thing screen-reader and reduce-motion users lose
entirely. This one is specified so they lose nothing.

- **The live region pre-exists.** The Tasks surface carries a permanently-present `role="status"`
  (`aria-live="polite"`, `aria-atomic="true"`) container, empty when there is no notice. A region
  injected into the DOM at the same moment as its content is not reliably announced — the standard
  failure, and precisely the case this component may not have.
- **`polite`, never `assertive`.** Nothing is wrong and the user caused it; interrupting would
  claim an urgency the message does not have.
- **It never takes focus.** Focus stays where the create left it — which on an empty Upcoming is
  where the user is about to type the next task. `aria-atomic` re-announces the whole sentence when
  SN-ONE becomes SN-MANY, so the count is never spoken as a bare number.
- **Keyboard-reachable without a steal.** It sits in DOM order between the top bar and the list, so
  `Tab` out of the top bar reaches the dismiss control before the first row.
- **Dismiss** is icon-only; accessible name `Dismiss`. 2.5.3 does not bind (no visible label text);
  the glyph is `text.muted` on `bg.raised`, which clears 1.4.11's 3:1 at 5.0 dark / 5.8 light.
- **Motion is not load-bearing.** Presence, wording and announcement carry the whole meaning. The
  strip enters at `motion.duration_ms.standard`; under `prefers-reduced-motion` that collapses to
  the 80ms opacity change per `motion.reducedMotion`, and — because there is no timer — **nothing
  else about the component changes at all.** Same promise as § NewMessageAffordance, for the same
  reason.
- **No new contrast pair.** `text.primary` and `text.muted` on `bg.sunken`, and the icon as a
  non-text icon, are all verified in § Contrast already.

### Testids and states

| Testid | Control |
|---|---|
| `tasks-save-notice` | the notice — carries the message; the observable QA asserts |
| `tasks-save-notice-dismiss` | the trailing dismiss control |

`tasks-save-notice` sits on a non-interactive element, exactly like `assistant-offline-banner`: the
message **is** the deliverable, so a catalogue that skipped it would leave the one thing this
component exists to produce untestable. One exemplar each, in all three shell mockups, in the three
spellings § AppFrame's *Platform variants* fixes.

**The shell catalogue goes 29 → 31, and assertions in `src/` go red by design.**
`src/assistant/mobile/__tests__/a11y.test.ts` pins the count at 29 and its `ALL_SHELL_A11Y_IDS`
does not contain the two new ids; `src/assistant/web/__tests__/app.test.tsx`'s `NOT_BUILT` map
needs both, since neither ships. This is L-008's mechanism working in the direction drift actually
travels — the suite fails because the **upstream** artifact moved — and the fix belongs to whoever
owns `src/`, not to this file.

**States, in all three mockups:** `tasks-saved-notice` (SN-ONE over an empty Upcoming — the default
first experience) · `tasks-saved-notice-many` (SN-MANY over the populated Upcoming, which also
draws the in-flow reflow above real rows) · `tasks-saved-offline` (SN-ONE below the OfflineBanner —
the AC-25 path and the stack order).

### One shape considered and rejected

**Showing the new task on Upcoming under a "just added" heading.** It is the only answer in which
nothing disappears, and it is a worse falsehood than silence: a row in a collection whose predicate
it fails is exactly what ADR-009 § Amendment and § TaskList spent this whole pass removing.
Recorded because it is the tempting one.

### Cells above that changed content in this pass

Four, and none of them is a rename or a reorder.

1. **§ Four buckets, *The cell this pass refuses to fill*** published a recommendation — *"none of
   the three — ask"* — that the owner has now decided against, choosing option 2. The cell gains a
   resolution line. Left unmarked it would send the next reader to advice that has been overruled.
2. **§ TaskList** gains the `Overdue` heading's colour rule (**T-133**). The heading's `danger`
   colour was asserted only by `.day-head.overdue` in the three mockups, leaving the drawing as its
   only authority.
3. **§ TaskList** gains the Tasks surface-title rule (**T-133**). Same shape: `showState`'s
   `TITLES` map in the three mockups was the only statement anywhere that the surface title names
   the collection being rendered.
4. **§ Testid catalogue — app shell** gains two rows, listed above.

---

## Two axes — where the Inbox row sits, and what its count now means (T-138)

**Added 2026-08-18 (T-138)**, for `docs/specs/_shared/adr/ADR-009-today-is-a-date.md` **§ Amendment 2**
and `docs/reports/owner-decision-2026-08-18-inbox-is-unfiled.md`. **No component was added, no ID was
renamed, no testid moved, and no new token was needed.** One menu row changed position, one
collection started grouping, one fact was added, one fact was rebound, and one frame went dormant.

**The change in one line.** A task is in Inbox when it is filed into no personal list — not when it
has no date. So Inbox stops being a cell of the date axis and becomes the first cell of a second,
independent one: **a *date* axis (Today · Upcoming · `undated`) and a *filing* axis (Inbox · each
personal list), over the same open tasks.** Amendment 1's predicate table survives untouched as the
date axis; only the name on its third cell was wrong. Nothing can be filed yet — `lists` and
`tasks.list_id` do not exist — so `inbox(t)` reduces to *every open task* today and narrows by
itself when lists ship.

**Three surfaces were disturbed and each has one home**, exactly as at Amendment 1: § TaskList for
the grouping, § ListsMenu for the row's position and its count, § LandingSummary for the facts and
the frames.

### The two questions this pass had to decide rather than derive

1. **Where the Inbox row sits.** Decided: **two visual groups** — `Today · Upcoming · Done`, a
   group break, then Inbox at the head of the filing rows with LM-LIST beneath it. Reasoning,
   costs, and the two rejected shapes are in § ListsMenu, *Where the Inbox row sits*. The cost is
   paid today and stated there: the filing group holds one row until `lists` ships, and the Inbox
   row moves relative to what `COLLECTIONS` ships.
2. **The nested counts.** Decided: **shown as they are.** Suppression is unavailable because a
   count omitted at zero already means *none*; a second number in the cell explains one signal with
   another. The group break is what stops the column reading as arithmetic — see § ListsMenu, *The
   counts nest*. Measured: 716 + 7 + 0 + 21 = 744 against 737 live rows, and the 7-row gap is the
   dated-and-unfiled tasks counted on both axes.

### Cells above that changed content in this pass

Ten, and one of them is a position.

1. **§ TaskList, the collection-grouping table, Inbox's row** read *"none — flat: Inbox **is** 'no
   date', so `Anytime` is true of every row it can ever hold."* The premise is gone. Inbox now
   groups, and it is the only collection that can produce all five headings. **This is the one
   changed cell that was costing a fact rather than reading stale:** *One signal, not two* puts
   lateness in the heading and nowhere else, so a flat Inbox rendered the live store's 7 overdue
   rows with no lateness signal anywhere on the surface every account opens.
2. **§ TaskList, the same table's Today row** claimed Today is *"the only surface anywhere that
   names a task as missed."* Inbox names them too now; the clause is removed rather than reworded,
   because the fact it was supporting — `overdue` has no collection of its own — is stated in
   § LandingSummary and does not need a second home.
3. **§ TaskList gains four paragraphs** on why Inbox groups, what the flat rendering cost, that
   `Overdue` is **more** load-bearing than when it was specified, and that Today and Inbox
   deliberately render the same rows under the same heading.
4. **§ ListsMenu, LM-COLLECTION's `Source`** read *"the four date predicates of ADR-009
   § Amendment"*. Three of the four are date-or-status predicates and the fourth is a container.
   The cell now says what the family actually means — rows derivable on device — which is also what
   keeps Inbox in it while it renders in the other visual group.
5. **§ ListsMenu, LM-COLLECTION's `Rows`** read `Today · Upcoming · Inbox · Done` and now reads
   `Today · Upcoming · Done · Inbox`, the order matching the two groups.
6. **§ ListsMenu, the Upcoming row's `Position` bullet** justified `Today · Upcoming · Inbox · Done`
   as *now, then ahead, then undated, then finished*. Inbox is not *undated*; removing it from that
   row leaves the horizon unbroken rather than damaged, and the bullet now says so.
7. **§ ListsMenu, the Upcoming row's opening paragraph** said F-001 AC-24's reachability bound
   *"used to rest on Inbox being a superset of every open task and now rests on the four buckets
   being total."* It rests on neither: ADR-009 § Amendment 2 § 6 moves it to the **filing** axis,
   which is total and every cell of which is openable. The Upcoming row's own requirement is
   narrowed, not retracted — without it a future-dated task is unreachable *as a dated task*. The
   old sentence is quoted in place rather than replaced silently, because this is the third reason
   the same AC has been true and the first two both expired unnoticed.
8. **§ ListsMenu gains two blocks** — *Where the Inbox row sits* and *The counts nest* — and its
   **`empty` state** gains one clause: the filing group is never empty, because Inbox is always in
   it.
9. **§ LandingSummary, the fact table.** `undated` is **added** (the fact `inbox_count` used to
   name, now a cell with no surface, sitting beside `overdue` as the second such); `inbox_count` is
   **rebound** to the Inbox container — same call, different predicate underneath; and `open_all`'s
   source changes from `open_today + upcoming + inbox_count` to `open_today + upcoming + undated`,
   because `inbox_count` is no longer one of the date axis's terms and adding it would count the
   dated-and-unfiled rows twice.
10. **§ LandingSummary, LSM-CLEAR-AHEAD** is **dormant, not dead**, and its `Selected when` gains
   `upcoming ≥ 1` as a condition where it used to be an implication. Row 4 of the selection rule
   died in T-128 because its condition contradicts the model permanently; this one is unsatisfiable
   only while `isFiled` is constant `false` and wakes with the first filed task — the same category
   as LSM-PROGRESS, which is written, drawn and blocked on `completed_at`. Its ID, slots, text and
   mockup state are untouched.

**Two further blocks were added rather than changed:** the INV-INBOX-FILING note in
§ LandingSummary — which `docs/specs/assistant/data-model.md` names as the physical place a re-merge
would land — and the selection rule's **second totality re-proof**, which this time neither grew
the table nor struck a row.

**One selection-rule row changed and the rest did not, which is the amendment showing its shape.**
Rows 1–7 branch on `open_all`, `overdue`, `open_today` and `done_today` — all date-axis or status
facts — and this amendment moved neither the date axis nor the gate. Only row 8, the one row that
mentions Inbox, changed at all.

### What is owed elsewhere, and is not written here

- **Rule 8's third branch, when `lists` ships.** `inbox_count = 0`, `upcoming = 0`, `open_all ≥ 1`
  — everything undated and everything filed — falls out of the table. Unreachable today, named in
  § LandingSummary in advance rather than found afterwards, and deliberately not designed against
  zero rows: the honest frame for it names the filing axis, and there is no list to name.
- **Every list must render a row.** ADR-009 § Amendment 2 § 6 converts AC-24's reachability bound
  onto LM-LIST: post-lists an undated task inside a personal list is in no date collection with a
  surface and not in Inbox, so its list's row is its only door. § ListsMenu already draws LM-LIST;
  this is the requirement that says a list which exists and is not drawn strands its tasks
  silently. Recorded here because it lands with the lists feature, not with this pass.
- **A filed task has to be constructible before any of this can be tested.** The store holds none
  and cannot hold one; `isFiled` must be answerable `true` in a test today
  (`data-model.md § isFiled`). Not a design artifact, recorded because it is invisible from this
  file and because every assertion about the two axes is vacuous without it.
- **Code and tests, already routed to the implementation pass** by ADR-009 § Amendment 2 § 7 —
  `tasks.ts:224`'s exactly-one-collection comment and `collections.test.ts:91`'s disjointness
  suite are false about the model and the store now holds 7 counterexamples. Named here only so
  that a reader of this file does not re-file them.

---

## CarriedNotice — the notice that outlives the surface it was typed in (T-152)

**Added 2026-08-19 (T-152), additive**, for `F-005 AC-47`, `AC-2`'s failed and offline-refused states,
and `AC-43`'s hand-action undo offer — which the owner placed in this family on 2026-08-19
(`docs/reports/owner-decision-2026-08-19-close-gate-one.md` §2) rather than on the task's row. **Nothing above
this line was moved, renamed or reordered.** Five new testids, **zero new colour, radius, shadow or
motion tokens**; one new § Buttons variant (`neutral`) and one new § Contrast pair, both published in
their own sections. Four cells above changed content and one table gained five rows; all are listed at the
foot.

### What it is for

**A value the user typed does not disappear because the surface it was typed into is gone.** F-005 AC-2
guarantees a failed write *"never silently reverts"*; AC-45 makes closing the detail unconditionally
available and AC-48 lets a message swap its subject — so the surface that was holding the guarantee can
leave at any moment, including while the write is still in flight. This component is where the guarantee
goes when that happens. It carries **the user's value**, names **the task and the field**, offers **the
same retry** the field offered, and **does not remove itself** — not on a timer, not on a navigation, not
on a surface change, and not on crossing `breakpoints.split`.

It carries four kinds of unfinished business, all of them belonging to a **task** rather than to a
surface:

1. a write that **failed** (AC-2, AC-47);
2. a write **refused because the app is offline** (AC-2's third state — refused, not queued: nothing
   replays it and nothing retries it but the user);
3. the **report** that a notice's task has since been deleted (AC-4, AC-47) — no retry, because a retry
   aimed at a deleted row is dead or a resurrection;
4. the **hand-action undo offer** (AC-43) — the one reversal of the one irreversible thing in the
   feature.

**Two boundaries are already decided and this section does not re-open them.** It **does not survive a
reload** (the owner's OQ6 answer of 2026-08-18: there is no durable store here, so there is nothing to
carry across one), and **a failure whose cause is that the task is gone produces no notice at all** —
AC-4's terminal state on the detail is the whole of that case.

### Why it is a sibling of § SaveNotice, not § SaveNotice widened

AC-47 asks for this decision explicitly, once. § SaveNotice is the nearest thing the catalogue has: the
same strip class, and its central argument — *"a component that exists because something vanished may not
itself vanish on a timer"* — **is** AC-47's no-self-dismiss rule, already reasoned. It is still a sibling,
for four reasons, of which the first decides it on its own:

1. **Lifetime.** § SaveNotice's Lifetime rule 3 clears it on *"leaving the surface — another collection,
   Settings, or Talk"*. That is precisely what AC-47 forbids, and below the split `PathSwitch` is one tap
   and is the app's primary navigation. Widening the component means its defining lifetime rule becomes
   conditional per instance — which is the same objection that keeps AC-38 out of this family (below), so
   applying it consistently means not doing it here either.
2. **Where it lives.** § SaveNotice belongs to the **Tasks surface's** banner stack. This family belongs
   to the **app frame**: it renders on Talk and on Settings, which no component in this catalogue does.
3. **Multiplicity.** § SaveNotice is one strip that *"never stacks"* and aggregates into a count. This
   family is **0..N, one per task**, and cannot aggregate — each row carries a *different value the user
   typed*, and the value is the whole deliverable. A count would discard exactly what the component
   exists to preserve.
4. **Actions.** § SaveNotice *"carries no action"* and declined an `Undo` in writing. This family carries
   `Retry`, `Put back` and `Dismiss`.

Widened, one component would hold two lifetimes, two homes, two multiplicity rules and two action
policies, told apart by a flag — a single name over two components. § SaveNotice is unchanged; it gained
one cross-reference so nobody widens it by mistake.

### Why AC-38's passed reminder is not in this family either — the other half of the same decision

AC-47 and AC-38 both ask design to decide **once** whether the two share a component family, so that a
single family, if chosen, is chosen deliberately rather than by whichever AC is built first. **Two
families.** Three reasons, and the first is AC-38's own observation:

1. **Their lifetimes are opposite.** This family never self-retires and ends only by the user's own act;
   AC-38's surfacing **retires on acknowledgement**, which the owner defined on 2026-08-19 as a
   deliberate, per-reminder action. A shared family would need a per-instance lifetime rule — reason 1
   above, again.
2. **Different objects, opposite news.** This family reports **the app failing to keep something the user
   typed**. AC-38's surfacing reports **a moment that has passed** — the app doing exactly its job. A
   strip that reports both teaches the user nothing about what either means.
3. **Different verbs.** This family's verbs are retry, put back, dismiss. AC-38's is *acknowledge*, one
   per reminder, with **no bulk dismissal** (owner, §3). Merged, one strip carries four verbs and the one
   that retires a reminder sits beside the one that dismisses a notice — two gestures a keystroke apart
   with opposite consequences.

**So `§ CarriedNotice` may not carry a passed reminder**, and that prohibition is the deliverable of this
subsection. Where AC-38's surfacing *does* render is **not decided here and is not implied by this
decision** — see *What is owed elsewhere* at the foot, which names the constraints rather than pointing at
them.

### Placement — one region, at the frame, above the stacking layer

**A region docked directly below the top bar, spanning the full frame width, in flow, outside the surface
stack.** Below `breakpoints.split` it sits under the top bar of whichever surface is showing; at or above
the split it spans **both** the centre column and the right panel — one region, not one per column, which
is what makes *"visible wherever the user is"* one implementation instead of two.

**It is outside the stacking layer, and that is the load-bearing half.** S3 Lists menu, S4 Settings and S5
New list slide over the **content** and **under** this region. Otherwise the family is invisible on
Settings, and AC-47's requirement — visible on Talk and Settings and at both widths — is met at three of
five surfaces, which is the failure mode it names.

**Visible, not reachable.** The catalogue pushes the other way and this component must not follow it: the
only strip family that existed was the Tasks banner stack, and a badge-then-tap design would put the
user's typed value one navigation away during an outage, which is the loss AC-47 exists to prevent
wearing an affordance (design D24). There is no badge, no collapsed pill and no "N unsaved changes" door.

**Strip order when several co-occur, outermost first:**

> § CarriedNotice → § InlineRetryBanner → § OfflineBanner → § SaveNotice → the surface's content

§ SaveNotice's rule was *condition first, consequence last*; this extends it by one step. **A strip that
is not about the surface it appears on outranks every strip that is** — put under a surface-owned strip,
a notice about a task the user cannot see would be buried by a condition of the screen they happen to be
standing on. On Talk the question mostly does not arise: § OfflineBanner docks above the Composer at the
bottom of that surface, so only this region is at the top.

### Multiplicity — 0..N notices, 0..1 offer, and what stops it taking the screen

- **One notice per task, never one per field** (AC-47) — the same aggregation AC-2 requires of concurrent
  in-field failures. A second failed field on a task the region already holds **joins that task's row as
  a second field block**; it does not create a second row. The row grows; the region's row count does
  not.
- **At most one CN-UNDO**, and it renders **first**. It is the newest event and the only row with a
  window another action closes, so it is the one the eye should reach first.
- **Notices order newest first**, under CN-UNDO. The value the user typed most recently is the one in
  front of them.
- **The visible ceiling is a row count, not a fraction of the screen:** at most **two** rows below
  `breakpoints.split` and **three** at or above it. Further rows **scroll within the region** — the
  region never grows past that, and the first row is always fully visible. This satisfies AC-47's
  *"N notices do not stack into a column that obscures what they report on"* without introducing the
  navigation D24 rejected: scrolling inside a visible region is not a door, nothing is hidden behind a
  tap, and every row keeps its position and its controls.
- **The two-line worst case at `breakpoints.mobile` is a measurement owed at `phase: screens`** — two
  rows, each with a three-line value, at 375px. Stated as a requirement here; no content-width floor is
  published, for § Touch's reason.

### Anatomy of one row

Full-width, `bg.raised`, 1px `bg.hairline` bottom hairline, `padding: sm gutter`, in flow. Leading Lucide
icon at `icon.size.sm`; then the body; then the actions and the dismiss control at the trailing edge.

**A row is one task, and it carries one block per affected field.** This follows from two ACs that pull in
different directions and are both satisfied by the same shape: AC-47 says **one notice per task, not one
per field**, and AC-2 says several fields can be in flight together, **each keeping its own value and its
own retry**, with the failures aggregating into **one** status message. So the row is the aggregation and
the blocks inside it are the per-field guarantees.

| Part | Rendering |
|---|---|
| the sentence | `font.size.body`, `text.primary` — names the event and the task. Which sentence is chosen is the precedence rule below |
| **one field block per affected field** | the field's **label** at `font.size.meta` `text.muted`; the typed value beneath at `font.size.body` **`text.primary`** — the user's own words are not chrome and are never muted; then `Now saved` + the stored value when that field is superseded; then that field's `Retry` if it is still retryable |
| the trailing controls | one **Dismiss** for the row — dismissal is of the notice, and there is one notice per task |

**The seven field labels, one literal each:** `Name` (the title — `aria-label="Task name"` is what the
shipped rename input already says) · `Note` · `Priority` · `Deadline` · `Reminder` · `Step` · `Repeat`.
**This is how AC-2's *"naming the fields that failed"* is met** — as labels on the blocks, not as a
comma-joined noun list inside a sentence, which would be a template over a list and is exactly what
L-008 forbids.

**Retry is per field, not per row** (AC-2: *each keeps its own value and its own retry*). A row with two
failed fields carries two Retry controls, and each resolves only its own field. A field that is
**superseded** carries no Retry, whatever the rest of the row does.

**The precedence rule for the sentence and the icon — one row, several fields, one worst state.** In
order: **deleted** (task-level, so it dominates everything) → **failed** → **offline-refused** →
**superseded**. The row wears the state of its worst field; each block still states its own.

**Two sentence forms, because one field and several are different facts:**
- **one affected field** → the per-field literal from the table below;
- **two or more** → `Couldn't save your changes to "{task}".` (failed) · `You're offline — your changes
  to "{task}" weren't saved.` (offline) · `"{task}" has changed since. What you typed wasn't saved.`
  (all superseded). Three literals, and the fields are named by their blocks.

**Each value renders in full, wrapping, up to three lines; past that that block's value area scrolls
within itself.** It is never truncated with an ellipsis: *carries the user's value* is the component's
reason to exist, and a value the user cannot read back is not carried. The full value is in the block's
accessible name either way.

**Icons reuse assignments that already exist; none of them is a new meaning** (§ Colour rules 1 and 3 —
the words carry the meaning alone, in every row):

| Row | Lucide icon | Colour | Why that colour is already legal |
|---|---|---|---|
| CN-FAILED | `alert-circle` | `danger` | § InlineRetryBanner already uses a `danger` icon for a write/read that failed |
| CN-OFFLINE | `wifi-off` | `attention` | § OfflineBanner already carries the offline news in the `attention` accent (v2's name for the same meaning) |
| CN-SUPERSEDED | `history` | `text.muted` | nothing is wrong and there is no action |
| CN-DELETED | `trash-2` | `text.muted` | as above |
| CN-UNDO | `corner-up-left` | `text.muted` | **must not wear the accent.** § UndoAffordance fixes the accent as *the assistant's own act* and AC-43's offer reverses the **user's** act — the constraint travels with the affordance, wherever it renders |
| CN-UNDONE | `corner-up-left` | `text.muted` | same glyph, no action |

### The rows

| ID | Shown when | Actions |
|---|---|---|
| **CN-FAILED** | a write on this task failed, and nothing newer has been stored for that field | `Retry` (ghost) **per field** · Dismiss |
| **CN-OFFLINE** | a write to a **server-owned** task was refused because the app is offline (AC-2's third state) — see the provenance scope below | `Retry` (ghost) · Dismiss |
| **CN-SUPERSEDED** | something newer has been stored for that field — the user's retry or an assistant turn (AC-36) | Dismiss **only** |
| **CN-DELETED** | the task this notice belongs to has been deleted (AC-4) | Dismiss **only** |
| **CN-UNDO** | an undoable hand action has just happened (AC-43) | `Put back` (**neutral**) · Dismiss |
| **CN-UNDONE** | `Put back` was used | Dismiss **only** |

**CN-OFFLINE is scoped by row provenance, and getting that wrong removes working behaviour.** AC-2's
refusal covers a row **the server already holds** (`local !== true`) and nothing else. An edit to a task
the user created **while offline** is kept and replayed today — `persistLocal()` saves it, `pushLocalTasks`
sends it — so such an edit **produces no CN-OFFLINE row at all**; a notice saying it *wasn't saved* would
be false, and drawing one would be this component asserting a regression. Four Gate 1 lenses found the
unscoped version of that rule independently.

**And CN-OFFLINE is not a pending indicator.** AC-2 forbids a spinner, a pending badge and silent
acceptance for this state, because each of them implies a queue that does not exist. This row implies
none: it says the write **did not happen**, in the past tense, and the only thing that will ever retry it
is the user pressing `Retry`. Nothing here fires on reconnection and nothing fires on a timer — the same
rule AC-38's offline acknowledgement was corrected to obey.

**Neither CN-SUPERSEDED nor CN-DELETED offers a retry, and that is a rule rather than an omission.** A
retry on a superseded field **overwrites the newer stored value with the stale failed one** — the
resurrection door AC-4 and AC-47 close everywhere else; a retry on a deleted task is dead or a
resurrection. Retyping the value is the available action in both cases, and it is an ordinary edit rather
than a recovery path.

**`Retry` keeps § Buttons' `ghost` variant; only `Put back` takes `neutral`.** Retry is not an undo, and
§ InlineRetryBanner and § SurfaceError already ship a ghost Retry — one word, one treatment, three sites.
AC-43's offer is the one control in the catalogue with an explicit prohibition on the ghost variant's
colour, which is why `neutral` exists.

### The literal messages

**Literals cited by row ID, never a template over a noun** — § SaveNotice's rule and § NewMessageAffordance's,
for **L-008**'s reason: a template that interpolates the field name renders fluent text for combinations
nobody enumerated, and here the domain is closed at seven fields. `{task}` and `{value}` are `verbatim`
slots (§ Spoken frames' closed vocabulary) — the task's own title and the user's own text, never
re-worded.

| Field | CN-FAILED | CN-OFFLINE | CN-SUPERSEDED |
|---|---|---|---|
| title | `Couldn't rename "{task}".` | `You're offline — "{task}" wasn't renamed.` | `"{task}" has been renamed since. What you typed wasn't saved.` |
| note | `Couldn't save the note on "{task}".` | `You're offline — the note on "{task}" wasn't saved.` | `The note on "{task}" has changed since. What you typed wasn't saved.` |
| priority | `Couldn't save the priority on "{task}".` | `You're offline — the priority on "{task}" wasn't saved.` | `The priority on "{task}" has changed since. What you typed wasn't saved.` |
| deadline | `Couldn't save the deadline on "{task}".` | `You're offline — the deadline on "{task}" wasn't saved.` | `The deadline on "{task}" has changed since. What you typed wasn't saved.` |
| reminder | `Couldn't save the reminder on "{task}".` | `You're offline — the reminder on "{task}" wasn't saved.` | `The reminder on "{task}" has changed since. What you typed wasn't saved.` |
| step | `Couldn't save the step on "{task}".` | `You're offline — the step on "{task}" wasn't saved.` | `The step on "{task}" has changed since. What you typed wasn't saved.` |
| repeat | `Couldn't save the repeat on "{task}".` | `You're offline — the repeat on "{task}" wasn't saved.` | `The repeat on "{task}" has changed since. What you typed wasn't saved.` |

**The seven fields are the user-settable set F-005 AC-1 names**, and no more: `due_all_day`, `parent_id`,
`step_order` and `series_id` are not user controls (AC-1), so no write of theirs can produce a notice.

**CN-DELETED**, one literal — the field is named by the `You typed` label, and the task is gone, so no
per-field sentence exists to write: `"{task}" was deleted. What you typed wasn't saved.`

**CN-UNDO**, four literals, one per class of undoable action in AC-43:

| Action (AC) | Message |
|---|---|
| delete a task, from the detail (AC-31) or from a list row (AC-42) | `Deleted "{task}".` |
| delete a step (AC-14) | `Deleted a step from "{task}".` |
| delete a whole series (AC-30) — the restore unit is the series (AC-41) | `Deleted "{task}" and the rest of its series.` |
| reorder steps (AC-15) | `Moved a step in "{task}".` |

**A reorder that changes nothing creates no row at all** (AC-43's no-op clause) — an offer to reverse
something that did not happen is a control with no meaning.

**CN-UNDONE**, four literals, one per class above: `"{task}" is back on the list.` ·
`The step is back in "{task}".` · `"{task}" and its series are back.` · `The step is back where it was.`

### Lifetime — what removes each row, and the two transitions that are not endings

**There is no timer anywhere in this family, so WCAG 2.2.1 is not engaged** — there is no time limit to
adjust, and the reduce-motion and screen-reader users who lose timed messages lose nothing here. That is
§ SaveNotice's position and this family's central rule.

| Row | Removed by |
|---|---|
| CN-FAILED | a retry that **succeeds** · Dismiss · reload |
| CN-OFFLINE | a retry that **succeeds** · Dismiss · reload |
| CN-SUPERSEDED | Dismiss · reload |
| CN-DELETED | Dismiss · reload |
| CN-UNDO | `Put back` (→ CN-UNDONE) · Dismiss · **the next undoable action replaces it** · reload |
| CN-UNDONE | Dismiss · reload |

**And by nothing else.** Not by elapsing, not by a navigation, not by a surface change, not by crossing
`breakpoints.split`, not by the region scrolling, not by a retry that fails again.

**The two transitions are transitions, not endings — and this is the answer to a state that had no
lifetime** (design D26). AC-47 lists the task's deletion among the things that *end* a notice, and
separately requires the deletion to be *"reported once, with the value still legible, and with no
retry"*. Read as an ending, nothing governs how long that report stays on screen — and **the report is
the last legible copy of text the user typed, and it is the one state that offers no retry**, so a report
that self-dismissed would lose the value by elapse, which is what this family exists to prevent, one
ender over. So:

- **CN-FAILED → CN-DELETED** when the task is deleted. The retry **obligation** ends; the row does not.
- **CN-FAILED → CN-SUPERSEDED** when something newer is stored. Supersession is not an ender (AC-47's own
  revision 4 correction); the notice stands, carrying the superseded text and no retry, until dismissed.

Both terminal states keep the family's rule: **removed only by the user's own act, or by a reload.**

**Reopening the detail on a task that has an outstanding notice** shows that field holding **the user's
value**, still failed, still offering retry — **unless something newer has been stored**, in which case
the field shows the stored value and the row is CN-SUPERSEDED (AC-47). The notice and the surface never
disagree because there is one failure behind both.

**One permanent-loss mechanism is visible in this table and is the owner's open question, not a design
gap.** A second undoable action replaces CN-UNDO and the replaced action stays done, with nothing reported
— and a reload ends the offer. Both are named in `F-005 OQ13`, which asks the owner about the depth of
recovery. This family implements the depth of one; a recoverable-items view is a surface F-005 does not
build.

### Retry is one path called from two places

The field's Retry (AC-2) and this row's Retry are **one write, invoked from two sites** — they retry the
same write once and resolve the same row. Two implementations of one postcondition drift, and that is
**L-005**'s shape applied to a recovery path. The catalogue publishes an id per site
(`shell-carried-notice-retry` here, the field's own at `phase: screens`) because they are two controls;
the observable is one write, and QA asserts that a retry from either site produces exactly one attempt.

### Accessibility

- **The region pre-exists and is empty when there is nothing to report.** `role="status"`,
  `aria-live="polite"`, `aria-label` — a live region injected into the DOM at the same moment as its
  content is not reliably announced, which is § SaveNotice's reasoning and applies with more force here,
  because this region is created once per app rather than once per surface.
- **`aria-atomic="false"`, which is where it diverges from § SaveNotice.** SaveNotice is one sentence and
  re-announces whole; this region holds N rows, and re-reading all of them when the third arrives is the
  *"N polite announcements"* failure AC-2 and AC-47 both aggregate to avoid. A new or changed row
  announces itself; the rest stay quiet.
- **`polite`, never `assertive`.** Nothing here is time-critical — the family's whole promise is that it
  waits — and interrupting would claim an urgency it does not have. It joins AC-33's 4.1.3 list.
- **Two literals for the region's accessible name:** `Unsaved changes` when it holds ≥1 notice;
  `Undo offer` when CN-UNDO is the only row.
- **It never takes focus.** Focus stays where the action left it — which after leaving a field is the
  next field, and after a delete is the list.
- **Keyboard-reachable without a steal** (2.1.1): the region sits in DOM order immediately after the top
  bar, so `Tab` out of the top bar reaches `Retry` / `Put back` / `Dismiss` before the surface's content.
  On dismissing a row, focus moves to the next row's dismiss control; if the region empties, back to the
  control that had focus before.
- **Visible labels are prefixes of accessible names** (2.5.3): `Retry`, `Put back`. `Dismiss` is
  icon-only with the accessible name `Dismiss`; the glyph is `text.muted` on `bg.raised`, clearing
  1.4.11's 3:1 at 5.01 dark / 5.78 light.
- **The row's accessible name carries the whole value**, including the part that scrolled.
- **Motion is not load-bearing.** Rows enter at `motion.duration_ms.standard`; under
  `prefers-reduced-motion` that collapses to the 80ms opacity change per `motion.reducedMotion`, and —
  because there is no timer — **nothing else about the component changes at all.**
- **No new contrast pair beyond the one § Contrast now publishes** for the `neutral` variant.
  `text.primary` / `text.muted` on `bg.base`, and `danger` / `attention` as non-text icons, are all
  verified there already.

### Testids and states

| Testid | Control |
|---|---|
| `shell-carried-notices` | the region — non-interactive, exactly like `tasks-save-notice` and `assistant-offline-banner`: its **presence on every surface** is the observable AC-47's placement requirement has, and a catalogue that skipped it would leave that untestable |
| `shell-carried-notice` | one notice row exemplar — carries the sentence and the value |
| `shell-carried-notice-retry` | CN-FAILED / CN-OFFLINE Retry — **one per field block**, so a row with two failed fields carries two of them (AC-2: each field keeps its own retry) |
| `shell-carried-notice-undo` | CN-UNDO's `Put back` |
| `shell-carried-notice-dismiss` | any row's trailing Dismiss |

All five are `(web, mobile)`, like the component. **AC-47 carries `(web, mobile)` and the phone's half is
this family's lifetime, reach and content** — the detail-close *trigger* is web-only because the phone has
no detail, but AC-2's refused or failed value and AC-43's `(mobile)` undo offer both need a home whose
lifetime is this one. So these five ids close the debt `## Impact` §8(d) records as *"the mobile ids for
AC-42/AC-43's undo offer, which is an element that does not exist"*.

**States owed at `phase: screens`, one per row plus the four that are about the region rather than a
row** — named here so the drawing pass has a list rather than a judgement: `carried-failed` ·
`carried-offline` · `carried-superseded` · `carried-deleted` · `carried-undo` · `carried-undone` ·
`carried-two` (the below-split ceiling) · `carried-scrolled` (above the ceiling) ·
`carried-on-talk` · `carried-on-settings` (the two surfaces that decide the placement requirement) ·
`carried-with-banners` (co-occurring with § OfflineBanner and § InlineRetryBanner, which is the stack
order drawn rather than asserted).

### What is owed elsewhere, and is not written here

Listed as items rather than as pointers, because a pointer that names no item is how an obligation gets
believed-recorded (design D27, and D14's own failure mode).

1. **AC-38's passed-reminder surfacing has no component yet.** This pass decided only that it is **not**
   this family (above). Its constraints, for whoever draws it: it renders **on open** — and *open* is two
   doors, `init()` and `onForeground()` (AC-38); N passed reminders are **one** surfacing ordered oldest
   first; each carries a **deliberate per-reminder acknowledge control** and there is **no bulk
   dismissal** (owner, 2026-08-19 §3); rendering is **not** acknowledgement and neither is opening the
   task or scrolling past; below the split the app opens on Talk, where **§ LandingSummary** already owns
   what is said on open; and it carries `(api, web, mobile)`. Whether it is § LandingSummary widened or a
   third family is the open call.
2. **The mobile spellings of TR-URGENCY and TR-REPEAT** (§ TaskRow) are owed to **F-003's** closed id
   catalogue, not invented here.
3. **The three shell mockups still carry the falsified § MessageTaskLink note** — *"tap a task to find it
   in the list"* at `app-shell.html:811`, `app-shell-ios.html:746`, `app-shell-android.html:750`, and in
   `src/assistant/web/components/ConversationPane.tsx:131-136`. The replacement copy is published in
   § MessageTaskLink; propagating it into the drawings is `phase: screens` and into `src/` is web-agent's.
4. **F-005's `phase: screens` dispatch must extend the three shell mockups**, not only draw the detail —
   this family renders on Talk and Settings, which only `app-shell*.html` draw (§ Testid catalogue's
   closing note).
5. **The `src/` catalogue assertions go red on the five new ids** by design; the fix belongs to whoever
   owns `src/` (§ Testid catalogue's closing note names the three files).
6. **One coordination item, because the model for this family was being written in `src/` at the same time
   as this section.** `src/assistant/_shared/model/notices.ts` (new, unreviewed here, and correctly in
   `_shared/` for AC-47's stated reason) already implements one-notice-per-task, per-field entries,
   supersede-does-not-end, no timer, and one retry path — it agrees with this section on all five. **The
   one thing it cannot decide, because it is a rendering rule, is what this section calls the D26
   answer:** its `ended` marker makes `retryableFields` empty, which is right, and whether an `ended`
   notice **still renders** is design's. It does: **CN-DELETED renders and is removed only by Dismiss or a
   reload.** An `ended` notice filtered out of the region is the last legible copy of the user's typed
   value disappearing on a deletion it did not cause — the defect D26 named. Whoever owns that file and
   the web rendering should read *Lifetime* above rather than infer the rule from the type.

### Cells above that changed content in this pass

Five, and none of them is a rename or a reorder.

1. **§ Buttons** gains the `neutral` variant and three rows in the one-word-per-concept table
   (`put back`, `deadline`, `step`), with the reasoning for the first beside it.
2. **§ TaskRow** gains *The row's mark budget* — the three marks, their order, the four-item ceiling,
   their renderings and their web ids, and the F-003 debt for the two mobile spellings.
3. **§ MessageTaskLink** gains the replacement note copy, the five states it was checked against, and the
   decision that the note renders on the newest door-carrying message only.
4. **§ Skeletons** gains SK-DETAIL and the paragraph saying why the detail's loading and empty states are
   otherwise identical.
5. **§ SaveNotice** gains one paragraph recording that AC-47's notice is a sibling and not this component
   widened, so the next reader does not widen it by mistake. **§ Contrast** gains one computed pair and
   **§ Testid catalogue — app shell** gains five rows and a counts note; both are listed here rather than
   separately because neither changed a decision.

---

## TimeRail — where the whole novelty budget is spent (TR-RAIL-*)

**Added 2026-08-21 (T-204), for visual language v2.** Owed by `DESIGN.md ## Identity`, which names
the time rail as this system's one differentiator and spends the entire novelty budget on it.
Drawn in `specimen.html` plate 03 and in all three `app-shell*.html`.

**What it is.** Every task row opens with its due time, set in `font.family.numeric`,
right-aligned in a fixed column, with a 1px `bg.hairline` running the length of the list as the
column's spine. Nowhere else in the app does a second face appear.

| ID | Element | Rendering |
|---|---|---|
| **TR-RAIL-TIME** | the due time | `font.family.numeric` at `font.size.meta` in `text.muted`, right-aligned, `space.4` clear of the spine |
| **TR-RAIL-ZERO** | a task with no time | an em dash, in the same column, same face, same alignment |
| **TR-RAIL-DAY** | the weekday | rendered **only** at `wide` and above, preceding the time, in `text.muted`, `space.2` clear of it |
| **TR-RAIL-SPINE** | the column's edge | 1px `bg.hairline`, full height of the list. **It is now the only rule in the list** — the row separators it used to anchor were deleted on 2026-08-22 (§ TaskRow), which leaves the spine as the one line the eye follows down the column, and that is what the novelty budget was spent on |

**Three widths, from `layout.measure.timerail`.** `compact 72` below `split` · `default 96` from
`split` · `wide 136` at `wide` and above. **The rail widening and gaining the weekday is what a wide
screen buys** — the alternative, which v1 shipped, is the list growing a dead gutter.

**The zero case is drawn, not absent.** A task with no deadline shows `—`. An empty cell reads as a
rendering failure and collapses the column's rhythm; a dash says *this one has no time* in the same
place every other row says what its time is.

**One signal per meaning, and this is where it is easiest to break.** The `Overdue` group heading
carries lateness for its whole set in `color.danger` (§ TaskList). **The times inside that group
stay `text.muted`.** A red heading over red dates is two signals for one fact; they dilute each
other and the row stops being scannable.

**The rail is a column, not a prefix.** It is a real grid track — `grid-template-columns: rail,
minmax(0,1fr), auto` — so a title that wraps to two lines leaves the time on the first line and the
column's edges do not move. A title is **never** truncated to keep the rail tidy.

**Two left edges, and the spine is what explains the second one.** The surface head (`Today`, its
count, the rule under them) and the banner stack begin at the pane's gutter; group headings and task
titles begin at `gutter + rail`, past the spine. That is one deliberate step, drawn by a visible
1px line. It is not the three unexplained left edges the 2026-08-21 audit measured on the shipped
Tasks surface (title at x=84, rows at 32, the primary action at 592).

---

## The gutter rule — two edges, and every block on a surface uses them (GUT-*)

**Added 2026-08-22 (T-218), after the owner measured the task detail and found the typed fields on a
different edge from everything else.** *"title và description đang có độ kích thước và căn lề không
giống các element khác."* Measured at 390 in `detail-blank` before this pass, and **both edges were
off rather than one**:

| | ground left | ground right | its text starts |
|---|---|---|---|
| the name's ground · the note's ground | **4** | **386** | 16 |
| the property group | **16** | **374** | 36 |
| a property row's own ground, inside it | 24 | 366 | 36 |
| the offline banner | 16 | 374 | 34 |
| a step row's hover ground | 16 | 374 | 24 |

**Five text edges on one screen and two ground edges.** The two typed grounds were bleeding outward
by their own padding so that their *text* landed on the pane's gutter — a real technique, and one
that works only when every other block puts its text on that gutter too. None of them did. So the
bleed was not finished, it was **removed**, and one rule now covers the surface.

**The rule.** A surface has exactly two vertical edges, and every block uses both:

- **The block gutter** — `layout.grid.gutter` (16 below `wide`, 24 from 1536). Every ground a block
  paints across the column — a quiet field's ground, a property group, a banner, a row's hover
  ground, a skeleton bar, a button's fill or border — starts here and ends on its mirror. **Nothing
  bleeds past it and nothing is inset from it.**
- **The text gutter** — the block gutter plus `space.3`. Every line of text starts here, and so does
  the first thing in a row that is not text: a checkbox, a leading icon. **This holds whether or not
  the block paints a ground.** A block's padding exists to bring its content to this line and for
  nothing else.

**Three consequences, each of which is how the rule gets broken:**

1. **A ground nested inside a ground shares one `space.3`, it does not add a second.** The property
   group pads `space.1` and each row inside it pads `space.2`; together that is one `space.3`, so the
   row's own hover ground sits at gutter + 4 and its label still lands on the text gutter. A group
   that padded `space.2` and rows that padded `space.3` is what put property labels at 36.
2. **A mark comes out of the inset, not on top of it.** § OfflineBanner's `border.mark` left rule is
   part of the ground, so a marked banner pads `space.3 − border.mark`. Otherwise every marked
   banner starts its text 2px past the text gutter and nothing else on the screen does.
3. **Text with no ground of its own still takes the inset.** The meta line under the name, an
   FLD-LABEL, an FLD-HELP line, an inline failure — each is padded to the text gutter, so one left
   edge runs the length of the surface instead of one per block.

**Three things are not blocks and do not take the text gutter**, named here so the exceptions are
decisions rather than drift:

- **A control sized to its own content** — a § Buttons button, a § Message bubble, an § OptionChip.
  It sits where its row starts and insets its own label by `control.padding_x`. A button's ground is
  still on the block gutter when the button opens a row: `detail-delete-button` measures **16**.
- **A structural column** — § TimeRail. The rail is a grid track, so group headings and task titles
  begin at `gutter + rail`. That is the *"two left edges"* the § TimeRail entry already argues for,
  and the rule above governs padding, never columns.
- **A chrome bar** — the topbar and the composer. The leading icon button is bled by `space.3` so the
  **icon's** optical centre lands on the block gutter, which is what both platforms do with a back
  affordance.

**Measured after the change, 390, `task-detail.html` · `-ios` · `-android`, identical on all three:**
every ground `L=16 R=374`; every nested property row `L=20 R=370`; every leading item of every block
`L=28`. At 1920 the same three numbers are `340 / 980`, `344 / 976`, `352`. Checked in
`detail-default`, `detail-blank`, `detail-typed-affordance`, `detail-overdue`, `detail-offline`,
`detail-loading`, `detail-error` and `detail-deleted`.

**A picker is its own surface**, not a block on this one: a popover or a bottom sheet sets its own
pair of gutters from its own padding, and the rule applies again inside it.

---

## Field · Label · FormRow — a field has no intrinsic width (FLD-*)

**Added 2026-08-21 (T-204).** Owed since v1, which never defined them, which is why the task detail
shipped without them. Rule text: `DESIGN.md ## Fields, labels and form rows` and
`tokens.json field.rule`. Drawn in `specimen.html` plate 06 and in all three `task-detail*.html`.

**The defect this exists to make unrepeatable.** On a 1440px screen the shipped task detail rendered
the Name input, the Note textarea and the Add-a-step input at **197px each**, inside a `.detail-col`
of 720 inside a pane of 1020. The Name field displayed `Gọi nha sĩ đặt lịch khám` for a task called
`Gọi nha sĩ đặt lịch khám răng` — **a form for editing a task truncated the task's own title, with
823px to spare.** Cause, located: `.detail-field-control` was used in JSX and styled nowhere, so the
input fell back to the HTML default `size=20`.

| ID | Element | Rendering |
|---|---|---|
| **FLD-FIELD** | the control | `width: 100%` of its form row, `field.height` tall and never below the platform's `control.minTarget`, 1px `bg.rule`, **`radius.sm`**, `font.size.body`, `field.padding_x` inset. Multiline starts at `field.height_multiline_min` and may only grow |
| **FLD-QUIET** | a typed value on a **property sheet** | the same control with **no boundary in any state, and a GROUND instead**. `bg.sunken` behind the text arrives when the value is **empty**, when the pointer is over it, or when it has focus; at rest with a value it is transparent. **Focus keeps the 2px `focusRing` and is the only boundary this control ever draws.** Revised 2026-08-22 (T-215) from the 1px box T-211 shipped, on the owner's own alternative — *"nếu hiển thị nền khác cho dễ nhận biết, ta có thể bỏ border đi"* — which is `border.separation_order` read literally: ground, then space, then a line. **The ground is not the 1.4.11 carrier and must never be treated as one:** `bg.sunken` on `bg.base` measures **1.12:1**, so what identifies the control is the FLD-LABEL above it (or, for the surface's heading, the placeholder and position), and what marks engagement is the ring at 9.56:1 on that ground. **Legal only where a visible FLD-LABEL sits above it or the control is itself the surface's heading.** A failed save paints `dangerTint` instead of `bg.sunken`, under the FLD-ERROR message — never a red edge |
| **FLD-LABEL** | its name | always present, always **above** the field, `font.size.meta` at `font.weight.semibold` in `text.secondary`, `field.label_gap` beneath. **A placeholder is never a label** — it disappears exactly when the reader needs it |
| **FLD-HELP** | the quiet line under it | `font.size.meta` in `text.muted`, `field.help_gap` beneath the field. States a consequence the field cannot ("Dated today, so it sits in Today") |
| **FLD-ERROR** | the loud one | `font.size.meta` in `color.danger`, same gap, **and the field's border turns `danger` too** |
| **FLD-ROW** | the row | `min(100%, measure.form_max)`, `field.row_gap` between rows |
| **FLD-GROUP** | several controls on one line (a date and a time and a Clear) | they share the row and wrap together; none of them takes a fixed px width |

**States:** default · focus (`border.focus` `focusRing` inset **and** the border to `accent`) ·
error · disabled (opacity **and** the border drops to `bg.hairline` — state never travels on
opacity alone) · read-only. **FLD-QUIET has no border to turn**, so it carries each of these on the
ground instead: focus is the ring alone, error is `dangerTint`, disabled is the ground dropped to
nothing with the value in `text.muted`.

**Two signals are allowed here and nowhere else.** § Colour rules 1 forbids a meaning carried by two
things; a form error is the documented exception, because an error the reader misses costs them the
whole form. The message and the border are the pair. Nothing else joins them — no icon, no fill.

**The rule, and its check.** A field has **no intrinsic width**. The HTML `size` attribute and any
fixed px width on an input are forbidden. **Checkable:** inside a form row wider than 320, a field
rendering below `field.min_rendered_width` (240) is a failure.

**No control in a form wears the accent unless it is the form's primary action.** The shipped task
detail painted seven in it — `Clear` twice, three deadline shortcuts, `Set a repeat`, `Add step`.
`accent` means *the assistant*; every one of those is the user's own hand. On the redrawn detail the
only accent is the focus ring and the repeat picker's `Save the repeat`.

---

## PropertyRow — a row showing its value, and the picker it opens (PROP-*)

**Added 2026-08-22 (T-211).** Owner decision:
`docs/reports/owner-decision-2026-08-22-the-detail-is-a-property-sheet.md`.

**What it is.** *A property is a row showing its current value. Tap it and the picker opens.*
`Deadline · Fri 21 Aug · 6:00 PM` — tap, the calendar appears. Not a bordered control sitting open on
the screen waiting to be used.

**Why it exists.** § Field is right for one field and wrong multiplied. `DESIGN.md ## Shape` lists an
input field as one of the three places a 1px line earns its place; the task detail asked for that line
ten times across seven rows plus three segmented groups, with note, priority, deadline, reminder,
repeat and steps still owed and steps growing. **That is the grid the rule exists to remove.** Things 3
draws no boxes at all; Apple Reminders puts N properties in one container; Notion and Linear keep
property rows borderless until hover.

| ID | Element | Rendering |
|---|---|---|
| **PROP-GROUP** | the container | one `bg.sunken` ground at `radius.md`, `space.2` inset. **Not a box** — and the rows inside it are separated by `space.1` and by nothing else. `border.when_a_line_earns_it` case 2 does not reach them: these are four labelled values read one at a time, not columns an eye scans across |
| **PROP-ROW** | the row | `control.height.lg` minimum, `radius.sm`, no border, no fill at rest. Hover and focus paint `bg.base` — a ground on a ground |
| **PROP-LABEL** | its name | `font.size.meta` at `font.weight.semibold` in `text.secondary`. Fixed `7.5rem` column at `480` and above; natural width below, so a phone spends no space on alignment |
| **PROP-VALUE** | the value | `font.size.body` in `text.primary`, and `font.family.numeric` when it is a date, a time or a count. **Wraps; the row grows.** Unset reads the word `None` in `text.muted` — the zero case is drawn, never blank |
| **PROP-FLAG** | a state on the value | a word on its own tint at `radius.xs` (`Overdue` in `danger` on `dangerTint`). The value beside it does **not** change colour: one signal per meaning, and no colour repeating down a chain |
| **PROP-CHEV** | the affordance | a trailing chevron at `icon.size.md` in `text.muted`, `aria-hidden` |
| **PROP-PICK** | what opens | a **layer that floats**. Web: a popover anchored under its own row, `radius.lg` with `shadow.overlay`. iOS / Android: the platform bottom sheet — `radius.xl` on the **top two** corners, 0 on the bottom two, a grabber, a scrim, and it clears the home indicator / gesture bar. A picker too large to anchor is a **centred dialog with a scrim** on web (§ TaskDetail's repeat) |
| **PROP-PICK-DATE** | the date and time control **inside** it, and it is not the same control on all three | see the table below. Added 2026-08-22 (T-215): the sheet was drawn with a browser-default `<input type="date">` on every platform, which is `DESIGN.md ## Platform`'s FAB mistake pointing the other way |

### The date and time control is the eighth place the platforms diverge

`DESIGN.md ## Platform` lists seven forced divergences. This is the eighth, and it belongs on that
list — recorded here because `phase: screens` does not write `DESIGN.md`.

| | Web | iOS | Android |
|---|---|---|---|
| Date | `<input type="date">` inside FLD-GROUP — the browser's own control is the platform's own control here | **`UIDatePicker` wheels.** A column per component, five rows visible, the chosen value in a `bg.sunken` band and set in `font.weight.semibold`, so the selection survives with no colour | **M3 date picker, docked.** Month header with previous / next, a `M T W T F S S` header row, and a `role="grid"` of days at `control.minTarget.android` |
| Time | `<input type="time">` | the same wheel assembly — hour, minute, AM/PM columns | **M3 time input.** Two `bg.sunken` numeral fields at `font.size.title` and a **horizontal** AM/PM selector — one row, `AM` and `PM` side by side, each half `control.minTarget.android` in **both** directions. Laid horizontally 2026-08-22 (T-218): the owner liked this picker and named its vertical selector as the one thing wrong in it. Turning it sideways moves the short axis from height to width, so the 48dp repair it already carried is pinned on the new axis rather than lost — **measured at 390 in `detail-deadline-pick` and `detail-reminder-pick`: `AM` 48×48, `PM` 48×48, the group 98×48.** It is shorter than the 72px numeral fields now, so the row centres it against them rather than stretching it |
| A date that is **one field among several** (the repeat's end date) | the same `<input type="date">` | the **iOS compact date**: a `bg.sunken` pill carrying the date, `aria-haspopup="dialog"` | the **M3 date input**: an outlined field with a trailing calendar icon button |
| Commit | none | none | **none — docked, not modal.** M3's modal date picker carries Cancel / OK and this surface may not draw a commit moment (T-213) |

**Neither wheel nor grid is the accent's.** M3 fills the chosen day with `primary`; here the chosen
day takes the ink fill the repeat editor's weekday toggles already use, because on this surface
`accent` means *the assistant* and a date the user picked is their own hand.

**Both owe a keyboard path, and it is drawn rather than described.** The wheel is
`role="spinbutton"` with `aria-valuetext` — VoiceOver's adjustable, Arrow Up / Down here — because
`Fri 21 Aug` is not a number. The calendar is a `role="grid"` with a **roving tabindex**: arrows move
between days, and Tab enters and leaves the whole calendar in one press. **Measured** on
`task-detail-android.html` at 390, state `detail-deadline-pick`: 35 day buttons, **1 tab stop**.

**Cost, measured and accepted.** The M3 calendar makes the Android deadline and reminder sheets
taller than the `680px` sheet cap — 788px of content — so those two sheets scroll and `Clear` sits
below the fold at rest. It stays reachable by scroll and by Tab. The alternative was painting day
cells under Android's 48dp floor, which is worse.

### The accessibility contract, because this is a custom control

`design-check` reads colour pairs out of tokens and cannot see any of this. Written out per
`.claude/skills/design/accessible-components.md`:

| | |
|---|---|
| **Element** | a native `<button>`. Not a `div` with a role — a button is focusable, keyboard-operable and announced before anyone writes an attribute |
| **Role** | `button`, with `aria-haspopup="dialog"` |
| **Accessible name** | **the row's own text**, computed from its contents and never overridden by an `aria-label`. So the name is `Deadline Fri 21 Aug · 6:00 PM` — what a voice-control user says is exactly what they can see (WCAG 2.5.3), and the current value is announced without a second visit |
| **Value / state** | `aria-expanded` tracks the picker, on the row, in both directions. A row whose property cannot be set yet is `aria-disabled="true"` and states why in its value (`Needs a deadline`, in `attention`) |
| **Keys** | `Enter` / `Space` open, from the native button. `Esc` closes. Inside the picker, `Tab` moves between its controls and arrows move within a group |
| **Focus on open** | moves **into** the picker, to its first control |
| **Focus on close** | returns to **the row that opened it** — never to `<body>`, never to the top of the surface. Dismissing by `Esc`, by the close control, or by the scrim all land in the same place |
| **Announcement** | the picker is a `dialog` with an accessible name equal to the property's name |

### The commit moment is NOT settled here, and that is deliberate

**`F-005 AC-2` saves on blur, and blur is written for a field.** A picker row has no blur in that
sense: it has an **open**, a **choice** and a **dismiss**, and *a dismiss without a choice must not
write*. Which of those is the commit moment is a **specification** question and is open (T-213,
spec-agent). Nothing in this drawing may quietly answer it, so **none of the three new pickers carries
a commit button.** The repeat editor does, and only because `detail-repeat-commit` and
`detail-repeat-cancel` were already in the published testid catalogue — that commit moment is
inherited, not decided here.

### Three openers carry no id, and it is a debt rather than an omission

The priority, deadline and reminder rows are drawn **without a `data-testid`**. Their ids are all
spoken for by controls of a different kind: `detail-priority-control` is a `role="radiogroup"` that a
shipped assertion reads as one, and `detail-deadline-date` / `detail-reminder-date` are `<input>`s a
shipped test drives with `fireEvent.change`. Moving any of them onto a row would leave a green
assertion pointing at something that is no longer the same thing. **The rows are testable through
`detail-field` + `data-field`**, which is how `src/` already enumerates them (one node per settable
field, `getAllByTestId('detail-field')`), and the mockup marks one of them as the exemplar per the
§ ListsMenu convention. If QA needs a direct id on each opener, publishing it here is the first step
and this pass deliberately published none — the briefing's rule was *no testid invented, none renamed*.

---

## TaskDetail — the surface that was never drawn (DET-*)

**Added 2026-08-21 (T-204), for `F-005`.** `src/assistant/web/components/TaskDetail.tsx` shipped its
ids marked *proposed, pending design's `phase: screens`*; **this section adopts them verbatim**
rather than respelling them — 1,362 binding sites in code and tests is the wrong thing to move for a
spelling, and the spellings already follow the catalogue's `{surface}-{control}` convention. Drawn
in `task-detail.html`, `-ios.html`, `-android.html`. IA § S6 records the surface as **web-only for
this phase**; the two phone drawings are the contract parity closes against, not a claim it is built.

**Anatomy, rewritten 2026-08-22 (T-211): this surface is a PROPERTY SHEET, not a form.** Owner
decision `docs/reports/owner-decision-2026-08-22-the-detail-is-a-property-sheet.md`. Nobody fills this
screen and submits it — `F-005 AC-2` saves on blur and there is no Save button — so the drawing that
put ten bordered fields across seven rows plus three segmented groups was answering a question nobody
asked. **Measured: twelve boxes became two.**

A `topbar` carrying only the close affordance and the word `Task`; then, in the pane's content column:

1. **The name, which IS the heading.** `font.size.display`, and an FLD-QUIET control rather than a
   heading plus a field holding the same string — the old drawing carried both, which is two places
   for one fact and one more box. It is a **wrapping, auto-growing multi-line control, not a single-line
   input**: at 390 the live store's own `Gọi nha sĩ đặt lịch khám răng` clipped inside an input at
   display size, and § TaskRow's rule is that a title is never truncated to protect a column.
   **The size was queried and it stays** (2026-08-22, T-218 — the owner raised *"kích thước và căn
   lề"* together and only the alignment was wrong). Measured at 390: **31px / weight 600**, against
   16px body, 13px meta and 11px label, so it is the only display-size text on the surface and the
   squint test resolves to the task's name first. Stepping down to `font.size.title` would put the
   heading 1.56× above body instead of 1.94× and **buys no line back** — the store's longest title
   wraps to two lines at 31 and at 25 alike, measured.
   **Its placeholder is `No name yet`** (2026-08-22, T-218, replacing `Name this task`). This surface
   is reached straight after a task is created by voice — the meta line under it reads *Added just
   now · by voice* — so the placeholder is **the first thing a new task says to its owner**, and an
   instruction to do work is the wrong thing for it to say. `No name yet` states the task's condition
   instead of issuing a command, which is what the standing brief's *simple, soft, easy* asks for.
   It is legal copy on both counts § Buttons binds: it uses **task**, not *item* or *to-do*, and it
   is a plain description rather than a themed replacement for a standard string. **The affordance
   does not depend on it** — FLD-QUIET's ground is what says *type here* and it is painted precisely
   when the field is empty. *`Untitled task` was the alternative and was rejected: it is the common
   spelling (macOS, Notion, Docs) and it reads as a value the task already has rather than one it is
   waiting for.*
2. One `font.family.numeric` meta line (`Added Aug 18 · edited 9:40 PM · 3 steps`). **No rule under it**
   — space separates it from what follows.
3. **Note**, an FLD-QUIET multiline control under a visible FLD-LABEL.
4. **The property group**: four § PropertyRow rows — priority, deadline, reminder, repeat — inside one
   `bg.sunken` ground at `radius.md`, separated from one another by space and by nothing.
5. **Steps**, a list (§ TaskDetail steps below), not a form.
6. **The destructive actions**, last, separated by `space.7` of space rather than by a rule.

**Above `breakpoints.split` it takes the column the task list occupies and the conversation stays
rendered beside it** — one application state placed by CSS, never two states selected by a measured
width (IA § S6).

**AC-1's account of itself.** All seven fields render inline, whether or not they hold a value, each
as an explicit `detail-field` node carrying `data-field`. The mockup marks **one** of them with the
`detail-field` id as the exemplar, the same convention § ListsMenu's `menu-collection-row` uses.

| Field | Label | Controls |
|---|---|---|
| title | **Name** | `detail-title-input` |
| note | **Note** | `detail-note-input`, multiline |
| priority | **Priority** | a § PropertyRow whose value reads `None · Low · Medium · High`. Its picker holds `detail-priority-control` (`role="radiogroup"`) and the `detail-priority-option` exemplar; the chosen option is **weight plus a tick**, so it survives with no colour at all |
| deadline | **Deadline** | a § PropertyRow whose value is the date and time in `font.family.numeric`. Its picker holds `detail-deadline-shortcut` chips (`Today · Tomorrow · Next week`), `detail-deadline-date` · `detail-deadline-time`, the `detail-deadline-collection` FLD-HELP line, and `detail-deadline-clear`. **An overdue deadline is a `danger` word on `dangerTint` beside the value, never a red date** — the date stays `text.primary` (§ Colour rules 3 and 4) |
| reminder | **Reminder** | a § PropertyRow. Its picker holds `detail-reminder-date` · `detail-reminder-time`, `detail-reminder-clear`, and the FLD-HELP line "This is the one that alerts you. The deadline on its own is silent." |
| steps | **Steps** | `detail-steps` wrapping `detail-step-row` (`detail-step-checkbox`, `detail-step-name`, `detail-step-move`, `detail-step-delete`), then `detail-step-add-input` + `detail-step-add-button`. **`detail-step-add-input` is the only way to START a step; `detail-step-add-button` is the COMMIT for one already typed and is not on screen until the input holds text.** Both ids stay published and bound — the two are one action in two moments, not two ways in. Corrected 2026-08-22 (T-215): `detail-blank` forced the demo attribute that reveals the commit, so the phone's emptiest state drew `+ Add a step` and `Add step` side by side with nothing typed. `detail-steps-refused` when the task cannot take them |
| repeat | **Repeat** | a § PropertyRow, and the one whose opener carries an id: the row **is** `detail-repeat-edit` (same element kind, same job — the button that opens the repeat editor) and its value span is `detail-repeat-summary`. On web the editor is a **centred dialog with a scrim**, not an anchored popover: it carries a cadence, an interval, seven weekday toggles, an end rule and a three-date preview, and drawn as a popover it ran off the pane. Picker: `detail-repeat-picker` holding `detail-repeat-cadence`, `detail-repeat-interval`, `detail-repeat-weekday`, `detail-repeat-end` (+ `detail-repeat-until` / `detail-repeat-count`), `detail-repeat-preview` (`detail-repeat-preview-date`, `detail-repeat-preview-collection`, `detail-repeat-refusal`), `detail-repeat-commit`, `detail-repeat-cancel`. `detail-repeat-refused` when the task cannot take one |

**The repeat picker is the one control with preview-then-commit**, because AC-22/23/25 have
outcomes that must be seen before they happen and a save-on-blur control has nowhere to render a
refusal. Everything else on this surface saves on leaving the field. **There is no third model.**

**And that sentence is exactly what T-211 could not leave alone.** Once a property is a row that opens
a picker, "leaving the field" no longer names a moment: there is an open, a choice and a dismiss.
`§ PropertyRow` states the question and refuses to answer it in the drawing; the answer belongs in
`F-005 AC-2` (T-213, spec-agent), and until it lands **no picker in this surface may grow a commit
button** beyond the repeat editor's inherited one.
The preview is a `border.mark` rule with three dates in the numeric face and the collection each
lands in; when a rule refuses an occurrence the rule turns `attention` and the refusals read as
sentences, never as an error.

**Destructive actions sit last, separated by `space.7`** (2026-08-22, T-211 — the rule above them
went the way the others did; space does the work), in the `danger` **outlined** variant and never the
filled one: filled `danger` is the button that *does* the deleting and is legal only inside a
confirmation whose sentence has already named what goes. `detail-delete-button` says `Delete task`;
`detail-delete-series-button` says `Delete every repeat` and renders only for a live series.

### States, and the ones deliberately not drawn

| ID | State | Rendering |
|---|---|---|
| **DET-DEFAULT** | a task with values | above |
| **DET-BLANK** | every field empty | identical structure; every property reads `None`, the two typed controls show their FLD-QUIET boundary because they are empty, and the step region renders its own invitation rather than nothing. **There is no empty state for this surface** — under AC-1 an empty field is the ordinary appearance, not a degraded one |
| **DET-TYPED-AFFORDANCE** | the name and note boundaries forced on | the same surface with FLD-QUIET's boundary shown. It exists **because a hover state cannot be reviewed in a screenshot**: without it, the one thing the owner asked for is invisible to anyone reading a render |
| **DET-OVERDUE** | the deadline is in the past | PROP-FLAG `Overdue` beside a value that stays `text.primary` |
| **DET-PRIORITY-PICK**, **DET-DEADLINE-PICK**, **DET-REMINDER-PICK** | one picker open | § PropertyRow PROP-PICK. Web popover, mobile bottom sheet. **No commit control** — see the section above |
| **DET-LOADING** | the read in flight | § Skeletons SK-DETAIL. It exists because DET-BLANK and a not-yet-read task are otherwise pixel-identical |
| **DET-FIELD-FAILED** | one field's write failed (AC-2) | `detail-field-failure` **on the field**, the typed value kept, `detail-field-retry` beside it, the field's border `danger`. The surface does not close and never silently reverts. Concurrent failures aggregate into one announcement, not N |
| **DET-OFFLINE** | AC-2's third state | § OfflineBanner above, and the field states the refusal. **It is not a queue** — no spinner, no pending badge, no timer, no replay on reconnection |
| **DET-ERROR** | the detail's own read failed | § SurfaceError SE-DETAIL. Takes the **column**, not the frame, so the conversation stays beside it, and the close affordance stays live |
| **DET-DELETED** | AC-4's terminal state | `detail-deleted` — the unsaved text legible in `detail-deleted-text`, a way back in `detail-back-button`, and **no retry**: a retry aimed at a deleted row is dead or a resurrection |
| **DET-STEPS-REFUSED**, **DET-REPEAT-REFUSED** | the task cannot take steps / a repeat | one `attention` line where the region would be. Not an error — nothing failed |

**Not drawn, on purpose, and named so the omission is a decision:** the delete **confirmation**
itself (§ Buttons and the platform table in `DESIGN.md` fix its three platform shapes, and it is
drawn in `specimen.html` plate 09, so drawing it a second time here would give two files an opinion
about one dialog); a **dirty-field-in-flight** state (the save is on blur and completes or fails —
there is no observable third moment); and **§ CarriedNotice's rows on this surface**, which are
drawn in the three shell mockups because the whole point of that family is that it renders on every
surface, including the two the detail mockup does not contain.
