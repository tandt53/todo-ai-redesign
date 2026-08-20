# 12 — Audit mockup v4 đối chiếu app đã ship

> **Mục đích:** danh sách việc để một session khác cầm là làm được ngay, không cần hỏi lại.
> **Đối tượng audit:** [`docs/mockups/v4.html`](mockups/v4.html) và [`docs/mockups/v4-motion.html`](mockups/v4-motion.html).
> **Mốc đối chiếu:** code tại 2026-08-13, sau khi UC-08, 09, 11, 13, 36, 38, 39, 40 đã xong.

Đây là audit **một chiều rồi hai chiều**: phần A–C là *app có, mockup không có*; phần D là *mockup có, app
không có*. Nhóm D quan trọng không kém — một bản vẽ mô tả sai sản phẩm sẽ dẫn người đọc đi tìm đoạn code
không tồn tại, đúng loại lỗi mà [10-ac-audit.md](10-ac-audit.md) đã liệt cho các AC.

**Cách dùng:** mỗi dòng là một việc độc lập. Không có thứ tự bắt buộc, trừ nhóm D nên làm sớm vì nó đang
nói sai.

---

## Mockup v4 hiện có gì

`v4.html` — 00 Foundation · 01 Today · 02 Capture→AI turn · 03 Task detail · 04 Drawer · 05 Empty
(+ 2 bản dark) · 06 Upcoming · 07 Logbook · 08 Search · 11 Sign in ·
12 New list · 13 Data & model · 14 Reminder · 04 What changed · 05 How much colour · 06 The voice orb.

`v4-motion.html` — bảng trạng thái MO-1…16, G-1…9, H-1…6, kèm hai demo chạy được (MO-3 Complete,
MO-15 Quick-add), bản đồ swipe, và ước lượng công.

---

## ⛔ Quyết định 15/08 — KHÔNG vẽ bù nhóm A, B, C

Ba nhóm dưới đây đều là **nợ tài liệu, không phải thiếu tính năng**. Kiểm lại từng mục ngày 15/08: mọi thứ
trong A, B và C **đã có trong app rồi** — Day complete ở `gamification.tsx`, tạo tài khoản ở `auth.signUp`,
câu đang-chờ-mạng ở `TaskListView.tsx:397`, mic bị chặn ở `Composer.tsx`, Logbook phân trang ở
`TaskListView.tsx:590`, dấu việc lặp ở `repeats={Boolean(task.recurrence)}`, handle kéo bước ở `DragList`,
xoá tài khoản ở `AuthView.tsx:156`. Mục duy nhất chưa xác nhận được là **B-4** (AI hỏng 3 lần liên tiếp thì
đổi hẳn câu báo) — grep không ra.

**Chốt: không vẽ bù.** Vẽ lại một màn đã chạy được là chép cái đang có sang một định dạng kém chính xác hơn,
rồi từ đó phải giữ cho hai bản khớp nhau mãi mãi. Chi phí đó đã trả một lần rồi và trả đắt: khung 03 tồn tại,
code trôi khỏi nó, và không ai phát hiện trong nhiều tuần.

**Vậy cái gì là spec cho các màn này?** Chính app. Nó chạy được, lái được, chụp được — và khác bản vẽ, nó
không thể nói dối về chính mình. Mockup từ nay chỉ dùng cho **thứ chưa dựng**, đúng như khung 15 và 16 đang
làm.

Câu trả lời đó có một lỗ hổng hiển nhiên: app thì phải cài, phải chạy, phải bấm mới thấy — trong khi cái tiện
của bản vẽ là mở ra là xem. [docs/screens/index.html](screens/index.html) lấp đúng chỗ đó: 39 ảnh chụp app
thật, gom thành chín luồng, dựng lại bằng `pnpm screens`. Nó giữ được ưu điểm của bản vẽ (mở bằng trình duyệt)
mà không mang theo nhược điểm (có thể nói dối), vì mỗi tấm là app vừa chạy xong. Ảnh chụp TAY thì không được:
nó hết hạn im lặng, đúng kiểu hỏng mà cả tài liệu này lập biên bản.

Điều này **không** miễn cho ba nhóm còn lại:

- **Nhóm D** vẫn phải sửa, và đã sửa xong 15/08 — đó là chiều ngược lại: hình vẽ thứ app không có, tức là
  hình đang nói dối, và một bản vẽ nói dối thì nguy hiểm hơn một bản vẽ thiếu.
- **B-4** cần kiểm lại bằng tay: nếu app chưa có thì nó là *thiếu tính năng* chứ không phải nợ vẽ, và phải
  chuyển sang `04-feature-audit.md`.
- Khi vẽ bất cứ thứ gì mới, phần nào **chưa dựng** phải được dán nhãn ngay trong hình (`.unbuilt`,
  `PROPOSAL — NOT BUILT`), không để trong chú thích. Một mong muốn không dán nhãn thì đọc y hệt một mô tả.

Ba bảng dưới đây giữ nguyên làm **biên bản của lần rà**, không phải danh sách việc.

## A. Màn hình app đã ship, mockup **không có màn nào**

| # | Màn | Vì sao không suy ra được từ màn đã vẽ |
|---|---|---|
| A-1 | **Inbox** | 01 và 05 đều là *Today*. Inbox **không** có thanh tiến độ, **không** có streak, **không** nhóm Overdue/Today. Bố cục thật sự khác, không phải Today thiếu vài dòng |
| A-2 | **Trash** | Ba luật riêng: ô tròn là **dấu tĩnh không phải nút** (một checkbox bấm vào mà không xảy ra gì là nói dối với người dùng), thanh nhập **ẩn hoàn toàn** (không cho thêm việc vào thùng rác), và có nút Restore thay cho các nút thường |
| A-3 | **Snoozed** | Đích riêng trong drawer, mỗi hàng có nút đánh thức. Hàng hiện *giờ sẽ hiện lại*, không phải hạn |
| A-4 | **Một list cụ thể** | Header có nút **EDIT** mà Inbox/Today không có; chấm màu 9px của list |
| A-5 | **Một nhãn cụ thể** | `dest.kind === "tag"`. Việc tạo ở đây **tự mang nhãn đó** — cần thể hiện. Lối vào đã mở 2026-08-14, xem A-5b |
| A-6 | **Day complete** | Today khi xong hết là một màn **riêng**, không phải màn Empty ở 05. Nội dung là "N of M done", không phải "All clear" |
| A-7 | **Tạo tài khoản** | 11 chỉ có Sign in. Màn đăng ký khác copy và khác nút chính |

### A-5b. ✅ Màn nhãn nay đã có đường dẫn tới — xong 2026-08-14

> Phát hiện 2026-08-14 khi chụp màn cho phần A, sửa cùng ngày. Ghi lại vì đây là loại lỗi dễ mất
> nhất: nó không gãy, không test nào đỏ, và không hiện ra ở màn nào để mà nhìn thấy.

`dest.kind === "tag"` đã dựng **đủ** trong `@todo-ai/core` từ lâu — `tasksForDestination`,
`destTitle`, `defaultsForDestination`, `acceptsInput` đều xử lý nó. Điểm khiến nó đáng tồn tại như
một *đích* chứ không chỉ là bộ lọc: **việc tạo trong màn đó tự mang nhãn đó** (đứng trong `#chợ` gõ
"mua bánh mì" thì task mới tự có `#chợ`, không phải gõ lại).

Nhưng **không app nào có lối vào**: ở cả web lẫn mobile, nhãn được vẽ ra dưới dạng chữ tĩnh, và
không có `grep` nào ra `kind: "tag"` trong hai thư mục app. Màn này chỉ tới được bằng cách tự dựng
object `Destination` trong code.

**Đã sửa:** nhãn nay là nút ở cả bốn chỗ nó xuất hiện — hàng trong danh sách và màn chi tiết, mỗi
app hai chỗ. Chạm vào là mở màn của nhãn; ở màn chi tiết thì đóng luôn màn đó, vì mở màn nhãn mà để
chi tiết nằm đè lên thì cú chạm không dẫn tới đâu cả.

Hình dáng nhãn **giữ nguyên** — vẫn xám, vẫn nhỏ, không viền không nền. Một danh sách có năm cái
chip cobalt sẽ phá luật "trang trí không được thắng nội dung"; chỗ duy nhất nó tự nhận là bấm được
là con trỏ và lúc hover.

Có một ca E2E giữ cho lối vào này tồn tại (`e2e/core.spec.ts`), kiểm cả phần "tạo ở đây thì tự gắn
nhãn" — phần dễ mất nhất nếu sau này ai đó đổi màn nhãn thành một bộ lọc.

## B. Trạng thái / lớp phủ chưa vẽ

| # | Thứ | Ghi chú |
|---|---|---|
| ~~B-1~~ | **Rỗng vì bộ lọc** | ✅ **Xong 2026-08-13** — khung 09b. "14 tasks are here — none of them fit the filter you set." + "Clear the filter" trong chính câu đó, kicker đổi thành `Filtered · 0 of 14` |
| B-2 | **Câu đang chờ mạng** | "2 sentences are waiting for a network — the AI will re-read them when you are back online" (AC-13.2). Nói như một *sự thật*, không phải cảnh báo: việc đã lưu rồi |
| B-3 | **Hội thoại tự đóng** | "Conversation closed. What you say next starts a new task." (AC-11.2) |
| B-4 | **AI hỏng 3 lần liên tiếp** | Câu báo đổi hẳn (AC-25.2). Kèm cả hai câu riêng cho *hết quota hôm nay* và *quá 15 giây* |
| B-5 | **Mic bị chặn** | Orb **mờ mà vẫn còn** + câu chỉ chỗ mở khoá. Trình duyệt không mở được bảng quyền của chính nó nên phải nói bằng chữ (AC-23.2) |
| B-6 | **Sửa tên tại chỗ** | Giữ lâu trên tiêu đề → ô nhập ngay trên hàng, không rời danh sách (UC-09) |
| B-7 | **Sync, đủ các trạng thái** | 04 mới vẽ "Synced just now". Thiếu: *đang đẩy N*, *hỏng — bấm để thử lại*, *có dòng server từ chối* |
| B-8 | **Logbook phân trang** | "Xem thêm" sau mỗi 40 việc |
| B-9 | **Không có lựa chọn nào để bấm** | 02 vẽ pill trả lời, nhưng chưa vẽ ca **model không nêu lựa chọn** → **không vẽ nút nào**, chứ tuyệt đối không quay lại Yes/No |

## C. Điều khiển app đã có, mockup không vẽ

| # | Thứ | Ghi chú |
|---|---|---|
| ~~C-1b~~ | ~~**Khung 09 và 10 vẽ màn không tồn tại**~~ | ✅ **Xong 15/08** — hai khung gỡ khỏi `v4.html`, thay bằng một callout ghi đủ lý do từng bước bỏ (kèm số đo 572px→108px và phép đếm chạm N so với N+2). G-4 trong `v4-motion.html` đổi từ "Diverged" sang "Dropped" |
| ~~C-1~~ | ~~**Bảng VIEW đầy đủ**~~ | ⛔ **Vô hiệu 15/08.** Từng đánh ✅ ngày 13/08 ("đã vẽ lại khung 09 đối chiếu thẳng `FilterPanel`") — nhưng chính khung 09 đã bị gỡ ở C-1b, cùng lúc tính năng bị bỏ. Hai dòng trong cùng một bảng đá nhau suốt hai ngày. Không còn việc gì ở đây |
| ~~C-2~~ | ~~**Đặt chu kỳ lặp**~~ | ✅ **Xong 15/08** — khung 03 nay có hàng `Repeats` là một ô gõ thật, và khung 14 vẽ đúng trạng thái đang gõ kèm câu máy nói lại điều nó hiểu (`Understood as 13:30 today`) |
| ~~C-3~~ | ~~**Dừng chuỗi lặp**~~ | ✅ **Xong 15/08** — `Stop repeating` nằm trong khối cuối khung 03, cùng chỗ với `Delete task`, vì cả hai đều phá huỷ. Nhịp xác nhận thứ hai và câu "các bản đã xong vẫn ở Logbook" đã có trong code |
| C-4 | **Dấu ↻ trên hàng** | Việc lặp phải nhìn ra được từ danh sách |
| C-5 | **Handle kéo sub-task** | 03 vẽ các bước, không vẽ chỗ cầm (≡). Không dùng giữ-lâu ở đây: trong một hàng bước thì checkbox, ô tên và nút xoá cách nhau chưa tới một đầu ngón tay |
| C-6 | **Quyền riêng tư & xoá tài khoản** | 13 mới có Export / Import / Sign out. Thiếu: câu chính sách 90 ngày, **"Delete conversation history"**, và **"Delete account"** hai nhịp (UC-28) |
| ~~C-7~~ | ~~**Ảnh đính kèm (UC-51)**~~ | ✅ **Đã vẽ 15/08** — khung 15 `Photos on a task`. Ba trạng thái trong một dải (có · đang lên · kẹt), vì trạng thái thứ ba mới là chỗ code hay sai. Còn treo trong chính bản vẽ: hàng danh sách có nên cho biết task mang ảnh không |
| ~~C-8~~ | ~~**Màn lịch cho việc lặp**~~ | ✅ **Đã vẽ 15/08** — khung 16 `Month view`. Chấm ĐẶC = hàng thật mở được; chấm RỖNG = lần lặp chưa tồn tại, tính ra từ luật. Hai câu còn treo được ghi thẳng vào bản vẽ: chạm vào hàng mờ thì làm gì, và lịch là đích riêng hay một cách nhìn khác của Upcoming. Bản cũ: Hôm nay chỉ tồn tại một lần đang mở nên không xem trước được các lần sắp tới. Đã chốt là KHÔNG đổi mô hình dữ liệu — vẽ bằng cách tính ra từ luật lặp, ngày chưa tới hiện dạng mờ. Xem lý do đầy đủ ở UC-39 §Quyết định còn treo. Cùng nhóm với C-7: **vẽ trước, code sau** |

## D. Mockup vẽ thứ app **không** có — sửa sớm

| # | Mockup nói | Thực tế | Nên làm gì |
|---|---|---|---|
| ~~D-1~~ | 09: **Show · All / Open / Done** | Cố ý chưa làm. Inbox/Today/Logbook/Trash **đã là** các đích theo status | ✅ **Xong 2026-08-13** — đã bỏ khỏi bản vẽ, kèm callout giải thích vì sao không làm |
| ~~D-2~~ | 09: kicker **"Filtered · 3 of 14"** | Chưa có. App chỉ hiện chip điều kiện, và chỉ nói số khi list rỗng | ✅ **Xong** — giữ lại nhưng **dán nhãn rõ là đề xuất**, không phải mô tả. Vẫn nên làm thật |
| D-3 | 14: shortcut + bánh xe chọn giờ | App dùng **ô gõ ngôn ngữ tự nhiên**, cùng khuôn với Due và Repeats | Quyết một lần: hoặc vẽ lại theo ô gõ, hoặc chấp nhận có **hai cách** nói một thời điểm và ghi rõ vì sao |
| D-4 | 13: **Model · Sonnet 5** | Không có chỗ đổi model trên UI; model đọc từ bảng `ai_config` phía server | Bỏ dòng đó, hoặc mở UC mới cho việc đổi model |
| D-5 | 02: **"4 turns left today"** | Quota có thật (200 lượt/ngày) nhưng **không hiện số còn lại** ở đâu | Đáng làm — người dùng chỉ biết mình hết quota lúc bị chặn |

## E. Riêng `v4-motion.html`

Bảng "What is actually built" ghi ngày 2026-08-13 nhưng **đã lạc hậu trong chính ngày đó**:

- **G-4** ("long-press → multi-select: Diverged") vẫn đúng về multi-select, nhưng **giữ lâu nay có thật** —
  nó là cử chỉ đổi tên tại chỗ (UC-09). Bảng đang ngụ ý app không có long-press nào.
- **MO-5** ("Undo toast") cần sửa mô tả: thanh Undo trên mobile đã chuyển lên **trên** thanh nhập, vì ở dưới
  nó lọt vào vùng home-indicator và **bấm không tới** — thử ba lần ở ba độ cao đều trượt trong khi thao tác
  xoá vẫn đứng nguyên.
- **MO-9 / MO-14 / G-8 / G-9** đánh dấu "Stale — describes removed UI" là đúng, và nay có chỗ dẫn chiếu:
  sơ đồ §5.4 trong [01-architecture.md](01-architecture.md) đã được sửa để bỏ trạng thái `COMMITTED`.

Nếu dùng bảng này làm kế hoạch thì cho nó chạy lại một lượt trước.

---

## Đã làm

| Ngày | Mục | Ở đâu |
|---|---|---|
| 2026-08-13 | **Đồng bộ hai bản vẽ** — orb đã chốt ở `v4.html §06` đưa vào cả 11 khung của `07-conversation.html`; `v4.html` thêm ghi chú đầu trang nói Today không còn là màn đầu (ADR-11). `_vision.css` **cố ý không đụng**: nó phục vụ `vision-voice-first.html`, bản pitch đã bị bác, và bản đó nên giữ đúng hình dạng lúc bị bác | hai file mockup |
| 2026-08-13 | D-1, D-2, C-1, B-1 | `v4.html` §02 khung 09 + 09b, kèm callout phân biệt *đề xuất* với *mô tả* |
| 2026-08-13 | E — G-1 | `v4-motion.html`: chạm-bật/chạm-tắt là hành vi đúng của sản phẩm; **`06-uiux.md §2` mới là chỗ phải sửa**, không phải code |
| 2026-08-14 | Nền §00 | Áp vào **code**, cả web lẫn mobile: hàng 48, chữ hàng 16/400, thang 6 cỡ, checkbox 24 + chuỗi 340ms, gutter mobile 20 |
| 2026-08-14 | Theo bản vẽ | Orb gradient + trường sóng; ngày xuống dưới tiêu đề; Today tách nhóm Overdue/Today; quá hạn thành chữ ("2d late"); tiến độ chia đoạn ≤ 12; streak vào dòng tiến độ; scrim + blur |
| 2026-08-14 | A-2, A-3 | Trash: ô tròn thành **dấu tĩnh** (`readOnly`) — trước đó bấm được và đánh dấu "xong" cho việc đã vứt. Snoozed: hàng hiện **giờ quay lại** |
| 2026-08-14 | Q-1 | Bỏ nút EDIT; chạm tiêu đề màn list để sửa list. Nhóm nút xuống dòng được (nhờ `flex: 1 1 auto`). Mobile đưa về cùng bố cục header với web |
| 2026-08-14 | A-5b / Q-2 | Nhãn thành nút ở cả bốn chỗ (hàng + màn chi tiết, mỗi app hai chỗ) → mở màn `kind: "tag"`. Kèm một ca E2E giữ cho lối vào tồn tại |
| 2026-08-14 | Quyết định UC-36 | Các bước **không** hiện ở danh sách nữa, chỉ thấy khi mở task. Hàng cha mang **vạch dọc** (xanh = xong), quá 12 bước quay lại con số |
| 2026-08-15 | Vẽ C-7 và C-8 | Thêm khung 15 (ảnh đính kèm) và 16 (lịch tháng) vào `v4.html`. Hai khung "vẽ trước, code sau" cuối cùng trong danh sách |
| 2026-08-15 | Sửa bản vẽ nói sai | Khung 03 vẫn ghi "priority là chữ, urgent màu hổ phách, không bao giờ san hô" — trái hẳn code từ 15/08. Và **mọi** header trong bản vẽ viết ngày TRƯỚC tiêu đề rồi lật lại bằng `column-reverse`: nhìn thì đúng, thứ tự đọc thì ngược, nên screen reader nghe ngày trước tên màn. Nay markup theo đúng thứ tự đọc, không cần lật |
| 2026-08-15 | Upcoming bắt đầu từ mai | Gỡ nhóm "Today" và "Overdue" khỏi Upcoming — cả hai đã có trên màn Today, và vẽ lại ở đây tạo ra hai màn nói ngược nhau về cùng dữ liệu (Today xếp tay, Upcoming xếp theo đồng hồ). Kéo theo lỗi `formatDayHeading` suy nhãn từ vị trí mảng: ô đầu ghi "Today" trong khi nó là ngày mai |
| 2026-08-15 | Dọn bản vẽ | Gỡ khung 09 (bảng VIEW) và 10 (Select mode) khỏi `v4.html` — cả hai mô tả tính năng đã bỏ. Thay bằng callout ghi đủ lý do, để lần sau không ai đề xuất lại. G-4 trong `v4-motion.html` đổi "Diverged" → "Dropped" |
| 2026-08-15 | Trash nói còn mấy ngày | Chính sách 30 ngày trước chỉ nói ở màn RỖNG — đúng lúc không có gì để áp dụng. Nay mỗi hàng hiện `29d left`. Số ngày thành hằng `TRASH_DAYS` một chỗ, thay cho một mặc định trong chữ ký hàm cộng một câu gõ tay |
| 2026-08-15 | **Vẽ lại màn chi tiết** | Code đã trôi rất xa khỏi khung 03 và không ai quyết định điều đó cả — nó tích tụ. Bốn thứ, theo mức thiệt hại: (1) Due / Remind me / Repeats là ba ô gạch chân giống hệt nhau, không nhãn, và **mỗi ô hiện giá trị hiện tại dưới dạng placeholder** — nên việc CÓ hạn hiện đúng màu xám như việc KHÔNG có, và không gì nói trong hai dòng "Tomorrow" giống nhau thì dòng nào kêu. (2) `Stop repeating` màu san hô nằm GIỮA màn, trên cả priority; `Delete task` nằm chỗ khác nữa — hai thứ không lấy lại được, rải hai nơi, đều nằm trên đường mắt đọc. (3) Ghi chú — thứ là nội dung của màn — bị đẩy xuống dưới tag và dưới một ô nhập, cao cố định 140px nên chừa một lỗ trống trên Subtasks. (4) `Ask AI to change this…` là ô trần, nên **màn duy nhất dành cho việc sửa task lại là chỗ duy nhất trong app voice-first không nói được**. Nay: hàng nhãn/giá trị 46pt trên nét kẻ, khối nguy hiểm gom sau một nét kẻ ở cuối, ghi chú ngay dưới các dòng dữ kiện và tự giãn theo chữ, và thanh composer thật (kèm orb) neo đáy. Bản vẽ được bổ sung hai khối nó còn thiếu — tag dưới tiêu đề, và khối động tác hiếm/không lấy lại được |
| 2026-08-15 | **Màn chi tiết, lượt hai** | Lượt một sửa cấu trúc nhưng GIỮA màn vẫn không có hình dáng gì. Đo ra thì rõ: **bảy phần tử cùng cỡ 12.5–13.5px, cùng một mã màu xám `#8a8a93`** — mà là ba loại thứ khác hẳn nhau (hai đoạn văn giải thích · một điều khiển chọn mức · ba nút bấm). Bốn sửa: (1) **Ưu tiên thành HÀNG THỨ TƯ của khối dữ kiện** — nó là một dữ kiện của task đúng như ngày hạn, và vẽ khác đi là thứ để ba chữ trần lơ lửng giữa màn, ở 13px tức là NHỎ HƠN cả nhãn mà nó đáng lẽ ngang hàng. Xếp tăng dần Low→Normal→Urgent cho cùng chiều với icon ba vạch, mức chọn rơi đúng cột giá trị của ba hàng trên. (2) **Cảnh báo "hạn không kêu chuông" bỏ khỏi đoạn văn, đưa vào chính ô rỗng của hàng Remind me** (`None — won't alert you`): câu trả lời nằm ngay dưới ngón tay sẽ sửa nó, và không tốn một dòng chữ vĩnh viễn. (3) **Move to Today / Snooze thành nút pill** đặt ngay dưới khối chúng thay đổi — cả hai đều dời task trong THỜI GIAN. Trước đó chúng nằm chung khối với `Delete task`: gom theo "hiếm" nên đặt hai động tác vô hại ngay trên một động tác không lấy lại được, cả bốn cùng một sắc xám. (4) Câu giải thích việc lặp chỉ hiện **cho tới khi chuỗi thật sự quay vòng một lần** — sau đó người dùng đã tự thấy. Kèm: khối nguy hiểm nay hiện cả với việc ĐÃ XONG (trước bị ẩn, nên một việc đã xong không còn đường nào xoá bằng nút, chỉ còn cú vuốt — mất hẳn với bàn phím và screen reader); lưới hàng dữ kiện gộp còn ba cột nên giá trị mọi hàng thẳng đúng một mép phải; nhịp dọc về lưới 8pt, hàng 48 |
| 2026-08-15 | **Bộ chọn ngày · giờ · chu kỳ** | Ranh giới của ngôn ngữ tự nhiên thu hẹp lại và rõ ra: nó sống ở chỗ người ta **VIẾT TIÊU ĐỀ** việc (quick-add vẫn bóc "mai 5pm" ra khỏi câu), không sống ở chỗ chỉnh một trường đã có. Ba ô gõ Due/Remind/Repeats thành ba hàng mở **sheet chọn**. Chú thích cũ ở `setDue` lập luận rằng bộ chọn là "cách thứ hai để nói cùng một thứ" — đúng nếu tin rằng gõ là cách thứ nhất ở mọi nơi, nhưng gõ vào một ô rồi bị từ chối là bắt người dùng đoán xem máy hiểu tới đâu; một cái lịch thì không có gì để đoán. Toàn bộ phép tính lịch vào `@todo-ai/core/picker` (14 test), hai app chỉ vẽ. Khung 14 phải sửa **lần thứ hai trong một ngày** và lần này đảo ngược lần đầu: bản gốc vẽ bánh xe, tôi xoá đi vì "app không có", vẽ lại thành ô gõ — rồi chính cái luật đổi, nên bản vẽ ban đầu hoá ra gần đúng hơn code. Ghi lại vì đó là một kiểu trôi dạt khác: bản vẽ đi TRƯỚC code và bị đè mất trên đường |
| 2026-08-15 | Nhóm D + hai chỗ tài liệu tự cãi nhau | **D-4** bỏ hẳn dòng `Model · Sonnet 5` khỏi khung 13: không có chỗ đổi model trên UI và không được có — "model là cấu hình, không phải code", production đọc từ bảng `ai_config`. **D-3** vẽ lại khung 14: bản cũ vẽ một sheet gồm chip tương đối + bánh xe cuộn giờ, thứ không tồn tại; app đặt nhắc bằng cách GÕ vào hàng, cùng ngôn ngữ với Due và Repeats. Khung mới vẽ đúng trạng thái đang gõ, kèm câu máy nói lại điều nó hiểu, và không có nút Set vì không có gì được dàn sẵn. **D-5** giữ dòng `4 turns left today` nhưng dán nhãn: gạch chân đứt màu hổ phách ngay trong hình. Kèm hai chỗ tài liệu nói ngược code: `04-feature-audit` vẫn ghi UC-38 và UC-40 là ✅ kèm đúng tên những tệp đã xoá, và C-1 ở đây đánh ✅ cho khung 09 mà C-1b đã gỡ — hai dòng cùng một bảng đá nhau suốt hai ngày |
| 2026-08-15 | **Vẽ màn hội thoại (UC-52)** | Trang mới `07-conversation.html`, 11 khung. Trước đó chỗ DUY NHẤT vẽ mặt hội thoại là `vision-voice-first.html` — một bản pitch, và nó vẽ đúng bản mà ADR-11 đã **từ chối**: màn chính của nó là `NOW — one decision at a time`, thay cho Inbox và Today, nên **không khung nào có lối về một danh sách**. Đếm được trong file đó: `Inbox` xuất hiện 4 lần và cả 4 đều nằm trong danh sách những thứ bị bỏ. Bảy tiêu chí nặng nhất của UC-52 không có hình nào — ranh giới phiên (`closed`/`session` 0 lần), hai trần 409/429 (`limit`/`quota` 0), lịch sử chưa lấy được, đường từ lượt tới việc, nút tắt tiếng (`mute`/`sound`/`volume` 0), hoàn tác một lượt (`Undo` 0), và lối sang danh sách. Trang mới trả lời cả bảy, có bảng truy vết AC → khung ở cuối, và một danh sách **cố ý không vẽ** để bản vẽ không hứa thay use case. Ba chỗ tự sửa lúc render: transcript neo đáy tràn ra **đè lên thanh nhập** (kẹp lại + làm mờ mép trên, nên mép đó đọc thành "còn nữa ở trên" chứ không thành một lượt bị chặt); nhãn `SPEAKING · SAY ANYTHING TO STOP` xuống hai dòng nên rút còn `TALK TO STOP`; và thanh nhập ghi `Listening…` trong lúc app đang **nói** — ở Composer thật chữ đó nghĩa là đang ghi âm, kèm orb san hô và chấm đỏ. Cũng đổi một chữ so với pitch có chủ ý: `TAP TO CUT IN` hứa ngắt lời rồi nói tiếp đúng chỗ, thứ UC-20 **không** hứa vòng này, và một cái nhãn là một lời hứa |
| 2026-08-15 | Upcoming in ngày hai lần | Tiêu đề nhóm ghi `TUE, AUG 18` rồi hàng bên dưới ghi `Aug 18` lần nữa — nói lại đúng thứ vừa nói, và chiếm chỗ của thông tin duy nhất còn thiếu là mấy giờ. Nay hàng trong nhóm ngày chỉ hiện GIỜ; việc cả ngày không hiện gì (tiêu đề đã định vị xong). Tìm ra khi chạy lại audit v4 |
| 2026-08-15 | Lỗi: tick nhầm việc lặp | Tick một việc lặp rồi tick lại để sửa thì để lại **hai việc trùng** — `rollRecurrence` chạy lúc done mà không có phần dọn lúc bỏ done. Đã sửa, kèm ba unit test và một ca E2E. Đây cũng là câu trả lời cho "sao tick không có Undo": bỏ done chính là đường sửa, nên nó phải hoàn tác được cả phần không nhìn thấy |
| 2026-08-15 | Hàng **không còn nút nào** | Nút mặt trời đi nốt. Hàng thành chỗ ĐỌC: checkbox + tiêu đề + giờ, hết. Xoá có **hai** đường — nút trong màn chi tiết và **vuốt phải-sang-trái**; "đẩy sang Today" và hoãn nằm trong màn chi tiết. Hai đường cho xoá là bắt buộc, không phải thừa: `06-uiux.md` đặt luật mọi cử chỉ phải có một nút tương đương (trợ năng + bàn phím) |
| 2026-08-15 | Bản đồ swipe bắt đầu có thật | `SwipeRow` ở cả hai app, viết bằng pointer events (web) và `PanResponder` (mobile) — **không** thêm thư viện cử chỉ nào, cùng lý lẽ đã giữ `react-native-gesture-handler` ra khỏi `DragList`. Ngưỡng 35% bề rộng, chỉ khoá vào cử chỉ khi lệch ngang > lệch dọc để không cướp cú cuộn |
| 2026-08-15 | Hàng còn **một** nút | Hoãn và Xoá rời khỏi hàng, vào màn chi tiết. Xoá là hành động phá huỷ và hiếm — trước đây nó là một nút 16px đặt cách cái checkbox chưa tới một đầu ngón tay. Cột tiêu đề từ 238px → **290px**, hết vỡ dòng. Q-4 khép lại |
| 2026-08-15 | Lỗi: hoãn trong list | `listTasks` quên `snoozedUntil` trong khi Inbox/Today/nhãn đều lọc — bấm hoãn trong một list thì hàng **không nhúc nhích**, dù việc đó đã nằm ở màn Snoozed. Đã sửa, kèm hai unit test và một ca E2E |
| 2026-08-15 | UC-38 **bỏ hẳn** | Nút VIEW và cả bảng lọc đi hết. Độ gấp nay là vạch đỏ trên hàng nên "cái nào gấp" trả lời bằng mắt; "chưa có hạn" thì Inbox gần như đã là đống đó. Header còn ba thứ: menu · tiêu đề · tìm. Không còn bộ lọc thì cũng không còn điều kiện nào chặn kéo thả |
| 2026-08-15 | UC-38 + UC-43 | Bảng View còn **hai** hàng (Độ gấp · Hạn): bỏ ORDER, SORT BY và TAGS. Thứ tự nay chỉ có một — người dùng tự kéo, không cần bật chế độ. Việc mới lên đầu, bước mới xuống cuối. Bảng từ **572px → 108px** ở mốc 38 nhãn |
| 2026-08-15 | UC-35 vẽ lại | Độ ưu tiên thành **vạch dọc sát mép trái**, cao hết cả hàng lẫn dòng nhãn, thay cho dấu `!` trước tiêu đề. Đỏ = gấp, xám = thấp, **mức giữa không vẽ gì**. Kèm câu đọc cho screen reader, vì màu một mình thì bỏ màu đi là còn hư không |
| 2026-08-15 | Lỗi trợ năng | Nhãn nháy `new`/`edited` dính liền tiêu đề trong tên khả truy cập ("…máy giặtnew") — `margin-left` là CSS, thuật toán tính tên không thấy CSS. Cùng họ với "#2142". Nhãn nhìn thấy nay `aria-hidden`, câu đọc lên tự mang dấu chấm |
| 2026-08-14 | UC-40 bị **bỏ** | Chế độ chọn nhiều gỡ khỏi cả hai app. Phép đếm chạm không bao giờ nghiêng về nó (N so với N+2); nút mặt trời nay có ở Inbox + list + màn nhãn để lấp chỗ duy nhất nó từng thắng. Header màn list hết vỡ dòng: 99px → 54px |

## Còn treo — cần quyết, không phải cần code

| # | Chuyện gì | Vì sao chưa tự quyết |
|---|---|---|
| ~~Q-4~~ | ~~**Hàng trong list nay có ba nút**~~ | ✅ **Xong 15/08** — hoãn và xoá vào màn chi tiết, hàng còn đúng một nút. Cột tiêu đề 238px → 290px |
| ~~Q-1~~ | ~~**Header màn nhiều nút**~~ | ✅ **Xong 2026-08-14** — đã chọn: chạm TIÊU ĐỀ để sửa list, bỏ hẳn nút EDIT. Xem mục ngay dưới |
| ~~Q-2~~ | ~~**Màn nhãn**~~ | ✅ **Xong 2026-08-14** — đã chọn mở lối vào; xem A-5b |
| ~~Q-3~~ | ~~**Xanh lá thành màu tô**~~ | ✅ **Chốt 15/08 — sửa LUẬT, không sửa code.** Luật cũ ở `ui-tokens` viết "green CHỈ là màu chữ" rồi ngay dòng dưới liệt kê một ngoại lệ: nó đã sai kể từ dòng thứ hai của chính nó. Cái vạch xanh là đúng — nó nói một câu khác với thanh tiến độ Today nên phải trông khác. Luật mới: green tô nền ở **đúng một chỗ**, và chỗ thứ hai phải quay lại sửa đoạn đó kèm trả lời "khác vạch bước ở chỗ nào". Một luật mà bản thân nó nói sai thì lần nới thứ hai không ai chặn được — đúng như san hô đã đi từ "hai chỗ" lên bốn vai trò |
| Q-3 | **Xanh lá thành màu tô.** Vạch tiến độ các bước (`.ds-steps__bar--on`) tô `green`, trong khi luật ở `ui-tokens` ghi "green chỉ là MÀU CHỮ" | Ngoại lệ **đã được ghi thẳng vào chú thích token** kèm lý do. Nếu muốn giữ luật nguyên vẹn thì đổi sang mực là một dòng — nhưng lúc đó vạch này và thanh tiến độ của Today cùng màu, mà hai thứ khác nghĩa |

### Q-1 đã chốt: tiêu đề màn list là chỗ sửa list

Bốn nút chữ (EDIT · VIEW · SELECT · tìm) không đủ chỗ trên màn 402px, còn bản vẽ chỉ hình dung
**một** nút nên chưa bao giờ phải đối mặt với chuyện này. Kết quả trước khi sửa: hoặc ngày vỡ hai
dòng, hoặc tên list bị cắt còn `W…`.

**Chốt:** bỏ nút EDIT, chạm vào chính tên list để mở sheet đổi tên / đổi màu / xoá. Một mũi nhọn nhỏ
sau tên là dấu hiệu duy nhất nói nó bấm được — không có nó thì đây là một cử chỉ ẩn, và không ai
đoán ra cử chỉ ẩn trên thứ trông y hệt một dòng chữ.

Đặt lên tiêu đề chứ không nhét vào bảng VIEW: VIEW là **lọc và sắp xếp**, sửa list là chuyện khác
hẳn — gộp lại thì bảng đó thành một ngăn kéo tạp. Tiêu đề là chính cái tên đang được sửa, nên nó là
chỗ tự giải thích nhất.

**Một hướng đã bị loại, ghi lại để khỏi ai đề xuất lại:** "bỏ SELECT, vào chế độ chọn bằng giữ lâu"
không dùng được — giữ lâu **đã là** cử chỉ đổi tên tại chỗ (UC-09), và `v4-motion.html` ghi đúng lý
do đó ở `G-4`: *"Diverged — shipped as a SELECT button in the header instead."*

**Phần layout đáng nhớ hơn cả phần thiết kế.** Ba nút vẫn có thể chật với tên list dài, nên nhóm nút
phải xuống dòng được. Nó KHÔNG xuống dòng cho tới khi đổi `flex: 1` thành `flex: 1 1 auto`:
`flex: 1` viết tắt cho `1 1 0%`, tức flex-basis bằng 0, nên trình duyệt coi khối tiêu đề là rộng 0
và luôn kết luận là vừa — tiêu đề cứ co lại còn hàng nút thì ngồi nguyên. Với basis theo nội dung,
phép tính dùng bề rộng thật của tên: Inbox/Today một dòng, tên dài thì nút xuống dòng và tên hiện
đủ. Ngày phải nằm **trong** khối tiêu đề, nếu không nó bị đẩy xuống dòng thứ ba, lạc lõng dưới một
hàng nút.

Bản mobile nhân dịp này được đưa về **cùng bố cục** — trước đó nó vẫn để ngày TRÊN tiêu đề và nút
tìm bên trái, tức là không theo cả v3 lẫn v4: mockup v4 đã áp cho web mà quên chép sang. Đúng kiểu
trôi mà việc gộp `@todo-ai/client` vừa xoá đi ở tầng logic.

## Thứ tự đề xuất

1. **Nhóm D** — đang mô tả sai sản phẩm, rẻ nhất để sửa và tốn kém nhất nếu để nguyên.
2. **A-1, A-2, A-4** (Inbox, Trash, list) — ba màn đã ship mà không có bản vẽ nào để đối chiếu.
3. **C-1, C-2, C-6** — ba điều khiển lớn nhất chưa có bản vẽ.
4. **C-7 (ảnh đính kèm)** — vẽ trước khi code, vì đây là phần chưa có gì cả.
5. Phần B — nhiều dòng nhưng mỗi dòng nhỏ; có thể gộp thành một trang "trạng thái & thông báo".

## Ngoài phạm vi audit này

Không đụng tới: `01-capture-parse.html` … `06-data.html` (bộ mockup cũ, đã bị v4 thay) và `_ds.css`.

`vision-voice-first.html` **không còn là bản vẽ tham chiếu cho hội thoại**: `07-conversation.html` thay thế phần
đó (xem dòng 15/08 ở nhật ký trên). Giữ lại file pitch vì nó ghi lại một quyết định sản phẩm và lý do nửa còn lại
của nó bị từ chối — xoá đi là xoá mất lập luận. `_vision.css` nay phục vụ cả hai trang.
