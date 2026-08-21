# Design audit — the running app, 2026-08-21

**Task** T-193 · **Agent** design-agent · **Method** drove the running app at
`http://localhost:5173/?qaUser=design-audit-1787320423` with `playwright-cli`, at
390 / 768 / 1024 / 1280 / 1440 / 1920, in Talk, Tasks (Today · Inbox), Task detail,
Settings and the Lists menu, with 5 seeded tasks — plus `app-shell.html` rendered at
the same widths for comparison. Every number below is a `getBoundingClientRect()`
reading, not an estimate. Screenshots under `output/design-audit/`.

**Owner's words:** *"check lại design cẩn thận, các elements sắp xếp khá lộn xộn"*.

**Free check first.** `bash .claude/tools/design-check/run-design-check.sh` → **60 passed,
0 failed, 0 skipped**. Nothing below is something that tool could have caught, and § 3
explains why.

---

## 1. Layout findings, ranked by how bad it looks

### F1 — Task detail: every text field is 197px wide, and the task's own name is clipped
**1440×1000 · surface `detail` · `output/design-audit/16-detail-1440.png`**

Measured, on a 1440px screen:

| Element | Rendered width |
|---|---|
| `.s-detail` (the pane) | 1020px |
| `.detail-col` | 720px |
| **Name input** | **197px** |
| **Note textarea** | **197px** |
| **Add-a-step input** | **197px** |

The Name field shows `Gọi nha sĩ đặt lịch khám` — the task is called
`Gọi nha sĩ đặt lịch khám răng`. **A form for editing a task truncates the task's title
at 1440px, in a pane with 823px to spare.** The value is intact (the input scrolls); what
is broken is that the row above it displayed the whole name and the editor for that name
shows less.

**Cause, located:** the inputs sit inside `<div class="detail-field-control">`, which is
`display:block` and **has no CSS rule anywhere** — not in `src/assistant/web/styles.css`,
not in `components.md`, not in any mockup (grepped, zero hits). The input therefore falls
back to the HTML default `size=20` ≈ 197px and never stretches. It is a class that exists
only in JSX.

This is the ugliest single screen in the app. It is also the one surface in this list
that **was never drawn** (see § 3).

Secondary, same screen: `Clear` ×2, the three deadline shortcut chips, `Set a repeat` and
`Add step` are all rendered in `--primary` violet — **seven violet controls in one form**.
`DESIGN.md ## Colour rules` rule 1 assigns violet to *the assistant / thinking*. Every one
of these is a hand action by the user.

### F2 — The Tasks column stops at 720px and everything to its right is dead
**1140px and up · every non-Talk surface · `11-inbox-1440-content.png`, `12-inbox-1920.png`**

`.tasks-col` is `max-width: 720px` with **no `margin: 0 auto`**, so it is pinned to the
left edge of a pane that keeps growing. The Talk panel is fixed at 420px and does not
absorb any of the growth. Measured:

| Viewport | Tasks pane | `.tasks-col` | Dead gutter | Share of the pane wasted |
|---|---|---|---|---|
| 1024 | 604 | 604 | **0** | 0% |
| 1280 | 860 | 720 | 140 | 16% |
| **1440** | 1020 | 720 | **300** | **29%** |
| **1920** | 1500 | 720 | **780** | **52%** |

At 1920 the app draws a 656px-wide list of five rows and then 780px of nothing before a
1px hairline, then the chat panel. The hairline stops reading as a panel edge and starts
reading as *the page ended and something else began* — in light theme both columns are the
same `bg.base`, so the hairline is the only thing marking the split at all
(`23-light-1440.png`).

The CSS carries a justification for the left anchor — *"The canvas is used by the SPLIT"*
(`styles.css:759`). **Measured, that is false above 1140px**: the split takes a fixed 420,
and every pixel beyond 1140 goes to the gutter.

**This is in the drawn design too.** `app-shell.html` at 1440 measures identically
(pane 1020 / col 720 / talk 420 — `21-mockup-app-shell-1440.png`) and at 1920 identically
(1500 / 720 / 420 — `22-mockup-app-shell-1920.png`). It is not implementation drift.

### F3 — The conversation floats at the top of the panel, 618px above the composer
**1440 and 390 · surface `talk`, with a thread · `13-talk-applied-1440.png`, `18-phone-talk-390.png`**

| Viewport | Last message ends | Composer starts | Gap |
|---|---|---|---|
| 1440×1000 | y=301 | y=919 | **618px** |
| 390×844 | y=301 | y=763 | **462px** |

Two bubbles, pinned to the ceiling, with more than half a screen of nothing under them.
Zalo, ChatGPT and Momo — the three apps `DESIGN.md ## Identity` names as the reference bar
— all bottom-anchor a short thread.

**The mockup gets this right and says why.** `app-shell.html:417–423`:

> *Newest at bottom (§ Message bubbles), so a short thread sits ON the composer rather than
> floating at the top of a tall column with a gap under it. `margin-top: auto` and not
> `align-items: flex-end`, which clips the top of an overflowing scroller.*

Rendered, the mockup's thread sits at y=557–931 with the composer directly beneath it.
The app's `.conv` / `.conv-scroll` (`styles.css:462–463`) carry **no `margin-top: auto`
and no `justify-content: flex-end`**. The implementation dropped the one rule the design
wrote a paragraph to defend.

Related, same column: the app **centres** the idle hero (h3 at y=391, block centre 488 in a
body whose centre is 487) while the mockup pushes it to the bottom with the same
`margin-top: auto`. So the Talk column currently has two different vertical anchors
depending on state, and neither is the drawn one. This is the 340px gap named in the
briefing; the 618px thread version is the worse one.

### F4 — "Add task" is orphaned, and one column has three different left edges
**1440 · surface `tasks`, Today with content · `20-today-row-meta-1440.png`**

Measured x-positions in a single column:

| Element | x |
|---|---|
| Page title `Today` | **84** |
| Section label, task rows, checkbox rail | **32** |
| `1 task left today` | 32 |
| **`Add task`** | **592** (right edge 688) |

`.tasks-head` is a flex row with `margin-left: auto` on the button, so the surface's
**primary action** sits at the far right of the measure with **459px of nothing** between
it and the only other item in its bar. On Inbox, Upcoming and Done it is worse: `showCount`
is `collection === 'today'` (`TasksSurface.tsx:392`), so the count is absent entirely and
the button is alone in an empty 656px bar (`11-inbox-1440-content.png`).

The title indent is the hamburger's fault: `.topbar` pads to 32, the menu button occupies
32–72, so `h1` lands at 84 — **52px right of everything it titles.** Small at 390, obvious
at 1440.

Also in the drawn design: the mockup shows the same orphaned pill (`21-mockup-app-shell-1440.png`).

### F5 — The Lists menu is a phone drawer shown on a desktop, and it dims the panel
**1440 · Lists menu open · `10-lists-menu-1440.png`**

A 320px-wide full-height drawer holding five rows: `Today`, `Upcoming`, `Done`, `Inbox`,
then **~700px of empty** before `Settings` at the bottom. On a phone that is the correct
shape. At 1440 it is a tall empty strip.

Second half: the scrim covers the whole frame including the Talk panel.
`information-architecture.md § 1a` states that above the split S3/S4/S5 *"stack over the
**centre**; the panel is never dismissed by navigating"*. It is not dismissed, but it is
dimmed and unclickable while the menu is open, which costs the panel the permanence that
paragraph is defending. Settings itself behaves correctly — it replaces the centre and
leaves the panel live (`17-settings-1440.png`).

### F6 — The priority mark contradicts the design system, and abuts the task title
**1440 · Today, task with `priority: high` · `20-today-row-meta-1440.png`**

Rendered row text, read from the DOM: `Gọi nha sĩ đặt lịch khám răng!!!6:00 PM`.
Computed `margin-left: 0px` — the glyphs touch the last letter of the title.

`components.md § TaskRow / TR-URGENCY` specifies **a single `!`**, on **`high` only**, and
argues at length against exactly what shipped:

> *AC-9 fixes the vocabulary at **one glyph**, deliberately "not Apple's graduated
> `!` / `!!` / `!!!`" … `high` renders the `!`; `none`, `low` and `medium` render nothing.*

`TasksSurface.tsx:77–81` ships `low: '!'`, `medium: '!!'`, `high: '!!!'` — the graduated
form, on three of four levels. The CSS comment above it (`styles.css:860`) even quotes the
design's reasoning while implementing its opposite.

Note this is **not** the open ownership question in T-169 (whether `low`/`medium` mark at
all). Whatever that answer is, the code disagrees with the document *today*, and reads as
a typo in the user's own task name.

### F7 — Settings is two rows in a 1020px pane
**1440 · surface `settings` · `17-settings-1440.png`**

`Theme` and `About`, ending at y=180 of 1000. This is a content gap rather than an
arrangement defect — there are only two settings — but it is on the list because it is
what the owner sees, and because it inherits F2's left anchor on top of being sparse.

---

## 2. Is the cause the coverage gap? — **No.**

**Five of the seven findings are on `app-shell`, the one feature that IS drawn**, and F2
and F4 reproduce exactly in the mockup at 1440 and 1920. The arrangement is bad mainly
because **nothing is ever measured above 1280** — `tokens.json breakpoints` declares
`mobile 375 · tablet 768 · split 1024 · desktop 1280`, `design-check` iterates that list
and stops there, and at 1280 the dead gutter is only 140px and reads as padding. The
defect is invisible at every width anybody checks and grows 1:1 with the viewport past
1140.

The coverage gap explains **F1 and nothing else** — the task detail is the one surface in
the list that has no drawing at any width, and it is the ugliest.

Two supporting notes:

- `design-check` only tests **horizontal overflow**. There is no underflow or
  dead-space check, so a column occupying 48% of its pane passes 60/60.
- F3 and F6 are **implementation drift**, not design gaps: the mockup and
  `components.md` both specify the right thing and the code does something else.

---

## 3. Which screens are owed, in what order

| # | What | Task | Status |
|---|---|---|---|
| 1 | **A wide-desktop pass on `app-shell`** — decide what 1440/1920 does with the space, then draw it. Fixes F2 and F4 at their source. | **none exists** | **new task needed** |
| 2 | **F-005 task detail (S6)** — web + iOS + Android | **T-165** | PENDING, held behind T-164 |
| 3 | § CarriedNotice bottom placement | **T-179** | PENDING |
| 4 | **F-002 talk-back** — message family, lives inside a drawn surface | none | lower: the frame exists |
| 5 | **F-003 mobile surface** | none; **T-092** (owner feedback on the phone layout) is adjacent and PENDING | |
| 6 | **F-006 trash** | none — spec cleared Gate 1 today, screens not yet owed | |

**Sequencing risk worth naming:** T-165 (draws the F-005 screens) depends on T-152; T-179
(moves § CarriedNotice to the bottom) depends on T-177. They are independent, and the
F-005 screens render CarriedNotice. If T-165 draws it at today's placement and T-179 then
moves it, those screens are redrawn. **T-179 should land before T-165.**

**Row 1 is the one to add.** It is not covered by T-165 or T-179, it is the finding the
owner is actually looking at, and it is a system-level decision (what a wide canvas is
*for* in this app) rather than a per-screen one — so it belongs in `phase: system` on
`components.md § AppFrame` and `information-architecture.md § 1a`, before any more screens
are drawn against the current rule.

---

## 4. What is fine — and one thing that should not be "fixed"

**The split works at the width it was designed at.** At **1024×800** the Tasks pane is
604px and `.tasks-col` fills all 604 of it — **zero dead gutter** — with the Talk panel at
420. Both columns are full, the measure is right, and it looks deliberate
(`15-w1024.png`). Same at **768** (col fills 768, list 720) and at **390**, where the list
uses the whole screen and the `Talk` switch sits in the bar. **390 is the width this
design was actually drawn for, and it is the best-looking state in the app**
(`14-phone-390-talk.png`).

**The vertical emptiness under a short list is correct — do not fix it.** At 1440 with 5
tasks the list ends at y=418 of 1000. That is what Things, Todoist and Reminders all do:
a list is top-anchored and grows downward. Only the **Talk** column's vertical emptiness
(F3) is a defect, because a conversation is bottom-anchored everywhere. The briefing's
opening observation covers both; they are not the same problem, and the answer to the
Tasks half is *nothing*.

**The identity holds.** Dark ground, one violet accent, no gradient anywhere outside the
voice surface, contrast ≥ 4.5:1 mechanically verified across all six mockups. In the list,
one signal carries each meaning: the `OVERDUE` heading is red and the dates under it stay
muted (`21-mockup-app-shell-1440.png`) — the exact duplicate-signal trap
`DESIGN.md ## Colour rules` rule 1 warns about, avoided. Type pairing reads: Space Grotesk
titles against Be Vietnam Pro body, and the Vietnamese diacritics never clip at any width
I rendered.

**The Talk panel width is right.** 420px at 1024, 1440 and 1920 — the ceiling of IA's
declared `360–420px`, and the bubbles read comfortably at it.

---

## 5. What I could not check

- **The voice surface — the whole novelty budget — is unaudited in the running app.**
  Headless Chromium has no microphone, so `listening`, `thinking` and the cyan→violet
  aurora never rendered. That is the one place `DESIGN.md` says all the boldness is spent
  and I saw none of it live.
- **No Applied-diff bubble.** Every utterance I sent returned *"nothing in your list
  matches"*, so `§ AppliedMessage` — the per-field diff and Undo, the mechanism AC-1
  depends on — was seen only in the mockup, never in the app.
- **F-006 trash** is not built; there is no Trash row in the Lists menu.
- **iOS and Android mockups** were not rendered. Web only.
- **One interaction oddity I could not reproduce cleanly:** at 390, clicking
  `shell-talk-button` twice left `data-surface="tasks"` both times (the button took focus);
  pressing Enter on it switched immediately. It may be a tooling artefact. Flagged, not
  claimed — worth 30 seconds from whoever touches the PathSwitch next.
