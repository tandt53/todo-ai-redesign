# BRIEFING — T-220

- **Task ID:** T-220 · **Agent:** design-agent · **phase:** `system` + `screens` · 2026-08-22
- **Description:** Panels on a canvas, and the two self-checks that were skipped

## 1 · The big layout regions stop being separated by lines

The owner, looking at the web shell:

> *"web vẫn có các line border giữa các layout lớn. Hiện tại gần như tất cả các app đã bỏ các
> border này rồi. Thay vào đó là 1 layout có nền màu nhạt ở dưới cùng, các layout chứa content
> sẽ đặt lên trên có màu nền đậm hơn, giống nhau, bo tròn, và cách nhau 1 khoảng nhỏ."*

**Measured at 1440 on `app-shell.html`, exactly three long structural borders remain:**

| element | side | length |
|---|---|---|
| `header.topbar` | bottom | 1020px |
| `aside.col-panel` | **left** | 820px |
| `div.composer` | top | 419px |

**The pattern replaces all three**, and it uses tokens you already have: the page becomes
`bg.sunken`, each content region becomes a `bg.base` panel on top of it, **same ground as each
other**, rounded, with a small gap between. Linear, Notion, Vercel and the current macOS
sidebars all read this way.

**This narrows a rule you wrote, and the narrowing is the coordinator's error to own.** Your
`border.when_a_line_earns_it` has three cases and the third is *a container holding a different
KIND of thing* — **I suggested that one, and the owner's pattern is the better answer to the
same problem.** So the third case goes, or is rewritten as *panels, not lines*. **Say which in
`tokens.json` and `DESIGN.md`.**

**This is a system change plus screens in one dispatch, deliberately, and here is why that is
allowed here:** the usual rule forbids authoring a system and then building against it in one
pass, because the system has no external standard to meet. **That is not this.** The system is
authored, signed off, and one rule inside it is being narrowed by an owner instruction — the
external standard exists and the owner is it.

**Two things to get right rather than to assume:**

- **A panel's gap is not a margin around everything.** The elevation is what separates them, so
  the gap is small — the pattern reads as *floating*, not *spaced out*. Look at it, do not
  reason about it.
- **The gutter rule you just landed (`16 → 374`) is inside the panel now.** Check it still
  holds against the panel's edge rather than the window's, at every width including 1920.

## 2 · Re-run both self-checks — the last pass skipped them

**Your previous dispatch was interrupted and its return was lost, so neither the visual review
nor the accessibility self-check has a recorded result for anything drawn since.** The owner
noticed and asked for them.

**Run both over the whole current set, not only what this task changes.** Record
`visual_review:` and `a11y_review:` with counts, empty lists included.

**Two things carried from the last recorded a11y run that need re-checking specifically:**

- **Step checkboxes render 20×20 on all three platforms**, under every floor (web 40 · iOS 44 ·
  Android 48). Filed as T-216 and not fixed. **If this pass touches them, fix with a hit area,
  not bigger paint; if not, confirm the measurement still stands.**
- **`detail-repeat-until` shows *Never* pressed while an until-date is displayed.** T-217. One
  of the two is wrong and the drawing does not say which.

**And one question with no recorded answer**, from T-219: the owner said *kích thước và căn lề*.
Alignment was fixed and measured. **Size was never answered** — the title renders 32px against
16 elsewhere. It is the heading and the name of the thing, so large is probably right, **but it
was asked and deserves a sentence.**

## Scope

`tokens.json`, `DESIGN.md`, the `components.md` sections this touches, the nine mockups where
the pattern applies, and `index.html`.

**Web is where the owner saw it. Check whether the pattern is right on iOS and Android too** —
iOS grouped-inset lists are already this shape, Android's M3 is not always. **If a platform
should keep its own answer, say so with the rule that forces it.**

**Nothing else moves:** the property-sheet model, the picker model, radius, the 1920 layout,
ground-instead-of-border, the gutter rule. All settled.

## Success criteria

- **Zero long structural borders between layout regions on web** — give the same measurement
  this briefing did, at 1440 and 1920.
- The narrowed border rule is written down, and says whether the third case is gone or rewritten.
- **`visual_review:` and `a11y_review:` present, with counts** — this is the point of the task
  as much as the panels are.
- T-216 and T-217 either fixed or re-confirmed.
- The title's size answered in one sentence.
- `design-check` green. No testid invented or renamed. `index.html` rebuilt.
