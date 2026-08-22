# Design sign-off — the core screens, softened (T-211, 2026-08-22)

## What was shown

Three renders, sent as files and viewed by the owner:

- `output/design-shots/task-detail-detail-default-1280.png` — the property sheet at rest
- `output/design-shots/task-detail-detail-blank-390.png` — the empty task on a phone
- `output/design-shots/task-detail-ios-detail-deadline-pick-390.png` — the picker as an iOS sheet

Plus the whole set as one page: https://claude.ai/code/artifact/11a40376-0bd9-4cef-a74c-c15be143cdeb

## What was asked, and answered

| | Question | Answer |
|---|---|---|
| 1 | *Nhìn 5 giây: bạn có biết đổi deadline thì bấm vào đâu không?* | **"Biết."** |
| 2 | *Ô trắng cho tên và ghi chú chỉ hiện khi trống / rê chuột / đang gõ — đủ rõ chưa?* | **"Đủ rồi. Nếu hiển thị nền khác cho dễ nhận biết, ta có thể bỏ border đi."** |
| 3 | *Đổi hai thứ liên tiếp là mở hai picker — chấp nhận được, hay muốn picker ở lại?* | **"2 picker."** |

**All three answered individually.** Unlike the visual-language sign-off, this one carries a
per-question verdict rather than a general go-ahead.

## What changes because of answer 2

**A typed field gets a GROUND, not a border.** The owner supplied the alternative rather than
just approving the current one, and it is the system's own `border.separation_order` — space,
then ground, then type weight, and only then a line.

**It removes the last two boxes in the state that had the most**: the blank task on a phone
showed a boundary on both the name and the note precisely because they were empty. A ground
says *type here* without drawing four edges.

## What answer 3 settles

**Each property opens its own picker and the picker closes on choosing.** No stay-open tray
walking from property to property. The owner accepted the cost — changing two things means
opening two pickers — for a simpler model on the common case, which is changing one.

**This also removes a question that would have reached AC-2 sideways**: a tray that stays open
across properties has no obvious commit moment at all.

## Two defects the orchestrator found in the same renders, folded into the fix

Neither was caught by the visual review or the accessibility probes, because both are valid
in every mechanical sense.

1. **"Add a step" is drawn twice** on the phone — a `+ Add a step` row and an `Add step`
   button, one action, two affordances. It contradicts the owner's own standing brief.
2. **The iOS deadline sheet holds browser-default date and time inputs**, with Chrome's
   calendar and clock glyphs. On iOS that control is a wheel. The system's own platform table
   says *putting a FAB on iOS is wearing another platform's clothes*; this is the same
   mistake in the other direction.
