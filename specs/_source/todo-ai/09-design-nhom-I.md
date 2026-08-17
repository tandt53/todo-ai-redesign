# Thiết kế — Nhóm I (UC-41…51)

> Bước giữa **spec** ([02-use-cases.md](02-use-cases.md)) và **code**. Use case trả lời *cái gì / vì sao*;
> file này trả lời *thế nào*, cho những thứ **xuyên nhiều UC** mà không UC nào sở hữu riêng.
>
> **Ranh giới với UC:** thiết kế chỉ phục vụ một UC (ví dụ schema bảng `lists` của UC-41) nằm lại trong UC đó —
> nó là một phần của tiêu chí nghiệm thu. File này chỉ chứa thứ mà **nhiều UC cùng phụ thuộc**; nếu để trong một
> UC thì các UC còn lại phải trỏ chéo sang, và chỗ nào cũng có thể lệch.
>
> Kiến trúc hệ thống (tầng, ADR, mô hình dữ liệu hiện có): [01-architecture.md](01-architecture.md).

## 0. Bốn thứ đang chặn Đợt 1

| # | Thiếu | Chặn UC |
|---|---|---|
| 1 | Mô hình điều hướng biểu diễn được đích **có tham số** | UC-41 (một list), UC-42 (Upcoming), tags |
| 2 | API parser ngày giờ — chữ ký, kiểu trả về, ranh giới trách nhiệm | UC-46 |
| 3 | Màn chi tiết task — **chưa tồn tại ở cả hai app** | UC-44, UC-49 |
| 4 | Chiến lược test — 118 dòng edge case chạy ở tầng nào | Tất cả |

---

## 1. Mô hình điều hướng

### Vấn đề

Hiện tại điều hướng là một union chuỗi cứng, giống hệt ở hai app:

```ts
export type View_ = "inbox" | "today" | "snoozed" | "trash";   // apps/mobile/src/Drawer.tsx
```

Thêm `"upcoming"` thì được. Nhưng **một list cụ thể** hay **một tag cụ thể** thì không — chúng cần tham số. Đây là
lý do UC-41 và UC-42 không thể bắt đầu trước khi đổi mô hình này.

### Thiết kế

`Destination` là kiểu **trong `packages/core`**, không phải trong app. Lý do: nó mô tả *một tập con của task*, đúng
miền của core (ADR-9); và đặt ở core thì cả hai app dùng chung một resolver, không thể lệch nhau.

```ts
// packages/core/src/destination.ts
export type Destination =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }          // UC-42
  | { kind: "snoozed" }
  | { kind: "trash" }
  | { kind: "tag"; name: string };
// `list` (UC-41) và `logbook` (UC-45) CHƯA có trong union: thêm một kind trước khi
// có selector của nó thì `tasksForDestination` buộc phải trả `[]`, và màn hình rỗng
// đó trông như "bạn không có việc gì" chứ không phải "chưa làm xong".

/** Task thuộc về một đích. Một hàm, hai app, mọi đích — test được ở core. */
export function tasksForDestination(
  list: LocalTask[],
  dest: Destination,
  now: string,
): LocalTask[];

/** Đích có nhận task mới không. Đích không nhận thì app ẩn thanh nhập. */
export function acceptsInput(dest: Destination): boolean;

/** Task tạo ở đích này thì mang status/list nào — quyết định của core, không phải của UI. */
export function defaultsForDestination(dest: Destination): Partial<NewTaskInput>;
```

`defaultsForDestination` thay cho đoạn `view === "today" ? "today" : "inbox"` đang **lặp ở bốn chỗ** trong hai app
(`TaskListScreen`, `TaskListView`, và hai chỗ gọi `store.capture` cho reply pill). Thêm đích mới mà quên một chỗ là
một lớp bug im lặng — gom về core thì compiler bắt được.

### Phần nào ở app

Tiêu đề, icon, và thứ tự trong drawer là **hình thức**, ở app:

```ts
// mỗi app tự map — core không biết chữ "Inbox" hay icon nào
const TITLE: Record<Destination["kind"], string>
```

Với `list` / `tag`, tiêu đề lấy từ dữ liệu (`list.name`, `#tag`), không từ bảng tĩnh.

### So sánh khoá đích

Drawer cần biết đích nào đang active. `Destination` là object nên `===` không dùng được:

```ts
export function destKey(d: Destination): string;   // "list:abc123" · "tag:work" · "inbox"
```

Dùng `destKey` cho cả so sánh active lẫn React `key`. **Không** dùng `JSON.stringify` — thứ tự khoá không đảm bảo.

---

## 2. Parser ngày giờ (UC-46)

### Tiền lệ đã có trong repo

`extractTags` là đúng hình dạng cần noi theo — nhận text, trả về **title đã sạch** + dữ liệu bóc ra:

```ts
export function extractTags(title: string): { title: string; tags: string[] };
```

Parser ngày đi theo cùng khuôn, cộng thêm một thứ `extractTags` không cần: **vị trí đã khớp**, vì AC-46.2 đòi gạch
chân đoạn đó ngay trong ô nhập.

### API

```ts
// packages/core/src/datetime.ts
export interface ParsedDateTime {
  /** Text sau khi cắt đoạn thời gian, khoảng trắng đã chuẩn hoá. Bằng input nếu không khớp gì. */
  title: string;
  /** ISO có offset, cùng offset với `now`. null = không hiểu được (AC-46.3). */
  dueAt: string | null;
  /** true khi người dùng nói NGÀY mà không nói giờ. Chỉ có nghĩa khi dueAt != null. */
  allDay: boolean;
  /** [start, end) tính trên chuỗi GỐC — để UI gạch chân. null khi không khớp. */
  match: [number, number] | null;
}

/**
 * Thuần: mọi thứ phụ thuộc thời gian đi qua `now`, không đọc đồng hồ bên trong (AC-46.1).
 * Không có tham số locale — người dùng trộn Việt/Anh trong một câu, nên nhận cả hai bộ từ vựng.
 */
export function parseDateTime(text: string, now: string): ParsedDateTime;
```

### Ranh giới trách nhiệm

| Việc | Ai làm |
|---|---|
| Nhận diện đoạn thời gian, quy đổi ra ISO | `parseDateTime` |
| Cắt đoạn đó khỏi tiêu đề | `parseDateTime` (trả `title` sạch) |
| Gạch chân trong ô nhập | UI, dùng `match` |
| Quyết định có tạo task không khi `title` rỗng | **Caller** — parser không biết luật sản phẩm |
| Gọi lúc nào (debounce) | UI |

### Hiệu năng & thời điểm gọi

Gọi **mỗi lần text đổi** nhưng phải rẻ: parser chạy trên chuỗi ngắn (< 200 ký tự), không regex thảm hoạ, không
cấp phát trong vòng lặp nóng. Không cần debounce nếu giữ được dưới ~1ms — **đo trước, tối ưu sau**.

`now` lấy tại **thời điểm gửi**, không phải lúc gõ (bảng edge case UC-46, ca "qua nửa đêm"). Nghĩa là UI gọi
parser hai lần: một lần lúc gõ để hiển thị, một lần lúc gửi để lấy giá trị thật. Hai lần cùng input trừ `now` —
hàm thuần nên không có tác dụng phụ.

### Cấu trúc nội bộ (gợi ý, không ràng buộc)

Tách hai tầng để test được từng phần: **tokenizer** (tìm ứng viên + vị trí) → **resolver** (ứng viên + `now` → ISO).
Ca từ chối như `"gọi 0905 123 456"` xử ở tokenizer (số điện thoại không phải ứng viên), ca `"31/2"` xử ở resolver
(ngày không tồn tại).

---

## 3. Màn chi tiết task (UC-44)

### Hiện trạng

**Không app nào có màn chi tiết.** UC-44 giả định "mở chi tiết → thấy note" nhưng chưa có màn, chưa có đường tới,
chưa có back. Đây là hạ tầng, không phải một field.

### Thiết kế: overlay theo state, không thêm thư viện

Mobile **chưa có** thư viện điều hướng (không react-navigation, không expo-router). Thêm vào là một dependency lớn
cho đúng một màn. Web cũng đang là một trang, không dùng App Router cho điều hướng nội bộ.

Nên: chi tiết là **một lớp phủ toàn màn theo state**, cùng mô hình ở hai app.

```ts
interface NavState {
  dest: Destination;
  /** Chi tiết đang mở chồng lên `dest`; back trả về đúng `dest` đó. */
  detailTaskId: string | null;
}
```

Chi tiết **không phải** một `Destination` — nó chồng lên, và đóng lại thì về đúng đích cũ. Trộn hai khái niệm sẽ
khiến "back từ chi tiết" phải đoán xem trước đó là đích nào.

### Ràng buộc theo nền tảng

| Nền tảng | Việc phải làm |
|---|---|
| Android | `BackHandler` — nút back khi đang mở chi tiết phải **đóng chi tiết**, không thoát app |
| iOS | Vuốt từ mép trái để đóng (hoặc nút ‹ Back rõ ràng nếu chưa làm gesture) |
| Web | Nút back của trình duyệt nên đóng chi tiết → đẩy một `history.pushState` khi mở |
| Cả hai | Task bị xoá/khôi phục trong lúc chi tiết đang mở → đóng chi tiết, không để tham chiếu treo (khớp bảng edge case UC-41) |

---

## 4. Chiến lược test

118 dòng edge case trong nhóm I là **test case**, nhưng không cùng một tầng. Phân tuyến:

| Tầng | Chạy gì | Ví dụ từ bảng edge case |
|---|---|---|
| **Unit — `packages/core`** (vitest, đã có 90 test) | Mọi thứ là hàm thuần | Toàn bộ 16 ca UC-46; nhóm ngày UC-42; fractional order UC-43; nhóm theo `completedAt` UC-45; parse import UC-48 |
| **Unit — app** | Logic có state nhưng không cần render | drain spool UC-47 (idempotent); khớp tên list → id UC-41 |
| **Manual checklist** ([05-test-plan.md](05-test-plan.md) §4) | Hành vi UI và OS | placeholder rỗng vs `null` (UC-44); back Android; quyền camera bị từ chối (UC-51) |
| **E2E (chưa có)** | Luồng xuyên màn | Chưa dựng — không chặn Đợt 1 |

**Luật:** mỗi dòng trong bảng edge case phải map được vào đúng một tầng. Dòng nào không map được nghĩa là nó chưa
phải một hành vi kiểm chứng được — sửa dòng đó, đừng bỏ qua.

**Ưu tiên Đợt 1:** UC-46 gánh phần lớn rủi ro và **toàn bộ** nằm ở tầng unit của core. AC-46.5 đòi corpus ≥ 40 ca;
đặt ở `packages/core/test/datetime.test.ts` dạng bảng (input · now · kết quả mong đợi) để thêm ca mới là thêm một dòng.

---

## 5. Thứ tự hiện thực Đợt 1

Phụ thuộc thật giữa ba UC:

```
1. Destination + tasksForDestination        ← không chặn bởi gì; UC-42 đứng trên nó     ✅
2. parseDateTime + corpus                   ← độc lập hoàn toàn, chạy song song được với (1) ✅
3. UC-42 Upcoming (dùng 1)                                                              ✅
4. Màn chi tiết (overlay + back)            ← hạ tầng cho (5)                           ✅
5. UC-44 note (dùng 4)                                                                  ✅
```

**Đợt 1 đã xong.** Năm thứ phát sinh trong lúc làm, đáng ghi lại:

| Phát sinh | Xử lý |
|---|---|
| "Ngày" được định nghĩa ở hai nơi — `isTaskOverdue` trong `tasks.ts` và cách nhóm của UC-42 | Gom về một: thêm `dueDay()` ngay cạnh `isTaskOverdue`, `groupUpcoming` gọi lại chứ không tự tính |
| App tự có `isOverdue(iso)` **không biết `allDay`**, nên việc cả-ngày của hôm nay bị tô đỏ từ 00:01 trong khi core nói nó chưa trễ | Xoá bản của app, cả hai app dùng `isTaskOverdue` của core |
| `formatDue` hiện giờ cho cả task `allDay` — bịa ra thông tin user chưa nói, đúng thứ `allDay` sinh ra để tránh | `formatDue(iso, allDay)`; nhánh `allDay` chỉ trả ngày |
| **Mất chữ**: gõ note rồi bấm Back thì component unmount trước khi `onBlur` kịp chạy, note không được ghi. Quan sát trên simulator: gõ → Back → storage vẫn `null` | Commit thêm ở cleanup của effect, qua ref để thấy được text mới nhất. Đã chạy lại đúng kịch bản đó để xác nhận |
| `parseDateTime` viết xong ở đợt trước nhưng **không ai gọi**, nên lỗ hổng ADR-7 vẫn nguyên | Nối vào `useTasks.send`; thêm `localIso` ở core vì app đang truyền `toISOString()` (UTC) — parser đọc offset của `now` nên "mai 5h" sẽ rơi vào nửa đêm giờ địa phương |

Suite của core nhóm ngày theo múi giờ **máy chạy** (đúng như production), nên `packages/core/test/setup.ts`
ghim `TZ=Asia/Ho_Chi_Minh` — nếu không, cùng một fixture rơi vào hai ngày khác nhau giữa laptop ở Hà Nội và CI ở UTC.

(1) và (2) không đụng nhau — một cái ở `destination.ts`, một cái ở `datetime.ts`. Đây là chỗ **duy nhất** trong
Đợt 1 song song hoá được thật sự.

---

## 6. Quyết định không hiển nhiên

**Vì sao `Destination` ở `core` mà không ở app?** Nó mô tả tập con của task — đúng miền core (ADR-9). Đặt ở app thì
hai app có hai định nghĩa, và `tasksForDestination` phải viết hai lần. Core **không** biết tiêu đề hay icon; đó mới
là phần thuộc về app.

**Vì sao không thêm thư viện điều hướng?** Đúng một màn chồng lên. `NavState` với `detailTaskId` giải được, không
thêm dependency, không đổi cấu trúc app. Khi nào có màn thứ ba/thứ tư đẩy chồng lên nhau thì hẵng bàn lại — đó là
lúc thư viện trả được giá của nó.

**Vì sao `parseDateTime` không nhận `locale`?** Người dùng trộn Việt–Anh trong cùng một câu ("meeting mai 3h").
Bắt caller chọn ngôn ngữ là ép nó đoán, mà đoán sai thì parser mù một nửa từ vựng. Nhận cả hai bộ rẻ hơn nhiều so
với việc đoán đúng.

**Vì sao gọi parser hai lần (gõ + gửi)?** Vì `now` đổi. Hàm thuần nên gọi lại không tốn gì ngoài vài chục
micro giây, và nó loại hẳn một lớp bug qua nửa đêm mà nếu cache lại sẽ rất khó tái hiện.
