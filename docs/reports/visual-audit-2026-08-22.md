# Visual audit — 2026-08-22

Requested by the owner after they found four defects in one afternoon that three Gate 1.5 lenses,
design-agent and the orchestrator had all passed: an overflow menu 68px from its trigger, a
checkbox flush against its ground, `Complete` beside `Done` in one toolbar, and two adjacent
selected rows fusing into one blob.

**Scope:** 12 mockups, 307 states, web at 1440 unless stated.

## What the machine found

A geometric probe was run over every state of every mockup, looking for the class of defect that
had actually slipped through — **relationships between elements**, not elements themselves.

| Check | Result |
|---|---|
| adjacent painted grounds touching (the fused-blob class) | **0 hits across 307 states** |
| same-role siblings misaligned horizontally | 10 hits, **all false positives** |
| content clipped by an `overflow:hidden` ancestor | 28 hits, **all false positives** |
| stacked blocks whose edges almost align (1–8px) | 120 hits, 47 distinct, **almost all deliberate symmetric insets** |

**The zero is the useful number.** T-251's ground-inset fix holds everywhere, and no other list in
the product has the same defect. That is worth more than it looks: it was the one finding a
machine could confirm.

**Everything else the probe reported was noise**, and two of the categories were noise because the
probe was wrong rather than because the design was right:

- `row-due` was flagged as a jogging column. It is right-aligned text; the probe compared **left**
  edges, which differ because `"Thu 5:00 PM"` and `"Mon 10:00 AM"` are different lengths. Right
  edges all sit at 858. **Probe defect, not a design defect.**
- `.row` was flagged as clipping 80px. That 80px is the swipe-to-delete reveal, positioned off-row
  on purpose below the container breakpoint.
- The 8px edge offsets are **symmetric** (`dl=8, dr=8`) — a nested row inset by `space.2` inside a
  section, which is the intended pattern.

**Conclusion about the method: a geometric probe cannot find what the owner found.** A menu 68px
from its trigger is geometrically valid. `Complete` beside `Done` is semantic. The probe's value is
narrowing where to look, and confirming a fix held — not judging.

## What looking found

Method that worked: render, form a suspicion by eye, then measure that suspicion. Both survivors
below were found that way. One candidate was discarded the same way.

### F1 — two columns of right-hand controls, 11px apart (`task-detail.html`)

The property rows end in a chevron; the step rows below them end in a trash icon. They sit in two
stacked lists on the same column and their control columns **do not line up**:

| | right edge |
|---|---|
| `.prop-chev` (Priority, Deadline, Reminder, Repeat) | **726** |
| step trash icon (Ring at 9…, Check the insurance…, Ask what…) | **715** |

11px is not a spacing token, so this is drift rather than a decision. Two vertical runs of icons
almost aligned is the shape that reads as sloppy without a viewer being able to name why.

### F2 — the Lists drawer has two count columns, 52px apart (`lists.html`)

| row | count right edge |
|---|---|
| Today, Done, Inbox | **810** |
| Home (a personal list) | **758** |

The personal lists carry a persistent `⋯` in the trailing slot and the collections do not, so the
numbers land in two columns 52px apart. **This one is a judgement call, not a defect**: the
trailing-action-pushes-the-count pattern is conventional. But the counts are the thing a user
scans, and scanning them currently needs two eye positions. Reserving the trailing slot on the
collection rows too would make one column, at the cost of empty space.

### Discarded after measuring — recorded so it is not "found" again

The property card looked inset from the content column, suggesting a ragged page edge. Measured:
`.prop` runs 102–734 against a content column of 98–738. **But `.prop` is the row button, not the
card, and its `padding: var(--s2)` is 8px by design.** Wrong element measured; no finding.

## Not covered by this pass

iOS and Android variants beyond the automated sweep; `voice-assistant-view.html`; every non-default
state of `task-detail.html` and `lists.html`; dark theme; breakpoints other than 1440.

---

# Second pass — dark theme, and the states nobody looked at

## Dark theme had never been checked by anything

`grep -i "dark\|theme" .claude/tools/design-check/check-design.mjs` returns **nothing**. The
render tier verifies contrast, overflow, states and testids **in the light theme only**. Half the
product had never been checked mechanically.

**Result of running it: clean.** Every text pair in every one of the 307 states meets the declared
4.5:1 in dark. The 24 hits the sweep reported were all `.dev button.on` — the mockup's own
state-switcher toolbar, not product UI.

**Worth wiring into `design-check` so it stays true** (see T-252, which is already open for a
different blind spot in the same tool).

## F3 — the search mid-query state does not narrow by title (`app-shell.html`)

**This is the significant finding of the pass**, and it is on the state this feature is built
around.

State `search-filtering` carries the query **`bill`** and shows **four rows, of which one contains
"bill"**:

| row | matches "bill"? |
|---|---|
| Send the weekly report to Hanh | no |
| Gọi nha sĩ đặt lịch khám răng | no |
| Pay the electricity bill | **yes** |
| Buy milk | no |

Against `tasks-default` (five rows) **the only change is that the done row disappeared** — which is
`AC-7` hide-completed, a different feature. The dev lens had already flagged the responsible CSS,
`.app[data-search="filtering"] .row.done{display:none}`, as contradicting `AC-2`; what nobody
noticed is that it is the *only* thing the state does.

`AC-2` is **live filtering by title**. `search-no-results` is correct by contrast — query
`meeting`, zero rows.

**Three lenses passed this, and my own briefing to T-225 called it *"the state the product lives or
dies on"*.** The spec lens recorded *"AC-2: search-filtering state shows live narrowing with query
'bill'. Covered."* It verified the state exists, not what it contains.

**The tester lens proposed the assertion that would have missed it.** Asked whether narrowing was
assertable, it answered yes — by counting visible rows. The count does fall, five to four. **A
row-count assertion goes green on this state while three of the four remaining rows do not match
the query.** The check would have confirmed the defect rather than caught it.

Filed as T-258, including the instruction to tell qa-web-agent that the test must assert every
visible row contains the query, not that the count fell.

---

# Third pass — the Talk surface, and what the sweeps are worth

## Scorecard for the method, stated plainly

| approach | real findings |
|---|---|
| four mechanical sweeps (grounds, columns, clipping, edges; dark contrast; header counts) | **0** |
| opening a render and looking, then measuring the suspicion | **3** (F3, F4, F5) |

Three of the four sweeps produced false positives **because the probe was wrong**, each time by
measuring the wrong thing: left edges of right-aligned text; rows inside a `.group` element that
only ever contains its `<h3>`, with the rows as siblings; deliberate off-canvas content read as
clipping. The dark-theme sweep was the one clean run, and its value was a **negative** result.

**The sweeps are worth keeping for confirming a fix held** — the zero on adjacent-grounds proved
T-251 held across 307 states, which no amount of looking could have established. They are not
worth anything for finding defects.

## F4 — the `NEW` badge wears the colour rule 6 retired (10 of 12 mockups)

`DESIGN.md ## Colour rules` 6 retired green/`success`, reasoning that *"the label `NEW` was doing
the work and the hue was decoration"*, and that added values now read in `text.primary` at
semibold.

Measured in `voice-assistant-view.html`: the badge renders `rgb(0,47,167)` on `rgb(230,234,246)` —
accent on accent-tint. `.tag{background:var(--accent-tint); color:var(--accent)}` appears in **10
of the 12 mockups**.

The tell is one line below it: `.tag.edited{background:var(--bg-sunken);
color:var(--text-secondary)}` follows rule 6 correctly. **EDITED obeys and NEW does not, in the
same CSS block.**

**The drift runs the unusual way: the client is right and the drawing is stale.** T-232 corrected
mobile today — `styles.ts:217` now sets `badgeNew` to `text.primary` at semibold with no ground.
Mobile follows `DESIGN.md`; ten mockups do not. Filed as T-259, with the instruction not to
"fix" mobile back.

## F5 — Send is drawn active over an empty field (`voice-assistant-view.html`)

`components.md § Composer` lists the states as *empty* and *with-text (send activates)*. Measured
in the default state: input value `""`, and `.composer-send` has `disabled: false`, no
`aria-disabled`, `opacity: 1`. An implementer reading this ships a Send that appears to work on
nothing. Rule 3 applies too — a disabled control loses opacity **and** its border, so the empty
state needs two signals and currently has none. Filed as T-260.

## Still not covered

iOS and Android variants beyond the sweeps; most non-default states of `task-detail.html`; the
`lists` operation states (rename, recolour, delete-confirm); breakpoints between 390 and 1440.

---

# Fourth pass — the phone, and a correction to the scorecard above

## F6 — on iOS a swiped row loses the front of its title (`app-shell-ios.html` @390)

State `phone-tasks`, the swipe-revealed row: `.row-title` sits at **x = −16** while the row's own
left edge is **16**, so the title starts **32px outside its container** and the front of the string
is clipped by `overflow:hidden`. Every other row on that screen has its title at **64**.

**"Gọi nha sĩ đặt lịch khám răng" renders as "nha sĩ đặt lịch / m răng".** The first word is gone
and the second line starts mid-syllable. This is worse in Vietnamese than the sample looks: the
identifying word is usually first, and the clip lands on stacked diacritics.

Filed as T-261.

## F7 — the same named state draws differently on the three platforms

`phone-tasks` shows that row **swipe-revealed on iOS** and **not swiped on Android or web**. Same
state name, three different pictures.

The a11y suite asserts all three shell mockups declare the same **ids**, and passes — ids are all
it compares. **Nothing checks that a named state shows the same thing on each platform.** That is
how F6 survived: it is not reachable in the two mockups most people open. Filed as T-262.

## Correction to the scorecard

The third pass reported four mechanical sweeps and zero real findings. **That was wrong by one.**

The second sweep flagged `.row` hiding 80px of content and **I dismissed it** as the swipe reveal
being deliberately positioned off-row. The reveal is deliberate. **The clipped title is not** — and
it is F6, found four hours later by opening the render instead.

| approach | real findings | corrected |
|---|---|---|
| mechanical sweeps | 0 | **1 — flagged and then explained away by me** |
| render, suspect, measure | 3 | **5** |

The lesson is not that the sweeps work after all; one true positive in four sweeps is still a poor
rate. It is that **a sweep's output is worth as much scepticism when I dismiss it as when I accept
it** — and I applied scepticism in only one direction.

## Queue hygiene done in this pass

**T-217 cancelled as stale, verified not assumed.** It claimed the repeat editor shows *Never*
pressed while an until-date is displayed. Measured: `detail-repeat` → Never pressed, no date field;
`detail-repeat-until` → On a date pressed, date `2026-12-18`; `detail-repeat-count` → After
pressed, no date field. Consistent in all three.

**T-254 and T-257 annotated: neither is blocked on design.** `assistant-voice-fab` **is drawn** — a
`voice-fab` element carrying that id renders at 390px on iOS, with no `shell-talk-button` at that
width. Both rows can be built against an existing drawing.

## One inconsistency noted but not filed

The seeded task in `task-detail.html` has **Deadline Fri 21 Aug 2026** and repeats **every week on
Thursday** (day-picker T selected; next three occurrences Thu 27 Aug, Thu 3 Sep, Thu 10 Sep;
until Fri 18 Dec). The deadline's weekday and the recurrence rule contradict each other. It is
seed data rather than layout, and low severity — but QA authors read these mockups, and a repeat
rule that disagrees with its own deadline is how a confused test gets written.

---

# Fifth pass — comparing the same state across platforms

F7 suggested a sweep with a confirmed true positive behind it, unlike the first four: **compare
what each named state renders on web, iOS and Android.** Nothing checks this today — the a11y
suite compares **ids** and passes.

It produced three candidates. **One was my own error, and is recorded first.**

## Not a finding — the time format, retracted

The sweep reported iOS showing `Thu 5 PM` / `6 PM` where web and Android showed `Thu 5:00 PM` /
`Fri 6:00 PM`, and I formed a hypothesis about iOS dropping the weekday inside the Today group.

**Re-probed with the mockup's dev toolbar removed: all three render identically** — `Thu5:00 PM`,
`Wed9:00 AM`, `Fri6:00 PM`, `—`, `Fri9:30 AM`. The difference came from the toolbar still being in
the page and narrowing the frame. **No finding.**

(A minor redundancy is real and shared by all three: a row reads `Fri 6:00 PM` under a heading
that already says `Today · Fri, Aug 21`. Consistent across platforms, so a design judgement rather
than a divergence, and not filed.)

## F8 — two Lists states render an empty overlay (`lists-android.html`, `lists.html`)

| state | web | iOS | Android |
|---|---|---|---|
| `delete-confirm` | full copy + button | button label only | **scrim, no dialog at all** |
| `menu-nonempty` | **no menu content** | 6 items | **container present, empty** |

Measured as overlay elements plus visible leaf-text count. On Android `delete-confirm` the screen
dims and nothing is drawn on it; on `menu-nonempty` the `ctx-menu` container exists with the same
leaf-text count as the closed drawer.

**The delete confirmation is the serious half.** Web reads *"Move 5 tasks to Inbox and delete
Work?"* and *"The tasks are not deleted. They move to Inbox, where they were before you filed
them."* That reassurance **is** F-008's delete semantics, and it is what a user needs before
confirming a destructive action. iOS shows only the button `Move and delete`; Android shows
nothing. **Two of three platforms ask for confirmation without saying what will happen.**

Filed as T-263.

## A third design-check blind spot

The tool counts *distinct renderings* per state, so an overlay containing nothing still counts as
distinct — the scrim differs from the base state. **A rule for "an overlay element that renders
with no visible content" catches this whole class**, and belongs with the adjacent-grounds rule
already filed as T-252.

---

# Sixth pass — and the pattern in my own failures

## The empty-overlay sweep: 24 hits, 24 false positives

Having confirmed the class in F8, I swept every state of every mockup at both widths for overlays
rendering with no content. It returned 24 `scrim-with-no-layer` hits across all three
`task-detail` files and `lists.html`.

**All 24 were false.** The layers are drawn; my predicate matched on
`dialog|sheet|menu|popover|modal|confirm|picker|popup` and the codebase names them **`pick`** and
**`over`**. Verified: `detail-priority-pick` has a `v v-pick-priority pick` layer above the scrim;
`lists.html rename` has an `over` layer with 11 text leaves.

The only true hit was `lists.html menu-nonempty` → `ctx-menu` with no content, **already found in
the previous pass by comparing platforms.**

## The pattern, stated plainly

Six sweeps now. The failure is the same every time and it is not subtle:

| sweep | why it failed |
|---|---|
| column alignment | compared **left** edges of right-aligned text |
| clipping | read deliberate off-canvas content as a defect — **and then I dismissed the one true positive inside it** |
| header counts | looked for rows **inside** a `.group` element that only ever holds its `<h3>` |
| empty overlays | matched class names the codebase does not use |

**Every one of them failed because I wrote the predicate from a guess about the markup instead of
reading the markup first.** That is a fixable mistake and I have not fixed it across six attempts.
The cross-platform sweep (F7, F8) is the only one that worked, and it worked because it compared
two renderings of the same thing rather than asserting what the DOM should look like.

## F9 — the colour picker sits two rows below the list it edits

Measured at 390 on all three platforms:

| state | placement |
|---|---|
| `rename` | `rename-form for-work` at **y=410** — replaces the Work row in place; Home follows at 547 |
| `recolour` | Work at 410 → Home at 462 → **`recolour-panel for-work` at 514** |

The picker knows its target — its class is `for-work` — and is simply placed after the wrong row.
**The same file gets the same problem right for rename**, which is what makes this a defect rather
than a choice.

A swatch row captioned *"Colour for Work"* sitting directly under **Home** reads as belonging to
Home; the caption is the only thing contradicting the position, and in a list, position wins.

Filed as T-264.
