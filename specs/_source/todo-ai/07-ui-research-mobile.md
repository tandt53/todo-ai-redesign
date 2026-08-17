# Nghiên cứu UI Mobile — cơ sở cho hệ visual v3

> Vì sao v2 bị chê xấu, các app tham chiếu làm gì, và hệ v3 rút ra. Mockup v3: `docs/ui-mockups.html`. Nguồn web đã kiểm chứng ở §5.

## 1. Mổ xẻ v2 — vì sao xấu

| Lỗi | Biểu hiện trong v2 | Hệ quả |
|---|---|---|
| **Box-itis** | Mỗi task một card viền + shadow; chip trong card; bubble card; sub-task lồng hộp | Nhiễu thị giác, nặng nề — mắt phải xử lý viền thay vì nội dung |
| **Màu loạn** | Amber (due) + lục (new/save) + đỏ (record) + navy gradient trên nền be | Không có "một màu của app"; mọi thứ cùng hét |
| **Gradient + shadow màu** | Mic, Save, spark đều gradient kèm bóng màu | Thẩm mỹ Dribbble ~2018, đúng kiểu "AI-generated" |
| **Type vô danh** | System sans đều đều, đậm tràn lan | Không có nhịp; đậm khắp nơi = không gì nổi bật |
| **Nền be ấm** | #F4F2EC làm trắng card đục, chip amber lẫn nền | Đục, cũ |

## 2. App tham chiếu — họ làm gì

| App | Điều đáng học |
|---|---|
| **Things 3** (Apple Design Award — chuẩn vàng thể loại) | Task là **row trên nền phẳng, KHÔNG card, không separator** — chỉ whitespace; checkbox tròn mảnh; một màu xanh duy nhất; title chữ **regular** (không đậm); header to đậm; cảm giác "tĩnh" |
| **Apple Reminders / HIG** | Large title chuẩn iOS; row 44pt+; tabular numbers cho giờ; màu chỉ mang nghĩa |
| **Linear mobile** | Kỷ luật monochrome: xám trung tính + MỘT accent; hairline thay viền; depth chỉ dùng cho lớp nổi (sheet/dock), không dùng cho list |
| **Todoist** | Row phẳng, đỏ signature dùng cực kiệm; priority = màu viền checkbox, không phải chip |
| **Amie / Structured** (thế hệ "đẹp mới") | Bạo dạn ở **một** chỗ: type to tròn trịa hoặc dock nổi; phần còn lại rất trắng; empty state là câu chữ lớn, không icon minh hoạ |

**Mẫu số chung:** nội dung là ngôi sao; chrome gần như biến mất; **một** màu accent; đẹp đến từ khoảng trắng + nhịp chữ, không đến từ hiệu ứng.

## 3. Hệ v3 — "Calm list, ink orb"

**Định vị thẩm mỹ:** tờ giấy trắng tĩnh lặng + một quả cầu mực (mic) — voice là chữ ký, không phải màu mè.

1. **Row, không card.** Task = hàng: ○ checkbox 22px stroke mảnh · title 15.5 **regular** · giờ tabular căn phải, màu muted. Không viền, không shadow, không separator — nhịp bằng khoảng trắng. Sub-task thụt 34px, nhỏ hơn.
2. **Monochrome + MỘT accent.** Nền trắng ngà lạnh `#FCFCFA` (dark `#0E0E10`), mực `#16161A`, xám `#8A8A93`, hairline `#ECECEE`. Accent duy nhất **cobalt `#3056F5`** — chỉ cho AI/tương tác (assistant line, link, tab active, reply pill). Đỏ san hô `#E5484D` chỉ khi ghi âm/quá hạn. Lục `#178A50` chỉ là *màu chữ* trạng thái done/new — không bao giờ là nút.
3. **Ink orb** — chữ ký của app: nút mic là quả cầu gần đen (radial nhẹ), icon trắng; ghi âm → chuyển san hô + waveform. Không gradient màu, không bóng màu.
4. **Nút = mực.** Save là pill đen chữ trắng. Premium đến từ tương phản, không từ màu lục.
5. **Diff = flash, không phải hộp.** Row vừa đổi *nháy* nền tint 5–6% (lục nhạt = new, amber nhạt = edited) kèm nhãn chữ nhỏ "new"/"edited", phai sau 1.6s về phẳng. Không còn card viền màu.
6. **Type có nhịp:** Large title 30–34/750/−0.03em; section head 19/700; row 15.5/regular; meta 12.5 tabular; **serif italic chỉ cho khoảnh khắc cảm xúc** (empty state "Just say it.", màn Today-xong) — nét "sáng tạo" duy nhất về chữ, dùng đúng 2 chỗ.
7. ~~**Floating dock** thay tabbar hộp~~ **→ đã thay bằng drawer (2026-08).** Capsule từng được hiện thực (không chứa orb — orb đã sống trong thanh nhập) nhưng bị bỏ sau hai phát hiện: (a) đáy màn thành hai tầng chrome va chạm với thanh nhập — đúng pattern Google Keep đã ship rồi **gỡ bỏ**; (b) đối chiếu Todoist/TickTick/Things/Reminders: không app nào đặt cả ô nhập cố định lẫn điều hướng cùng ở đáy. Drawer chứa được tập đích không giới hạn (lists, tags) và trả trọn mép dưới cho thanh nhập — thứ được chạm nhiều nhất. Depth giờ tồn tại ở orb + drawer (lớp nổi), list vẫn tuyệt đối phẳng.
8. **Assistant = một dòng**, không phải bubble card: `✦ Moved the sync to 2pm…` màu cobalt dưới list.

## 4. Checklist "đừng tái phạm"

- [ ] Thêm viền/bóng cho list item? → dừng lại.
- [ ] Thêm màu thứ tư? → dừng lại.
- [ ] Gradient trên nút? → chỉ radial mực của orb.
- [ ] Chip mới? → thử chữ thường + màu semantic trước.
- [ ] Đậm hoá chữ để "nổi"? → tăng size hoặc thêm khoảng trắng thay vì đậm.

## 5. Nguồn web đã kiểm chứng (2026-08-09)

Tra cứu để xác thực các nhận định ở §2–3 thay vì chỉ dựa trí nhớ. Một số domain (Pratt IXD, Fuselab) bị network policy chặn — đã thay bằng nguồn chính thống truy cập được.

### 5.1 Apple Design Awards — reference đã xác minh trên [developer.apple.com/design/awards](https://developer.apple.com/design/awards/)

| App | Giải | Điều liên quan tới v3 |
|---|---|---|
| **Things 3** | ADA 2017 | Chuẩn vàng thể loại — flat design, palette kiệm, micro-interaction + haptic khi check task ([nguồn phân tích](https://thedigitalprojectmanager.com/tools/things-3-review/), [UI screens](https://www.banani.co/references/apps/things-3)) |
| **Crouton** | ADA 2024 **winner** Interaction | App một-người-làm thắng giải nhờ tương tác tinh, không nhờ trang trí |
| **Arc Search** | ADA 2024 finalist Interaction | App AI-first nhưng UI cực kiệm — AI thể hiện qua *hành vi*, không qua màu mè |
| **iA Writer** | ADA 2025 finalist Interaction | Kỷ luật monochrome + đúng MỘT accent xanh — cùng bài với rule #2 của v3 |
| **Structured** | ADA 2026 finalist Inclusivity | Daily planner được giải nhờ rõ ràng, thân thiện neurodivergent; AI (Foundation Models) chỉ *gợi ý điền task* — AI là enhance, khớp ADR-7 |

Ghi chú xác minh: **Superlist không hề là winner/finalist ADA 2024–2026** (kiểm tra cả ba năm) — giải của họ là web-design ([Awwwards SOTD 7.84](https://www.awwwards.com/sites/superlist), [CSSDA](https://www.cssdesignawards.com/sites/superlist/38913)). Tuy vậy palette của họ — **đen + trắng + MỘT đỏ #D14836** — vẫn là minh chứng độc lập cho rule "monochrome + một accent".

### 5.2 iOS 26 "Liquid Glass" — hệ design mới của Apple (WWDC 2025)

Nguồn: [tổng quan cho designer](https://www.rocketfarmstudios.com/blog/what-you-should-know-about-apples-liquid-glass-design-language/), [developer guide](https://medium.com/@expertappdevs/liquid-glass-2026-apples-new-design-language-6a709e49ca8b), [wireframing với layer](https://mockflow.com/blog/designing-ios-26-screens-with-liquid-glass-design).

- UI chia lớp: background / glass / solid — **depth chỉ dành cho lớp điều khiển nổi** (tab bar, nút), content vẫn phẳng.
- → Thời điểm tra cứu, điều này xác nhận rule #7 bản gốc (dock capsule). Rule #7 sau đó đã đổi sang drawer — xem §3; phần "depth chỉ dành cho lớp điều khiển nổi, content phẳng" vẫn đúng nguyên với drawer.
- Cảnh giác: Apple phải cho user **tắt bớt** hiệu ứng glass qua các bản 26.x vì phàn nàn về độ đọc ([TechCrunch](https://techcrunch.com/2025/12/12/with-ios-26-2-apple-lets-you-roll-back-liquid-glass-again-this-time-on-the-lock-screen/)) — bài học: dùng blur/translucency đúng một chỗ (dock), đừng phủ toàn màn.

### 5.3 Voice UI — pattern "orb" cho app voice-first

Nguồn: [ChatGPT voice mode overhaul](https://www.mindstudio.ai/blog/chatgpt-voice-overhaul-2024), [voice mode 2026](https://justainews.com/companies/openai/chatgpt-voice-mode-explained/), [conversational UI patterns](https://www.aiuxdesign.guide/patterns/conversational-ui).

- Orb toàn màn hình đã thành **ẩn dụ thị giác chuẩn** cho voice AI (ChatGPT, Siri) — chọn orb làm chữ ký của app là đúng ngôn ngữ chung.
- Bài học lỗi của ChatGPT: bản orb đầu **không có transcript** → user không nghe rõ phải thoát voice mode để đọc; OpenAI phải thêm **live transcript ngay dưới orb**. Mockup v3 đã làm đúng từ đầu (marker 8: transcript hiện live khi nói).
- Voice không thay thế touch — **multimodal**: nói để tạo/sửa, chạm để xác nhận/chỉnh. Khớp kiến trúc draft + nút Save của ta.

### 5.4 Xu hướng 2026 — minimalism có chủ đích

Nguồn: [Moburst](https://www.moburst.com/blog/top-mobile-web-design-trends/), [Fuselab 20 trends](https://fuselabcreative.com/mobile-app-design-trends-for-2025/), [UIDesignz](https://uidesignz.com/blogs/top-10-app-design-trends).

- Minimalism 2026 = khoảng trắng rộng + palette kiệm + **một focal point mỗi màn** — không phải "ít phần tử" chung chung.
- Typography lớn/đậm làm việc thay trang trí — nổi bật ở app productivity/AI vì "clarity and trust directly impact retention".
- → Khớp rule #6 (type có nhịp, large title 30–34) và rule #1 (row phẳng, nhịp bằng khoảng trắng).

**Kết luận sau kiểm chứng:** không có nguồn nào mâu thuẫn với hệ v3; hai điểm được củng cố mạnh nhất là *floating dock = hướng đi platform-native iOS 26* và *orb + live transcript = pattern voice chuẩn ngành*. Giữ nguyên mockup v3, không cần sửa.
