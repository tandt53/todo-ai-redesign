// Capture every state of every mockup, per platform, clipped to the app frame.
// States are read from the mockups' own `data-s` buttons rather than a hand list,
// so a state added to a drawing appears here without anyone remembering to add it.
import { chromium } from '@playwright/test'
import fs from 'fs'
const TMP=process.env.UAT_TMP, DIR='docs/design/assistant/screens'
const PLAT={ web:{sfx:'',w:1280,h:900}, ios:{sfx:'-ios',w:430,h:932}, android:{sfx:'-android',w:412,h:915} }
fs.mkdirSync(`${TMP}/png`,{recursive:true})
const b=await chromium.launch({executablePath:process.env.DESIGN_CHECK_BROWSER})
const manifest={}
for (const screen of ['app-shell','task-detail','voice-assistant-view','lists'])
  for (const [plat,cfg] of Object.entries(PLAT)) {
    const file=`${screen}${cfg.sfx}.html`
    if(!fs.existsSync(`${DIR}/${file}`)) continue
    const p=await b.newPage(); await p.setViewportSize({width:cfg.w,height:cfg.h})
    await p.goto('file://'+process.cwd()+'/'+DIR+'/'+file)
    const states=await p.evaluate(()=>[...document.querySelectorAll('[data-s]')].map(e=>e.getAttribute('data-s')))
    for (const st of states) {
      await p.evaluate(s=>window.showState&&window.showState(s), st); await p.waitForTimeout(90)
      const el=await p.$('.app')||await p.$('body')
      const name=`${screen}__${plat}__${st}.png`
      await el.screenshot({path:`${TMP}/png/${name}`})
      ;(manifest[`${screen}/${st}`] ||= {})[plat]=name
    }
    await p.close()
  }
fs.writeFileSync('docs/reports/uat/manifest.json', JSON.stringify(manifest,null,1))
console.log('     ', Object.keys(manifest).length, 'trạng thái')
await b.close()
