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
A11y: `role=button`; accessible name follows mode/state ("Nhấn để nói" / "Đang nghe — nhấn để dừng" / "Micro cần quyền truy cập"); state via `aria-pressed` + live-region announcements on state change.

### Permission copy — the eight combinations (F-003 AC-2 iOS · AC-3 Android)

Design owns these strings. `src/assistant/mobile/model/permissions.ts` owns only the selection logic — which permission tuple maps to which row — and cites rows by **ID**. Two capabilities have proper names that never vary and are never lowercased mid-sentence: **Micro** and **Nhận dạng giọng nói**. Every body closes on a fixed line, because typing is unaffected in *every* combination (AC-2): denial rows end "Gõ tay vẫn dùng bình thường."; request rows end "Gõ tay vẫn dùng bình thường nếu bạn không muốn cấp quyền."

| ID | Combination | Head | Body (line 1) | CTA |
|---|---|---|---|---|
| **IOS-ASK** | mic + speech both `undetermined` — one message covering both grants, at the first talk attempt, never at app open | Xin phép dùng micro | todo-ai cần quyền Micro và Nhận dạng giọng nói để nghe và ghi lại lời bạn nói. Lời nói được chuyển thành chữ ngay trên máy. | — |
| **IOS-MIC** | mic `denied` · speech `granted` | Micro cần quyền truy cập | Quyền Micro đang tắt (Nhận dạng giọng nói đã được cho phép). Bật Micro trong Cài đặt là micro sáng lại ngay. | Mở Cài đặt |
| **IOS-MIC-UNASKED** | mic `denied` · speech `undetermined` — the mic dialog was refused, so the speech dialog was never reached | Micro cần quyền truy cập | Quyền Micro đang tắt — không có micro thì không nghe được gì, nên todo-ai chưa hỏi đến Nhận dạng giọng nói. Bật Micro trong Cài đặt, lần nói tiếp theo sẽ hỏi nốt quyền còn lại. | Mở Cài đặt |
| **IOS-SPEECH** | mic `granted` · speech `denied` | Micro cần quyền truy cập | Quyền Nhận dạng giọng nói đang tắt (Micro đã được cho phép). Bật Nhận dạng giọng nói trong Cài đặt là micro sáng lại ngay. | Mở Cài đặt |
| **IOS-BOTH** | mic `denied` · speech `denied` | Micro cần quyền truy cập | Cả quyền Micro và Nhận dạng giọng nói đều đang tắt. Bật cả hai trong Cài đặt là micro sáng lại ngay. | Mở Cài đặt |
| **AND-ASK** | `RECORD_AUDIO` `undetermined` — first talk attempt | Xin phép dùng micro | todo-ai cần quyền Micro để nghe và ghi lại lời bạn nói. Lời nói được chuyển thành chữ ngay trên máy. | — |
| **AND-DENIED** | denied, not permanent — the OS will still prompt | Micro cần quyền truy cập | Quyền Micro của todo-ai đang tắt. Chạm “Cấp quyền micro” rồi chọn Cho phép là micro sáng lại ngay. | Cấp quyền micro |
| **AND-PERMANENT** | permanently denied — the OS never prompts again | Micro cần quyền truy cập | Quyền Micro của todo-ai đang tắt và Android sẽ không hỏi lại nữa. Bật trong Thông tin ứng dụng → Quyền là micro sáng lại ngay. | Mở cài đặt ứng dụng |

**Selection key.** Rows are chosen on the full tuple, never on the denied set alone — `denied` and `undetermined` are different facts and the copy distinguishes them. A tuple with **nothing denied** renders no message at all, whatever is still undetermined: mic `granted` · speech `undetermined` is the normal mid-flow state between the two dialogs, not a failure. `undetermined` is never "missing" (permission is requested at the first talk attempt, never at app open). The two tuples not listed are unreachable while the mic is requested first: speech cannot be answered before the mic dialog it precedes.

**CTA.** The label belongs to the row and is not a free choice. **"Cấp quyền micro" promises a prompt, so it appears only on AND-DENIED** — the one row in the table where the OS will still show one. Every other row routes to Settings and says so in words, so the button never over-promises (AC-3).

All four iOS denial rows route to Settings, for two different reasons worth keeping straight. For IOS-MIC / IOS-SPEECH / IOS-BOTH it is because iOS *cannot* re-prompt: once a dialog is answered the OS returns the decision silently. For **IOS-MIC-UNASKED it is a deliberate choice, not a platform limit** — iOS *would* still show the speech dialog here, so a re-request is technically available. We decline it: speech recognition is inert without the microphone, so prompting for it changes nothing the user can perceive and spends the one dialog iOS has left on the wrong question. Settings is the only action that restores the feature. **Consequence for selection logic: on iOS the CTA is `settings` whenever any grant is denied — it must not be derived from "is some grant still askable", which is true in this tuple and yields the wrong button.**

Adjacent, same message family, **not** a permission combination — recognizer present but no Vietnamese pack (F-003 AC-4 = F-001 AC-22's transient case: dimmed with a stated cause, never hidden):
**Chưa có gói ngôn ngữ cho giọng nói** — "Máy có nhận dạng giọng nói nhưng chưa tải gói tiếng Việt, nên tạm thời chưa nghe được. Tải gói trong cài đặt hệ thống là micro sáng lại." + "Gõ tay vẫn dùng bình thường." · no CTA.

## Composer

Purpose: voice + text parity — typed input takes the same interpretation path as speech (AC-17). Text field + MicControl + send. Bottom-docked, `color.bg.raised`, top hairline.

States: empty (placeholder "Nói hoặc nhập việc cần làm…") · with-text (send activates) · focused · listening (interim transcript streams into the field, `color.voice.listening` caret) · restored (preserved words from cancel/interruption/background reappear here — AC-3, AC-26) · offline (input still works — local no-AI path, AC-25) · disabled: **never** (the composer is never locked; pending questions block nothing, AC-11).

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
| QueuedTurnNotice | turn in flight when connection dropped (AC-25): thin note under the UserTurn, "Đang chờ mạng — sẽ gửi lại" | queued · replaying · resolved (notice disappears, outcome renders) |

Empty conversation state: `font.family.display` line "Nói đi, tôi ghi." + one `text.muted` hint line. No fabricated sample messages.

## OptionChip

Purpose: tappable answer to a question — tap sends the option's **literal text as a normal turn** (AC-10, AC-13); a tap binds explicitly to its question's turn. Pill (`radius.pill`), 1px `primary` border, `primary` text.
States: default · hover · focused · pressed · disabled (question resolved — stays visible for history, `text.muted` border) · loading (the sent chip shows the standard sending cue).

## UndoAffordance

Purpose: one-gesture undo of the newest applied turn (AC-5), by tap here or by voice ("hoàn tác"/"undo"). Button inside Applied/executed bubbles: `primary` text + undo icon — violet because reverting is the assistant's own act.
States: default · hover · focused · pressed · gone (a newer applied turn or session close removes it visibly, AC-8 — the bubble keeps a `text.muted` "đã qua" note so history stays honest) · undone (replaced by "Đã hoàn tác" label).
A stale/voice undo outside the window renders AC-6's refusal Outcome — the affordance never fails silently.

## TaskRow (+ AI-change marker)

Purpose: the source of truth (F-001 Purpose) — flat row, `radius.taskRow` 0, no border/shadow; checkbox + title + due meta (`text.muted`, tabular).
**AI-change marker (AC-4):** rows in the current turn's `changed_task_ids` get an uppercase text label — `NEW` (`diff.add`) or `EDITED` (`diff.remove→add` per-field old→new on tap-expand) — plus a one-time tint flash (`addTint`/`removeTint`-family background, hold `diffFlashHold`, fade `diffFlashFade`). Only the turn's own changes are marked — hand edits and other turns' rows never attributed. No raw uuids or draft-ref tokens ever render.
States: default · hover · focused · pressed · done (strikethrough `motion` MO-3, 60% fade) · editing (inline, manual path) · flashing (above) · marker-expanded (diff visible) · empty list state ("Chưa có việc nào — nói đi." + hint).
Manual path: create/edit/complete/delete all doable by touch with zero AI calls (AC-18).

## TaskList

Groups rows by day; hairline section headers (`font.size.label` uppercase `text.muted`). Works untouched when AI is off/erroring/offline (ADR-7). States: default · empty · offline (unchanged — the banner carries the news).

## OfflineBanner

Purpose: no half-running conversation (AC-25) — full-width thin note above the Composer, `bg.raised`, `question` accent text: "Mất mạng — danh sách vẫn dùng được, việc nhập sẽ lưu tại máy." Shows queued-turn count when one is in flight.
States: offline · offline-with-queued (count) · replaying · hidden (online).

## SessionMarker

The idle-auto-close marker (AC-28) — same rendering family as BoundaryMarker; a resumed open session renders **no** marker (resume is visible by the conversation simply continuing). States: closed-idle · closed-with-declines (names them) · none.

## Buttons

Variants: primary (fill `primary`, text `text.onAccent`) · ghost (text `primary`, no fill) · danger (fill `danger`, text `text.onAccent` — confirm-delete contexts only).
States: default · hover · focused · pressed (scale 0.96) · disabled (40% opacity, no pointer) · loading (spinner replaces label, width locked).
Standard copy for standard actions: "Hoàn tác", "Thử lại", "Gửi" — no themed replacements.

## Drawer (carried, pending Open Question 1)

Assumption per spec OQ-1: drawer + full list stay reachable. Carries the existing app's drawer unchanged (active row = 7% `primary` tint — the one legal chrome tint). Not restyled in this feature; flagged for design review when OQ-1 resolves.

---

## Touch — minimum content widths (mobile, F-003 AC-9)

**A different kind of constraint from the platform touch minimums, and deliberately not in the same table.** AC-9's 44pt (iOS) / 48dp (Android) are a *hit-area* rule, satisfied by `hitSlop` without moving a painted pixel. The four numbers below are *content-width floors* — the narrowest the painted control can be carrying its shortest label. **Every one of them already exceeds both platform minimums, so none of them can ever bind the hit-area calculation.** They are layout truth and a regression tripwire; they are never the accessibility argument. Merging the two tables would invite exactly that misreading.

Floors are measured from the rendered iOS mockup and rounded **down** to a multiple of 4. The rounding direction is load-bearing: a floor must under-state, because an over-stated width under-computes the slop a genuinely narrow control would need, and that error fails silently in the safe-looking direction.

| Element (catalogue id) | Min content width | Basis |
|---|---|---|
| `assistant-add-task-button` | **96** | icon + "Thêm việc" at `font.size.meta`, `padding: xs sm` — mockup renders 102.5 |
| `assistant-task-row` | **320** | full-bleed row at the narrowest supported device width; **not** derived from the mockup, which paints 428 at its 430 design width |
| `assistant-undo-button` | **108** | icon + "Hoàn tác" at `font.size.body`, `padding: xs md` — mockup renders 112.4 |
| `assistant-retry-button` | **80** | "Thử lại" at `font.size.body`, `padding: sm lg` — mockup renders 81.9 |

Heights are not published here: they are derived from `font.size` + `spacing` tokens at build time, so a type-scale change moves them automatically and a constant would go stale.

---

## Contrast — verified pairs (AC-19 / WCAG 1.4.3, AA ≥ 4.5:1 normal text)

Computed (not eyeballed) via WCAG 2.1 relative-luminance formula; every pair passed. Dark theme: `text.primary`(17.5/15.8), `text.secondary`(9.0/8.1), `text.muted`(5.6/5.0) on `bg.base`/`bg.raised`; `primary` 7.0/6.3; `voice.listening` 12.3/11.1; `danger` 7.7/6.9; `success`&`diff.add` 11.2/10.1; `question` 12.0/10.8 on base/raised; `text.onAccent` on `primary` 7.0, on `voice.listening` 12.3, on `danger` 7.7; accents on own tints: add 9.3, remove 6.8, question 9.9, listening 10.1, `text.primary` on `primaryTint` 15.6. Light theme: `text.primary` 15.5/16.6, `text.secondary` 7.8/8.4, `text.muted` 5.4/5.8 on `bg.base`/`bg.raised`; `primary` 6.1/6.5; `voice.listening` 4.6/4.8; `danger` 5.3/5.7; `success` 5.0/5.3; `question` 5.5/5.9; white on `primary` 6.5; accents on own tints: add 4.6, remove 4.8, question 5.1, listening 4.8, `text.primary` on `primaryTint` 13.7.
Rule for implementers: accent text is legal only on `bg.base`, `bg.raised`, or its own tint token — any new pairing must be re-verified before use. The `gradient.voice` surface never carries body text; the live transcript renders on `bg.base` beside it, `text.primary`.
