// Simulator shell — mounts the project's REAL mobile screen on a real device
// runtime. No app behaviour lives here.
//
// It also self-drives: `simctl`/`adb` cannot tap, so each scenario is opened as
// a deep link (todoai://s/<name>) and replayed through the SAME public Surface
// API that QA's automation uses. Every state below is produced by the real
// MobileAssistantController talking to the real assistant server — nothing is
// staged for the camera.
import { useEffect, useState } from 'react'
import { LogBox, Platform, StatusBar } from 'react-native'
// RN's own SafeAreaView is iOS-only — on Android it applies no inset and the
// system status bar draws straight over the app header. A real shell uses this.
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'
import { AssistantScreen } from '../src/assistant/mobile/components/AssistantScreen'
import { createSurface, makeTranscriptSource } from '../src/assistant/mobile/index'

// A handset cannot reach the host's localhost (spec Open Question 3). The iOS
// simulator shares host loopback; the Android emulator reaches it at 10.0.2.2.
const API =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4460' : 'http://localhost:4460')
const PLATFORM = Platform.OS === 'android' ? 'android' : 'ios'
// Dev-only overlays would sit on top of every screenshot.
LogBox.ignoreAllLogs(true)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))


function scenarioFrom(url: string | null): string {
  // Scheme-agnostic: the native project registered `com.todoai.sim` (the first
  // prebuild ran before app.json declared a scheme, and prebuild will not
  // overwrite an existing Info.plist). Match on the path, not the scheme.
  const m = url && /:\/\/s\/([a-z-]+)/.exec(url)
  return m ? (m[1] as string) : 'idle-empty'
}

function build(scenario: string, run: string) {
  const transcript = makeTranscriptSource({
    platform: PLATFORM,
    recognizerAvailable: scenario !== 'mic-hidden',
    languagePackAvailable: scenario !== 'mic-transient',
    // PermissionState is { microphone, speech_recognition } — NOT { mic, speech }.
    //
    // The denial status is platform-specific, and the app is right about it:
    // on Android `denied` is still re-askable (F-003 AC-3 allows re-requesting
    // on the next talk attempt), so tapping the mic legitimately re-prompts and
    // the fake grants — the dead-end state there is `permanently_denied`. On
    // iOS the OS records the answer and never prompts again, so `denied` is
    // already the dead end.
    ...(scenario === 'mic-permission'
      ? {
          permissions: (PLATFORM === 'android'
            ? { microphone: 'permanently_denied' }
            : { microphone: 'denied', speech_recognition: 'denied' }) as any,
        }
      : {}),
  })
  return createSurface({
    platform: PLATFORM,
    transcript,
    api: { baseUrl: API, userId: `sim-${run}-${PLATFORM}-${scenario}` },
  })
}

async function seed(userId: string, titles: string[]) {
  for (const title of titles) {
    await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ title }),
    })
  }
}

async function play(s: any, scenario: string, userId: string) {
  const say = async (text: string, wait = 1100) => {
    s.setComposerText(text)
    const p = s.submit('typed')
    if (wait === 0) return p
    await p
    await sleep(wait)
  }
  // Seeded through POST /tasks rather than through assistant turns: every extra
  // turn pushes the message this scenario is about further down, and BUG-004
  // means the view never follows it. Keep each conversation as short as the
  // scenario allows.
  const SHOPPING = ['Buy milk', 'Buy eggs', 'Buy bread', 'Report Q1', 'Report Q2', 'Team meeting']

  switch (scenario) {
    case 'idle-empty':
      return
    case 'listening':
      s.tapMic()
      return
    case 'listening-words':
      s.tapMic()
      await sleep(250)
      s.hearWords('họp nhóm ngày mai')
      return
    case 'thinking':
      s.setComposerText('qaweb delayed bulk delete')
      void s.submit('typed')
      return
    case 'applied-diff':
      await say('add a task to buy milk')
      return
    case 'idle-tasks':
      await seed(userId, SHOPPING)
      await s.foreground()
      return
    case 'question-confirm':
      await seed(userId, SHOPPING)
      await s.foreground()
      await sleep(400)
      await say('delete the shopping tasks')
      return
    case 'applied-delete':
      await seed(userId, SHOPPING)
      await s.foreground()
      await sleep(400)
      await say('delete the shopping tasks')
      await s.tapChip(0)
      await sleep(1000)
      return
    case 'reverted':
      await seed(userId, SHOPPING)
      await s.foreground()
      await sleep(400)
      await say('delete the shopping tasks')
      await s.tapChip(0)
      await sleep(1000)
      await s.tapUndo()
      await sleep(1000)
      return
    case 'question-clarify':
      await seed(userId, SHOPPING)
      await s.foreground()
      await sleep(400)
      await say('delete the report task')
      return
    case 'no-match':
      await say('cross off the badminton game')
      return
    case 'error':
      await say('cause an ai error', 1400)
      return
    case 'offline':
      s.connectivity.set(false)
      await sleep(300)
      void say('add a task to buy cheese', 0)
      await sleep(900)
      return
    case 'reconnected':
      s.connectivity.set(false)
      await sleep(300)
      void say('add a task to buy cheese', 0)
      await sleep(900)
      s.connectivity.set(true)
      await sleep(1600)
      return
    case 'mic-permission':
    case 'mic-transient':
    case 'mic-hidden':
      s.tapMic()
      return
  }
}

export default function App() {
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    Linking.getInitialURL().then((u) => setUrl(u ?? null))
    const sub = Linking.addEventListener('url', (e) => setUrl(e.url))
    return () => sub.remove()
  }, [])

  const [surface, setSurface] = useState<any>(null)
  useEffect(() => {
    if (url === undefined) return
    const scenario = scenarioFrom(url)
    const run = String(Date.now()).slice(-7)
    const s = build(scenario, run)
    setSurface(s)
    ;(globalThis as any).surface = s
    void (async () => {
      await s.start()
      await play(s, scenario, `sim-${run}-${PLATFORM}-${scenario}`)
    })()
  }, [url])

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0b12' }} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#0b0b12" />
        {surface === null ? null : <AssistantScreen controller={surface.controller} />}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
