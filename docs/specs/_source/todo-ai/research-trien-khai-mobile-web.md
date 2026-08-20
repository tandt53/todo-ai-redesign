# Nghiên cứu triển khai: Mobile App & Web cho AI-native Personal Assistant

> Tài liệu nghiên cứu kỹ thuật cho ý tưởng trong `README.md` — trợ lý cá nhân định hướng ý định (Intent-based AI Assistant), voice-first, triết lý "Lười là thượng đế".

---

## 1. Tóm tắt đề xuất (TL;DR)

| Hạng mục | Đề xuất | Lý do chính |
|---|---|---|
| Mobile | **React Native + Expo** (iOS & Android) | 1 codebase, hệ sinh thái voice/widget tốt, chia sẻ logic với web |
| Web | **Next.js (React)** trong monorepo, chia sẻ code với mobile | Tái sử dụng ~70% logic (state, API, AI client), SEO + PWA |
| Backend | **Supabase** (Postgres + Auth + Realtime + Edge Functions) | Đúng như định hướng README, ra MVP nhanh, realtime sync sẵn có |
| AI | **Lớp AI model-agnostic** (Vercel AI SDK) chạy **agent hội thoại nhiều lượt** với bộ tools CRUD; khởi điểm `claude-sonnet-5`, đổi model qua config | Thử được nhiều model (Claude/GPT/Gemini) mà không sửa business logic; eval harness so sánh khách quan; user nói chuyện qua lại để tạo/sửa task như chat với assistant |
| Speech-to-Text | **On-device trước** (iOS Speech / Android SpeechRecognizer qua `expo-speech-recognition`), fallback cloud (Whisper API) | Nhanh, rẻ, hoạt động offline một phần; tiếng Việt được hỗ trợ tốt |
| Local storage / Offline | **SQLite (expo-sqlite) + đồng bộ lên Supabase**; web dùng IndexedDB | Capture phải hoạt động tức thì kể cả mất mạng — cốt lõi của "quick capture" |
| Monorepo | **Turborepo + pnpm workspaces** | Quản lý app mobile, web, packages chung trong 1 repo |

---

## 2. Phân tích yêu cầu từ đặc tả

Từ README, sản phẩm có 4 nhóm tính năng MVP với các ràng buộc kỹ thuật ngầm:

1. **Quick Capture & Voice Input** → yêu cầu độ trễ mở app cực thấp, ghi âm/nhận dạng giọng nói ổn định, nhập liệu phải **không bao giờ mất dữ liệu** (offline-first).
2. **AI Intent Processing** → cần LLM có khả năng tool calling / structured output để bóc tách task, sub-task, thời gian từ văn bản lộn xộn (tiếng Việt lẫn tiếng Anh).
3. **Intent Preview & Confirmation** → UI dạng thẻ (cards) có thể chỉnh sửa nhanh trước khi lưu; luồng human-in-the-loop.
4. **Storage & Sync** → Inbox + Today view, đồng bộ đa thiết bị qua cloud.

Giai đoạn 2–3 (widget, incremental update, tích hợp Jira/GitHub/Calendar, push notification) ảnh hưởng đến **lựa chọn nền tảng ngay từ đầu** — ví dụ: widget màn hình chính đòi hỏi code native, nên framework mobile phải hỗ trợ mở rộng native tốt.

---

## 3. Lựa chọn nền tảng Mobile

### 3.1. So sánh các phương án

| Tiêu chí | React Native + Expo | Flutter | Kotlin Multiplatform | Native thuần (Swift/Kotlin) |
|---|---|---|---|---|
| 1 codebase iOS + Android | ✅ | ✅ | ✅ (UI riêng hoặc Compose MP) | ❌ (2 codebase) |
| Chia sẻ code với **Web** | ✅✅ (React, có thể dùng Expo Web) | ⚠️ (Flutter Web còn hạn chế về SEO, bundle nặng) | ⚠️ (chỉ chia sẻ logic) | ❌ |
| Speech-to-text | ✅ `expo-speech-recognition`, `@react-native-voice/voice` | ✅ `speech_to_text` | Phải viết native | ✅ API native tốt nhất |
| Home Screen Widget (Giai đoạn 2) | ✅ qua Expo Modules / config plugin (WidgetKit, Glance) | ⚠️ `home_widget` (khó hơn) | ✅ | ✅ |
| Tốc độ ra MVP | ✅✅ (Expo EAS build, OTA update) | ✅ | ⚠️ | ❌ |
| Tuyển dụng / cộng đồng | Rất lớn (JS/TS) | Lớn | Nhỏ hơn | Lớn nhưng tách đôi |

### 3.2. Kết luận: **React Native + Expo**

Lý do quyết định không phải chỉ là mobile, mà là **web + mobile cùng lúc**:

- Dùng chung TypeScript cho toàn bộ: types của Task/Intent, client Supabase, client AI, logic parse/validate — chỉ viết 1 lần.
- Expo SDK hiện đại (Expo Router, EAS Build, OTA updates qua `expo-updates`) cho phép ship nhanh và sửa lỗi không cần qua app store review.
- Các nhu cầu native của Giai đoạn 2 (widget, App Intents/Siri, push notification) đều có đường đi rõ ràng qua Expo Modules API và config plugins — không bị "kẹt trần" như Expo thời cũ.
- Voice: `expo-speech-recognition` bọc SFSpeechRecognizer (iOS) và SpeechRecognizer (Android), hỗ trợ tiếng Việt, có chế độ on-device.

**Khi nào chọn khác:** nếu đội ngũ đã mạnh Flutter thì Flutter vẫn khả thi cho mobile, nhưng phần web nên tách riêng (Next.js) và chấp nhận không chia sẻ UI code — tổng chi phí cao hơn phương án React Native.

---

## 4. Lựa chọn nền tảng Web

### 4.1. Hai chiến lược

**Chiến lược A — Expo Web (universal app):** cùng 1 codebase React Native render ra web qua `react-native-web`.
- ✅ Chia sẻ ~95% code.
- ❌ Trải nghiệm web "giống app di động", SEO yếu, khó tối ưu keyboard shortcuts / desktop layout — mà web của một todo app lại chủ yếu dùng trên desktop.

**Chiến lược B — Next.js riêng, chia sẻ packages (khuyến nghị):**
- App web Next.js (App Router) + Tailwind CSS + shadcn/ui.
- Chia sẻ qua monorepo: `packages/core` (types, business logic, AI prompt/schema), `packages/api` (Supabase client, data hooks với TanStack Query), có thể thêm `packages/ui` cho design tokens.
- Web hỗ trợ **PWA** (installable, Web Push) để có trải nghiệm gần app trên desktop.
- Voice trên web: **Web Speech API** (Chrome/Edge hỗ trợ tiếng Việt) với fallback ghi âm MediaRecorder → gửi Whisper API.

### 4.2. Kết luận: **Chiến lược B**

Todo/notes app trên web cần desktop UX tốt (phím tắt, sidebar, bulk edit) — Next.js riêng cho phép tối ưu điều đó trong khi vẫn tái sử dụng toàn bộ "bộ não" (logic AI, data layer). Bắt đầu MVP có thể chỉ cần mobile + web đơn giản, nhưng cấu trúc monorepo nên dựng từ ngày đầu.

---

## 5. Kiến trúc hệ thống

```
┌─────────────┐   ┌─────────────┐
│  Mobile App │   │   Web App   │
│ Expo / RN   │   │   Next.js   │
└──────┬──────┘   └──────┬──────┘
       │  packages/core (types, logic)
       │  packages/api  (data hooks)
       ▼                 ▼
┌───────────────────────────────────┐
│            Supabase               │
│  Auth │ Postgres │ Realtime │ RLS │
│        Edge Functions (Deno)      │
│  ┌─────────────────────────────┐  │
│  │  /chat-intent (agent loop,  │──┼──► Claude API (multi-turn
│  │   multi-turn conversation)  │  │     tool calling)
│  │  /transcribe (fallback STT) │──┼──► Whisper API
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
```

**Nguyên tắc quan trọng:** client **không bao giờ gọi thẳng** Claude/OpenAI API (lộ API key). Mọi lệnh gọi AI đi qua Supabase Edge Functions — nơi giữ key, kiểm soát rate limit theo user, và log chi phí.

### 5.1. Mô hình tương tác: Hội thoại nhiều lượt (Conversational Agent)

**Yêu cầu cốt lõi:** sau khi user nói và app tạo task, user **tiếp tục nói chuyện** để thêm task mới hoặc chỉnh sửa task vừa tạo — như một cuộc hội thoại tự nhiên giữa user và assistant:

> 🗣 "Mai họp team lúc 10h, chuẩn bị slide báo cáo quý"
> 🤖 *tạo 2 task: [Họp team — mai 10:00] [Chuẩn bị slide báo cáo quý]*
> 🗣 "À slide thì thêm phần số liệu doanh thu nữa"
> 🤖 *thêm sub-task "Số liệu doanh thu" vào task slide*
> 🗣 "Đổi họp sang 2h chiều đi"
> 🤖 *sửa task họp team → 14:00*

Điều này nghĩa là AI **không phải bộ bóc tách một lần (one-shot)** mà là một **agent hội thoại** phải:
1. **Nhớ ngữ cảnh phiên** — toàn bộ các lượt nói trước và các task đã tạo/sửa trong phiên.
2. **Phân giải tham chiếu (reference resolution)** — hiểu "cái task lúc nãy", "task đầu tiên", "slide thì...", "đổi họp sang..." đang trỏ vào task nào.
3. **Chọn đúng hành động** — tạo mới, sửa, thêm sub-task, xoá, hay hỏi lại khi mơ hồ (thay vì luôn tạo task mới).

### 5.2. Luồng chính: Capture → Agent Loop → Live Preview → Save

1. User bấm mic và nói (hoặc gõ). STT on-device chuyển thành text; mỗi lượt nói là một **turn** trong phiên hội thoại (capture session).
2. Text thô mỗi turn được lưu **ngay lập tức** vào local (SQLite/IndexedDB) trạng thái `pending` — không mất dữ liệu dù crash/mất mạng.
3. Client gọi Edge Function `chat-intent` với: **lịch sử messages của phiên** + text turn mới + ngữ cảnh (timezone, `now`, danh sách task hiện có trong Preview, task gần đây trong DB).
4. Edge Function chạy **agent loop** với Claude: model chọn tool (`create_tasks` / `update_task` / `add_subtasks` / `delete_task` / `ask_clarification`), server thực thi lên **draft state** rồi trả kết quả tool về model, lặp đến khi model kết thúc turn.
5. Client cập nhật màn **Live Preview**: cards xuất hiện/thay đổi ngay sau mỗi turn (diff được highlight — task mới, trường vừa sửa). User có thể tiếp tục nói hoặc sửa tay trực tiếp trên card.
6. Khi user bấm **xác nhận** (hoặc nói "xong rồi, lưu đi"), toàn bộ draft ghi vào local DB (optimistic) rồi sync lên Supabase; Realtime đẩy sang thiết bị khác. Phiên hội thoại đóng lại.

**Điểm thiết kế quan trọng — Draft state:** trong suốt phiên hội thoại, các task chỉ tồn tại ở dạng **bản nháp** (client-side hoặc bảng `draft_tasks`), chưa ghi vào `tasks` thật. Human-in-the-loop vẫn được giữ: AI thao tác thoải mái trên draft, user chỉ commit một lần cuối. (Tuỳ chọn cấu hình "auto-save từng turn" cho user thích tốc độ — Giai đoạn 2.)

### 5.3. Bộ tools cho agent (trái tim của sản phẩm)

Thay vì một tool `extract_tasks` duy nhất, agent cần **bộ tool CRUD trên draft**:

```jsonc
// 1. Tạo task mới (một hoặc nhiều)
{
  "name": "create_tasks",
  "input_schema": { "tasks": [{
      "title": "string (bắt buộc)",
      "note": "string",
      "due_at": "ISO datetime",
      "reminder_at": "ISO datetime",
      "priority": "low | medium | high",
      "subtasks": ["string"]
  }]}
}

// 2. Sửa task đã có trong phiên (hoặc task cũ khi incremental update)
{
  "name": "update_task",
  "input_schema": {
    "task_ref": "string — id của task trong draft/danh sách được cung cấp",
    "changes": { /* các trường cần đổi, chỉ gửi trường thay đổi */ }
  }
}

// 3. Thêm sub-task vào task đã có
{ "name": "add_subtasks", "input_schema": { "task_ref": "string", "subtasks": ["string"] } }

// 4. Xoá task khỏi draft ("thôi bỏ cái đó đi")
{ "name": "delete_task", "input_schema": { "task_ref": "string" } }

// 5. Hỏi lại khi mơ hồ (không đoán bừa)
{ "name": "ask_clarification", "input_schema": { "question": "string" } }
```

Ghi chú thiết kế prompt & context:
- **Mỗi turn, inject danh sách task hiện tại của draft** (id + title + due) vào context để model phân giải tham chiếu chính xác — model trả về `task_ref` là id, không phải mô tả mơ hồ.
- Truyền `now` + `timezone` vào system prompt để quy đổi "chiều mai", "thứ 6 tuần sau" thành ISO datetime.
- Yêu cầu AI **giữ nguyên ngôn ngữ gốc** của user trong title/note (không tự dịch).
- Sub-task chỉ tạo khi task đủ phức tạp — tránh phân rã vụn vặt gây phiền.
- Quy tắc ưu tiên trong prompt: *"khi câu nói có thể là sửa task cũ hoặc tạo task mới, ưu tiên sửa nếu có tham chiếu rõ; nếu không chắc → `ask_clarification`"*.
- Dùng **prompt caching** cho system prompt + tools + lịch sử hội thoại — các turn sau chỉ trả phí phần mới, giữ chi phí phiên nhiều lượt gần bằng one-shot.

### 5.4. Lifecycle phiên hội thoại (Conversation Session)

**Nguyên tắc gốc:** session sống ngắn, gắn với **một lần capture** — không phải chat lịch sử vô hạn. Đây là quyết định thiết kế quan trọng nhất để tránh context phình to, chi phí tăng và AI "lú" vì lịch sử quá dài.

#### Sơ đồ trạng thái

```
                 bắt đầu nói/gõ
   (không có) ────────────────► OPEN ◄──┐
                                 │      │ mỗi turn mới
                                 │      │ reset idle timer
                 ┌───────────────┼──────┘
                 │               │
     user huỷ /  │               │  user bấm lưu / nói "xong"
     draft rỗng  │               │  hoặc idle quá N phút (auto-commit)
                 ▼               ▼
             DISCARDED       COMMITTED ──► tasks ghi vào DB, sync
                                 │
                                 │  (Giai đoạn 2) mở task đã lưu + nói tiếp
                                 ▼
                          session MỚI (incremental update,
                          task cũ inject vào context)
```

#### Các sự kiện đóng phiên

| Sự kiện | Hành vi |
|---|---|
| User bấm **Lưu** hoặc nói "xong rồi, lưu đi" | Commit draft → `tasks`, đóng session. Đường chính. |
| **Idle timeout** (không có turn mới ~2 phút, đếm lùi hiện trên UI) | **Auto-commit** draft (không âm thầm vứt bỏ — triết lý "không bao giờ mất dữ liệu"). Thông báo nhẹ "Đã lưu 3 việc" + nút Undo. |
| User bấm **Huỷ** | Xác nhận rồi `discarded`. Transcript thô vẫn giữ trong `captures` một thời gian ngắn để cứu nhầm lẫn. |
| **App bị kill / crash giữa chừng** | Draft + messages đã persist local sau mỗi turn → mở app lại hỏi "Tiếp tục phiên đang dở? (3 task nháp)" với lựa chọn tiếp tục / lưu luôn / huỷ. |
| **Mất mạng giữa phiên** | Turn mới lưu local `pending`; session giữ `open`, replay khi có mạng (đã nêu ở 5.6). |

Sau khi `committed`/`discarded`, session **không mở lại** — muốn sửa tiếp thì mở task đã lưu, hệ thống tạo session *mới* với task đó inject vào context (cơ chế incremental update). Điều này giữ mỗi session ngắn và ngữ cảnh sạch.

#### Hội thoại quá dài thì sao? — 3 tầng phòng thủ

Thiết kế có một lợi thế cấu trúc: **draft state là nguồn sự thật, không phải transcript**. Mỗi turn đều inject snapshot draft hiện tại (id + title + due của mọi task) vào context, nên thông tin "đã chốt" luôn nằm trong snapshot — các turn cũ chỉ còn giá trị ngữ cảnh hội thoại. Nhờ vậy có thể cắt bớt lịch sử mà không mất dữ liệu.

**Tầng 1 — UX ngăn từ đầu (rẻ nhất):** session gắn với một lần capture nên thực tế 3–10 lượt. Live Preview + nút lưu luôn hiện khuyến khích commit sớm; idle timeout tự chốt phiên bỏ quên. Phần lớn session không bao giờ chạm tầng 2.

**Tầng 2 — Sliding window + summary (ngưỡng mềm, ~15–20 turns hoặc ~20K token input):**
- Giữ: system prompt + **draft snapshot mới nhất** + K turns gần nhất (vd 10).
- Các turn cũ hơn được **tóm tắt thành một message** duy nhất kiểu *"Trước đó trong phiên này: user đã tạo task A, B; đổi deadline task A sang thứ 6; xoá task C"* — sinh bằng model rẻ (Haiku) hoặc thậm chí bằng code từ log tool-calls (mỗi tool call đã là một bản ghi có cấu trúc, ghép lại thành summary không tốn token AI nào).
- Làm **compaction ở tầng application** (trong `chat-intent`), không dùng tính năng compaction riêng của từng provider — giữ đúng nguyên tắc model-agnostic ở mục 6; adapter nào cũng chạy được.
- Lưu ý cache: khi cắt lịch sử, prefix đổi → mất cache một lần cho request đó; chọn ngưỡng đủ cao để compaction hiếm khi xảy ra hơn là compaction liên tục.

**Tầng 3 — Hard limit (ngưỡng cứng, ~30 turns hoặc ~15 phút):**
- Buộc commit: "Phiên này đã dài, mình lưu 8 việc lại nhé — bạn có thể mở từng việc để bổ sung tiếp." Session đóng, user tiếp tục bằng incremental update trên task đã lưu — không mất gì, chỉ đổi "một phiên dài" thành "nhiều phiên ngắn".
- Đây cũng là van an toàn chi phí: chặn trường hợp bất thường (user để mic mở, vòng lặp lỗi client gửi turn liên tục) trước khi đốt token.

#### Vòng đời dữ liệu hội thoại sau khi đóng (retention)

- `capture_sessions.messages` (transcript + tool calls) giữ lại phục vụ audit/debug/eval — nhưng là dữ liệu cá nhân nhạy cảm (user đọc cả suy nghĩ của họ vào mic), nên đặt **retention 30–90 ngày** rồi xoá/ẩn danh hoá tự động (pg_cron), trừ các phiên user đánh dấu báo lỗi.
- Tasks đã commit sống độc lập, không phụ thuộc transcript — xoá transcript không ảnh hưởng dữ liệu chính.
- Các phiên `discarded` xoá sớm hơn (vd 7 ngày).

#### Các quyết định UX đi kèm

- **Incremental update task cũ** (Giai đoạn 2 trong README) dùng chung cơ chế session: mở task cũ → session mới với task đó inject sẵn → user nói để nhồi thêm note/sub-task.
- **Voice UX hai chiều (tuỳ chọn):** phản hồi của assistant có thể đọc lên bằng TTS (`expo-speech` / Web Speech Synthesis) — khớp tính năng Audio Playback ở Giai đoạn 2.
- **Chế độ mic:** MVP dùng **push-to-talk từng lượt**. Continuous listening (cần VAD/turn detection) để Giai đoạn 2.

### 5.5. Data model (Postgres / Supabase)

```sql
-- Phiên hội thoại capture: một lần user mở mic và nói nhiều lượt
create table capture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  status text default 'open',      -- open | committed | discarded
  closed_reason text,              -- user_save | idle_timeout | hard_limit | user_discard
  messages jsonb default '[]',     -- lịch sử turns (user/assistant/tool) để audit & retry
  created_at timestamptz default now(),
  closed_at timestamptz,
  expires_at timestamptz           -- retention: transcript tự xoá sau 30-90 ngày
);

-- Bản ghi thô từng lượt voice/text, giữ lại để audit & retry
create table captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  session_id uuid references capture_sessions,
  raw_text text not null,
  source text check (source in ('voice','text','share')),
  status text default 'pending',   -- pending | processed | discarded
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  capture_id uuid references captures,
  parent_id uuid references tasks,  -- sub-task trỏ về task cha
  title text not null,
  note text,
  due_at timestamptz,
  reminder_at timestamptz,
  priority text default 'medium',
  status text default 'inbox',      -- inbox | today | done | archived
  sort_order double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz            -- soft delete phục vụ sync
);
```

- Bật **Row Level Security** trên mọi bảng (`user_id = auth.uid()`).
- "Today Focus" là **view/filter** (`due_at` trong hôm nay hoặc status = 'today'), không phải bảng riêng.
- `updated_at` + `deleted_at` là nền tảng cho chiến lược sync last-write-wins.

### 5.6. Offline-first & Sync

Quick capture phải hoạt động ở mọi điều kiện mạng — đây là điểm sống còn.

- **MVP đơn giản:** ghi local trước (expo-sqlite trên mobile, IndexedDB qua Dexie trên web) → hàng đợi sync đẩy lên Supabase khi có mạng, xung đột giải quyết bằng last-write-wins theo `updated_at`. Với dữ liệu cá nhân 1 user, xung đột thực tế rất hiếm.
- **Khi cần nâng cấp:** cân nhắc **PowerSync** hoặc **Legend-State** (có sync plugin cho Supabase) thay vì tự viết engine sync phức tạp.
- **Hội thoại cần mạng:** agent loop bắt buộc online (gọi Claude). Khi offline, app hạ cấp về chế độ "ghi chú thô": các lượt nói vẫn được STT on-device và lưu local `pending`; khi có mạng lại, các turn được replay vào một session mới để AI xử lý. UI cần hiển thị rõ trạng thái này để user không hiểu lầm.

---

## 6. Lớp AI: thiết kế model-agnostic & lựa chọn model

**Yêu cầu thiết kế:** phải thử nghiệm được với nhiều loại model khác nhau (Claude, GPT, Gemini, model khác...) mà không phải sửa business logic. Toàn bộ lớp AI được thiết kế theo nguyên tắc **provider-agnostic ngay từ đầu** — đổi model chỉ là đổi config, không phải đổi code.

### 6.1. Kiến trúc trừu tượng hoá provider

```
┌──────────────────────────────────────────────────────┐
│  Agent Loop (chat-intent Edge Function)              │
│  — business logic, KHÔNG biết provider nào đang chạy │
├──────────────────────────────────────────────────────┤
│  packages/ai — lớp trừu tượng                        │
│  ├── schemas/    tool schemas viết bằng Zod          │
│  │               (nguồn sự thật duy nhất, provider-  │
│  │                neutral, tự sinh JSON Schema)      │
│  ├── prompts/    system prompt templates             │
│  ├── provider.ts interface LLMProvider chuẩn hoá     │
│  └── telemetry.ts log model/tokens/latency/cost      │
├──────────────────────────────────────────────────────┤
│  Adapters (mỗi provider một adapter mỏng)            │
│  ├── anthropic  → Claude API (@anthropic-ai/sdk)     │
│  ├── openai     → GPT models                         │
│  ├── google     → Gemini models                      │
│  └── ...        → thêm provider = thêm 1 file        │
└──────────────────────────────────────────────────────┘
```

**Khuyến nghị cách hiện thực:** dùng **Vercel AI SDK** (package `ai` + `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`) làm lớp adapter thay vì tự viết. Lý do:
- Đã chuẩn hoá sẵn `generateText`/`streamText` với **tool calling thống nhất** trên mọi provider — tool định nghĩa bằng Zod một lần, SDK tự chuyển sang format của từng provider.
- Chạy được trong Supabase Edge Functions (Deno hỗ trợ npm imports).
- Đổi model = đổi 1 dòng: `model: anthropic('claude-sonnet-5')` → `model: openai('gpt-...')`.

**Phương án thay thế:** tự viết interface `LLMProvider` mỏng (chỉ cần `chat(messages, tools) → {toolCalls, text}`) nếu muốn kiểm soát tuyệt đối hoặc tránh phụ thuộc; hoặc dùng gateway kiểu **OpenRouter** để gọi mọi model qua một endpoint (đổi model = đổi string, nhưng thêm một bên trung gian về độ trễ/dữ liệu). Bắt đầu với Vercel AI SDK là cân bằng nhất.

### 6.2. Quy tắc để việc "thử model" không phá hệ thống

1. **Model là config, không phải code:** bảng `ai_config` (hoặc env) quy định `provider + model_id` cho từng tác vụ (`intent_agent`, `classifier`...). Có thể override theo user/phiên để chạy **A/B test** giữa các model trên user thật.
2. **Tool schemas là nguồn sự thật duy nhất:** viết bằng Zod trong `packages/ai/schemas`, không viết tay JSON cho từng provider. Output của model **luôn validate lại bằng Zod** trước khi chạm vào draft state — vì mỗi model có độ tin cậy tool-calling khác nhau, lớp validate + retry (re-prompt khi sai schema) phải nằm ngoài adapter, dùng chung cho mọi model.
3. **Prompt tách khỏi code, có version:** system prompt là template trong `packages/ai/prompts`, đánh version. Lưu ý mỗi model "nghe" prompt khác nhau — cho phép prompt variant theo provider khi cần (ví dụ `intent.v3.md` + `intent.v3.gemini.md`), nhưng mặc định dùng chung một bản.
4. **Telemetry từng request:** bảng `ai_requests` ghi `model`, `prompt_version`, input/output tokens, latency, cost ước tính, kết quả validate. Không có số liệu này thì "thử nhiều model" chỉ là cảm tính.
5. **Tính năng riêng của provider phải được cô lập trong adapter:** prompt caching (Anthropic `cache_control`), context caching (Gemini)... khai báo qua một cờ chung (vd `cacheBreakpoint: true`), adapter tự dịch sang cơ chế của provider — hoặc bỏ qua nếu provider không hỗ trợ.

### 6.3. Bộ eval so sánh model (bắt buộc có trước khi thử)

Tận dụng bộ test đã nêu ở lộ trình (~50 câu đơn + ~20 kịch bản hội thoại nhiều lượt) thành một **eval harness** chạy được với bất kỳ model nào:

```
pnpm eval --model anthropic/claude-sonnet-5
pnpm eval --model openai/gpt-x
pnpm eval --model google/gemini-x
→ bảng so sánh: % đúng tool, % đúng datetime tiếng Việt,
  % phân giải đúng tham chiếu, latency p50/p95, cost/phiên
```

Mỗi kịch bản có expected output (tool được gọi, task_ref đúng, datetime đúng) chấm tự động bằng code; các tiêu chí mềm (chất lượng phân rã sub-task) chấm bằng LLM-judge. Đây là cách duy nhất để quyết định model một cách khách quan — và cũng là regression test khi provider cập nhật model.

### 6.4. Danh mục model cần dùng (model inventory)

Toàn bộ các điểm chạm AI trong hệ thống và model gán cho từng điểm. Mỗi vai trò LLM là một **key trong `ai_config`** — đổi model không sửa code.

**LLM (qua lớp model-agnostic ở 6.1):**

| Vai trò (`ai_config` key) | Model khởi điểm | Giai đoạn | Ghi chú & chi phí |
|---|---|---|---|
| `intent_agent` — agent hội thoại tạo/sửa task (trái tim sản phẩm) | `claude-sonnet-5` | MVP | Tool calling mạnh, tiếng Việt tốt; $3/$15 per MTok (ưu đãi $2/$10 đến 31/08/2026). Chạy online, mọi turn của user |
| `light_tasks` — tóm tắt compaction (mục 5.4 tầng 2), phân loại, gom nhóm bulk input | `claude-haiku-4-5` | MVP | $1/$5 per MTok, latency thấp; khối lượng nhỏ |
| `eval_judge` — LLM-judge chấm tiêu chí mềm trong eval harness (6.3) | `claude-opus-5` | MVP (chỉ chạy offline) | Judge nên mạnh hơn model bị chấm để đáng tin; $5/$25 per MTok nhưng chỉ chạy khi dev sửa prompt/đổi model, không phát sinh chi phí runtime |
| Ứng viên so sánh qua eval | GPT (OpenAI), Gemini (Google) tier tương đương Sonnet | Thử nghiệm | Chạy cùng bộ eval 6.3 để so chất lượng tiếng Việt + tool calling + giá trước khi cân nhắc chuyển |

**Speech (ngoài lớp LLM — không đi qua `ai_config`):**

| Vai trò | Công nghệ | Giai đoạn | Chi phí |
|---|---|---|---|
| STT chính | On-device: SFSpeechRecognizer (iOS) / SpeechRecognizer (Android) / Web Speech API | MVP | Miễn phí |
| STT fallback | Whisper API (hoặc Deepgram) | MVP | ~$0.006/phút audio, chỉ khi on-device không khả dụng/kém |
| TTS đọc phản hồi | On-device: `expo-speech` / Web SpeechSynthesis | Giai đoạn 2 | Miễn phí |

**Chưa cần ở MVP:** embedding model (tìm kiếm ngữ nghĩa / gợi ý task trùng lặp) — khi cần, Supabase có pgvector + có thể dùng model embedding chạy ngay trong Edge Functions; ghi nhận là hướng mở rộng, không đưa vào lộ trình hiện tại.

Ước lượng chi phí (với Sonnet làm mốc): turn đầu của một phiên ~1.000–2.000 token vào + ~300 token ra; các turn sau cộng dồn lịch sử nhưng phần cũ được **prompt caching** (cache read ~0.1× giá gốc) nên chi phí biên mỗi turn thấp. Một phiên 3–5 lượt trung bình **dưới 2 cent**; user dùng 10 phiên/ngày tốn cỡ dưới 1 USD/tháng. Lưu ý: cơ chế caching khác nhau giữa các provider — con số này phải đo lại qua telemetry khi đổi model.

Về sau (Giai đoạn 3), kiến trúc tool calling mở rộng tự nhiên: thêm tool `create_jira_issue`, `create_github_issue`, `create_calendar_event` vào cùng agent — đúng định hướng "AI Tools/Function Calling" trong README. Cân nhắc chuẩn **MCP (Model Context Protocol)** cho các integration này — cũng là chuẩn mở đa provider, khớp với triết lý model-agnostic.

---

## 7. Speech-to-Text chi tiết

| Nền tảng | Phương án chính | Fallback |
|---|---|---|
| iOS | `expo-speech-recognition` → SFSpeechRecognizer (hỗ trợ on-device, tiếng Việt) | Ghi âm → Whisper API |
| Android | `expo-speech-recognition` → SpeechRecognizer (Google) | Ghi âm → Whisper API |
| Web (Chrome/Edge) | Web Speech API (`webkitSpeechRecognition`, lang `vi-VN`) | MediaRecorder → Whisper API |
| Web (Safari/Firefox) | Không có Web Speech ổn định → dùng thẳng fallback | — |

Khuyến nghị UX: hiển thị transcript **realtime khi đang nói** (interim results) để user yên tâm máy đang nghe đúng; giữ file audio tạm vài phút để retry nếu STT lỗi.

---

## 8. Cấu trúc monorepo đề xuất

```
todo-ai/
├── apps/
│   ├── mobile/          # Expo app (iOS + Android)
│   └── web/             # Next.js app
├── packages/
│   ├── core/            # Types, domain logic, date parsing helpers
│   ├── api/             # Supabase client, TanStack Query hooks
│   └── ai/              # Lớp AI model-agnostic: schemas (Zod), prompts,
│                        #   provider adapters, telemetry, eval harness
├── supabase/
│   ├── migrations/      # SQL migrations
│   └── functions/       # Edge Functions: chat-intent, transcribe
├── turbo.json
└── pnpm-workspace.yaml
```

Công cụ đi kèm: TypeScript strict, Zod (validate AI output — **bắt buộc**, không tin JSON từ LLM một cách mù quáng), ESLint + Prettier, Vitest cho packages, Maestro cho E2E mobile, Playwright cho web.

---

## 9. Lộ trình triển khai đề xuất (MVP ~8–10 tuần)

| Tuần | Mục tiêu |
|---|---|
| 1 | Dựng monorepo, Supabase project, schema + RLS, auth (Apple/Google/email) |
| 2–3 | Dựng `packages/ai` (lớp trừu tượng provider + Zod schemas + telemetry); Edge Function `chat-intent` (agent loop + bộ tools CRUD draft) + prompt engineering; **eval harness** chạy được đa model với ~50 câu đơn và ~20 kịch bản hội thoại nhiều lượt (tạo → sửa → thêm sub-task → xoá) tiếng Việt/Anh |
| 3–4 | Mobile: màn Capture hội thoại (text trước, voice sau) → Live Preview cards có highlight diff → Save; Inbox + Today |
| 5 | Voice input mobile (expo-speech-recognition), luồng offline capture |
| 6 | Web app: Capture + Inbox + Today (tái dùng packages), Web Speech API |
| 7 | Sync đa thiết bị (Realtime), polish UX preview/edit |
| 8 | Beta nội bộ (TestFlight + Vercel preview), đo chất lượng AI, sửa prompt |
| 9–10 | Fix, onboarding, submit App Store / Play Store |

**Thứ tự làm tính năng quan trọng hơn thứ tự màn hình:** làm "bộ não" AI (tuần 2–3) trước UI phức tạp — đây là rủi ro lớn nhất và cũng là giá trị khác biệt duy nhất của sản phẩm so với todo app thường.

---

## 10. Rủi ro chính & cách giảm thiểu

| Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|
| AI bóc tách sai (đặc biệt ngày giờ tiếng Việt: "chiều mai", "tối thứ 6") | Cao | Bộ test câu mẫu chạy tự động khi sửa prompt; màn Preview bắt buộc (human-in-the-loop đã có trong spec); truyền timezone + now vào prompt |
| AI phân giải sai tham chiếu trong hội thoại (sửa nhầm task, tạo mới thay vì sửa) | Cao | Inject danh sách draft (id + title) vào mỗi turn; quy tắc "không chắc thì `ask_clarification`"; bộ test kịch bản nhiều lượt; mọi thay đổi highlight diff trên Live Preview để user phát hiện ngay; undo theo turn |
| STT tiếng Việt kém trong môi trường ồn | Trung | Interim transcript để user thấy và sửa ngay; fallback Whisper; cho phép sửa text trước khi gửi AI |
| Chi phí AI tăng khi scale | Trung | Prompt caching, dùng Haiku cho tác vụ nhẹ, rate limit theo user, hard cap/tháng |
| Mất dữ liệu capture khi mất mạng | Cao (uy tín) | Offline-first ghi local trước, sync sau — thiết kế từ ngày đầu |
| Widget/Siri cần native code | Thấp (Giai đoạn 2) | Expo Modules API + config plugins; đã chọn RN/Expo nên có đường đi sẵn |
| Lock-in Supabase | Thấp | Postgres chuẩn + SQL migrations trong repo → di chuyển được nếu cần |
| Lock-in một AI provider / model bị deprecate | Thấp (nhờ thiết kế) | Lớp AI model-agnostic (mục 6): đổi model qua config, tool schemas bằng Zod dùng chung, eval harness xác nhận chất lượng trước khi chuyển |

---

## 11. Việc cần quyết định trước khi code

1. **Tên sản phẩm + bundle ID** (cần cho Apple Developer / Play Console — đăng ký sớm vì duyệt lâu).
2. **Ngôn ngữ ưu tiên:** ✅ **ĐÃ CHỐT — English-first.** UI copy mặc định tiếng Anh; STT mặc định `en-US` (theo locale máy chuyển `vi-VN`); prompt và eval lấy tiếng Anh làm nhóm chính, tiếng Việt là ngôn ngữ hỗ trợ thứ hai (AI vẫn xử lý tốt input Việt/trộn — giữ nguyên ngôn ngữ gốc trong title).
3. **Auth providers:** Apple Sign-In là bắt buộc trên iOS nếu có social login khác.
4. **Ngân sách AI/tháng** cho giai đoạn beta để đặt rate limit hợp lý.
5. Mobile ra trước hay mobile + web song song? (Khuyến nghị: mobile trước 2 tuần, web theo sau khi packages đã ổn định.)
