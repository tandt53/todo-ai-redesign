# UI/UX Solution — Todo AI

> Giải pháp toàn diện tối ưu cho retention: UI đẹp, UX tiện, animation mượt, gesture thuận tiện. Nền tảng: [03-ui-design.md](03-ui-design.md) (tokens, màn hình). Prototype tương tác: `docs/ui-prototype.html` (artifact "Todo AI — Interactive Prototype"). Mã UC tham chiếu [02-use-cases.md](02-use-cases.md).

## 0. Luận điểm retention

User quay lại một todo app vì **3 vòng lặp**, không phải vì tính năng:

| Vòng lặp | Cơ chế | Thiết kế đáp ứng |
|---|---|---|
| **Capture loop** (nhiều lần/ngày) | Nghĩ ra việc → ghi ngay kẻo quên | Friction ~0: widget/notification action/app mở thẳng Capture; quick-add < 100ms; mic 1 chạm giữ |
| **Do loop** (vài lần/ngày) | Mở app xem việc → làm → tick | Today là tab mặc định buổi sáng; **hoàn thành phải "đã tay"** — animation + haptic là phần thưởng tức thì |
| **Review loop** (1–2 lần/ngày) | Sáng xem hôm nay, tối dọn tồn đọng | Notification 2 nhịp (sáng "3 việc hôm nay", tối "còn 2 việc — dời sang mai?" reschedule 1 chạm); khoảnh khắc "Hôm nay xong 🎉" |

Nguyên tắc cảm xúc: app phải tạo cảm giác **nhẹ nhõm** (relief) chứ không tội lỗi (guilt) — không đếm streak kiểu phạt, không badge đỏ chồng chất; heatmap tuần dịu, ngôn ngữ khen vừa phải.

## 1. Hệ Motion (motion design system)

### 1.1 Tokens

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--dur-micro` | 120ms | hover, press, checkbox tick |
| `--dur-standard` | 200ms | card enter/exit, diff fade-in |
| `--dur-emphasis` | 320ms | chuyển tab, sheet, commit phiên |
| `--dur-celebrate` | 600ms | hoàn thành task, "Hôm nay xong" |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) | đa số chuyển động (decelerate) |
| `--ease-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | card xuất hiện, swipe release, mic pop — tạo "độ nảy" |
| `--ease-exit` | cubic-bezier(0.4, 0, 1, 1) | phần tử rời màn |

Quy tắc: **chỉ animate `transform` và `opacity`** (compositor-only, giữ 60fps); layout animation (collapse chiều cao khi xoá) dùng `grid-template-rows` transition hoặc FLIP; **không animate màu nền của cả list**.

### 1.2 Catalogue chuyển động chuẩn (spec để dev copy)

| # | Chuyển động | Spec |
|---|---|---|
| MO-1 | Card mới vào draft/list | `opacity 0→1` + `scale 0.96→1` + `translateY 8→0`, `--dur-standard`, `--ease-spring`; stagger 40ms/card khi nhiều card |
| MO-2 | Diff highlight (UC-05/06) | nền diff hiện ngay, giữ 1.6s, fade về surface 400ms; badge ●/✎ không fade (đọc lại được) |
| MO-3 | Hoàn thành task | checkbox: vòng tròn stroke chạy 160ms → fill + ✓ scale 0.5→1 spring; text strikethrough chạy trái→phải 200ms (`background-size`); card mờ 60% rồi **collapse height** 240ms; haptic `light` đúng lúc fill |
| MO-4 | Swipe release | thả dưới ngưỡng: spring về 0 (`--ease-spring` 260ms); qua ngưỡng: trượt tiếp theo hướng vuốt rồi collapse |
| MO-5 | Undo toast | slide-up 200ms + progress bar 5s tuyến tính; rời màn slide-down `--ease-exit` |
| MO-6 | Mic press | pop scale 1→1.08 spring + vòng sóng lan (2 vòng, 1.2s loop); waveform bars 5 thanh randomized |
| MO-7 | Assistant đang xử lý | 3 chấm nhảy tại VỊ TRÍ card sắp xuất hiện (không phải spinner toàn màn) — báo trước nơi kết quả sẽ hiện |
| MO-8 | Chuyển tab | màn trượt ngang 24px + fade, `--dur-emphasis`; indicator tab trượt spring |
| MO-9 | Commit phiên (UC-10) | các card "hút" về phía tab Inbox (scale 0.9 + translate hướng icon + fade), stagger 30ms — dạy user "việc đã về Inbox" |
| MO-10 | Hôm nay xong | progress ring 100% + burst chấm nhỏ quanh ring 600ms, 1 lần, không loop |
| MO-11 | Press feedback (mọi phần tử bấm được) | `:active` scale 0.94–0.97, vào tức thì, nhả về bằng `--ease-spring`; nút gradient thêm brightness 1.06 — đảm bảo "phản hồi chạm < 50ms" (§5) |
| MO-12 | Mini burst khi done | 6 hạt màu confirm nổ từ checkbox, 450ms, bán kính 14–21px — phiên bản thu nhỏ của MO-10, cùng physics; kèm cbPop + strikethrough của MO-3 |
| MO-13 | Xoá (swipe trái qua ngưỡng) | trượt tiếp `translateX(-100%)` + **rotate −5°** (cảm giác "vứt đi") + fade, rồi collapse height — phân biệt cảm xúc với done (trượt thẳng, tích cực) |
| MO-14 | Save morph | label đổi "✓ Saved" + pop scale 1.06 (320ms spring) TRƯỚC khi cards bay về Inbox (MO-9) — xác nhận rồi mới chuyển cảnh |
| MO-15 | Quick-add flash | vòng sáng accent lan từ ô input (box-shadow 0→14px fade, 500ms) khi Enter — phản hồi "đã nhận" không chặn nhập liên tiếp |
| MO-16 | Tab icon bounce | icon co 0.78 → nảy 1.14 → 1 (340ms spring) khi chạm tab |

### 1.3 Reduced motion

`prefers-reduced-motion: reduce` → mọi MO-* rút về opacity 80ms; **giữ nguyên** trạng thái đích (strikethrough, collapse) — giảm chuyển động, không giảm thông tin. Haptic vẫn giữ.

## 2. Bản đồ Gesture

| Màn | Gesture | Hành động | Ghi chú |
|---|---|---|---|
| Mọi màn | Giữ mic (FAB/nút) | Push-to-talk | thả = gửi; vuốt lên khi đang giữ = huỷ (như voice chat quen thuộc) |
| List (Inbox/Today) | Swipe phải qua 35% | Done (MO-3) | **Chưa làm, và đang cân nhắc bỏ:** cái checkbox đã là một chạm, còn vuốt là hai giai đoạn. Vuốt phải chỉ đáng khi nó rẻ hơn thứ đã có |
| List | Swipe trái 35% | **xoá luôn** (đã làm 15/08) | Không có bước "lộ menu" như bản vẽ đầu: menu hai nhịp chỉ đáng khi có nhiều hơn một hành động sau cử chỉ, mà nay chỉ còn xoá — "đẩy sang Today" và hoãn đã vào màn chi tiết. Xoá là xoá mềm + Undo nên một nhịp là đủ an toàn |
| List | Long-press 350ms | multi-select (UC-40) | haptic `medium`, checkbox mọi card |
| List | Kéo handle (hoặc long-press rồi kéo) | reorder (`sort_order`) | card nâng shadow + scale 1.02 |
| List | Pull-to-refresh | sync ngay | chỉ mobile |
| Draft card (Capture) | Swipe trái | xoá khỏi nháp (UC-07) | cùng physics với list — học 1 lần dùng mọi nơi |
| Draft card | Tap trường | edit-in-place (UC-09) | keyboard mở đúng trường |
| Card done | Tap checkbox | bỏ done (UC-32) | reverse MO-3 rút gọn |
| Phiên Capture | Vuốt xuống từ đầu màn | thu nhỏ phiên (peek Inbox) không mất draft | như minimize player nhạc |
| Toast undo | Tap / vuốt ngang | undo / dismiss | |

Quy tắc chung: ngưỡng gesture **theo % bề rộng** (không px cứng); mọi gesture có **đường bấm nút tương đương** (a11y + web desktop); hướng swipe nhất quán toàn app (phải = tích cực/done, trái = tiêu cực/xoá).

## 3. Bản đồ Haptic (mobile)

| Sự kiện | Haptic (expo-haptics) |
|---|---|
| Qua ngưỡng swipe | `selectionAsync` |
| Done task | `impactAsync(Light)` |
| Xoá | `impactAsync(Medium)` |
| Bắt đầu/kết thúc ghi âm | `impactAsync(Light)` ×1 / ×2 |
| Auto-commit, Hôm nay xong | `notificationAsync(Success)` |
| Lỗi AI / mất mạng | `notificationAsync(Warning)` |

## 4. UX chi tiết theo vòng lặp retention

### 4.1 Capture loop — "ghi trong 3 giây"
- Cold start < 1.5s vào thẳng Capture; widget iOS/Android + notification quick-action "🎤 Ghi việc" (UC-19).
- Quick-add bar luôn ở trên keyboard; Enter liên tiếp = nhiều task (rapid entry).
- Mic giữ-nói-thả; **vuốt lên huỷ** khi nói nhầm — không cần dialog.
- Sau khi AI đề xuất datetime từ quick-add (AC-31.3): chip đề xuất hiện *dưới* task, chạm để nhận — không bao giờ tự áp.

### 4.2 Do loop — hoàn thành phải sướng
- Today mở mặc định khi có ≥1 việc hôm nay (Capture mặc định khi trống — đúng job của thời điểm).
- Progress ring đầu màn Today: `2/5` — tiến độ thấy được là động lực quay lại tick tiếp.
- MO-3 + haptic là "phần thưởng" chính của app — đầu tư nhất, test trên máy thật.
- Task quá hạn: dịu (dot đỏ + nhóm riêng "Quá hạn (2)") — không nhuộm đỏ cả màn.

### 4.3 Review loop — nghi thức sáng/tối
- **Sáng 8:00** (tuỳ chỉnh): notification "☀️ Hôm nay: Họp team 14:00 +2 việc nữa" → mở Today.
- **Tối 21:00**: "🌙 Còn 2 việc chưa xong — dời sang mai?" → action ngay trên notification: [Dời cả 2] [Xem]. Một chạm dọn bàn — cảm giác nhẹ nhõm, sáng mai list sạch.
- Khi Today = 0: màn "Hôm nay xong 🎉" + heatmap 7 ngày dịu (không streak-guilt) + gợi ý 1 chạm "Xem Inbox (6)".

### 4.4 Empty states có việc làm
Mỗi empty state trả lời "làm gì tiếp": Inbox trống → "Nói việc đầu tiên đi 🎤"; Today trống → kéo từ Inbox/nghỉ; Search không ra → "Tạo task '{query}'" 1 chạm.

## 5. Ngân sách hiệu năng (điều kiện của "mượt")

| Chỉ số | Ngân sách | Cách giữ |
|---|---|---|
| Cold start → Capture tương tác được | < 1.5s | lazy mọi thứ ngoài màn đầu; không chờ network |
| Frame rate khi swipe/scroll | 60fps (không drop khung khi đang kéo) | transform/opacity only; Reanimated worklet trên UI thread (RN) |
| Quick-add → card hiện | < 100ms | ghi local trước, sync nền (ADR-7) |
| Phản hồi chạm bất kỳ | < 50ms có feedback (press state) | pressable scale 0.97 mặc định toàn app |
| Turn AI | skeleton/dots ngay, kết quả < 4s p95 | MO-7; streaming về sau |

## 6. Stack hiện thực đề xuất

| Nền tảng | Animation | Gesture |
|---|---|---|
| Mobile (Expo) | **react-native-reanimated** (worklet, spring vật lý) + Moti cho enter/exit đơn giản | **react-native-gesture-handler** (Pan cho swipe, LongPress) |
| Mobile haptic | expo-haptics theo bảng §3 | |
| Web | CSS transitions/animations theo tokens §1.1 + FLIP cho reorder; View Transitions API cho chuyển màn (progressive enhancement) | Pointer Events (prototype đã demo pattern) |
| Chia sẻ | tokens §1.1 export từ `packages/ui-tokens` (JSON) → cả RN lẫn CSS variables dùng chung | |

## 7. Việc thêm vào lộ trình

1. `packages/ui-tokens`: màu + motion tokens dùng chung (nguồn: 03-ui-design §2 + §1.1 file này).
2. Hiện thực MO-1..5 + gesture swipe cho Inbox (CORE trước, theo ADR-7).
3. MO-3 tinh chỉnh trên máy thật (haptic timing) — 1 buổi riêng, đáng giá nhất cho retention.
4. Notification 2 nhịp (§4.3) — cần UC-26 làm trước.
5. Đo: funnel capture (mở app → task tạo), D1/D7 retention, % task done qua swipe vs nút — telemetry sản phẩm (không phải `ai_requests`).
