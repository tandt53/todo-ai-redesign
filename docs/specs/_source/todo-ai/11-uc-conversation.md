# UC-52 — Màn hội thoại (mặt chính)

> **Đã duyệt hướng đi 15/08/2026** bằng [ADR-11 và ADR-12](01-architecture.md#8-quyết-định-kiến-trúc-adr-tóm-tắt).
> Bản trước của file này là một bản nháp **khuyến nghị chưa dựng màn hội thoại riêng**, và nó tự viết ở §5 mục 12
> rằng *nếu hướng voice-first được chọn thì use case phải viết lại từ đầu chứ không phải mở rộng*. Hướng đó đã
> được chọn, nên đây là bản viết lại, không phải bản sửa.
>
> Luật áp cho mọi AC ở đây, theo [10-ac-audit.md](10-ac-audit.md): **AC nói nhu cầu, không nói hình thức**; có
> ngưỡng thì phải chỉ ra dụng cụ đo, không có dụng cụ thì **không nêu con số**; nói về nền tảng thì nói theo
> **năng lực**, không theo tên hệ điều hành hay trình duyệt.

---

## 0. Ba quyết định đã đổi bài toán

Bản nháp cân nhắc một **mặt xem lại chỉ đọc** cho phiên đang mở. Ba quyết định dưới đây làm nó thành một use case
khác hẳn, nên đọc bản cũ để so là vô ích — nó trả lời một câu hỏi không còn được hỏi nữa.

| Quyết định | Chốt | Hệ quả nặng nhất |
|---|---|---|
| Hội thoại là mặt chính hay một mặt phụ | **Mặt chính** (ADR-11) — mở app là vào đây | ADR-7 nay áp lên **chính mặt chính**: mất mạng thì nó phải rơi về danh sách, không phải màn trắng |
| Nguồn sự thật của lịch sử | **Server** (ADR-12) — `capture_sessions.messages` | Xem lại **cần mạng**; và hai chỗ trong `intent.ts` phải vá trước, xem §5 |
| App có nói lại không | **Có, bản tối giản** — đọc thành tiếng, tắt được, **chưa ngắt lời giữa câu** | UC-20 rời Giai đoạn 2 vào MVP; phần khó nhất (ngắt lời) cố ý không hứa ở vòng này |

**Phần bản pitch KHÔNG được lấy.** `docs/mockups/vision-voice-first.html` đề xuất bỏ Inbox, bỏ hai tab
Today/Inbox, bỏ sắp xếp tay. Không lấy phần đó, vì hai lý do: nó xoá UC-14, UC-15 và UC-43 vừa dựng xong, và
quan trọng hơn — **nó lấy mất chính cái lưới an toàn mà ADR-7 đứng trên**. Khi mất mạng, thứ mặt hội thoại rơi
về phải là một danh sách đầy đủ; bỏ danh sách đi thì không còn chỗ nào để rơi.

---

## 1. Bốn lỗ hổng vẫn phải vá — nay là điều kiện tiên quyết

Bản nháp liệt kê bốn lỗ hổng và nhận xét rằng ba trong bốn *vá được mà không cần màn hình nào*. Nhận xét đó vẫn
đúng, nhưng đã đổi vai: khi hội thoại là mặt phụ, vá chúng là việc nên làm; khi hội thoại là **mặt chính**, cả
bốn nằm chắn ngay giữa đường.

| # | Lỗ hổng | Vì sao nay là điều kiện tiên quyết | Liên đới |
|---|---|---|---|
| 1 | **Ranh giới phiên vô hình.** Sau một khoảng im lặng, phiên tự đóng và câu tiếp theo đổi nghĩa từ *"sửa việc vừa nói"* thành *"tạo việc mới"* | Ở mặt phụ, đoán sai là một việc thừa. Ở mặt chính — nơi người dùng **nói liên tục và không nhìn màn hình** — đoán sai là chuyện thường ngày | UC-05, UC-11 |
| 2 | **Lượt lỗi biến mất khỏi tầm mắt.** Lượt đầu lỗi thì im lặng; lượt sau lỗi thì câu nói **thành một việc mới** | Rảnh tay nghĩa là không nhìn thấy lúc nó xảy ra. Lời hứa "retry không cần nói lại" của AC-25.1 phải có mặt nào hiện thực nó | UC-25 |
| 3 | **409 và 429 chưa xử lý riêng.** Client gộp mọi lỗi vào một nhánh `catch` | Hai thứ này **không phải lỗi**, chúng là chính sách. Phía server đã thôi làm mất chữ (§5 mục 1), nhưng **phía client vẫn hiện chúng như một lỗi chung chung** — phần còn lại của lỗ hổng này nằm ở đó | UC-12, AC-12.1 |
| 4 | **Diff chỉ sống 1,6 giây.** Nháy nền + nhãn `NEW`/`EDITED` là kênh duy nhất báo AI vừa đổi gì | Đây là lỗ hổng mà mặt hội thoại giải quyết tốt hơn mọi cách khác, và cũng là AC-52.2 | UC-06, UC-09 |

---

## 2. Luồng chính

**Mô tả.** Mặt đầu tiên của app: một chỗ để **nói**, không phải một chỗ để đọc và sắp xếp. Nói vào thì việc
được tạo hoặc sửa ngay, app trả lời bằng chữ **và bằng tiếng**, và các lượt trước của phiên vẫn xem lại được.
Danh sách đầy đủ luôn ở cách một thao tác.

**Precondition.** Đã đăng nhập (ADR-10).

1. Mở app → gặp ngay chỗ để nói; không phải điều hướng gì trước khi nói được câu đầu tiên.
2. Nói một câu → việc hiện ra trong danh sách, app trả lời ngắn bằng chữ và đọc thành tiếng.
3. Nói tiếp → sửa chính những việc vừa nói tới; mỗi lượt thấy được việc nào đã đổi vì nó.
4. Muốn kiểm lại "vừa nãy mình bảo gì, nó làm gì" → xem lại các lượt của phiên, sau khi mọi hiệu ứng đã tắt.
5. Thấy rõ phiên còn mở hay đã đóng — tức câu tiếp theo là *sửa tiếp* hay *việc mới*.
6. Cần nhìn toàn cảnh → sang danh sách đầy đủ bằng một thao tác, và quay lại được.

**Tiêu chí nghiệm thu**

- **AC-52.1:** thứ người dùng gặp đầu tiên khi mở app là **chỗ để nói**, không phải chỗ để đọc và sắp xếp.
  Nghiệm thu: từ lúc app sẵn sàng tới lúc nói/gõ được câu đầu, **không có thao tác điều hướng nào**.
- **AC-52.2:** người dùng **xem lại được những gì mình đã nói trong phiên hiện tại và app đã hiểu ra sao**, kể
  cả sau khi mọi hiệu ứng tạm thời đã kết thúc. Nghiệm thu: chờ hiệu ứng nháy tắt hẳn rồi vẫn truy được đủ các
  lượt của phiên và việc nào đổi vì lượt nào.
- **AC-52.3:** **không lượt nào biến mất không dấu vết** — kể cả lượt mà model lỗi, lượt bị chặn vì phiên quá
  dài (UC-12), và lượt bị chặn vì hết hạn mức ngày. Nghiệm thu: gây ra đủ ba tình huống rồi đối chiếu số lượt
  xem lại được với số câu đã nói; hai số phải bằng nhau. *(Phía server **đã đạt** từ 15/08 — hai lỗi ở §5 đã vá,
  có bốn ca hồi quy. Vế "xem lại được" vẫn chờ endpoint đọc lịch sử, §5 mục 3.)*
- **AC-52.4:** người dùng **biết phiên còn mở hay đã đóng**, và do đó biết câu nói tiếp theo sẽ được hiểu là sửa
  tiếp hay tạo việc mới. Ở mặt chính rảnh tay, đây là AC nặng nhất của cả use case.
- **AC-52.5:** từ một lượt, người dùng **tới được đúng việc mà lượt đó đã đổi**, chứ không phải tự đi tìm trong
  danh sách.
- **AC-52.6:** **xem lại không làm thay đổi gì cả** — không mở phiên mới, không gửi lượt nào, không tiêu hạn
  mức. Nghiệm thu: mở và đóng nhiều lần, số bản ghi `ai_requests` của người dùng đó không tăng.
- **AC-52.7:** **ADR-7 áp lên chính mặt chính.** AI hỏng, offline, hoặc hết quota thì mặt này **nói ra bằng lời
  và đưa sang danh sách**; không thao tác todo nào phải đi qua nó. Nghiệm thu: chạy lại E2E-W0 trong
  [05-test-plan.md](05-test-plan.md) (chặn hoàn toàn `chat-intent`) — mọi UC nhóm CORE vẫn pass, và mặt chính
  **không phải một màn trắng**.
- **AC-52.8:** khi **có mạng** mà vẫn không lấy được lịch sử, mặt này nói rõ là **chưa tải được**, chứ **không**
  hiện như *chưa từng nói gì*. Phân biệt đúng hai thứ đó là toàn bộ lý do AC này tồn tại: một cái là sự cố tạm
  thời, cái kia là một lời nói dối về dữ liệu của người dùng. *(Máy **mất mạng hẳn** không rơi vào AC này — nó
  không thấy mặt hội thoại chút nào, xem §4.)*
- **AC-52.9:** mặt hội thoại **không phải ngõ cụt** — mọi đích danh sách vẫn tới được và vẫn đầy đủ như trước.
- **AC-52.10:** nội dung hiển thị là **câu của người dùng và tên việc thật**; ký hiệu nội bộ của agent (các ref
  tạm) không bao giờ lọt ra màn hình. Đây là kỷ luật draft-ref của ADR-9 nhìn từ phía người dùng.
- **AC-52.11:** thay đổi **do người dùng tự sửa tay** giữa hai lượt (UC-09) không bị ghi công cho AI. Ghi công
  mọi thay đổi cho AI là nói dối, và nó phá luôn AC-09.2.
- **AC-52.18** *(52.13–17 nằm ở §5c)*: hoàn tác **với tới được bằng chính kênh vừa ra lệnh** — nói *"hoàn tác đi"* thì lượt vừa rồi
  được hoàn tác, **không** thành một task tên y như thế. Đây là điều kiện đứng của nguyên tắc *hoàn tác thay
  cho xác nhận* (§4): nói mà phải chạm nút mới hoàn tác được thì tay đâu còn rảnh. *(Đo 15/08: hiện **không
  có** — agent không có tool undo, prompt không có luật nào, undo chỉ là nút `store.undo` phía client.)*
- **AC-52.12:** khi người dùng **xoá lịch sử hội thoại** (UC-28) thì mặt này **không còn gì để xem** — kể cả bản
  ở máy. Với ADR-12, lệnh xoá đánh vào server, nên bản sao ở máy phải đi theo chứ không sống lâu hơn lệnh xoá.
  *(Sửa lời 15/08: máy đang **offline** thì xoá ngay khi nó online lại — "mọi máy, ngay lập tức" theo nghĩa đen
  là bất khả thi vật lý, và một AC hứa điều bất khả thi thì không nghiệm thu được.)*

> **Cố ý không có AC nào về số lượt hiển thị, độ dài lịch sử, hay ngưỡng im lặng đóng phiên.** Ba con số đang tồn
> tại — 30 lượt cứng, 10 lượt cửa sổ trượt, 200 lượt/ngày — là **hàng rào chi phí và ngữ cảnh**, đã có chỗ đứng
> trong `intent.ts` và trong UC-12; chúng không phải tiêu chí nghiệm thu của màn này. Còn ngưỡng im lặng thì
> **hai nơi đang nói hai số khác nhau** (§6 mục 2) và chưa có dụng cụ nào đo được số nào đúng.

---

## 3. Edge case & validation

Bảng này là test plan; mỗi dòng dịch thẳng được thành một ca.

| Tình huống | Hành vi mong đợi |
|---|---|
| Mở app khi **không có mạng** | **Không có hội thoại.** Mặt chính nói ra một câu rồi đưa thẳng sang danh sách. Gõ vẫn tạo việc, ngày vẫn bóc được, tìm theo từ khoá vẫn chạy (ADR-7). **Không** phải màn trắng, **không** phải một ô nhập câm, và **không** phải một hội thoại chạy nửa vời |
| Không lấy được lịch sử **dù có mạng** (server lỗi, request rớt) | Khác hẳn ca trên: hội thoại vẫn chạy, chỉ phần xem lại là chưa có. Nói rõ **chưa tải được** kèm cách thử lại (AC-52.8) |
| Đang hội thoại thì **mất mạng giữa chừng** | Lượt đang chờ hiện rõ là đang chờ, rồi mặt chính chuyển sang trạng thái không-hội-thoại. Câu vừa nói không mất — nó vào hàng đợi (AC-13.2) |
| Chưa có lượt AI nào (chỉ quick-add tay) | Empty state nói đúng sự thật: chưa có gì để xem. Quick-add **không** phải hội thoại nên không xuất hiện ở đây |
| Build chưa cấu hình chỗ hỏi AI | App vẫn đủ chức năng; mặt chính không dẫn tới một chỗ rỗng vô nghĩa |
| Mất mạng **giữa** phiên | Lượt đang chờ hiện rõ là **đang chờ**, không hiện như đã xong. Lịch sử lấy từ server thì báo chưa lấy được (AC-52.8) |
| Lượt bị model lỗi | Lượt vẫn có mặt, và người dùng **thử lại được mà không phải nói lại** (AC-25.1). Thử lại không sinh việc trùng (AC-25.3) |
| Chạm trần lượt/ngày (429) | Người dùng hiểu vì sao lượt không chạy và bao giờ lại chạy được. **Câu vừa nói không mất** |
| Phiên chạm giới hạn cứng (409, UC-12) | Phiên đóng lại, **không mất chữ** (AC-12.1), hiểu vì sao, và tiếp tục được ngay bằng lượt sửa trên việc đã lưu (AC-12.2) |
| Phiên tự đóng vì im lặng (UC-11) | Mốc đóng phiên **nhìn thấy được** trong dòng thời gian. Đây là AC-52.4 ở dạng test |
| Việc mà một lượt đã tạo bị xoá sau đó | Lượt vẫn còn, nhưng **không để lại tham chiếu treo**: đi tới thì được cho biết việc không còn, không phải một màn trắng |
| Việc bị xoá mềm rồi khôi phục | Đường đi từ lượt tới việc đó sống lại đúng việc cũ, không tạo bản sao |
| Người dùng sửa tay giữa hai lượt (UC-09) | Nhận ra được là thay đổi tay. Đây là AC-52.11 ở dạng test |
| Hoàn tác một lượt | Lượt bị hoàn tác **vẫn hiện**, kèm dấu đã hoàn tác. Xoá dòng đó là làm sai lệch chính thứ lịch sử này tồn tại để ghi |
| Đang có một lượt chạy dở | Trạng thái đang xử lý nhìn thấy được, và **không khoá** các thao tác khác |
| Lượt chứa đoạn rất dài (dán từ email, UC-03.2) | Không cắt âm thầm. Cần cắt để hiển thị thì phải mở ra xem được đủ |
| Câu ngoài phạm vi todo (UC-24) | Lượt vẫn hiện, không sinh việc rác. Mặt chính **không** vì thế mà thành nơi tán gẫu — ADR-8 không đổi |
| Rất nhiều lượt trong một phiên | Không **dựng** quá một trang dòng trong một lần render — cùng luật với AC-45.3, cùng lý do: thứ cần bảo vệ là chi phí render |
| Đóng app giữa phiên rồi mở lại | Theo UC-13: không mất gì và người dùng biết nó còn đó. AC-13.1 **không** được phép phụ thuộc vào mặt này — nếu không thì AI hỏng kéo theo mất khôi phục |
| Mở ở **máy khác** | Với ADR-12 thì **thấy được** lịch sử phiên, vì server là nguồn sự thật. Đây là chỗ đổi so với bản nháp, vốn ghi *v1 không hứa* |
| Xoá lịch sử hội thoại (UC-28) | Trống **ngay lập tức và ở mọi máy**, không đợi hết hạn lưu giữ |
| Nội dung nhạy cảm nói nhầm vào app | Xoá được ngay bằng lệnh UC-28; không bản sao nào nằm ngoài tầm lệnh đó (AC-52.12) |
| Đang đọc thành tiếng thì người dùng nói tiếp | Ngừng đọc và nghe. Vòng này **không** hứa ngắt lời giữa câu rồi nói tiếp đúng chỗ — xem UC-20 |
| Máy đang ở chế độ im lặng / vừa rút tai nghe | Không phát tiếng ra loa ngoài ngoài ý muốn. Câu trả lời **luôn có bản chữ**, nên tắt tiếng không mất thông tin nào |

---

## 4. Đã chốt (mặc định) — đổi được, nhưng phải có chủ ý

- **Chữ luôn có, tiếng là thêm.** Mọi câu app nói đều có bản chữ. Tiếng tắt được và tắt rồi thì không mất gì.
  Đây là điều kiện để AC-52.8 và dòng "chế độ im lặng" ở §3 khả thi.
- **Danh sách không bị đụng tới.** Inbox, Today, Upcoming, Logbook, kéo thả giữ nguyên hành vi. Mặt hội thoại
  **thêm vào trước**, không thay thế.
- **Chỉ một phiên đang mở — luôn luôn MỘT, không bao giờ hai.** Chốt 15/08 khi bàn tới "tìm lại giùm". Ba lý
  do, nặng dần: hai phiên mở cùng lúc thì người dùng **không biết câu tiếp theo rơi vào phiên nào** — đúng thất
  bại mà AC-52.4 tồn tại để chặn, nhân đôi; phiên chính là câu trả lời cho *"'nó' là cái gì"*, hai phiên là hai
  câu trả lời cho cùng một chữ; và cầu nối draft-ref giả định **một** draft, hai phiên là hai draft mà
  `mergeDraftBack` không có câu chuyện nào cho việc đó. Quan hệ với UC-18 còn treo — §6 mục 6.
  **Chưa ép được ở server** (audit 15/08): schema không có ràng buộc "một phiên mở cho mỗi tài khoản", nên hai
  thiết bị cùng mở app là **hai phiên mở song song**, và mặt xem lại "hôm nay" thấy cả hai đan xen. Phải quyết
  cùng lúc với §5 mục 4: phiên thuộc **thiết bị** hay thuộc **tài khoản**, và máy này có thấy phiên đang mở của
  máy kia không.
- **"Tìm lại giùm" tách làm BA, không phải hai.** Ranh giới thật không nằm ở *tìm trong đâu*, mà ở **ai hiểu
  câu hỏi**:
  1. **Gõ một từ khoá** — `searchTasks` (UC-37), bỏ dấu tiếng Việt, quét cả nhãn và ghi chú. Cục bộ, offline,
     không tiêu quota. Đây là thứ duy nhất thật sự miễn phí, và nó đã chạy hôm nay.
  2. **Hỏi bằng một câu, về các task** — **cần model**. `searchTasks` so khớp **chuỗi con trên nguyên câu truy
     vấn** (`fold(t.title).includes(fold(query))`), nên đưa cả câu *"hôm trước tôi ghi gì về Đà Nẵng"* vào thì
     nó khớp **không gì cả**. Không có gì trong repo biến một câu hỏi thành từ khoá, và **hệ điều hành không
     cho sẵn thứ đó**: iOS có `NLTagger`, Android có ML Kit entity extraction, nhưng cả hai làm *bóc thực thể*
     chứ không làm *đoán ý định*, cả hai cần native module (thứ mobile đang cố tránh), và **web không có gì
     tương đương** — nên kể cả làm cũng khiến hai app lệch nhau về một hành vi cốt lõi.
  3. **Hỏi về những gì đã NÓI** (transcript) — cần model **và** cần mạng, vì bản ghi nằm trên server (ADR-12).

> **Sửa một câu đã viết sai ở đây (15/08).** Bản trước gộp (1) và (2) làm một rồi gọi đó là "một điểm ADR-7 gần
> như miễn phí". Không đúng: **tìm** thì offline, **hiểu câu hỏi** thì không. Ghi lại nhầm lẫn này thay vì lặng
> lẽ xoá, vì nó là loại nhầm dễ tái phát — một tính năng có sẵn ở tầng dưới trông như thể tầng trên cũng có.
- **Xem lại là chỉ đọc.** Chỗ để gõ chỉ có một, ở mặt chính. Hai ô nhập cho cùng một việc là cách chắc chắn để
  người dùng không biết cái nào ăn vào phiên nào.
- **ADR-9 giữ nguyên.** Mặt này đọc `contextIds` và `changedIds` mà `mergeDraftBack` đã trả về sẵn — hai giá trị
  đó tách nhau **đúng để** chỉ nháy những hàng thật sự đổi, và đó cũng chính là dữ liệu AC-52.5 cần. Không thêm
  khái niệm mới nào ở tầng `ai`/`server`.
- **Phạm vi xem lại = HÔM NAY, gồm cả phiên đã đóng.** Chốt khi vẽ, vì bản vẽ không lảng tránh được: AC-52.4 đòi
  ranh giới phiên **nhìn thấy được**, mà một ranh giới chỉ nhìn thấy khi có hai bên. Rộng hơn "phiên hiện tại"
  đúng một bậc, và cố ý **không** rộng tới 90 ngày mà `capture_sessions` giữ được — vẽ ra một tháng cuộn ngược
  là vô tình thiết kế luôn chính sách lưu giữ, trong khi UC-28 đang kéo ngược lại (§6 mục 8).
- **MẤT MẠNG THÌ KHÔNG CÓ HỘI THOẠI.** Chốt 15/08. Mặt hội thoại không chạy nửa vời — nó **giao lại cho danh
  sách** (AC-52.7) và không cố hiểu câu nào cả. Ranh giới này rẻ vì nó dứt khoát: không có trạng thái "hội thoại
  đang chạy một phần", nên không ai phải đoán câu mình vừa nói có được hiểu hay không.
  - **Vẫn chạy khi mất mạng, và không được nhầm là hội thoại:** gõ/nói tạo việc ngay (ADR-7), ngày giờ vẫn bóc
    được bằng parser cục bộ (UC-46), ô tìm kiếm theo từ khoá vẫn tìm (UC-37), và câu vừa nói **xếp hàng chờ AI
    đọc lại khi có mạng** (AC-13.2). Đó là **ghi**, không phải **hội thoại** — nhầm hai thứ này là cách chắc
    chắn nhất để đọc luật trên thành "mất mạng thì không nói được", tức phá thẳng ADR-7.
  - **Hệ quả cần kiểm bằng tay:** giọng nói trên web dùng Web Speech API, mà bản của trình duyệt phổ biến gửi
    âm thanh lên máy chủ — nếu đúng vậy thì offline trên web mất luôn cả **nhập bằng giọng**, chỉ còn gõ, trong
    khi mobile nhận dạng được ngay trên máy. Đây là một chênh lệch giữa hai app về một hành vi cốt lõi và
    **chưa ai đo**; xếp vào §4 checklist thủ công của [05-test-plan.md](05-test-plan.md).
- **HOÀN TÁC THAY CHO XÁC NHẬN.** Chốt 15/08, trả lời thẳng câu "có cần confirm trước khi action không":
  **mặc định là không**. App làm ngay, **nói lại đã làm gì** (câu trả lời của UC-20 *chính là* lời xác nhận,
  đặt SAU hành động nơi nó không chặn dòng chảy), và hoàn tác một thao tác phủ cả lượt. Đây không phải quyết
  định mới — nó là ADR-7: bản cũ từng có draft + nút Lưu và đã bỏ có chủ ý. Confirm trước mọi thứ thì (a) với
  voice là *rảnh tay mà vẫn phải nhìn màn hình bấm OK*, và (b) người ta sẽ bấm OK không đọc — lời xác nhận
  thành vô nghĩa đúng lúc cần nhất. **Ngoại lệ phải hỏi/confirm TRƯỚC, đo bằng phạm vi và độ thu hồi:** xoá
  hàng loạt (UC-54), câu mơ hồ (`ask_clarification`, UC-08), câu ngoài phạm vi (đề nghị ghi — AC-24.3), lệnh
  ra ngoài app (dừng ở confirm **của OS** — AC-53.2), xoá lịch sử/tài khoản (2 bước, UC-28).
- **Lối ra là cái drawer đã có.** Không dựng mô hình điều hướng thứ hai cho riêng màn này: drawer vốn chứa mọi
  đích, nên AC-52.9 được trả lời bằng thứ đã tồn tại.

**Bản vẽ: [mockups/07-conversation.html](mockups/07-conversation.html)** — 11 khung, mỗi khung gắn một AC, kèm
bảng truy vết và danh sách *cố ý không vẽ*. Nó **thay thế** phần hội thoại trong `mockups/vision-voice-first.html`,
vốn vẽ bản đã bị từ chối (màn chính `NOW` thay cho Inbox/Today, và không khung nào có lối về danh sách).

---

## 5. Việc phải làm ở backend — và hai lỗi phải vá trước

Đo trong `packages/server/src/intent.ts` ngày 15/08/2026. Hai mục đầu **không phải việc thêm, là lỗi** — chúng
làm AC-52.3 và AC-12.1 không đạt được bất kể mặt trước vẽ thế nào — và **đã vá xong cùng ngày**.

| # | Việc | Trạng thái |
|---|---|---|
| 1 | **`saveCapture` nằm SAU hai lối thoát 409 và 429.** Lượt bị chặn vì phiên quá dài hoặc hết hạn mức ngày ghi câu của user vào **không chỗ nào** | ✅ **Đã vá.** Hai lối thoát gộp lại thành một nhánh chạy sau `saveCapture`. Lượt bị chặn ghi capture với `sessionId: null` — giữ chữ mà **không mở một cuộc hội thoại sẽ không bao giờ chạy**; `captures.session_id` vốn nullable từ migration `0001` nên không cần đổi schema. Hạn mức ngày chỉ được hỏi khi giới hạn lượt đã sạch, nên phiên vượt trần không tốn thêm một truy vấn để chứng minh điều đã biết |
| 2 | **`saveTranscript` chỉ chạy ở nhánh thành công.** Lượt model lỗi nằm ở `captures` nhưng không có trong `capture_sessions.messages` | ✅ **Đã vá.** Nhánh lỗi ghi transcript kèm câu của user, **không kèm câu trả lời** — bịa ra một câu là đặt chữ vào mồm model để chính nó đọc lại ở lượt sau. Nuốt lỗi như telemetry: đây đã là đường thất bại, biến 502 thành 500 không giúp ai, và `captures` vẫn giữ chữ gốc (AC-01.3). **Hệ quả có chủ ý:** lượt lỗi được tính vào trần 30 lượt, vì nó thật sự đã thêm một dòng vào ngữ cảnh — một bộ đếm nói khác transcript còn tệ hơn một bộ đếm chặt tay |
| 3 | **Không có endpoint đọc lịch sử.** Chỉ có `POST` một lượt; server lưu transcript nhưng client không có đường lấy về | ⬜ Chưa có. Điều kiện cần của AC-52.2. **Ràng buộc từ audit 15/08:** endpoint phải đọc **cả `captures` lẫn `messages`** rồi trộn theo thời gian — lượt 409/429 chỉ nằm ở `captures` (lượt 429 đầu phiên còn không có session), nên một endpoint chỉ đọc `messages` làm AC-52.3 rớt ngay ở nghiệm thu của chính nó. **Sửa lời 16/08:** vế *"rồi trộn theo thời gian"* **không thực thi được** như đang viết — `ChatMessage` là `{role, content}`, không có mốc thời gian nào, nên chỉ `captures` có `created_at` để mà trộn. Ghép theo thứ tự cũng sai và sai **vĩnh viễn từ giữa phiên**, vì ba đường ghi lệch nhau (thành công 1+2, lỗi model 1+1, bị chặn 1+0). Xem [13-uc-history-read.md](13-uc-history-read.md) §0 |
| 4 | **`capture_sessions.status` / `closed_reason` không ai ghi.** Có trong schema từ migration đầu, chưa từng được cập nhật — `endSession` phía client chỉ `setSession(null)` | ⬜ Chưa có. Điều kiện cần của AC-52.4 |
| 5 | **`captures.status`** (`pending`/`processed`) cũng không ai đổi | ⬜ Chưa có. Cần cho "thử lại mà không nói lại" (AC-25.1) |
| 6 | **Mối nối lượt ↔ việc không được lưu.** `mergeDraftBack` trả `changedIds` cho lượt hiện tại rồi không ai giữ | ⬜ Chưa có. Điều kiện cần của AC-52.5, và là **chi phí thật** của use case này — §6 mục 1 |
| 7 | **Streaming sự kiện theo bước** — chốt 15/08 (AC-54.8): server đẩy sự kiện ngay khi agent bắt đầu một bước tra; hai shell + `packages/api` phải đọc được response chảy dần; `INTENT_TIMEOUT_MS` đổi nghĩa thành khoảng lặng giữa hai sự kiện | ⬜ Chưa có. Stream từng chữ vẫn chưa quyết — §6 mục 3 |
| 8 | **Xoá lịch sử (UC-28) chưa có đường chạy**, và ADR-12 làm nó thành lệnh **trên server**, phải quét cả bản ở máy | ⬜ Chưa có. Điều kiện cần của AC-52.12 |
| 9 | **pg_cron purge transcript vẫn đang bị comment** trong `0001_init.sql` — transcript hết hạn 90 ngày không tự xoá | ✅ **Đã bật.** Migration `0009_deletion.sql` gọi `create extension pg_cron`, đặt hàm `purge_expired_transcripts()` riêng (gọi tay được để kiểm chứng, sửa được mà không phải huỷ lịch) và `cron.schedule` chạy 3h sáng. Hàm xoá hẳn hàng `captures` quá hạn, **giữ** hàng `capture_sessions` nhưng bỏ `messages` — hàng còn được `tasks.capture_id` trỏ vào |
| 10 | **Index tìm kiếm trên `captures.raw_text`** — `pg_trgm` + `unaccent`, kèm migration bật hai extension | ⬜ Chưa có. §5c |
| 11 | **Tool `search_history`** — tool ĐẦU TIÊN có I/O; cần tiêm `searchHistory` vào `runIntentTurn` mà vẫn giữ `applyToolCall` thuần | ⬜ Chưa có. §5c |
| 12 | **Lọc `user_id` tường minh trong MỌI truy vấn** — service role bỏ qua RLS, nên thiếu nó là rò chéo tài khoản (AC-52.14) | ✅ **Đã vá 15/08, hai đợt.** `saveTranscript`/`loadTranscript` giờ lọc `user_id`; `userId` đi vào **tham số** vì Edge Function dựng một store cho cả tiến trình chứ không phải mỗi request. Đợt hai đóng chỗ hở còn lại: một `sessionId` mượn trước đó tuy không đọc/ghi được nhưng **vẫn được nhận** cho cả lượt, nên `captures` của người này ghi khoá ngoại trỏ vào phiên của người kia. `loadTranscript` nay trả `null` ("không có phiên nào của bạn") tách bạch với `[]` ("phiên của bạn, chưa có gì"), và id không sở hữu thì mở phiên mới. `modelSpec` cố ý không lọc — `ai_config` không có cột `user_id`. **Đợt ba biến cổng release thành một test:** `packages/server/test/service-role-scoping.test.ts` đọc mã nguồn mọi file cầm `SUPABASE_SERVICE_ROLE_KEY`, đòi `.eq("user_id", …)` ở `select`/`update`/`delete` và `user_id` trong hàng ghi của `insert`, và lấy danh sách bảng-của-người-dùng thẳng từ `supabase/migrations/` nên bảng mới tự động được xét. Bước M30 trong [05-test-plan §4.7](05-test-plan.md) đã bỏ — trước đó nó là **một câu trong tài liệu, mà một câu thì không làm đỏ được build**, đó chính là lý do hai truy vấn thiếu lọc sống được nhiều tháng. M28/M29/M31 (hai tài khoản thật) vẫn là việc người làm: test chỉ chứng minh không mệnh đề nào bị quên, không chứng minh id truyền vào là đúng người |
| 13 | **Kịch bản eval cho tìm lại** (AC-52.16) — hiểu câu hỏi thành truy vấn, và không bịa ra câu chưa từng nói | ⬜ Chưa có |
| 14 | **`countTurnsToday` reset theo nửa đêm UTC** — Edge chạy UTC nên hạn mức ngày quay lại lúc **7h sáng VN**, trong khi bản vẽ (khung 429) hứa *"comes back at midnight"*. Bản vẽ là spec: sửa code tính "hôm nay" theo `body.timezone` | ✅ **Đã vá 15/08.** `startOfDayInZone` tính mốc **một lần trong handler dùng chung** rồi truyền xuống store dưới dạng một mốc thời gian — store tự tính là hai shell tự lệch. Offset đọc **hai lần**: offset lúc trưa không phải offset lúc nửa đêm vào ngày đổi DST, và đọc một lần thì sai hẳn ngày. Thiếu/hỏng `timezone` thì neo **UTC**, không phải `Asia/Ho_Chi_Minh` — với model đó là gợi ý đọc giờ, với hạn mức đó là chính sách |
| 16 | **Đường hoàn tác bằng lời** (AC-52.18) — hiện "hoàn tác đi" sẽ thành một task. Hai hướng ở §6 mục 19 | ⬜ Chưa có, chưa chọn hướng |
| 15 | **`captures` không có hạn lưu giữ nào** — pg_cron (kể cả khi bật) chỉ purge `capture_sessions.messages`; bảng được TÌM thì sống mãi. "Quá hạn lưu giữ" của AC-52.15/17 hiện không có thật cho `captures`. Phải chọn một hạn và purge theo, cùng index | ✅ **Đã vá.** Migration `0009_deletion.sql` thêm `captures.expires_at` mặc định 90 ngày (bằng `capture_sessions`, nên hai bảng không nói hai hạn khác nhau), thêm `captures_expires_idx`, và `purge_expired_transcripts()` **xoá hẳn hàng** chứ không chỉ bỏ nội dung — câu nói thô không có gì đáng giữ lại sau khi hết hạn. Chưa kiểm được trên máy này: `expires_at` mới chỉ có mặc định cho hàng **mới**, hàng cũ tạo trước `0009` lấy giá trị từ `default` khi `add column` nên cũng có — nhưng chưa ai chạy `select purge_expired_transcripts()` trên dữ liệu thật |

---

## 5b. "Lịch sử quá dài" — ba bài toán khác nhau bị gọi chung một tên

Đo 15/08. **Trong một phiên thì nó không thể quá dài** — chuyện đó đã chặn từ đầu, ba tầng ở
[01-architecture §4](01-architecture.md), cả ba đã code: UX đẩy về phiên ngắn; cửa sổ trượt **10 lượt** nên model
không bao giờ thấy quá 20 message; trần cứng **30 lượt** → 409. Xấu nhất trong một phiên là ~20 message cộng một
draft snapshot vài chục việc — dưới 3k token. Không phải vấn đề.

Cái đáng nói là ba thứ khác nhau đang bị gọi chung là "lịch sử dài":

| # | Bài toán | Ai đọc | Trạng thái |
|---|---|---|---|
| 1 | **Ngữ cảnh cho model** | model | ✅ Đã giải. Cửa sổ trượt + trần 30 lượt. Và lý do nó giải được không phải vì 10 lượt là đủ nhớ, mà vì **draft snapshot nói lại sự thật hiện tại ở MỖI lượt** — model không cần lượt thứ 3 để biết việc đang thế nào |
| 2 | **Transcript cho NGƯỜI đọc lại** | người dùng | ⬜ Mới, do ADR-12. Hai người đọc muốn hai thứ ngược nhau: model muốn *thứ nhỏ nhất còn giữ nghĩa*, người dùng muốn *mọi thứ mình đã nói, nguyên văn*. Cửa sổ trượt là câu trả lời đúng cho người thứ nhất và sai cho người thứ hai |
| 3 | **Hỏi lại trên transcript dài** | cả hai | ⬜ Nặng nhất, chưa thiết kế. *"Hôm trước tôi nói gì về Đà Nẵng"* trên 90 ngày **không nhét vào prompt được bằng bất cứ cửa sổ nào**. Cần *tìm trước rồi mới đọc*, không phải cửa sổ to hơn |

### Một chỗ không ai đặt trần

`draftSnapshot` ([draft.ts](../packages/core/src/draft.ts)) **không có giới hạn nào** — nó in mọi việc trong draft,
mỗi lượt. Và draft **chỉ lớn lên**: `mergeDraftBack` trả `contextIds` gồm mọi việc còn trong draft, lượt sau
`tasksToDraft` dựng lại đủ từng đó rồi cộng việc mới; không gì rời khỏi ngữ cảnh trừ khi bị xoá.

Nó phình theo **số việc đã đụng tới**, không theo số lượt. Ở trần 30 lượt thì vẫn nhỏ nên **chưa gấp** — ghi ra
đây vì nó là chỗ vỡ đầu tiên nếu ai đó nâng trần 30 lượt, và trần 30 đang là thứ **duy nhất** giữ nó.

### Còn "tóm tắt các lượt cũ" trong kiến trúc thì sao

[01-architecture §4](01-architecture.md) tầng 2 ghi *"summary các turn cũ bằng code từ log tool-calls (chưa hiện
thực)"*. Đáng hỏi lại là **có còn cần không**: draft snapshot nói lại trạng thái hiện tại mỗi lượt, nên các lượt
bị rơi phần lớn không mang thêm gì. Hai chỗ chúng còn mang: câu kiểu *"quay lại như lúc đầu"*, và một câu làm rõ
người dùng **đã trả lời rồi** mà model hỏi lại vì lượt đó đã rơi khỏi cửa sổ. Chưa đo cái nào xảy ra thật.

## 5c. Tìm trong transcript — CHỐT 15/08, và cái giá thật của nó

Voice-first là điểm nhấn của sản phẩm, nên động từ thứ tư phải làm tới nơi: **người dùng tìm lại được cả những
gì mình đã NÓI mà không thành việc**, không chỉ tìm trong các việc. Đề xuất bỏ tính năng này ở §6 mục 15 **bị
bác**, và phần dưới là thiết kế chứ không phải tranh luận lại.

### Tìm trong bảng nào

**`captures.raw_text`, không phải `capture_sessions.messages`.** Ba lý do, và lý do thứ ba mới là lý do thật:

1. `captures` là **một hàng cho một lượt** — đánh index được, phân trang được, lọc theo thời gian được.
   `messages` là một khối jsonb cho cả phiên.
2. Nó giữ **nguyên văn câu của người dùng**, đúng thứ câu hỏi *"tôi đã nói gì"* đang hỏi.
3. Nó được ghi **TRƯỚC khi model chạy** (AC-01.3), nên nó có cả **lượt model lỗi và lượt bị chặn** — chính hai
   thứ vừa được vá ở §5. Tìm trong `messages` là tìm trong những lượt đã *thành công*, tức bỏ sót đúng những lúc
   người dùng nhớ rõ nhất là mình có nói.

Tìm ở `captures`, rồi lấy ngữ cảnh xung quanh (app đã trả lời gì) từ `messages` của phiên tương ứng.

### Index nào

**`pg_trgm` + `unaccent`, không phải full-text với một cấu hình ngôn ngữ.** Postgres không có từ điển tiếng Việt,
nên `to_tsvector` sẽ rơi về `simple` và mất phần lớn giá trị của nó. Nhưng lý do chính không phải vậy: client đã
tìm bằng **bỏ dấu + chuỗi con** (`fold` trong core, dùng bởi `searchTasks`), và trigram + `unaccent` cho đúng
ngữ nghĩa ấy. **Cùng một câu truy vấn phải cho cùng một kiểu kết quả** dù nó chạm vào việc ở máy hay transcript
trên server — hai bộ tìm kiếm cho hai kết quả khác nhau cho cùng một chữ là thứ không ai giải thích nổi.

### Hai thứ nó phá, và cả hai đều là LẦN ĐẦU

| Phá cái gì | Vì sao nó là lần đầu |
|---|---|
| **Tool thuần** | Mọi tool hôm nay đều gấp qua `applyToolCall` — một `switch` **thuần** trên draft, không I/O, và đó chính là thứ khiến `core` test được không cần mạng. `runIntentTurn` nhận `model, messages, draft, now, timezone, listNames` — **không có store**. Một tool `search_history` cần store, nên **đây là tool đầu tiên có I/O**. Đề xuất: tiêm một hàm `searchHistory` vào `runIntentTurn` và **giữ `applyToolCall` thuần** — việc tìm nằm ngoài reducer, không nằm trong |
| **RLS không che đường này** | Edge Function dựng store bằng `SERVICE_KEY`, tức **bỏ qua RLS**. Policy `own captures` **không** bảo vệ truy vấn tìm kiếm. Thiếu một `.eq("user_id", …)` là **rò dữ liệu chéo tài khoản**, và nó không hiện ra thành lỗi — nó hiện ra thành kết quả tìm kiếm trông rất bình thường |

### Ai giữ lịch sử, và lấy nó lúc nào (chốt 15/08)

- **Server giữ, client không bao giờ phải mang theo.** Đây đã đúng từ trước và nay thành luật viết ra:
  `IntentRequestBody.messages` **bị bỏ qua** (`@deprecated`), server tự đọc bản của mình. Lý do cũ vẫn là lý do
  tốt nhất: trần 30 lượt từng đếm từ `body.messages`, nên gửi `messages: []` là vô hiệu hoá nó — **thứ gì một
  luật dựa vào thì không được để bên gửi khai**.
- **Mở màn hội thoại: lấy lịch sử MỘT lần.** Đó là endpoint đọc lịch sử (§5 mục 3), phục vụ **mắt người**.
- **Trong lúc trao đổi: server tự nạp ngữ cảnh cho mỗi lượt**, không lấy lại từ client. Đó là `loadTranscript`,
  phục vụ **model**.
- **Một điều chỉnh so với cách nói "giữ ở backend giữa các lượt":** Edge Function **không có bộ nhớ giữa hai
  request** (ADR-3 — function stateless), nên không thể giữ theo nghĩa để sẵn trong RAM. Thứ thay thế đúng và
  đủ rẻ là **đọc lại từ DB mỗi lượt**: một truy vấn, và nó bị chặn trên bởi chính trần 30 lượt nên không bao giờ
  lớn. Hiệu quả người dùng nhìn thấy là như nhau — client không mang gì cả — chỉ khác chỗ cất.

### Ba cái giá phải nói ra

- **Chi phí và độ trễ.** Một lượt tìm lại = một lượt model (để hiểu câu hỏi) + truy vấn DB + có thể một lượt model
  nữa (để trả lời từ kết quả). Timeout đang là 15s và **chưa có streaming** (§6 mục 3) — hai thứ này nay chồng lên nhau.
- **Đụng thẳng UC-28.** Tìm được làm transcript đáng giữ hơn; UC-28 muốn xoá nó đi. Và index cũng phải bị xoá
  theo, không chỉ dữ liệu.
- **Hạn lưu giữ 90 ngày trở thành một lời nói dối tiềm năng.** *"Tôi biết tôi có nói mà nó bảo không có"* là thất
  bại tệ nhất cho đúng tính năng mà cả điểm là nhớ giùm. Audit 15/08 phát hiện điều ngược lại cũng đang sai:
  bảng được tìm (`captures`) hiện **không có hạn nào** — chỉ `messages` có 90 ngày. Xem §5 mục 15.

### Tiêu chí nghiệm thu bổ sung

- **AC-52.13:** người dùng **tìm lại được thứ mình đã nói mà không thành việc**. Nghiệm thu: nói một câu bị từ
  chối vì ngoài phạm vi (UC-24), rồi hỏi lại về nó sau đó, và tìm ra.
- **AC-52.14:** **không bao giờ thấy dữ liệu của người khác.** Nghiệm thu: hai tài khoản cùng nói một từ khoá,
  mỗi bên chỉ thấy phần của mình — và ca test phải chạy qua **đúng đường mà Edge Function dùng (service role)**,
  không phải qua anon key, vì RLS không che đường đó.
- **AC-52.15:** khi kết quả **bị cắt bớt**, hoặc khi câu hỏi chạm vào khoảng thời gian **đã quá hạn lưu giữ**,
  app **nói ra**. Một kết quả thiếu mà im lặng thì tệ hơn không có kết quả nào — cùng luật "no silent caps".
- **AC-52.17:** giới hạn lưu giữ **được nói ra chủ động, không phải để người dùng tự suy ra**. Và khi người dùng
  **tìm hụt nhiều lần liên tiếp**, app **nhắc lại giới hạn đó** thay vì lặp lại "không tìm thấy". Nghiệm thu:
  hỏi liên tiếp về một khoảng thời gian đã quá hạn — câu trả lời phải **đổi**, từ *không có kết quả* sang *nói
  rõ vì sao sẽ không bao giờ có*. Lý do AC này tồn tại: một người tìm hụt ba lần **không** kết luận rằng dữ liệu
  đã hết hạn, họ kết luận rằng **app tìm kém** — và đó là một kết luận sai mà chính app gây ra bằng cách im
  lặng. *(Chưa chốt: "nhiều lần" là bao nhiêu. Không đặt con số vào AC vì chưa có dụng cụ đo — xem §6.)*
- **AC-52.16:** chất lượng tìm lại là **chất lượng model**, nên nó thuộc `pnpm eval` chứ không thuộc unit test:
  cần kịch bản cho *hiểu đúng câu hỏi thành truy vấn*, và cho *không bịa ra một câu người dùng chưa từng nói*.

## 6. Quyết định còn treo

Bản nháp có 13 mục. Ba mục đã chốt bằng ADR-11/ADR-12 và **không còn nằm ở đây**: *màn này có nên tồn tại*
(có), *nguồn sự thật là máy hay server* (server), *hướng voice-first có được chọn không* (có). Phần còn lại vẫn
treo. Đánh số lại toàn bộ 15/08 (audit) — thứ tự cũ lộn xộn vì các mục được thêm theo dòng thảo luận.

1. **Ai giữ mối nối lượt ↔ việc, sống bao lâu, có sync không?** `mergeDraftBack` trả `changedIds` cho lượt hiện
   tại; không ai lưu. AC-52.5 cần nó sống qua nhiều lượt. Đây là **chi phí thật và lớn nhất** của use case này —
   đừng để nó tàng hình. Với ADR-12 thì chỗ lưu tự nhiên là server, nhưng bảng nào và ràng buộc gì thì chưa thiết kế.
2. **Ngưỡng im lặng đóng phiên đang có hai số khác nhau.** Code client dùng ba phút; UC-11 viết hai phút. Cả hai
   là phán đoán, không có dụng cụ đo. AC-52.4 làm ranh giới này **nhìn thấy được**, nên một con số sai sẽ lộ ra
   ngay — phải thống nhất **trước** khi phơi nó ra.
3. ~~**Streaming hay không.**~~ **Đã chốt một nửa 15/08, bởi AC-54.8:** cần **streaming SỰ KIỆN theo bước** —
   khi agent bắt đầu một bước tra, server đẩy ngay một sự kiện xuống client để hiện và đọc thành tiếng, trên
   cùng kết nối. Đây là bản rẻ của streaming: một sự kiện mỗi bước tool, không phải từng chữ. Cái giá vẫn thật —
   hai shell và `packages/api` đều phải biết đọc một response chảy dần, và `INTENT_TIMEOUT_MS` đổi nghĩa từ
   "cả lượt" thành "khoảng lặng giữa hai sự kiện". **Stream từng chữ vẫn chưa quyết** — đo `pnpm ai:latency`
   trước, vì có thể sự kiện theo bước đã đủ.
4. **Đọc thành tiếng bằng năng lực nào, và với câu lẫn hai thứ tiếng?** Người dùng nói tiếng Việt lẫn tiếng Anh
   trong một câu là chuyện thường ở đây. Một giọng đọc chọn sai thứ tiếng còn khó nghe hơn không đọc.
5. **Bao giờ thì đọc?** Mọi lượt, hay chỉ khi có dấu hiệu rảnh tay? Đọc mọi lượt lúc đang ngồi họp là lý do
   người ta tắt tính năng này và không bật lại.
6. **Quan hệ với UC-18 (sửa việc đã lưu bằng lời).** Mở một việc rồi nói là **một phiên khác**. Lịch sử phiên đó
   nằm chung với phiên ở mặt chính hay nằm theo việc? Nằm theo việc tự nhiên hơn — nhưng phá thẳng luật "luôn
   luôn một phiên" vừa chốt ở §4, nên nếu chọn hướng đó thì phải chọn ở tầng luật chứ không lách qua một màn hình.
7. **Hoàn tác theo lượt.** Undo hiện là **một bậc**, gắn vào câu trả lời gần nhất. "Quay về trạng thái sau lượt
   k" cần ảnh chụp mỗi lượt; chi phí chưa ai đo. Chưa quyết là *không có*, chỉ là chưa quyết.
8. **Lưu giữ vs. hữu ích.** `capture_sessions.messages` giữ 90 ngày. Mặt chính làm lịch sử đáng xem hơn, nên
   người dùng sẽ kỳ vọng lâu hơn — đúng lúc UC-28 muốn ngắn hơn. Hai lực ngược chiều, chưa cân.
9. **Giọng nói: lưu bản nào?** Transcript tạm thời hay bản cuối? Hiện chỉ bản cuối được gửi. Máy nghe nhầm thì
   bản cuối là *sai một cách trông rất tự tin* — và người dùng sẽ đọc lịch sử để tìm đúng chỗ đó.
10. **Vẫn không có dụng cụ đo mức dùng.** Nhắc lại vì nó không mất đi khi quyết định được đưa ra:
    `pnpm ai:latency`, `pnpm quickadd:latency`, `pnpm sync:latency`, `pnpm reminder:latency`, `pnpm eval` đều đo
    **máy**, không đo **người**, và `[analytics] enabled = false`. Quyết định lần này dựa trên xác tín sản phẩm,
    không dựa trên dữ liệu — đó là một lựa chọn hợp lệ, nhưng phải gọi đúng tên nó.
11. **Chưa đo app cùng loại** — luật số 4 của 10-ac-audit, và vẫn **chưa làm**. Todoist, TickTick, Things 3,
    Apple Reminders, cùng Saner.AI và Voicenotes ở mảng nói: có ai cho xem lại lịch sử hội thoại với AI không,
    và nó nằm ở đâu? Chưa tra là chưa đủ điều kiện chốt hình thức.
12. **Một lượt "tìm lại" làm gì với ngữ cảnh?** Nếu người dùng hỏi *"hôm trước tôi ghi gì về Đà Nẵng"* rồi nói
    *"xoá cái thứ hai"* thì kết quả tìm **phải** là ngữ cảnh. Đề xuất: **mở rộng** ngữ cảnh chứ không thay thế,
    rồi để luật mơ hồ sẵn có trong prompt (*"reference mơ hồ thì gọi `ask_clarification` thay vì đoán"*) làm
    việc. Hai thứ phải đi kèm và chưa có: **một ca eval** cho đúng tình huống này, và một cách **nói ra rằng
    ngữ cảnh vừa rộng thêm** — AC-52.4 hứa người dùng biết câu sau tác động vào đâu, mà một lượt tìm lại lặng lẽ
    kéo thêm ba việc vào tầm với thì lời hứa đó hỏng.
13. ~~**Lượt "tìm lại" có tính vào trần 30 lượt và hạn mức ngày không?**~~ **Đóng 15/08 (audit): code đã quyết
    hộ.** Mỗi lượt qua handler đều ghi một dòng `ai_requests`, và `countTurnsToday` đếm đúng bảng đó — nên lượt
    tìm lại **mặc định CÓ tính** vào hạn mức ngày. Muốn miễn thì phải lọc theo role/loại lượt, tức một quyết
    định code có chủ ý chứ không phải một khoảng trống. Gõ từ khoá vẫn không tính — nó không đi qua handler.
14. ~~**Offline thì một câu hỏi tìm lại rơi về đâu?**~~ **Đã chốt 15/08 và câu hỏi tự tan:** mất mạng thì không
    có hội thoại, nên không có câu hỏi nào để định tuyến — người dùng dùng ô tìm kiếm theo từ khoá, thứ vốn đã
    chạy offline. Ghi lại thay vì xoá, vì nó cho thấy cách rẻ nhất để đóng một câu treo là **thu hẹp phạm vi**
    chứ không phải nghĩ thêm cơ chế: hai phương án tôi đã cân — viết tay bộ mẫu câu như `parseDateTime`, và bỏ
    stop-word rồi tìm phần còn lại — đều hỏng theo cùng một kiểu là **trả lời sai một cách tự tin**, và cả hai
    đều trở nên không cần thiết ngay khi ranh giới được vạch dứt khoát.
15. ~~**v1 có tìm trong transcript không?**~~ **Đã chốt 15/08: CÓ.** Đề xuất bỏ của tôi bị bác, và lý do là lý
    do sản phẩm: voice-first là điểm nhấn nên động từ thứ tư phải làm tới nơi. Thiết kế ở **§5c**. Lập luận cũ
    của tôi — *câu đáng nhớ đã thành task rồi* — giữ lại ở đây vì nó vẫn đúng một nửa và nó chỉ ra chỗ tính năng
    này phải chứng minh giá trị: thứ nằm trong transcript mà **không** thành task là câu bị từ chối, câu làm rõ,
    và câu nói hụt. Nếu tìm lại không lôi được đúng loại đó ra thì nó đang trùng với `searchTasks`.
16. **Có đặt trần cho `draftSnapshot` không?** Xem §5b. Chưa gấp vì trần 30 lượt đang che cho nó, nhưng hai thứ
    này đang buộc vào nhau mà không ai viết ra chỗ buộc.
17. **"Tìm hụt nhiều lần" là bao nhiêu lần?** AC-52.17 cố ý không nêu số, theo luật của
    [10-ac-audit](10-ac-audit.md): có ngưỡng thì phải có dụng cụ đo, không có dụng cụ thì không nêu con số. Và
    ở đây thật sự chưa có — analytics đang tắt (§6 mục 10).
18. ~~**Câu nói trên TOÀN danh sách chưa có đường chạy**~~ **Đã duyệt 15/08 → [UC-54](02-use-cases.md):** vòng lặp agent có sẵn (6 bước), thêm đúng một tool đọc `find_tasks` — **backend tra bảng `tasks` đã sync** (thiết kế đổi hai lần trong ngày; bản cuối là bản đúng, sau khi tiền đề "sync chưa xong" bị bắt là sai — UC-17 ✅ từ 11/08). Client đẩy sync trước mỗi lượt; chi phí token chặn bởi số kết quả khớp. Phần dưới giữ nguyên làm bối cảnh, **kể cả câu sai về sync**.
    **Bối cảnh gốc:** Cầu draft-ref
    chỉ cho agent thấy các việc **đang được nói tới** (`contextIds`); phiên nguội thì draft **rỗng**. Nên
    *"dời hết việc Work sang thứ 5"* — chính câu demo trong `vision-voice-first.html`, kèm câu trả lời
    *"Moved 4."* — hôm nay **không chạy được**: agent mù danh sách, và câu đó nhiều khả năng thành một task tên
    y như thế. Đồng thời động từ thứ ba **"xếp giùm"** hiện không có mặt nào trong hội thoại phục vụ: *"tuần này
    tôi xong gì?"*, *"3h mai tôi có gì?"*, *"dồn việc trễ sang mai"* đều chết cùng một chỗ. Ràng buộc kiến trúc
    thật: task nằm trên **máy** (local-first, sync UC-17 chưa xong) nên server không tự tra được — ngữ cảnh bắt
    buộc đi từ client. Hai hướng để cân, chưa quyết: client **chọn trước** rồi seed draft (nhưng client phải
    hiểu câu — gà và trứng), hoặc gửi kèm một **snapshot gọn của danh sách** mỗi lượt (đụng thẳng nỗi lo kích
    thước ở §5b, và phải quyết trường nào được gửi). Đây là ứng viên UC mới, cần duyệt trước khi viết.

19. **Hoàn tác bằng lời đi đường nào?** Hai hướng, chưa chọn. (a) **Client bắt cụm từ đóng** ("hoàn tác",
    "undo") rồi gọi thẳng `store.undo` — không tốn lượt model, chạy cả khi AI chết, và bộ từ vựng **đóng và
    nhỏ** nên không rơi vào cái bẫy đoán-mẫu-câu đã bác ở mục 14 (bẫy đó là cho từ vựng *mở*). (b) **Tool
    `undo_turn` cho model** — hiểu được cả "hoàn tác nhưng giữ cái đầu", đổi lại mọi lần hoàn tác tốn một lượt
    và chết theo AI. Có thể là (a) trước rồi (b) sau; nhưng đó là một quyết định, không phải một mặc định.

> **Bốn ca hồi quy, đã kiểm là ĐỎ trên code cũ** (`packages/server/test/intent.test.ts`): lượt bị chặn 409 vẫn
> ghi được capture; lượt bị chặn 429 vẫn ghi được capture **và không mở phiên mới**; lượt model lỗi để lại mình
> câu của user trong transcript; và lượt lỗi đó được tính vào trần 30 lượt. Theo luật ở `05-test-plan.md`: một
> test chưa từng đỏ là một test không ai biết giá trị.
