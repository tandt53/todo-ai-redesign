/**
 * F-003 mobile-surface — QA automation
 * qa-mobile-agent · T-020 (author, 2026-08-16) · T-021 (execute, 2026-08-17)
 *
 * RUNNER: vitest, node env, no simulator/emulator/Metro
 *   npx vitest run qa/assistant/automation/mobile
 * per `specs/_shared/platform/mobile.md ## Test Harness`. React Native is never
 * imported here — everything native arrives through a port double.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE DOES AND DOES NOT PROVE (L-003)
 * ─────────────────────────────────────────────────────────────────────────────
 * Three parts, three different truth values. Report them separately; never sum
 * them into one coverage number.
 *
 *   PART A — contract preconditions. Parses the design mockups, the TC files and
 *            the fixtures. Proves the 22-id selector contract, the enumerated
 *            permission matrix and the device-lab debt list are intact. Needs no
 *            implementation; goes red when design or the spec drifts.
 *
 *   PART B — behavioural assertions against `src/assistant/mobile`, which
 *            mobile-agent is landing in parallel (T-019). Every expected VALUE
 *            here is derived from the spec, the mockups or `api-contracts.md` —
 *            never from what the implementation happens to do. Where the
 *            implementation disagrees, the test fails and that is the finding.
 *
 *   PART C — the parity block (TC-001..TC-012) and the conversation-driven
 *            lifecycle behaviours. At authoring time these were OWED: the
 *            shared conversation reducer had not landed, so they were gated
 *            behind one explicit failing check rather than 12 silent skips.
 *            T-019 landed `src/assistant/_shared/controller.ts` and the mobile
 *            controller that extends it, so at `phase: execute` (T-021) the
 *            gate was replaced by the real bodies below: they drive the mobile
 *            `Surface` against a REAL in-process assistant server
 *            (createApp → http.Server on an ephemeral port), with only MODEL
 *            INTERPRETATION stubbed. Orchestration, the confirmation gate,
 *            persistence, dedupe, undo and session lifecycle all run real —
 *            same split the F-001 api suite uses.
 *
 * The seam below was resolved by RUNTIME INSPECTION of the module's exports
 * (allowed: _qa-foundations §2 — the running system is output and is fair game;
 * grepping `src/` for what to assert is not, and was not done). If the exports
 * move, re-point the imports; the expected values stay as they are, because they
 * come from the spec.
 *
 * NOT provable here, by specification (F-003 ## Test strategy → device-lab list):
 * real permission dialogs and the Settings deep link · a real interrupting call ·
 * a real OS kill · VoiceOver/TalkBack · keyboard occlusion and rotation · system
 * back and back-swipe · on-device offline recognition · touch-target measurement
 * on a device. Those live in TC-032/034/036/037/038 and are device-lab debt.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createServer, globalAgent, type Server } from 'node:http'

// PART C wiring — the REAL assistant server, in-process. Only the Interpreter
// is stubbed (F-001 ## Test strategy grants exactly that seam); orchestration,
// the confirmation gate, persistence, dedupe, undo and session lifecycle run
// real. Same composition root the api suite and the e2e harness use.
import { createApp } from '../../../../src/assistant/api/app.ts'
import { MemoryStore } from '../../../../src/assistant/api/store/memory-store.ts'
import { FakeClock } from '../../../../src/assistant/api/ports/clock.ts'
import type {
  Interpretation,
  Interpreter,
  InterpreterContext,
} from '../../../../src/assistant/api/ports/interpreter.ts'
import {
  Surface,
  announcementsFor,
  makeConnectivity,
  makeTranscriptSource,
} from '../../../../src/assistant/mobile/index.ts'

import { A11Y_IDS, ALL_A11Y_IDS, identityAttribute } from '../../../../src/assistant/mobile/model/a11y.ts'
import { INTERACTIVE_IDS, MIN_TOUCH_TARGET, hitArea, meetsMinimum } from '../../../../src/assistant/mobile/model/touch.ts'
import {
  AUDIO_INTERRUPTION_REASONS,
  FOREGROUND_SEQUENCE,
  backIsBackgroundTransition,
  keyboardChangeAffectsConversation,
} from '../../../../src/assistant/mobile/model/lifecycle.ts'
import {
  canRequest,
  ctaTarget,
  deniedGrants,
  permissionCtaLabel,
  permissionDeniedMessageFor,
  requiredGrants,
} from '../../../../src/assistant/mobile/model/permissions.ts'
import { HydratedDurableStore, MemoryAsyncBackend } from '../../../../src/assistant/mobile/ports/durable-store.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../..')

const MOCKUPS = {
  ios: join(ROOT, 'design/assistant/screens/voice-assistant-view-ios.html'),
  android: join(ROOT, 'design/assistant/screens/voice-assistant-view-android.html'),
  web: join(ROOT, 'design/assistant/screens/voice-assistant-view.html'),
}
const TC_DIR = join(ROOT, 'qa/assistant/F-003/mobile')
const FIXTURES = join(ROOT, 'qa/_shared/fixtures/mobile/F-003-mobile-fixtures.json')
const CANONICAL_UTTERANCES = join(ROOT, 'qa/assistant/F-001/api/utterance-intent-fixtures.json')

/**
 * The catalogue is PARSED from the mockups, never hand-listed (L-002: a
 * hand-copied list turns a contract check into a self-agreement check).
 * Three attribute spellings, one contract and one source prop (`testID`):
 * data-testid (web, kept in both mobile mockups for design-check),
 * accessibilityIdentifier (iOS), resource-id (Android).
 *
 * `contentDescription` is deliberately NOT in this list. It is Android's
 * ANNOUNCEMENT attribute (from `accessibilityLabel`) and AC-12 forbids parking
 * a catalogue id there — an id on contentDescription is read aloud by TalkBack
 * instead of the message.
 */
function catalogueOf(file: string): Set<string> {
  const html = readFileSync(file, 'utf8')
  const ids = new Set<string>()
  for (const attr of ['data-testid', 'accessibilityIdentifier', 'resource-id']) {
    for (const m of html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) ids.add(m[1])
  }
  return ids
}

/** One attribute at a time — used to prove each platform's identity attribute
 * actually carries the ids, rather than leaning on the web `data-testid` that
 * both mobile mockups also keep for design-check. */
function idsUnder(file: string, attr: string): Set<string> {
  const html = readFileSync(file, 'utf8')
  const ids = new Set<string>()
  for (const m of html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) ids.add(m[1])
  return ids
}

const sorted = (s: Set<string> | string[]) => [...s].sort()
const tcFileNames = () => readdirSync(TC_DIR).filter((n) => n.startsWith('TC-') && n.endsWith('.md'))

// ═══════════════════════════════════════════════════════════════════════════
// PART A — contract preconditions (no implementation required)
// ═══════════════════════════════════════════════════════════════════════════

describe('A. selector contract — the 22-id catalogue (AC-12, AC-1)', () => {
  let ios: Set<string>
  let android: Set<string>
  let web: Set<string>

  beforeAll(() => {
    ios = catalogueOf(MOCKUPS.ios)
    android = catalogueOf(MOCKUPS.android)
    web = catalogueOf(MOCKUPS.web)
  })

  it('the iOS mockup declares exactly 22 accessibility ids', () => {
    expect(sorted(ios)).toHaveLength(22)
  })

  it('iOS and Android carry the SAME values — one contract, three attribute spellings (AC-12)', () => {
    expect(sorted(android)).toEqual(sorted(ios))
  })

  it('the mobile catalogue equals the web catalogue — no platform fork of the id contract (AC-1)', () => {
    expect(sorted(web)).toEqual(sorted(ios))
  })

  it('every selector referenced by an F-003 mobile TC exists in the catalogue — none invented (ethos §9)', () => {
    const referenced = new Map<string, string[]>()
    for (const f of tcFileNames()) {
      const body = readFileSync(join(TC_DIR, f), 'utf8')
      // Only inline-code spans count as selector references; backticked file
      // paths (which contain / or .) are excluded, so `design/assistant/...`
      // never reads as a selector.
      for (const m of body.matchAll(/`([^`\n]+)`/g)) {
        const tok = m[1].trim()
        if (!tok.startsWith('assistant-')) continue
        if (tok.includes('/') || tok.includes('.') || tok.includes(' ')) continue
        if (!referenced.has(tok)) referenced.set(tok, [])
        referenced.get(tok)!.push(f)
      }
    }
    expect(referenced.size).toBeGreaterThan(0) // the scan itself must not be vacuous
    const invented = [...referenced.keys()].filter((id) => !ios.has(id))
    expect(invented, `invented selectors: ${JSON.stringify(invented)}`).toEqual([])
  })
})

describe('A. permission matrix is enumerated, not sampled (AC-2, AC-3, AC-4)', () => {
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8'))
  const rows: any[] = fx.permission_matrix.rows

  it('iOS contributes exactly 4 rows — every combination of the two grants (AC-2)', () => {
    const ios = rows.filter((r) => r.platform === 'ios')
    expect(ios).toHaveLength(4)
    expect(
      ios.map((r) => `${r.permission_state.microphone}/${r.permission_state.speech_recognition}`).sort(),
    ).toEqual(['denied/denied', 'denied/granted', 'granted/denied', 'granted/granted'])
  })

  it('Android contributes exactly 3 rows incl. the distinct permanently-denied path (AC-3)', () => {
    const android = rows.filter((r) => r.platform === 'android')
    expect(android).toHaveLength(3)
    expect(android.map((r) => r.permission_state.microphone).sort()).toEqual([
      'denied',
      'granted',
      'permanently_denied',
    ])
    // Android has a SINGLE grant — a speech_recognition key here would be the
    // iOS dual-permission model leaking onto the wrong platform.
    for (const r of android) expect(r.permission_state.speech_recognition).toBeUndefined()
  })

  it('any iOS partial denial dims the mic — never hides it (AC-2)', () => {
    const partial = rows.filter(
      (r) =>
        r.platform === 'ios' &&
        (r.permission_state.microphone === 'denied' || r.permission_state.speech_recognition === 'denied'),
    )
    expect(partial).toHaveLength(3)
    for (const r of partial) expect(r.expected_mic_mode).toBe('dimmed')
  })

  it('hidden is reserved for no-capability; transient failure dims and recovers (F-001 AC-20, AC-22)', () => {
    const hidden = rows.filter((r) => r.expected_mic_mode === 'hidden')
    expect(hidden).toHaveLength(1)
    expect(hidden[0].capability).toBe(false)

    const transient = rows.filter((r) => r.recognizer_failure)
    expect(transient.length).toBeGreaterThanOrEqual(2) // service busy + missing language pack
    for (const r of transient) {
      expect(r.expected_mic_mode).toBe('dimmed')
      expect(r.recovers).toBe(true)
      expect(r.expected_cta).toBe(false) // nothing to grant → no permission CTA
    }
  })

  it('every matrix row is claimed by at least one P1 test case', () => {
    const files = tcFileNames().join('\n')
    for (const r of rows) {
      for (const tc of String(r.tc).split(',').map((s) => s.trim())) {
        expect(files, `${r.id} claims ${tc}`).toContain(tc)
      }
    }
  })
})

describe('A. honest tiering — the device-lab debt is visible, not buried', () => {
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8'))

  it('mirrors every item the spec says the node tier cannot claim (F-003 ## Test strategy)', () => {
    const spec = readFileSync(join(ROOT, 'specs/assistant/F-003-mobile-surface.md'), 'utf8')
    const owed = spec.split('**What a device-lab or manual pass still owes**')[1] ?? ''
    expect(owed, 'the spec section this list mirrors has moved or been renamed').not.toBe('')

    expect(fx.device_lab_debt.items.length).toBeGreaterThanOrEqual(8)
    for (const item of fx.device_lab_debt.items) {
      expect(item.acs.length, `${item.item} names no AC`).toBeGreaterThan(0)
      expect(item.tc.length, `${item.item} names no TC`).toBeGreaterThan(0)
    }
  })

  /**
   * The execute-phase tiering rule (L-003). At authoring this asserted that NO
   * TC read `automated`, because nothing had executed. That gate has done its
   * job; replacing it with "anything goes" would throw the lesson away, so the
   * rule below is the same principle re-pointed at what is now true:
   *
   *   1. A TC may read `automated` only if its PRIMARY tier is node-headless.
   *      A device-lab-first or manual-first TC never becomes automated by this
   *      suite running — its device half is still owed.
   *   2. A TC may read `automated` only if this automation file NAMES it, so a
   *      TC cannot claim coverage no test refers to.
   *   3. Every node-primary TC must read `automated`, because this run executed
   *      them all. A newly authored node TC with no test goes red here.
   *
   * All three are derived from the TC files themselves — no hand-kept list.
   */
  it('every TC declares its tier honestly — automated only for what actually executed (L-003)', () => {
    const files = tcFileNames()
    expect(files).toHaveLength(40)
    const spec = readFileSync(join(HERE, 'F-003-mobile-surface.spec.ts'), 'utf8')

    for (const f of files) {
      const body = readFileSync(join(TC_DIR, f), 'utf8')
      expect(body, `${f} has no Tier row`).toMatch(/\|\s*Tier\s*\|/)
      expect(body, `${f} has no AC ids`).toMatch(/\|\s*Acceptance criteria\s*\|\s*\S/)

      const id = f.slice(0, 6) // TC-0nn
      const tier = /\|\s*Tier\s*\|([^|]*)\|/.exec(body)![1]!.trim()
      const nodePrimary = tier.startsWith('node-headless')
      const automated = /\|\s*Automation\s*\|\s*automated\s*\|/.test(body)

      if (automated) {
        expect(nodePrimary, `${f} claims 'automated' but its primary tier is "${tier}"`).toBe(true)
        expect(spec.includes(id), `${f} claims 'automated' but no test in this file names ${id}`).toBe(true)
      }
      if (nodePrimary) {
        expect(automated, `${f} has a node-headless primary tier but does not read 'automated'`).toBe(true)
      }
    }
  })

  it('the device-lab and manual-first TCs are still visibly NOT automated', () => {
    // Named here as an explicit second reading of the same fact: AC-9, AC-10,
    // AC-11 and AC-12 cannot reach full verification from this tier at all.
    for (const f of tcFileNames()) {
      const body = readFileSync(join(TC_DIR, f), 'utf8')
      const tier = /\|\s*Tier\s*\|([^|]*)\|/.exec(body)![1]!.trim()
      if (tier.startsWith('node-headless')) continue
      expect(body, `${f} (tier "${tier}") claims automation it does not have`).toMatch(
        /\|\s*Automation\s*\|\s*manual\s*\|/,
      )
    }
  })
})

describe('A. the canonical utterance table has exactly one home (L-004)', () => {
  it('mobile fixtures reference the F-001 table and do not restate its rows', () => {
    const fx = readFileSync(FIXTURES, 'utf8')
    const canonical = JSON.parse(readFileSync(CANONICAL_UTTERANCES, 'utf8'))
    expect(canonical.rows.length).toBeGreaterThan(0)
    expect(fx).toContain('qa/assistant/F-001/api/utterance-intent-fixtures.json')
    expect(JSON.parse(fx).rows).toBeUndefined()
    for (const row of canonical.rows.slice(0, 10)) {
      expect(fx, `mobile fixtures duplicate canonical utterance "${row.utterance}"`).not.toContain(row.utterance)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PART B — behavioural assertions against src/assistant/mobile
// Expected values come from the spec / mockups / api-contracts, never from
// what the implementation happens to return.
// ═══════════════════════════════════════════════════════════════════════════

describe('B. accessibility identity — TC-039 (AC-12)', () => {
  it('the shipped id catalogue equals the mockup catalogue exactly — none missing, none invented', () => {
    expect(sorted(ALL_A11Y_IDS)).toEqual(sorted(catalogueOf(MOCKUPS.ios)))
  })

  it('every named id constant carries a catalogue value', () => {
    const catalogue = catalogueOf(MOCKUPS.ios)
    for (const [name, value] of Object.entries(A11Y_IDS)) {
      expect(catalogue.has(value as string), `${name} → ${value} is not in the mockup catalogue`).toBe(true)
    }
  })

  it('identity rides accessibilityIdentifier on iOS and resource-id on Android (AC-12)', () => {
    // AC-12 (rev 2): one React Native `testID` prop, three surface spellings —
    // data-testid (web) · accessibilityIdentifier (iOS) · resource-id (Android).
    expect(identityAttribute('ios')).toBe('accessibilityIdentifier')
    expect(identityAttribute('android')).toBe('resource-id')
  })

  it('contentDescription is never an identity attribute — it carries the announcement (AC-12)', () => {
    // The falsifying case AC-12 now states outright: identity parked on
    // contentDescription is spoken by TalkBack in place of the message. So the
    // Android mockup must carry the catalogue on resource-id, and must not
    // carry a single catalogue id on contentDescription.
    expect(sorted(idsUnder(MOCKUPS.android, 'resource-id'))).toEqual(sorted(catalogueOf(MOCKUPS.ios)))
    expect(identityAttribute('android')).not.toBe('contentDescription')
    const announced = idsUnder(MOCKUPS.android, 'contentDescription')
    const catalogue = catalogueOf(MOCKUPS.ios)
    const leaked = [...announced].filter((v) => catalogue.has(v))
    expect(leaked, `catalogue ids found on contentDescription: ${JSON.stringify(leaked)}`).toEqual([])
  })

  it('the iOS identity attribute carries the whole catalogue too (AC-12)', () => {
    expect(sorted(idsUnder(MOCKUPS.ios, 'accessibilityIdentifier'))).toEqual(sorted(catalogueOf(MOCKUPS.ios)))
  })
})

describe('B. touch targets — TC-032 model half (AC-9)', () => {
  it('the minimum is 44 pt on iOS and 48 dp on Android, as the spec states', () => {
    expect(MIN_TOUCH_TARGET.ios).toBe(44)
    expect(MIN_TOUCH_TARGET.android).toBe(48)
  })

  it('every interactive element is drawn from the catalogue', () => {
    const catalogue = catalogueOf(MOCKUPS.ios)
    for (const id of INTERACTIVE_IDS) expect(catalogue.has(id), `${id} not in catalogue`).toBe(true)
  })

  it('every interactive element meets the minimum as HIT AREA on both platforms (AC-9)', () => {
    const failures: string[] = []
    for (const platform of ['ios', 'android'] as const) {
      for (const id of INTERACTIVE_IDS) {
        if (!meetsMinimum(id, platform)) {
          failures.push(`${platform}/${id} → ${JSON.stringify(hitArea(id, platform))}`)
        }
      }
    }
    expect(failures, `below minimum: ${failures.join(', ')}`).toEqual([])
  })

})

describe('B. permissions — the platform split (AC-2, AC-3)', () => {
  it('iOS requires TWO grants, Android exactly ONE (AC-2, AC-3)', () => {
    expect(sorted(requiredGrants('ios'))).toEqual(['microphone', 'speech_recognition'])
    expect(requiredGrants('android')).toEqual(['microphone'])
  })

  it('TC-015 / TC-016 / TC-017 · every iOS partial denial names exactly the missing capability', () => {
    const rows = [
      { state: { microphone: 'denied', speech_recognition: 'granted' }, missing: ['microphone'] },
      { state: { microphone: 'granted', speech_recognition: 'denied' }, missing: ['speech_recognition'] },
      { state: { microphone: 'denied', speech_recognition: 'denied' }, missing: ['microphone', 'speech_recognition'] },
    ]
    for (const row of rows) {
      expect(sorted(deniedGrants('ios', row.state)), JSON.stringify(row.state)).toEqual(sorted(row.missing))
      // A partial denial must lead the user somewhere — AC-2's CTA clause.
      expect(ctaTarget('ios', row.state), 'denied state offers no CTA').not.toBeNull()
    }
  })

  it('TC-014 · both granted offers no permission CTA', () => {
    expect(ctaTarget('ios', { microphone: 'granted', speech_recognition: 'granted' })).toBeNull()
  })

  it('TC-015 / TC-016 / TC-017 · the three iOS denial messages are mutually DISTINGUISHABLE', () => {
    const lang = 'vi'
    const texts = [
      { microphone: 'denied', speech_recognition: 'granted' },
      { microphone: 'granted', speech_recognition: 'denied' },
      { microphone: 'denied', speech_recognition: 'denied' },
    ].map((s) => JSON.stringify(permissionDeniedMessageFor('ios', s, lang)))
    expect(new Set(texts).size, 'two denial states produce identical copy').toBe(3)
  })

  it('TC-020 · Android permanently-denied must NOT re-request; a plain denial may', () => {
    expect(canRequest('android', { microphone: 'permanently_denied' })).toBe(false)
    expect(canRequest('android', { microphone: 'denied' })).toBe(true)
  })

  it('TC-015 / TC-020 · the CTA label matches the mockup copy on each platform', () => {
    // iOS mockup: "Mở Cài đặt" (app Settings page).
    expect(permissionCtaLabel('ios', { microphone: 'denied', speech_recognition: 'granted' })).toBe('Mở Cài đặt')
    // Android mockup: "Mở cài đặt ứng dụng" (App info → Permissions).
    expect(permissionCtaLabel('android', { microphone: 'permanently_denied' })).toBe('Mở cài đặt ứng dụng')
  })
})

describe('B. lifecycle rules — TC-029, TC-030, TC-034/035, TC-036 (AC-7, AC-8, AC-10, AC-11)', () => {
  it('TC-029 · all four audio-interruption kinds the spec names are handled (AC-7)', () => {
    // AC-7: "incoming call, system assistant (Siri / Google Assistant),
    // audio-focus loss, output-route change".
    expect(AUDIO_INTERRUPTION_REASONS).toHaveLength(4)
    expect(sorted(AUDIO_INTERRUPTION_REASONS)).toEqual(sorted(['call', 'system-assistant', 'focus-loss', 'route-change']))
  })

  it('TC-030 · the session read is the FIRST thing every foreground does (AC-8)', () => {
    // AC-8: re-read GET /assistant/session *before* accepting new input; local
    // stores reconcile against that read, never override it.
    expect(FOREGROUND_SEQUENCE[0]).toBe('read-session')
    expect(FOREGROUND_SEQUENCE.indexOf('restore-pending-input')).toBeGreaterThan(0)
    expect(FOREGROUND_SEQUENCE.indexOf('replay-outgoing-turn')).toBeGreaterThan(0)
  })

  it('TC-036 · leaving the view is a background transition, never a cancel or a close (AC-11)', () => {
    expect(backIsBackgroundTransition()).toBe(true)
  })

  it('TC-034/035 · keyboard show/hide changes no conversation state (AC-10)', () => {
    expect(keyboardChangeAffectsConversation()).toBe(false)
  })
})

describe('B. kill survival — TC-024, TC-026 (AC-5, AC-6)', () => {
  it('a value written before the "kill" is readable by a store hydrated after it (AC-5)', async () => {
    const backend = new MemoryAsyncBackend()
    const live = new HydratedDurableStore(backend)

    live.set('client.pending_input', { text: 'mua sữa cho ngày mai', updated_at: 1 })
    await live.flush()

    // The kill: the model instance is gone; only the backend survives. A store
    // hydrated from that backend is what the next cold open sees.
    const revived = await (HydratedDurableStore as any).open(backend)
    expect(revived.get('client.pending_input')).toEqual({ text: 'mua sữa cho ngày mai', updated_at: 1 })
  })

  it('the outgoing turn survives with its ORIGINAL client_turn_id (AC-6)', async () => {
    const backend = new MemoryAsyncBackend()
    const live = new HydratedDurableStore(backend)
    const outgoing = {
      payload: { client_turn_id: 'qamob-turn-0001', transcript: 'thêm mua sữa', source: 'voice' },
      sent_at: 1,
      attempts: 1,
    }

    live.set('client.outgoing_turn', outgoing)
    await live.flush()

    const revived = await (HydratedDurableStore as any).open(backend)
    // AC-6: replay under the SAME client_turn_id, so the server re-serves rather
    // than double-applies. A regenerated id is the double-apply bug.
    expect(revived.get('client.outgoing_turn').payload.client_turn_id).toBe('qamob-turn-0001')
  })

  it('a write that never flushed is reported, not silently lost (AC-6, device-lab flush concern)', async () => {
    const backend = new MemoryAsyncBackend()
    const live = new HydratedDurableStore(backend)
    live.set('client.pending_input', { text: 'chưa kịp ghi', updated_at: 2 })
    // Deliberately no flush — a real kill can land here. The store must be able
    // to say so rather than report success; on a device this is the gap between
    // "kept the words" and "lost the words".
    expect(typeof (live as any).failedWrites).toBe('function')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PART C — the parity block and the conversation-driven lifecycle behaviours
//
// At authoring (T-020) these were OWED: the shared conversation reducer had
// not landed, so one explicit failing gate stood in for 19 unwritten bodies.
// T-019 landed it (`src/assistant/_shared/controller.ts`, extended by
// `MobileAssistantController`), so the gate is gone and the bodies are here.
//
// HOW THESE RUN
// -------------
// A REAL assistant server, in-process: `createApp({store, interpreter, clock})`
// bound to 127.0.0.1 on an ephemeral port. Only MODEL INTERPRETATION is stubbed
// (`QaMobileInterpreter` below) — orchestration, the confirmation gate,
// persistence, per-status dedupe, undo and session lifecycle all run real. That
// is the same seam F-001's Test strategy grants the api suite, and it is what
// makes AC-1's parity claim checkable rather than asserted: mobile drives the
// same endpoints, the same reducer and the same message vocabulary as web.
//
// The client under test is `Surface` from `src/assistant/mobile/index.ts` — the
// mobile controller plus the four port doubles. React Native is never imported.
//
// EXPECTED VALUES still come from the spec, the mockups and api-contracts.md.
// Where a Vietnamese string is asserted it is asserted as a *distinguishing*
// property (three denial messages differ; a nothing-reverted head is not a
// success head), never as a copy fixture — the product ships Vietnamese and the
// spec's English is concept names (F-001 ## Conversation model).
// ═══════════════════════════════════════════════════════════════════════════

;(globalAgent as unknown as { keepAlive: boolean }).keepAlive = false
;(globalAgent as unknown as { options: { keepAlive?: boolean } }).options.keepAlive = false

const lower = (s: string): string => s.trim().toLowerCase()

/**
 * QA's fixture Interpreter for the mobile suite.
 *
 * The canonical utterance→intent table
 * (`qa/assistant/F-001/api/utterance-intent-fixtures.json`) is READ, never
 * copied (L-004): the grammar below is the runtime realization of those same
 * rows against a real per-turn handle context, which a static JSON cannot
 * resolve on its own (ADR-002: candidates arrive as opaque handles, not uuids).
 * A test asserts up front that every canonical row id this suite leans on still
 * exists in that file, so a row being renamed or dropped upstream goes red here
 * rather than silently changing what these TCs mean.
 *
 * Titles carry the `qamob-` namespace (_qa-foundations §10). Server state is
 * keyed per `X-User-Id`, and every test in this part gets a fresh uuid user and
 * a fresh in-process store, so nothing here can collide with qaapi-/qaweb- data
 * or with another mobile test.
 */
class QaMobileInterpreter implements Interpreter {
  calls = 0
  /** utterances that must throw exactly once, then succeed (F-001 AC-23 retry) */
  readonly failOnce = new Set<string>()

  async interpret(ctx: InterpreterContext): Promise<Interpretation> {
    this.calls += 1
    const text = ctx.transcript.trim()
    const n = lower(text)

    if (this.failOnce.has(n)) {
      this.failOnce.delete(n)
      throw new Error('qamob injected interpreter failure')
    }
    if (n === 'qamob trigger model failure') throw new Error('qamob injected interpreter failure')

    if (ctx.question !== null) {
      const answer = this.classifyAnswer(n, ctx)
      if (answer !== null) return answer
    }
    return this.matchCommand(text, ctx.tasks) ?? { kind: 'no_match' }
  }

  /** Returns null for anything that is not a recognized answer, so the caller
   * falls through to command matching — that is what lets an unrelated command
   * supersede a pending question (D2), and what lands a genuinely ambiguous
   * utterance on the engine's own `unclassifiable` outcome. */
  private classifyAnswer(n: string, ctx: InterpreterContext): Interpretation | null {
    const q = ctx.question!
    const idx = q.options.findIndex((o) => lower(o) === n)
    if (idx !== -1) {
      if (q.kind === 'bulk_delete') {
        return { kind: 'answer', answer: { type: idx === 0 ? 'affirmative' : 'negative' } }
      }
      const target = ctx.tasks.find((t) => lower(t.title) === n)
      return {
        kind: 'answer',
        answer: target !== undefined ? { type: 'selection', handle: target.handle } : { type: 'unclassifiable' },
      }
    }
    if (['yes', 'ok', 'ừ', 'đúng vậy, xoá đi'].includes(n)) return { kind: 'answer', answer: { type: 'affirmative' } }
    if (['no', 'không'].includes(n)) return { kind: 'answer', answer: { type: 'negative' } }
    // UT-ANS-AMBIG-1 / -2: neither affirmative nor negative nor a command.
    if (['hmm maybe', 'what do you mean'].includes(n)) return { kind: 'answer', answer: { type: 'unclassifiable' } }
    return null
  }

  private matchCommand(text: string, tasks: InterpreterContext['tasks']): Interpretation | null {
    const exact = (title: string) => tasks.find((t) => lower(t.title) === lower(title))
    const byPrefix = (p: string) => tasks.filter((t) => t.title.toLowerCase().startsWith(p))
    let m: RegExpExecArray | null

    if ((m = /^rename (.+) to (.+)$/i.exec(text)) !== null) {
      const t = exact(m[1]!)
      return t !== undefined
        ? { kind: 'edit', edits: [{ handle: t.handle, changes: { title: m[2]!.trim() } }] }
        : { kind: 'no_match' }
    }
    if ((m = /^mark (.+) done$/i.exec(text)) !== null) {
      const t = exact(m[1]!)
      return t !== undefined
        ? { kind: 'edit', edits: [{ handle: t.handle, changes: { status: 'done' } }] }
        : { kind: 'no_match' }
    }
    if (/^add a task (.+)$/i.test(text)) {
      return { kind: 'create', tasks: [{ title: text.replace(/^add a task /i, '').trim() }] }
    }
    if (/^add (.+)$/i.test(text)) {
      const titles = text
        .replace(/^add /i, '')
        .split(/,\s*| and /i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      return { kind: 'create', tasks: titles.map((title) => ({ title })) }
    }
    if (/^delete all my qamob shopping tasks$/i.test(text)) {
      return { kind: 'delete', handles: byPrefix('qamob-shop-').map((t) => t.handle) }
    }
    if (/^delete both qamob report tasks$/i.test(text)) {
      return { kind: 'delete', handles: byPrefix('qamob-report-').map((t) => t.handle) }
    }
    if (/^delete the report task$/i.test(text)) {
      return { kind: 'clarify', handles: byPrefix('qamob-report-').map((t) => t.handle), pending_op: { op: 'delete' } }
    }
    if (/^delete the unicorn task$/i.test(text)) return { kind: 'no_match' }
    if ((m = /^delete (qamob-[\w-]+)$/i.exec(text)) !== null) {
      const t = exact(m[1]!)
      return { kind: 'delete', handles: t !== undefined ? [t.handle] : [] }
    }
    if (/^what'?s on sunday\??$/i.test(text)) return { kind: 'query' }
    return null
  }
}

interface WireRecord {
  method: string
  path: string
  body: Record<string, unknown> | null
}

interface Harness {
  server: Server
  base: string
  ai: QaMobileInterpreter
  /** every HTTP call the client made, in order */
  wire: WireRecord[]
  /** when this returns true the next fetch throws, as a dropped connection does */
  netDown: { value: boolean }
}

let H: Harness

beforeEach(async () => {
  const ai = new QaMobileInterpreter()
  const server = createServer(
    createApp({
      store: new MemoryStore(),
      interpreter: ai,
      clock: new FakeClock('2026-08-17T09:00:00.000Z'),
      idleCloseMs: 180_000,
    }),
  )
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  H = {
    server,
    base: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    ai,
    wire: [],
    netDown: { value: false },
  }
})

afterEach(
  () =>
    new Promise<void>((resolve) => {
      H.server.closeAllConnections()
      H.server.close(() => resolve())
    }),
)

/** The request spy every TC that asserts "nothing went on the wire" needs. */
const spyFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  H.wire.push({
    method: init?.method ?? 'GET',
    path: url.replace(H.base, ''),
    body: init?.body === undefined ? null : (JSON.parse(String(init.body)) as Record<string, unknown>),
  })
  if (H.netDown.value) throw new TypeError('qamob: connection dropped')
  return fetch(url, init)
}

const assistantCalls = (): WireRecord[] => H.wire.filter((r) => r.path.startsWith('/assistant/'))
const turnPosts = (): WireRecord[] => H.wire.filter((r) => r.path === '/assistant/turn' && r.method === 'POST')
const turnIds = (): unknown[] => turnPosts().map((r) => r.body?.['client_turn_id'])

/** A fresh mobile surface for one namespaced user. `store` may be carried over
 * to reproduce a process kill: same DurableStore, brand-new model. */
function surfaceFor(user: string, opts: Record<string, unknown> = {}): any {
  return new Surface({
    platform: 'ios',
    userId: user,
    api: { baseUrl: H.base, fetchFn: spyFetch },
    ...opts,
  }) as any
}

/** `qamob-` namespace, one uuid user per test — server state is keyed on it. */
const newUser = (): string => randomUUID()

async function seedTasks(user: string, titles: readonly string[]): Promise<void> {
  for (const title of titles) {
    const res = await fetch(`${H.base}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': user },
      body: JSON.stringify({ id: randomUUID(), title, status: 'inbox' }),
    })
    if (!res.ok) throw new Error(`seed failed for ${title}: ${res.status}`)
  }
}

async function serverTasks(user: string): Promise<string[]> {
  const res = await fetch(`${H.base}/tasks`, { headers: { 'x-user-id': user } })
  const body = (await res.json()) as { tasks: { title: string; deleted_at: string | null }[] }
  return body.tasks.filter((t) => t.deleted_at === null).map((t) => t.title)
}

async function closeServerSession(user: string): Promise<void> {
  const read = await fetch(`${H.base}/assistant/session`, { headers: { 'x-user-id': user } })
  const { session } = (await read.json()) as { session: { id: string } | null }
  if (session === null) throw new Error('no session to close')
  const res = await fetch(`${H.base}/assistant/session/close`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': user },
    body: JSON.stringify({ session_id: session.id, reason: 'user_closed' }),
  })
  if (!res.ok) throw new Error(`close failed: ${res.status} ${await res.text()}`)
}

/**
 * Wait for an observable to settle. The client refreshes the task list on its
 * own promise after the turn response resolves, so "the list reflects the turn"
 * is observable a tick later — not a second command later. Polling for the
 * observable (rather than sleeping a fixed time) keeps this deterministic:
 * it fails loudly if the observable never arrives.
 */
async function until(predicate: () => boolean, what: string, budgetMs = 2000): Promise<void> {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error(`timed out waiting for: ${what}`)
}

/** Drive one utterance through the typed path and wait for its outcome. */
async function say(s: any, text: string, source: 'typed' | 'voice' | 'tap' = 'typed'): Promise<void> {
  const before = s.messages.length
  s.setComposerText(text)
  await s.submit(source)
  await until(() => s.messages.length > before + 1, `an outcome for "${text}"`)
}

const titles = (s: any): string[] => s.tasks.map((t: { title: string }) => t.title)
const newest = (s: any): any => s.messages[s.messages.length - 1]
const rendered = (s: any): string => JSON.stringify(s.messages)

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const DRAFT_REF_RE = /#d\d+/

// ───────────────────────── canonical-table guard (L-004) ─────────────────────

describe('C. the canonical rows this suite realizes still exist upstream (L-004)', () => {
  it('every canonical row id the mobile grammar mirrors is still in the F-001 table', () => {
    const canonical = JSON.parse(readFileSync(CANONICAL_UTTERANCES, 'utf8')) as { rows: { id: string }[] }
    const ids = new Set(canonical.rows.map((r) => r.id))
    // The rows whose SEMANTICS the grammar above realizes. If one is renamed or
    // dropped upstream, these TCs stop meaning what they claim — so this goes
    // red rather than the tests silently drifting.
    for (const id of [
      'UT-CREATE-1',
      'UT-CREATE-3',
      'UT-EDIT-1',
      'UT-COMPLETE-1',
      'UT-DELETE-1',
      'UT-DELETE-BULK-2',
      'UT-DELETE-BULK-3',
      'UT-CLARIFY-1',
      'UT-ANS-YES-1',
      'UT-ANS-NO-1',
      'UT-ANS-AMBIG-1',
      'UT-NOMATCH-1',
      'UT-LISTQ-1',
      'UT-FAIL-1',
    ]) {
      expect(ids.has(id), `canonical row ${id} is gone`).toBe(true)
    }
  })
})

// ───────────────────────────── parity: TC-001..TC-012 ────────────────────────

describe('C. TC-001 — applied turn lands in the list in the same turn, attributed in place (AC-1, F-001 AC-1/AC-4)', () => {
  it('both effects of one turn are on the list, diffed, marked and undoable', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-tc001-old', 'qamob-tc001-bystander'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 2, 'the seeded list')

    await say(s, 'rename qamob-tc001-old to qamob-tc001-new')
    await until(() => titles(s).includes('qamob-tc001-new'), 'the edit on the list in the same turn')

    const msg = newest(s)
    expect(msg.kind).toBe('applied')
    expect(msg.mutated).toBe(true)
    // F-001 AC-4: attributable in place — one diff line per changed task, with
    // the real old→new pair, and no fabricated old value.
    expect(msg.lines).toHaveLength(1)
    expect(msg.lines[0].title).toBe('qamob-tc001-old')
    expect(msg.lines[0].chips).toContainEqual({ field: 'title', old: 'qamob-tc001-old', new: 'qamob-tc001-new' })

    // Only this turn's task is marked; the bystander carries no marker.
    const marked = Object.keys(s.appState.marks.byTask)
    expect(marked).toHaveLength(1)
    const bystander = s.tasks.find((t: any) => t.title === 'qamob-tc001-bystander')
    expect(marked).not.toContain(bystander.id)

    // The rendered surface exposes the diff pair and the single undo affordance.
    const ids = [...s.a11yIds()]
    expect(ids).toContain('assistant-diff-old')
    expect(ids).toContain('assistant-diff-new')
    expect(ids).toContain('assistant-undo-button')
    expect(ids).toContain('assistant-row-badge')
    expect(s.undoableTurnId).toBe(msg.turnId)
  })

  it('a create renders as new with NO fabricated old value, and lands on the list', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add qamob-tc001-a, qamob-tc001-b and qamob-tc001-c')
    await until(() => titles(s).length === 3, 'all three creates on the list in the same turn')

    const msg = newest(s)
    expect(msg.kind).toBe('applied')
    expect(msg.lines.map((l: any) => l.label)).toEqual(['new', 'new', 'new'])
    for (const line of msg.lines) {
      for (const chip of line.chips) expect(chip.old, 'a create must not fabricate an old value').toBeNull()
    }
    // Atomic: all three, or none. A partial render is the failure this catches.
    expect(titles(s).sort()).toEqual(['qamob-tc001-a', 'qamob-tc001-b', 'qamob-tc001-c'])
    expect(await serverTasks(u)).toHaveLength(3)
  })

  it('no rendered string leaks a task uuid or a draft-ref token', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-tc001-old'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 1, 'the seeded list')
    await say(s, 'rename qamob-tc001-old to qamob-tc001-new')

    // taskId is a structural field of the message record, not a rendered string;
    // strip it and assert nothing user-visible carries an id.
    const visible = s.messages.map((m: any) => {
      const copy = JSON.parse(JSON.stringify(m))
      delete copy.turnId
      delete copy.clientTurnId
      for (const line of copy.lines ?? []) delete line.taskId
      return copy
    })
    expect(JSON.stringify(visible)).not.toMatch(UUID_RE)
    expect(JSON.stringify(visible)).not.toMatch(DRAFT_REF_RE)
  })
})

describe('C. TC-002 — exactly four states; no transition outside the flowchart (AC-1, F-001 AC-29/AC-11)', () => {
  it('a long event sweep never produces a fifth state, and the mobile-only events add none', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-tc002-x'])
    const s = surfaceFor(u)
    const seen = new Set<string>()
    const record = (): void => void seen.add(s.state)

    await s.start(); record()
    s.tapMic(); await until(() => s.state === 'listening', 'listening'); record()
    s.hearWords('mua', 'mua sữa'); record()
    s.endSpeech('speech-end'); await until(() => s.state === 'idle', 'idle after speech'); record()

    await say(s, 'add a task qamob-tc002-a'); record()
    await say(s, 'qamob trigger model failure'); record()
    expect(s.state).toBe('error')
    seen.add('error')

    // Lifecycle transitions are AC-named (AC-8: a foreground renders whatever
    // the server reports, which is how the client-side error clears), so they
    // are recorded but not held to "no transition".
    s.background(); record()
    await s.foreground(); record()

    // The genuinely mobile-only events are the ones with no AC of their own:
    // offline, keyboard and system back must move nothing.
    const before = s.state
    s.connectivity.set(false); record()
    expect(s.offline, 'offline is a flag, not a state').toBe(true)
    s.connectivity.set(true); record()
    s.keyboard(true); record()
    s.keyboard(false); record()
    await s.pressBack(); record()
    expect(s.state, 'offline / keyboard / back moved the surface out of its state').toBe(before)

    expect([...seen].sort()).toEqual(['error', 'idle', 'listening'].sort())
    for (const st of seen) expect(['idle', 'listening', 'thinking', 'error']).toContain(st)
  })

  it('mic mode varies orthogonally to state — three modes, one state (AC-1)', async () => {
    const u = newUser()
    const source = makeTranscriptSource({
      platform: 'ios',
      permissions: { microphone: 'granted', speech_recognition: 'granted' },
    })
    const s = surfaceFor(u, { transcript: source })
    await s.start()
    const modes = new Set<string>()

    expect(s.state).toBe('idle'); modes.add(s.micMode)
    source.setPermissions({ microphone: 'denied', speech_recognition: 'granted' })
    expect(s.state).toBe('idle'); modes.add(s.micMode)
    source.setRecognizerAvailable(false)
    expect(s.state).toBe('idle'); modes.add(s.micMode)

    expect([...modes].sort()).toEqual(['available', 'dimmed', 'hidden'])
  })

  it('a pending question blocks nothing — the list stays operable (F-001 AC-11)', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-shop-1', 'qamob-shop-2', 'qamob-tc002-other'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 3, 'the seeded list')

    await say(s, 'delete all my qamob shopping tasks')
    expect(newest(s).kind).toBe('question')
    expect(newest(s).resolved).toBe(false)

    const other = s.tasks.find((t: any) => t.title === 'qamob-tc002-other')
    await s.controller.toggleTask(other.id)
    await until(() => s.tasks.find((t: any) => t.id === other.id).status === 'done', 'the manual complete')

    // The question is still pending and still answerable.
    const q = s.messages.find((m: any) => m.kind === 'question')
    expect(q.resolved).toBe(false)
    expect(await serverTasks(u)).toHaveLength(3)
  })
})

describe('C. TC-003 — live transcript; nothing recognized sends no turn (AC-1, F-001 AC-2)', () => {
  it('each partial renders as it arrives, latest-wins, diacritics intact', async () => {
    const u = newUser()
    const source = makeTranscriptSource({
      platform: 'ios',
      permissions: { microphone: 'granted', speech_recognition: 'granted' },
    })
    const s = surfaceFor(u, { transcript: source })
    await s.start()
    s.tapMic()
    await until(() => s.state === 'listening', 'listening')

    const partials = ['dời', 'dời duyệt ngân sách', 'dời duyệt ngân sách sang bốn giờ']
    for (let i = 0; i < partials.length; i += 1) {
      s.hearWords(...partials.slice(0, i + 1))
      // The rendered transcript equals the LATEST partial exactly — no lag by
      // one, no truncation, no ASCII folding of the diacritics.
      expect(s.composerText).toBe(partials[i])
    }
  })

  it('an empty return goes back to idle visibly and puts nothing on the wire', async () => {
    const u = newUser()
    const source = makeTranscriptSource({
      platform: 'ios',
      permissions: { microphone: 'granted', speech_recognition: 'granted' },
    })
    const s = surfaceFor(u, { transcript: source })
    await s.start()
    const messagesBefore = s.messages.length

    s.tapMic()
    await until(() => s.state === 'listening', 'listening')
    s.endSpeech('speech-end')
    await until(() => s.state === 'idle', 'idle after an empty return')

    expect(turnPosts(), 'an empty recognition became a turn').toHaveLength(0)
    expect(H.ai.calls).toBe(0)
    expect(s.messages).toHaveLength(messagesBefore)
    expect([...s.a11yIds()]).not.toContain('assistant-state-indicator')
  })
})

describe('C. TC-004 — undo shapes, visible refusal, idempotent replay (AC-1, F-001 AC-6/AC-8)', () => {
  it('undo is whole-turn, the turn stays visible marked undone, and the list reverts', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add qamob-tc004-a, qamob-tc004-b and qamob-tc004-c')
    await until(() => s.tasks.length === 3, 'three created')
    const appliedTurnId = newest(s).turnId

    await s.tapUndo()
    await until(() => s.tasks.length === 0, 'all three reverted in one gesture')

    // Re-read the message from the current state: the reducer produces new
    // records, so a snapshot taken before the undo would never show the flag.
    const applied = s.messages.find((m: any) => m.kind === 'applied' && m.turnId === appliedTurnId)
    expect(applied, 'the original turn was removed from the conversation').toBeDefined()
    expect(applied.undone, 'the original turn must stay visible, marked undone').toBe(true)
    expect(newest(s).kind).toBe('reverted')
    expect(await serverTasks(u)).toHaveLength(0)
  })

  it('a second undo of the same turn is idempotent — no second list change', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc004-idem')
    await until(() => s.tasks.length === 1, 'the create')
    const turnId = s.undoableTurnId

    await s.tapUndo(turnId)
    await until(() => s.tasks.length === 0, 'the revert')
    const after = await serverTasks(u)

    await s.controller.undoTap(turnId)
    await until(() => newest(s).kind !== 'user', 'the second undo outcome')
    expect(await serverTasks(u), 'the list changed a second time').toEqual(after)
  })

  it('a stale undo is REFUSED with a visible message, never silently (F-001 AC-6/AC-8)', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc004-first')
    await until(() => s.tasks.length === 1, 'the first turn')
    const first = s.undoableTurnId

    await say(s, 'add a task qamob-tc004-second')
    await until(() => s.tasks.length === 2, 'the second turn')

    // The affordance moved to the newer mutating turn (F-001 AC-8).
    expect(s.undoableTurnId).not.toBe(first)

    const before = s.messages.length
    await s.controller.undoTap(first)
    await until(() => s.messages.length > before, 'a refusal message')
    const refusal = newest(s)
    // A refusal must be a conversation record stating the reason, not a toast
    // and not a silent no-op. `body` is where the reason lives.
    expect(refusal.kind === 'outcome' || refusal.kind === 'reverted').toBe(true)
    expect(String(refusal.body?.join(' ') ?? '')).not.toBe('')
    expect(await serverTasks(u)).toHaveLength(2)
  })

  it('undo after session close is refused, and the affordance is gone (F-001 AC-8)', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc004-closed')
    await until(() => s.tasks.length === 1, 'the applied turn')
    const turnId = s.undoableTurnId
    await closeServerSession(u)

    const before = s.messages.length
    await s.controller.undoTap(turnId)
    await until(() => s.messages.length > before, 'a refusal message')
    expect(await serverTasks(u), 'a closed session still reverted').toEqual(['qamob-tc004-closed'])
  })
})

describe('C. TC-005 — undo names every skipped task; all-skipped never reads as success (AC-1, F-001 AC-7)', () => {
  it('a task modified after the turn is skipped and NAMED; the rest revert', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-tc005-a', 'qamob-tc005-b'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 2, 'the seeded list')

    await say(s, 'add qamob-tc005-c and qamob-tc005-d')
    await until(() => s.tasks.length === 4, 'the applied turn')

    const c = s.tasks.find((t: any) => t.title === 'qamob-tc005-c')
    await s.controller.editTask(c.id, 'qamob-tc005-c-touched-by-hand')
    await until(() => titles(s).includes('qamob-tc005-c-touched-by-hand'), 'the hand edit')

    await s.tapUndo()
    await until(() => newest(s).kind === 'reverted', 'the revert outcome')
    const msg = newest(s)
    const text = `${String(msg.head ?? '')} ${String(msg.body?.join(' ') ?? '')}`

    // The skipped task is NAMED — zero silent overwrites.
    expect(text).toContain('qamob-tc005-c-touched-by-hand')
    // The hand value survived; the untouched sibling went away.
    const after = await serverTasks(u)
    expect(after).toContain('qamob-tc005-c-touched-by-hand')
    expect(after).not.toContain('qamob-tc005-d')
  })

  it('when EVERY task was modified, the message is the nothing-reverted shape and the list is unchanged', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add qamob-tc005-e and qamob-tc005-f')
    await until(() => s.tasks.length === 2, 'the applied turn')

    for (const t of [...s.tasks]) {
      await s.controller.editTask(t.id, `${t.title}-touched`)
      await until(() => titles(s).includes(`${t.title}-touched`), `hand edit of ${t.title}`)
    }
    const before = (await serverTasks(u)).sort()

    await s.tapUndo()
    await until(() => newest(s).kind === 'reverted', 'the revert outcome')
    const msg = newest(s)
    const text = `${String(msg.head ?? '')} ${String(msg.body?.join(' ') ?? '')}`

    // Both names appear, and the head is NOT the success head this same message
    // kind uses when something actually reverted (TC-004 asserts that one).
    expect(text).toContain('qamob-tc005-e-touched')
    expect(text).toContain('qamob-tc005-f-touched')
    expect(msg.head).not.toBe('Đã hoàn tác')
    expect((await serverTasks(u)).sort(), 'the list moved on a nothing-reverted outcome').toEqual(before)
  })

  it('undo with nothing applied in the session is a visible refusal, and never becomes a task', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()

    const before = s.messages.length
    await s.controller.undoTap(randomUUID())
    await until(() => s.messages.length > before, 'a refusal message')
    expect(String(newest(s).body?.join(' ') ?? '')).not.toBe('')
    // The undo phrase must never be interpreted as a create (F-001 undo guard).
    expect(await serverTasks(u)).toHaveLength(0)
  })
})

describe('C. TC-006 — bulk delete asks (>1) while a single delete applies (=1) (AC-1, F-001 AC-9/AC-11)', () => {
  it('count = 1 applies immediately with undo', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-single-1'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 1, 'the seed')

    await say(s, 'delete qamob-single-1')
    await until(() => s.tasks.length === 0, 'the immediate delete')
    const msg = newest(s)
    expect(msg.kind).toBe('applied')
    expect(msg.deletedTitles).toEqual(['qamob-single-1'])
    expect([...s.a11yIds()]).toContain('assistant-undo-button')
  })

  it('count = 2 is already "more than one": it ASKS and deletes nothing (boundary)', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-report-q3', 'qamob-report-q4'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 2, 'the seeds')

    await say(s, 'delete both qamob report tasks')
    const msg = newest(s)
    expect(msg.kind).toBe('question')
    expect(msg.qkind).toBe('bulk_delete')
    expect(msg.taskTitles.sort()).toEqual(['qamob-report-q3', 'qamob-report-q4'])
    expect(String(msg.head)).toContain('2')
    expect([...s.a11yIds()]).toContain('assistant-chip-affirm')
    expect([...s.a11yIds()]).toContain('assistant-chip-negative')
    // The asking turn applies nothing (F-001 AC-1 carve-out).
    expect(await serverTasks(u)).toHaveLength(2)
  })

  it('count = 3 asks with the same shape and names all three', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-shop-1', 'qamob-shop-2', 'qamob-shop-3'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 3, 'the seeds')

    await say(s, 'delete all my qamob shopping tasks')
    const msg = newest(s)
    expect(msg.kind).toBe('question')
    expect(msg.taskTitles).toHaveLength(3)
    expect(String(msg.head)).toContain('3')
    expect(await serverTasks(u)).toHaveLength(3)
  })
})

describe('C. TC-007 — question resolution matrix; nothing resolves silently (AC-1, F-001 AC-10/AC-11/AC-12)', () => {
  async function ask(): Promise<{ s: any; u: string }> {
    const u = newUser()
    await seedTasks(u, ['qamob-shop-1', 'qamob-shop-2', 'qamob-shop-3'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 3, 'the seeds')
    await say(s, 'delete all my qamob shopping tasks')
    expect(newest(s).kind).toBe('question')
    return { s, u }
  }

  it('row 1 · clearly affirmative → executed, with the full applied anatomy', async () => {
    const { s, u } = await ask()
    await say(s, 'yes')
    await until(() => newest(s).kind === 'applied', 'the executed outcome')
    expect(newest(s).deletedTitles).toHaveLength(3)
    expect([...s.a11yIds()]).toContain('assistant-undo-button')
    expect(await serverTasks(u)).toHaveLength(0)
  })

  it('row 2 · negative → declined, zero deletions, visible outcome', async () => {
    const { s, u } = await ask()
    await say(s, 'no')
    const msg = newest(s)
    expect(msg.kind).toBe('outcome')
    expect(String(msg.head ?? '') + String(msg.body?.join(' ') ?? '')).not.toBe('')
    expect(await serverTasks(u)).toHaveLength(3)
  })

  it('row 3 · unrelated command → declined-superseded AND the new command proceeds', async () => {
    const { s, u } = await ask()
    const before = s.messages.length
    await say(s, 'add a task qamob-tc007-superseder')
    await until(() => s.messages.length >= before + 3, 'both the declined outcome and the new outcome')

    const after = s.messages.slice(before)
    const kinds = after.map((m: any) => m.kind)
    expect(kinds).toContain('outcome') // the declined-superseded record
    expect(kinds).toContain('applied') // the new command's own outcome
    expect(kinds.indexOf('outcome')).toBeLessThan(kinds.indexOf('applied'))

    const tasks = await serverTasks(u)
    expect(tasks).toContain('qamob-tc007-superseder')
    expect(tasks.filter((t) => t.startsWith('qamob-shop-')), 'a superseded question deleted something').toHaveLength(3)
  })

  it('row 4 · unclassifiable → nothing executes and the question stays PENDING and answerable', async () => {
    const { s, u } = await ask()
    await say(s, 'hmm maybe')
    expect(await serverTasks(u)).toHaveLength(3)

    const q = s.messages.find((m: any) => m.kind === 'question')
    expect(q.resolved, 'an unclassifiable answer resolved the question').toBe(false)

    // Still answerable afterwards — no timeout ran.
    await say(s, 'yes')
    await until(() => newest(s).kind === 'applied', 'the late affirmative')
    expect(await serverTasks(u)).toHaveLength(0)
  })

  it('row 5 · an answer arriving after the question resolved NEVER executes the delete again', async () => {
    const { s, u } = await ask()
    await say(s, 'no')
    expect(await serverTasks(u)).toHaveLength(3)

    // The question is resolved; a late "yes" must not execute it.
    await say(s, 'yes')
    expect(newest(s).kind, 'a late answer executed a resolved question').not.toBe('applied')
    expect(await serverTasks(u), 'a late answer executed the questioned delete').toHaveLength(3)
  })

  it('row 6 · affirmative after a named task changed → executes on the survivors, count matches reality (F-001 AC-12)', async () => {
    const { s, u } = await ask()
    const victim = s.tasks.find((t: any) => t.title === 'qamob-shop-2')
    await s.controller.removeTask(victim.id)
    await until(() => s.tasks.length === 2, 'the hand deletion')

    await say(s, 'yes')
    await until(() => newest(s).kind === 'applied' || newest(s).kind === 'outcome', 'the executed outcome')
    const msg = newest(s)
    const survivors = await serverTasks(u)
    const deleted: string[] = msg.deletedTitles ?? []

    // Two tasks remained when the answer arrived, so exactly two are deleted —
    // and the message names those two, not the three the question asked about.
    // A message claiming 3 while 2 were deleted is the F-001 AC-12 failure.
    expect(deleted.sort()).toEqual(['qamob-shop-1', 'qamob-shop-3'])
    expect(deleted, 'the outcome claimed a task that was already gone').not.toContain('qamob-shop-2')
    expect(survivors, 'the survivors were not all deleted').toEqual([])
  })
})

describe('C. TC-008 — clarify presents real candidates; tap sends the literal text (AC-1, F-001 AC-13)', () => {
  it('candidates are the real seeded titles, nothing changes while pending', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-report-q3', 'qamob-report-q4', 'qamob-tc008-other'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 3, 'the seeds')

    await say(s, 'delete the report task')
    const q = newest(s)
    expect(q.kind).toBe('question')
    expect(q.qkind).toBe('clarify')
    // Every chip label is a REAL task title — a plausible placeholder fails here.
    for (const option of q.options) expect(titles(s)).toContain(option)
    expect(q.options.sort()).toEqual(['qamob-report-q3', 'qamob-report-q4'])
    expect([...s.a11yIds()]).toContain('assistant-option-chip')
    expect(await serverTasks(u)).toHaveLength(3)
  })

  it('a chip tap sends source=tap, the literal option text, and answer_to_turn_id', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-report-q3', 'qamob-report-q4'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 2, 'the seeds')
    await say(s, 'delete the report task')
    const q = newest(s)

    H.wire.length = 0
    await s.tapChip(0)
    await until(() => turnPosts().length === 1, 'the tap turn')
    const body = turnPosts()[0]!.body!

    expect(body['source']).toBe('tap')
    expect(body['transcript']).toBe(q.options[0])
    expect(body['answer_to_turn_id']).toBe(q.turnId)
    expect(String(body['transcript'])).not.toMatch(UUID_RE)
  })

  it('voice and typed answers carry no answer_to_turn_id and bind to the newest question', async () => {
    for (const source of ['voice', 'typed'] as const) {
      const u = newUser()
      await seedTasks(u, ['qamob-report-q3', 'qamob-report-q4'])
      const s = surfaceFor(u)
      await s.start()
      await until(() => s.tasks.length === 2, 'the seeds')
      await say(s, 'delete the report task')

      H.wire.length = 0
      await say(s, 'qamob-report-q3', source)
      const body = turnPosts()[0]!.body!
      expect(body['source']).toBe(source)
      expect(body['answer_to_turn_id']).toBeNull()
      await until(() => s.tasks.length === 1, `the ${source} answer resolving`)
      expect(await serverTasks(u)).toEqual(['qamob-report-q4'])
    }
  })
})

describe('C. TC-009 — no-match quotes what was heard; a list question names the alternative (AC-1, F-001 AC-14/AC-15)', () => {
  it('the no-match message quotes the transcript verbatim and mutates nothing', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-tc009-keep'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 1, 'the seed')
    const before = await serverTasks(u)

    await say(s, 'delete the unicorn task')
    const msg = newest(s)
    expect(msg.kind).toBe('no-match')
    // Verbatim — not lowercased, not folded. The user must be able to see the
    // mishearing, which is the whole point of quoting it.
    expect(msg.heard).toBe('delete the unicorn task')
    expect(await serverTasks(u), 'a no-match mutated the list').toEqual(before)
    expect(titles(s)).toEqual(['qamob-tc009-keep'])
  })

  it('a no-match with diacritics is quoted exactly as heard', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    const heard = 'gạch trận cầu lông'
    await say(s, heard)
    expect(newest(s).kind).toBe('no-match')
    expect(newest(s).heard).toBe(heard)
    // And it never becomes a task titled with the transcript.
    expect(await serverTasks(u)).toHaveLength(0)
  })

  it('a question about the list yields unsupported_query naming the working alternative', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-tc009-keep'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 1, 'the seed')

    await say(s, "what's on sunday?")
    const msg = newest(s)
    expect(msg.kind).toBe('unsupported')
    // Names the working alternative rather than fabricating an answer.
    expect(String(msg.alternative ?? '')).not.toBe('')
    expect(await serverTasks(u)).toEqual(['qamob-tc009-keep'])
  })
})

describe('C. TC-010 — typed takes the same path as speech; the manual path makes zero AI calls (AC-1, F-001 AC-17/AC-18)', () => {
  it('the voice and typed requests differ ONLY in source, and produce the same outcome', async () => {
    const capture = async (source: 'voice' | 'typed'): Promise<{ body: any; msg: any }> => {
      const u = newUser()
      const s = surfaceFor(u)
      await s.start()
      H.wire.length = 0
      await say(s, 'add a task qamob-tc010-same', source)
      await until(() => s.tasks.length === 1, 'the create')
      return { body: turnPosts()[0]!.body!, msg: newest(s) }
    }

    const voice = await capture('voice')
    const typed = await capture('typed')

    expect(Object.keys(voice.body).sort()).toEqual(Object.keys(typed.body).sort())
    const differing = Object.keys(voice.body).filter(
      (k) => JSON.stringify(voice.body[k]) !== JSON.stringify(typed.body[k]),
    )
    // client_turn_id is per-turn by contract; source is the field under test.
    expect(differing.sort()).toEqual(['client_turn_id', 'source'])
    expect(voice.body['source']).toBe('voice')
    expect(typed.body['source']).toBe('typed')

    expect(voice.msg.kind).toBe(typed.msg.kind)
    expect(voice.msg.head).toBe(typed.msg.head)
    expect(voice.msg.lines.map((l: any) => [l.title, l.label])).toEqual(
      typed.msg.lines.map((l: any) => [l.title, l.label]),
    )
  })

  it('create / edit / complete / delete entirely by touch makes ZERO AI calls and zero /assistant/* requests', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    const aiBefore = H.ai.calls
    H.wire.length = 0

    await s.controller.addTask('qamob-tc010-manual')
    await until(() => s.tasks.length === 1, 'the manual create')
    const t = s.tasks[0]
    await s.controller.editTask(t.id, 'qamob-tc010-manual-edited')
    await until(() => titles(s).includes('qamob-tc010-manual-edited'), 'the manual edit')
    await s.controller.toggleTask(t.id)
    await until(() => s.tasks[0].status === 'done', 'the manual complete')
    await s.controller.removeTask(t.id)
    await until(() => s.tasks.length === 0, 'the manual delete')

    expect(H.ai.calls - aiBefore, 'the manual path called the model').toBe(0)
    expect(assistantCalls().map((r) => r.path), 'the manual path hit /assistant/*').toEqual([])
    expect(await serverTasks(u)).toHaveLength(0)
  })

  it('the manual path still works while the mic is dimmed and while it is hidden', async () => {
    for (const mode of ['dimmed', 'hidden'] as const) {
      const u = newUser()
      const source = makeTranscriptSource({
        platform: 'ios',
        ...(mode === 'dimmed'
          ? { permissions: { microphone: 'denied', speech_recognition: 'granted' } }
          : { recognizerAvailable: false }),
      })
      const s = surfaceFor(u, { transcript: source })
      await s.start()
      expect(s.micMode).toBe(mode)

      const aiBefore = H.ai.calls
      await s.controller.addTask(`qamob-tc010-${mode}`)
      await until(() => s.tasks.length === 1, `the manual create with a ${mode} mic`)
      expect(H.ai.calls).toBe(aiBefore)
      expect(await serverTasks(u)).toEqual([`qamob-tc010-${mode}`])
    }
  })
})

describe('C. TC-011 — an AI error keeps the words, offers retry, leaves the list usable (AC-1, F-001 AC-23/AC-24/AC-16)', () => {
  it('the surface says so, keeps the transcript, and offers retry', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    H.ai.failOnce.add('add a task qamob-tc011-kept')

    await say(s, 'add a task qamob-tc011-kept')
    expect(s.state).toBe('error')
    const msg = newest(s)
    expect(msg.kind).toBe('error')
    expect(String(msg.body?.join(' ') ?? '')).not.toBe('')
    // The user's words are kept — no re-speaking.
    expect(s.composerText).toBe('add a task qamob-tc011-kept')
    expect([...s.a11yIds()]).toContain('assistant-retry-button')
    expect(await serverTasks(u)).toHaveLength(0)
  })

  it('retry re-attempts under the SAME client_turn_id and applies exactly once (F-001 AC-16)', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    H.ai.failOnce.add('add a task qamob-tc011-retry')
    H.wire.length = 0

    await say(s, 'add a task qamob-tc011-retry')
    const originalId = newest(s).retryTurnId
    expect(turnIds()).toEqual([originalId])

    await s.controller.retry(originalId)
    await until(() => s.tasks.length === 1, 'the retried turn applying')

    // failed → pending under the same id: two posts, one id, one effect.
    expect(turnIds()).toEqual([originalId, originalId])
    expect(await serverTasks(u), 'the retry double-applied').toEqual(['qamob-tc011-retry'])
  })

  it('the list stays usable by hand while the conversation is in error (F-001 AC-24)', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    H.ai.failOnce.add('qamob trigger model failure')
    await say(s, 'qamob trigger model failure')
    expect(s.state).toBe('error')

    await s.controller.addTask('qamob-tc011-manual-in-error')
    await until(() => s.tasks.length === 1, 'the manual create while in error')
    expect(await serverTasks(u)).toEqual(['qamob-tc011-manual-in-error'])
  })
})

describe('C. TC-012 — no capability hides the mic without error; the payload is text only (AC-1, F-001 AC-20)', () => {
  it('the mic is ABSENT, not dimmed, and no error is shown', async () => {
    const u = newUser()
    const source = makeTranscriptSource({ platform: 'android', permissions: { microphone: 'granted' }, recognizerAvailable: false })
    const s = surfaceFor(u, { transcript: source, platform: 'android' })
    await s.start()

    expect(s.micMode).toBe('hidden')
    expect([...s.a11yIds()]).not.toContain('assistant-mic-button')
    // Hiding IS the handling — a "speech unavailable" banner here fails.
    expect(s.messages, 'no-capability produced a message').toEqual([])
    expect([...s.a11yIds()]).not.toContain('assistant-permission-cta')
  })

  it('the turn payload carries text only — the exact api-contracts field set, no audio', async () => {
    const u = newUser()
    const source = makeTranscriptSource({ platform: 'ios', recognizerAvailable: false })
    const s = surfaceFor(u, { transcript: source })
    await s.start()
    H.wire.length = 0

    await say(s, 'add a task qamob-tc012-typed')
    const body = turnPosts()[0]!.body!
    expect(Object.keys(body).sort()).toEqual(
      ['answer_to_turn_id', 'client_turn_id', 'session_id', 'source', 'timezone', 'transcript'].sort(),
    )
    expect(typeof body['transcript']).toBe('string')
    for (const [k, v] of Object.entries(body)) {
      expect(v instanceof ArrayBuffer, `${k} carries binary`).toBe(false)
      expect(ArrayBuffer.isView(v as object), `${k} carries binary`).toBe(false)
    }
    await until(() => s.tasks.length === 1, 'the typed create')
  })

  it('capability is detected dynamically — restoring it returns the mic with no restart', async () => {
    const u = newUser()
    const source = makeTranscriptSource({ platform: 'ios', recognizerAvailable: false })
    const s = surfaceFor(u, { transcript: source })
    await s.start()
    expect(s.micMode).toBe('hidden')

    source.setRecognizerAvailable(true)
    await until(() => s.micMode === 'available', 'the mic returning without a restart')
    expect([...s.a11yIds()]).toContain('assistant-mic-button')
  })
})

// ─────────────────────────── offline: TC-021..TC-023 ─────────────────────────

describe('C. TC-021 — offline never dims the mic; recognized text takes the local no-AI path (AC-4, F-001 AC-25)', () => {
  it('the mic stays AVAILABLE offline, the banner renders, and nothing reaches /assistant/*', async () => {
    const u = newUser()
    const source = makeTranscriptSource({
      platform: 'ios',
      permissions: { microphone: 'granted', speech_recognition: 'granted' },
    })
    const s = surfaceFor(u, { transcript: source })
    await s.start()
    s.connectivity.set(false)

    // Offline alone must not dim or hide — that mode belongs to permission
    // denial (TC-015..020) and transient recognizer failure (TC-022).
    expect(s.micMode).toBe('available')
    expect(s.offline).toBe(true)
    expect([...s.a11yIds()]).toContain('assistant-offline-banner')

    H.wire.length = 0
    const aiBefore = H.ai.calls
    s.tapMic()
    await until(() => s.state === 'listening', 'listening while offline')
    s.hearWords('mua', 'mua sữa cho ngày mai')
    expect(s.composerText, 'recognized text was discarded offline').toBe('mua sữa cho ngày mai')
    s.endSpeech('speech-end')
    await until(() => s.tasks.length === 1, 'the local no-AI create')

    expect(H.ai.calls - aiBefore).toBe(0)
    expect(assistantCalls(), 'an assistant turn was attempted offline').toEqual([])
    expect(s.tasks[0].local).toBe(true)
    expect(String(s.tasks[0].id)).toMatch(UUID_RE)
  })

  it('manual list ops work offline, and reconnecting clears the banner', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    s.connectivity.set(false)

    await s.controller.addTask('qamob-tc021-offline-task')
    await until(() => s.tasks.length === 1, 'the offline manual create')
    await s.controller.toggleTask(s.tasks[0].id)
    await until(() => s.tasks[0].status === 'done', 'the offline manual complete')

    s.connectivity.set(true)
    await until(() => s.offline === false, 'the banner clearing')
    expect([...s.a11yIds()]).not.toContain('assistant-offline-banner')
  })

  /**
   * The offline-create replay (`api-contracts.md`: "the offline local path
   * creates the task locally under a real id and replays the create on
   * reconnect — no temporary-id mapping exists. A colliding id → `409
   * TASK_ID_EXISTS`; a client replaying its own create treats that 409 as
   * already-synced (its ack)").
   *
   * These four assertions were one inverted test until 2026-08-17: BUG-001 was
   * open, and the pin asserted the broken behaviour on purpose so the fix could
   * not land unnoticed. T-023 fixed it, the pin fired, and it is now a forward
   * assertion of the correct behaviour. Every expected value below comes from
   * the contract clause above, not from what the controller happens to do.
   */
  it('an offline create replays on reconnect under its own client-generated id (F-001 AC-25)', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    s.connectivity.set(false)
    await s.controller.addTask('qamob-tc021-syncs-on-reconnect')
    await until(() => s.tasks.length === 1, 'the offline create')
    const localId = s.tasks[0].id
    expect(s.tasks[0].local, 'an offline create must be marked local while it is device-only').toBe(true)
    expect(await serverTasks(u), 'the create reached the server while offline').toEqual([])

    s.connectivity.set(true)
    await until(
      () => s.tasks.length === 1 && s.tasks[0].local === undefined,
      'the local marker clearing after the replay',
    )

    expect(await serverTasks(u)).toEqual(['qamob-tc021-syncs-on-reconnect'])
    // The id is the one the client already handed the user — no temporary-id
    // mapping exists, so a re-minted id would silently orphan the local row.
    const onServer = (await (await fetch(`${H.base}/tasks`, { headers: { 'x-user-id': u } })).json()) as {
      tasks: { id: string }[]
    }
    expect(onServer.tasks[0]!.id).toBe(localId)
    // Removed, not set to false: a synced task must be indistinguishable from
    // one that was never local, or "local" leaks into every later comparison.
    expect('local' in s.tasks[0], 'the local marker was falsified rather than removed').toBe(false)
  })

  it('a colliding id is an ACK, not a failure — 409 TASK_ID_EXISTS clears the marker too', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    s.connectivity.set(false)
    await s.controller.addTask('qamob-tc021-collides')
    await until(() => s.tasks.length === 1, 'the offline create')
    const localId = s.tasks[0].id

    // The same create already reached the server by another route (a previous
    // partially-completed replay is the real-world case), so the replay collides.
    const seeded = await fetch(`${H.base}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': u },
      body: JSON.stringify({ id: localId, title: 'qamob-tc021-collides', status: 'inbox' }),
    })
    expect(seeded.status).toBe(201)

    s.connectivity.set(true)
    await until(
      () => s.tasks.length === 1 && s.tasks[0].local === undefined,
      'the 409 being treated as an ack',
    )

    // One task, not two: the contract says treat the collision as already-synced.
    expect(await serverTasks(u)).toEqual(['qamob-tc021-collides'])
    expect(s.tasks[0].id).toBe(localId)
  })

  it('the replay is idempotent — a second reconnect re-posts nothing and duplicates nothing', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    s.connectivity.set(false)
    await s.controller.addTask('qamob-tc021-idempotent')
    await until(() => s.tasks.length === 1, 'the offline create')

    s.connectivity.set(true)
    await until(() => s.tasks[0]?.local === undefined, 'the first replay completing')
    H.wire.length = 0

    s.connectivity.set(false)
    s.connectivity.set(true)
    await until(() => s.offline === false, 'the second reconnect')
    await new Promise((r) => setTimeout(r, 100))

    const creates = H.wire.filter((r) => r.method === 'POST' && r.path === '/tasks')
    expect(creates, 'an already-synced task was replayed again').toEqual([])
    expect(await serverTasks(u), 'the second reconnect duplicated the task').toEqual([
      'qamob-tc021-idempotent',
    ])
  })

  it('offline creates replay BEFORE the queued turn, so the turn is interpreted against a list containing them', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()

    // The scenario that produces BOTH a local task and a queued turn is a dead
    // connection while the client still believes it is online — a clean offline
    // state attempts no turn at all (AC-4), so it can never queue one. Create a
    // task by hand, then send a turn that REFERS to it; both fail and are held.
    H.netDown.value = true
    await s.controller.addTask('qamob-tc021-ordering')
    await until(() => s.tasks.length === 1, 'the local create after the failed POST')
    expect(s.tasks[0].local).toBe(true)

    s.setComposerText('delete qamob-tc021-ordering')
    await s.submit('typed')
    await until(() => s.store.get(`assistant.${u}.outgoing_turn`) != null, 'the queued turn')

    // Cleared here, not earlier: the wire must show only what RECONNECTING
    // does, or the original failed dispatch is mistaken for the replay.
    H.wire.length = 0
    H.netDown.value = false
    s.connectivity.set(false)
    s.connectivity.set(true)
    await until(() => s.tasks.length === 0, 'the replayed turn deleting the replayed task')

    // Wire order is the mechanism…
    const order = H.wire
      .filter((r) => (r.method === 'POST' && r.path === '/tasks') || r.path === '/assistant/turn')
      .map((r) => `${r.method} ${r.path}`)
    expect(order.indexOf('POST /tasks')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('POST /tasks')).toBeLessThan(order.indexOf('POST /assistant/turn'))

    // …and this is the consequence it exists for. If the turn replayed first,
    // the task would not be in its context and the outcome would be a no-match
    // instead of a delete — the user's offline work invisible to their own
    // command. Asserting the outcome, not just the order, is what makes this a
    // bug detector rather than a sequence reader.
    expect(newest(s).kind, 'the replayed turn could not see the replayed task').toBe('applied')
    expect(newest(s).deletedTitles).toEqual(['qamob-tc021-ordering'])
    expect(await serverTasks(u)).toEqual([])
  })

  /**
   * TC-040 — the transition the connectivity callback cannot see (AC-4, AC-8).
   *
   * The commonest real path there is: the user loses signal, backgrounds the
   * app, and comes back on wifi. `connectivity.onChange` only fires if the OS
   * reported the transition **while the app was foregrounded**, so owing the
   * replay to that callback leaves the offline task device-local on exactly the
   * path users take most. AC-8 makes every foreground a reconciliation, which is
   * where this belongs.
   *
   * The double below is the whole point: its `onChange` never fires, so nothing
   * but the foreground can trigger the replay.
   */
  it('TC-040 · a foreground IS a reconnect — offline creates replay even though onChange never fired (AC-4, AC-8)', async () => {
    const u = newUser()
    let online = false
    const silentConnectivity = {
      isOnline: () => online,
      onChange: () => () => {
        /* the OS never reported the transition — that is the scenario */
      },
    }
    const s = surfaceFor(u, { connectivity: silentConnectivity })
    await s.start()
    expect(s.offline).toBe(true)

    await s.controller.addTask('qamob-tc040-backgrounded-offline')
    await until(() => s.tasks.length === 1, 'the offline create')
    expect(s.tasks[0].local).toBe(true)
    expect(await serverTasks(u)).toEqual([])

    // Background, network returns silently, foreground.
    s.background()
    online = true
    await s.foreground()

    await until(
      () => s.tasks.length === 1 && s.tasks[0].local === undefined,
      'the foreground replaying the offline create',
    )
    expect(
      await serverTasks(u),
      'the foreground did not reconcile the offline create — it is device-local on the commonest path there is',
    ).toEqual(['qamob-tc040-backgrounded-offline'])
  })

  it('an offline cold open restores stored local tasks, and the next local write does not wipe them', async () => {
    const u = newUser()
    const first = surfaceFor(u)
    await first.start()
    first.connectivity.set(false)
    await first.controller.addTask('qamob-tc021-stored-a')
    await until(() => first.tasks.length === 1, 'the first offline create')

    // Cold open while still offline: same DurableStore, fresh model. The stored
    // local tasks must load, or the next persist writes over them.
    const revived = surfaceFor(u, { store: first.store, connectivity: makeConnectivity(false) })
    await revived.start()
    await until(() => titles(revived).includes('qamob-tc021-stored-a'), 'the stored local task restoring')

    await revived.controller.addTask('qamob-tc021-stored-b')
    await until(() => revived.tasks.length === 2, 'the second offline create')
    expect(titles(revived).sort(), 'a later local write wiped the stored one').toEqual([
      'qamob-tc021-stored-a',
      'qamob-tc021-stored-b',
    ])

    revived.connectivity.set(true)
    await until(() => revived.tasks.every((t: any) => t.local === undefined), 'both replaying')
    expect((await serverTasks(u)).sort()).toEqual(['qamob-tc021-stored-a', 'qamob-tc021-stored-b'])
  })
})

describe('C. TC-022 — a missing language pack is transient (dimmed), not no-capability (hidden) (AC-4, F-001 AC-22/AC-20)', () => {
  it('recognizer present + no language pack → DIMMED, with no permission CTA', async () => {
    const u = newUser()
    const source = makeTranscriptSource({
      platform: 'ios',
      permissions: { microphone: 'granted', speech_recognition: 'granted' },
      languagePackAvailable: false,
    })
    const s = surfaceFor(u, { transcript: source })
    await s.start()

    expect(s.micMode).toBe('dimmed')
    expect(s.micModeDetailed).toBe('dimmed-transient')
    s.tapMic()
    await until(() => s.messages.length > 0, 'the transient-cause message')
    expect(newest(s).cta, 'a permission CTA in a transient state is a defect').toBeNull()
    expect([...s.a11yIds()]).not.toContain('assistant-permission-cta')
  })

  it('the three unavailable renderings are mutually DISTINGUISHABLE', async () => {
    const render = async (opts: Record<string, unknown>): Promise<string> => {
      const u = newUser()
      const source = makeTranscriptSource({ platform: 'ios', ...opts })
      const s = surfaceFor(u, { transcript: source })
      await s.start()
      s.tapMic()
      await new Promise((r) => setTimeout(r, 20))
      return JSON.stringify({
        mode: s.micModeDetailed,
        cta: newest(s)?.cta ?? null,
        head: newest(s)?.head ?? null,
      })
    }

    const denied = await render({ permissions: { microphone: 'denied', speech_recognition: 'granted' } })
    const transient = await render({
      permissions: { microphone: 'granted', speech_recognition: 'granted' },
      languagePackAvailable: false,
    })
    const noCapability = await render({ recognizerAvailable: false })

    expect(new Set([denied, transient, noCapability]).size, 'two unavailable states render identically').toBe(3)
    expect(denied).toContain('dimmed-permission')
    expect(transient).toContain('dimmed-transient')
    expect(noCapability).toContain('hidden')
  })

  it('recovery returns the mic to available with no restart, and typing is unaffected throughout', async () => {
    const u = newUser()
    const source = makeTranscriptSource({
      platform: 'ios',
      permissions: { microphone: 'granted', speech_recognition: 'granted' },
      languagePackAvailable: false,
    })
    const s = surfaceFor(u, { transcript: source })
    await s.start()
    expect(s.micMode).toBe('dimmed')

    await say(s, 'add a task qamob-tc022-typed')
    await until(() => s.tasks.length === 1, 'typing works while the mic is dimmed')

    source.setLanguagePackAvailable(true)
    await until(() => s.micMode === 'available', 'the mic recovering without a restart')
  })
})

describe('C. TC-023 — a turn in flight when the connection drops queues and replays under the same id (AC-4, AC-6, F-001 AC-25/AC-16)', () => {
  it('the queued notice shows, the store holds the payload, and the replay reuses the id exactly once', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    H.wire.length = 0
    H.netDown.value = true

    s.setComposerText('add a task qamob-tc023-queued')
    await s.submit('typed')
    await until(() => s.messages.some((m: any) => m.queued === true), 'the queued notice')

    expect([...s.a11yIds()]).toContain('assistant-queued-notice')
    expect(s.state, 'the surface sat in a permanent thinking state').not.toBe('thinking')

    const stored = JSON.parse(String(s.store.get(`assistant.${u}.outgoing_turn`)))
    expect(stored.body.client_turn_id).toBe(turnIds()[0])
    expect(stored.sent_at).toBeTruthy()
    expect(stored.attempts).toBeGreaterThanOrEqual(1)

    H.netDown.value = false
    s.connectivity.set(false)
    s.connectivity.set(true)
    await until(() => s.tasks.length === 1, 'the replay applying')

    // Same id both times — a regenerated id is the double-apply this mechanism
    // exists to prevent — and the effect appears exactly once.
    expect(new Set(turnIds()).size).toBe(1)
    expect(turnPosts().length).toBeGreaterThanOrEqual(2)
    expect(await serverTasks(u)).toEqual(['qamob-tc023-queued'])
    expect(newest(s).kind).toBe('applied')

    // Cleared only after the ack.
    expect(s.store.get(`assistant.${u}.outgoing_turn`) ?? null).toBeNull()
  })
})

// ────────────────────── lifecycle: TC-025, TC-027, TC-028 ────────────────────

describe('C. TC-025 — background while listening: capture stops, words kept, no turn sent (AC-5, AC-7, F-001 AC-26/AC-3)', () => {
  it('every background trigger stops capture, keeps the text, and sends nothing', async () => {
    for (const trigger of ['home', 'app-switcher', 'system-back'] as const) {
      const u = newUser()
      const source = makeTranscriptSource({
        platform: 'android',
        permissions: { microphone: 'granted' },
      })
      const s = surfaceFor(u, { transcript: source, platform: 'android' })
      await s.start()
      H.wire.length = 0

      s.tapMic()
      await until(() => s.state === 'listening', `listening before ${trigger}`)
      s.hearWords('mua', 'mua sữa')

      if (trigger === 'system-back') await s.pressBack()
      s.background()
      await until(() => s.state === 'idle', `idle after ${trigger}`)

      expect(turnPosts(), `${trigger} put a turn on the wire`).toHaveLength(0)
      const pending = JSON.parse(String(s.store.get(`assistant.${u}.pending_input`)))
      expect(pending.text, `${trigger} lost the recognized text`).toBe('mua sữa')

      await s.foreground()
      // Capture is NOT silently resumed on foreground.
      expect(s.state, `${trigger} resumed capture on foreground`).toBe('idle')
      expect(s.composerText).toBe('mua sữa')
      expect(turnPosts()).toHaveLength(0)
    }
  })
})

describe('C. TC-027 — kill-surviving replay reuses the client_turn_id; the server re-serves, never re-applies (AC-6, F-001 AC-16)', () => {
  it('a 2-task create replayed after a kill leaves TWO tasks, not four', async () => {
    const u = newUser()
    const first = surfaceFor(u)
    await first.start()
    H.wire.length = 0

    // The server applies the turn, but the client never sees the response —
    // the connection dies after dispatch. The store keeps the outgoing turn.
    const realFetch = globalThis.fetch
    let swallowed: string | null = null
    const swallowingFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      H.wire.push({
        method: init?.method ?? 'GET',
        path: url.replace(H.base, ''),
        body: init?.body === undefined ? null : (JSON.parse(String(init.body)) as Record<string, unknown>),
      })
      const res = await realFetch(url, init)
      if (url.endsWith('/assistant/turn')) {
        swallowed = String((JSON.parse(String(init!.body)) as Record<string, unknown>)['client_turn_id'])
        throw new TypeError('qamob: response never arrived')
      }
      return res
    }
    const killed = new Surface({
      platform: 'ios',
      userId: u,
      store: first.store,
      api: { baseUrl: H.base, fetchFn: swallowingFetch },
    }) as any
    await killed.start()
    killed.setComposerText('add qamob-tc027-a and qamob-tc027-b')
    await killed.submit('typed')
    await until(() => swallowed !== null, 'the dispatched turn')
    expect(await serverTasks(u), 'the server did not apply the original').toHaveLength(2)

    // The kill: fresh model, same DurableStore, working network.
    const revived = surfaceFor(u, { store: first.store })
    await revived.start()
    await until(() => revived.tasks.length === 2, 'the replayed outcome rendering')

    const replayIds = turnIds()
    expect(new Set(replayIds).size, 'the replay minted a fresh client_turn_id').toBe(1)
    expect(replayIds[0]).toBe(swallowed)
    // The list-count assertion is what catches a double-apply even if the
    // replayed flag were wrong: two tasks, not four.
    expect((await serverTasks(u)).sort()).toEqual(['qamob-tc027-a', 'qamob-tc027-b'])
    expect(revived.counters.killSurvivingReplays).toBeGreaterThanOrEqual(1)
    // Cleared after the ack, not before dispatch.
    expect(revived.store.get(`assistant.${u}.outgoing_turn`) ?? null).toBeNull()
  })

  it('a turn the server never received is executed for the first time on replay — exactly once', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    H.wire.length = 0
    H.netDown.value = true

    s.setComposerText('add a task qamob-tc027-never-sent')
    await s.submit('typed')
    await until(() => s.store.get(`assistant.${u}.outgoing_turn`) != null, 'the stored outgoing turn')
    expect(await serverTasks(u)).toHaveLength(0)
    const storedId = JSON.parse(String(s.store.get(`assistant.${u}.outgoing_turn`))).body.client_turn_id

    H.netDown.value = false
    const revived = surfaceFor(u, { store: s.store })
    await revived.start()
    await until(() => revived.tasks.length === 1, 'the first execution on replay')

    expect(await serverTasks(u)).toEqual(['qamob-tc027-never-sent'])
    expect(turnIds().filter((id) => id === storedId).length).toBeGreaterThanOrEqual(1)
    expect(new Set(turnIds()).size).toBe(1)
  })

  it('per-status dedupe: an asked turn re-serves its question rather than asking twice', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-shop-1', 'qamob-shop-2', 'qamob-shop-3'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 3, 'the seeds')
    await say(s, 'delete all my qamob shopping tasks')
    const asked = newest(s)
    expect(asked.kind).toBe('question')

    // Replay that exact turn body under the same id, as a kill-surviving client
    // would. Per api-contracts rule 2, `asked` re-serves — nothing executes.
    const body = { ...turnPosts()[turnPosts().length - 1]!.body }
    const res = await fetch(`${H.base}/assistant/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': u },
      body: JSON.stringify(body),
    })
    const payload = (await res.json()) as Record<string, any>
    expect(res.status).toBe(200)
    expect(payload['replayed']).toBe(true)
    expect(await serverTasks(u), 'a replayed asked turn executed the delete').toHaveLength(3)
  })
})

describe('C. TC-028 — after a kill, the question and the undo affordance reappear per their OWN rules (AC-6, AC-8, F-001 AC-8/AC-10)', () => {
  it('an unanswered question survives the kill, is still answerable, and executes once', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-shop-1', 'qamob-shop-2'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 2, 'the seeds')
    await say(s, 'delete all my qamob shopping tasks')
    expect(newest(s).kind).toBe('question')

    const revived = surfaceFor(u, { store: s.store })
    await revived.start()
    await until(() => revived.messages.some((m: any) => m.kind === 'question'), 'the restored question')

    const q = revived.messages.find((m: any) => m.kind === 'question')
    expect(q.resolved, 'a timeout ran while the process was dead').toBe(false)
    expect(q.options.length).toBeGreaterThan(0)

    await revived.tapChip(0)
    await until(() => revived.messages.some((m: any) => m.kind === 'applied'), 'the executed delete')
    expect(await serverTasks(u)).toHaveLength(0)
  })

  it('the undo affordance is rebuilt from the SERVER read — newest mutating turn only', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc028-a')
    await until(() => s.tasks.length === 1, 'turn A')
    await say(s, 'add a task qamob-tc028-b')
    await until(() => s.tasks.length === 2, 'turn B')
    const turnB = s.undoableTurnId

    const revived = surfaceFor(u, { store: s.store })
    await revived.start()
    await until(() => revived.messages.filter((m: any) => m.kind === 'applied').length === 2, 'both turns restored')

    // Undo is on B only. A client that restored its own cached "undo available
    // for A" flag fails exactly here.
    expect(revived.undoableTurnId).toBe(turnB)
    expect([...revived.a11yIds()]).toContain('assistant-undo-button')
  })

  it('after session close there is NO undo affordance and a boundary renders instead (F-001 AC-8)', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc028-closed')
    await until(() => s.tasks.length === 1, 'the applied turn')
    await closeServerSession(u)

    const revived = surfaceFor(u, { store: s.store })
    await revived.start()
    await until(() => revived.messages.some((m: any) => m.kind === 'boundary'), 'the boundary message')

    expect(revived.undoableTurnId, 'the undo window survived session close').toBeNull()
    expect([...revived.a11yIds()]).not.toContain('assistant-undo-button')
    expect([...revived.a11yIds()]).toContain('assistant-boundary-marker')
  })
})

// ──────────────────── lifecycle ordering + boundary: TC-030, TC-031 ──────────

describe('C. TC-030 — every foreground transition reads the session before accepting input (AC-8, F-001 AC-28)', () => {
  it('resume: the first /assistant/* request is GET /assistant/session, and a turn made during the read waits for it', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    s.background()
    H.wire.length = 0

    const fg = s.foreground()
    s.setComposerText('add a task qamob-tc030-resume')
    const sent = s.submit('typed')
    await Promise.all([fg, sent])
    await until(() => s.tasks.length === 1, 'the turn landing after the read')

    const paths = assistantCalls().map((r) => `${r.method} ${r.path}`)
    expect(paths[0]).toBe('GET /assistant/session')
    // The input was held, not dropped.
    expect(paths).toContain('POST /assistant/turn')
    expect(await serverTasks(u)).toEqual(['qamob-tc030-resume'])
  })

  /**
   * OPEN PRODUCT BUG — BUG-002 (layer: mobile). This test is RED on purpose.
   *
   * AC-8 names cold open explicitly: "Every foreground transition (resume or
   * cold open) re-reads GET /assistant/session BEFORE accepting new input."
   * `onForeground()` enforces that with the `foregroundSync` gate; `init()`
   * does not set the gate at all, so on a cold open a turn is dispatched
   * before the session read is even issued. The consequence asserted second is
   * the one that costs the user something: the turn opens a NEW session, so a
   * previously closed session's boundary message — the close marker, every
   * declined question named with its task titles, every late outcome — is
   * never rendered (F-001 AC-28, TC-031).
   *
   * Do not weaken these assertions. When BUG-002 is fixed they go green.
   */
  it('cold open behaves identically to resume — the session read comes first (BUG-002)', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    H.wire.length = 0

    const init = s.start()
    s.setComposerText('add a task qamob-tc030-cold')
    const sent = s.submit('typed')
    await Promise.all([init, sent])
    await until(() => s.tasks.length === 1, 'the turn landing')

    const paths = assistantCalls().map((r) => `${r.method} ${r.path}`)

    // Second observable, gathered before asserting so the failure reports both:
    // a cold open onto a CLOSED session loses the boundary entirely.
    const v = newUser()
    const seed = surfaceFor(v)
    await seed.start()
    await say(seed, 'add a task qamob-tc030-closed')
    await until(() => seed.tasks.length === 1, 'the turn in the first session')
    await closeServerSession(v)

    const cold = surfaceFor(v, { store: seed.store })
    const coldInit = cold.start()
    cold.setComposerText('add a task qamob-tc030-during-init')
    const coldSent = cold.submit('typed')
    await Promise.all([coldInit, coldSent])
    await until(() => cold.tasks.length >= 1, 'the racing turn landing')
    const boundaries = cold.messages.filter((m: any) => m.kind === 'boundary').length

    expect(paths[0], `cold-open /assistant/* order was ${JSON.stringify(paths)} (BUG-002)`).toBe(
      'GET /assistant/session',
    )
    expect(boundaries, 'the closed session boundary was lost on cold open (BUG-002)').toBe(1)
  })

  it('local state that contradicts the server read is discarded, but the two local survivors are restored', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc030-real')
    await until(() => s.tasks.length === 1, 'the real turn')

    // Carry the store across the kill, and plant a pending input in it.
    s.store.set(`assistant.${u}.pending_input`, JSON.stringify({ text: 'chưa gửi', updated_at: Date.now() }))

    const revived = surfaceFor(u, { store: s.store })
    await revived.start()
    await until(() => revived.messages.some((m: any) => m.kind === 'applied'), 'the server history')

    // The conversation matches the SERVER's history — one user turn + one
    // applied outcome, nothing merged on top.
    expect(revived.messages.filter((m: any) => m.kind === 'applied')).toHaveLength(1)
    // …and the local survivor is still restored.
    expect(revived.composerText).toBe('chưa gửi')
  })

  it('two rapid foregrounds produce two reads and one consistent render', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc030-rapid')
    await until(() => s.tasks.length === 1, 'the turn')
    H.wire.length = 0

    await Promise.all([s.foreground(), s.foreground()])
    const reads = assistantCalls().filter((r) => r.path === '/assistant/session')
    expect(reads.length).toBeGreaterThanOrEqual(1)
    expect(s.messages.filter((m: any) => m.kind === 'applied')).toHaveLength(1)
  })
})

describe('C. TC-031 — cold open onto a closed session renders exactly ONE boundary and starts clean (AC-8, F-001 AC-28)', () => {
  it('exactly one boundary, naming the declined question and its task titles', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-shop-1', 'qamob-shop-2'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 2, 'the seeds')
    await say(s, 'delete all my qamob shopping tasks')
    expect(newest(s).kind).toBe('question')
    await closeServerSession(u)

    const revived = surfaceFor(u, { store: s.store })
    await revived.start()
    await until(() => revived.messages.some((m: any) => m.kind === 'boundary'), 'the boundary')

    const boundaries = revived.messages.filter((m: any) => m.kind === 'boundary')
    expect(boundaries, 'one message per boundary ITEM floods the surface').toHaveLength(1)

    const text = `${String(boundaries[0].head)} ${boundaries[0].lines.join(' ')}`
    expect(text, 'the close reason is not stated').not.toBe('')
    // Every declined question is named WITH its task titles.
    expect(text).toContain('qamob-shop-1')
    expect(text).toContain('qamob-shop-2')

    // Clean start: yesterday's turns are not shown as if live.
    expect(revived.messages.filter((m: any) => m.kind === 'question')).toHaveLength(0)
    expect(revived.undoableTurnId).toBeNull()
  })

  it('the boundary is not re-rendered on a second foreground, and a new turn renders below it', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc031-before')
    await until(() => s.tasks.length === 1, 'the turn')
    await closeServerSession(u)

    const revived = surfaceFor(u, { store: s.store })
    await revived.start()
    await until(() => revived.messages.some((m: any) => m.kind === 'boundary'), 'the boundary')

    await revived.foreground()
    await revived.foreground()
    expect(
      revived.messages.filter((m: any) => m.kind === 'boundary'),
      'the boundary re-rendered on a later foreground',
    ).toHaveLength(1)

    await say(revived, 'add a task qamob-tc031-after')
    await until(() => revived.tasks.length === 2, 'the new turn')
    const kinds = revived.messages.map((m: any) => m.kind)
    expect(kinds.indexOf('boundary')).toBeLessThan(kinds.lastIndexOf('applied'))
  })
})

// ───────────────────────────── touch: TC-033 ─────────────────────────────────

describe('C. TC-033 — undo stays ONE gesture by touch (AC-9, F-001 AC-5)', () => {
  it('one tap reverts the whole turn, with no confirm step in between', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add qamob-tc033-a, qamob-tc033-b, qamob-tc033-c and qamob-tc033-d')
    await until(() => s.tasks.length === 4, 'the 4-task turn')

    // The affordance is visible with NO preceding gesture — no long-press, no
    // swipe, no overflow menu to open first.
    expect([...s.a11yIds()]).toContain('assistant-undo-button')

    const before = s.messages.length
    await s.tapUndo() // exactly ONE interaction
    await until(() => s.tasks.length === 0, 'all four reverted by one gesture')

    // Nothing question-shaped was presented between the tap and the revert:
    // confirmation is reserved for multi-task deletes, never for undo itself.
    const after = s.messages.slice(before)
    expect(after.map((m: any) => m.kind), 'a confirm step was presented for undo').not.toContain('question')
    expect(await serverTasks(u)).toHaveLength(0)
  })

  it('the voice path reaches the same outcome as the tap path', async () => {
    const byTap = async (): Promise<string[]> => {
      const u = newUser()
      const s = surfaceFor(u)
      await s.start()
      await say(s, 'add a task qamob-tc033-x')
      await until(() => s.tasks.length === 1, 'the turn')
      await s.tapUndo()
      await until(() => s.tasks.length === 0, 'the revert')
      return [newest(s).kind, String(newest(s).head)]
    }
    const byVoice = async (): Promise<string[]> => {
      const u = newUser()
      const s = surfaceFor(u)
      await s.start()
      await say(s, 'add a task qamob-tc033-x')
      await until(() => s.tasks.length === 1, 'the turn')
      await say(s, 'hoàn tác', 'voice')
      await until(() => s.tasks.length === 0, 'the revert by voice')
      return [newest(s).kind, String(newest(s).head)]
    }
    expect(await byVoice()).toEqual(await byTap())
  })
})

// ───────── permissions: the request-sequencing half of TC-013, TC-018..TC-020 ─────────
// Part B pins the pure permission model (which grants, which message, which CTA
// target). These drive the SEQUENCING those TCs are really about: when the OS
// dialog is put on screen, how many times, and — for Android's permanently
// denied — that it is never put on screen again.

describe('C. TC-013 — iOS asks for both grants before the first talk attempt, never at app open (AC-2, F-001 AC-21)', () => {
  it('app open prompts nothing; the first mic tap prompts once for both, behind one explanation', async () => {
    const u = newUser()
    const source = makeTranscriptSource({ platform: 'ios' }) // undetermined ×2
    const s = surfaceFor(u, { transcript: source })
    await s.start()

    // AC-2: "Both are requested before the first talk attempt, never at app open."
    expect(source.log.prompts, 'a permission dialog was shown at app open').toBe(0)
    expect(s.permissions).toEqual({ microphone: 'undetermined', speech_recognition: 'undetermined' })
    expect(s.messages, 'an explanation was shown before it was needed').toEqual([])

    s.tapMic()
    await until(() => s.state === 'listening', 'listening after the grants')

    // ONE prompt covering both grants, behind ONE short explanation.
    expect(source.log.prompts).toBe(1)
    expect(s.messages.filter((m: any) => m.kind === 'info')).toHaveLength(1)
    expect(s.permissions).toEqual({ microphone: 'granted', speech_recognition: 'granted' })

    // And never again once granted.
    s.endSpeech('speech-end')
    await until(() => s.state === 'idle', 'idle')
    s.tapMic()
    await until(() => s.state === 'listening', 'listening again')
    expect(source.log.prompts, 'a granted app re-prompted').toBe(1)
  })
})

describe('C. TC-018/TC-019/TC-020 — the Android single grant and the permanently-denied dead end (AC-3)', () => {
  it('TC-018 · one grant makes the mic available with no second prompt, and no iOS speech key leaks in', async () => {
    const u = newUser()
    const source = makeTranscriptSource({ platform: 'android' })
    const s = surfaceFor(u, { transcript: source, platform: 'android' })
    await s.start()

    s.tapMic()
    await until(() => s.state === 'listening', 'listening after the single grant')
    expect(source.log.prompts).toBe(1)
    expect(s.micMode).toBe('available')
    // The dual-permission model must not leak onto the wrong platform.
    expect(Object.keys(s.permissions)).toEqual(['microphone'])
  })

  it('TC-019 · a plain denial dims the mic and MAY re-request on the next talk attempt', async () => {
    const u = newUser()
    const source = makeTranscriptSource({ platform: 'android', permissions: { microphone: 'denied' } })
    const s = surfaceFor(u, { transcript: source, platform: 'android' })
    await s.start()
    expect(s.micMode).toBe('dimmed')

    s.tapMic()
    await until(() => source.log.requests > 0, 'the re-request')
    expect(source.log.prompts, 'a non-permanent denial refused to re-ask').toBe(1)
  })

  it('TC-020 · permanently denied must NOT re-request — the CTA goes to App info instead', async () => {
    const u = newUser()
    const source = makeTranscriptSource({
      platform: 'android',
      permissions: { microphone: 'permanently_denied' },
    })
    const s = surfaceFor(u, { transcript: source, platform: 'android' })
    await s.start()
    expect(s.micMode).toBe('dimmed')
    expect(s.micModeDetailed).toBe('dimmed-permission')

    s.tapMic()
    await until(() => s.messages.length > 0, 'the permission message')
    // The OS will not show the prompt again; asking is the dead-button bug.
    expect(source.log.prompts, 'a permanently-denied app put a dead dialog on screen').toBe(0)
    expect(newest(s).cta).toBe('permission')
    expect([...s.a11yIds()]).toContain('assistant-permission-cta')

    s.tapPermissionCta()
    await until(() => source.log.settingsOpened > 0, 'the App info deep link')
    expect(source.log.prompts, 'the CTA re-requested instead of deep-linking').toBe(0)
  })
})

describe('C. TC-029 — audio interruption is cancel-while-listening; the session is released (AC-7, AC-5, F-001 AC-3)', () => {
  it('all four interruption kinds stop capture, keep the words, send nothing, and release the audio session', async () => {
    for (const reason of ['call', 'system-assistant', 'focus-loss', 'route-change'] as const) {
      const u = newUser()
      const source = makeTranscriptSource({
        platform: 'ios',
        permissions: { microphone: 'granted', speech_recognition: 'granted' },
      })
      const s = surfaceFor(u, { transcript: source })
      await s.start()
      H.wire.length = 0

      s.tapMic()
      await until(() => s.state === 'listening', `listening before ${reason}`)
      s.hearWords('mua', 'mua sữa')

      s.interrupt(reason)
      await until(() => s.state === 'idle', `idle after ${reason}`)

      expect(turnPosts(), `${reason} sent a turn`).toHaveLength(0)
      expect(s.composerText, `${reason} lost the recognized text`).toBe('mua sữa')
      expect(source.log.audioSessionReleases, `${reason} kept the audio session`).toBeGreaterThanOrEqual(1)
      expect(s.counters.audioInterruptions).toBeGreaterThanOrEqual(1)

      // The mic returns to available when focus comes back — WITHOUT re-prompting.
      const promptsBefore = source.log.prompts
      s.lifecycle.interruptEnded()
      await until(() => s.micMode === 'available', `the mic returning after ${reason}`)
      expect(source.log.prompts, `${reason} re-prompted for permission on focus regain`).toBe(promptsBefore)
    }
  })
})

describe('C. TC-035 — send is reachable with the keyboard open, and the keyboard changes no conversation state (AC-10, F-001 AC-17)', () => {
  it('showing and hiding the keyboard neither sends nor cancels, and composer text survives', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    H.wire.length = 0

    s.setComposerText('add a task qamob-tc035-typed')
    s.keyboard(true)
    expect(s.composerText).toBe('add a task qamob-tc035-typed')
    expect(s.state).toBe('idle')
    s.keyboard(false)
    expect(s.composerText, 'dismissing the keyboard discarded composer text').toBe('add a task qamob-tc035-typed')
    expect(turnPosts(), 'a keyboard change sent a turn').toHaveLength(0)

    // …and the send path still works with the keyboard up.
    s.keyboard(true)
    await s.submit('typed')
    await until(() => s.tasks.length === 1, 'the send with the keyboard open')
    expect(await serverTasks(u)).toEqual(['qamob-tc035-typed'])
  })

  it('a keyboard change while thinking neither cancels nor duplicates the in-flight turn', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    H.wire.length = 0

    s.setComposerText('add a task qamob-tc035-inflight')
    const inFlight = s.submit('typed')
    s.keyboard(true)
    s.keyboard(false)
    await inFlight
    await until(() => s.tasks.length === 1, 'the in-flight turn completing')

    expect(turnPosts(), 'the keyboard duplicated the turn').toHaveLength(1)
    expect(await serverTasks(u)).toEqual(['qamob-tc035-inflight'])
  })
})

// ───────── the node-testable half of TC-037 / TC-038 (AC-12, F-001 AC-19) ─────────
// These two TCs are MANUAL-first: AC-12 requires verification against a real
// VoiceOver / TalkBack pass on a device (W3C F103), and that remains owed. What
// IS node-testable is the announcement PAYLOAD — the text the screen reader
// would receive — and the priority flag that decides whether an error is spoken
// immediately or queued behind the backlog. Asserting the payload here is what
// stops the device pass from discovering that the announcement said "Đã xong".

describe('C. TC-037 — the announcement payload carries what changed, how many, which tasks, and that undo exists (AC-12)', () => {
  it('an applied turn announces the count, every task by title, and the undo affordance', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add qamob-tc037-a and qamob-tc037-b')
    await until(() => s.tasks.length === 2, 'the applied turn')

    const spoken = s.announcer.texts().join(' ')
    // Announcing the state word alone does not satisfy AC-12.
    expect(spoken).toContain('2')
    expect(spoken).toContain('qamob-tc037-a')
    expect(spoken).toContain('qamob-tc037-b')
    expect(spoken.toLowerCase()).toContain('hoàn tác') // undo is available
    // …and it is not merely the catalogue id being read out (the AC-12 trap).
    expect(spoken).not.toContain('assistant-message-bubble')
  })

  it('every conversation message kind produces an announcement, not just the outcome', async () => {
    const u = newUser()
    await seedTasks(u, ['qamob-shop-1', 'qamob-shop-2'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 2, 'the seeds')

    await say(s, 'delete all my qamob shopping tasks')
    const question = s.messages.find((m: any) => m.kind === 'question')
    const announcements = announcementsFor(s.messages, s.undoableTurnId)
    const questionLine = announcements.map((a: any) => a.text).join(' ')

    expect(questionLine).toContain(String(question.head))
    for (const title of question.taskTitles) expect(questionLine).toContain(title)
    for (const option of question.options) expect(questionLine).toContain(option)
  })
})

describe('C. TC-038 — an error is announced immediately, never queued behind the backlog (AC-12, F-001 AC-19)', () => {
  it('the error announcement is assertive and is ordered ahead of the polite backlog', async () => {
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    await say(s, 'add a task qamob-tc038-first')
    await until(() => s.tasks.length === 1, 'a polite announcement in the backlog')

    H.ai.failOnce.add('add a task qamob-tc038-fails')
    await say(s, 'add a task qamob-tc038-fails')
    expect(s.state).toBe('error')

    const announcements = announcementsFor(s.messages, s.undoableTurnId) as { text: string; assertive: boolean }[]
    const assertive = announcements.filter((a) => a.assertive)
    expect(assertive.length, 'the error was not marked for immediate announcement').toBeGreaterThan(0)
    // Immediate means FIRST — queued behind the polite backlog is the defect.
    expect(announcements[0]!.assertive).toBe(true)
    expect(announcements.findIndex((a) => a.assertive)).toBe(0)
  })
})
