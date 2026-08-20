# Use Cases — Todo AI

> Danh mục use case cho audit tính năng. Mỗi UC có tiêu chí nghiệm thu (AC) đánh số để đối chiếu khi test. Trạng thái hiện thực: [04-feature-audit.md](04-feature-audit.md).

> **Đã rà toàn bộ AC ngày 2026-08-11 và viết lại 19 cái** — lý do từng cái ở [10-ac-audit.md](10-ac-audit.md).
> Luật rút ra, áp cho mọi AC viết thêm sau này: **AC nói nhu cầu, không nói hình thức**; có ngưỡng thì phải có
> dụng cụ đo; nói về nền tảng thì nói theo **năng lực**, không theo tên trình duyệt hay hệ điều hành.

**Actors:** `User` (người dùng cuối), `Agent` (AI intent agent), `System` (app + backend).

**Triết lý sản phẩm:** "Lười là thượng đế" — mọi UC được đánh giá theo số thao tác chạm/gõ mà user phải làm.

**Nguyên tắc phân tầng (quan trọng nhất khi audit):** đây là một **todo app** trước tiên — nhóm CORE dưới đây phải hoạt động 100% khi AI tắt, lỗi, hết quota hoặc offline. AI (nhóm A–B) là tầng **enhance** đặt lên trên: làm nhanh hơn, thông minh hơn, nhưng không bao giờ là đường duy nhất để làm một việc cơ bản. Kiểm tra nhanh: tắt mạng AI → mọi UC nhóm CORE vẫn pass.

> Ghi chú đánh số: mã UC là ID cố định để truy vết, không phải thứ tự ưu tiên (nhóm CORE thêm sau khi rà soát nên mang số UC-31+).

---

## Nhóm CORE — Todo cơ bản, KHÔNG cần AI (MVP)

### UC-31: Quick-add task thủ công
**Mô tả:** đường tạo task không phụ thuộc AI — nền tảng của cả app.
- **Main flow:** ô nhập ở Inbox (hoặc chế độ "thêm nhanh" ở Capture) → gõ title → Enter → task vào Inbox **tức thì, local-first, không chờ network**.
- **AC-31.1:** task hiện ra **tức thì** — không gọi AI, không đợi server, không có trạng thái chờ nào. Hai cách nghiệm thu, và cần cả hai: đường code (quick-add ghi thẳng vào state local, không `await` mạng) và phép đo `pnpm quickadd:latency`, p95 ≤ 100 ms từ lúc nhận Enter đến khi hàng được **vẽ xong**. Đường code chứng minh không có chỗ nào chờ mạng; phép đo bắt được thứ đường code không thấy, ví dụ render chậm dần khi danh sách dài.
- **AC-31.2:** hoạt động đầy đủ khi offline và khi AI lỗi/hết quota.
- **AC-31.3:** ngày giờ nhận ra được trong câu thì **áp luôn** vào task (UC-46) — không hỏi, vì đây là đường chạy khi offline và một hộp thoại xác nhận làm hỏng chính chỗ nó có ích nhất. Đổi lại, người dùng phải **thấy app đã hiểu gì** và **rút lui được**: task vừa tạo có undo ngay tại chỗ khi ngày giờ bị bóc ra khỏi tiêu đề.
  *(Bản cũ ghi "ĐỀ XUẤT — user chạm để nhận, không tự áp" và mâu thuẫn trực tiếp với UC-46 đã ship. Xem [10-ac-audit.md](10-ac-audit.md) §1.1.)*

### UC-32: Hoàn thành / bỏ hoàn thành
- **Main flow:** chạm checkbox → done (gạch ngang); chạm lại → bỏ done.
- **AC-32.1:** toggle 2 chiều, cập nhật `updated_at`, sync như mọi thay đổi.
- **AC-32.2:** task done rời Today/Inbox mặc định nhưng xem lại được — nơi chứa lịch sử là **Logbook** (UC-45).

### UC-33: Xoá & khôi phục

> **15/08/2026 — xoá chuyển vào màn chi tiết.** Trước đây nó là một nút thùng rác 16px trên MỌI hàng, đặt cách cái checkbox — cú chạm nhiều nhất trong sản phẩm — chưa tới một đầu ngón tay. Xoá vẫn mềm y như cũ (30 ngày, khôi phục được, có Undo ngay sau đó); chỉ có đường vào là đổi, và một bước mở task ra đúng với trọng lượng của một hành động phá huỷ. Đây cũng là lần đầu màn chi tiết CÓ nút xoá task: trước đó nó chỉ xoá được sub-task và cả chuỗi lặp, nên nút trên hàng gánh một mình.

- **Main flow:** xoá task → vào "Thùng rác" (soft delete `deleted_at`); khôi phục trong 30 ngày; quá hạn xoá hẳn.
- **AC-33.1:** xoá có undo tức thì, ngay tại chỗ, không phải vào thùng rác mới lấy lại được. Undo phải sống đủ lâu để người vừa lỡ tay kịp nhận ra — thời lượng cụ thể để ở code, không chốt trong AC.
- **AC-33.2:** xoá task cha thì sub-task đi theo; undo hoàn tác cả cụm. Không hỏi — một hộp thoại cho thao tác đã có undo là hỏi hai lần cùng một câu.

### UC-34: Đặt/sửa deadline & reminder bằng picker
- **Main flow:** chạm trường due/reminder → date-time picker (kèm shortcut "Hôm nay 18:00 / Mai 9:00 / Cuối tuần") → lưu.
- **AC-34.1:** không cần AI cho mọi thao tác thời gian.
- **AC-34.2:** xoá được due/reminder (đặt về trống).

### UC-35: Đặt priority bằng tay
- **AC-35.1:** đặt được 3 mức low/medium/high bằng một chạm, và **nhìn danh sách là biết việc nào gấp** mà không cần mở ra. Hình thức thể hiện chưa chốt — quyết khi làm, sau khi đối chiếu app cùng loại.

### UC-36: Quản lý sub-task thủ công
- **Main flow:** trong Task Detail: thêm sub-task bằng ô nhập, tick done từng cái, sửa title, xoá, kéo-thả thứ tự.
- **AC-36.1:** nhìn task cha là biết **còn bao nhiêu bước nữa** mà không phải mở ra đếm.
- **AC-36.2:** đủ CRUD không cần AI.
- **AC-36.3:** thứ tự các bước là do user, và **bền qua khởi động lại** — một checklist tự xếp lại là một checklist mất đi thứ khiến nó đáng tách ra.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Thả đúng chỗ cũ | Không ghi gì, không sinh bản undo |
| Chỉ có một bước | Không kéo được — không có chỗ nào để thả tới |
| Kéo một bước đã xong | Vẫn kéo được. "Xong" không có nghĩa là "hết thuộc về danh sách này" |
| Bước có hạn riêng | Thứ tự **không** bị hạn ghi đè. `subtasksOf` dùng `byOrder` chứ không `sortForDisplay`, đúng vì lý do này |
| AI thêm bước lúc đang kéo | Như UC-43: thứ tự thả tính trên bản đang nhìn thấy |
| Xoá một bước rồi hoàn tác | Về đúng vị trí cũ — `sortOrder` nằm trên chính bản ghi, undo trả lại cả nó |
| `sortOrder` cạn khoảng giữa | Đánh số lại toàn list **khi load** (đã có `renumberOrder`), không phải khi kéo |

### UC-37: Tìm kiếm
- **Main flow:** ô search (web: `/` focus) → tìm theo title + note, kết quả gõ đến đâu lọc đến đó.
- **AC-37.1:** tìm được cả task done/archived; kết quả mở đúng Task Detail.
- **AC-37.2:** hoạt động offline trên dữ liệu local.

### UC-38: Lọc — ĐÃ BỎ (15/08/2026)

> **Rút gọn ba bước rồi bỏ hẳn, trong hai ngày.** Ghi lại cả ba vì mỗi bước có một lý do riêng, và nếu chỉ còn thấy kết quả thì không ai hiểu vì sao:
>
> 1. **Trục nhãn** — hàng chip phình theo số nhãn mà không có trần: trên màn 402px, 18 nhãn → hàng cao 191px, 38 nhãn → 387px, cả bảng 572px trên 844px. Tệ hơn là thứ tự: `allTags` sắp theo số lượng, nên ở mốc 38 nhãn hai nhãn đáng lọc chìm giữa 36 nhãn ghi "1" — mà lọc theo nhãn một việc thì cho ra đúng cái hàng đã nhìn thấy. Giá trị giảm đúng bằng tốc độ phình ra: tính năng tự hỏng khi app được dùng lâu.
> 2. **Hai trục sắp xếp** — xem UC-43: thứ tự nay chỉ có một, là thứ tự người dùng tự kéo.
> 3. **Trục độ gấp và trục hạn** — độ gấp nay là **vạch đỏ ở mép trái mỗi hàng** (UC-35), nên "cái nào gấp" trả lời được bằng mắt; giấu những hàng còn lại đi không thêm gì. Còn "việc nào chưa có hạn" thì Inbox gần như đã là chính đống đó.
>
> Còn lại một nút VIEW nuôi một bảng gần trống, nên cả ba đi cùng nhau. Header còn **ba** thứ: menu · tiêu đề · tìm kiếm.
>
> **Cái mất:** AC-38.1 → 38.4 chết theo, kể cả màn "rỗng vì bộ lọc" mới dựng 13/08. Câu hỏi "cho tôi xem việc kiểu này" dồn về **tìm kiếm** (UC-37, bỏ dấu tiếng Việt) và **màn nhãn** (`dest.kind === "tag"`) — hai đường đã có sẵn và trả lời tốt hơn.
>
> **Cái được, ngoài chỗ trống:** không còn bộ lọc thì không còn điều kiện nào chặn kéo thả, nên thứ tự trên màn **luôn** là thứ tự thật. Một luật biến mất khỏi UC-43.
>
> Có ca E2E giữ cho nút VIEW không mọc lại — chỗ này đã bị đẩy ra rồi kéo vào nhiều lần trong quá trình rút gọn.

<details>
<summary>Bản gốc, giữ lại để đọc ngược lý do</summary>

**Luồng chính**
1. User mở một list (Inbox / Today / list riêng) và muốn thu hẹp lại: chỉ việc gấp, hoặc chỉ việc có hạn.
2. Mở bộ lọc, chọn một hoặc nhiều điều kiện.
3. List rút lại, và **trên màn hình luôn thấy rõ đang lọc gì**.
4. Bỏ lọc bằng một thao tác, list trở về đầy đủ.

- **AC-38.1:** lựa chọn lọc được nhớ giữa các lần mở app.
- **AC-38.2:** user **luôn biết mình đang nhìn một list đã lọc**, và biết đang lọc theo gì, mà không phải mở lại bộ lọc.
- **AC-38.3:** bỏ toàn bộ lọc được bằng **một** thao tác.
- **AC-38.4:** lọc chỉ đổi *cái được nhìn thấy*; không đổi dữ liệu, không đổi thứ tự tay, không tính lại `sortOrder`.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Không chọn điều kiện nào | Không lọc gì cả — **không phải** "không có việc nào". Đây là trạng thái khởi đầu |
| Lọc xong không còn việc nào | Nói rõ **rỗng vì bộ lọc**, kèm lối bỏ lọc. Dùng lại màn "Inbox trống" là nói dối: user có việc |
| Đang lọc rồi chuyển sang list khác | Bộ lọc **theo màn hình, không theo list** — cùng một câu hỏi ("việc gấp nào?") áp cho chỗ đang đứng. Nhưng phải thấy rõ nó còn bật |
| ~~Nhãn đang lọc bị xoá khỏi mọi task~~ | Không còn áp dụng — trục nhãn đã bỏ. `pruneFilter` vẫn giữ vai trò cho mức gấp từ bản cũ |
| Đang lọc và người dùng thử kéo | **Không cho kéo** — thứ tự nhìn thấy không phải thứ tự thật (đã chốt ở UC-43). Không còn "chế độ" nào để bật, nên đây là điều kiện duy nhất chặn kéo |
| Đang lọc mà AI/sync thêm việc không khớp điều kiện | Việc vẫn được tạo, chỉ là không hiện. Không im lặng: hàng vừa thêm mà không thấy đâu là lúc user nghĩ app nuốt mất |
| Lọc "có deadline" khi task đang snooze | Snooze không đụng `dueAt` (xem `snoozedUntil`), nên vẫn tính là có deadline — nhưng task đang ngủ thì vốn đã không nằm trong list |
| Bộ lọc lưu từ bản cũ chứa mức priority không còn tồn tại | Bỏ qua giá trị lạ, giữ phần còn lại; không nổ, không xoá sạch lựa chọn |

**Quyết định còn treo**
- Lọc theo **status** (nêu trong bản UC cũ) chưa làm: Inbox/Today/Logbook/Trash **đã là** các đích theo status, nên một bộ lọc status nữa sẽ là cùng một dữ liệu ở hai chỗ. Cần dữ liệu dùng thật để biết có ai muốn "chỉ việc chưa xong *trong* Logbook" không.
- Có nên lưu bộ lọc thành **đích riêng trong drawer** ("việc gấp") như saved filter của Todoist? Chưa quyết — chỉ đáng làm khi có người lọc cùng một thứ nhiều lần.

</details>

### UC-39: Task lặp lại (recurring)

> **15/08/2026 — bỏ done thì dọn luôn lần kế tiếp vừa sinh.** Tìm ra khi đi trả lời câu "đã có Undo khi tick nhầm chưa": tick một việc lặp rồi tick lại để sửa thì để lại **hai việc giống hệt nhau** — `toggleDone` gọi `rollRecurrence` lúc đánh done nhưng không dọn lúc bỏ done. Đo trên chính reducer: `[Tưới cây/inbox]` → tick → `[done, today]` → bỏ tick → `[today, today]`.
>
> Vì sao đáng sửa chứ không phải thêm một nút Undo cho việc tick: **bỏ done CHÍNH LÀ đường sửa** một cú chạm nhầm, và nó gần hơn cả đi tìm Undo — một chạm lên đúng cái ô vừa bấm. Nhưng đường đó chỉ đúng nếu nó hoàn tác được toàn bộ cú tick, kể cả phần người dùng không nhìn thấy.
>
> **Chỉ dọn thứ còn nguyên vẹn:** cùng `seriesId`, sinh ra không sớm hơn lúc đánh done, `updatedAt === createdAt`, chưa done, và không bước con nào bị đụng vào. Đã sửa rồi thì giữ — lúc đó nó là việc của người dùng, không còn là hệ quả của một cú chạm nhầm.
>
> **Xoá cứng hay mềm là do đã đồng bộ hay chưa.** Chưa đẩy lên server (`pendingSync`) thì cắt hẳn khỏi mảng: server chưa từng thấy nó, và đây là hoàn tác một lần TẠO chứ không phải xoá một việc — để nó rơi vào Thùng rác là cho người dùng thấy một thứ họ chưa từng xoá. Đã đẩy rồi thì xoá mềm, vì máy khác cần một bia mộ để bỏ theo.


**Luồng chính**
1. Mở một task, đặt chu kỳ bằng lời thường ("mỗi 3 ngày", "hàng tuần", "every 2 months").
2. Hàng đó cho biết nó lặp.
3. Đánh done → bản vừa xong **ở lại làm lịch sử**, đồng thời sinh lần kế tiếp với hạn đã dời.
4. Muốn dừng: bỏ chu kỳ, hoặc xoá cả chuỗi.

- **AC-39.1:** sửa một occurrence không phá chuỗi; xoá được cả chuỗi.
- **AC-39.2:** đánh done một việc lặp **không bao giờ** làm mất việc — luôn còn đúng một occurrence đang mở.
- **AC-39.3:** lần kế tiếp giữ nguyên mọi thứ người dùng đã đặt cho việc đó (list, nhắc, độ gấp, nhãn, các bước).
- **AC-39.4:** đặt và bỏ chu kỳ đều làm được **không cần AI** (ADR-7).

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Đánh done trễ mấy ngày | Mốc dời tính từ **hạn cũ**, không từ lúc bấm. Tính từ lúc bấm thì một việc "thứ hai hàng tuần" sẽ trôi dần sang thứ tư |
| Việc lặp **không có hạn** | Không có hạn cũ để dời, nên mốc tính từ lúc hoàn thành — "tưới cây mỗi 3 ngày" đếm từ lần tưới gần nhất |
| Lặp hàng tháng, hạn rơi ngày 31 | Tháng không có ngày 31 thì lùi về ngày cuối tháng đó. Tràn sang mùng 1 tháng sau là sai ngày **và** sai tháng |
| Bỏ done một occurrence vừa xong | Lần kế tiếp vừa sinh ra mà **chưa ai đụng vào** thì biến mất — nếu không, một cú bấm nhầm để lại hai việc mở |
| Bỏ done một occurrence cũ (lần kế tiếp đã bị sửa) | Giữ nguyên cả hai. Xoá thứ người dùng đã sửa tay là tệ hơn hẳn một hàng thừa |
| Sửa tiêu đề/giờ của occurrence đang mở | Chỉ occurrence đó đổi. Lần kế tiếp sinh **từ nó**, nên thay đổi tự đi tiếp — đó là cách "sửa từ nay về sau" mà không cần thêm khái niệm nào |
| Đổi chu kỳ | Áp cho lần sinh kế tiếp. Lịch sử không bị viết lại |
| Xoá occurrence đang mở | Chuỗi dừng lại trên thực tế: occurrence kế tiếp chỉ sinh khi hoàn thành, nên không còn gì để sinh. Các bản đã xong vẫn ở Logbook |
| Xoá cả chuỗi | Mọi occurrence **chưa xong** vào thùng rác; các bản **đã xong ở lại** — chúng là ghi chép việc đã làm, không phải rác |
| Việc lặp có sub-task | Lần kế tiếp có lại đủ các bước, **chưa tick** |
| Chu kỳ đọc không ra ("mỗi lúc rảnh") | Không đặt gì, nói ra là không hiểu. Đoán bừa một chu kỳ là cách chắc chắn nhất để việc hiện ra sai ngày mãi mãi |

**Quyết định còn treo**
- ~~**"Thứ hai hàng tuần"** (lặp theo *thứ*)~~ — ✅ **Xong 15/08.** `days?: number[]` (0 = Chủ Nhật), có nghĩa với chu kỳ NGÀY và TUẦN. "Thứ Hai và thứ Năm" nghĩa là từ thứ Hai lần sau CÁCH BA NGÀY, không phải bảy. Kèm `dates?: number[]` cho chu kỳ tháng (1..31, ngày 31 ở tháng ngắn thì DỒN về ngày cuối chứ không bỏ qua — bỏ qua thì việc biến mất khỏi bốn tháng trong năm mà không gì giải thích). Vẫn **không** dùng RRULE
- ~~**Chuỗi có điểm dừng**~~ — ✅ **Xong 15/08.** Hai cách, LOẠI TRỪ NHAU: `until?: string` (ngày lịch, tính cả ngày đó) hoặc `count?: number` (chạy đúng bấy nhiêu lần). Đặt cả hai thì "cái nào thắng" là câu hỏi không có câu trả lời đúng, nên bộ chọn chỉ cho một và ràng buộc CSDL chặn nốt. Không có bộ đếm riêng: số lần đã chạy đếm được từ chính các hàng cùng `seriesId`, còn một cột `done_count` sẽ sai ngay lần đầu ai xoá một lần lặp cũ
- **Xem trước các lần sắp tới trên một màn lịch** — ĐÃ VẼ 15/08/2026, chưa code.

  Hôm nay chỉ tồn tại đúng một lần đang mở, nên Upcoming thấy được lần kế tiếp và không thấy gì xa hơn.

  **Chuyện này KHÔNG cần đổi mô hình dữ liệu.** Đã cân nhắc và loại bỏ kiểu "một dòng kèm danh sách ngày đã
  làm": nó làm màn lịch thành chuyện vặt nhưng đánh mất ba thứ đang chạy — sửa riêng một lần lặp (AC-39.1),
  các bước quay lại chưa tick mỗi chu kỳ (AC-39.3), và một dòng Logbook cho mỗi ngày việc thật sự được làm.

  Bản vẽ là **khung 16 `Month view`** trong `docs/mockups/v4.html`. Chấm ĐẶC = hàng thật, mở được; chấm RỖNG =
  lần lặp tính ra từ luật, chưa tồn tại. Một chấm mỗi ngày, đặc thắng rỗng.

  **Hai câu đã chốt 15/08:**
  - **Chạm hàng ma mở CHUỖI, không phải lần đó.** Hàng ma không phải task nên không tick được. Hai khả năng là
    tạo luôn lần đó ra thật, hoặc mở luật lặp để sửa — luật thắng. Tick một thứ Ba của ba tuần sau không phải
    việc ai đó thật sự muốn làm, còn tạo sớm thì phá lặng lẽ đúng cái bất biến cả mô hình dựa vào: **mỗi chuỗi
    chỉ có đúng một lần đang mở**. Người chạm vào một thứ Ba tương lai đang hỏi về cái quy luật, không hỏi về
    ngày đó.
  - **Lịch là một CÁCH XEM của Upcoming, không phải một đích riêng.** Nó trả lời đúng câu Upcoming trả lời
    ("sắp tới có gì, ngày nào") ở độ phóng khác, nên nó xứng một nút đổi dạng trên chính màn đó chứ không phải
    hàng thứ tám trong một drawer đã có bảy. Nó còn giữ giúp một lời hứa: Upcoming bắt đầu từ ngày mai, mà một
    lưới tháng lặng lẽ gộp cả hôm nay vào thì lại đặt cùng một việc lên hai màn — đúng cái lỗi đã khiến
    Upcoming phải bắt đầu từ ngày mai.

  **Còn treo:** tháng hay tuần (khung 16 vẽ tháng), và có cho kéo-thả trên lưới lịch không.

  **KHÔNG có chu kỳ theo GIỜ, và đó là quyết định.** "Uống thuốc mỗi 4 tiếng" là một
  nhu cầu thật, nhưng nó không hợp với mô hình: mỗi lần lặp là MỘT HÀNG, nên chu kỳ
  4 tiếng đẻ ra sáu hàng mỗi ngày và Logbook chìm trong đó chỉ vì một việc. Bốn đơn
  vị hiện có (ngày · tuần · tháng · năm) khớp với cách người ta xếp NGÀY, mà đó đúng
  là việc sản phẩm này nhận làm (ADR-8: "sắp xếp ngày của tôi"). Thứ trả lời "nhắc
  tôi sau mỗi mấy tiếng" là NHẮC, và mỗi việc đã có một cái nhắc riêng. Muốn mở thì
  phải trả lời trước: một việc lặp theo giờ hiện thế nào trong danh sách một ngày,
  và Logbook đọc ra sao khi một việc chiếm sáu dòng mỗi ngày.

  **Chọn THỨ chỉ có ở Weekly, không có ở Daily.** "Hàng ngày, chỉ thứ Hai và thứ Sáu"
  không còn là hàng ngày — nó là hàng tuần vào hai thứ đó. Cho chọn thứ dưới Daily là
  dựng lại đúng cái mập mờ đã gỡ khi bỏ "mỗi 1 tuần" đứng cạnh nút "Weekly": hai
  đường tới cùng một chu kỳ. Bản đầu có cả hai, và cái "lỗi" phép tính bỏ qua các thứ
  đó hoá ra là chính mô hình đang nói điều này.

  **Việc lặp BẮT BUỘC có hạn.** Chu kỳ tính từ hạn cũ ra hạn mới; không có hạn thì chỉ
  còn cách neo vào lúc bấm xong, và một việc "thứ Hai hàng tuần" trôi dần sang thứ Tư
  sau vài tuần làm muộn — cái trôi đó không kêu ở đâu cả. Đặt chu kỳ trên một việc
  chưa có hạn thì hạn được đặt luôn là hôm nay, dạng CẢ NGÀY (không bịa ra một giờ
  chưa ai nói). Kéo theo một hệ quả đúng và cần biết: hạn hôm nay nghĩa là việc đó
  thuộc màn Today, nên nó rời Inbox.

  **Hạn phải nằm ĐÚNG trên quy luật.** Hạn đang là thứ Tư mà chọn "hàng tuần vào thứ
  Hai và thứ Năm" thì lần đầu rơi vào một ngày không thuộc quy luật vừa đặt — sai đúng
  một lần, và không gì giải thích. `alignDueTo` đẩy hạn TỚI ngày hợp lệ gần nhất (đẩy
  tới chứ không lùi: lùi thì hạn rơi vào quá khứ và việc thành quá hạn ngay lúc vừa
  đặt chu kỳ), và hàng `Starts` trong bộ chọn hiện ngay ngày mới.

  **Ngày kết thúc trước ngày bắt đầu thì BÁO, không tự sửa.** Người dùng có thể đang
  định sửa ngày hạn ngay sau đó, và một cái ngày tự nhảy đi lúc họ chưa nói xong thì
  tệ hơn một dòng chữ.

  **Mốc bắt đầu không có trường riêng, và đó là chủ ý.** Chuỗi bắt đầu từ NGÀY HẠN của
  việc. Thêm một `start` riêng là hai câu trả lời cho "lần đầu rơi vào ngày nào", và
  chúng lệch nhau ngay lần đầu ai đó sửa một trong hai. Bộ chọn vẫn có hàng `Starts`
  nhìn thấy được và bấm được — nó mở đúng bộ chọn hạn.

### UC-40: Thao tác hàng loạt — ĐÃ BỎ (14/08/2026)

> **Đã dựng xong rồi gỡ đi.** Chế độ chọn nhiều từng chạy đủ trên cả hai nền —
> chọn hàng, thanh Today/Done/Delete, một Undo cho cả lô — và bị bỏ sau khi đếm
> lại số chạm nó thực sự tiết kiệm:
>
> | Việc | Chạm từng hàng | Qua chế độ chọn |
> |---|---|---|
> | Đánh done N việc | **N** (tick ô tròn) | 1 + N + 1 = **N+2** |
> | Xoá N việc | **N** (nút thùng rác trên hàng) | **N+2** |
> | Chuyển N việc sang Today | N — *nhưng trước đây nút mặt trời chỉ có ở Inbox* | **N+2** |
>
> Nó chưa bao giờ thắng, kể cả với lô lớn: mọi hành động ở AC-40.1 đã có sẵn một
> nút một-chạm ngay trên hàng. Chỗ duy nhất nó thắng thật là hàng thứ ba, và
> nguyên nhân là nút mặt trời thiếu chỗ chứ không phải thiếu chế độ chọn — nay
> nút đó có mặt ở Inbox, list và màn nhãn.
>
> Thứ mất đi là AC-40.2: xoá 12 việc lẻ sinh 12 bản undo riêng, nhận ra sai thì
> chỉ lấy lại được cái cuối. Chấp nhận — nó không đủ trả cho một chế độ riêng
> cộng một nút thường trực trên header, vốn làm header màn list vỡ hai dòng
> (99px so với 54px, đo trên viewport 402px).
>
> Cùng lúc gỡ: `pruneSelection` và `bulkApply` trong core, `test/bulk.test.ts`,
> `.ds-row--picked`, `.bulkbar*`, và trạng thái chọn trong `@todo-ai/client`.
> Lấy lại được bằng một lệnh git revert nếu dữ liệu dùng thật nói ngược lại.
>
> Ca E2E "bỏ chế độ chọn nhiều, nhưng trong list vẫn đẩy được sang Today bằng
> một chạm" giữ đúng cái giá đã trả: nếu ai bỏ nút mặt trời khỏi hàng trong
> list, ta vừa đóng một đường mà không mở đường nào khác.

<details>
<summary>Bản gốc, giữ lại để đọc ngược lý do</summary>

**Luồng chính**
1. Trong một list, user bật chế độ chọn.
2. Chạm từng hàng để chọn/bỏ chọn; số đã chọn hiện rõ.
3. Chọn một hành động: **xong**, **chuyển sang Today**, hoặc **xoá**.
4. Áp một lần cho cả nhóm, và **hoàn tác được bằng một thao tác** — không phải N thao tác.

- **AC-40.1:** chọn nhiều task → done/xoá/chuyển Today một lần.
- **AC-40.2:** cả lô là **một** bản undo. Hoàn tác trả lại đúng trạng thái trước khi bấm, không để lại nửa lô.
- **AC-40.3:** ở chế độ chọn, chạm một hàng **chỉ** để chọn — không mở chi tiết, không đánh dấu xong.
- **AC-40.4:** user luôn biết mình đang ở chế độ chọn và đã chọn bao nhiêu.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Chưa chọn gì | Các hành động không dùng được. Một nút "Xoá" bấm được mà không xoá gì là nói dối |
| Lô có cả việc đã xong lẫn chưa xong, bấm "Xong" | Chỉ việc **chưa xong** chuyển thành xong. Việc đã xong **không bị lật ngược** — `toggleDone` là sai hàm ở đây |
| Chọn một việc cha | Việc con đi theo (đúng như done/xoá lẻ), và không bị tính hai lần |
| Đang chọn thì AI/sync xoá mất một việc đã chọn | Id đó tự rụng khỏi lựa chọn; hành động vẫn chạy trên phần còn lại, không nổ |
| Đang chọn thì đổi list / đổi đích | Thoát chế độ chọn, xoá lựa chọn — lựa chọn thuộc về **màn hình đang nhìn**, không phải về dữ liệu |
| Đang lọc rồi chọn "tất cả" | "Tất cả" nghĩa là tất cả **đang nhìn thấy**, không phải toàn bộ list. Ngược lại là xoá nhầm thứ không có trên màn hình |
| Chọn rồi bấm "Chuyển sang Today" với việc vốn đã ở Today | Không đổi gì, không sinh bản ghi thừa |
| Xoá cả lô | Vào thùng rác như xoá lẻ (UC-33), khôi phục được, và undo trả lại cả lô |

**Quyết định còn treo**
- Có nên có **"Chọn tất cả"** không? Với list vài chục hàng thì tiện; với list dài thì đó là nút xoá sạch chỉ cách hai cú chạm. Chưa quyết — chờ xem có ai chọn quá 5 hàng một lần không.
- Bulk **đổi độ gấp / gắn nhãn / chuyển list** chưa làm: ba việc trên là "sửa thuộc tính", khác hẳn ba việc ở AC-40.1 vốn là "thay đổi vòng đời". Trộn hai nhóm vào một thanh công cụ sẽ làm thanh đó dài hơn cái list nó đang thao tác.

</details>

> **Loại trừ có chủ đích (không phải thiếu sót):** KHÔNG có projects/folders/labels ở MVP — triết lý Universal Inbox trong spec ("không phân chia thư mục dự án phức tạp"). Nếu audit thấy cần nhóm việc, cân nhắc ở Giai đoạn 2+ sau khi có dữ liệu sử dụng thật.

---

## Nhóm A — Capture bằng AI (MVP · tầng enhance)

### UC-01: Tạo task bằng một câu nói/gõ
**Mô tả:** User nói hoặc gõ một câu tự nhiên; Agent tạo task nháp.
- **Precondition:** đã đăng nhập; màn Capture mở.
- **Main flow:**
  1. User bấm giữ mic và nói "Mua sữa cho con" (hoặc gõ).
  2. System hiển thị transcript realtime khi đang nói.
  3. System gửi turn lên Agent; Agent gọi `create_tasks`.
  4. System hiển thị card nháp trong Live Preview, highlight là mới.
- **AC-01.1:** lượt AI (từ lúc gửi lời nói đã nhận dạng đến khi có kết quả) ≤ 4 giây ở phân vị 95. Đo bằng `pnpm ai:latency`, tính p95 trên `ai_requests.latency_ms`. **Cố ý không tính cả nhận dạng giọng nói**: phần đó thuộc trình duyệt/hệ điều hành, gộp vào sẽ tạo ra một ngưỡng hỏng vì máy người khác chậm mà ta không sửa được gì. Phần render đo riêng bằng `pnpm quickadd:latency`.
- **AC-01.2:** title giữ nguyên ngôn ngữ gốc của user.
- **AC-01.3:** transcript thô được lưu (bảng `captures`) TRƯỚC khi gọi AI — crash không mất dữ liệu.

### UC-02: Bóc tách thời gian tiếng Việt
**Mô tả:** câu nói chứa thời gian tương đối → deadline ISO đúng.
- **Main flow:** User: "Chiều mai họp phụ huynh" → task có `due_at` = ngày mai, khung 12:00–18:59 đúng timezone user.
- **AC-02.1:** đúng ngày với các mẫu: "mai", "ngày kia", "thứ 6 tuần sau", "tối nay", "next Monday".
- **AC-02.2:** datetime luôn có timezone offset; không bao giờ đoán mò khi câu không có thời gian (không bịa `due_at`).
- **AC-02.3:** đo bằng eval harness, pass rate kịch bản datetime ≥ 90%.

### UC-03: Tách đoạn dài thành nhiều task
**Mô tả:** user đọc/dán một đoạn lộn xộn nhiều việc.
- **Main flow:** "Tuần này phải xong báo cáo, à mà cần đặt vé máy bay, với gọi cho mẹ" → 3 task độc lập.
- **AC-03.1:** mỗi việc độc lập thành một task riêng; không gộp, không tách vụn.
- **AC-03.2:** dán được cả một đoạn dài từ email/note mà **không bị cắt âm thầm**. Không có ngưỡng ký tự trong AC vì không có ngưỡng nào trong code: đo thật ở 2.000 / 5.000 / 20.000 ký tự đều lưu nguyên vẹn. Nếu sau này buộc phải có giới hạn (context của model, cột DB) thì app phải **nói ra**, chứ không cắt bớt.

### UC-04: Phân rã sub-task
**Mô tả:** task đủ phức tạp được gợi ý sub-task thực chiến.
- **AC-04.1:** task đơn giản ("mua sữa") KHÔNG bị phân rã.
- **AC-04.2:** sub-task hiển thị trong card, sửa/xoá được từng cái trước khi lưu.

---

## Nhóm B — Hội thoại chỉnh sửa (MVP, khác biệt cốt lõi)

### UC-05: Nói tiếp để thêm chi tiết vào task vừa tạo
- **Main flow:**
  1. Phiên đang mở với draft "Chuẩn bị slide" (d2).
  2. User: "À slide thì thêm phần số liệu doanh thu nữa".
  3. Agent gọi `add_subtasks(d2)` — KHÔNG tạo task mới.
  4. Card d2 cập nhật, highlight phần thay đổi.
- **AC-05.1:** tham chiếu gián tiếp ("slide thì...", "cái đó", "task đầu tiên") resolve đúng ref.
- **AC-05.2:** không nhân bản task khi user chỉ bổ sung.

### UC-06: Sửa task bằng lời nói
- **Main flow:** "Đổi họp sang 2h chiều đi" → `update_task` đổi `due_at`, các trường khác giữ nguyên.
- **AC-06.1:** chỉ trường được nhắc đến thay đổi.
- **AC-06.2:** sau khi AI sửa, user biết **trường nào đã đổi và giá trị trước đó là gì**, ngay cạnh đường hoàn tác.
  *(Câu cũ — "diff hiển thị trên card (giá trị cũ → mới) trong Live Preview" — là một bản vẽ, không phải nhu cầu:
  nó chốt sẵn cả layout lẫn một màn hình không còn tồn tại. Nhu cầu thật là thứ ở trên: thiếu giá trị cũ thì
  "AI updated this" không kiểm chứng được, sửa đúng và sửa sai trông y hệt nhau, và cái Undo bên cạnh thành ra
  một cú tung đồng xu.)*

### UC-07: Huỷ một task trong nháp
- **Main flow:** "Thôi bỏ vụ rửa xe đi" → `delete_task`, card biến mất (có undo theo turn).
- **AC-07.1:** chỉ đúng task được nhắc bị xoá.
- **AC-07.2:** user undo được thao tác của turn gần nhất.

### UC-08: Agent hỏi lại khi mơ hồ

**Luồng chính**
1. Đang có 2 việc "gọi anh Nam…"; user nói "dời vụ gọi anh Nam sang tuần sau".
2. Agent gọi `ask_clarification`, **không đoán**.
3. Câu hỏi hiện ra kèm **đúng các lựa chọn của chính câu hỏi đó**.
4. User chạm một lựa chọn (hoặc tự gõ) → lượt sau xử lý bình thường.

- **AC-08.1:** câu hỏi ngắn, đúng ngôn ngữ user, nêu được các lựa chọn.
- **AC-08.2:** dữ liệu **không đổi** cho tới khi user trả lời.
- **AC-08.3:** trả lời bằng cách gõ tay luôn dùng được — lựa chọn dựng sẵn là lối tắt, không phải cổng chặn.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Model hỏi nhưng **không** nêu lựa chọn | Không hiện nút nào. "Có/Không" dựng cứng là câu trả lời sai cho "cái nào: gọi anh Nam hay gọi chị Lan?" — và đó chính là thứ đang có |
| Model nêu đúng **một** lựa chọn | Một lựa chọn không phải là chọn. Coi như không có |
| Model nêu quá nhiều lựa chọn | Cắt còn 4. Một hàng nút tràn ba dòng che mất chính câu hỏi |
| Lựa chọn trùng nhau | Bỏ trùng — hai nút giống hệt nhau không nói thêm được gì |
| Lựa chọn dài dòng | Cắt. Nút dài hơn câu hỏi thì câu hỏi không còn là thứ được đọc trước |
| Model vừa hỏi vừa sửa dữ liệu | **Bỏ mọi thay đổi của lượt đó.** AC-08.2 phải là một bảo đảm của code, không phải một lời nhờ trong prompt |
| User gõ tay thay vì chạm | Chạy như mọi lượt khác (AC-08.3) |
| Chạm một lựa chọn | Gửi đúng chữ trên nút — không phải một mã nội bộ mà user không thấy |

**Quyết định còn treo**
- Có nên cho model **hỏi liên tiếp** (hỏi → trả lời → hỏi tiếp) không? Hiện không cấm. Nếu thấy vòng lặp hỏi mãi thì mới cần chặn — chặn trước khi có bằng chứng sẽ cắt mất trường hợp hỏi hai bước hợp lý.

### UC-09: Sửa tay ngay tại danh sách
**Mô tả:** human-in-the-loop — user sửa nhanh bằng tay thay vì nói lại.

**Luồng chính**
1. AI ghi gần đúng: tiêu đề sai một chữ.
2. User sửa **ngay tại hàng đó**, không rời danh sách.
3. Nói tiếp thì AI biết bản đã sửa, không phải bản cũ.

- **AC-09.1:** sửa được tiêu đề **ngay tại danh sách**, không phải mở màn khác. Các trường còn lại (hạn, độ gấp, các bước) sửa ở màn chi tiết là đủ — chúng không phải thứ AI hay ghi sai một chữ.
  *(Câu cũ nói "ngay trên card". "Card" là Live Preview, một màn đã bỏ; và nó liệt kê bốn trường như nhau trong khi chỉ có một trường thực sự cần sửa tại chỗ. Nhu cầu thật: **sửa phải nhanh hơn nói lại** — nếu không thì người ta đọc lại từ đầu thay vì sửa, và cả ý tưởng human-in-the-loop hỏng.)*
- **AC-09.2:** thay đổi tay phản ánh vào snapshot của lượt AI kế tiếp — AI biết user đã sửa.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Sửa thành chuỗi rỗng | Giữ tên cũ. Một việc không tên là một việc không tìm lại được |
| Bấm ra ngoài giữa chừng | Lưu. Bỏ đi những chữ vừa gõ vì trỏ chuột đi chỗ khác là mất việc của người ta |
| Nhấn Esc | Trả về nguyên trạng — đó là ý nghĩa duy nhất Esc có |
| Không đổi gì rồi thoát | Không ghi gì, không sinh bản undo, không đẩy lên server |
| Đang ở chế độ chọn nhiều | Không vào sửa được. Ở đó chạm hàng nghĩa là chọn (AC-40.3) |
| Trong Thùng rác | Không sửa được — việc đã xoá thì sửa tên là vô nghĩa |
| Sửa xong rồi nói tiếp | Lượt AI kế tiếp thấy tên **mới** (AC-09.2) |
| Sửa lúc AI đang đọc lại chính hàng đó | Lượt AI về sau sẽ đè lên. Đã biết và chấp nhận: cửa sổ là vài giây và AI luôn kèm undo + diff (AC-06.2) |

**Quyết định còn treo**
- Cử chỉ vào chế độ sửa là **giữ lâu** trên cả hai nền. Nháy đúp đã thử và **không chạy được**: cú nháy thứ nhất kích hoạt "mở", nên màn chi tiết đã nằm trên trước khi cú thứ hai tới; muốn chữa thì phải cho cú nháy đơn chờ, tức bắt cử chỉ chính chậm lại vì một lối tắt phần lớn người dùng không dùng. Giữ lâu không sinh click nào cả. Nhưng nó vẫn không tự lộ ra. Màn chi tiết vẫn là đường ai cũng thấy. Chưa có cách nào tốt hơn mà không thêm một nút vào mọi hàng, và một nút bút chì trên mọi hàng thì vi phạm luật "trang trí không được lấn nội dung".

---

## Nhóm C — Lifecycle phiên (MVP)

### UC-10: Lưu phiên (commit)
- **Main flow:** user bấm "Lưu N việc" (hoặc nói "xong rồi") → toàn bộ draft ghi vào `tasks`, phiên `committed`, về Inbox.
- **AC-10.1:** ghi local trước (optimistic), sync nền lên Supabase.
- **AC-10.2:** sub-task ghi thành task con (`parent_id`).
- **AC-10.3:** phiên committed không nhận turn mới.

### UC-11: Hội thoại tự đóng khi bỏ quên

**Luồng chính**
1. User nói một câu, việc hiện ra, hội thoại đang mở.
2. Bỏ đó vài phút.
3. Hội thoại tự đóng — và **user biết**, chứ không phát hiện bằng việc câu tiếp theo làm sai.

- **AC-11.1:** không bao giờ mất chữ đã nói.
- **AC-11.2:** trạng thái không bao giờ đổi sau lưng: hội thoại tự đóng thì phải có gì đó trên màn hình nói ra.

> **Ghi chú viết lại (2026-08).** Bản cũ là "không có turn mới 2 phút → **auto-commit** + 'Đã lưu N việc' + Undo",
> và cả hai AC nói về **draft**. Kiến trúc đã bỏ khái niệm draft: câu chữ thành task thật ngay khi gõ (ADR-7),
> không có bước commit nào để tự chạy. Nên AC-11.1 bản cũ nay **đúng một cách rỗng** — không có draft nào để vứt,
> mọi thứ đã lưu từ đầu — còn AC-11.2 thì vẫn còn nguyên giá trị, chỉ là nói về thứ khác: cái tự đổi sau lưng
> không còn là "lưu" mà là **hội thoại đóng lại**. Cùng cách đã xử lý UC-10 và UC-13.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Bỏ đó quá thời gian nghỉ | Hội thoại đóng, **và nói ra** rằng câu tiếp theo sẽ tạo việc mới |
| User tự bấm "Done" | Không nói gì — đóng là điều họ vừa yêu cầu |
| Nói tiếp trước khi hết giờ | Đồng hồ đặt lại, không có thông báo nào |
| Mở lại app khi hội thoại đã nguội | Không khôi phục (UC-13) và **không** báo — không có gì vừa xảy ra trước mắt họ cả |
| Nói câu tiếp theo sau khi đã báo | Câu báo biến mất; việc mới được tạo như bình thường |
| Đóng lúc AI đang chạy dở | Không đóng giữa chừng — đồng hồ tính từ lượt cuối *hoàn tất* |

**Quyết định còn treo**
- Bản thiết kế cũ có **CountdownBar** đếm ngược trước khi đóng. Chưa làm, và nghi ngờ là không nên: một thanh đếm ngược
  nằm thường trực trên màn hình là đồ trang trí cho một sự kiện hiếm, và nó giục người ta trong khi cả điểm của
  local-first là không có gì phải vội. Báo *sau khi* đóng rẻ hơn và đủ, vì không có gì mất đi cả.

### UC-12: Chặn phiên quá dài
- **Main flow:** turn thứ 31 → server trả `409 commit_required` → app hiển thị "Phiên đã dài, mình lưu lại nhé" và commit.
- **AC-12.1:** không mất draft khi bị chặn.
- **AC-12.2:** user tiếp tục được ngay bằng incremental update trên task đã lưu.

### UC-13: Khôi phục sau crash/mất mạng

**Luồng chính**
1. User nói một câu, việc hiện ra, hội thoại đang mở ("nói tiếp để sửa").
2. App bị đóng — chuyển app, hết pin, crash.
3. Mở lại: **câu tiếp theo vẫn hiểu là sửa những việc vừa nói tới**, không phải tạo việc mới.
4. Nếu phiên đã quá cũ thì bắt đầu sạch, và điều đó nhìn thấy được.

- **AC-13.1:** mở lại app giữa một hội thoại đang mở thì **nói tiếp được về đúng những việc đó**, và trên màn hình thấy rõ là đang trong hội thoại.
  *(Câu cũ nói "bản nháp không mất". Kiến trúc đã bỏ khái niệm nháp: câu chữ thành task thật ngay lập tức, không chờ commit — nên thứ có thể mất khi đóng app không phải dữ liệu, mà là **ngữ cảnh hội thoại**. Việc thì vẫn còn; cái mất là "câu sau đang nói về cái gì".)*
- **AC-13.2:** turn gửi lúc mất mạng nằm hàng đợi, tự replay khi có mạng, UI báo trạng thái rõ.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Mở lại sau vài giây | Hội thoại tiếp tục, đúng các việc cũ |
| Mở lại sau vài giờ | **Không** khôi phục. Một thanh nhập ghi "nói tiếp để sửa" trỏ vào việc của sáng qua còn tệ hơn hẳn bắt đầu sạch |
| Việc trong ngữ cảnh bị xoá lúc app đóng | Id đó rụng khỏi ngữ cảnh; không còn việc nào thì bỏ luôn phiên |
| Đổi tài khoản | Phiên theo tài khoản. Ngữ cảnh trỏ vào task id của người khác là vô nghĩa **và** là rò rỉ |
| Đăng xuất | Phiên bị xoá cùng dữ liệu — nó chứa đúng câu người dùng đã nói (UC-28) |
| Bản ghi phiên hỏng | Bắt đầu sạch, không nổ. Phiên là thứ ít giá trị nhất trên đĩa: mất nó tốn một câu nói lại |
| Phiên rất dài | Chỉ giữ lại phần đuôi transcript — server vốn đã cắt còn 10 lượt, đĩa không cần giữ nhiều hơn |

**Quyết định còn treo**
- Sau khi khôi phục, có nên **hiện lại câu trả lời cuối của AI** không? Hiện thì user biết mình đang ở đâu; nhưng một câu AI xuất hiện lại lúc vừa mở app trông như AI vừa nói điều gì đó. Đang chọn hiện — cần người dùng thật để biết đúng sai.

---

## Nhóm D — Quản lý task (MVP)

### UC-14: Xem Inbox
- **AC-14.1:** mọi task committed hiện theo thời gian tạo; kéo-thả sắp xếp (`sort_order`).

### UC-15: Xem Today Focus
- **AC-15.1:** lọc task có `due_at` hôm nay hoặc status `today`; đếm số việc còn lại.

### UC-16: Hoàn thành / xoá task
- **AC-16.1:** hoàn thành / bỏ hoàn thành bằng **một chạm**, phản hồi tức thì. Hình thức cử chỉ (swipe, animation) không phải điều kiện nghiệm thu.
- **AC-16.2:** xoá là soft delete (`deleted_at`), khôi phục được.

### UC-17: Đồng bộ đa thiết bị
- **AC-17.1:** thay đổi trên thiết bị A xuất hiện trên B ≤ 3 giây khi cùng online (Realtime). Đo bằng `pnpm sync:latency` — hai client trong **một tiến trình, một đồng hồ**, vì đo bằng hai máy thật sẽ cộng lệch đồng hồ giữa chúng vào kết quả. Localhost: median 118 ms.
- **AC-17.2:** xung đột offline giải quyết last-write-wins theo `updated_at`, không duplicate.
- **AC-17.3:** **UC-22 (đăng nhập) là điều kiện trước.** RLS là `user_id = auth.uid()`; không có phiên người dùng thật thì không có dòng nào đọc hay ghi được. Đây là ràng buộc kỹ thuật, không phải thứ tự ưu tiên.

---

## Nhóm E — Giai đoạn 2 (Should-have)

> **UC-20 đã rời nhóm này vào MVP** (15/08/2026, ADR-11) và được viết lại đầy đủ tại chỗ cũ bên dưới. Giữ nó
> nằm đây thay vì chuyển sang Nhóm J là có chủ ý: mã UC được trích dẫn trong code, và di chuyển một mục chỉ để
> cho gọn tài liệu là cách rẻ nhất để làm hỏng những trích dẫn đó.

### UC-18: Incremental update task đã lưu
- **Main flow:** mở task đã lưu → bấm mic → session MỚI với task inject vào context → nói để nhồi thêm note/sub-task → lưu là update task đó.
- **AC-18.1:** thay đổi áp vào task cũ, không tạo task trùng.

### UC-19: Widget màn hình chính
- **AC-19.1:** capture từ widget không cần mở app; nội dung vào Inbox như UC-01.

### UC-20: App nói lại — ĐÃ CHUYỂN VÀO MVP (15/08/2026), bản tối giản

> **Đổi vị trí, không phải đổi nội dung nhỏ.** Bản cũ là một dòng — *"nút nghe tóm tắt draft/danh sách hôm nay
> khi bận tay"* — và nằm ở Giai đoạn 2. [ADR-11](01-architecture.md#8-quyết-định-kiến-trúc-adr-tóm-tắt) kéo nó
> vào MVP, vì voice-first mà chỉ có giọng đi **vào** thì vẫn phải nhìn màn hình để biết máy hiểu đúng chưa —
> đúng thứ mà mọi app "voice-first" hiện có đang làm. Nói lại là chỗ khác biệt, không phải một nút thêm.

**Mô tả.** App đọc câu trả lời của mình thành tiếng. **Bản tối giản có chủ ý:** đọc được, tắt được, và **không**
hứa ngắt lời giữa câu rồi nói tiếp đúng chỗ — theo chính bản pitch, đó mới là phần đắt (*"Speech out, and
cutting in"*), và hứa nó ở vòng này là hứa thứ chưa ai đo được.

**Luồng chính**
1. Người dùng nói một câu, tay đang bận.
2. App trả lời — bằng chữ trên màn hình **và** bằng tiếng.
3. Người dùng nghe xong, nói câu tiếp theo; app ngừng đọc để nghe.
4. Không muốn nghe nữa thì tắt, và tắt rồi không mất thông tin nào.

- **AC-20.1:** người dùng **biết app đã hiểu gì mà không cần nhìn màn hình**. Nghiệm thu: bịt màn hình, chạy đủ
  một lượt tạo việc và một lượt sửa việc, người nghe thuật lại đúng việc nào vừa đổi.
- **AC-20.2:** **mọi câu app nói đều có bản chữ.** Tắt tiếng, hoặc máy đang im lặng, thì không mất thông tin nào.
  Đây là điều kiện để AC-20.3 và AC-52.8 khả thi.
- **AC-20.3:** tắt được, và **không phát tiếng ra ngoài ý muốn** — máy đang ở chế độ im lặng hoặc vừa rút tai
  nghe thì không có tiếng nào ra loa ngoài.
- **AC-20.4:** người dùng **ngắt được việc đọc ngay lập tức và nói được ngay sau đó**. *(Hai giới hạn có chủ ý,
  sửa lời trong audit 15/08: ngừng-để-nghe chứ không phải nói tiếp đúng chỗ đã ngắt — phần đó chưa hứa; và cách
  ngắt là **chạm rồi nói** với mô hình mic hiện tại. "Nói đè để ngắt" đòi mic mở suốt lúc app đang phát tiếng —
  một quyết định quyền riêng tư/pin chưa ai ra, và một cái mic mở cạnh loa sẽ nghe thấy chính app.)*
- **AC-20.5:** thiết bị **không có năng lực đọc** thì mọi thứ còn lại vẫn chạy nguyên vẹn và không có lỗi nào
  nổi lên — cùng nguyên tắc với AC-23.3.
- **AC-20.7** *(chốt 15/08)*: **tiếng là bản tóm cho tai, không phải bản chữ đọc nguyên văn.** Mỗi lượt đọc
  **đúng một câu**; danh sách không đọc từng dòng — đọc **con số và điểm đáng chú ý** (*"Năm việc ngày mai, sớm
  nhất chín giờ"*), chi tiết nằm trên màn hình. Cấu trúc app đã đứng sẵn về phía luật này: phần chi tiết (hàng
  việc, diff cũ→mới) do **client vẽ** từ `changedIds`, không phải do model kể — nên model chỉ việc nói ngắn mà
  màn hình không nghèo đi. Prompt hiện hành đã có nửa luật này (*"ONE short confirmation sentence… no list of
  every field"*); AC này nâng nó thành lời hứa sản phẩm và phủ thêm hai chỗ mới: **câu trả lời tra cứu**
  (UC-54) và **lời báo bước** (AC-54.8 — vài chữ, kiểu *"Đang tìm trong Work…"*). Nghiệm thu đếm được: một lượt
  = một câu đọc; kịch bản eval phạt câu trả lời liệt kê.
- **AC-20.6:** người dùng **nghe được tóm tắt ngắn của ngày hôm nay mà không cần nhìn màn hình**. *(Khôi phục
  15/08: đây chính là nội dung GỐC của UC-20 — "nghe tóm tắt danh sách hôm nay khi bận tay" — bị rơi mất trong
  lần viết lại thành "app đọc câu trả lời". Điểm đáng giá của nó: tóm tắt lắp từ dữ liệu đã có trên máy, nên
  **không cần model và chạy được cả khi mất mạng** — không phá luật "mất mạng thì không hội thoại", vì đây là
  app đọc danh sách chứ không phải một lượt hội thoại. Hỏi bằng câu — "hôm nay có gì?" — thì đi qua hội thoại
  như mọi câu khác, và cần mạng.)*

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Máy đang ở chế độ im lặng | Không phát ra loa ngoài. Bản chữ vẫn đủ để hiểu (AC-20.2) |
| Vừa rút tai nghe giữa lúc đang đọc | Ngừng đọc, không nhảy ra loa ngoài |
| Người dùng chạm mic khi đang đọc | Ngừng đọc, nghe ngay. Không đọc nốt phần còn lại rồi mới nghe |
| Câu trả lời lẫn tiếng Việt và tiếng Anh | Không được đọc sai thứ tiếng tới mức không hiểu. Chưa chốt cách làm — xem "còn treo" |
| Thiết bị không có năng lực đọc | Im lặng, không lỗi, không nút chết nằm đó (AC-20.5) |
| Câu trả lời rất dài | Không đọc lê thê — một câu, con số + điểm đáng chú ý (AC-20.7). Điều đáng nghe là **việc nào vừa đổi**, không phải toàn văn |
| Đang đọc thì mất mạng | Đang đọc là việc trên máy, mạng đứt không cắt ngang câu đang đọc |
| Nhiều lượt liên tiếp | Không chồng hai giọng lên nhau |

**Quyết định còn treo**
- **Ngắt lời giữa câu rồi nói tiếp đúng chỗ.** Cố ý không hứa ở vòng này. Khó không nằm ở chỗ ngừng — nằm ở chỗ
  **không đọc lại đoạn đã đọc** khi nói tiếp.
- **Đọc bằng năng lực nào, và câu lẫn hai thứ tiếng thì sao?** Nói lẫn Việt–Anh trong một câu là chuyện thường ở
  đây, và một giọng chọn sai thứ tiếng còn khó nghe hơn không đọc.
- **Bao giờ thì đọc?** Mọi lượt, hay chỉ khi có dấu hiệu rảnh tay? Đọc mọi lượt lúc đang ngồi họp là lý do người
  ta tắt tính năng này và không bật lại.

### UC-21: Đổi model AI (vận hành)
**Actor:** developer/operator.
- **Main flow:** sửa `ai_config.model_spec` → mọi request sau dùng model mới, không deploy lại.
- **AC-21.1:** eval harness chạy được với model mới và xuất bảng so sánh trước khi đổi production.
- **AC-21.2:** telemetry `ai_requests` phân tách được chất lượng/chi phí theo `model_spec`.

---

## Nhóm F — Tài khoản, quyền & đường thất bại (MVP)

### UC-22: Đăng ký / đăng nhập & first-run
- **Main flow:** mở app lần đầu → đăng nhập Apple/Google/email (Supabase Auth) → màn Capture với hint hướng dẫn; lần nói đầu tiên chính là onboarding (không có tour dài).
- **AC-22.1:** iOS có Sign in with Apple (bắt buộc khi có social login khác).
- **AC-22.2:** đăng nhập xong ≤ 3 chạm là capture được ("lười là thượng đế" áp cả cho onboarding).
- **AC-22.3:** session token tự refresh; hết hạn không mất draft đang mở.

### UC-23: Quyền mic/speech bị từ chối
**Mô tả:** đường thất bại phổ biến nhất của app voice-first.
- **Main flow:** user từ chối quyền mic → app KHÔNG chặn: nhập text đầy đủ chức năng; nút mic chuyển trạng thái `denied` với tooltip "Cấp quyền trong Cài đặt để nói".
- **AC-23.1:** xin quyền đúng lúc (trước lần nói đầu), kèm giải thích ngắn — không xin ngay khi mở app.
- **AC-23.2:** ở trạng thái denied, mic **vẫn còn trên màn hình nhưng mờ đi**, và chạm vào nó thì user **đến được
  hoặc biết được** chỗ cấp lại quyền — nền nào có đường dẫn thì mở thẳng, nền nào không có thì nói ra chỗ đó.
  *(Câu cũ — "deep-link đến Settings của app" — là lời giải của riêng mobile. Trình duyệt **không** mở được bảng
  quyền của chính nó: không có URL nào như vậy, và đó là cố ý, vì một trang mở được bảng đó cũng dẫn được người
  ta đi cấp quyền. Nêu nhu cầu thay vì nêu đường dẫn, đúng như quy ước "platform behaviour is stated as a
  capability" trong CLAUDE.md.)*
- **AC-23.3:** trình duyệt **không có Web Speech API** thì mic tự ẩn, không hiện lỗi. Dò theo **năng lực** (`SpeechRecognition ?? webkitSpeechRecognition`), tuyệt đối không theo tên trình duyệt: Safari có API này từ 14.1 (macOS) / 14.5 (iOS), chỉ Firefox là tắt mặc định.

### UC-24: Input không phải task

**Mô tả:** user nói lan man, hỏi chuyện, hoặc nhờ làm một việc **ngoài bốn động từ** (ADR-8).

> **Mở rộng 15/08/2026.** Bản cũ chỉ nói về *tán gẫu* — "Hôm nay trời đẹp nhỉ". Nhưng câu ngoài phạm vi hay gặp
> hơn nhiều là **nhờ làm hộ một việc**: *"tìm trên mạng giá iPhone 17"*, *"đặt vé cho tôi"*. Hai thứ này cần hai
> cách trả lời khác nhau, và trước 15/08 **không có luật nào trong prompt** phân biệt — thứ duy nhất giữ UC này
> đứng là việc model không có tool nào để tìm web. Nó vẫn tạo được một task **tên đúng như câu hỏi**.

**Luồng chính**
1. User nói một câu app không làm được.
2. App **không im lặng và không giả vờ làm được**.
3. App đưa ra thứ duy nhất nó thật sự làm được: **ghi lại giùm**.
4. User nhận hoặc bỏ qua; không có gì bị tạo ra sau lưng.

- **AC-24.1:** không tạo task rác từ câu không có ý định công việc.
- **AC-24.2:** câu chào/cảm ơn/tán gẫu không bị tính là turn lỗi; phiên vẫn tiếp tục bình thường.
- **AC-24.3:** câu **nhờ làm một việc ngoài phạm vi** không bị im lặng bỏ qua, cũng không được tạo task một cách
  âm thầm. App nói ra rằng nó không làm việc đó, và **đề nghị ghi lại thành việc** — đó là thứ duy nhất một app
  todo có thể đưa ra một cách thật thà. Task chỉ được tạo khi user nhận lời.
- **AC-24.4:** người dùng **hiểu ranh giới sau một lần gặp**, chứ không phải đoán bằng cách thử. Câu từ chối nói
  app làm gì, không chỉ nói app không làm gì.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| *"Tìm trên mạng giá iPhone 17"* | Không tìm. Đề nghị ghi thành việc *"tìm giá iPhone 17"*, tạo **khi user nhận** |
| Câu vừa có việc vừa có phần ngoài phạm vi | Phần là việc thì ghi; phần ngoài phạm vi thì nói rõ là không làm. Không âm thầm bỏ nửa câu |
| *"Đặt vé máy bay đi Đà Nẵng"* | Ngoài phạm vi để **thực hiện**, nhưng là một việc hoàn toàn hợp lệ để **ghi**. Đề nghị ghi |
| Tán gẫu thuần ("trời đẹp nhỉ") | Không đề nghị ghi gì cả — không có việc nào ở đây. Đây là chỗ AC-24.3 khác AC-24.1 |
| User từ chối lời đề nghị | Không tạo gì, không hỏi lại lần hai trong cùng phiên |
| Hỏi đi hỏi lại cùng một thứ ngoài phạm vi | Không lặp nguyên văn một câu từ chối tới lần thứ ba — lặp y hệt đọc như máy hỏng |
| Câu ngoài phạm vi khi **đang tắt tiếng** | Vẫn hiện bằng chữ (AC-20.2) |

**Quyết định còn treo**
- **Ranh giới "ngoài phạm vi" nằm ở đâu cho câu nửa nạc nửa mỡ?** *"Nhắc tôi hỏi Linh xem giá bao nhiêu"* là một
  việc; *"giá bao nhiêu"* thì không. Chưa có ca eval nào cho vùng giữa.
- **Có nên đếm lượt ngoài phạm vi vào hạn mức ngày không?** Nó vẫn tốn một lượt model. Chưa quyết.

### UC-25: Lỗi AI / timeout / retry
- **Main flow:** provider lỗi hoặc quá 15s → bubble "Không xử lý được, thử lại?" + nút retry; input và draft giữ nguyên.
- **AC-25.1:** transcript thô đã persist trước khi gọi AI (liên đới AC-01.3) — retry không cần nói lại.
- **AC-25.2:** lỗi được ghi vào `ai_requests.error`; 3 lỗi liên tiếp → gợi ý "lưu nháp thô, xử lý sau".
- **AC-25.3:** retry idempotent — không tạo double task khi request đầu thực ra đã thành công.

---

## Nhóm G — Nhắc nhở & dữ liệu cá nhân

### UC-26: Nhắc nhở theo reminder/deadline (Giai đoạn 2–3)
**Mô tả:** dùng `reminder_at`/`due_at` đã có trong schema — hiện là trường dữ liệu chưa có tính năng tiêu thụ.
- **Main flow:** đến `reminder_at` → push notification (Expo Notifications / Web Push) "⏰ Họp team lúc 14:00"; chạm vào mở Task Detail.
- **AC-26.1:** nhắc đúng thời điểm người dùng đã đặt, sai số ±1 phút — đo bằng `pnpm reminder:latency`, đọc giờ nhận từ **bên trong** tiến trình vì không đọc được từ ngoài. Simulator: -488 ms. Đúng múi giờ kể cả khi đổi zone là **đúng do cấu tạo**: lên lịch bằng mốc tuyệt đối (`Date`), hệ điều hành quy đổi một lần lúc bắn. **Chỉ phủ ca app đang chạy** — app bị OS giết thì chưa đo được, và không được tính là đã nghiệm thu.
- **AC-26.2:** task done/xoá thì notification bị huỷ.
- **AC-26.3:** user tắt được nhắc nhở theo từng task và toàn cục.

### UC-27: Sửa task đã lưu bằng tay
**Mô tả:** bổ khuyết UC-16 — sửa trực tiếp không qua AI.
- **Main flow:** Task Detail → chạm trường → sửa title/note/due/priority/sub-task → lưu.
- **AC-27.1:** sửa tay cập nhật `updated_at` (tham gia sync LWW như mọi thay đổi).
- **AC-27.2:** hạn chót và nhắc nhở là **hai mốc riêng**, và người dùng phải biết mốc nào phát ra tiếng. Đặt hạn **không** tự tạo nhắc nhở: *"báo cáo hạn thứ Sáu, nhắc tôi thứ Tư"* là một câu hợp lý mà một trường gộp không diễn đạt nổi, còn tự gắn nhắc cho mọi hạn là đoán hộ rằng hạn nào cũng đáng kêu.
  *(Đối chiếu app cùng loại trước khi chốt: Things 3 tách rời như ta; Apple Reminders gộp làm một; Todoist/TickTick tự gắn nhắc khi hạn có giờ. Bản cũ ghi "đổi `due_at` reschedule notification", mô tả một hành vi chưa từng tồn tại — nhắc nhở chỉ đọc `reminderAt`.)*

### UC-28: Quyền riêng tư & xoá dữ liệu
**Mô tả:** bắt buộc trước khi lên App Store/Play Store.
- **Main flow:** Settings → "Xoá lịch sử hội thoại" (xoá `capture_sessions.messages` + `captures.raw_text` ngay, không đợi retention 90 ngày) hoặc "Xoá tài khoản" (xoá toàn bộ, có xác nhận 2 bước).
- **AC-28.1:** xoá tài khoản hoàn tất ≤ 30 ngày, app hiển thị chính sách rõ.
- **AC-28.2:** transcript không bao giờ được dùng cho mục đích ngoài xử lý phiên + debug khi user đồng ý báo lỗi.

---

## Nhóm H — Tích hợp hệ sinh thái (Giai đoạn 3)

### UC-29: Tạo issue Jira/GitHub bằng giọng nói
- **Main flow:** "Tạo bug trên GitHub: crash khi mở camera" → Agent gọi tool `create_github_issue` (sau khi user đã kết nối OAuth) → preview issue → user xác nhận → tạo.
- **AC-29.1:** không bao giờ tạo issue ra ngoài mà không có bước xác nhận (human-in-the-loop giữ nguyên với external action).
- **AC-29.2:** kết nối/ngắt kết nối tích hợp trong Settings.

### UC-30: Đưa lịch hẹn vào Google/Apple Calendar
- **Main flow:** task có giờ cụ thể → gợi ý "Thêm vào Calendar?" → 1 chạm tạo event.
- **AC-30.1:** sửa/xoá task đồng bộ trạng thái event (hoặc ghi rõ là one-way).

---

## Ma trận truy vết UC → thành phần

| UC | core | ai | chat-intent | mobile | web | DB |
|---|---|---|---|---|---|---|
| UC-31..38 (CORE) | types | — (không phụ thuộc) | — | Inbox/Detail/Search UI | Inbox/Detail/Search UI | tasks (đủ schema sẵn) |
| UC-01..04 | reducer | schemas/prompt/agent | ✓ | Capture | Capture | captures, sessions |
| UC-05..08 | reducer + snapshot | agent + ask_clarification | ✓ | Live Preview | Live Preview | sessions |
| UC-09 | reducer | — | — | card edit | card edit | — |
| UC-10..13 | types | — | hard limit | commit flow | commit flow | tasks, sessions |
| UC-14..17 | types | — | — | Inbox/Today | Inbox/Today | tasks + Realtime |
| UC-18..20 | — | prompt (existingTaskContext) | ✓ | ✓ | ✓ | tasks |
| UC-21 | — | provider registry + eval | ai_config | — | — | ai_config, ai_requests |
| UC-22..23 | — | — | verify JWT | Auth UI + permission | Auth UI | auth.users |
| UC-24..25 | — | prompt + eval case mới | error path | error UI | error UI | ai_requests |
| UC-26..27 | types | — | — | Notifications + edit UI | Web Push + edit UI | tasks |
| UC-28 | — | — | endpoint xoá | Settings | Settings | mọi bảng user |
| UC-29..30 | — | tools mới (MCP) | ✓ | Settings OAuth | Settings OAuth | integrations (bảng mới) |
| UC-53 (giao cho OS) | — | `offer_action` (còn treo, xem UC-53 mục 4) | — | cửa + xin quyền | cửa (`tel:`/`mailto:`) | — |
| UC-54 (toàn danh sách) | hợp nhất map ref→id + `mergeDraftBack` | tool `find_tasks` trong schemas + agent | truy vấn `tasks` lọc `user_id` + mint ref | flush sync trước lượt | flush sync trước lượt | `tasks` (đã sync, UC-17) |
| UC-52 (voice-first) | `contextIds`/`changedIds` sẵn từ `mergeDraftBack` | — (ADR-9: tầng `ai` không biết gì thêm) | endpoint đọc lịch sử + đóng phiên; **vá thứ tự `saveCapture`** | mặt hội thoại | mặt hội thoại | `capture_sessions` (`messages`, `status`, `closed_reason`), `captures.status` |

---

## Nhóm I — Gap phát hiện khi đối chiếu app cùng loại (2026-08)

> Bổ sung sau khi rà `packages/core` và so với Things 3, Todoist, TickTick, Apple Reminders.
>
> **Cách đọc:** mỗi UC gồm ba phần — **Luồng chính**, **Edge case & validation** (bảng: tình huống → hành vi
> mong đợi, dùng thẳng làm test case), và **Đã chốt** / **Quyết định còn treo**. Câu hỏi chưa trả lời được đặt ở
> phần ba, KHÔNG viết lẫn vào AC: một AC không kiểm chứng được thì không phải AC.
>
> Mục **Đã chốt (mặc định)** là quyết định thiết kế lấy phương án ít rủi ro nhất để không chặn việc code —
> kèm lý do. Đổi được, nhưng đổi là một quyết định có chủ đích chứ không phải khoảng trống.
>
> **Thiết kế xuyên UC** (mô hình điều hướng, API parser ngày, màn chi tiết, phân tuyến test) nằm ở
> [09-design-nhom-I.md](09-design-nhom-I.md) — không lặp lại ở đây. Thiết kế chỉ phục vụ đúng một UC
> (ví dụ schema bảng `lists`) thì nằm lại trong UC đó, vì nó là một phần của tiêu chí nghiệm thu.

---

### UC-41: Lists / Projects do người dùng tạo

**Luồng chính**
1. Mở drawer → "List mới…" → nhập tên → list xuất hiện, đang rỗng.
2. Vào list, gõ/nói vào thanh nhập → task tạo thẳng trong list đó.
3. Drawer hiện tên list kèm số việc **chưa xong**.
4. Xoá list → hỏi việc bên trong đi đâu → chọn → xong.

- **AC-41.1:** tạo / đổi tên / xoá list.
- **AC-41.2:** một task thuộc **tối đa một** list. Mô hình nhiều-nhiều làm việc xoá trở nên mơ hồ.
- **AC-41.3:** số trong drawer đếm việc **chưa xong** (không tính done, archived, đã xoá mềm).
- **AC-41.4:** AI đặt được list khi tạo task, và **không được tạo list mới** — không khớp thì `ask_clarification`.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Tên rỗng hoặc chỉ khoảng trắng | Từ chối, giữ sheet mở, không tạo gì |
| Tên trùng list đã có | **Cho phép** (id mới là khoá), nhưng cảnh báo tại chỗ: "Đã có list tên này" |
| Tên dài > 40 ký tự | Lưu đủ, hiển thị cắt bằng ellipsis; không chặn |
| Xoá list **rỗng** | Xoá thẳng, không hỏi |
| Xoá list còn việc | Bắt buộc chọn: về Inbox / xoá theo / huỷ. Không có mặc định im lặng |
| Chọn "xoá theo" | Việc bị **xoá mềm** (vào Trash 30 ngày), không xoá cứng |
| Khôi phục task từ Trash mà list gốc đã bị xoá | Task về **Inbox**, không tự tạo lại list |
| AI nói "thêm vào Work" mà có list "work" (khác hoa/thường hoặc khác dấu) | **Khớp**, không hỏi lại |
| AI nói tên list không tồn tại | `ask_clarification`, tuyệt đối không tạo mới |
| Hai máy cùng tạo list trùng tên khi offline | Thành **hai list riêng** sau sync. LWW không gộp được; ghi rõ giới hạn này |
| Task đang mở ở màn khác lúc list bị xoá | Màn đó đóng về Inbox, không để lại tham chiếu treo |
| Số list rất lớn (>30) | Đến được list bất kỳ mà không mất phương hướng — các đích cố định (Inbox/Today/Upcoming) không bị đẩy khỏi tầm mắt. Hiện thoả bằng cách cuộn: nhóm Lists nằm giữa, đích cố định neo trên, kho lưu trữ neo dưới. **Phân trang hay "Xem tất cả" là một giải pháp, không phải yêu cầu** — chỉ thêm khi có người thật chạm ngưỡng đó |

**Đã chốt (mặc định)**
- **Màu list: bảng 8 màu cố định, độ bão hoà thấp**, gán vòng tròn theo thứ tự tạo, người dùng đổi được trong 8 màu đó — không có color picker tự do. Chấm 9px là nơi DUY NHẤT màu này xuất hiện; nó là *dữ liệu* của người dùng, không phải màu của hệ, nên không phá luật "một accent". Token đặt ở `ui-tokens` (`listPalette: string[8]`).
- **Thứ tự list: theo thời gian tạo (append)**, chưa kéo thả trong v1 — kéo thả list là phạm vi của một vòng sau, đừng gộp vào đợt đã đắt nhất.
- **Data model:**
  - Bảng `lists`: `id uuid pk` · `user_id` · `name text not null` · `color smallint not null default 0` (chỉ số vào palette, không phải mã hex — đổi palette không cần migration dữ liệu) · `sort_order` · `created_at` · `deleted_at`. RLS: own-rows theo `user_id`, cùng khuôn các bảng hiện có.
  - `tasks.list_id uuid null references lists(id)` — nullable: task không thuộc list nào là hợp lệ (đó chính là "Inbox").
  - Client: `LocalList { id, name, color, sortOrder, createdAt, deletedAt?, pendingSync }`; `LocalTask.listId?: string | null`. Kho riêng `todo-ai:lists:v1`, parse từng bản ghi như `parseTask` (một bản hỏng không giết cả danh sách).
- **Hợp đồng tool AI:** KHÔNG thêm tool mới. `create_tasks` item và `update_task.changes` nhận thêm `list?: string` (tên, không phải id — agent không bao giờ thấy id thật, cùng nguyên tắc draft-ref). System prompt nhận danh sách tên list hiện có trong phần ngữ cảnh động; schema mô tả ghi rõ *"must be one of the existing list names; if the user names a list that doesn't exist, call ask_clarification instead"*. Khớp tên ở client khi commit: chuẩn hoá hoa-thường + bỏ dấu; không khớp được (race: list vừa bị xoá) → task về Inbox kèm flash, không chặn commit.

---

### UC-42: Upcoming — việc sắp tới

> **15/08/2026 — Upcoming bắt đầu từ NGÀY MAI.** Nhóm "Today" và nhóm "Overdue" đều gỡ khỏi màn này.
>
> Lý do: cùng một dữ liệu được vẽ ở hai màn với hai luật thứ tự khác nhau. Today xếp theo thứ tự người dùng tự kéo (UC-43), Upcoming xếp theo đồng hồ — nên hai việc lúc 3h và 6h chiều hiện ra **ngược nhau** ở hai chỗ. Phát hiện khi chạy lại audit v4.
>
> Chữa bằng cách bỏ chỗ **chồng lên nhau**, không phải bằng cách ép hai màn dùng chung một luật: chúng trả lời hai câu khác nhau. Today là *"tôi định làm theo thứ tự nào"* — của người dùng. Upcoming là *"lịch của tôi trông ra sao"* — của đồng hồ. Ép Upcoming xếp tay thì những ngày **tương lai** hiện theo thứ tự tạo việc, mà một ngày chưa sống tới thì chẳng có thứ tự nào để mà quyết.
>
> Không mất gì: `todayTasks` đã gồm cả việc quá hạn và Today tách chúng thành nhóm riêng, nên đường duy nhất để một việc trễ bị bỏ quên là người dùng không mở Today — mà đó là màn chính. Cái tên "Upcoming" cũng tự nói vậy: nó là những gì phía trước.
>
> Kéo theo một lỗi phải sửa: `formatDayHeading` suy nhãn từ **vị trí** trong mảng (`index === 0` là "Today"), nên ô đầu vẫn ghi "Today" trong khi nó đã là ngày mai. Nay suy từ chính ngày. Một cái nhãn suy ra từ vị trí thì không có cách nào tự biết mình đang nói dối.


**Luồng chính**
1. Mở Upcoming → thấy 7 ngày tới, nhóm theo ngày.
2. Việc quá hạn gom thành nhóm riêng ghim trên đầu.
3. Ngày không có việc vẫn hiện, để nhìn ra chỗ trống.

- **AC-42.1:** nhóm theo ngày, đủ xa để thấy hết **tuần tới** (hiện chốt 7 ngày — con số chọn theo phán đoán, chưa có dữ liệu dùng thật); ngày trống vẫn render.
- **AC-42.2:** quá hạn là nhóm riêng ở đầu, **không** trộn vào ngày tương lai.
- **AC-42.3:** suy hoàn toàn từ `dueAt` — không thêm trường dữ liệu nào.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Task không có `dueAt` | **Không xuất hiện** ở Upcoming (nó sống ở Inbox) |
| `allDay = true` | Nhóm theo ngày, **không hiện giờ** |
| Task quá hạn nhiều ngày | Vẫn nằm nhóm "Quá hạn", không tạo nhóm cho từng ngày quá khứ |
| Task due **sau** 7 ngày | Không hiện trong 7 nhóm, nhưng có dòng tổng kết "Sau đó · N" để nó không tàng hình |
| Task đã done trong khoảng đó | **Ẩn** — Logbook (UC-45) mới là nơi của nó |
| Task đang snooze, due nằm trong khoảng | **Ẩn** cho tới khi hết snooze. Snooze nghĩa là ẩn |
| Task lặp (`recurrence`) | Chỉ hiện **lần kế tiếp**, không trải hết chuỗi tương lai |
| App mở qua nửa đêm | Tính lại nhóm khi màn hình được focus lại, không để "Hôm nay" đứng sai ngày |
| Đổi timezone / DST | Nhóm tính theo ngày lịch ở timezone hiện tại của máy |
| Không có việc nào trong cả 7 ngày | Empty state, không hiện 7 nhóm rỗng liên tiếp |

---

### UC-43: Sắp xếp tay (kéo thả)

> **Mở rộng 15/08/2026: kéo thả là cách sắp xếp DUY NHẤT.** Chế độ tự động đã bỏ hẳn — không còn `SortMode`, không còn `SortKey`, không còn hai hàng chip trong bảng View, không còn hai khoá lưu.
>
> AC-43.2 cũ nói hai chế độ loại trừ nhau, "vì một danh sách vừa sắp theo hạn vừa nghe theo cú kéo sẽ âm thầm xoá cú kéo đó ngay khi một hạn thay đổi". Câu đó vẫn đúng — và nếu đã buộc phải chọn một trong hai thì cái đáng giữ là cái người dùng tự làm. Giữ cả hai bắt buộc phải có một nút để chuyển chế độ, rồi một nút nữa để chọn luật cho chế độ tự động: hai hàng điều khiển thường trực cho một câu hỏi mà mỗi người trả lời đúng một lần trong đời.
>
> **Cái mất, nói thẳng:** việc mới có hạn không còn tự nổi lên đúng chỗ theo giờ, và màn Today không còn tự xếp theo đồng hồ.
>
> **Hệ quả kéo theo — vị trí chèn.** Trước đây `sortOrder` gần như không ai thấy (mặc định là sắp theo hạn), nên việc mới rơi xuống cuối mà không ai để ý. Nay nó là thứ duy nhất quyết định thứ tự, nên **việc mới lên đầu**: thanh nhập ở đáy màn, và một việc rơi xuống hàng thứ 21 thì người vừa gõ nó không thấy gì xảy ra, kể cả cái nháy MO-2. Ngược lại, **bước mới xuống cuối** — các bước là một trình tự, "rã đông · ướp · nướng" mà hiện ra ngược thì không phải sắp xếp khác, mà là sai.

**Luồng chính**
1. Kéo một hàng lên/xuống → chỗ trống mở ra → thả. Không phải bật chế độ nào trước.
2. Thoát app, mở lại → thứ tự giữ nguyên.

- **AC-43.1:** thứ tự bền qua khởi động lại.
- **AC-43.2:** ~~thủ công và tự động là hai chế độ loại trừ nhau~~ → **thứ tự chỉ có một**, và nó là thứ tự người dùng tự xếp. Không còn chế độ nào để hiện.
- **AC-43.3:** một lần kéo chỉ ghi lại **một** bản ghi, không đánh số lại cả list.
- **AC-43.4:** việc mới xuất hiện ở chỗ người dùng **nhìn thấy được ngay** mà không phải cuộn.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Đang lọc | Không kéo được — thứ tự trên màn không phải thứ tự thật. Đây là điều kiện DUY NHẤT còn chặn kéo |
| Thả đúng chỗ cũ | Không ghi gì cả, không tạo bản undo |
| Kéo task cha có sub-task | Sub-task đi theo, giữ nguyên thứ tự bên trong |
| Kéo qua ranh giới nhóm (DONE / SNOOZED) | Từ chối, hàng bật về chỗ cũ |
| AI sửa list đúng lúc đang kéo | Huỷ thao tác kéo, ưu tiên dữ liệu mới, hiện flash ở hàng AI vừa đổi |
| `sortOrder` trùng nhau sau import/sync | Chuẩn hoá lại toàn list **khi load**, không phải khi kéo |
| Khoảng cách giữa hai `sortOrder` cạn kiệt | Đánh số lại toàn list một lần rồi tiếp tục |
| Kéo trong khi list đang lọc/tìm kiếm | Không cho kéo — thứ tự nhìn thấy không phải thứ tự thật |

**Đã chốt (mặc định)**
- **`sortOrder` là số thực, chèn bằng trung điểm.** Kéo vào giữa hai hàng có order `a` và `b` → order mới = `(a+b)/2`; kéo lên đầu → `first − 1`; xuống cuối → `last + 1`. Một lần kéo ghi đúng **một** bản ghi (thoả AC-43.3).
- **Đánh số lại** toàn list về số nguyên 0..n **khi load** nếu tồn tại cặp kề nhau có hiệu `< 1e-6` (float64 còn dư ~9 bậc an toàn) hoặc có giá trị trùng nhau (di sản import/sync). Đánh số lại nằm ở load-path chứ không phải drag-path — kéo phải luôn rẻ.
- Trường dữ liệu **không đổi** (`sortOrder` đã là number) — không cần migration.

---

### UC-44: Ghi chú cho task

**Luồng chính**
1. Mở chi tiết task → thấy note (nếu có).
2. Chạm vào note → sửa tại chỗ → rời focus là lưu.

- **AC-44.1:** xem và sửa `note` ở màn chi tiết.
- **AC-44.2:** hàng trong list **chỉ hiện tiêu đề**. Không ký hiệu, không preview, không icon.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Chưa có note | Hiện placeholder "Thêm ghi chú…", **không** lưu chuỗi rỗng — lưu `null` |
| Nhập rồi xoá hết | Trở về `null`, dấu hiệu ở hàng list biến mất |
| Chỉ có khoảng trắng / xuống dòng | Coi như rỗng → `null` |
| Note nhiều dòng | Giữ nguyên xuống dòng ở cả chi tiết lẫn bản xuất |
| Note rất dài (>2000 ký tự) | Chi tiết cuộn được; hàng list chỉ hiện dấu hiệu, không cắt chữ dài |
| AI ghi đè note lúc user đang gõ | Không ghi đè khi ô đang có focus; xong mới áp, kèm flash |
| Note chứa URL | v1 để **chữ thường**, không tự biến thành link |
| Muốn biết task nào có note | Mở chi tiết. Danh sách không nói — xem quyết định dưới |

**Đã chốt (mặc định)**
- **Hàng trong list không mang dấu hiệu nào cho note.** Bản đầu của AC-44.2 đòi "một dấu hiệu mảnh", và bản
  hiện thực đã dùng ký tự `¶`. Sai từ chính cái AC: nó chốt sẵn *giải pháp* ("một dấu hiệu") trước khi có ai
  kiểm tra app thật làm gì. Tra lại thì **không app todo nào dùng ký hiệu cho việc này**; Apple Reminders hiện
  hẳn một dòng preview xám dưới tiêu đề, còn tài liệu Things 3 và Todoist không mô tả dấu hiệu nào ở list view.
- Preview cũng bị loại: thêm một dòng cho mỗi task có note làm list rối, đi ngược thứ khiến màn này đáng nhìn.
  Tiêu đề là đủ; note là thứ bạn tự viết và cách đó đúng một chạm.
- Bài học ghi lại vì nó sẽ tái diễn: **một AC mô tả giải pháp thay vì mô tả nhu cầu là một AC chưa chín.**
  "Người dùng cần biết task nào có note" là nhu cầu — và hoá ra nhu cầu đó không đủ mạnh để trả giá bằng nhiễu.

---

### UC-45: Logbook — lịch sử việc đã xong

**Luồng chính**
1. Mở Logbook → việc đã xong nhóm theo **ngày hoàn thành**.
2. Cuộn xuống để đi ngược về quá khứ.
3. Bỏ done một việc → nó rời Logbook, về đúng list cũ.

- **AC-45.1:** nhóm theo `completedAt`, **không** theo `updatedAt`.
- **AC-45.2:** bỏ done trả task về list cũ qua `doneFrom`.
- **AC-45.3:** không **dựng** quá một trang dòng trong một lần render, dù lịch sử dài bao nhiêu. (Không phải "không đọc vào bộ nhớ": app local-first nên toàn bộ task đã nằm sẵn trong RAM từ lúc load — thứ cần bảo vệ là chi phí render.)

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Sửa tiêu đề một việc xong từ tháng trước | **Vẫn nằm ở ngày cũ**. Đây chính là lý do `completedAt` tách khỏi `updatedAt` |
| Việc xong rồi bị xoá | Không ở Logbook; nó ở Trash |
| Việc xong, khôi phục từ Trash | Quay lại Logbook đúng ngày `completedAt` cũ |
| `doneFrom` rỗng (dữ liệu cũ / vừa sync về) | Suy từ `dueAt`: due trong hôm nay → Today, còn lại → Inbox |
| Ngày không có việc nào xong | **Không render** ngày đó — quá khứ không cần nhìn thấy chỗ trống (khác Upcoming) |
| Lịch sử rất dài (>1000 việc) | Cuộn tải thêm theo lô; không dựng hết một lần |
| Task lặp đã xong nhiều lần | Mỗi lần hoàn thành là một dòng riêng ở đúng ngày của nó |
| Chưa xong việc nào bao giờ | Empty state, không hiện lưới ngày rỗng |

**Đã chốt (mặc định)**
- **Bỏ `"archived"` khỏi union `TaskStatus` phía client.** Logbook là mặt lịch sử duy nhất; một trạng thái không ai gán là một lời hứa chết trong type. **Không** tự động archive sau N ngày — lịch sử tự biến mất là mất dữ liệu trong mắt người dùng.
- Check constraint trong DB **giữ nguyên** (vẫn chấp nhận `'archived'`) để không cần migration phá vỡ; `parseTask` gặp `'archived'` từ dữ liệu cũ → map về `'done'` (giữ được `completedAt`, task hiện đúng trong Logbook thay vì biến mất).

---

### UC-46: Hiểu ngày giờ ngay trong quick-add (không cần AI)

> **Lỗ hổng ADR-7.** Hiện chỉ AI đặt được `dueAt`. Offline hoặc AI hỏng là không có cách nào đặt hạn —
> trong khi ADR-7 hứa app vẫn là todo app đầy đủ. Một todo app không đặt được hạn thì không còn là todo app.

**Luồng chính**
1. Gõ "mua sữa mai 5h" → phần "mai 5h" gạch chân ngay khi đang gõ.
2. Chip hiện giá trị đã quy đổi: `Mai 17:00`.
3. Gửi → task tên "Mua sữa", `dueAt` = mai 17:00. Không gọi mạng lần nào.

- **AC-46.1:** parser chạy trong `packages/core`, **thuần**, nhận `now` qua tham số (không đọc đồng hồ bên trong).
- **AC-46.2:** phần đã hiểu được đánh dấu **trước khi** lưu; chạm `×` bỏ hạn và **giữ nguyên chữ gốc**.
- **AC-46.3:** không chắc thì **không gán hạn**, giữ nguyên văn làm tiêu đề.
- **AC-46.4:** chỉ cắt **đúng đoạn đã khớp** ra khỏi tiêu đề, phần còn lại và khoảng trắng giữ nguyên.
- **AC-46.5:** có bộ test corpus trong repo, tối thiểu **40 ca**, gồm cả ca phải **từ chối**.

**Ngữ pháp cần hỗ trợ (v1)**

| Nhóm | Tiếng Việt | Tiếng Anh | Kết quả |
|---|---|---|---|
| Ngày tương đối | hôm nay, mai, mốt, tối nay | today, tomorrow, tonight | ngày + giờ mặc định theo buổi |
| Thứ trong tuần | thứ 2…CN, thứ 6 tuần sau | monday…sunday, next friday | lần xuất hiện **kế tiếp** |
| Giờ | 5h, 5 giờ, 17:00, 5h chiều | 5pm, 17:00, at 5 | giờ cụ thể |
| Buổi | sáng / trưa / chiều / tối | morning / noon / afternoon / evening | 09:00 / 12:00 / 15:00 / 20:00 |
| Chỉ có ngày | mai, thứ sáu | tomorrow, friday | `allDay = true` |

**Edge case & validation**

| Đầu vào | Hành vi mong đợi |
|---|---|
| "mai" (không giờ) | `allDay = true`, **không** bịa ra giờ nào |
| "5h" (không ngày) | Hôm nay nếu còn ở tương lai, ngược lại là mai |
| "at 5" / "5h" mơ hồ sáng-chiều | Thiên về **ban ngày**: 17:00, không phải 05:00 |
| "5am" / "5h sáng" | Tôn trọng chỉ định rõ ràng |
| "cuối tuần", "cuối tháng", "soon", "sắp tới" | **Không gán hạn**, giữ nguyên chữ (AC-46.3) |
| "hôm qua", "thứ 6 tuần trước" | Chấp nhận, tạo việc **quá hạn** — người ta có ghi lại việc đã trễ |
| Hai mốc thời gian mâu thuẫn trong một câu | **Không gán gì cả**, giữ nguyên văn |
| "gọi 0905 123 456" | **Không** khớp — số điện thoại không phải giờ |
| "họp 5 người" | **Không** khớp — số lượng không phải giờ |
| "task 24/7" | **Không** khớp |
| "31/2" hoặc "30 tháng 2" | Ngày không tồn tại → từ chối, giữ nguyên chữ |
| Chuỗi chỉ có mỗi thời gian ("mai 5h") | Từ chối tạo task — không có tiêu đề thì không có việc |
| Cắt xong tiêu đề còn rỗng | Như trên |
| Chữ hoa / thiếu dấu ("THU 6", "thu sau") | Vẫn khớp — chuẩn hoá trước khi so |
| Chạm `×` sau khi đã sửa chữ trong ô | Chỉ bỏ hạn, không hoàn tác phần chữ user vừa sửa |
| Qua nửa đêm giữa lúc gõ và lúc gửi | Tính theo `now` tại **thời điểm gửi**, không phải lúc gõ |

---

### UC-47: Capture từ share sheet

**Luồng chính**
1. Ở app khác → Share → Todo AI.
2. Task tạo trong Inbox, **không cần mở app**.
3. Mở app sau đó thấy task đã ở đó.

- **AC-47.1:** nhận `text/plain` và URL; tạo task mà không đưa người dùng vào app.
- **AC-47.2:** link giữ trong `note`, phần chữ làm tiêu đề.
- **AC-47.3:** ghi thẳng vào kho local dùng chung, không đi qua AI.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Chỉ có URL, không chữ | Tiêu đề = tên miền (`madamelan.vn`), URL đầy đủ vào `note`. **Không** tải trang để lấy title (cần mạng) |
| Đoạn text rất dài | Tiêu đề = câu/dòng đầu (cắt ~80 ký tự), toàn văn vào `note` |
| Text rỗng / chỉ khoảng trắng | Không tạo gì, đóng im lặng |
| Chia sẻ nhiều mục cùng lúc | Mỗi mục một task |
| Chia sẻ ảnh | App **không khai báo** nhận ảnh, nên OS tự loại nó khỏi share sheet. Không có thông báo, vì không có gì để thông báo — xem quyết định dưới. Đính kèm ảnh thuộc UC-51 |
| App đang bị kill | Vẫn phải chạy — extension không được phụ thuộc process chính |
| Chia sẻ khi offline | Ghi local như bình thường; đây vốn là đường không cần mạng |
| Cùng một URL chia sẻ hai lần | Tạo hai task. Không tự chống trùng — đoán ý người dùng ở đây rủi ro hơn là để họ tự xoá |

**Đã chốt (mặc định)**
- **Kiến trúc hàng đợi spool, không ghi thẳng vào kho task.**
  - **iOS:** Share Extension (target riêng, sinh qua config plugin — `ios/` là CNG nên KHÔNG sửa tay) + App Group `group.com.todoai.app`. Extension chạy sandbox riêng, không đọc được AsyncStorage của app chính → nó chỉ **append vào file spool JSON** trong App Group container rồi thoát. App chính **drain spool** khi launch/foreground: mỗi mục → `addTask` như quick-add.
  - **Android:** activity trong suốt nhận `ACTION_SEND text/plain`, cùng process với app → ghi spool cùng cơ chế (một đường drain duy nhất cho cả hai nền tảng) rồi `finish()`.
  - **Định dạng spool:** `[{ text: string, sharedAt: ISO }]` — tối giản có chủ đích; extension không được chứa logic parse tiêu đề/URL, phần đó nằm ở drain-path trong `packages/core` để test được.
  - Drain phải **idempotent**: đọc file → tạo task → xoá file trong cùng một lượt; app crash giữa chừng thì lần sau drain lại, trùng thì thôi (spool item không có id nên chống trùng bằng việc xoá-sau-ghi nguyên tử).
- **Ảnh: không nhận, và cách từ chối là KHÔNG xuất hiện.** Bản đầu của dòng edge case này ghi "từ chối kèm thông
  báo ngắn" — sai về mặt kỹ thuật. Muốn hiện được thông báo thì phải khai báo nhận ảnh, tức tự đưa mình vào share
  sheet rồi mới nói không; trải nghiệm đó tệ hơn hẳn việc biến mất. Chỉ khai báo `text/plain` + URL là đủ để hệ
  điều hành lọc hộ.
  Đây cũng đúng cách Things 3 làm, ghi thẳng trong tài liệu của họ:
  *"Things can only accept plain text as input. If you try to share content that's not supported (photos, PDF
  documents, etc.), the OS will intelligently omit Things from the Share menu."*
  ([Adding To-Dos From Other Apps](https://culturedcode.com/things/support/articles/2803569/)).
  Đối chiếu: Todoist **có** nhận ảnh qua share sheet (33 kiểu file, chọn *Todoist Task* hoặc *Todoist Comment*)
  và Apple Reminders có nút Photos ngay trong reminder — nên "nhận ảnh" là kỳ vọng hợp lý của thể loại, chỉ là
  nó thuộc UC-51 chứ không phải UC-47, và UC-51 vẫn đang bị chặn bởi UC-17.

---

### UC-48: Xuất / nhập dữ liệu

**Luồng chính**
1. Settings → "Xuất ra JSON" → nhận một file.
2. Máy khác → "Nhập từ file" → chọn file → báo cáo số bản ghi đã nhập / bỏ qua.

- **AC-48.1:** bản xuất gồm cả việc **đã xoá mềm** còn trong hạn 30 ngày.
- **AC-48.2:** nhập không tạo bản trùng — khớp theo `id`.
- **AC-48.3:** file có trường `version`; thiếu version thì coi là v1.
- **AC-48.4:** phong bì file chốt như sau:

```json
{
  "app": "todo-ai",
  "version": 1,
  "exportedAt": "2026-08-10T17:00:00+07:00",
  "tasks": [ /* LocalTask[] — nguyên trạng, gồm cả deletedAt trong hạn 30 ngày */ ],
  "lists": [ /* LocalList[] — từ khi có UC-41; thiếu khoá này vẫn là file hợp lệ */ ]
}
```

  Import đi qua đúng `parseTask`/`parseList` của storage — một đường validate duy nhất cho cả load lẫn import.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| File JSON hỏng | **Không đổi gì cả**, báo lỗi rõ. Không nhập một nửa |
| Một vài bản ghi sai định dạng | Bỏ qua từng cái, nhập phần còn lại, **báo số đã bỏ** — cùng triết lý với `parseTask` ở `storage.ts` |
| `version` mới hơn app đang chạy | Từ chối, bảo người dùng cập nhật app. Đoán mò schema tương lai là cách làm hỏng dữ liệu |
| `id` trùng với task đang có | **Bỏ qua**, không ghi đè. Đếm vào phần "đã bỏ qua" |
| File rỗng / mảng rỗng | Nhập thành công, 0 bản ghi. Không phải lỗi |
| File rất lớn (>10k task) | Nhập theo lô, có tiến độ, không khoá UI |
| Nhập khi đang offline | Chạy bình thường — đây là thao tác local |
| Task tham chiếu `parentId` không có trong file | Nhập như task gốc, bỏ `parentId` treo |
| Task có ảnh đính kèm (UC-51) | v1 **chỉ xuất reference**, ghi rõ trong file là ảnh không kèm theo |

---

### UC-49: Ngày bắt đầu tách khỏi hạn chót — ⏸ HOÃN

⚠️ **Chưa đủ điều kiện viết AC.** Đây là quyết định sản phẩm, không phải việc kỹ thuật: thêm một trường thời
gian nữa là thêm một khái niệm người dùng phải học, và `snoozedUntil` đang gánh một phần vai trò này.

**Cần trả lời trước:** người dùng thật có phân biệt "bắt đầu" với "hạn chót" không, hay chỉ cần "khi nào tôi
thấy nó"? Nếu là vế sau thì snooze đã đủ và UC này nên bỏ.

---

### UC-50: Chia sẻ / cộng tác (Giai đoạn 3) — 🚫 CHẶN bởi UC-17

⚠️ **Bị chặn.** Kéo theo toàn bộ bài toán quyền, xung đột và realtime. Chỉ nên bàn sau khi UC-17 (sync) chạy thật.

---

### UC-51: Đính kèm ảnh vào task — 🚫 CHẶN bởi UC-17

**Luồng chính**
1. Chạm camera ở thanh nhập → chụp/chọn ảnh → chip ảnh hiện trên ô nhập.
2. Nói/gõ câu lệnh → AI **đọc ảnh**, rút thông tin vào task.
3. Ảnh lên Supabase Storage, task giữ reference.

- **AC-51.1:** tối đa 3 ảnh mỗi task.
- **AC-51.2:** AI đọc ảnh và điền thông tin rút được vào task.
- **AC-51.3:** mất mạng thì ảnh nằm lại máy, task **dùng được ngay**, ảnh đẩy lên sau.
- **AC-51.4:** xoá task (xoá cứng, sau 30 ngày) phải **xoá kèm blob**.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Offline lúc đính kèm | Task tạo ngay, ảnh vào hàng đợi, hiện "chờ mạng" ở chi tiết |
| Upload thất bại | Thử lại có backoff; sau N lần thì báo ở chi tiết, **không** mất task |
| Ảnh rất lớn (>5MB) | Giảm kích thước trước khi upload; giữ bản gốc trên máy tới khi upload xong |
| Định dạng HEIC | Chuyển JPEG khi upload |
| AI không đọc được ảnh | Vẫn đính kèm, không rút gì, **không** hiện lỗi ồn ào |
| Từ chối quyền camera | Rơi về chọn từ thư viện; không chặn cả tính năng |
| Từ chối cả hai quyền | Ẩn nút camera, không báo lỗi (cùng nguyên tắc AC-23.3) |
| Vượt hạn mức Storage | Chặn trước khi chụp, báo rõ còn bao nhiêu |
| Xoá task khi ảnh **đang** upload | Huỷ upload, dọn phần đã ghi |
| Cùng một ảnh gắn vào hai task | Hai bản riêng. Chia sẻ blob làm việc xoá trở nên nguy hiểm |
| Đính quá 3 ảnh | Chặn ở ảnh thứ 4, báo giới hạn |

**Quyết định còn treo**
- **Bị chặn bởi UC-17 (sync).** Trước khi có sync, ảnh chỉ nằm trên một máy — mà đó đúng là thứ người ta chụp để khỏi mất.
- **Chính sách lưu giữ:** ảnh giấy tờ nhạy cảm hơn chữ. Giữ bao lâu, xoá tài khoản thì blob đi đâu?

---

## Nhóm J — Voice-first (MVP, chốt 15/08/2026)

> Nhóm này ra đời cùng [ADR-11 và ADR-12](01-architecture.md#8-quyết-định-kiến-trúc-adr-tóm-tắt). Nó **không**
> thay thế nhóm nào: Inbox, Today, Upcoming, Logbook, kéo thả giữ nguyên hành vi và giữ nguyên vai trò — chúng
> là chỗ ADR-7 rơi về khi mất mạng. Đọc thành tiếng nằm ở **UC-20**, đã chuyển từ Giai đoạn 2 vào MVP.

### UC-52: Màn hội thoại (mặt chính)

**Đặc tả đầy đủ: [11-uc-conversation.md](11-uc-conversation.md)** — luồng chính + 12 AC, bảng edge case 21
dòng, danh sách việc backend, và 11 quyết định còn treo. Để ở file riêng vì nó dài hơn mọi UC khác, và vì §5
của nó là một bảng trạng thái code sẽ đổi theo từng đợt vá — trộn vào đây thì file này thành thứ phải sửa mỗi
lần chạm vào `intent.ts`.

Tóm tắt: hội thoại là mặt đầu tiên của app; danh sách giữ nguyên làm đường thứ hai; bản ghi hội thoại lấy
**server** làm nguồn sự thật, nên xem lại cần mạng và xoá lịch sử là lệnh trên server.

> **Hai lỗi phải vá trước, đo trong `packages/server/src/intent.ts` ngày 15/08:** `saveCapture` nằm **sau** hai
> lối thoát 409/429, nên lượt bị chặn ghi câu của user vào không chỗ nào — mâu thuẫn thẳng với AC-12.1
> *"không mất draft khi bị chặn"*; và `saveTranscript` chỉ chạy ở nhánh thành công, nên lượt model lỗi nằm ở
> `captures` mà không có trong `capture_sessions.messages`. Không vá thì AC-52.3 không đạt được, bất kể mặt
> trước vẽ thế nào.

### UC-53: Làm bước tiếp theo — app giao việc cho hệ điều hành

**Mô tả.** Một việc thường có một bước kế tiếp nằm ở app khác: *"call John at 7pm"* thì bước kế là gọi,
*"gửi báo cáo cho Linh"* thì bước kế là soạn thư. Chỗ mọi app todo rò rỉ đúng là đây — nhắc xong rồi bắt người
ta tự mở app khác và gõ lại từ đầu.

**Nguyên tắc, và là thứ giữ ADR-8 không bị thủng: app KHÔNG BAO GIỜ tự thực hiện.** Nó chuẩn bị rồi **giao** —
trình quay số, trình soạn thư, bản đồ — và người dùng luôn dừng lại ở mặt xác nhận của chính hệ điều hành. App
không nhận thêm một miền, nó mở thêm một **cánh cửa**.

**Precondition.** Có một việc đang mở hoặc đang được nói tới.

1. Người dùng đang nhìn (hoặc đang nói về) một việc.
2. Bước kế tiếp của việc đó có sẵn ngay tại chỗ — không phải đi tìm.
3. Chạm/nói → hệ điều hành mở ra, **đã điền sẵn** những gì app biết.
4. Người dùng xác nhận hoặc huỷ **ở đó**, không phải ở đây.
5. Quay lại, việc vẫn nguyên. Không có gì bị đánh dấu xong thay họ.

**Bộ cửa, xếp theo dữ liệu cần có**

| Cửa | Dữ liệu cần | Quyền OS | Thiếu dữ liệu thì sao |
|---|---|---|---|
| Mở liên kết | URL nằm sẵn trong chữ | không | không có URL thì không có cửa |
| **Soạn thư** | người nhận + tiêu đề + nội dung | **không** — `mailto:` mang theo đủ | thiếu địa chỉ → vẫn mở trình soạn, đã điền tiêu đề và nội dung |
| Chỉ đường | địa chỉ trong chữ | không | — |
| **Gọi / nhắn** | số điện thoại | **không** nếu số nằm trong chữ; **có** nếu phải tra danh bạ | không xin quyền → mở **tìm-kiếm-danh-bạ với tên đã điền sẵn**, người dùng làm nốt |
| Thêm vào lịch | tiêu đề + thời điểm (việc đã có sẵn) | không, nếu giao cho sheet của OS | — |
| Sao chép | một chuỗi | không | — |
| Chia sẻ ra ngoài | tiêu đề + ghi chú | không | — |

Soạn thư **dễ hơn gọi điện** đúng như trực giác, và lý do cụ thể: `mailto:` là một URL mang được cả người nhận,
tiêu đề và nội dung, nên không cần quyền nào cả — trong khi một cuộc gọi cần một con số mà chỉ danh bạ mới có.

**Cố ý KHÔNG có cửa nào cho**

| Không làm | Vì sao |
|---|---|
| Hẹn giờ / pomodoro | Là một miền mới (ADR-8), và nó còn giẫm lên chính tính năng nhắc nhở đã có |
| Thanh toán, chuyển tiền | Một app nghe bằng giọng nói, có thể nghe nhầm, tuyệt đối không đứng gần tiền |
| Mở app bất kỳ bằng deep link tự do | Đó là "làm bất cứ gì" viết theo cách khác. Chỉ mở qua đúng những cửa có tên ở bảng trên |

**Tiêu chí nghiệm thu**

- **AC-53.1:** từ một việc, người dùng **làm được bước kế tiếp mà không phải tự mở app khác và gõ lại** những gì
  đã có trong việc.
- **AC-53.2:** app **không bao giờ tự thực hiện**. Mọi cửa đều dừng ở mặt xác nhận của hệ điều hành, nơi còn
  huỷ được. Nghiệm thu: nói một câu **bị nghe nhầm** rồi đi hết luồng — không một cuộc gọi hay lá thư nào đi ra.
- **AC-53.3:** một cửa **chỉ hiện khi dữ liệu của nó có thật**. Không có địa chỉ thì không có chỉ đường. Đây là
  điều chặn model bịa ra người nhận hay số điện thoại.
- **AC-53.4:** thiếu dữ liệu thì có **đường lui nói ra được**, không phải một nút bấm không xảy ra gì.
- **AC-53.5:** **không cửa nào là bắt buộc** để dùng app (ADR-7). Từ chối mọi quyền thì phần còn lại nguyên vẹn.
- **AC-53.6:** app **không giữ lại dữ liệu nó mượn** để mở một cửa. Số tra được từ danh bạ không được lặng lẽ
  trở thành một trường trong việc — mượn để mở cửa, không phải để chép về.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| Việc có tên người nhưng máy không có số | Đưa tới tìm-kiếm-danh-bạ với tên đã điền. Không hiện một nút gọi rồi báo lỗi |
| Từ chối quyền danh bạ | Rơi về đúng đường trên. Không hỏi lại mỗi lần |
| Tên trùng nhiều người trong danh bạ | Để hệ điều hành hỏi — app không tự chọn một người |
| Máy không có app cho cửa đó (không mail, không bản đồ) | Cửa không hiện. Không mở ra rồi mới báo hỏng |
| Việc có **nhiều** cửa (vừa có số vừa có link) | Cả hai đều có. Không tự đoán cái nào "chính" |
| Đang mất mạng | Gọi và soạn thư vẫn mở được — chúng là việc của máy. Chỉ đường thì tuỳ bản đồ |
| Người dùng quay lại sau khi gọi xong | Việc **vẫn chưa xong**. App không đoán rằng gọi tức là làm xong |
| Nói *"gọi luôn cho John"* mà đang có hai việc nhắc tới John | Hỏi lại (`ask_clarification`), không đoán |
| Nói *"gọi luôn"* khi phiên đã đóng | Không đoán "nó" là việc nào. Theo AC-52.4, ranh giới phải nhìn thấy được trước đó |
| Số điện thoại trong ghi chú có định dạng lạ | Mở trình quay số với đúng chuỗi đó — để người dùng thấy và sửa, không tự "dọn" thành một số khác |

**Quyết định còn treo**

1. **Có xin quyền danh bạ ở v1 không?** Đề xuất: **không**. Một quyền OS trả giá một lần rồi trả mãi mãi, và
   app chưa có gì để làm với danh bạ ngoài đúng một cánh cửa. Đường tìm-kiếm-danh-bạ-điền-sẵn rẻ hơn nhiều và
   không mất gì đáng kể.
2. **Ai soạn nội dung thư?** Lấy tiêu đề và nội dung từ chính việc và ghi chú của nó là chuyện rõ ràng. Còn để
   **model viết hộ một lá thư** thì đã là một năng lực khác hẳn, và nó thuộc đúng miền ADR-8 loại ra. Chưa quyết;
   đề xuất v1 chỉ lắp sẵn từ dữ liệu đã có.
3. ~~**ADR-8 đang nói "gửi mail" là ngoài phạm vi, đúng theo chữ.**~~ **Đã sửa 15/08.** ADR-8 nay phân biệt
   *thực hiện một miền* với *mở một cánh cửa sang miền đó*, và **danh sách loại trừ đổi từ "gửi mail" thành
   "quản lý hộp thư"** — quản lý hộp thư là một miền, mở trình soạn thư với nội dung đã có thì không. Kèm theo
   là **ba phép thử phải qua cả ba**, và mọi cánh cửa mới phải chạy qua chúng thành lời ngay trong use case của
   nó:

   | # | Phép thử | Bảy cửa của UC-53 |
   |---|---|---|
   | 1 | Bỏ cửa đi thì người dùng **vẫn làm được**, chỉ tốn thêm việc gõ lại | ✅ Không cửa nào thêm một năng lực; tất cả chỉ xoá thao tác gõ lại |
   | 2 | Cửa **chỉ mang dữ liệu người dùng đã có**; app không sinh nội dung mới, không hỏi mạng để mở nó | ✅ ở v1 — và đây đúng là chỗ **mục 2 dưới đây** đang treo: để model viết hộ nội dung thư là **trượt** phép thử này |
   | 3 | **Bước cuối nằm ở app kia** — xác nhận ở đó, không phải ở đây | ✅ Đây chính là AC-53.2 |

   Phép thử 2 cũng là lý do đề xuất **không xin quyền danh bạ ở v1** (mục 1) mạnh hơn tôi tưởng lúc viết: tra
   danh bạ là app đi lấy một dữ liệu **không nằm trong việc**. Đường navigate-tới-tìm-kiếm-danh-bạ không lấy gì
   cả, nên nó qua phép thử một cách sạch sẽ.
4. **Agent có được biết về action không?** Nếu có thì tầng `ai` học thêm một khái niệm, đụng ADR-9. Đề xuất giữ
   đúng kỷ luật của cầu nối draft-ref: agent chỉ nói **"người dùng muốn tác động lên `d1`"**, còn *đó có phải số
   điện thoại không* và *mở cửa nào* là việc của client. Agent không bao giờ thấy id thật, và cũng không bao giờ
   thấy số thật.
5. **Cửa hiện ở đâu?** Trên hàng, trong màn chi tiết, hay chỉ khi nói? Chưa vẽ.

### UC-54: Nói trên toàn danh sách — agent tra rồi mới làm

**Mô tả.** *"Dời hết việc Work sang thứ 5"*, *"3h mai tôi có gì?"*, *"tuần này tôi xong được gì?"* — lệnh và câu
hỏi chạm **cả danh sách**, không chỉ mấy việc vừa nói tới. Đây là động từ thứ ba **"xếp giùm"** (ADR-8), và là
phát hiện nặng nhất của audit 15/08: chính câu demo trong bản pitch (*"Moved 4."*) không chạy được với cầu
draft-ref, vì agent chỉ thấy `contextIds` — phiên nguội thì nó mù.

**Cơ chế (chốt 15/08).** Vòng lặp agent **đã có sẵn**: `runIntentTurn` cho model gọi tool, đọc kết quả, gọi
tiếp, tối đa **6 bước** một lượt (`stepCountIs`). Cái thêm vào là đúng **một tool đọc** — `find_tasks` — và
đường dữ liệu cho nó:

1. **Backend tự tra DB của nó — client không gửi danh sách** *(sửa lần hai 15/08, và lần này vì một tiền đề
   sai được bắt ra: hai bản trước viết "sync UC-17 chưa xong" — sai, UC-17 ✅ từ 11/08, hai chiều, kèm cả ghi
   chú. Danh sách đã nằm sẵn trên server; "bản chụp client gửi" là giải pháp cho một vấn đề không tồn tại)*.
   `find_tasks` là một truy vấn trên bảng `tasks` đã sync, **lọc `user_id` tường minh** — cùng cổng release
   M28–M31 với `search_history`, bảng `tasks` đã nằm trong M30. Điểm cộng chỉ backend mới có: máy khác vừa sửa
   thì server **thấy**, còn bản chụp từ máy này thì không.
2. **Client đẩy sync TRƯỚC mỗi lượt — điều kiện để backend không trả lời từ bản cũ.** Sạch thì là no-op (không
   có bản ghi bẩn thì không gửi gì), chỉ tốn khi vừa sửa offline. Đẩy **thất bại** thì lượt vẫn chạy nhưng
   **nói ra** — *"kết quả có thể thiếu thay đổi mới nhất"* — không bao giờ im lặng trả lời từ bản cũ. Sync hỏng
   là chuyện **phát hiện được** ở client, nên sự dè dặt này nói được thành lời thay vì thành một câu trả lời
   sai một cách tự tin.
3. **AI nói TIÊU CHÍ, backend chạy TRUY VẤN**: AI không bao giờ tự lục dữ liệu — nó trả về tiêu chí tìm **có
   cấu trúc**, qua tool `find_tasks` với schema Zod như mọi tool khác (từ khoá, list, khoảng ngày, trạng thái —
   validate trước khi chạm gì); backend truy vấn rồi trả danh sách khớp; AI đọc kết quả, đủ thì làm tiếp, thiếu
   thì tìm lại với tiêu chí khác — trong trần 6 bước sẵn có. **Chi phí token chặn bởi KẾT QUẢ**, không bởi độ
   dài danh sách: chỉ task khớp mới vào ngữ cảnh model. Luật khớp cùng ngữ nghĩa với `searchTasks` (bỏ dấu +
   chuỗi con, quét cả ghi chú) — hai bộ tìm trả kết quả khác nhau cho cùng một chữ là thứ không ai giải thích nổi.
4. **ADR-9 nguyên vẹn — nhưng map ref→id nay phải ĐI QUA DÂY.** Server mint ref tạm cho task tìm thấy (model
   vẫn không bao giờ thấy id thật), rồi trả **map ref→id mới** về client trong response. **Ràng buộc đỏ:**
   client phải hợp nhất map này vào bridge **trước** khi `mergeDraftBack` chạy — hàm đó coi ref lạ là *tạo
   mới*, thiếu map là task tìm thấy bị **nhân đôi** thành một bản sao.
5. **Task tìm thấy được đưa VÀO draft** rồi mới sửa — đúng nghĩa "mở rộng ngữ cảnh" của
   [11-uc-conversation §6 mục 12](11-uc-conversation.md), nên luật ở đó áp luôn: app phải **nói ra** rằng ngữ
   cảnh vừa rộng thêm.
6. **Shell dev (không Supabase) không có bảng nào để tra** — `IntentStore` thêm phương thức tìm, bản memory trả
   rỗng, và AI nói *không thấy* thay vì bịa. E2E vốn mock `chat-intent` nên không đổi gì.
7. **Bước giữa chừng NÓI RA NGAY, trên cùng một kết nối** *(chốt 15/08 theo yêu cầu của product owner: người
   dùng không phải chờ trong im lặng)*. Khi AI quyết định cần tra, server **đẩy một sự kiện xuống client ngay
   lúc đó** — *"Đang tìm trong Work…"* — client hiện và **đọc thành tiếng** (UC-20), rồi lượt chạy tiếp trên
   cùng kết nối. Phần chậm của một lượt nhiều bước là các lần gọi model (giây), không phải truy vấn (mili-giây)
   — sự kiện có mặt ngay sau lần gọi model đầu, cắt đôi khoảng im lặng cảm nhận được. **Cân rồi bỏ** phương án
   cắt request làm đôi (server trả hẳn về, client gửi tiếp): nó làm đúng lượt chậm nhất chậm thêm một vòng gửi,
   và bắt vòng lặp phải tiếp tục được giữa hai request — đụng ADR-3 (function stateless). Quyết định này **đóng
   luôn câu treo streaming** ([11-uc-conversation §6 mục 3](11-uc-conversation.md)) ở mức *sự kiện theo bước*;
   stream từng chữ vẫn chưa cần quyết.

**Tiêu chí nghiệm thu**

- **AC-54.1:** một lệnh trên **một nhóm việc** thực hiện được trong **một câu** — không bắt người dùng đọc tên
  từng việc, không bắt mở từng cái ra sửa.
- **AC-54.2:** câu hỏi **đọc** trả lời từ danh sách thật, **không bịa**. Nghiệm thu: hỏi về một khoảng trống
  ("chủ nhật tôi có gì?" khi chủ nhật rỗng) — câu trả lời là *không có gì*, không phải một việc phát minh ra.
- **AC-54.3:** app nói ra **nó đã động vào những gì**: "đã dời 4 việc" phải kèm *4 việc nào* (đường `changedIds`
  + diff đã có), và **hoàn tác một thao tác phủ cả lượt** — dời 4 việc rồi undo là cả 4 quay về.
- **AC-54.4:** lệnh **mơ hồ về phạm vi** ("dọn hết đi") thì hỏi lại (`ask_clarification`) chứ không đoán — cùng
  luật mơ hồ đã có, áp lên phạm vi thay vì lên một việc.
- **AC-54.5:** cần mạng, như mọi hội thoại — và mất mạng thì **danh sách vẫn đủ để tự làm bằng tay** (ADR-7):
  kéo thả, sửa từng việc, mọi đường cũ còn nguyên.
- **AC-54.6** *(chốt 15/08)*: một lệnh **xoá chạm nhiều hơn một việc** phải được **xác nhận trước khi thực
  hiện** — và lời xác nhận nói rõ *bao nhiêu việc, những việc nào*. Xoá một việc vẫn đi đường cũ (làm ngay +
  undo). Đây là ngoại lệ có chủ ý của nguyên tắc *hoàn tác thay cho xác nhận*
  ([11-uc-conversation §4](11-uc-conversation.md)): app nghe bằng giọng, nghe nhầm một chữ không được phép xoá
  N việc vì một chữ đó — và undo cứu được dữ liệu chứ không cứu được lòng tin.
- **AC-54.8** *(chốt 15/08)*: trong một lượt nhiều bước, người dùng **biết app đang làm gì** — bước tra được
  nói ra (chữ + tiếng) **ngay khi bắt đầu**, không phải sau khi cả lượt xong. Nghiệm thu: một lượt có
  `find_tasks` phải phát ra lời báo bước **trước** câu trả lời cuối, và người bịt màn hình vẫn biết app chưa
  chết. Không có ngưỡng giây trong AC — chưa có dụng cụ đo cảm nhận chờ; thứ nghiệm thu được là **thứ tự**:
  báo-bước đến trước kết-quả.
- **AC-54.7** *(chốt 15/08)*: **xác nhận BẰNG GIỌNG là đường chính** — app *đọc* câu hỏi thành tiếng (UC-20) và
  người dùng *nói* câu trả lời; cả vòng xác nhận đi hết được mà **không chạm màn hình lần nào**. Nút bấm vẫn
  còn, làm đường phụ cho lúc không nói được (đúng vai của reply pill, AC-08.3). Một xác nhận bắt buộc phải bấm
  là lấy lại bằng tay thứ vừa hứa bằng miệng. **Mặc định an toàn là KHÔNG:** câu trả lời mơ hồ, im lặng, hay
  phiên tự đóng giữa chừng — đều **không xoá**. Không cần cơ chế mới: câu hỏi là `ask_clarification` sẵn có,
  câu trả lời là một lượt nói thường — không có giao thức ẩn nào để lệch.

**Edge case & validation**

| Tình huống | Hành vi mong đợi |
|---|---|
| "Dời hết việc Work…" khi Work **rỗng** | Nói *"Work không có việc nào"*. Không tạo việc mới tên y câu lệnh |
| `find_tasks` khớp **0** với một truy vấn có nghĩa | Nói không tìm thấy, **không bịa**. Đây là AC-54.2 ở dạng lệnh |
| Lệnh **xoá hàng loạt** ("xoá hết việc tuần này") | Hỏi lại trước khi làm — một app nghe bằng giọng, nghe nhầm một chữ, không được phép xoá N việc vì một chữ đó. Undo vẫn phủ cả lượt |
| Câu trả lời xác nhận **mơ hồ** ("ờ… mà thôi", tiếng ồn) | **Không xoá.** Hỏi lại một lần; vẫn mơ hồ thì thôi hẳn. Xác nhận mà mặc định là "có" khi nghe không rõ thì vô nghĩa đúng lúc cần nhất |
| Hỏi xác nhận xong người dùng **bỏ đi**, phiên tự đóng (UC-11) | **Không xoá.** Câu hỏi chết theo phiên — quay lại nói "ừ" vào một phiên mới không được hiểu là đồng ý xoá của phiên cũ |
| Đang **tắt tiếng** mà gặp lệnh cần xác nhận | Câu hỏi vẫn hiện bằng chữ (AC-20.2), trả lời bằng nói hay bấm đều được |
| Danh sách **rất lớn** | Truy vấn có trần kết quả (LIMIT); chạm trần thì **nói ra** phạm vi đang nhìn thấy (no silent caps), không âm thầm cắt |
| Tên list / từ khoá **mơ hồ** ("việc nhà" vừa là list vừa là chữ trong tiêu đề) | Hỏi lại, không đoán |
| Đang phiên nói về 2 việc, câu mới chạm **toàn danh sách** | Ngữ cảnh mở rộng và **nói ra** — người dùng phải biết câu sau tác động vào đâu (AC-52.4) |
| Người dùng **sửa tay** giữa hai lượt | Bản chụp lượt sau do client gửi nên tự phản ánh bản mới — không có cache nào để cũ |
| Lượt dùng nhiều bước tool | Vẫn là **một lượt** với hạn mức ngày (một request, một dòng `ai_requests`) |
| Đẩy sync **thất bại** ngay trước lượt | Lượt vẫn chạy, và app **nói ra** rằng kết quả có thể thiếu thay đổi mới nhất. Không im lặng trả lời từ bản cũ |
| **Máy khác** vừa sửa xong | Server thấy bản mới hơn — kết quả **đúng hơn** cả nhìn từ máy này. Điểm cộng riêng của backend-tra |
| Task tìm thấy quay về client | Map ref→id hợp nhất vào bridge **trước** `mergeDraftBack` — thiếu là nhân đôi task (ràng buộc đỏ, cơ chế mục 4) |
| Lượt nhiều bước, đang **tắt tiếng** | Lời báo bước vẫn hiện bằng chữ (AC-20.2) |
| Kết nối rớt **sau** lời báo bước, **trước** kết quả | Lượt đó theo đường lỗi thường (AC-25.1: thử lại không phải nói lại). Lời báo bước không phải là kết quả — không được hiểu là "đã làm xong" |

**Quyết định còn treo**

1. ~~**Trường nào được tìm?**~~ **Đã chốt 15/08: ghi chú CÓ trong phạm vi tìm.** Hai chỗ dựa: *"cái việc có
   ghi số hợp đồng ấy"* phải tìm ra được — ghi chú là chỗ người ta cất phần đáng tìm nhất; và `searchTasks` ở
   máy vốn đã quét ghi chú — bỏ note là hai bộ tìm trả kết quả khác nhau cho cùng một chữ. Cái giá riêng tư của
   bản-chụp-client không còn là câu hỏi: ghi chú **vốn đã nằm trên server** qua sync (UC-17), tool chỉ là một
   truy vấn có lọc trên dữ liệu đã ở đó.
2. ~~Trần bản chụp~~ / ~~heuristic đính kèm sớm~~ — **hết đối tượng 15/08**: không còn bản chụp nào để đặt
   trần hay đoán trước. Giữ dòng này làm vết: hai câu treo chết vì cơ chế chúng phục vụ được thay, không phải
   vì được trả lời — và cả hai sinh ra từ đúng cái tiền đề sai "sync chưa xong".
3. ~~**Xoá hàng loạt có được phép qua lời không?**~~ **Đã chốt 15/08: được phép, kèm xác nhận bắt buộc trước
   khi thực hiện** — thành AC-54.6. Không cấm hẳn: cấm là đẩy người dùng về xoá tay từng cái, tức phạt người
   nói thật để phòng máy nghe nhầm.
4. **Kịch bản eval bắt buộc** trước khi ship: chọn đúng nhóm việc, không bịa khi rỗng, hỏi lại khi mơ hồ, và
   **câu trả lời gói trong một câu** (AC-20.7) — model liệt kê mười việc thành văn xuôi là rớt, vì cái văn đó
   sẽ được đọc thành tiếng. Chất lượng tính năng này **là** chất lượng model.

