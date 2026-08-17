# Feature Audit Matrix — Todo AI

> Bản đồ trạng thái hiện thực để audit. Đối chiếu UC ở [02-use-cases.md](02-use-cases.md), kiến trúc ở [01-architecture.md](01-architecture.md), UI ở [03-ui-design.md](03-ui-design.md).

**Chú giải trạng thái:**
- ✅ **Done** — hiện thực + có test/verify được
- 🟡 **Scaffold** — có code chạy được nhưng thiếu phần nêu ở ghi chú
- 📐 **Designed** — đã thiết kế trong docs, chưa có code
- ⬜ **Planned** — mới nằm trong spec README

## ✅ Gap kiến trúc lớn nhất đã đóng

Trước đây code route **mọi** input qua AI (`chat-intent`) — vi phạm ADR-7. Nay tầng CORE đứng độc lập: `packages/core/src/tasks.ts` là các hàm thuần (31 test), lưu local qua `storage.ts` (localStorage / AsyncStorage), và Inbox/Today/quick-add **không gọi mạng lần nào**.

**Đã kiểm chứng bằng trình duyệt thật** (Playwright, `setOffline(true)` + chặn `**/functions/v1/**`): thêm task, đánh done, và dữ liệu vẫn ghi được xuống local khi AI bị chặn hoàn toàn — đúng kịch bản E2E-W0 trong [05-test-plan.md](05-test-plan.md).

## Nhóm CORE — Todo cơ bản không cần AI

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-31 | Quick-add thủ công | ✅ | `tasks.ts:addTask`, `TaskListView`/`TaskListScreen` | Ô quick-add đầu list, Enter là xong; ghi thẳng local, không qua mạng |
| UC-32 | Done / bỏ done | ✅ | `tasks.ts:toggleDone` | Done kéo theo sub-task; bỏ done trả về đúng list cũ nhờ `doneFrom` |
| UC-33 | Xoá & thùng rác 30 ngày | ✅ | `deleteTask`/`restoreTask`/`purgeExpired` + màn Trash (drawer) | Xoá mềm + undo 6s + tự dọn >30 ngày. Màn Trash có Restore; checkbox ở đó là dấu tĩnh (bấm một ô tick mà không xảy ra gì là nói dối) và thanh nhập tự ẩn — không cho thêm việc vào thùng rác |
| UC-34 | Đặt/sửa deadline & reminder tay | ✅ | `setDue` / `setReminder` + `parseDateTime` | Ô nhập ngôn ngữ tự nhiên trong Task Detail, cùng khuôn cho cả hai. Xoá được (AC-34.2). `allDay` lấy từ parser nên nói "thứ sáu" **không** bịa ra 9:00 |
| UC-35 | Priority tay | ✅ | `priority.ts` + `TaskRow.urgent` | Đặt trong Task Detail (Urgent/Normal/Low); hàng hiện dấu `!` amber cho mức cao. Hình thức chốt sau khi đối chiếu Apple Reminders (`!`/`!!`/`!!!`) và Todoist (cờ 3 màu — bỏ vì phá luật một-accent) |
| UC-36 | Sub-task thủ công | ✅ | `subtasks.ts` + `SubRow` + `DragList` | CRUD đủ không cần AI (AC-36.2), tiến độ `k/n` trên hàng cha (AC-36.1), và **kéo-thả thứ tự** (AC-36.3) ở cả hai app — không cần reducer mới, `moveTask` vốn đã tổng quát trên "một danh sách đã sắp". Làm việc này lộ ra `childrenOf` — hàm **cả hai app dùng để vẽ** — không sắp theo `sortOrder`, trong khi `subtasksOf` (viết đúng cho UC-36, không app nào gọi) thì có: hai hàm cho một câu hỏi, trả lời khác nhau, và không ai thấy vì chưa có gì sắp lại được bước. Nay một implementation |
| UC-37 | Tìm kiếm | ✅ **xong (2026-08-11)** | `tasks.ts:searchTasks` | Tìm local, bỏ dấu tiếng Việt, quét cả nhãn và note. UI là **lớp phủ** ở cả hai app (web thêm phím tắt `/`); kết quả chỉ-đọc, chạm mở đúng Task Detail. Chạy thử với mạng ngắt |
| UC-38 | Lọc & sắp xếp | ⛔ **Đã gỡ (2026-08-15)** | — | Tính năng bị BỎ, không phải chưa làm. Bảng VIEW cao 572px với 38 nhãn để phục vụ một việc mà không app todo nào bắt người dùng làm. Sắp xếp nay chỉ còn **một** thứ tự — thứ tự người dùng tự kéo (UC-43) — nên không còn chế độ nào để nhớ. `filter.ts`, `SortMode`, `SortKey`, `sortByPriority`, `filterByPriority`, `allTags` đều đã xoá cùng test. Dòng này từng ghi ✅ kèm đúng tên ba tệp không còn tồn tại: một bảng kiểm kê nói sai về chính kho của mình thì tệ hơn là không có bảng nào |
| UC-39 | Recurring | ✅ | `recurrence.ts` + `setRecurrence`/`deleteSeries` + cột `series_id` (migration 0010) | Trước đó `recurrence` là cột, type, CHECK constraint, trường sync **và không đường nào trong sản phẩm đặt được nó** — bản write-only lớn nhất từ trước tới nay. Nay gõ bằng lời ("mỗi 3 ngày", "hàng tuần", "every 2 weeks"), đọc không ra thì **từ chối chứ không đoán**, và app nói lại điều nó hiểu. `series_id` là thứ làm AC-39.1 vế "xoá cả chuỗi" nói được thành lời: mỗi occurrence là một hàng riêng nên trước đó chúng không có gì chung để gọi tên. Ba lỗi im lặng đã sửa cùng lúc: lần kế tiếp **mất list / mất nhắc / mất sub-task**, và luôn nhảy về Inbox vì đọc `status` của bản đã xong. Cộng thêm `shiftByRecurrence` kẹp cuối tháng — `setMonth` tràn 31/01 + 1 tháng thành 03/03. Driven 15/15 web + kiểm tay trên simulator |
| UC-40 | Bulk action | ⛔ **Đã gỡ (2026-08-15)** | — | Tính năng bị BỎ. Chọn-nhiều tồn tại để làm xong nhiều việc một lúc, nhưng tick một ô đã là một chạm — chế độ chọn biến N chạm thành N+2. `bulkApply`, `pruneSelection` và chế độ chọn ở cả hai app đã xoá. Xem callout thay cho khung 09/10 trong `docs/mockups/v4.html` |
| — | Hoãn (snooze/defer) | ✅ | `snoozeTask` + đích Snoozed trong drawer | Ẩn khỏi Inbox/Today tới giờ hẹn mà **không đụng vào due**; Snoozed là đích riêng trong drawer (bỏ section lồng trong Inbox — cùng dữ liệu không hiện hai chỗ), có nút đánh thức |
| — | Nhãn (tags) | ✅ | `extractTags`/`tasksByTag` + `dest.kind: "tag"` | Gõ `#nhà mua sữa` tách nhãn ngay không cần AI; hiển thị dưới hàng và dưới tiêu đề màn chi tiết. Chạm vào nhãn **mở màn của nhãn đó**, và việc tạo trong màn ấy tự mang nhãn — đó là lý do nó là một *đích* chứ không phải một bộ lọc. Dòng này từng dẫn `allTags` (đã xoá cùng bảng VIEW) và mô tả lối vào là "lọc theo nhãn trong bảng VIEW" — bảng đó không còn |

*Mẫu hình còn lại: phần lớn UC 🟡 đã xong logic + test ở core, chỉ còn thiếu chỗ bấm trên màn hình.*

## Nhóm A — Capture (tầng enhance)

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-01 | Tạo task từ câu nói/gõ | 🟡 | `useTasks.capture` + `applyRefinement` | **Gõ và nói nay đi chung một lối:** câu chữ thành task local ngay, AI đọc lại rồi sửa chính task đó. AI hỏng thì task vẫn còn (đã kiểm chứng qua HTTP thật: 502 → task vẫn tạo). Ghi `captures` trước khi gọi model (AC-01.3) đã có ở handler. Voice mobile **đã nối** — xem dòng dưới |
| UC-01 | Voice input mobile | ✅ | `apps/mobile/src/Composer.tsx` + `expo-speech-recognition` 2.1.5 | Orb đổi vai mic/send/recording như web; transcript đổ dần vào ô. **Đã chạy thật trên iOS + Android dev build** (recognizer pipeline kiểm chứng qua logcat; transcript giọng thật cần máy thật — simulator không có nguồn âm) |
| UC-02 | Bóc tách datetime tiếng Việt | 🟡 | `packages/ai/src/prompts.ts`, eval `single-datetime-vi` | Prompt + eval có; **pass rate thật chưa đo** (cần chạy eval với API key) |
| UC-03 | Tách bulk input | 🟡 | eval `bulk-split` | Như trên |
| UC-04 | Phân rã sub-task | 🟡 | schemas + prompt ("only for genuinely complex") | Chưa có eval case riêng cho "không phân rã task đơn giản" (AC-04.1) |

## Nhóm B — Hội thoại chỉnh sửa

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-05 | Thêm chi tiết bằng tham chiếu | 🟡 | `conversation.ts` (cầu nối 2 chiều) + eval `conv-add-subtask` | Hội thoại nay chạy trên **task đã lưu**: dịch task → ref d1/d2 cho agent rồi dịch ngược. Edge Function không phải sửa gì. Chất lượng resolve vẫn phụ thuộc model — đo bằng eval |
| UC-06 | Sửa task bằng lời | ✅ | `mergeDraftBack` + `diffTasks` + phiên trong `useTasks` | Sửa đúng task cũ (giữ id, hàng không nhảy); **chỉ hàng thật sự đổi mới nháy** `EDITED`. AC-06.2 nay có thật: mỗi trường đã đổi là một dòng "cũ → mới" ngay dưới câu của AI, cạnh Undo. AC cũ được **viết lại thành nhu cầu** (xem UC-06) vì bản cũ chốt sẵn layout và một màn hình không còn tồn tại |
| UC-07 | Huỷ task bằng lời | ✅ | ref biến mất khỏi draft → xoá mềm | Undo theo lượt có sẵn ngay trên dòng AI (AC-07.2) |
| UC-08 | Hỏi lại khi mơ hồ | ✅ | `askClarificationSchema.options` + `usableOptions` + pill ở **cả hai** app | Model nêu luôn các câu trả lời, bằng chính chữ của người dùng, và app vẽ mỗi lựa chọn một nút. Pill "Có/Không" dựng cứng trước đây là **câu trả lời sai cho mọi câu hỏi mà tool này tồn tại vì nó** — "cái nào, gọi anh Nam hay gọi chị Lan?" không trả lời được bằng "Có" — còn mobile thì không có nút nào. Không nêu lựa chọn thì **không vẽ nút**, chứ không đoán. Nút gửi đúng chữ trên nút nên gõ tay cũng chạy y hệt (AC-08.3), không có giao thức ngầm nào phải giữ đồng bộ. **AC-08.2 nay là bảo đảm của code**: lượt nào có hỏi thì mọi thay đổi của lượt đó bị bỏ — prompt "đừng đoán" chỉ là một lời nhờ. Driven 10/10 web + kiểm tay trên simulator |
| UC-09 | Sửa nhanh ngay tại danh sách | ✅ | `TaskRow.onRename` (web) + `Row` (mobile) + `updateTask` | **Giữ lâu** trên tiêu đề biến nó thành ô nhập ngay tại hàng, không rời danh sách. Nháy đúp đã thử và **không chạy được**: cú nháy thứ nhất kích hoạt "mở" nên màn chi tiết đã nằm trên trước khi cú thứ hai tới; chữa bằng cách cho nháy đơn chờ là bắt cử chỉ chính chậm lại vì một lối tắt. Rỗng thì giữ tên cũ, Esc trả nguyên trạng, bấm ra ngoài thì **giữ** chữ đã gõ (vứt đi vì trỏ chuột đi chỗ khác là mất việc của người ta), không đổi gì thì không ghi. Tắt trong Thùng rác và trong chế độ chọn. AC-09.1 cũ nói "trên card" — card là Live Preview, màn đã bỏ — nên **đã viết lại thành nhu cầu**: sửa phải nhanh hơn nói lại. AC-09.2 đúng sẵn và **đã kiểm bằng cách đọc draft mà agent thật sự nhận**. Driven 11/11 web + kiểm tay trên simulator |

## Nhóm C — Lifecycle phiên

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-10 | Commit phiên → tasks | ✅ **đóng bằng cách sửa UC** | — | Luồng chính không còn bước commit nào: task có ngay khi nhập (ADR-7), các lượt sau sửa trực tiếp. Đẩy lên server đã có từ UC-17. Không còn gì để "commit" — UC này mô tả một kiến trúc đã bị thay |
| UC-11 | Hội thoại tự đóng khi bỏ quên | ✅ | timer trong `useTasks` (cả 2 app) | UC **viết lại**: bản cũ là "idle 2' → auto-commit + 'Đã lưu N việc'", mà kiến trúc đã bỏ khái niệm draft nên **không có bước commit nào để tự chạy** — AC-11.1 cũ nay đúng một cách rỗng. Nhu cầu còn sống là AC-11.2, chỉ nói về thứ khác: cái tự đổi sau lưng không phải "lưu" mà là **hội thoại đóng lại**. Trước đây nó biến mất im lặng và người dùng phát hiện bằng việc câu tiếp theo tạo việc mới thay vì sửa. Nay có một dòng nói ra. Tự bấm Done thì **không** báo — đóng là điều vừa yêu cầu. CountdownBar trong thiết kế cũ vẫn không làm, và đã ghi rõ vì sao. Driven 9/9 với đồng hồ điều khiển được |
| UC-12 | Hard limit 30 turns | ✅ | `chat-intent` trả `409 session_too_long` + `noteFailure` ở cả hai app | Phiên client tự hết sau 3 phút im lặng nên hiếm khi chạm mốc 30. Client **có** xử lý riêng: 409 nói ra "conversation got long, so it was closed", và **không** bị đếm vào chuỗi hỏng của AC-25.2 — đó là handler đang trả lời, không phải pipeline gãy |
| UC-13 | Khôi phục crash / offline queue | ✅ | `outbox.ts` + `createOutboxStorage` + drain ở cả hai app | **AC-13.2 xong**: lượt AI hỏng vì mạng nằm hàng đợi trên đĩa, sống qua reload/đóng app, tự gửi lại khi có mạng (web `online`, mobile `AppState active`), và số câu đang chờ hiện trên màn hình. Idempotent theo `taskId` nên retry không đẻ task trùng (AC-25.3). **AC-13.1 cũng xong**: hội thoại đang mở sống qua việc đóng app — mở lại thì câu tiếp theo vẫn **sửa đúng những việc đó** chứ không tạo việc mới. AC cũ nói "bản nháp không mất"; kiến trúc đã bỏ khái niệm nháp nên thứ mất được khi đóng app không phải dữ liệu mà là **ngữ cảnh hội thoại** — AC đã viết lại thành nhu cầu. Phiên quá 3 phút hoặc trỏ vào task đã xoá thì **không** khôi phục và bị xoá khỏi đĩa: một thanh nhập ghi "nói tiếp để sửa" trỏ vào việc của sáng qua còn tệ hơn bắt đầu sạch. Đăng xuất xoá luôn — nó chứa đúng câu người dùng đã nói (UC-28) |
| — | Sliding window 10 turns | ✅ | `chat-intent` | Summary turns cũ bằng code: chưa làm (tầng 2 mới cắt, chưa tóm tắt) |
| — | Retention transcript 90 ngày | ✅ | migration `0009` + `purge_expired_transcripts()` + pg_cron | `captures` (câu nói **thô**) nay có `expires_at`; job chạy 03:00 hằng ngày và **đã quan sát được một lần cron tự bắn** trên DB thật — capture hết hạn biến mất, capture còn hạn ở lại, `messages` của phiên quá hạn về `[]`. Trước đây khối pg_cron bị comment nên chưa từng chạy |

## Nhóm D — Quản lý task

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-14 | Inbox | ✅ | `TaskListView`/`TaskListScreen` | Hàng phẳng + quick-add + chuyển sang Today; sub-task không lộ ra list chính |
| UC-15 | Today Focus | ✅ | `todayTasks` + thanh tiến độ | Gồm việc due đến hết hôm nay (kể cả quá hạn); tiến độ chỉ tính việc **vốn thuộc Today** |
| UC-16 | Done/xoá + soft delete | ✅ | `toggleDone`/`deleteTask` + undo | Mục DONE riêng dưới list; xoá có thanh Undo 6 giây |
| UC-17 | Sync đa thiết bị | ✅ | `packages/sync` (27 test) + migration 0006/0007 | Chạy thật hai chiều: đẩy qua `sync_push_*` (server ép LWW, báo theo **từng dòng**), kéo theo con trỏ `server_updated_at`, Realtime đã bật cho `tasks`/`lists`. Đo được: `pnpm sync:latency` → median ~118 ms (AC-17.1 ≤ 3 s, localhost). Bản ghi bị từ chối vì id thuộc tài khoản khác được **cấp id mới** rồi đẩy lại (`remapRejected`) |
| UC-18 | Incremental update task đã lưu | ✅ | `send(text, defaults, taskId)` | Ô "Ask AI to change this…" trong Task Detail. Không thêm trường nào trên giao thức — task thật thành `d1`, `mergeDraftBack` sửa tại chỗ theo id, nên "không nhân bản" đúng **do cấu tạo**. `existingTaskContext` (giàn giáo không ai dùng từ commit đầu) đã bỏ |
| UC-19 | Widget màn hình chính | ⬜ | — | Không có widget target nào trong `apps/mobile/plugins/` (chỉ có fmt fix + share target) và `app.json` không khai báo extension. Giai đoạn 2 |
| UC-20 | Đọc lại bằng giọng nói (TTS) | ⬜ | — | Không có `expo-speech`, không có `speechSynthesis` ở đâu trong hai app. Giai đoạn 2 |
| UC-21 | Đổi model & đo chất lượng | 🟡 | `getModel` + `ai_config` + `pnpm eval` | AC-21.2 đạt: `ai_requests` ghi `model_spec`/token/latency/`error` ở **cả** nhánh thành công lẫn thất bại. AC-21.1 **chưa kiểm được** — `pnpm eval` gọi model thật nên cần API key; và nó in N khối báo cáo liên tiếp chứ chưa phải một bảng so sánh. Hai cột `estimated_cost_usd` và `validation_failed` chưa shell nào ghi |

## Nhóm F — Tài khoản, quyền & đường thất bại

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-22 | Auth + first-run | 🟡 | `useAuth` + `AuthView`/`AuthSheet` (cả 2 app) | **Bắt buộc tài khoản (ADR-10)**: chưa có phiên thì không render gì. Email/mật khẩu chạy thật; phiên lưu lại nên mở offline vẫn vào được. Đăng xuất **xoá dữ liệu của tài khoản khỏi máy** sau khi cảnh báo phần chưa sync. **Còn thiếu: Apple/Google sign-in** (AC-22.1 chỉ ràng buộc khi đã có social login khác) |
| UC-23 | Quyền mic bị từ chối | ✅ | web `Composer` + mobile `Composer` (cùng `MicState`) | Cả hai nền dùng chung ba trạng thái nên không lệch nhau về nghĩa của "không có mic". `unavailable` → orb thành nút gửi, không báo lỗi (AC-23.3). `denied` → orb **mờ mà vẫn còn**, chạm vào thì mobile mở thẳng Settings, web nói ra chỗ mở khoá (trình duyệt không có đường dẫn tới bảng quyền của chính nó — AC-23.2 đã được viết lại thành nhu cầu). Web trước đây `onerror` chỉ tắt recording và **không nói gì**: đường thất bại phổ biến nhất của app voice-first là đường im lặng nhất. Driven 15/15 |
| UC-24 | Input không phải task | ✅ | `turnRejectedTask` + hai nhánh của `send` | Model bảo không phải task thì thu hồi task vừa tạo (vào Trash, có Undo). **Giữa phiên thì không đụng gì** — trước đây draft rỗng bị cầu draft-ref hiểu là "xoá hết task trong ngữ cảnh", nên một câu cảm ơn xoá mất việc vừa nói |
| UC-25 | Lỗi AI / retry | ✅ | `ai_requests.error` + `outbox.ts` + `noteFailure` | AC-25.1 (ghi transcript trước khi gọi model) đã có ở handler từ trước. AC-25.2: **ba lượt hỏng liên tiếp** thì đổi hẳn câu báo — hai lần im lặng rồi lần thứ ba trông y hệt một app đang chạy tốt mà không có gì để nói. Quota và 409 **không tính** là hỏng: bảo người hết quota "lưu nháp xử lý sau" thì lát nữa chính là lúc nó không chạy. AC-25.3 đúng *by construction* — câu trả lời áp vào một task id đã tồn tại |

## Nhóm G — Nhắc nhở & dữ liệu cá nhân

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-26 | Nhắc nhở | 🟡 | `reminders.ts` + `useReminders` (cả 2 app) | Thông báo **cục bộ** chạy thật: mobile qua `expo-notifications`, web qua Notification API. Đặt giờ bằng tay qua `parseDateTime`. Đo được: `pnpm reminder:latency` → **-488 ms** (AC-26.1 ±60 s). **Còn thiếu: push chéo thiết bị**, và web chỉ chạy khi tab đang mở |
| UC-27 | Sửa task đã lưu bằng tay | ✅ | `store.edit` / `setDue` / `setReminder` / `setPriority` | Đủ cả năm trường UC-27 nêu. Tiêu đề rỗng bị chặn ở `updateTask` — giữ tên cũ thay vì tạo task vô danh |
| UC-28 | Quyền riêng tư & xoá dữ liệu | ✅ | migration 0009 + Edge Function `delete-account` + `AuthView` | Ba thứ đều thiếu và đều nghiêm trọng hơn "chưa có UI": (1) mọi FK tới `auth.users` là NO ACTION nên **xoá tài khoản có dữ liệu là bất khả thi** — đã dựng lại lỗi trên DB thật; (2) `captures` (transcript **thô**) không có `expires_at` nên không hạn lưu trữ nào; (3) job dọn bị comment, `expires_at` được ghi mỗi phiên và không ai đọc. Nay: cascade cho tasks/lists/captures/sessions, `set null` cho `ai_requests` (giữ số liệu chất lượng, bỏ danh tính), `purge_expired_transcripts()` gọi tay xoá đúng (2 captures → 1) và đã lên lịch 03:00 — *chưa thấy cron tự fire, xem V-1*; `delete_my_history()` xoá theo yêu cầu; Edge Function xoá tài khoản **xoá blob trước** rồi mới xoá user — chạy end-to-end trên simulator (user biến mất khỏi `auth.users`, app về Sign in) nhưng tài khoản test không có ảnh nên *nhánh xoá blob chưa chạy, xem V-2*. Chính sách nêu trong app (AC-28.1), có ở **cả** web và mobile |

## Nhóm H — Tích hợp Giai đoạn 3

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-29 | Jira/GitHub issue | ⬜ | kiến trúc tool mở sẵn (docs 6.4) | Cần bảng `integrations` + OAuth + tool mới |
| UC-30 | Calendar | ⬜ | — | Như trên |

## Nhóm E — Nền tảng & vận hành

| Hạng mục | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|
| Monorepo pnpm + turbo | ✅ | root | `pnpm test` **31+12 = 43/43**, typecheck sạch cả 6 package (core/ai/api/ui-tokens/web/mobile) |
| Design system **v3** trong app web thật | ✅ | `packages/ui-tokens`, `apps/web` | Rows thay card, ink orb, nút mực, diff-as-flash, serif moment, dark mode đảo orb/nút; tokens một nguồn (inject CSS vars); đã chạy + screenshot xác nhận. `?demo=1` xem UI không cần backend |
| Design system **v3** trong app mobile | 🟡 | `apps/mobile/` (App + màn list + Drawer + Composer) | Inbox/Today/Snoozed/Trash + quick-add + voice hai chiều vào, safe-area đúng chuẩn. **Đã chạy thật trên iOS simulator + Android emulator** (dev build, thao tác kiểm chứng bằng screenshot). **Thiếu:** gesture/Reanimated (MO-3..16), TTS |
| Draft reducer thuần | ✅ | `packages/core/src/draft.ts` (8 tests) | Ref không tái sử dụng; lỗi có gợi ý cho AI |
| **Tầng CORE thuần (ADR-7)** | ✅ | `packages/core/src/tasks.ts` (23 tests) | Hàm thuần, `now`/`newId` tiêm vào nên test xác định; `doneFrom` giữ đúng list cũ khi bỏ done |
| **Lưu local-first** | ✅ | `packages/core/src/storage.ts` | Một API cho localStorage lẫn AsyncStorage; JSON hỏng/bản ghi lỗi bị bỏ từng cái, không mất cả list |
| Điều hướng drawer + màn list | ✅ | web `Drawer`/`TaskListView`, mobile `Drawer`/`TaskListScreen` | Drawer là mặt điều hướng duy nhất (Inbox · Today · Snoozed · Trash, badge đếm từ cùng selector màn hình dùng); đáy màn trả trọn cho thanh nhập + orb. Đã thay hai kiến trúc trước đó (tab tiêu đề, capsule nổi) |
| **Design system đóng gói** | ✅ | `packages/ui` (component + ds.css) | Web đã chuyển sang dùng; token là nguồn duy nhất, không còn CSS trùng lặp giữa app và hệ |
| **Storybook** | ✅ | `pnpm storybook` · 6 trang story | Foundations (màu/chữ/motion) · Primitives · Patterns · Animations (mục lục có nút phát lại) · Gamification; toggle light/dark ngay trên toolbar |
| **Gamification** | 🟡 | `computeStreak` (core, 5 tests) + `Streak`/`XpBar`/`LevelUp`/`Confetti`/`DayComplete` | Streak + "All clear." đã gắn vào màn Today thật. **Chưa gắn:** XP/level (chưa có luật tính điểm), và mobile chưa có phần này |
| Zod tool schemas | ✅ | `packages/ai/src/schemas.ts` (6 tests) | ISO datetime bắt buộc offset |
| Prompt cache-friendly | ✅ | `prompts.ts` + test phần tĩnh byte-identical | |
| Provider registry 3 hãng | ✅ | `provider.ts` | Giá trong `PRICE_TABLE` cập nhật tay |
| Agent loop | ✅ | `agent.ts` + `packages/server` (11 test) | Chạy thật trong vitest với model kịch bản: tool call áp lên draft, ask_clarification, sửa draft có sẵn |
| Eval harness 7 kịch bản | 🟡 | `packages/ai/eval/` (scorer có test) | Cần mở rộng lên ~50 câu + 20 kịch bản như lộ trình; chưa có LLM-judge |
| **Handler không phụ thuộc host** | ✅ | `packages/server` (11 test) | Luật một lượt (30 lượt, sliding window, capture, telemetry, CORS) nằm ở handler dùng chung |
| Route chạy local | ✅ | `apps/web/app/api/chat-intent` | Thử model thật chỉ cần một API key, không cần Supabase. **Đã kiểm chứng qua curl + trình duyệt** (502 khi thiếu key, preflight 204) |
| Edge Function (vỏ Supabase) | 🟡 | `chat-intent/index.ts` — còn 96 dòng | Chỉ còn auth + Postgres. **Vẫn chưa deploy lần nào**; nghi ngờ lớn nhất là bundler có gom được `packages/*` nằm ngoài thư mục function không |
| DB schema + RLS | ✅ | `migrations/0001_init.sql` | Audit RLS: mọi bảng user-scoped; `ai_config` read-only |
| Model là config + A/B | 🟡 | `ai_config` bảng | Đọc config có; **chưa có override theo user/phiên** |
| Telemetry `ai_requests` | 🟡 | function ghi mỗi turn | `estimated_cost_usd` chưa được ghi từ function |
| Auth user thật | 📐 | function verify JWT sẵn | Apps đang dùng anon key làm token dev — phải nối Supabase Auth |
| CI (test + typecheck) | ⬜ | — | Nên thêm GitHub Actions trước khi nhận PR |


## Nhóm I — Gap phát hiện khi đối chiếu app cùng loại (audit 2026-08)

> So `packages/core` với Things 3, Todoist, TickTick, Apple Reminders. Chi tiết AC ở [02-use-cases.md](02-use-cases.md) nhóm I.

### I.1 — Trường đã có trong data model, chưa có UI nào chạm tới

Đây **không phải tính năng mới** mà là tính năng làm dở: dữ liệu đã chảy qua nhưng người dùng không thấy.

| UC | Tính năng | Trạng thái | Đã có sẵn gì | Còn thiếu |
|---|---|---|---|---|
| UC-44 | Ghi chú cho task | ✅ **xong (2026-08-10)** | `LocalTask.note` + AI đã điền được | — Đã có màn chi tiết ở cả hai app; `normalizeNote` ở core biến chuỗi trắng thành `null`; hàng list chỉ hiện tiêu đề, không dấu hiệu gì (AC-44.2 đã sửa lại sau khi tra app khác) |
| UC-43 | Sắp xếp tay (kéo thả) | ✅ **xong (2026-08-11)** | `LocalTask.sortOrder` | — `packages/core/src/ordering.ts`: chèn trung điểm (một lần kéo = một bản ghi), đánh số lại ở load-path. Web dùng HTML5 DnD, mobile dùng `PanResponder` + tay nắm |
| UC-45 | Logbook (lịch sử đã xong) | ✅ **xong (2026-08-11)** | `doneFrom` sẵn để bỏ done | — `"archived"` đã bỏ khỏi union phía client, `parseTask` map dữ liệu cũ về `done`; `groupLogbook` nhóm theo `completedAt`, phân trang 40 việc |
| UC-47 | Capture từ share sheet | ✅ **xong (2026-08-11)** | `captures.source` đã có giá trị `'share'` (migration 0001) | Android: `ShareActivity` ghi spool vào `filesDir`. iOS: Share Extension target sinh thẳng vào `.pbxproj` (`plugins/shareExtensionIos.js`), ghi vào App Group. Một đường drain chung ở load-path. Đã chạy thử trên cả hai nền |
| UC-26 | Nhắc nhở | 🟡 | `reminders.ts` (17 test) | Có scheduler và UI đặt giờ. Luật: xong/xoá thì huỷ (AC-26.2), quá hạn **không** lên lịch lại, đang hoãn thì im. Công tắc toàn cục + xoá giờ cho từng task (AC-26.3) |

### I.2 — Tính năng phổ biến của thể loại, docs chưa nhắc

| UC | Tính năng | Vì sao cần | Chi phí |
|---|---|---|---|
| UC-41 | **Lists / Projects** — ✅ **xong (2026-08-11)** | App todo nào cũng có; drawer hiện không có gì để chứa ngoài smart list | `packages/core/src/lists.ts` (24 test) · migration `0004_lists.sql` · `list?: string` theo **tên** ở schema AI, khớp tên → id ở client |
| UC-42 | Upcoming (7 ngày tới) — ✅ **xong (2026-08-10)** | Today trả lời "hôm nay", không trả lời "tuần này thế nào" | `groupUpcoming` ở core (15 test); không thêm trường nào, đúng AC-42.3 |
| UC-46 | **Hiểu ngày giờ trong quick-add, không cần AI** — ✅ **xong (2026-08-10)** | ~~Lỗ hổng ADR-7~~ **đã vá**: `parseDateTime` chạy trong `useTasks.send` trước khi có mạng, nên tắt Wi-Fi vẫn đặt được hạn. Đã chạy thử offline: "mua sữa mai 5h" → 2026-08-11T17:00+07:00 | Corpus 54 ca ở `packages/core/test/datetime.test.ts` |
| UC-48 | Xuất / nhập dữ liệu — ✅ **xong (2026-08-11)** | Local-first mà chưa bật sync thì mất máy là mất sạch | `packages/core/src/transfer.ts` (16 test); UI ở chân drawer cả hai nền. Mobile dùng `expo-sharing` để xuất, `expo-document-picker` để nhập |
| UC-49 | Ngày bắt đầu tách khỏi hạn chót | `snoozedUntil` đang gánh nhầm vai: hoãn là *ẩn đi*, ngày bắt đầu là *kế hoạch* | Trung bình — cân nhắc kỹ, thêm khái niệm người dùng phải học |
| UC-51 | **Đính kèm ảnh** | Ảnh là thứ giọng nói không nói được; AI đọc ảnh để làm giàu task | Trung bình–cao — Supabase Storage, hàng đợi sync riêng cho binary, dọn blob khi xoá task |
| UC-50 | Chia sẻ / cộng tác | Giai đoạn 3 | Rất cao — quyền, xung đột, realtime; chỉ tính sau UC-17 |

### I.3 — Thứ tự đề xuất & độ sẵn sàng (cập nhật sau vòng viết edge case, 2026-08)

Mọi UC dưới đây đã có đủ ba phần (luồng chính · bảng edge case · quyết định đã chốt) trong
[02-use-cases.md](02-use-cases.md) — bảng edge case dùng thẳng làm test plan. Thiết kế xuyên UC
(điều hướng có tham số, API parser ngày, màn chi tiết, phân tuyến test) ở
[09-design-nhom-I.md](09-design-nhom-I.md).

| Đợt | UC | Sẵn sàng | Ghi chú |
|---|---|---|---|
| 1 | **UC-46** parse ngày không AI | ✅ **đã xong** | Corpus 54 ca (AC-46.5 đòi ≥40). Đã nối vào `useTasks.send`, chạy thử với mạng ngắt |
| 1 | **UC-44** note · **UC-42** Upcoming | ✅ **đã xong** | Không thêm trường dữ liệu nào. Màn chi tiết là lớp phủ theo state, không thêm thư viện điều hướng |
| 2 | **UC-45** Logbook | ✅ **đã xong** | DB constraint giữ nguyên, không cần migration |
| 2 | **UC-43** kéo thả | ✅ **đã xong** | Không cần migration. Hai dòng edge case chưa gắn được: xem ghi chú dưới |
| 3 | **UC-41** Lists | ✅ **đã xong** | Chạy thử trên cả web lẫn iOS |
| 3 | **UC-47** share sheet | ✅ **đã xong** | Cả Android lẫn iOS |
| 3 | **UC-48** xuất/nhập | ✅ **đã xong** | Cả web lẫn mobile |

**Edge Function — sửa ngày 2026-08-11.** Lần đầu chạy Supabase thật đã lộ ra rằng function **chưa bao giờ boot
được**, và bên dưới nó là ba lỗi nữa, mỗi cái đều vô hình vì lý do riêng:

| Lỗi | Vì sao không ai thấy |
|---|---|
| Deno không phân giải được đuôi `.js` của repo → `BOOT_ERROR` 503 | Toàn bộ phát triển đi qua route dev Next.js |
| `ai_requests.prompt_version` NOT NULL nhưng store không ghi | Insert hỏng bị `.catch(() => undefined)` nuốt. Ở **nhánh thành công** thì lỗi rơi vào catch và biến một lượt chạy đúng thành **502** — chưa ai gặp vì function chưa boot |
| `tool_call_count` là `NOT NULL DEFAULT 0`, store ghi `?? null` — **null tường minh vô hiệu hoá default** | Cùng lý do; `supabase-js` **trả** lỗi chứ không **ném**, nên store bỏ qua |
| `prompt_version` mỗi shell tự bịa (`"1"`, `"dev"`) thay vì dùng `INTENT_PROMPT_VERSION` | Cột vẫn có dữ liệu, chỉ là vô nghĩa — UC-21.2 không đối chiếu được |

Cách sửa: `pnpm build:edge` (esbuild gộp workspace package, npm dep để ngoài), `config.toml` trỏ `entrypoint`
vào bundle, deploy bằng `pnpm deploy:edge`. Store giờ **ném** lỗi insert và in ra log function.

Đã chạy thật: boot ✓, anon key → 401 ✓, JWT thật đi hết đường tới model ✓, `captures` ghi **trước** khi gọi
model (AC-01.3) ✓, `ai_requests` ghi được kèm `prompt_version: "intent.v1"` ✓. Chỉ dừng ở chỗ thiếu
`ANTHROPIC_API_KEY` — đúng như mong đợi.

**UC-17 (đồng bộ) — làm ngày 2026-08-11, rà và sửa lại ngày 2026-08-12.**

Bản đầu đi qua `upsert` trực tiếp. Một lượt rà đối kháng tìm ra 12 lỗi, trong đó **4 cái tự tay bản sửa
LWW tạo ra**. Đã dựng lại từng cái trên Supabase thật trước khi sửa:

| Lỗi | Người dùng thấy gì | Vì sao không ai thấy |
|---|---|---|
| `markSynced` bị chính bước gộp ngược vứt đi | Không gì cả — mọi bản ghi `pendingSync` vĩnh viễn | `mergeRemote` cho bên chưa đẩy thắng khi hoà, nên gộp outcome trả cờ cũ về. Test tôi viết che đúng ca này |
| Trigger `sync_stamps` dập lại `updated_at` khi đẩy lại y nguyên | Đổi tên task xong **tên cũ tự quay lại** | Đường retry và echo Realtime của chính máy đó đều đẩy y nguyên |
| Con trỏ bị xoá mỗi lần mở app | Kéo cả bảng mãi mãi; **thùng rác quá 30 ngày sống lại** sau mỗi lần mở | `ready=false` ở render đầu nên effect "đăng xuất thì xoá" chạy lúc mount |
| Đăng xuất không xoá dữ liệu local | Task của A hiện ra với B, **và bị đẩy lên tài khoản B** | Một khoá lưu trữ dùng chung |
| Một dòng hỏng làm chết cả lô đẩy, mãi mãi, im lặng | Máy ngừng đồng bộ nhưng trông vẫn bình thường | `upsert` là all-or-nothing |
| `updated_at: "infinity"` | Task **không thiết bị nào sửa được nữa, vĩnh viễn** | Postgres nhận `infinity`/`yesterday`/`now` là timestamp hợp lệ; `parseTask` chỉ kiểm tra `typeof === "string"` |
| So sánh timestamp bằng **chuỗi** | Bản từ server luôn thua bản local cùng giây | Postgres trả `+00:00`, client ghi `Z`; `'+'` < `'.'` |
| Trigger 0002 đóng dấu `completed_at = now()` khi INSERT | Việc xong năm ngoái thành **"xong hôm nay"**, bịa ra streak | Chỉ lộ khi lần đầu có sync |
| Retry và debounce dùng chung một timer | Offline → thêm việc → Undo → **ngừng đồng bộ hẳn** | Cleanup của debounce huỷ luôn retry |
| Không có gì đồng bộ lại khi quay lại tiền cảnh / có mạng | Dữ liệu cũ hàng giờ, không báo gì | Realtime không gửi lại cái đã bỏ lỡ |

Cách sửa, theo gốc chứ không theo từng triệu chứng:

- **Server ép LWW** ([0007](../supabase/migrations/0007_sync_push.sql)): đẩy qua `sync_push_tasks/lists`,
  `on conflict do update ... where excluded.updated_at > tasks.updated_at`, báo cáo **từng dòng**. Một quy tắc
  mà chỉ người gọi tự giữ thì không phải quy tắc. Điều kiện này cũng làm lỗ trigger thành không với tới được:
  đẩy lại y nguyên giờ khớp 0 dòng.
- **So sánh theo giá trị**, không theo chuỗi (`timeValue`), và `parseTask` chặn timestamp không phải khoảnh khắc.
- **Lưu trữ theo tài khoản** (`todo-ai:tasks:v1:<userId>`). Xoá sạch khi đăng xuất sẽ hết rò rỉ nhưng phá ADR-7 —
  người dùng cả tháng chưa đăng nhập không được mất dữ liệu vì đăng xuất. Khoá riêng cho cả hai. Lần đăng nhập
  đầu **nhận** kho ẩn danh (copy, không phải move).
- Con trỏ đổi khoá theo **tài khoản**, không theo `enabled`; lùi lại `CURSOR_LAG_MS` vì `now()` là giờ **bắt đầu
  giao dịch**, nên một giao dịch commit muộn có thể nằm sau con trỏ và không bao giờ được kéo về.
- `useSync` có **18 test** — trước đó không có cái nào, và 4 trong 12 lỗi nằm đúng phần không test.

Đã chạy thật: `infinity` bị từ chối (23514), bản cũ hơn không ghi đè được, `completed_at` giữ null,
`pnpm sync:latency` → **median 104 ms, worst 120 ms** (AC-17.1 ≤ 3000 ms, nhưng là localhost).

Còn thiếu: chưa chạy trên simulator thật, chưa thử đường offline→online thật.

**Bảo mật — rà ngày 2026-08-11 khi lần đầu chạy Supabase thật:**

| Phát hiện | Trạng thái |
|---|---|
| 🔴 Giới hạn 30 lượt đếm từ `body.messages` — **do client cung cấp**. Gửi `messages: []` là vô hiệu hoá. Test cũ *chứng minh giới hạn chạy* bằng chính đường đó, nên xanh suốt mà lỗ vẫn nguyên | ✅ đếm từ transcript server (`loadTranscript`); client hết gửi transcript |
| 🔴 Không có quota nào theo user — ai đăng ký được là tiêu tiền model của chủ app, vô hạn | ✅ `MAX_TURNS_PER_DAY = 200`, đếm trên `ai_requests` (bảng đã ghi từ migration 0001 mà chưa ai đọc) |
| `ai_config` mở `using (true)` — anon key đọc được model đang dùng | ✅ migration `0005`: bỏ policy. Chỉ service role đọc, mà Edge Function vốn dùng service role |

Ranh giới cần nhớ: Edge Function chặn **trộm key**, không chặn **lạm dụng**. Quota là chốt chi phí, không phải
chốt bảo mật.

## Nhóm J — Voice-first (chốt hướng 15/08/2026, chưa có code)

Cả nhóm là 📐 **Designed**: [ADR-11 và ADR-12](01-architecture.md#8-quyết-định-kiến-trúc-adr-tóm-tắt) đã chốt
hướng, [11-uc-conversation.md](11-uc-conversation.md) đã có AC, **chưa dòng code nào**. Ghi ra đây để không ai
đọc bảng này rồi tưởng mặt hội thoại đã tồn tại.

| UC | Tính năng | Trạng thái | Code | Ghi chú audit |
|---|---|---|---|---|
| UC-52 | Màn hội thoại là mặt chính | 📐 | — | Hôm nay hội thoại là **một dòng nổi** trên danh sách (`TaskListView.tsx`, khối `.convo`): chỉ câu trả lời mới nhất, pill trả lời nhanh, Undo/Done. Không transcript, không cuộn lại, không xem được phiên cũ |
| UC-20 | App đọc câu trả lời thành tiếng | 📐 | — | Vừa chuyển từ Giai đoạn 2 vào MVP. Bản tối giản: đọc được, tắt được, **chưa** ngắt lời giữa câu |
| — | Endpoint đọc lịch sử phiên | 📐 | — | Chỉ có `POST` một lượt. Server đã lưu transcript (`capture_sessions.messages`) nhưng client không có đường lấy về — điều kiện cần của AC-52.2 |
| — | Đóng/mở phiên ghi xuống DB | 📐 | — | `capture_sessions.status` và `closed_reason` có trong schema từ migration `0001` và **chưa từng được ghi**; `endSession` phía client chỉ `setSession(null)`. Điều kiện cần của AC-52.4 |
| — | Mối nối lượt ↔ việc | 📐 | — | `mergeDraftBack` trả `changedIds` cho lượt hiện tại rồi không ai giữ. Điều kiện cần của AC-52.5, và là chi phí lớn nhất của UC-52 |
| — | Câu nói trên **toàn danh sách** ("dời hết Work sang thứ 5") | ⬜ | — | **Không chạy được** với cầu draft-ref hiện tại — agent chỉ thấy `contextIds`, phiên nguội thì draft rỗng. Chính câu demo của bản pitch. Động từ thứ ba "xếp giùm" hiện không có mặt nào phục vụ. **Đã duyệt thành UC-54** (15/08): vòng lặp agent có sẵn, thêm tool đọc `find_tasks` — backend tra bảng `tasks` đã sync (UC-17), client đẩy sync trước mỗi lượt |

**Hai lỗi phải vá trước, đo trong `packages/server/src/intent.ts` ngày 15/08 — cùng loại "write-only" đã gặp ở
UC-39**: một đường dữ liệu tồn tại đủ để nhìn thấy trong schema, nhưng không đường nào trong sản phẩm chạy qua nó.

| Lỗi | Hệ quả | Trạng thái |
|---|---|---|
| `saveCapture` nằm **sau** hai lối thoát 409 và 429 | Lượt bị chặn vì phiên quá dài hoặc hết hạn mức ngày ghi câu của user vào **không chỗ nào** — mâu thuẫn thẳng với AC-12.1 *"không mất draft khi bị chặn"*, và với chính lời hứa của UC-12 | ✅ **Đã vá 15/08.** Lượt bị chặn ghi capture với `session_id` null: giữ chữ mà không mở một cuộc hội thoại sẽ không bao giờ chạy |
| `saveTranscript` chỉ chạy ở nhánh thành công | Lượt model lỗi nằm ở `captures` nhưng không có trong `capture_sessions.messages`. Chọn server làm nguồn sự thật (ADR-12) mà không vá thì lượt lỗi vô hình — đúng thứ AC-52.3 cấm | ✅ **Đã vá 15/08.** Nhánh lỗi ghi câu của user vào transcript, không kèm câu trả lời bịa |

Bốn ca hồi quy đi kèm, **đã kiểm là đỏ trên code cũ** trước khi vá. Đây cũng là lần thứ hai trong tuần một
đường dữ liệu "write-only" lộ ra khi có người đi soi nó vì một lý do khác — lần đầu là `recurrence` ở UC-39.

## Chưa kiểm chứng được — danh sách phải quay lại

Khác hẳn "còn treo": code đã viết, gate đã xanh, nhưng **chưa ai thấy nó chạy trên đường thật**. Cột 🟡 ở bảng
trên nói tính năng thiếu; mục này nói tính năng *có thể* đã đúng mà chưa có bằng chứng. Phân biệt hai loại là
quan trọng, vì đúng loại thứ hai mới là chỗ lỗi nằm im lâu nhất — nó trông như đã xong ở mọi báo cáo.

Mỗi dòng ghi **cần gì để kiểm**, chứ không chỉ ghi "chưa kiểm". Một dòng không nói được cách kiểm thì thực chất
là một câu hỏi chưa ai đặt.

| # | Điều đang tin là đúng | Đã kiểm tới đâu | Cần gì để kiểm nốt |
|---|---|---|---|
| ~~V-1~~ | `purge_expired_transcripts()` tự chạy 03:00 mỗi ngày | ✅ **đã kiểm** — tạm đặt `* * * * *`, cron **tự bắn** lúc 08:53:00 (`cron.job_run_details` = succeeded), capture hết hạn biến mất, capture còn hạn ở lại, `messages` của phiên cũ về `[]` còn phiên mới nguyên vẹn. Đã trả lịch về `0 3 * * *` và xoá dữ liệu test | — |
| ~~V-2~~ | Edge Function `delete-account` xoá blob ảnh **trước** rồi mới xoá user | ✅ **đã kiểm** — đẩy 2 file jpeg thật vào `task-images/<uid>/` qua Storage API (http 200), gọi `delete-account` → `{"deleted":true}`, `auth.users` = 0 hàng và `storage.objects` dưới `<uid>/` = 0 hàng. *Kiểm ở mức hàng trong `storage.objects`; byte trên đĩa đi theo vì đường xoá là Storage API — đúng lý do migration 0008 cấm dùng trigger SQL* | — |
| V-3 | AC-51.2 — đọc chữ trong ảnh | Chưa chạy lần nào | **Chặn**: cần API key có vision. Không phải việc code — và là mục **duy nhất** còn lại trong bảng này |
| ~~V-4~~ | AC-23.2 — web bị từ chối quyền mic thì báo, không im lặng | ✅ **đã làm và đã kiểm** (hoá ra là **thiếu thật**: `rec.onerror = () => setRecording(false)` — từ chối mic thì orb tắt và **không nói gì cả**). Nay web có `MicState` cùng khuôn mobile: orb mờ đi chứ không biến mất, chạm vào thì nói chỗ mở khoá, gõ vẫn chạy đủ. Driven 15/15 qua 5 kịch bản: cho phép / chặn (Permissions API) / chặn (chỉ biết qua `onerror`, tức Firefox-Safari) / không có Web Speech API / gõ tay | — |
| ~~V-5~~ | AC-25.2 — hỏng liên tiếp nhiều lần thì đổi cách báo | ✅ **đã làm và đã kiểm** — `outbox.ts` (`recordFailure`/`shouldOfferRawDraft`), driven trên cả web lẫn simulator: lượt hỏng thứ ba đổi câu báo | — |
| ~~V-6~~ | AC-13.2 — lượt AI hỏng được xếp hàng thử lại | ✅ **đã làm và đã kiểm** — hàng đợi lưu xuống đĩa, sống qua reload/đóng app, tự gửi lại khi có mạng (web: `online`; mobile: `AppState active`) | — |
| ~~V-7~~ | AC-06.2 — nói được cũ→mới khi sửa | ✅ **đã làm và đã kiểm** — `diff.ts` + `describeChange` trong `format.ts` của từng app; driven trên web (13/13) và simulator | — |
| ~~V-8~~ | UC-43 — AI sửa list đúng lúc đang kéo, ở **web** | ✅ **đã kiểm** — dựng được kịch bản: giữ drag mở, **máy khác** đẩy một task mới lên server, chờ nó về qua Realtime *trong lúc vẫn đang kéo*, rồi mới thả. Kết quả: hàng được kéo về đúng chỗ đã thả, task mới còn nguyên, không mất, không nhân đôi, thứ tự sống qua reload. Kết luận đọc-code trước đây là đúng — nhưng giờ nó có bằng chứng | — |

V-5 → V-7 nằm chung bảng có chủ ý: lần audit trước chúng bị báo là "chưa kiểm", và mất một vòng mới phát hiện
là **chưa làm**. Một việc chưa làm mà nằm trong danh sách chờ kiểm thì sẽ không bao giờ được làm. Đúng như vậy:
V-5 và V-6 đóng ngay trong vòng kế tiếp sau khi được gọi đúng tên.

Làm V-7 lại lộ ra một lỗi **nghiêm trọng hơn chính V-7**, và nó có sẵn từ lâu: **mọi Undo trong app đều bị
sync huỷ sau vài giây.** `setTasks(snapshot)` trả lại giá trị cũ **kèm `updatedAt` cũ**, nên bản đã đẩy lên
server một giây trước vẫn mới hơn, và vòng sync kế tiếp áp lại đúng thay đổi vừa được hoàn tác. Chạy cùng một
lượt hai lần, chỉ khác ở chỗ mạng tới Supabase:

```
sync BLOCKED   sau Undo: "nguyen ban"   4s sau: "nguyen ban"
sync live      sau Undo: "nguyen ban"   4s sau: "AI ĐÃ ĐỔI"
```

Áp cho **mọi** đường Undo — AI sửa, xoá, hoãn, cả lối thoát của parser khi nó tự gán due. Nghịch lý là chính
AC-06.2 làm nó lộ ra: hiện diff ra để người dùng quyết có hoàn tác hay không thì cái nút hoàn tác phải thật.
Sửa ở `packages/core/src/undo.ts` — **một undo là một lần ghi mới, không phải tua ngược đồng hồ**, nên giá trị
được đặt lại phải mang dấu thời gian *bây giờ* và được đánh dấu còn nợ server. Chỉ những hàng thật sự khác mới
bị đóng dấu lại: đóng dấu cả list sẽ đẩy nguyên tài khoản lên vì một lần undo, và tệ hơn, sẽ đè lên sửa đổi
thật của máy khác bằng những giá trị không ai đổi.

Và việc dựng chạy thật lại bắt được một lỗi mà đọc code không thấy: bộ đếm hỏng liên tiếp reset đúng, nhưng
**câu báo trên màn hình thì không bao giờ được xoá** — "The AI has not answered the last few times" nằm lại vĩnh
viễn trên một app mà ba lượt kế tiếp vừa chạy tốt. Cùng khuôn với cảnh báo `refused` cũ của sync: một dòng chữ
mô tả trạng thái mà code đã rời khỏi. Nay `aiNote` được đặt từ **mọi** kết cục, không chỉ từ kết cục xấu.

**Còn treo sau Đợt 3** (ghi ra để không tưởng nhầm là đã xong):


- ~~UC-41: >30 list → "Xem tất cả"~~ **đã xử lý bằng cách sửa AC**, không phải bằng code: dòng đó chốt sẵn một
  giải pháp trước khi biết có ai chạm ngưỡng. Nay AC nói nhu cầu ("đến được list bất kỳ mà không mất phương
  hướng"), và cách cuộn hiện tại đã thoả.

- **Hai máy offline cùng tạo list trùng tên** thành hai list riêng sau sync. Đã ghi trong UC-41 như một giới hạn
  đã biết của LWW, không phải bug; chưa có sync nên chưa chạm tới được.

**Còn treo sau Đợt 2** (ghi ra để không tưởng nhầm là đã xong):

- ~~UC-43 "không cho kéo khi đang lọc/tìm kiếm"~~ **đã thoả** kể từ UC-37: tìm kiếm là một **lớp phủ**, không
  phải một đích, nên danh sách kéo được đơn giản là không có trên màn hình lúc đó.
- UC-43 "AI sửa list đúng lúc đang kéo → huỷ thao tác": đã làm ở **mobile**, và **web không cần** — hai nền có
  cơ chế khác nhau nên rủi ro cũng khác. Mobile tính vị trí thả từ một chỉ số chụp lúc bắt đầu cộng chiều cao đo
  được, nên dữ liệu đổi giữa chừng làm phép tính sai → phải huỷ. Web thả **lên một hàng cụ thể**, và handler
  `onDrop` luôn là của lần render mới nhất, nên `ordered`/`index` đã là dữ liệu tươi; còn nếu chính task đang kéo
  bị xoá thì `moveTask` trả về list nguyên vẹn (đã có test "ignores a task that is not in the visible list").
  *Kết luận này rút từ đọc code, chưa dựng được kịch bản sửa-dữ-liệu-giữa-lúc-kéo trên driver.*
| — | **UC-49** | ⏸ hoãn | Câu hỏi sản phẩm: người dùng có phân biệt "bắt đầu" với "hạn" không |
| — | **UC-50** | Giai đoạn 3 | Không còn bị chặn bởi sync (UC-17 đã xong); chặn thật là quyền + xung đột + realtime nhiều người |
| — | **UC-51** | 🟡 | Ảnh đính kèm: core + storage + RLS + upload queue đã có; còn thiếu UI chụp ở cả hai app, và AC-51.2 (đọc chữ trong ảnh) chặn vì cần API key có vision |

## Rủi ro mở cần quyết định khi audit

1. **Draft từ client không được server validate lại** (ADR-3): client có thể gửi draft giả — chấp nhận ở MVP (dữ liệu của chính user) hay validate?
2. **Anon key làm token dev** trong apps — phải thay bằng Supabase Auth session trước mọi bản build phát hành.
3. **CORS `*`** trong `chat-intent` — siết về domain app khi lên production.
4. **Giá `PRICE_TABLE` hardcode** — lệch khi provider đổi giá; cân nhắc bảng DB.
