// Web capture: drives the REAL running client through four e2e flows.
// Labels below are the deck's (Vietnamese, for the reader); everything the app
// renders is English since ADR-008.
import { chromium } from 'playwright'
import fs from 'node:fs'
const OUT='/private/tmp/claude-501/-Users-tandt-projects-claude-agents-final/f9fbad18-4846-4fd8-8c55-987b4ad29157/scratchpad/shots'
const WEB='http://localhost:5173'
const RUN=Date.now().toString(36)   // per-run namespace: a shared user id fed one run the previous run's tasks
const man=[]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:1180,height:900},deviceScaleFactor:2,colorScheme:'dark'})
const pg=await ctx.newPage()
const snap=async(id,flow,label,note)=>{
  await pg.waitForTimeout(280)
  // the pane does not auto-scroll (BUG-004) — without this every shot frames the top
  await pg.evaluate(()=>{const b=document.querySelector('[data-testid=assistant-message-bubble]');let e=b&&b.parentElement
    while(e&&e.scrollHeight<=e.clientHeight+4) e=e.parentElement; if(e) e.scrollTop=e.scrollHeight})
  await pg.waitForTimeout(160)
  await pg.screenshot({path:`${OUT}/${id}.png`}); man.push({id,flow,label,note:note||'',surface:'web'}); console.log('  ✓',id,label)
}
const send=async t=>{ await pg.getByTestId('assistant-composer-input').fill(t); await pg.getByTestId('assistant-composer-send').click() }
const addTask=async t=>{ await pg.getByTestId('assistant-add-task-button').click()
  await pg.getByLabel(/new task name|tên việc mới/i).fill(t); await pg.keyboard.press('Enter'); await pg.waitForTimeout(160) }

await pg.goto(`${WEB}/?qaUser=shot-${RUN}`); await pg.waitForTimeout(800)
await snap('W-A0','A · Tạo việc','Màn hình mở đầu','Danh sách rỗng — lời mời nói câu đầu tiên')
for(const t of ['Buy milk','Buy eggs','Buy bread','Report Q1','Report Q2','Team meeting']) await addTask(t)
await snap('W-A0b','A · Tạo việc','Đã có danh sách','Thêm bằng tay — giọng nói không phải cách duy nhất')
await send('add a task to call mom tomorrow'); await pg.waitForTimeout(140)
await snap('W-A1','A · Tạo việc','Đang xử lý','Trạng thái thinking')
await pg.waitForTimeout(950); await snap('W-A2','A · Tạo việc','Đã thêm việc','Bong bóng kết quả kèm nút hoàn tác')

await send('delete the shopping tasks'); await pg.waitForTimeout(1000)
await snap('W-B1','B · Xoá nhiều việc','Hỏi xác nhận','3 việc khớp — app hỏi trước khi xoá')
await send('yes'); await pg.waitForTimeout(1000)
await snap('W-B2','B · Xoá nhiều việc','Đã xoá','Kết quả sau khi đồng ý')
const u=pg.getByTestId('assistant-undo-button').first()
if(await u.count()){ await u.click(); await pg.waitForTimeout(1000); await snap('W-B3','B · Xoá nhiều việc','Đã hoàn tác','Bấm nút hoàn tác trên bong bóng') }

await send('delete the report task'); await pg.waitForTimeout(1000)
await snap('W-C1','C · Làm rõ','Hỏi chọn việc nào','2 việc cùng khớp — app hỏi lại thay vì đoán')

await send('cross off badminton'); await pg.waitForTimeout(1000)
await snap('W-D1','D · Không hiểu / lỗi','Không tìm thấy việc','App đọc lại câu đã nghe để phân biệt nghe nhầm với việc không tồn tại')
await send("what's on sunday"); await pg.waitForTimeout(1000)
await snap('W-D2','D · Không hiểu / lỗi','Câu hỏi ngoài phạm vi','App chỉ sang danh sách và bộ lọc trên màn hình')
await send('cause an ai error'); await pg.waitForTimeout(1200)
await snap('W-D2b','D · Không hiểu / lỗi','Lỗi từ máy chủ','Có nút thử lại; câu vừa gửi không mất')
await ctx.setOffline(true); await send('add a task to buy cheese'); await pg.waitForTimeout(950)
await snap('W-D3','D · Không hiểu / lỗi','Mất mạng','Màn hình vẫn dùng được, câu vừa gửi xếp hàng chờ')
await ctx.setOffline(false); await pg.waitForTimeout(1500)
await snap('W-D4','D · Không hiểu / lỗi','Có mạng trở lại','Việc xếp hàng được gửi đi')
await b.close()
fs.writeFileSync(OUT+'/manifest-web.json',JSON.stringify(man,null,1))
console.log('\nweb shots:',man.length)
