# Design System — todo-ai redesign · visual language v2

**Replaces v1 ("Aurora, voice-first") completely** — colour, type, spacing, shape and layout. Scope and reason: `docs/reports/owner-decision-2026-08-21-redesign-the-visual-language.md`. **The 52 published element ids are unchanged**; 1,362 places in code and tests bind to them and nobody ever sees a name. Tokens: `tokens.json`. Inventory: `components.md` (**not yet rewritten to v2** — see ## What this invalidates). **Rendered proof: `specimen.html`** — open it by double-click; it covers web, iOS and Android at seven widths in both themes. **Revised 2026-08-22 after the owner looked at the screens** (`docs/reports/owner-decision-2026-08-22-soften-the-language.md`): corners rounded, borders put on a budget, `ultra` given a fourth frame tier. Colour, type and spacing are unchanged — this is an adjustment to the direction, not a replacement of it.

## Identity

- **Anchor:** **Swiss.** White ground, one grotesque, one accent, 1px rules, left-aligned, asymmetric, numerals as composition elements.
- **Why this over the safe pairing:** the safe answer for an AI todo app is what v1 was — near-black with a glowing accent, i.e. a ChatGPT-voice-mode costume. It was drawn, shipped, and the owner asked for a redesign from scratch. Swiss is the opposite move and it is the one territory whose native devices — a rule, a measure, a set numeral — are the *actual content* of a todo list: times, dates, counts, order. The identity and the data are the same material.
- **Rejected directions:** (1) **Organic** — sage/clay/terracotta with 24px radii: reads wellness-app, and its warm-paper neighbourhood is where AI-generated design currently clusters; (2) **Industrial** — pitch black, mono everywhere: a monospace at body size costs legibility on the one thing a todo list is made of, its titles, and it is v1's dark ground again wearing a different accent.
- **Differentiator (the one bold place): the time rail.** Every task row opens with its due time set in the numeric face, right-aligned in a fixed column, with a 1px rule running the length of the list as its spine. A task with no time shows `—`, so the zero case is drawn rather than absent. The rail is why a wide screen is worth having: it widens from compact to wide and gains the weekday, instead of the list growing a dead gutter. Nowhere else does the app use a second face.
- **Reference bar (the audience's daily apps):** **Zalo, Momo, Google Calendar.** Everyday screens sit at home there: white ground, dense legible text, one coloured primary action, chat that looks like chat. Confidence of colour matches Momo; the accent is saturated, and it is always semantic.
- **Product language is English** (`ADR-008`, owner decision 2026-08-17): every shipped string here and in `specimen.html` is English, and the house vocabulary in `components.md § Buttons` binds — *delete*, *task*, *undo*, *put back*, *deadline*, *step*, *list*, *Talk*, *Tasks*. **Task titles are user content and are not English by construction** (the running store holds Vietnamese ones today), which is why the type floors below are set for arbitrary script rather than for English.
- **Light-first**, dark fully tokened. v1 was dark-first because its signature was glow; there is no glow now, and a todo list is read in daylight. Dark is the one place the anchor is relaxed: the surface is a neutral near-black, never warm.
- **Interaction stays boring on purpose:** chat bubbles, a labelled Undo, a destructive button that says what it deletes, standard back and sheet conventions per platform. New identity, familiar behaviour.

## Colour rules (earned colour)

**Minimum contrast ratio 4.5:1** for normal text (AC-19 / WCAG 1.4.3), and **3:1** for any rule or control boundary that carries meaning (1.4.11). Stated as a number because `.claude/tools/design-check` reads the threshold from this file and skips the check when it finds none. Every pair is computed, not eyeballed — ## Contrast.

1. **One signal per meaning.** `accent` = the assistant (mic live, applied change, undo, primary action, focus). `danger` = *this is lost or losing* (delete, overdue, failed write). `attention` = *this needs your answer* (open question, offline, refused value). No colour appears without its meaning, and no meaning is carried by two colours.
2. **Accent text is legal only on `bg.base`, `bg.sunken`, or its own tint token.** Any new pairing is re-verified before use.
3. **State is never colour-only.** `NEW` / `EDITED` text labels ride every diff marker; overdue is a named group heading, not a red date; a disabled control loses opacity *and* its border.
4. **A colour never repeats down a chain.** If the group heading is `danger`, the dates under it stay muted. One alarm per screen region.
5. **The accent set is closed at three, and v1's five are cut to it.** Retired, each with what replaced it: **green / `success`** — rule 3 already forbids colour carrying a diff alone, so the label `NEW` was doing the work and the hue was decoration; added values now read in `text.primary` at semibold against the old value struck through in `text.muted`, which is legible to a colour-blind user by construction. **The `cyan` → `violet` voice pair** — it encoded *user speaking* versus *assistant thinking* as two hues plus a gradient handoff; the gradient is illegal under this anchor, the handoff was never once rendered in the running app (audit § 5), and speaker is already carried unambiguously by side, ground and label in the message list. One accent now means *the assistant*, on both halves of its turn. A fourth accent arrives only with its own meaning written here first — it is never a pick from spare hues.

## Type

**One UI family** (`font.family.ui`, a neutral grotesque) **plus one utility face for numerals** (`font.family.numeric`). Single-family is the anchor's requirement, not a default, and it survives one test v1's pairing did not: **a task title is user content in whatever script the user types**, so the face that sets titles has to hold at body size across Latin with heavy diacritics and beyond — the live store carries `Gọi nha sĩ đặt lịch khám răng` today. A display face chosen for English headings breaks first on exactly those glyphs, at exactly the size the app uses most. Hierarchy comes instead from the 1.25 scale used to both extremes — `mega 49` down to `label 11` — plus weight, case and tracking. The numeric face is legal **only** on times, dates, counts, durations and ids; it is what makes the time rail read as a column of data rather than a column of words.

**Two floors, and neither is negotiable.** Body is never below 16 on any platform: below it iOS zooms the page on focus, and stacked tone marks lose their separation from the letter. Line-height on body text is never below 1.5, for the same reason.

## Shape — corners, and when a line is allowed

**The first pass set every structural component to `radius.none` and argued it at length.** The argument was good and the render disagreed with it: the owner opened the screens and it reads hard. Radius is back as a scale answering one question — **what kind of thing is this?** A line takes `none`. A small painted object — checkbox, tag, `NEW` marker — takes `xs 4`. A **control** — button, field, menu item, nav row — takes `sm 8`. A **ground** — the row's hover ground, card, banner, diff block, message bubble, toast — takes `md 12`. A **layer that floats** — menu, dialog, popover, the web sheet — takes `lg 16`, always with `shadow.overlay`. A bottom sheet's **top two** corners take `xl 28` and its bottom two stay 0. **The scale stops at 16 for everyday surfaces deliberately:** 24 and up is the wellness-app neighbourhood ## Identity rejected by name, and softening the corners is not a licence to move there. Checkable (`radius.nesting_rule`): an inner radius is never larger than its parent's, and a child inset by `n` inside a parent at `r` takes `r − n`.

**Borders: the 1px rule was never the defect — the count was.** Measured on `app-shell.html` at 1920, state `tasks-default`: **13 structural lines and 9 full boxes.** Seven of the thirteen are `border` edges; the other six are the list spine (`.list::before`) and five row separators drawn as 1px `div`s — which is why a source grep reports 46 declarations and the screen shows thirteen lines. Every element had one, so the page read as a grid drawn over the content instead of content with structure in it.

**Separation order: ground, then space, then a line** (`border.separation_order`) — a line only when neither of the first two reads. `bg.sunken` behind a group, or `space.5` around it, separates it without drawing anything.

**Border density: 8 structural lines, 5 full boxes.** Both budgets are **per rendered state per breakpoint**, inside the app frame, and both count **painted lines rather than `border` declarations** (`border.density_rule`) — a declaration count is defeated by moving the line into a `div`, and this system already did exactly that.

- **Structural lines ≤ 8** — a line separating content from content: a pane boundary, a section rule, a row separator, the time-rail spine. **Was 13.** The five row separators are the cheapest five to give back: rows separate by space and a hover ground at `radius.md`.
- **Full boxes ≤ 5**, each on `border.box_allowlist`: a control whose outline *is* the control (checkbox, radio, field, quiet button, idle mic), or a layer floating over another. **Was 9.** A message bubble, a card, a banner and a task row are **grounds**, not boxes. A filled button is a ground too and carries no border.
- The 2px accent left-mark on an assistant message that changed something is **one line, not a box**, and stays.

## Fewest actions — a principle, not a note

**Simple, soft, easy to use, and as few actions as possible** is the standing brief. The last clause is about interaction, which is exactly why a visual pass drops it. It binds here:

1. **Every screen states its happy-path action count** in its mockup header, as ## User journey does below (2 actions). If the count surprises you, redesign the flow rather than the visuals.
2. **A wider screen buys fewer actions, never more.** Any layout tier that adds a control owes an argument. **Tier 4 pays this one:** the next seven days sitting beside today removes the trip to Upcoming — **one action fewer, no control added.**
3. **No confirmation for a reversible act** — a named Undo instead. A confirmation is reserved for what cannot be undone, and it names what it will destroy.
4. **A screen's primary action is never behind a menu.**

## Layout — the rules v1 did not have

**Above `desktop` the app adds a column, never a gutter** (`layout.wide_rule`). Three frame tiers: below `split`, one surface; at `split`, Tasks centre + Talk panel; **at `wide` (1536) and above, a permanent Lists rail joins on the left**. That rail is also the answer to the audit's F5 — a 320px phone drawer holding five rows was being shown on a 1440px screen. **`wide` is 1536 and not 1440 for a measured reason:** 1536 is the narrowest frame where the rail fits without the Tasks list ending up *narrower* than it was one breakpoint below (`rail 240 + list_max 820 + 2×gutter + panel 420`). Set it at 1440 and a user maximising their window watches the list shrink — a regression wearing a feature's clothes. `breakpoints` now declares **eight** widths up to `ultra`; v1 declared four and stopped at `desktop`, which is why 52% of the Tasks pane could be dead at 1920 while every check passed.

**One centring, and it is at the content column** (`layout.content_column_rule`). Each frame column — Lists rail, Tasks pane, Talk panel — holds exactly **one** content column, `min(pane − 2×gutter, its measure token)`, **centred in its pane**. Everything inside a content column is left-aligned and nothing inside it centres again. Leftover width is therefore always symmetric and always at one known level. **This is the single line v1 was missing:** `.tasks-col` was `max-width: 720px` with no `margin: 0 auto`, so at 1920 it left 0 on one side and 780 on the other.

**Two checkable rules follow, and together they are the underflow test `design-check` has never had.** `layout.fill_rule`: for every frame column, measure the leftover on each side of its content column — differ by more than 8px, fail. `layout.coverage_rule`: a column's content must cover at least 90% of its inner width **unless a declared measure token explains the shortfall** (`list_max`, `form_max`, `text_ch`). A capped measure with symmetric leftover is correct and must not be reported; a column that stopped growing with no measure behind it is the defect. Companion (`layout.gap_rule`): two text spans in a row are never adjacent, minimum `space.2` — v1's priority mark computed `margin-left: 0` and touched the last letter of the task title.

## Fields, labels and form rows — defined before anyone draws a form

The task detail shipped 197px input stubs that clipped the task's own title, because `.detail-field-control` was used in JSX and styled nowhere, so the input fell back to the HTML default `size=20`. The system now answers it:

- **Field** — `field.height` 44, `width: 100%` of its form row, 1px `bg.rule` border, `radius.none`, `font.size.body`, `field.padding_x` inset. Focus: 2px `focusRing` inset **and** the border to `accent`. Error: border `danger` plus a `meta` message below it. Multiline starts at `field.height_multiline_min`.
- **Label** — always present, always above the field, `meta` at semibold in `text.secondary`, `field.label_gap` beneath. A placeholder is never a label.
- **Form row** — label, field, then optionally help or error, stacked, `field.row_gap` between rows. The row is `min(100%, measure.form_max)`.
- **The rule:** a field has **no intrinsic width**. `size` attributes and fixed px widths on inputs are forbidden. Checkable: inside a form row wider than 320, a field rendering below `field.min_rendered_width` is a failure.

## Component Library

- **Web (React):** Radix UI primitives + styling generated from `tokens.json`. Carried from v1 for the same reason — AC-19 names 4.1.2 and 2.1.1, Radix ships correct roles and focus behaviour headless, and the visual layer stays fully token-driven. No prebuilt theme kit.
- **Mobile (React Native):** RN primitives + `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`. **Still declared, not installed** — see ## Motion.
- **Icons:** Lucide, stroke 1.5, square cap. No emoji, no unicode glyph standing in for an icon.
- **Fonts:** `font.family.ui` for everything, `font.family.numeric` for numerals. Both resolve through system fallbacks, so nothing on screen depends on a network fetch.

## Platform — where the three diverge, and the rule that forces it

Type, colour, spacing, radius and the accent meanings are **identical on all three**; platform paint never wins over the design system. Five things differ, each because the platform forces it, all drawn side by side in `specimen.html`:

| | Web | iOS | Android |
|---|---|---|---|
| Body size | 16 | **17** — the iOS text baseline, and what Dynamic Type scales from | 16 (M3 bodyLarge); meta is **14** (bodyMedium) |
| Hit-area floor | 40 | **44pt** | **48dp** |
| Back | in-page control | **chevron + label, top left; swipe-back from the edge** | **up arrow in a 56dp top app bar; system back** |
| Sheet | slide-over from the right | **bottom sheet with a grabber, above the home indicator** | **bottom sheet with a drag handle, above the gesture bar** |
| Primary create | button in the header | button in the header — **iOS has no FAB** | **FAB, 56dp, bottom right** |
| Destructive confirm | inline dialog | **action sheet, destructive row in `danger`, Cancel separated** | **M3 dialog, text buttons, destructive on the right** |
| Row delete control | appears on hover / focus-within | **always visible** — a hover-revealed control does not exist on touch | **always visible** |

## Motion

`tokens.json > motion`. Transitions crossfade at `standard` (180ms). **v1's 2400ms aurora breath and its spring curve are retired with the gradient.** The one continuous animation left is the **listening rule** — a 2px accent rule growing linearly along the composer while the microphone is live, and the only thing on screen that moves without the user acting. `prefers-reduced-motion` collapses every animation to an 80ms opacity change and keeps every end state.

**Phase boundary, carried from v1 unchanged:** the mobile motion stack is *declared, not installed* — none of `reanimated`, `gesture-handler` or `expo-haptics` is in `package.json` or `src/`, so mobile ships zero animation and zero haptics today. That is a safe state, not a gap: with nothing animating, a reduced-motion user is already fully served. Whoever adds the first mobile animation owes the reduced-motion collapse and the haptic behaviour **in the same change**.

## User journey (happy path)

Entry: the app opens on Tasks with the Talk panel beside it (at `split` and above) or on Tasks alone (below it). 1. **Tap the mic** → the listening rule grows along the composer, live transcript above it. 2. **Speak** ("team meeting tomorrow at 2") → end-of-speech sends. 3. The assistant's message states the change per field and the row appears in the list carrying `NEW`. **Happy path = 2 user actions.** Undo = 1 more tap, or say "undo" — the single recognised word since `ADR-008` dropped the Vietnamese one.

## Novelty budget ledger

Spent entirely on **the time rail** — the numeric face, the fixed column, the spine rule, and the wide-screen behaviour that widens it. Everything else — rows, bubbles, buttons, fields, menus, empty states — is quiet and instantly recognisable to a Zalo/Momo user. Interaction patterns spend **zero**.

## Contrast — verified pairs (computed, WCAG 2.1 relative luminance)

**Light**, on `bg.base` / `bg.sunken`: `text.primary` 18.58 / 16.62 · `text.secondary` 7.48 / 6.69 · `text.muted` 5.84 / 5.22 · `accent` 10.69 / 9.56 · `danger` 5.88 / 5.26 · `attention` 6.16 / 5.51. Reversed: `text.onAccent` on `accent` 10.69, on `danger` 5.88, on `attention` 6.16; `text.onInk` on `bg.ink` 18.58. On own tints: `accent` on `accentTint` 8.89 · `danger` on `dangerTint` 5.03 · `attention` on `attentionTint` 5.44. Non-text: `bg.rule` on `bg.base` **3.00** (clears 1.4.11); `bg.hairline` is decorative separation only and is never the sole carrier of a boundary.

**Dark**, on `bg.base` / `bg.sunken`: `text.primary` 17.55 / 16.26 · `text.secondary` 8.19 / 7.59 · `text.muted` 6.53 / 6.05 · `accent` 8.24 / 7.64 · `danger` 7.29 / 6.75 · `attention` 10.54 / 9.77. Reversed: `text.onAccent` on `accent` 8.24, on `danger` 6.37, on `attention` 10.54. On own tints: `accent` 6.72 · `danger` 6.47 · `attention` 8.72. Non-text: `bg.rule` on `bg.base` **3.25**.

## What this invalidates, and what is not this dispatch's to fix

`components.md` is **untouched** by this dispatch (2,371 lines, most of it behaviour). The sections whose *appearance* v2 falsifies are listed in the T-202 return; the rewrite belongs to the screens dispatch, done once, with the system settled. The six existing mockups under `docs/design/assistant/screens/` are built from v1 `:root` variables and will fail `design-check`'s token-drift check until they are redrawn — that failure is the correct signal, not a regression.
