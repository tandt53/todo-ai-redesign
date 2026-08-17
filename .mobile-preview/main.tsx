// Screenshot harness ONLY — renders the REAL React Native components through
// react-native-web, driven by the REAL MobileAssistantController via
// createSurface(). Nothing here is app code and nothing in src/ is modified;
// it lives outside src/ on purpose and is deleted after the shots are taken.
import { createRoot } from 'react-dom/client'
import { AssistantScreen } from '../src/assistant/mobile/components/AssistantScreen.tsx'
import { createSurface, makeTranscriptSource } from '../src/assistant/mobile/index.ts'

const q = new URLSearchParams(location.search)
const platform = (q.get('platform') ?? 'ios') as 'ios' | 'android'
const perm = q.get('perm')          // 'denied' -> mic-permission
const recognizer = q.get('recognizer') !== '0'   // 0 -> mic hidden
const pack = q.get('pack') !== '0'  // 0 -> language pack missing

const transcript = makeTranscriptSource({
  platform,
  recognizerAvailable: recognizer,
  languagePackAvailable: pack,
  ...(perm === 'denied'
    ? { permissions: { mic: 'denied', speech: 'denied' } as any }
    : {}),
})

const surface = createSurface({
  platform,
  transcript,
  api: { baseUrl: '', userId: q.get('user') ?? 'shot-' + platform },
})
;(window as any).surface = surface
;(window as any).booted = surface.start().then(() => { (window as any).isReady = true })
createRoot(document.getElementById('root')!).render(<AssistantScreen controller={surface.controller} />)
