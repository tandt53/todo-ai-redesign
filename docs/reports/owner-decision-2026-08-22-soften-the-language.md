# Owner decision — 2026-08-22 — round the corners, cut the borders, fix 1920

**Adjustment to the visual language, not a rejection of it.** The owner opened the redrawn
screens and gave four instructions:

> *"Design dùng element có góc vuông xấu quá, nên bo góc tròn cho mềm mại hơn. Đôi khi
> layout hiển thì nhiều element có border nhiều quá làm xấu cả màn. Về web đặc biệt chú ý
> với kích thước 1920 trở lên, hiện tại nó xấu điên. Giao diện nên đơn giản, mềm mại, dễ
> dùng, ít thao tác càng tốt."*

---

## 1. Corners are rounded

**v2 shipped `radius.none: 0` on everything structural** — rows, cards, inputs, buttons,
sheets, menus, dialogs — with three exceptions. The token file argues it at length as *the
single biggest shape change from v1*.

**The owner has looked at it and it reads hard.** Radius comes back. The scale and where it
applies are design's; **that it applies is not.**

## 2. There are too many borders

**Measured on `app-shell.html`: 46 border declarations, 15 of them a full box around an
element.** v2's rule is *structure is a 1px rule, never a shadow* — sound as a principle, and
**applied at this density it draws a grid over the content.**

**The problem is not the 1px rule. It is that every element got one.** Most of what a border
separates can be separated by space, by ground, or by nothing at all. A boundary should be
drawn where it carries meaning, and the count is the evidence that it currently is not.

## 3. Web at 1920 and above is the worst of it

**Named specifically by the owner, and it is not the gutter** — the previous pass already made
the leftover symmetric (220/220, down from 0/780), and the owner says it is still bad. **So
the measurement was fixed and the look was not.**

**What is actually wrong, from the render:** the list is 820px wide and a row holds a time, a
checkbox and a title. **Roughly half of every row is empty horizontal space**, so the rows read
as stretched hairlines across a very wide screen. Making the gutters even did nothing about
the row itself being nearly empty.

**Fixing that is a layout question, not a spacing one** — a wide screen either gives the row
more to hold, or gives the row less width, or stops being a single list. **Design decides
which; the current answer is the one the owner rejected.**

## 4. The standing brief, in the owner's words

> **Simple, soft, easy to use, and as few actions as possible.**

**The last clause is the one most likely to be dropped**, because it is about interaction
rather than appearance and this is a visual pass. **It stays.** Where a screen can lose a tap,
it should. Write it into `DESIGN.md` as a principle the screens are held to, not as a note.

---

## What is not being reopened

The direction — light ground, one accent, the time rail, three accents down from five — was
signed off on 2026-08-21 and the owner is adjusting it rather than replacing it. **Colour,
type and the wide-tier third column stand unless the ≥1920 answer needs them to move.**
