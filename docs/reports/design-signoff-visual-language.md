# Design sign-off — the new visual language (T-203, 2026-08-21)

## What was shown

The rendered specimen, opened in the owner's browser and published as an artifact:
**9 plates · web/iOS/Android · 7 widths · light and dark**, all switchable in the page.
`docs/design/_shared/specimen.html` · https://claude.ai/code/artifact/ccfa8b32-d693-4ba6-b812-fa65e5a604bb

The three states design-agent named in its `review_guide:` were presented, in its words:

1. **Plate 03** — the task row and the time rail, at 390 and again at 1920
2. **Plate 07** — the three empty states, side by side
3. **Plate 08** — the wide-screen frame, with the red row showing what v1 did at 1920

## What was asked

Verbatim, as the agent wrote them:

1. *Nhìn 5 giây vào plate 03: bạn có thấy ngay việc nào đến hạn trước không, hay phải đọc từng dòng?*
2. *Nền trắng, không bo góc, một màu xanh đậm — cái này bạn có thấy đẹp hơn hẳn bản cũ (nền tối, tím phát sáng) không? Nếu không, nó thiếu gì?*
3. *Bấm qua lại Web / iOS / Android ở thanh trên: có chỗ nào trông giống một app khác chứ không phải app của bạn không?*

## What the owner said

> **"Ok tiếp đi"**

**Recorded exactly as given, and the limits of it recorded with it.** The owner approved
proceeding. **They did not answer any of the three questions individually**, so this
sign-off carries a general go-ahead and no specific verdict on the time rail, on the
light-first ground, or on the platform fidelity.

**This is not treated as silence** — an explicit *ok* was given, and the protocol's rule is
against inferring approval from silence or from a reply about something else. It is treated
as what it is: **permission to draw, without a per-question judgement.**

## What changed as a result

Nothing in the system. The specimen was approved as delivered.

## What this leaves open, named rather than assumed

**Question 2 is the one whose answer would have changed the most.** *"Is white, radius 0 and
one deep blue better than the old dark-and-violet?"* is the whole direction; every screen
drawn from here inherits it. **The owner has seen it and said go, which is a real answer —
but if the direction is wrong, it is wrong across every screen rather than in one place.**

**Reversibility, stated plainly so the cost is known now rather than later:** the direction
is a `tokens.json` swap plus the mockups, for as long as the screens are the only thing
built against it. **Once implementers have styled against v2, it is a re-implementation.**
The cheap moment to change direction is before the screens dispatch that follows this
record, and it closes when that work lands.
