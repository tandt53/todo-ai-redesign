# Rà soát toàn bộ AC (2026-08-11)

> 110 tiêu chí nghiệm thu trong [02-use-cases.md](02-use-cases.md), đối chiếu ba chiều: **AC ↔ code đã ship ↔
> app cùng loại**. Không phải rà chính tả — chỉ tìm những AC mà nếu cứ thế code tiếp thì sẽ ra sản phẩm sai.
>
> **✅ Đã sửa toàn bộ 19 AC ngày 2026-08-11.** Tài liệu này giữ lại để tra vì sao chúng sai — bản thân các AC
> trong 02-use-cases.md đã được viết lại. Một thay đổi kéo theo code: xem §1.1.

> **Trạng thái: cả 20 AC đã xử lý xong.** Bốn nhóm đều đóng. Thứ còn lại không phải AC nào cả mà là một thói
> quen: mỗi ngưỡng mới phải đi kèm dụng cụ đo **viết cùng lúc**, và mỗi AC phải nói nhu cầu chứ không nói giải pháp.
>
> **Cách đọc tài liệu này.** Các bảng là **biên bản của lần rà**, không phải trạng thái hiện tại — trạng thái
> nằm ở tiêu đề mỗi nhóm. Ghi rõ vì chính tài liệu này đã có lúc để nguyên câu *"AC vẫn còn nguyên chữ sai"*
> sau khi AC đó đã được sửa: một tài liệu lập biên bản về trôi dạt thì tự trôi dạt là điều mỉa mai đắt nhất.

## Vì sao rà

Trong một buổi làm việc, ba AC do chính người viết tài liệu này đặt ra đều hỏng theo **cùng một kiểu**:

| AC | Chốt sẵn cái gì | Thực tế |
|---|---|---|
| AC-44.2 "hàng có **dấu hiệu mảnh** khi task có note" | Rằng giải pháp là *một dấu hiệu* | Không app todo nào dùng ký hiệu cho việc này. Đã ship ký tự `¶`, người dùng hỏi "ký tự lạ gì đây" |
| UC-47 "chia sẻ ảnh → **từ chối kèm thông báo ngắn**" | Rằng phải có một thông báo | Muốn thông báo thì phải khai báo nhận ảnh trước — tự chui vào share sheet rồi mới nói không. Things 3 làm ngược lại và đúng hơn |
| UC-41 ">30 list → **giới hạn hiển thị + Xem tất cả**" | Rằng cần phân trang | Chưa biết có ai tạo tới 30 list không |

Kiểu hỏng: **AC mô tả giải pháp thay vì mô tả nhu cầu.** Khi đó người code không còn gì để cân nhắc — họ chỉ
việc tuân theo, và cái sai đi thẳng vào sản phẩm mà không ai chặn được.

Một AC lành mạnh trả lời *"người dùng cần gì, và làm sao biết đã đạt"*. Một AC hỏng trả lời *"hãy vẽ cái này"*.

---

## Nhóm 1 — Mâu thuẫn với code đã ship — ✅ đã sửa cả 6

Nghiêm trọng nhất khi phát hiện: hai bên nói khác nhau, nên **một trong hai đang sai** và không ai biết bên nào.
Bảng dưới ghi lại **cái đã tìm thấy**; cả sáu AC nay đã viết lại trong [02-use-cases.md](02-use-cases.md), trừ
AC-24.3 bị xoá hẳn.

| # | AC | Tài liệu nói | Code làm | Ai sai |
|---|---|---|---|---|
| 1.1 | **AC-31.3** | AI parse ngầm datetime từ title rồi **ĐỀ XUẤT — user chạm để nhận, không tự áp** | `useTasks.send` gọi `parseDateTime` và **áp thẳng** `dueAt` khi quick-add, không hỏi (UC-46) | **AC-31.3 và UC-46 mâu thuẫn nhau.** Cả hai đều là AC đã duyệt |
| 1.2 | **AC-33.1** | undo qua **toast 5 giây** | `setTimeout(..., 6000)` ở cả hai app | Con số trong AC là bịa; không ai từng đối chiếu |
| 1.3 | **AC-32.2** | task done xem được ở **filter "Đã xong"** | Không có filter nào tên vậy; đã thay bằng **Logbook** (UC-45) | AC chốt tên một cơ chế, rồi cơ chế đó bị thay ở UC khác |
| 1.4 | **AC-33.2** | xoá task cha **hỏi** kèm sub-task hay không | `deleteTask` **luôn** xoá cả con, không hỏi bao giờ | AC mô tả một hộp thoại chưa từng tồn tại |
| 1.5 | **AC-16.1** | **swipe** hoàn thành với animation mượt | Chỉ có nút bấm | AC tự ghi chú *"(Giai đoạn 2 juicy UI — MVP cần nút bấm)"* — một AC chứa sẵn điều kiện khiến nó không nghiệm thu được |
| 1.6 | **AC-24.3** | *"có eval case cho nhóm này (**hiện chưa có trong 7 kịch bản**)"* | Eval hiện có **24** kịch bản | Đây là một TODO viết thành AC, và đã lỗi thời |

**1.1 là cái đắt nhất.** UC-46 được code trong Đợt 1 để vá lỗ hổng ADR-7 (offline không đặt được hạn), và nó
tự áp `dueAt` ngay — đúng như UC-46 mô tả. Nhưng AC-31.3 nói rõ *không tự áp*. Hai AC cùng nói về một hành vi
mà ngược nhau; người code Đợt 1 (chính là tôi) không hề đọc lại AC-31.3.

Đáng nói hơn: cách UC-46 làm **có thể mới là cái sai**. Áp thẳng nghĩa là gõ "họp 5 người" mà parser hiểu nhầm
thì task có hạn sai mà người dùng không biết. AC-31.3 chọn "đề xuất" chính là để tránh điều đó.

---

## Nhóm 2 — AC chốt sẵn giải pháp (cùng loại với `¶`) — ✅ đã sửa cả 6

Chưa gây hại vì phần lớn chưa code, nhưng sẽ gây hại đúng theo cách `¶` đã gây.

| AC | Chốt sẵn | Nhu cầu thật đằng sau là gì |
|---|---|---|
| ~~AC-35.1~~ | ~~màu/icon~~ | **Đã sửa.** AC viết lại thành nhu cầu, hình thức quyết khi làm sau khi đối chiếu app cùng loại: dấu `!` amber như Apple Reminders. Cờ ba màu của Todoist bị loại vì phá luật một-accent |
| ~~AC-36.1~~ | ~~"k/n"~~ | **Đã sửa.** AC nói nhu cầu; hình thức `k/n` cuối cùng vẫn được chọn — nhưng vì nó là chữ, hợp luật "trang trí không lấn nội dung", chứ không phải vì AC bắt |
| ~~AC-11.2~~ | ~~đếm ngược trên UI~~ | **Đã sửa** thành nhu cầu: *"phải có cơ hội biết điều đó sắp xảy ra **hoặc** hoàn tác sau khi nó xảy ra"* |
| ~~AC-13.1~~ | ~~câu hỏi cụ thể~~ | **Đã sửa**: bản nháp không mất, và người dùng biết nó còn đó cùng số lượng — không chốt hình thức hỏi |
| ~~AC-42.1~~ | ~~7 ngày~~ | **Đã sửa**: *"đủ xa để thấy hết tuần tới"*, và con số 7 được ghi rõ là **phán đoán chưa có dữ liệu** thay vì giả vờ là ngưỡng |
| ~~AC-34~~ | ~~ba mốc shortcut~~ | **Không phải lỗi AC** — nó nằm ở *luồng chính*, nơi được phép cụ thể. Nhưng rà lại lộ ra thứ nặng hơn: **AC-34.1 chưa hề đạt.** Hạn chót chỉ hiển thị, không đặt và không xoá được — chỉ AI mới điền, đúng thứ AC đó cấm. Đã sửa bằng ô nhập dùng `parseDateTime`, cùng khuôn với nhắc nhở |

---

## Nhóm 3 — Con số không có dụng cụ đo — ✅ đã sửa cả 6

Một ngưỡng không đo được thì không nghiệm thu được, tức không phải AC theo đúng luật tài liệu này tự đặt.

| AC | Ngưỡng | Có đo không |
|---|---|---|
| ~~AC-31.1~~ | quick-add < **100ms** | **Có** — `pnpm quickadd:latency`. Đo **trong trang**, từ lúc app nhận Enter đến khi hàng được vẽ xong; gửi phím qua CDP sẽ cộng thêm độ trễ của kênh tự động hoá vào con số. Kết quả: **p95 22,9 ms** |
| ~~AC-01.1~~ | thả mic → card ≤ **4 giây (p95)** | **Có** — `pnpm ai:latency`, p95 trên `ai_requests.latency_ms`. Cột đó **đã tồn tại từ migration 0001**: thứ thiếu chưa bao giờ là dữ liệu, chỉ là câu truy vấn. AC cũng được thu hẹp về **phần ta điều khiển được** — nhận dạng giọng nói là của trình duyệt/OS |
| AC-17.1 | sync A→B ≤ **3 giây** | **Có** — `pnpm sync:latency`. Hai client trong một tiến trình, một đồng hồ: đo trong app sẽ lẫn lệch đồng hồ giữa hai máy vào kết quả. Localhost: median 118 ms |
| AC-26.1 | notification đúng giờ **±1 phút** | **Có** — `pnpm reminder:latency`. Giờ nhận đọc từ **bên trong** tiến trình vì không đọc được từ ngoài. Simulator: **-488 ms**. Chỉ phủ ca app đang chạy — app bị OS giết thì chưa đo được |
| ~~AC-03.2~~ | dán **2.000 ký tự** | **Con số đã bỏ.** Đo thật: 2.000 / 5.000 / 20.000 ký tự đều lưu nguyên vẹn — **không dòng code nào giới hạn**. Một ngưỡng không có gì thực thi thì không mô tả điều gì cả |
| AC-02.3 | eval datetime pass ≥ **90%** | **Có** — `pnpm eval`. Đây là AC duy nhất trong nhóm có dụng cụ đo thật |

AC-02.3 là mẫu đúng: nêu ngưỡng **và** chỉ ra dụng cụ đo. Cả năm cái còn lại nay đã theo mẫu đó, hoặc bỏ con
số vì không có gì thực thi nó.

Ba điều đáng rút ra, vì cả ba đều làm mất thời gian:

- **AC-01.1 tự nêu điều kiện của chính nó và điều kiện ấy đã thoả từ lâu.** AC viết *"cần cột thời lượng trong
  `ai_requests`"* — cột `latency_ms` có từ migration 0001. Thứ thiếu chưa bao giờ là dữ liệu, chỉ là bốn dòng SQL.
- **"Không đo được" đôi khi là "chưa ai viết".** Đáng phân biệt hai loại, vì chúng đắt khác nhau hoàn toàn.
- **Không phải mọi ngưỡng đều nên gắn dụng cụ.** AC-03.2 đúng ra phải **bỏ** con số: đo xong mới biết không có
  giới hạn nào tồn tại, nên gắn dụng cụ cho nó là đo một thứ không có thật.

---

## Nhóm 4 — AC sai về sự thật — ✅ đã sửa

| AC | Đã nói sai gì | Nay nói gì |
|---|---|---|
| ~~AC-23.3~~ | *"**Safari**/Firefox (không có Web Speech): mic tự ẩn"* — Safari **CÓ** `webkitSpeechRecognition` từ 14.1 (macOS) / 14.5 (iOS); chỉ Firefox là tắt mặc định | Dò theo **năng lực**, tuyệt đối không theo tên trình duyệt, và nêu đích danh phiên bản Safari để không ai gộp nhầm lần nữa |
| ~~AC-45.3~~ | *"không đọc toàn bộ lịch sử vào bộ nhớ một lần"* — app local-first nên **mọi task đã nằm sẵn trong RAM** từ lúc load; không thoả được theo nghĩa đen | Không **dựng** quá một trang dòng trong một lần render. Thứ cần bảo vệ là chi phí **render**, không phải chi phí đọc |

Đáng ghi lại vì sao nó chưa kịp gây hại: code **không** làm theo chữ trong AC-23.3 — `Composer.tsx` vốn đã dò
năng lực (`SpeechRecognition ?? webkitSpeechRecognition`). Nếu ai đó code đúng theo AC thì mic đã bị ẩn oan
trên Safari. Một AC sai chỉ vô hại chừng nào chưa có ai làm theo nó.

**Bản thân tài liệu này cũng từng trôi dạt.** Hai mục trên đã được sửa trong `02-use-cases.md` ngay từ lượt rà
đầu, nhưng bảng ở đây vẫn viết ở thì hiện tại là chúng *"vẫn còn nguyên chữ sai"* — tức tài liệu lập biên bản
về trôi dạt lại tự trôi dạt. Bảng ghi lại **cái đã tìm thấy**; trạng thái phải nói rõ ở tiêu đề.

---

## Đã sửa

Toàn bộ 19 AC đã được viết lại trong [02-use-cases.md](02-use-cases.md). Riêng **AC-31.3 kéo theo code**: AC mới
hứa "người dùng thấy app đã hiểu gì và rút lui được", nên `useTasks.send` giờ hiện undo kèm **đúng cụm chữ**
parser đã lấy — `Read "mai 5h" as a due date` — và chỉ hiện khi thật sự có ngày bị bóc ra. Viết AC mà không
hiện thực chính là lỗi mà tài liệu này lập biên bản.

AC-24.3 bị **xoá** thay vì viết lại: nó là một TODO, không phải tiêu chí nghiệm thu.

<details>
<summary>Nội dung đề nghị ban đầu (giữ để đối chiếu)</summary>

**Sửa ngay (mâu thuẫn thật, đang có hại):**
1. **AC-31.3 ↔ UC-46** — quyết một hướng. Đề nghị: giữ tự áp (không có hạn thì offline vô dụng), nhưng thêm
   *cách rút lui* — hàng vừa tạo có undo, và span thời gian bị cắt được hiện lại để người dùng thấy app hiểu gì.
   Sửa AC-31.3 cho khớp thay vì để hai AC đá nhau.
2. **AC-33.1** — 5s hay 6s, chọn một. Đề nghị bỏ con số khỏi AC, để nó ở code.
3. **AC-32.2** — đổi "filter Đã xong" thành "xem lại được ở Logbook (UC-45)".
4. **AC-33.2** — hoặc code hộp thoại, hoặc sửa AC thành "xoá task cha xoá luôn sub-task; undo hoàn tác cả cụm".
   Đề nghị vế sau: đó là hành vi hiện tại và nó hợp lý.
5. **AC-16.1** — bỏ "(Giai đoạn 2...)" ra khỏi AC; hoặc là AC của MVP, hoặc chuyển hẳn sang UC giai đoạn 2.
6. **AC-24.3** — bỏ. Đây là TODO, không phải AC; eval giờ đã 24 kịch bản (đếm bằng `pnpm eval -- --dry-run`).
7. **AC-23.3** — viết lại theo **năng lực** chứ không theo tên trình duyệt: *"không có Web Speech API → mic ẩn"*.
8. **AC-45.3** — viết lại theo thứ thật sự bảo vệ: *"không dựng quá N dòng một lúc"*.

**Viết lại theo nhu cầu (nhóm 2):** sáu AC, không gấp, nhưng nên sửa **trước** khi đụng tới UC tương ứng.

**Gắn dụng cụ đo hoặc bỏ con số (nhóm 3):** năm AC.

</details>

## Luật rút ra, để không lặp lại

1. **AC nói nhu cầu, không nói hình thức.** "Người dùng biết task nào có ghi chú" là AC. "Có một dấu hiệu mảnh"
   là bản vẽ.
2. **Có ngưỡng thì phải có dụng cụ đo**, ghi ngay trong AC (AC-02.3 làm đúng).
3. **AC nói về nền tảng thì nói theo năng lực**, không theo tên sản phẩm — tên trình duyệt và tên hệ điều hành
   đổi nhanh hơn tài liệu.
4. **Tra app cùng loại TRƯỚC khi chốt AC**, không phải sau khi code xong. Ba lần trong buổi này đều đảo thứ tự.
5. **Một AC sửa ở UC này phải soi lại các UC khác cùng nói về hành vi đó** — AC-31.3 sống sót qua cả Đợt 1 chỉ
   vì không ai tra chéo.
