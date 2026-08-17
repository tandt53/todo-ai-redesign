import { chromium, devices } from 'playwright'
import fs from 'node:fs'
// Every run gets its own user id. Without this the prototype server keeps the
// previous run's tasks under the same id and the shots show contaminated state
// (a duplicated 'Buy milk' that looks like an app bug and is not).
const RUN=Date.now().toString(36)
const OUT='/private/tmp/claude-501/-Users-tandt-projects-claude-agents-final/f9fbad18-4846-4fd8-8c55-987b4ad29157/scratchpad/shots'
const H='http://localhost:5199'
const man=[]
const PLATS=[['ios',devices['iPhone 14 Pro'],'iOS'],['android',devices['Pixel 7'],'Android']]
let seed=0
const b=await chromium.launch()

for(const [plat,dev,tag] of PLATS){
  const ctx=await b.newContext({...dev,colorScheme:'dark'})
  const open=async(extra='')=>{
    const p=await ctx.newPage()
    p.on('pageerror',e=>console.log('   PAGEERROR',e.message.slice(0,140)))
    await p.goto(`${H}/?platform=${plat}&user=shot-${RUN}-${plat}-${++seed}${extra}`)
    await p.waitForFunction(()=>window.isReady===true,{timeout:15000})
    await p.evaluate(()=>{ window.__uid = new URLSearchParams(location.search).get('user') })
    await p.waitForTimeout(320)
    return p
  }
  const shot=async(p,st,label)=>{
    await p.waitForTimeout(300)
    // The conversation is a ScrollView; without this every shot frames the TOP
    // and the message the shot is about is off-screen. (Same bug the web run had.)
    await p.evaluate(()=>{
      let best=null
      for(const el of document.querySelectorAll('div')){
        if(el.scrollHeight>el.clientHeight+8 && (!best||el.scrollHeight>best.scrollHeight)) best=el
      }
      if(best) best.scrollTop=best.scrollHeight
    })
    await p.waitForTimeout(180)
    const id=`R-${plat}-${st}`
    await p.screenshot({path:`${OUT}/${id}.png`})
    man.push({id,flow:`Mobile · ${tag}`,label,note:'',surface:'mobile'})
    console.log('  ✓',id,label)
  }
  const drive=(p,fn)=>p.evaluate(fn)

  // 1 cold open, empty
  let p=await open()
  await shot(p,'idle-empty','Mở lần đầu — chưa có việc')

  // 2 listening (real recognizer double, real controller)
  await drive(p,()=>{ window.surface.tapMic() })
  await shot(p,'listening','Đang nghe')
  await drive(p,()=>{ window.surface.hearWords('họp nhóm ngày mai') })
  await shot(p,'listening-words','Đang nghe — chữ hiện dần')

  // 3 thinking + applied (real API through the vite proxy)
  await drive(p,()=>{ window.surface.endSpeech('cancelled'); window.surface.setComposerText('add a task to buy milk'); window.surface.submit('typed') })
  await shot(p,'thinking','Đang xử lý')
  await p.waitForTimeout(900)
  await shot(p,'applied-diff','Đã thêm việc — kèm nút hoàn tác')

  // 4 seed the list, then bulk delete -> confirm.
  // 'delete the shopping tasks' targets Buy milk/eggs/bread, so all three must
  // exist or it matches one and applies straight away with no question asked.
  await drive(p,async()=>{
    const uid=window.surface.controller.api?.userId ?? document.title
    for(const title of ['Buy eggs','Buy bread','Report Q1','Report Q2','Team meeting']){
      await fetch('/tasks',{method:'POST',headers:{'Content-Type':'application/json','X-User-Id':window.__uid},body:JSON.stringify({title})})
    }
  })
  await drive(p,()=>window.surface.foreground())
  await p.waitForTimeout(700)
  await shot(p,'idle-tasks','Có danh sách việc')

  await drive(p,()=>{ window.surface.setComposerText('delete the shopping tasks'); return window.surface.submit('typed') })
  await p.waitForTimeout(900)
  await shot(p,'question-confirm','Hỏi xác nhận trước khi xoá')
  await drive(p,()=>window.surface.tapChip(0))
  await p.waitForTimeout(900)
  await shot(p,'applied-delete','Đã xoá')
  await drive(p,()=>window.surface.tapUndo())
  await p.waitForTimeout(900)
  await shot(p,'reverted','Đã hoàn tác')

  await drive(p,()=>{ window.surface.setComposerText('delete the report task'); return window.surface.submit('typed') })
  await p.waitForTimeout(900)
  await shot(p,'question-clarify','Hỏi chọn việc nào')

  await drive(p,()=>{ window.surface.setComposerText('cross off the badminton game'); return window.surface.submit('typed') })
  await p.waitForTimeout(900)
  await shot(p,'no-match','Không tìm thấy việc')

  await drive(p,()=>{ window.surface.setComposerText('cause an ai error'); return window.surface.submit('typed') })
  await p.waitForTimeout(1100)
  await shot(p,'error','Lỗi từ máy chủ')

  // 5 offline — the real Connectivity port
  await drive(p,()=>{ window.surface.connectivity.set(false) })
  await drive(p,()=>{ window.surface.setComposerText('add a task to buy cheese'); return window.surface.submit('typed') })
  await p.waitForTimeout(700)
  await shot(p,'offline','Mất mạng — câu vừa gửi xếp hàng chờ')
  await drive(p,()=>{ window.surface.connectivity.set(true) })
  await p.waitForTimeout(1300)
  await shot(p,'reconnected','Có mạng trở lại — gửi tiếp phần chờ')

  // 6 keyboard up (AC-10 layout)
  await drive(p,()=>{ window.surface.keyboard(true) })
  await shot(p,'keyboard','Bàn phím hiện — ô nhập không bị che')
  await p.close()

  // 7 mic states — each needs its own boot
  for(const [extra,st,label] of [
    ['&perm=denied','mic-permission','Chưa cấp quyền micro'],
    ['&pack=0','mic-transient','Thiếu gói ngôn ngữ'],
    ['&recognizer=0','mic-hidden','Máy không có bộ nhận giọng nói — mic ẩn'],
  ]){
    const q=await open(extra)
    await q.evaluate(()=>window.surface.tapMic())
    await shot(q,st,label)
    await q.close()
  }
  await ctx.close()
}
await b.close()
fs.writeFileSync(OUT+'/manifest-real.json',JSON.stringify(man,null,1))
console.log('\nreal mobile shots:',man.length)
