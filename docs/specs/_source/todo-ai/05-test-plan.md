# Test Plan — Todo AI

> Chiến lược kiểm thử + checklist audit cho các AC không tự động hoá được. Đối chiếu UC/AC: [02-use-cases.md](02-use-cases.md). Trạng thái hiện thực: [04-feature-audit.md](04-feature-audit.md).

## 1. Chiến lược 4 tầng

| Tầng | Công cụ | Phủ gì | Khi nào chạy |
|---|---|---|---|
| **1. Unit** | Vitest (`pnpm test`) | Logic thuần: draft reducer, schemas, prompt builder, scorer | Mỗi commit (CI) |
| **2. AI Eval** | Eval harness (`pnpm eval`) | Chất lượng model: tool đúng, datetime tiếng Việt, reference resolution — nhóm UC A–B | Khi sửa prompt / đổi model / provider cập nhật model |
| **3. E2E tự động** | Playwright (web), Maestro (mobile) | Luồng UI chính với **AI giả lập** (mock chat-intent) — nhanh, ổn định, không tốn token | Mỗi PR (CI) |
| **4. Manual checklist** | Bảng §4 dưới đây | Quyền hệ điều hành, push notification, offline thật, crash recovery — thứ automation khó chạm | Trước mỗi release; audit tính năng |

Nguyên tắc: **E2E không gọi AI thật.** Layer AI đã có eval riêng (tầng 2); E2E mock `chat-intent` bằng response cố định để test UI/luồng — tách "model có thông minh không" khỏi "app có chạy đúng không".

## 2. Bản đồ AC → phương pháp verify

| Nhóm AC | Phương pháp |
|---|---|
| AC-01.1 (latency), 01.2, 02.x, 03.x, 04.1, 05.x–08.x | **Eval harness** (mở rộng kịch bản — xem §5) |
| AC-01.3 (persist trước AI), 25.1, 25.3 (idempotent) | **Unit/integration** trên Edge Function (Deno test) |
| AC-06.2 (diff UI), 07.2 (undo), 09.x, 10.x, 12.x UI, 14–16 | **E2E mock AI** (Playwright/Maestro) |
| AC-11.x (idle timer), 13.x (crash/offline), 22.x, 23.x, 26.x, 28.x | **Manual checklist** (§4) — một phần automation được sau |
| AC-17.x (sync đa thiết bị) | Manual 2 thiết bị + integration test LWW trên DB |
| AC-21.x (đổi model) | Quy trình vận hành: eval trước, telemetry sau |

## 3. E2E scenarios (tự động, mock AI)

### Playwright (web) — `apps/web/e2e/`

Chạy: `pnpm test:e2e` (hoặc `pnpm --filter @todo-ai/web exec playwright test`). Config tự dựng
`next dev` trên cổng 3100 với `NEXT_PUBLIC_SUPABASE_URL` rỗng — tức là **không cần Supabase và
không cần API key nào**, đúng cấu hình mà ADR-7 hứa là vẫn dùng được.

`@playwright/test` ghim ở **1.56.0**, không phải `^`: mỗi bản Playwright đi kèm đúng một revision
Chromium, nên một lần nâng nhỏ cũng làm cả bộ E2E không chạy nổi trên máy đã có sẵn trình duyệt.

| ID | Kịch bản | AC | Trạng thái |
|---|---|---|---|
| E2E-W0 | **CORE không AI:** chặn toàn bộ request AI (route abort) → quick-add, **sống qua reload**, done/undone, đổi tên tại chỗ, xoá+undo, tìm (bỏ dấu), chuyển sang Today, Thùng rác, màn nhãn, sửa list từ tiêu đề, một chạm đẩy sang Today trong list | UC-31..38, UC-09, UC-37, UC-40, ADR-7 | ✅ **Xong 2026-08-15** — 17 ca, `e2e/core.spec.ts` |
| E2E-W2 | Mock trả `ask_clarification` → câu hỏi + các nút trả lời đúng chữ model nêu → chạm nút gửi turn với **chính chữ đó**. Kèm ca ngược: model không nêu lựa chọn thì **không vẽ nút nào**, chứ không quay lại "Có / Không" | UC-08 | ✅ **Xong 2026-08-14** — 2 ca, `e2e/ai.spec.ts` |
| E2E-W5 | Mock lỗi 502 → việc **vẫn còn** và app **im lặng**; ba lần hỏng liên tiếp thì đổi hẳn câu nói (AC-25.2); hết quota thì nói ra ngay lần đầu | UC-25 | ✅ **Xong 2026-08-14** — 3 ca, `e2e/ai.spec.ts` |
| E2E-W6 | Không có Web Speech → orb thành nút gửi, **không báo lỗi**. Kèm ca ngược có recognizer giả, để chứng minh ca kia phân biệt được chứ không xanh sẵn | AC-23.3 | ✅ **Xong 2026-08-14** — 2 ca, `e2e/voice.spec.ts` |
| ~~E2E-W1~~ | ~~Gõ câu → card hiện trong preview~~ | — | ❌ **Bỏ** — mô tả kiến trúc đã bị thay: không còn màn preview, task có ngay khi nhập (ADR-7) |
| ~~E2E-W3~~ | ~~Bấm Lưu → tasks xuất hiện ở Inbox~~ | — | ❌ **Bỏ** — không còn bước commit nào để bấm (xem UC-10) |
| ~~E2E-W4~~ | ~~Mock 409 `commit_required` → không mất draft~~ | — | ❌ **Bỏ** — không còn khái niệm draft. Giới hạn 30 lượt nay trả `409 session_too_long`, đáng có ca riêng nhưng là ca khác |

**Hai bài kiểm tra ngược, cố ý.** Chromium headless vốn đã không có Web Speech, nên ca "không có
mic" sẽ xanh kể cả khi code bị xoá sạch — nó không bảo vệ được gì. Ca đi kèm gắn một recognizer giả
vào `window` và đòi orb đổi vai, nên cặp này chứng minh bài kiểm tra thật sự phân biệt được hai
trạng thái. Cùng lý lẽ với ca "model không nêu lựa chọn thì không vẽ nút nào".

**E2E-W5 nói ngược lại bản kế hoạch đầu, và cố ý.** Bản đầu ghi "error bubble", nhưng đó mô tả một
sản phẩm khác: việc đã được lưu ngay lúc gõ, nên một dòng đỏ sẽ khiến người dùng tưởng chữ của họ
mất. Im lặng sau MỘT lần hỏng là quyết định (xem `noteFailure`), nên ca này khẳng định đúng sự vắng
mặt đó — rồi ca kế bên đòi app phải lên tiếng ở lần thứ ba, khi im lặng đã thành lời nói dối.

**Một ca giữ chỗ một tính năng ĐÃ BỎ.** "Bỏ chế độ chọn nhiều, nhưng trong list vẫn đẩy được sang
Today bằng một chạm" khẳng định hai nửa cùng lúc: nút SELECT đã đi, và nút mặt trời có mặt trên hàng
trong list. Nửa sau mới là nửa đáng giá — UC-40 bị bỏ vì mọi hành động của nó đã có nút một-chạm
trên hàng, *trừ* "chuyển sang Today", vốn chỉ có ở Inbox. Ai bỏ nút đó đi là đóng một đường mà không
mở đường nào khác, và ca này sẽ đỏ. Đã kiểm: đưa điều kiện về lại `dest.kind === "inbox"` thì ca đỏ.

**Bẫy khi viết thêm ca: tránh chữ ra ngày giờ trong tiêu đề test.** `parseDateTime` chạy ngay trong
quick-add, không cần AI (UC-46). Ba việc đặt tên "Việc một / hai / ba" làm E2E-W5b đỏ, vì "một" bị
đọc thành một mốc thời gian, cắt khỏi tiêu đề và để lại ba việc cùng tên "Việc". Cùng họ với "Mai"
trong "gửi số liệu cho Mai" bị hiểu thành *ngày mai*.

**Vì sao bài "sống qua reload" đứng đầu danh sách.** Bản dựng không cấu hình Supabase từng vứt sạch
dữ liệu mỗi lần tải lại trang — app nhận việc, hiện việc, rồi im lặng quên hết. Typecheck sạch,
không test nào đỏ, và nó nằm đó cho tới khi có người mở trình duyệt thật rồi bấm F5. Bộ này đã được
kiểm ngược: tái tạo lại đúng lỗi đó thì ca này **đỏ**, gỡ ra thì xanh — một bài test chưa từng thấy
màu đỏ là một bài test chưa ai biết nó có tác dụng gì.

### Maestro (mobile) — `apps/mobile/e2e/`
| ID | Kịch bản | AC |
|---|---|---|
| E2E-M0 | **CORE không AI:** airplane mode ngay từ đầu → quick-add, done, sửa, xoá vẫn hoạt động; sync khi có mạng | UC-31..36, ADR-7 |
| E2E-M1 | Luồng gõ text như E2E-W1 | UC-01, 06 |
| E2E-M2 | Kill app giữa phiên → mở lại → dialog "Tiếp tục phiên trước?" | AC-13.1 |
| E2E-M3 | Bật airplane mode → gửi turn → banner offline + queue → tắt airplane → tự replay | AC-13.2 |
| E2E-M4 | Lưu N việc → Inbox đủ N, sub-task thành task con | AC-10.2 |

## 4. Manual audit checklist

> Mỗi dòng tick khi audit. Cột "Kết quả" điền ✅/❌/N/A + ghi chú.

### 4.1 Quyền & onboarding (UC-22, 23)
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| M1 | Cài mới, mở app | Màn đăng nhập ≤ 1 màn hình, có Apple (iOS) / Google / email | |
| M2 | Đăng nhập xong | Vào thẳng Capture, hint hướng dẫn, chưa xin quyền mic | |
| M3 | Chạm mic lần đầu | Dialog giải thích NGẮN của app → rồi mới đến dialog quyền OS | |
| M4 | Từ chối quyền | App vẫn dùng được bằng text; mic thành trạng thái denied có tooltip | |
| M5 | Chạm mic khi denied | Deep-link mở đúng trang Settings của app | |
| M6 | Cấp quyền trong Settings, quay lại | Mic hoạt động không cần restart app | |
| M7 | Token hết hạn (đợi/giả lập) | Tự refresh; draft đang mở không mất | |

### 4.2 Lifecycle phiên (UC-11, 12, 13)
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| M8 | Tạo 2 task, bỏ máy 90s | Dải đếm ngược "Tự lưu sau 30s… [Giữ phiên]" xuất hiện | |
| M9 | Không chạm gì tiếp | Auto-commit + toast "Đã lưu 2 việc" + Undo; Inbox có 2 task | |
| M10 | Chạm "Giữ phiên" trong lúc đếm | Timer reset, phiên tiếp tục | |
| M11 | Undo ngay sau auto-commit | Task rút khỏi Inbox, quay lại draft | |
| M12 | Nói đến turn 31 | Thông báo "Phiên đã dài…" + commit; draft không mất | |
| M13 | Kill app giữa phiên (swipe away) | Mở lại: dialog tiếp tục / lưu / huỷ với đúng số task nháp | |
| M14 | Airplane mode giữa phiên, nói 1 câu | Câu nằm queue, banner rõ; card cũ vẫn sửa tay được | |
| M15 | Bật mạng lại | Turn tự gửi, không double, không mất thứ tự | |

### 4.3 Voice thực địa (UC-01, 02 — bổ sung cho eval)
> English-first: test chính bằng tiếng Anh (`en-US`); M17–M18 là coverage cho tiếng Việt/trộn — ngôn ngữ hỗ trợ thứ hai.
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| M16 | Nói trong quán cà phê ồn | Transcript sai được thấy NGAY (interim) → sửa text trước khi gửi | |
| M17 | Nói giọng miền (Trung/Nam) 5 câu mẫu | STT đúng ≥ 4/5 hoặc fallback Whisper kích hoạt | |
| M18 | Nói lẫn Việt–Anh ("book meeting với sếp thứ 2") | Title giữ nguyên ngôn ngữ trộn | |
| M19 | Đổi timezone máy sang US, nói "chiều mai" | Datetime theo timezone MỚI của máy | |

### 4.4 Nhắc nhở (UC-26) — khi hiện thực
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| M20 | Task có reminder 2 phút sau, khoá màn hình | Push đến đúng ±1 phút, nội dung có title task | |
| M21 | Done task trước giờ nhắc | Notification bị huỷ, không kêu | |
| M22 | Chạm notification | Mở đúng Task Detail | |
| M23 | Đổi due bằng tay (UC-27) | Notification reschedule theo giờ mới | |

### 4.5 Dữ liệu cá nhân (UC-28)
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| M24 | Settings → Xoá lịch sử hội thoại | `capture_sessions.messages` + `captures.raw_text` trống ngay (verify DB); tasks còn nguyên | |
| M25 | Xoá tài khoản | Xác nhận 2 bước; đăng nhập lại không còn dữ liệu | |

### 4.6 Sync đa thiết bị (UC-17)
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| M26 | 2 thiết bị cùng account, sửa task trên A | B thấy thay đổi ≤ 3s | |
| M27 | B offline, sửa cùng task khác trường trên A và B, B online lại | Không duplicate; bản `updated_at` muộn hơn thắng | |

### 4.7 Cách ly dữ liệu giữa các tài khoản — CHẠY MỖI LẦN RELEASE

> **Mục này khác mọi mục khác trong §4: nó không phải "audit khi có thời gian", nó là CỔNG RELEASE.**
> Lý do rất cụ thể — Edge Function dựng client bằng `SERVICE_ROLE_KEY`, tức **bỏ qua RLS hoàn toàn**. Mọi policy
> `own …` trong migration **không bảo vệ** đường đi đó. Chỗ chặn duy nhất là một mệnh đề lọc `user_id` viết
> trong code, và **thiếu nó không sinh ra lỗi nào cả** — nó sinh ra một kết quả trông hoàn toàn bình thường,
> chỉ là của người khác. Đây là loại hỏng không bao giờ tự lộ ra; phải đi tìm mới thấy.

| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| M28 | Hai tài khoản A và B. A nói vài câu có một từ hiếm (vd "Đà Nẵng"), B nói vài câu khác | Chuẩn bị dữ liệu | |
| M29 | B hỏi tìm lại đúng từ hiếm của A | **Không ra gì của A.** Chạy qua đúng đường Edge Function dùng (service role), không phải anon key | |
| ~~M30~~ | ~~Đọc lại mọi truy vấn chạm `captures`, `capture_sessions`, `ai_requests`, `tasks`, `lists` trong Edge Function~~ | **Đã tự động hoá — không phải làm tay nữa.** Xem khối bên dưới | ✅ |
| M31 | Xoá lịch sử của A (UC-28) | B không ảnh hưởng; index tìm kiếm của A cũng trống | |

**M30 giờ là một test, không phải một bước người làm.**
`packages/server/test/service-role-scoping.test.ts` đọc mã nguồn của **mọi file cầm
`SUPABASE_SERVICE_ROLE_KEY`** (hôm nay là hai Edge Function, ngày mai là bất cứ file nào thêm vào — nó đi theo
cái khoá chứ không theo một danh sách đường dẫn), lấy từng chuỗi `.from("bảng")…` kể cả khi Biome bẻ qua nhiều
dòng, và bắt: truy vấn `select`/`update`/`delete` phải có `.eq("user_id", …)`, còn `insert` phải có `user_id`
**trong hàng ghi xuống** — đòi `.eq` ở đó là đòi một mệnh đề không tồn tại. Bảng nào là của người dùng thì đọc
thẳng từ `supabase/migrations/` chứ không liệt kê sẵn, nên bảng mới của migration sau tự động được xét;
`ai_config` không có cột `user_id` nên cố ý không bị đòi lọc. Chạy bằng `pnpm test` — tức mọi PR (§6).

Đã thấy nó **đỏ** trước khi tin: bỏ `.eq("user_id", userId)` khỏi `saveTranscript` → đỏ; thêm một truy vấn mới
không lọc → đỏ; viết tên bảng bằng biến để nó không đọc được → cũng đỏ, chứ không im lặng bỏ qua.

**Nó KHÔNG thấy gì** (vẫn thuộc phần người làm, M28/M29/M31 giữ nguyên): giá trị truyền vào có đúng là id của
người đang gọi hay không; một file lấy quyền service role qua tên biến môi trường khác; truy vấn dựng ở nơi
khác rồi truyền builder vào. M28/M29/M31 là thứ duy nhất chứng minh dữ liệu **thật** không rò — test này chỉ
chứng minh không có mệnh đề nào bị quên.

## 5. Việc cần bổ sung cho tầng eval (từ rà soát UC)

| # | Kịch bản mới | UC/AC |
|---|---|---|
| EV-8 | Câu không phải task ("Hôm nay trời đẹp nhỉ") → 0 tool call, có câu trả lời hướng dẫn | UC-24 |
| EV-9 | Task đơn giản ("mua sữa") → KHÔNG có subtasks | AC-04.1 |
| EV-10 | "ngày kia", "thứ 6 tuần sau", "tối nay", "next Monday" (4 case datetime) | AC-02.1 |
| EV-11 | Câu không có thời gian → không bịa `due_at` | AC-02.2 |
| EV-12 | Paste 1.500 ký tự nhiều việc lẫn lộn → tách đúng, không trùng | AC-03.2 |
| EV-13 | Nói "xong rồi lưu đi" → 0 tool call (app xử lý save) | UC-10 |

## 6. Cổng CI đề xuất

```
PR → pnpm typecheck + pnpm test (tầng 1)      [chặn merge]
   → Playwright E2E mock (tầng 3, web)         [chặn merge]
   → Maestro cloud (tầng 3, mobile)            [chặn merge khi ổn định]
Sửa prompt / đổi model → pnpm eval, đính report vào PR  [review bắt buộc]
Release → checklist §4 ký tên người audit
```
