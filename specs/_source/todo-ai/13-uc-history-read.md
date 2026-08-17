# UC-55 (tạm) — Đọc lại lịch sử hội thoại

> **Đây là ĐỀ XUẤT, không phải bản đã chốt.** Nó tồn tại để người quyết định có phương án kèm giá, chứ không
> phải để hợp thức hoá một phương án đã viết sẵn thành code. [11-uc-conversation.md](11-uc-conversation.md) §5
> mục 3 treo từ 15/08 đúng vì chưa ai quyết; và [10-ac-audit.md](10-ac-audit.md) ghi lại chuyện gì xảy ra khi
> code đi trước — code trở thành quyết định, và nó ship sai.
>
> **Số hiệu `UC-55` là tạm.** Đây không hẳn là một use case người dùng mới: nó là điều kiện cần của
> **AC-52.2 / 52.3 / 52.5 / 52.6 / 52.8**, đã có mặt trước ở UC-52. Có hai cách đặt, và **chưa chọn**: giữ
> riêng như đây (dễ đọc, dễ giao việc, nhưng thêm một dãy số phải bảo trì), hoặc gộp thẳng vào UC-52 (đúng bản
> chất hơn, nhưng UC-52 vốn đã dài). Xem §5 mục 1.
>
> Luật áp cho mọi AC ở đây: **AC nói nhu cầu, không nói hình thức**; có ngưỡng thì phải chỉ ra dụng cụ đo,
> không có dụng cụ thì không nêu con số.

---

## 0. Bốn sự thật đo được, và chúng đổi bài toán

Đo trong repo ngày 16/08/2026. Không mục nào dưới đây là suy đoán; mỗi mục ghi kèm file và dòng.

### 0.1 `messages` KHÔNG có mốc thời gian, nên "trộn theo thời gian" hiện không làm được

`ChatMessage` là `{ role, content }` và không có gì khác ([types.ts:254-257](../packages/core/src/types.ts)).
`capture_sessions.messages` là một mảng jsonb của đúng hình đó ([0001_init.sql:14](../supabase/migrations/0001_init.sql)).
Còn `captures` có `created_at` cho **từng lượt** ([0001_init.sql:31](../supabase/migrations/0001_init.sql)).

Ràng buộc mà briefing của task này nêu — *"đọc cả hai bảng rồi trộn theo thời gian"* — do đó **không thi hành
được với hình dữ liệu hôm nay**: một bên có thời gian, bên kia không có. Đây là phát hiện nặng nhất của tài
liệu này, và nó buộc phải chọn một **luật ghép** (§3.3) trước khi bàn tới hình response.

### 0.2 Ghép theo thứ tự cũng KHÔNG đúng, và nó sai vĩnh viễn từ giữa phiên

Cách rẻ nhất — *"lượt thứ k của phiên ghép với message user thứ k"* — hỏng vì ba đường ghi không đối xứng:

| Đường | `captures` | `capture_sessions.messages` | Ở đâu |
|---|---|---|---|
| Lượt thành công | +1 hàng | +2 message (user + assistant) | [intent.ts:490](../packages/server/src/intent.ts), [:527](../packages/server/src/intent.ts) |
| Lượt model lỗi | +1 hàng | +1 message (chỉ user) | [intent.ts:589](../packages/server/src/intent.ts) |
| Lượt bị chặn 409/429 | +1 hàng | **không đụng tới** | [intent.ts:455-469](../packages/server/src/intent.ts) |

Một lượt 429 **giữa phiên** ghi capture mang `session_id` của phiên đang mở nhưng không thêm message nào. Từ
đó trở đi chỉ số của hai bên **lệch một và không bao giờ khớp lại** — mọi lượt sau bị gán nhầm câu trả lời của
lượt trước. Ghép sai kiểu này tệ hơn không ghép: nó không rỗng, nó **sai một cách trông rất bình thường**.

### 0.3 Không có gì trong DB nói được vì sao một lượt không có câu trả lời

`captures.status` (`pending`/`processed`/`discarded`) tồn tại từ migration đầu
([0001_init.sql:29-30](../supabase/migrations/0001_init.sql)) và **chưa từng được ghi** — §5 mục 5 của UC-52
ghi đúng như vậy, và grep toàn repo không thấy chỗ nào `update` cột đó. Hệ quả: bốn tình huống khác hẳn nhau
hiện ra **cùng một hình** — "có câu người dùng, không có câu trả lời":

1. model lỗi; 2. bị chặn 409; 3. bị chặn 429; 4. câu trả lời đã bị job lưu giữ bỏ trắng.

Gộp bốn thứ đó làm một là đúng loại nói dối mà AC-52.8 tồn tại để chặn, chỉ khác chỗ đứng.

### 0.4 Hai bảng già đi khác nhau, và với hàng cũ thì lệch hẳn

`purge_expired_transcripts()` **xoá hẳn** hàng `captures` quá hạn nhưng chỉ **bỏ trắng** `capture_sessions.messages`
([0009_deletion.sql:57-67](../supabase/migrations/0009_deletion.sql)). Với hàng mới thì hai mốc gần như trùng
nhau. Với hàng có trước `0009` thì không: `captures.expires_at` được thêm bằng
`add column ... default now() + interval '90 days'` ([0009_deletion.sql:41-42](../supabase/migrations/0009_deletion.sql)),
nên hàng cũ nhận hạn tính từ **thời điểm chạy migration**, trong khi phiên của chúng tính từ lúc tạo. Có thật
một khoảng mà **câu người dùng còn, câu trả lời đã bị bỏ trắng** — và không được hiện nó ra như một lượt model lỗi.

### 0.5 Mối nối lượt ↔ việc: có một cột, và không ai ghi

`tasks.capture_id` có từ migration đầu ([0001_init.sql:40](../supabase/migrations/0001_init.sql)) và
`Task.captureId` có trong core ([types.ts:42](../packages/core/src/types.ts)). Grep `packages/`, `apps/`,
`supabase/`: **không đường nào ghi giá trị vào đó** — đồng bộ đẩy lên không mang cột này. Nên "đã có sẵn một
nửa AC-52.5" là **không đúng**; đúng hơn là *đã có sẵn một chỗ để cắm, chưa có dây*. Và kể cả khi cắm, cột đó
chỉ trả lời *"việc này do lượt nào TẠO RA"*, không trả lời *"lượt này đã ĐỔI những việc nào"* — cái sau mới là
điều AC-52.5 hứa, và `mergeDraftBack` trả `changedIds` tách riêng khỏi `contextIds` đúng cho việc đó
([conversation.ts:56-67](../packages/core/src/conversation.ts)).

---

## 1. Luồng chính

**Mô tả.** Người dùng mở mặt hội thoại và **đọc lại được những gì mình đã nói hôm nay cùng cách app đã hiểu**,
sau khi mọi hiệu ứng tạm thời đã tắt, kể cả khi lượt đó đã hỏng hoặc bị chặn, kể cả khi họ đang ngồi ở máy khác.

**Precondition.** Đã đăng nhập (ADR-10) và **có mạng** (ADR-12 — server là nguồn sự thật; mất mạng thì không có
mặt hội thoại chút nào, xem UC-52 §4).

1. Mở mặt hội thoại → mặt này **dùng được ngay**, gõ/nói được câu đầu tiên mà không phải chờ lịch sử về.
2. Song song, app hỏi server *"hôm nay tôi đã nói gì"* — **một lần**, một yêu cầu.
3. Các lượt hiện ra theo thứ tự thời gian: câu người dùng, và app đã trả lời ra sao — hoặc **vì sao không có
   câu trả lời**.
4. Ranh giới giữa hai phiên nhìn thấy được, nên người dùng biết câu tiếp theo là *sửa tiếp* hay *việc mới*.
5. Còn lượt cũ hơn cửa sổ đang xem → biết là **còn**, và lấy tiếp được.
6. Từ một lượt, tới được đúng việc mà lượt đó đã đổi.
7. Lấy hụt vì server → nói rõ **chưa tải được** kèm cách thử lại; hội thoại vẫn dùng bình thường.

**Tiêu chí nghiệm thu**

- **AC-55.1:** mở mặt hội thoại thì lịch sử hôm nay về được **bằng một lần lấy dữ liệu**, không cần thao tác gì
  thêm. Nghiệm thu: đếm số yêu cầu mà mặt này phát ra khi mở — đúng một; và số lượt hiện ra bằng số câu đã nói
  hôm nay. *(Phục vụ AC-52.2.)*
- **AC-55.2:** **mọi lượt đã được ghi đều lấy về được** — lượt thành công, lượt model lỗi, lượt bị chặn vì phiên
  quá dài, và lượt bị chặn vì hết hạn mức ngày, **kể cả lượt bị chặn ngay ở câu đầu tiên trong ngày, khi chưa có
  phiên nào**. Nghiệm thu: gây đủ bốn tình huống rồi đối chiếu số lượt lấy về với số câu đã nói; hai số bằng
  nhau. *(Phục vụ AC-52.3 — đây là vế "xem lại được" mà AC đó còn thiếu.)*
- **AC-55.3:** khi một lượt **không có câu trả lời**, người dùng biết **vì sao**, và bốn lý do ở §0.3 không được
  hiện ra như nhau. Nghiệm thu: dựng đủ bốn hàng đó rồi đọc lại — không hai hàng nào cho cùng một kết quả.
- **AC-55.4:** **đọc lại không làm thay đổi gì cả** — không mở phiên mới, không tiêu lượt, không sinh bản ghi
  telemetry nào. Nghiệm thu: đếm `ai_requests` và `capture_sessions` của tài khoản đó trước và sau khi mở–đóng
  nhiều lần; cả hai số không đổi. *(Phục vụ AC-52.6.)*
- **AC-55.5:** **không bao giờ trả về dữ liệu của tài khoản khác.** Nghiệm thu: hai tài khoản cùng nói một câu,
  mỗi bên chỉ lấy về phần của mình — và ca test phải chạy qua **đúng đường mà bản production dùng**, vì nếu
  đường đó là service role thì RLS không che nó. *(Phục vụ AC-52.14.)*
- **AC-55.6:** **"chưa tải được" và "chưa nói gì" là hai câu trả lời khác nhau**, và không hình thức nào của cái
  thứ nhất trông giống cái thứ hai. Nghiệm thu: so trạng thái khi endpoint hỏng với trạng thái của một tài khoản
  thật sự chưa nói gì hôm nay; hai màn phải khác nhau và test E2E phân biệt được. *(Phục vụ AC-52.8.)*
- **AC-55.7:** **không cắt âm thầm.** Khi còn lượt chưa lấy về hết, người dùng biết là còn và lấy tiếp được.
  Nghiệm thu: dựng nhiều lượt hơn một lần lấy, kiểm rằng "còn nữa" nói ra được và lấy tiếp ra đúng phần còn lại,
  không trùng không sót. *(Cùng luật với AC-52.15.)*
- **AC-55.8:** thứ đọc được là **câu của người dùng và tên việc thật**; ký hiệu nội bộ của agent (`d1`, `d2`)
  không bao giờ lọt ra. *(Phục vụ AC-52.10 / ADR-9.)*
- **AC-55.9:** từ một lượt, người dùng **tới được đúng việc lượt đó đã đổi**; và khi mối nối ấy **không được
  ghi**, điều đó phải hiện ra khác với *"lượt này không đổi gì"*. Nghiệm thu: dựng một lượt có đổi việc nhưng
  mối nối không được lưu, và một lượt thật sự không đổi gì — hai lượt phải đọc ra khác nhau. *(Phục vụ AC-52.5.)*
- **AC-55.10:** **endpoint này không nằm trên đường tạo hay sửa bất kỳ việc nào.** Nghiệm thu: chặn hoàn toàn nó
  rồi chạy lại E2E-W0 trong [05-test-plan.md](05-test-plan.md) — mọi UC nhóm CORE vẫn pass, và mặt hội thoại vẫn
  gõ được câu đầu tiên trước khi lịch sử về. *(ADR-7 / AC-52.7.)*
- **AC-55.11:** sau khi người dùng **xoá lịch sử** (UC-28) thì không còn gì để đọc — kể cả sau khi tắt và mở lại
  app. Nghiệm thu: xoá, khởi động lại, mở mặt hội thoại; không bản sao nào sống lâu hơn lệnh xoá.
  *(Phục vụ AC-52.12.)*

> **Cố ý không có AC nào về:** số lượt trong một lần lấy, độ dài cửa sổ mặc định, thời gian phản hồi của
> endpoint. Ba thứ đó là **hàng rào chi phí**, không phải tiêu chí nghiệm thu, và chưa có dụng cụ nào đo được
> con số đúng — analytics đang tắt (UC-52 §6 mục 10).

---

## 2. Edge case & validation

Bảng này là test plan; mỗi dòng dịch thẳng được thành một ca.

| Tình huống | Hành vi mong đợi |
|---|---|
| Lượt **429 ở câu đầu tiên trong ngày** — capture có `session_id = null` ([intent.ts:458](../packages/server/src/intent.ts)) | Vẫn xuất hiện, đứng đúng chỗ theo thời gian, **không** bị gán vào phiên nào. Đây là ca làm rớt mọi thiết kế chỉ đọc `messages` |
| Lượt **409 giữa phiên** — capture có `session_id`, `messages` không đổi | Hiện là **lượt bị chặn**, không phải "app im lặng". Và các lượt sau nó trong cùng phiên **không được lệch câu trả lời** (§0.2) |
| Lượt **model lỗi** — `messages` chỉ có câu user ([intent.ts:589](../packages/server/src/intent.ts)) | Hiện là lượt lỗi, và **thử lại được mà không phải nói lại** (AC-25.1) |
| Câu người dùng còn, **câu trả lời đã bị bỏ trắng** vì hết hạn (§0.4) | Nói rõ là **quá hạn lưu giữ**, không hiện như lượt model lỗi |
| Hàng `captures` đã bị xoá hẳn nhưng phiên còn (§0.4) | Số lượt tụt xuống là **đúng**, nhưng phải nói ra ranh giới lưu giữ chứ không im lặng — cùng luật AC-52.17 |
| **Hai thiết bị** cùng mở app → hai phiên mở song song (UC-52 §4: chưa ép được ở server) | Cả hai phiên đều hiện, đan xen theo thời gian, và **ranh giới phiên vẫn đọc được**. Không được giả vờ chỉ có một |
| Con trỏ phân trang trỏ vào hàng **đã bị job lưu giữ xoá** giữa hai lần lấy | Lấy tiếp vẫn chạy, không trùng không sót, không 5xx |
| `sessionId`/con trỏ **không đúng định dạng** | Không 5xx, không rò gì. Cùng kỷ luật với `loadTranscript`, vốn trả `null` cho chuỗi không phải uuid ([chat-intent/index.ts:151](../supabase/functions/chat-intent/index.ts)) |
| Con trỏ trỏ vào **dữ liệu của tài khoản khác** | Trả về như thể không có gì của người đó — **không** phải một thông báo xác nhận rằng nó tồn tại |
| **Đọc từ store lỗi** | Phải là **lỗi**, không bao giờ là "rỗng". Đây đúng là kỷ luật đã viết cho `loadTranscript` ([intent.ts:112-124](../packages/server/src/intent.ts)): một lần đọc hỏng mà báo "không có gì" là một lời nói dối về dữ liệu của người dùng |
| `timezone` **thiếu hoặc hỏng** | Neo **UTC**, giống hạn mức ngày, không neo `Asia/Ho_Chi_Minh` — với hạn mức và với cửa sổ đọc thì múi giờ là **chính sách**, không phải gợi ý ([intent.ts:199](../packages/server/src/intent.ts)) |
| Người dùng **đổi múi giờ giữa ngày** (đi máy bay) | Cửa sổ "hôm nay" đổi theo, và điều đó phải hiểu được. Lượt không mất khỏi hệ thống, chỉ ra khỏi cửa sổ |
| **Rất nhiều lượt** trong một ngày | Phân trang; "còn nữa" nói ra được (AC-55.7). Không dựng quá một trang dòng trong một lần render — cùng luật AC-45.3 |
| Lượt chứa **đoạn rất dài** (dán từ email, UC-03.2) | Không cắt âm thầm; cần cắt để hiển thị thì phải mở ra xem được đủ |
| **Không có mạng** | **Không gọi endpoint này chút nào.** Mặt hội thoại giao lại cho danh sách (UC-52 §4). Đây không phải trạng thái lỗi của endpoint |
| Có mạng, **endpoint chưa deploy** hoặc build dev không cấu hình Supabase | Nói rõ **chưa tải được**; không phải màn trắng và **không** phải "bạn chưa nói gì" (AC-55.6) |
| **Xoá lịch sử** (UC-28) giữa lúc mặt này đang mở | Lần lấy kế tiếp rỗng **thật**, và không bản sao nào ở máy sống lâu hơn lệnh xoá (AC-55.11) |
| Cùng **một câu nói hai lần** trong một phiên | Hai lượt riêng biệt, đúng thứ tự. *(Đây là ca làm hỏng luật ghép P1 ở §3.3 — nếu chọn P1, ca này phải nằm trong bộ test.)* |
| Lượt đã bị **hoàn tác** | Vẫn hiện, kèm dấu đã hoàn tác. Xoá dòng đó đi là làm sai lệch chính thứ lịch sử này tồn tại để ghi (UC-52 §3) |

---

## 3. Các phương án

Ba trục **độc lập nhau**: đi đường nào, trả về hình gì, ghép lượt bằng luật nào. Chọn được từng trục một.

### 3.1 Trục A — đường đi

| | **A1. `GET` trên chính `chat-intent`** | **A2. Edge Function thứ hai (`chat-history`)** | **A3. Không có endpoint nào — đọc thẳng bằng JWT của người dùng** |
|---|---|---|---|
| Cách làm | Thêm một handler đọc trong `@todo-ai/server`, hai vỏ định tuyến theo `req.method` | Handler riêng, function riêng, mục riêng trong `config.toml` | `packages/client` `select` thẳng hai bảng qua PostgREST, hoặc một hàm `security invoker` như `delete_my_history` |
| `IntentStore` | **Không đụng.** Interface đọc **tách riêng** (`HistoryStore`), chỉ có phương thức đọc | Như A1 | Không liên quan |
| Vỏ Supabase | +2 dòng định tuyến. Phải **thêm `GET`** vào `Access-Control-Allow-Methods`, hiện là `"POST, OPTIONS"` ([intent.ts:37](../packages/server/src/intent.ts)) | Function mới: `config.toml`, `pnpm build:edge` phải bundle thêm, một đích deploy nữa | Không có vỏ nào |
| Vỏ dev (Next.js) | Thêm `export async function GET`; `memoryStore` phải có phần đọc | Route mới `apps/web/app/api/chat-history` | **Không chạy** — build dev không có Supabase thì không có lịch sử |
| `packages/api` | Thêm một hàm `fetchHistory` cạnh `sendIntentTurn`; dùng lại `IntentError` ([api/index.ts:47](../packages/api/src/index.ts)) | Như A1, thêm một quy tắc chọn địa chỉ nữa cạnh `intentEndpoint` | Không đụng — nhưng `packages/client` học hình bảng |
| Gate `error-codes.test.ts` | **Tự động được quét**: file chứa `handleIntentRequest` là vào diện quét ([:69](../packages/server/test/error-codes.test.ts)). Mọi mã lỗi mới phải vào `FAILURE_DISPOSITION` | **Thoát khỏi diện quét** nếu file mới không nhắc `handleIntentRequest` — một lỗ im lặng trong đúng cái gate dựng ra để chặn lỗ im lặng. Phải sửa `SURFACE_ANCHORS` cùng lúc | Không phát mã lỗi nào; lỗi là lỗi PostgREST. Gate không áp, và **cũng không cần** |
| Gate `service-role-scoping.test.ts` | Áp ngay nếu vỏ Supabase dùng service key: mọi truy vấn mới phải có `.eq("user_id", …)` ([:411](../packages/server/test/service-role-scoping.test.ts)) | Như A1, và phải thêm file mới vào `SURFACE_ANCHORS` ([:92](../packages/server/test/service-role-scoping.test.ts)) | **Không áp — và không cần**: chạy bằng JWT người dùng nên RLS `own captures`/`own sessions` là ranh giới thật ([0001_init.sql:117-120](../supabase/migrations/0001_init.sql)) |
| Cái nó **phá** | `handleIntentRequest` không còn là "một lượt hội thoại"; phải cẩn thận để nhánh đọc không bao giờ chạm đường ghi | Hai đích deploy có thể lệch nhau — đúng thứ mà "một handler, hai vỏ" dựng ra để chặn | Kỷ luật "một handler, hai vỏ" **biến mất** vì không có handler nào; và server không bao giờ học cách trộn, trong khi `search_history` (§5c của UC-52) sẽ cần đúng phép trộn đó |
| Cái nó **đóng lại** | Gần như không gì | Không gì, ngoài tiền bảo trì | Đóng đường streaming/telemetry cho lần đọc; và nếu sau này muốn server lọc/tóm tắt trước khi trả thì phải làm lại từ đầu |

**Về AC-55.4 (đọc lại không đổi gì):** chỉ A1/A2 với **interface đọc tách riêng** biến lời hứa đó thành thứ
*không thể vi phạm* — nếu `HistoryStore` không có `createSession` và không có `logRequest` thì đường đọc **không
có cách nào** mở phiên hay tiêu hạn mức. Còn nếu nhét nhánh đọc vào chung `handleIntentRequest` với chung
`IntentStore` thì lời hứa chỉ là **một câu `if` đặt đúng chỗ** — và đúng loại `if` đặt sai chỗ là lỗi §5 mục 1
của UC-52 (hai `return` nằm trên `saveCapture`, làm mất chữ của người dùng). A3 đạt AC-55.4 theo cách khác và
cũng chắc: nó chỉ có quyền `select`.

### 3.2 Trục B — hình response

| | **B1. Server trộn sẵn: một danh sách "lượt"** | **B2. Server trả thô hai bộ: `captures[]` + `sessions[]`, client tự trộn** |
|---|---|---|
| Hình | `{ window: {from,to}, turns: [...], nextCursor, hasMore }`; mỗi `turn` = `{ id, at, sessionId\|null, text, reply, outcome, changedTaskIds? }` | `{ window, captures: [...], sessions: [{id, status, messages}] , nextCursor, hasMore }` |
| Ai chịu luật ghép | Server, một chỗ | Client — nhưng `packages/client` là **một bản dùng chung cho cả hai app**, nên không phải hai bản |
| Giá | Phải **chốt luật ghép ngay hôm nay** (§3.3) | Hoãn được quyết định — nhưng hoãn vào chỗ khó sửa hơn: đổi luật ghép sau này là đổi client đã cài trên máy người ta |
| Ưu | Hợp đồng nói bằng **khái niệm của người dùng** ("một lượt"), nên đổi cách lưu bên dưới không phá client. AC-55.2 nghiệm thu bằng một phép đếm | Server "ngu", dễ test, dễ chuyển sang A3; phản chiếu đúng chỗ cất |
| Nhược | Server phải biết khái niệm "lượt hội thoại" — vẫn hợp ADR-9 (không có chữ "task" nào), nhưng là khái niệm mới ở tầng `server` | **Rò hình lưu trữ ra hợp đồng.** Ngày đổi `messages` sang bảng khác là ngày mọi client cũ hỏng |
| Đóng lại | Không gì đáng kể | Đóng khả năng đổi cách lưu mà không đụng client |

### 3.3 Trục C — luật ghép câu trả lời vào lượt

| | Cách làm | Giá | Cái nó phá |
|---|---|---|---|
| **P1. Khớp theo nội dung** | Ghép `captures.raw_text` với message user có `content` bằng đúng nó, trong cùng phiên, theo thứ tự | Rẻ nhất, **không đổi schema, không đổi đường ghi** | Mơ hồ khi cùng một câu nói hai lần (đã có trong bảng §2). Và vẫn không trả lời được §0.3 |
| **P2. Đóng dấu vào transcript** | `saveTranscript` ghi kèm `captureId` (và/hoặc `at`) trên mỗi message | Đổi hình jsonb; `loadTranscript` phải **bóc lại** trước khi đưa cho model — nếu không, siêu dữ liệu lưu trữ đi thẳng vào ngữ cảnh model | Hàng cũ không có dấu → phải chấp nhận hai hình cùng tồn tại một thời gian |
| **P3. Đưa câu trả lời về `captures`** | Thêm cột `reply_text` + `outcome` vào `captures`, ghi lúc kết thúc lượt; endpoint đọc **một bảng** | Một migration + sửa đường ghi. Câu trả lời nằm ở hai chỗ (một cho model, một cho người) và **có thể lệch nhau** | Không phá gì; và nó **giải luôn §0.2, §0.3**: mỗi lượt là một hàng, có thời gian, có kết cục |

P3 dưới dạng bản nháp — **đây là nháp trong tài liệu, chưa phải migration**:

```sql
-- Nháp cho phương án P3. CHƯA đặt vào supabase/migrations/.
alter table captures add column if not exists reply_text text;
alter table captures add column if not exists outcome text
  check (outcome in ('answered', 'model_error', 'refused_session', 'refused_quota'));
create index if not exists captures_user_created_idx on captures (user_id, created_at desc);
```

Cột `outcome` đứng cạnh `status` sẵn có chứ không thay nó: `status` nói *"đã xử lý chưa"* (cần cho retry,
AC-25.1), `outcome` nói *"kết cục ra sao"* (cần cho AC-55.3). Gộp hai thứ vào một cột là cách chắc chắn để
không cái nào đúng cả. **Chưa quyết** — xem §5 mục 4.

### 3.4 Cửa sổ và con trỏ

Áp cho cả B1 lẫn B2, vì đây là chuyện của truy vấn chứ không của hình.

- **Mặc định lấy về = HÔM NAY theo múi giờ người dùng, gồm cả phiên đã đóng.** Không phải "phiên hiện tại" và
  không phải 90 ngày. Chốt này đã có ở UC-52 §4 và có lý do riêng: AC-52.4 đòi **ranh giới phiên nhìn thấy
  được**, mà ranh giới chỉ nhìn thấy khi có hai bên.
- **Mốc "hôm nay" tính bằng `startOfDayInZone`, thứ đã có và đã export** ([intent.ts:272](../packages/server/src/intent.ts)).
  Dùng lại chứ không viết bản thứ hai: hạn mức ngày và cửa sổ đọc mà lệch nhau một giờ thì người dùng thấy một
  lượt bị tính vào hôm nay nhưng không đọc lại được ở hôm nay.
- **Con trỏ khoá theo `(captures.created_at, captures.id)` giảm dần** — không phải `offset`, không phải "theo
  phiên". `offset` sai vì job lưu giữ xoá hàng ngay dưới chân con trỏ giữa hai lần lấy. "Theo phiên" sai vì hai
  lý do đã đo: lượt 429 đầu ngày **không có phiên nào**, và hai thiết bị mở song song thì phiên **đan xen**.
- **`hasMore` là một trường tường minh**, không suy ra từ "số phần tử bằng đúng `limit`". Suy ra được thì có
  ngày suy sai, và cái sai đó là **cắt âm thầm** — thứ AC-55.7 tồn tại để chặn.

### 3.5 Khuyến nghị, và điều gì làm tôi đổi ý

**A1 + B1 + P3.**

- **A1** vì nó không thêm đích deploy nào, ở lại **bên trong cả hai gate tự động** (được quét vì file vẫn nhắc
  `handleIntentRequest`), và giữ được kỷ luật một handler hai vỏ. Điều kiện kèm theo, không thương lượng:
  **interface đọc phải tách khỏi `IntentStore`**, để AC-55.4 là một sự thật cấu trúc chứ không phải một câu `if`.
- **B1** vì hợp đồng nên nói bằng khái niệm "một lượt". Đó cũng là khái niệm mà AC-52.3 đếm, nên nghiệm thu trở
  thành một phép đếm chứ không phải một lập luận.
- **P3** vì nó là phương án duy nhất giải cả §0.2 lẫn §0.3 thay vì đi vòng qua chúng. Nó cũng khớp với nhận xét
  ở UC-52 §5b: **model và người đọc muốn hai thứ ngược nhau** — P3 để `messages` làm đúng việc của model và để
  `captures` làm đúng việc của người.

**Cái giá phải nói ra:** P3 đảo thứ tự công việc. Đường **ghi** phải sửa trước, rồi endpoint đọc mới đáng dựng —
và lịch sử cũ (trước migration) sẽ không có `reply_text`, nên vẫn cần một đường lùi, khả năng là P1 áp cho hàng cũ.

**Điều gì làm tôi đổi ý:**

- Nếu ưu tiên là **thấy AC-52.2 chạy trong tuần này, không migration**: chọn **A3 + B2 + P1**. Nó rẻ nhất thật —
  RLS đã có sẵn, `delete_my_history` đã chứng minh đường RPC-bằng-JWT chạy được
  ([auth.ts:126-134](../packages/client/src/auth.ts)) — và nếu hợp đồng viết theo "lượt" thì thay bằng A1+B1 sau
  không phá client.
- Nếu **`search_history` (§5c của UC-52) được ưu tiên trước**: A3 mất giá trị ngay, vì phép trộn dù sao cũng
  phải sống ở server. Khi đó A1+B1 là hiển nhiên và P3 càng đáng hơn.
- Nếu quyết định là **không đổi schema trong đợt này vì bất kỳ lý do gì**: P1 chấp nhận được **với điều kiện** ca
  "cùng một câu nói hai lần" nằm trong bộ test và AC-55.3 được ghi nhận là **chưa đạt**, chứ không im lặng.

---

## 4. Tám câu hỏi của briefing — trả lời ở đâu

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | "Một lượt" trong response là gì? | §3.2 (B1: một `turn`) + §3.3. Lượt bị chặn = có `text`, không có `reply`, `outcome` nói vì sao; lượt 429 đầu ngày có `sessionId = null` — §0.2, §2 dòng 1 |
| 2 | Lấy về bao nhiêu, con trỏ theo cái gì? | §3.4. Mặc định = hôm nay theo múi giờ người dùng; con trỏ khoá theo `(created_at, id)`; **một** lần lấy khi mở |
| 3 | AC-52.5 — mối nối lượt ↔ việc | **Không phải đi trước**, nhưng hình response phải chừa chỗ **ba trạng thái** ngay từ đầu: *có mối nối* / *không đổi việc nào* / *không được ghi lại*. Thiếu trạng thái thứ ba thì AC-55.9 rớt và không sửa được mà không phá hợp đồng. Chỗ lưu và ràng buộc: §5 mục 2 — vẫn treo |
| 4 | AC-52.6 — đọc lại không đổi gì | §3.1. Bảo đảm bằng **cấu trúc**: interface đọc không có `createSession`/`logRequest` thì không có gì để vi phạm |
| 5 | AC-52.8 — "chưa tải được" ≠ "chưa nói gì" | §2 dòng "đọc từ store lỗi" + AC-55.6. Luật: **lỗi đọc phải nổi lên thành lỗi**, đúng kỷ luật đã viết cho `loadTranscript`; và rỗng thành công phải mang bằng chứng rỗng (`window` có mặt) chứ không chỉ là một mảng trống |
| 6 | ADR-7 — hỏng thì rơi về đâu | AC-55.10. Endpoint **không cần thêm gì**: mất mạng thì mặt hội thoại không chạy chút nào (UC-52 §4), nên thứ duy nhất thiết kế này phải bảo đảm là **không nằm trên đường tạo/sửa việc** và **không chặn câu nói đầu tiên** |
| 7 | Route thứ hai hay `GET` trên route cũ? | §3.1 — ba phương án kèm giá ở `IntentStore`, hai vỏ, `packages/api` và **cả hai gate tự động**. Khuyến nghị A1 |
| 8 | Xoá lịch sử (UC-28) | **Tách được, và phần server đã xong.** `delete_my_history()` đã có ([0009_deletion.sql:77](../supabase/migrations/0009_deletion.sql)) và đã nối vào client ([auth.ts:126](../packages/client/src/auth.ts)). Thứ endpoint này **nợ** UC-28 đúng một điều, và nó là một luật thiết kế chứ không phải một tính năng: **không được lưu bền bản lịch sử lấy về** (không `KeyValueStore`, không cache đĩa). Cache bền chính là bản sao mà AC-52.12 sẽ phải đi tìm và xoá |

---

## 5. Quyết định còn treo

Không mục nào dưới đây được viết thành AC. Một AC không nghiệm thu được thì không phải AC, và một câu hỏi viết
dưới dạng AC che mất việc chưa ai quyết.

1. **Tài liệu này là UC riêng hay một phần của UC-52?** Đang để `UC-55` tạm. Cần: một người quyết cách đánh số,
   vì nó ảnh hưởng tới truy vết AC trong toàn bộ `docs/`. Người quyết: chủ sản phẩm.
2. **Mối nối lượt ↔ việc lưu ở đâu.** Vẫn là mục 1 của UC-52 §6 và vẫn treo. Tài liệu này chỉ thu hẹp được một
   nửa: `tasks.capture_id` **không** phải câu trả lời (§0.5 — không ai ghi nó, và nó chỉ nói "tạo bởi", không nói
   "đổi bởi"). Hai hướng chưa cân: một cột mảng trên `captures` (chết cùng capture — tốt cho UC-28), hay một bảng
   nối riêng (truy vấn hai chiều được — cần nếu sau này muốn hỏi "việc này đến từ lượt nào"). Cần: đo xem chiều
   ngược lại có thật sự được dùng không.
3. **Có ghi `captures.status` trong đợt này không** (§5 mục 5 của UC-52). AC-55.3 phụ thuộc vào một cột nói được
   kết cục. P3 thêm `outcome` riêng; nếu không chọn P3 thì phải quyết `status` có gánh việc đó không. Cần: chốt
   trục C trước.
4. **`reply_text` có làm câu trả lời tồn tại hai bản không, và bản nào đúng khi lệch?** Với P3, `messages` giữ
   bản cho model, `captures.reply_text` giữ bản cho người. Hôm nay hai bản luôn bằng nhau vì cùng một chuỗi được
   ghi hai lần — nhưng chưa có gì **ép** chúng bằng nhau. Cần: một luật viết ra ("bản cho người là bản đúng"),
   hoặc một ca test giữ chúng khớp.
5. **Cửa sổ mặc định là "hôm nay" — nhưng người dùng có kéo ngược quá hôm nay được không?** UC-52 §4 cố ý không
   vẽ một tháng cuộn ngược, vì làm vậy là vô tình thiết kế luôn chính sách lưu giữ, đúng lúc UC-28 kéo ngược lại
   (UC-52 §6 mục 8). Con trỏ ở §3.4 **cho phép** kéo ngược về mặt kỹ thuật. Có phơi ra hay không là quyết định
   sản phẩm, chưa có. Cần: cân với §6 mục 8 của UC-52, cùng lúc, không tách.
6. **Phiên thuộc thiết bị hay thuộc tài khoản** (UC-52 §5 mục 4, §4). Endpoint này **chịu được cả hai** — nó trả
   về theo thời gian chứ không theo phiên — nhưng thứ hiện ra thì khác hẳn nhau: hai phiên đan xen của hai máy
   đọc rất lạ nếu người dùng không biết máy kia đang mở. Cần: quyết cùng lúc với việc ghi
   `capture_sessions.status`/`closed_reason` (§5 mục 4 của UC-52), vì đó cũng là thứ AC-52.4 cần.
7. **Lần đọc này có cần đo không?** `ai_requests` cố ý **không** được ghi (AC-55.4). Nhưng thế thì không ai biết
   endpoint này có được dùng hay không, có chậm hay không. Đo bằng một chỗ khác hay chấp nhận mù? Cần: nhắc lại
   rằng analytics đang tắt (UC-52 §6 mục 10) — quyết định này cũng dựa trên xác tín, không dựa trên dữ liệu.
8. **Thời gian chờ tối đa cho lần đọc.** `INTENT_TIMEOUT_MS = 15s` là con số của UC-25 cho **một lượt model**
   ([api/index.ts:45](../packages/api/src/index.ts)); một lần đọc DB không có lý do gì chờ lâu như vậy, nhưng
   chưa ai đo nó mất bao lâu. Cần: đo trước, đừng chọn số trước.
9. **Mã lỗi mà endpoint đọc phát ra sẽ đi vào `FAILURE_DISPOSITION` như thế nào?** Bảng đó trả lời *"gửi lại có
   giúp gì không"* cho một **lượt AI bị xếp hàng** (AC-13.2) — câu hỏi ấy **vô nghĩa với một lần đọc**. Nhưng nếu
   chọn A1 thì gate `error-codes.test.ts` sẽ đòi phân loại chúng
   ([:183](../packages/server/test/error-codes.test.ts)). Hai lối ra, chưa chọn: **dùng lại** đúng các mã đã có
   (`Unauthorized`, `store_unavailable`) nên không phải thêm dòng nào; hay **tách khái niệm** trong gate để phân
   biệt lỗi-của-lượt với lỗi-của-lần-đọc. Lối thứ nhất rẻ hơn hôm nay và mượn nghĩa của một bảng khác; lối thứ
   hai đúng hơn và tốn một lần sửa test. Cần: người review gate quyết.
