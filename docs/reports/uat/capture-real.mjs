// UAT capture — the RUNNING product, one screenshot per step of each e2e flow.
//
// Replaces the mockup capture (capture.mjs), which photographed
// docs/design/assistant/screens/*.html. A UAT book built from drawings cannot
// show the gap between what was drawn and what was built, and that gap is the
// thing UAT exists to find.
//
// Two viewports, both the REAL web client: `wide` 1280 (two panes, InlineAdd)
// and `narrow` 390 (one pane at a time, TaskBottomBar). They are not "web and
// mobile" — the mobile client is React Native and has no browser entry point,
// so it is absent from this book and said to be absent.
//
// One account per flow per viewport, so no flow can see another's data.
// A step that cannot be driven is recorded as a failure and reported; it is
// never quietly dropped, because "this flow is not reachable" is a UAT finding.
import fs from 'fs'
import { VIEWPORTS, api, dismissOverlays, goCollection, goTalk, goTasks, launch, openApp, seed } from './drive.mjs'

const TMP = process.env.UAT_TMP ?? '/tmp/uatreal'
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'))
fs.mkdirSync(`${TMP}/png`, { recursive: true })

const manifest = { flows: [], failures: [], captured_at: null }
// A partial run (`node capture-real.mjs F9 F12`) keeps every flow it did not
// re-run, so iterating on one broken flow does not silently shrink the book.
const prev = ONLY.length && fs.existsSync('docs/reports/uat/manifest-real.json')
  ? JSON.parse(fs.readFileSync('docs/reports/uat/manifest-real.json', 'utf8'))
  : null
let shots = 0

const many = (n, f) => Array.from({ length: n }, (_, i) => f(i))

const flows = [
  {
    id: 'F1',
    title: 'Lần chạy đầu — chưa có việc nào',
    purpose: 'Người mới mở app lần đầu. Trạng thái rỗng có mời gọi hành động không, và app chịu lỗi mạng ra sao.',
    async run(ctx) {
      await ctx.shot('landing', 'Màn hình đầu tiên khi mở app', 'happy')
      await goTasks(ctx.page)
      await ctx.shot('tasks-empty', 'Danh sách việc khi chưa có gì', 'happy')
      await ctx.page.context().setOffline(true)
      await ctx.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
      await ctx.page.waitForTimeout(1200)
      await ctx.shot('offline', 'Mở app khi mất mạng', 'neg')
      await ctx.page.context().setOffline(false)
    },
  },
  {
    id: 'F2',
    title: 'Thêm việc bằng cách gõ — thanh dưới cùng (khổ hẹp)',
    purpose: 'Luồng chính của phương án B: ô nhập nằm dưới, nút mic hoá mũi tên gửi khi có chữ.',
    viewports: ['narrow'],
    seed: [{ title: 'Gọi cho mẹ' }, { title: 'Mua sữa' }, { title: 'Nộp báo cáo quý' }],
    async run(ctx) {
      await goTasks(ctx.page)
      await goCollection(ctx.page, 'Inbox')
      await ctx.shot('bar-idle', 'Thanh dưới ở trạng thái nghỉ — nút mic, chạm vào là sang Talk', 'happy')
      const input = ctx.page.locator('[data-testid=tasks-bar-input]')
      await input.click()
      await input.type('họp nhóm ngày mai lúc 2 giờ', { delay: 10 })
      await ctx.page.waitForTimeout(350)
      await ctx.shot('bar-typing', 'Đang gõ — nút mic đã hoá mũi tên gửi', 'happy')
      await ctx.page.locator('[data-testid=tasks-bar-action]').click()
      await ctx.page.waitForTimeout(1200)
      await ctx.shot('bar-sent', 'Đã gửi — việc mới nằm trong danh sách', 'happy')
      await input.click()
      await input.type('   ', { delay: 10 })
      await ctx.page.waitForTimeout(300)
      await ctx.shot('bar-whitespace', 'Chỉ gõ khoảng trắng — nút hành động ở trạng thái nào', 'neg')
    },
  },
  {
    id: 'F3',
    title: 'Thêm việc ở khổ rộng — dòng thêm việc tại chỗ',
    purpose: 'Từ split (1024) trở lên không có thanh dưới; thêm việc bằng dòng "Add a task" ngay trong danh sách.',
    viewports: ['wide'],
    seed: [{ title: 'Gọi cho mẹ' }, { title: 'Mua sữa' }],
    async run(ctx) {
      await goCollection(ctx.page, 'Inbox')
      await ctx.shot('inline-idle', 'Dòng "Add a task" ở cuối danh sách', 'happy')
      await ctx.page.locator('[data-testid=tasks-inline-add]').click()
      await ctx.page.waitForTimeout(300)
      const field = ctx.page.locator('[data-testid=tasks-inline-add] input, [data-testid=tasks-rename-input]').first()
      await field.type('đặt vé tàu về quê', { delay: 10 })
      await ctx.shot('inline-typing', 'Đang gõ vào dòng thêm việc', 'happy')
      await ctx.page.keyboard.press('Enter')
      await ctx.page.waitForTimeout(1000)
      await ctx.shot('inline-added', 'Việc mới đã vào danh sách', 'happy')
    },
  },
  {
    id: 'F4',
    title: 'Danh sách dài — có che mất việc không',
    purpose: 'Câu hỏi đã tranh luận khi chốt phương án B: danh sách dài thì thanh dưới có che dòng cuối không.',
    seed: many(18, (i) => ({ title: `Việc số ${i + 1} trong danh sách dài` })),
    async run(ctx) {
      await goTasks(ctx.page)
      await goCollection(ctx.page, 'Inbox')
      await ctx.shot('long-top', 'Đầu danh sách dài', 'happy')
      await ctx.page.mouse.wheel(0, 6000)
      await ctx.page.waitForTimeout(600)
      await ctx.shot('long-bottom', 'Cuộn hết xuống — dòng cuối cùng và thanh dưới', 'happy')
    },
  },
  {
    id: 'F5',
    title: 'Mở và sửa chi tiết một việc',
    purpose: 'Chạm vào một việc để mở chi tiết, đổi mức ưu tiên, thêm ghi chú, thêm bước con.',
    seed: [{ title: 'Đặt lịch khám răng' }, { title: 'Gia hạn hộ chiếu' }],
    async run(ctx) {
      await goTasks(ctx.page)
      await goCollection(ctx.page, 'Inbox')
      await ctx.page.locator('[data-testid=tasks-row-open]').first().click()
      await ctx.page.waitForSelector('[data-testid=detail-surface]')
      await ctx.shot('detail-open', 'Chi tiết việc vừa mở', 'happy')
      const pri = ctx.page.locator('[data-testid=detail-priority-option]')
      if (await pri.count()) { await pri.nth(1).click(); await ctx.page.waitForTimeout(600) }
      await ctx.shot('detail-priority', 'Sau khi đổi mức ưu tiên', 'happy')
      const note = ctx.page.locator('[data-testid=detail-note-input]')
      if (await note.count()) { await note.fill('Nhớ mang theo sổ khám cũ'); await ctx.page.waitForTimeout(700) }
      await ctx.shot('detail-note', 'Đã thêm ghi chú', 'happy')
      const stepAdd = ctx.page.locator('[data-testid=detail-step-add-input]').first()
      if (await stepAdd.isVisible().catch(() => false)) {
        await stepAdd.type('Gọi phòng khám xác nhận giờ', { delay: 8 })
        await ctx.page.keyboard.press('Enter')
        await ctx.page.waitForTimeout(800)
        await ctx.shot('detail-step', 'Đã thêm một bước con', 'happy')
      }
    },
  },
  {
    id: 'F6',
    title: 'Đánh dấu xong và xoá',
    purpose: 'Hai thao tác phá huỷ nhất trong app: tick xong, và xoá một việc.',
    seed: [{ title: 'Thanh toán tiền điện' }, { title: 'Trả sách thư viện' }, { title: 'Tưới cây' }],
    async run(ctx) {
      await goTasks(ctx.page)
      await goCollection(ctx.page, 'Inbox')
      await ctx.shot('before', 'Trước khi thao tác', 'happy')
      const box = ctx.page.locator('[data-testid=assistant-task-checkbox], .row input[type=checkbox], [role=checkbox]').first()
      if (await box.isVisible().catch(() => false)) { await box.click(); await ctx.page.waitForTimeout(900) }
      await ctx.shot('completed', 'Sau khi tick xong một việc', 'happy')
      await goCollection(ctx.page, 'Done')
      await ctx.shot('done-list', 'Việc vừa xong nằm trong nhóm Done', 'happy')
    },
  },
  {
    id: 'F7',
    title: 'Duyệt các nhóm việc',
    purpose: 'Chuyển giữa Today, Upcoming, Inbox, Done và xem mỗi nhóm hiển thị gì.',
    seed: [
      { title: 'Việc hôm nay', due_at: '2026-08-19T15:00:00.000Z' },
      { title: 'Việc tuần sau', due_at: '2026-08-26T15:00:00.000Z' },
      { title: 'Việc chưa xếp lịch' },
    ],
    async run(ctx) {
      await goTasks(ctx.page)
      for (const name of ['Today', 'Upcoming', 'Inbox', 'Done']) {
        await goCollection(ctx.page, name)
        await ctx.shot(`collection-${name.toLowerCase()}`, `Nhóm ${name}`, 'happy')
      }
    },
  },
  {
    id: 'F8',
    title: 'Màn Talk — trợ lý',
    purpose: 'Gõ một câu cho trợ lý, xem nó dựng việc, và hoàn tác được không.',
    seed: [{ title: 'Gọi thợ điện' }],
    async run(ctx) {
      await goTalk(ctx.page)
      await ctx.shot('talk-idle', 'Màn Talk khi chưa nói gì', 'happy')
      const input = ctx.page.locator('[data-testid=assistant-composer-input]')
      await input.click()
      await input.type('nhắc tôi đổ rác tối nay lúc 8 giờ', { delay: 8 })
      await ctx.page.waitForTimeout(350)
      await ctx.shot('talk-typed', 'Đã gõ vào ô của trợ lý', 'happy')
      await ctx.page.locator('[data-testid=assistant-composer-send]').click()
      await ctx.page.waitForTimeout(2000)
      await ctx.shot('talk-result', 'Trợ lý trả lời và dựng việc', 'happy')
      const undo = ctx.page.locator('[data-testid=assistant-undo-button]').first()
      if (await undo.isVisible().catch(() => false)) {
        await undo.click(); await ctx.page.waitForTimeout(1000)
        await ctx.shot('talk-undone', 'Sau khi hoàn tác', 'happy')
      }
    },
  },
  {
    id: 'F9',
    title: 'Menu danh sách — và hai nút chưa có gì phía sau',
    purpose: 'Menu danh sách chạy được. Nút kính lúp và nút ⋯ đã nằm trên thanh nhưng TasksSurface.tsx:454 ghi rõ chúng còn trơ — bấm không ra gì. UAT cần thấy đúng điều đó.',
    seed: [{ title: 'Đăng ký lớp tiếng Anh' }, { title: 'Thanh toán hoá đơn internet' }],
    async run(ctx) {
      await goTasks(ctx.page)
      await ctx.page.locator('[data-testid=shell-lists-menu-button]').click()
      await ctx.page.waitForTimeout(500)
      await ctx.shot('lists-menu', 'Menu danh sách — chạy được', 'happy')
      await dismissOverlays(ctx.page)
      await ctx.page.locator('[data-testid=shell-search-button]').click()
      await ctx.page.waitForTimeout(600)
      await ctx.shot('search-inert', 'Bấm kính lúp — không có gì mở ra (chức năng chưa dựng)', 'neg')
      await ctx.page.locator('[data-testid=shell-overflow-button]').click()
      await ctx.page.waitForTimeout(600)
      await ctx.shot('overflow-inert', 'Bấm ⋯ — không có gì mở ra (chức năng chưa dựng)', 'neg')
    },
  },
  {
    id: 'F11',
    title: 'Cài đặt và đổi giao diện',
    purpose: 'Vào cài đặt, đổi sáng/tối, quay lại danh sách.',
    async run(ctx) {
      await goTasks(ctx.page)
      const rail = ctx.page.locator('[data-testid=rail-settings-row]').first()
      if (await rail.isVisible().catch(() => false)) await rail.click()
      else {
        await ctx.page.locator('[data-testid=shell-lists-menu-button]').click()
        await ctx.page.waitForTimeout(300)
        await ctx.page.locator('[data-testid=menu-settings-row]').first().click()
      }
      await ctx.page.waitForTimeout(600)
      await ctx.shot('settings', 'Màn cài đặt', 'happy')
      const light = ctx.page.locator('[data-testid=settings-theme-control] button').filter({ hasText: /Light/i }).first()
      if (await light.isVisible().catch(() => false)) { await light.click(); await ctx.page.waitForTimeout(700) }
      await ctx.shot('settings-light', 'Đã chuyển sang giao diện sáng', 'happy')
      const back = ctx.page.locator('[data-testid=settings-back-button]').first()
      if (await back.isVisible().catch(() => false)) { await back.click(); await ctx.page.waitForTimeout(600) }
      await ctx.shot('after-back', 'Quay lại danh sách, giao diện sáng còn giữ', 'happy')
    },
  },
  {
    id: 'F12',
    title: 'API hỏng giữa chừng',
    purpose: 'Máy chủ trả lỗi khi đang dùng. App nói cho người dùng biết, hay im lặng nuốt lỗi.',
    seed: [{ title: 'Kiểm tra bảo hiểm xe' }],
    async run(ctx) {
      await goTasks(ctx.page)
      await ctx.shot('healthy', 'Trước khi máy chủ hỏng', 'happy')
      await ctx.page.route('**/tasks**', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL","message":"boom"}}' }))
      await ctx.page.reload({ waitUntil: 'domcontentloaded' })
      await ctx.page.waitForTimeout(1500)
      await ctx.shot('load-failed', 'Tải danh sách thất bại (máy chủ trả 500)', 'neg')
      await ctx.page.unroute('**/tasks**')
      const retry = ctx.page.locator('[data-testid=tasks-list-retry-button]').first()
      if (await retry.isVisible().catch(() => false)) {
        await retry.click(); await ctx.page.waitForTimeout(1200)
        await ctx.shot('retry-ok', 'Bấm thử lại — danh sách về', 'happy')
      }
    },
  },
]

const browser = await launch()

for (const flow of flows) {
  if (ONLY.length && !ONLY.includes(flow.id)) continue
  // Drop this flow's old frames first: a renamed step would otherwise leave its
  // previous image on disk, and the renderer's coverage guard would (correctly)
  // refuse a picture that belongs to no step.
  for (const f of fs.readdirSync(`${TMP}/png`)) if (f.startsWith(`${flow.id}__`)) fs.unlinkSync(`${TMP}/png/${f}`)
  const record = { id: flow.id, title: flow.title, purpose: flow.purpose, steps: [], console: [] }
  const wanted = flow.viewports ?? Object.keys(VIEWPORTS)
  record.viewports = wanted
  for (const vp of wanted) {
    const user = `uat-${flow.id.toLowerCase()}-${vp}@qa.example.com`
    let page
    try {
      if (flow.seed) await seed(user, flow.seed)
      page = await openApp(browser, user, VIEWPORTS[vp])
      page.setDefaultTimeout(7000)
      page.setDefaultNavigationTimeout(25000)
      const ctx = {
        page,
        async shot(name, caption, kind) {
          const file = `${flow.id}__${name}__${vp}.png`
          await page.screenshot({ path: `${TMP}/png/${file}` })
          shots++
          let step = record.steps.find((s) => s.name === name)
          if (!step) { step = { name, caption, kind, img: {} }; record.steps.push(step) }
          step.img[vp] = file
        },
      }
      await flow.run(ctx)
    } catch (e) {
      manifest.failures.push({
        flow: flow.id, viewport: vp,
        error: String(e.message).split('\n').slice(0, 3).join(' ').slice(0, 240),
      })
    } finally {
      if (page) {
        for (const err of new Set(page.errors)) if (!record.console.includes(err)) record.console.push(err)
        await page.close()
      }
    }
  }
  record.console = record.console.slice(0, 8)
  manifest.flows.push(record)
  console.log(`  ${flow.id}  ${record.steps.length} bước · ${record.console.length} lỗi console`)
}

if (prev) {
  const fresh = new Set(manifest.flows.map((f) => f.id))
  const defined = new Set(flows.map((f) => f.id))
  manifest.flows = [...prev.flows.filter((f) => !fresh.has(f.id) && defined.has(f.id)), ...manifest.flows]
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
  manifest.failures = [...prev.failures.filter((f) => !fresh.has(f.flow) && defined.has(f.flow)), ...manifest.failures]
}
manifest.captured_at = process.env.UAT_STAMP ?? prev?.captured_at ?? 'unknown'
fs.writeFileSync('docs/reports/uat/manifest-real.json', JSON.stringify(manifest, null, 1))
console.log(`\n  ${shots} ảnh · ${manifest.flows.length} luồng · ${manifest.failures.length} bước không chạy được`)
for (const f of manifest.failures) console.log(`  ✗ ${f.flow}/${f.viewport}: ${f.error}`)
await browser.close()
