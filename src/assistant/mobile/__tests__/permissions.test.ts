// F-003 AC-2 (iOS dual grant), AC-3 (Android single grant + permanently
// denied), AC-4 (offline / missing language pack).
//
// The spec's Test strategy says the permission matrix is ENUMERATED, not
// sampled: iOS ×4, Android ×3, plus no-capability and transient failure. Every
// row below is one of those, driven through the real controller against the
// port double — no device, no OS dialog.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { micMode } from '../../_shared/model/reducer.ts'
import type { PermissionState } from '../../_shared/model/client-stores.ts'
import {
  canRequest,
  ctaTarget,
  deniedRowFor,
  explanationRowFor,
  permissionCopyRow,
  permissionCtaLabel,
  permissionDeniedMessageFor,
  permissionExplanationMessage,
} from '../model/permissions.ts'
import type { MobilePlatform, PermissionCopyRow } from '../model/permissions.ts'
import { T0, mobileHarness, settle, turnResponse } from './_helpers.ts'
import type { MobileHarness } from './_helpers.ts'

/** Any timestamp — these assertions are about copy, not time. */
const T = T0

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const CATALOGUE_FILE = resolve(ROOT, 'design/_shared/components.md')

const IOS_MATRIX: { name: string; perms: PermissionState; names: string[] }[] = [
  {
    name: 'iOS 1/4 — both granted',
    perms: { microphone: 'granted', speech_recognition: 'granted' },
    names: [],
  },
  {
    name: 'iOS 2/4 — microphone denied',
    perms: { microphone: 'denied', speech_recognition: 'granted' },
    names: ['Microphone'],
  },
  {
    name: 'iOS 3/4 — speech recognition denied',
    perms: { microphone: 'granted', speech_recognition: 'denied' },
    names: ['Speech Recognition'],
  },
  {
    name: 'iOS 4/4 — both denied',
    perms: { microphone: 'denied', speech_recognition: 'denied' },
    names: ['Microphone', 'Speech Recognition'],
  },
]

/** The level of a markdown ATX heading, or 0 when the line is not a heading. */
function headingLevel(line: string): number {
  const m = /^(#{1,6})\s/.exec(line)
  return m === null ? 0 : (m[1] as string).length
}

/**
 * The lines of the section this file reads — from its heading to the next
 * heading of the same or higher level. Scoping is not cosmetic: the permission
 * table is not the only `| **ID** | … |` table in `components.md` (§ Spoken
 * frames, owned by F-002, has one whose escaped `\|` splits into the same four
 * cells), so a whole-file scan silently adopts whatever a later section adds.
 * Cutting at the next heading puts every future section out of scope by
 * construction rather than by an exclusion list that has to be maintained.
 *
 * Throws rather than returning nothing if the heading moves or is ambiguous: a
 * parser that matches nothing is green exactly like one that works (L-007).
 */
function sectionLines(md: string, heading: RegExp): string[] {
  const lines = md.split('\n')
  const starts = lines.flatMap((l, i) => (heading.test(l) && headingLevel(l) > 0 ? [i] : []))
  if (starts.length !== 1) {
    throw new Error(
      `${CATALOGUE_FILE}: expected exactly one heading matching ${heading} — found ${starts.length}`,
    )
  }
  const start = starts[0] as number
  const level = headingLevel(lines[start] as string)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => {
    const lvl = headingLevel(l)
    return lvl > 0 && lvl <= level
  })
  return end === -1 ? rest : rest.slice(0, end)
}

/**
 * The published catalogue, PARSED — never hand-copied (L-002: a hand-copied
 * expectation turns a contract check into a self-agreement check). Design owns
 * these strings in `design/_shared/components.md` § MicControl →
 * "Permission copy"; if this file retyped them, the two copies could drift and
 * every test would still pass. Only that section is read — see `sectionLines`.
 */
function publishedRows(): Map<string, { head: string; body: string; cta: string | null }> {
  const md = readFileSync(CATALOGUE_FILE, 'utf8')
  const rows = new Map<string, { head: string; body: string; cta: string | null }>()
  for (const line of sectionLines(md, /^#{1,6}\s+Permission copy\b/)) {
    const m = /^\|\s*\*\*([A-Z-]+)\*\*\s*\|(.*)\|\s*$/.exec(line)
    if (m === null) continue
    const cells = (m[2] as string).split('|').map((c) => c.trim())
    if (cells.length !== 4) continue // not the permission table's shape
    const [, head, body, cta] = cells as [string, string, string, string]
    rows.set(m[1] as string, { head, body, cta: cta === '—' ? null : cta })
  }
  if (rows.size === 0) {
    throw new Error(
      `${CATALOGUE_FILE}: the Permission copy section parsed to zero rows — the table's shape moved`,
    )
  }
  return rows
}

const PUBLISHED = publishedRows()

function infoMessages(h: MobileHarness) {
  return h.controller.state.messages.filter((m) => m.kind === 'info')
}

function lastInfo(h: MobileHarness) {
  const infos = infoMessages(h)
  return infos[infos.length - 1]
}

describe('permission copy is design\'s, cited by row ID — this file owns only the selection', () => {
  const IDS: PermissionCopyRow[] = [
    'IOS-ASK',
    'IOS-MIC',
    'IOS-MIC-UNASKED',
    'IOS-SPEECH',
    'IOS-BOTH',
    'AND-ASK',
    'AND-DENIED',
    'AND-PERMANENT',
  ]

  it('the catalogue publishes exactly the rows the code knows about', () => {
    expect([...PUBLISHED.keys()].sort()).toEqual([...IDS].sort())
  })

  for (const id of IDS) {
    it(`${id} is quoted verbatim from design/_shared/components.md`, () => {
      const published = PUBLISHED.get(id)
      expect(published, `row ${id} is missing from the catalogue`).toBeDefined()
      const local = permissionCopyRow(id)
      expect(local.head).toBe(published?.head)
      expect(local.body[0]).toBe(published?.body)
      expect(local.cta).toBe(published?.cta ?? null)
    })
  }

  it('the fixed closer follows the row family, not the row', () => {
    // Typing is unaffected in EVERY combination (AC-2) — the catalogue states
    // one closer for denial rows and one for request rows.
    for (const id of ['IOS-ASK', 'AND-ASK'] as PermissionCopyRow[]) {
      expect(permissionCopyRow(id).body[1]).toBe(
        'Typing still works as usual if you would rather not grant it.',
      )
    }
    for (const id of [
      'IOS-MIC',
      'IOS-MIC-UNASKED',
      'IOS-SPEECH',
      'IOS-BOTH',
      'AND-DENIED',
      'AND-PERMANENT',
    ] as PermissionCopyRow[]) {
      expect(permissionCopyRow(id).body[1]).toBe('Typing still works as usual.')
    }
  })

  it('IOS-MIC-UNASKED does NOT promise that the mic alone restores the feature', () => {
    // Every other denial row closes on "the mic lights up again". Here that
    // would be a lie: enabling the microphone leaves speech recognition still
    // unanswered, so the row promises the remaining question instead.
    const row = permissionCopyRow('IOS-MIC-UNASKED')
    expect(row.body[0]).not.toContain('the mic lights up again')
    for (const id of ['IOS-MIC', 'IOS-SPEECH', 'IOS-BOTH'] as PermissionCopyRow[]) {
      expect(permissionCopyRow(id).body[0]).toContain('the mic lights up again')
    }
  })

  it('every enumerated tuple selects its catalogue row', () => {
    expect(explanationRowFor('ios')).toBe('IOS-ASK')
    expect(explanationRowFor('android')).toBe('AND-ASK')

    const cases: [MobilePlatform, PermissionState, PermissionCopyRow][] = [
      ['ios', { microphone: 'denied', speech_recognition: 'granted' }, 'IOS-MIC'],
      ['ios', { microphone: 'denied', speech_recognition: 'undetermined' }, 'IOS-MIC-UNASKED'],
      ['ios', { microphone: 'granted', speech_recognition: 'denied' }, 'IOS-SPEECH'],
      ['ios', { microphone: 'denied', speech_recognition: 'denied' }, 'IOS-BOTH'],
      ['android', { microphone: 'denied' }, 'AND-DENIED'],
      ['android', { microphone: 'permanently_denied' }, 'AND-PERMANENT'],
    ]
    for (const [platform, perms, expected] of cases) {
      expect(deniedRowFor(platform, perms), `${platform} ${JSON.stringify(perms)}`).toBe(expected)
      // …and the message the controller renders IS that row.
      const msg = permissionDeniedMessageFor(platform, perms, T)
      expect(msg?.kind === 'info' && msg.body[0]).toBe(PUBLISHED.get(expected)?.body)
    }
    const ask = permissionExplanationMessage('ios', T)
    expect(ask.kind === 'info' && ask.body[0]).toBe(PUBLISHED.get('IOS-ASK')?.body)
  })

  it('the CTA label of every denial row is the label design put on that row', () => {
    const cases: [MobilePlatform, PermissionState][] = [
      ['ios', { microphone: 'denied', speech_recognition: 'granted' }],
      ['ios', { microphone: 'denied', speech_recognition: 'undetermined' }],
      ['ios', { microphone: 'granted', speech_recognition: 'denied' }],
      ['ios', { microphone: 'denied', speech_recognition: 'denied' }],
      ['android', { microphone: 'denied' }],
      ['android', { microphone: 'permanently_denied' }],
    ]
    for (const [platform, perms] of cases) {
      const row = deniedRowFor(platform, perms) as PermissionCopyRow
      expect(permissionCtaLabel(platform, perms), `${platform} → ${row}`).toBe(
        PUBLISHED.get(row)?.cta,
      )
    }
    // The rule the catalogue states in words: "Allow microphone" promises a
    // prompt, so it appears on AND-DENIED and nowhere else.
    const promising = cases.filter(
      ([p, perms]) => permissionCtaLabel(p, perms) === PUBLISHED.get('AND-DENIED')?.cta,
    )
    expect(promising.map(([, perms]) => perms)).toEqual([{ microphone: 'denied' }])
  })

  /**
   * The tuple that was provisional until design ruled on it: mic refused, so
   * the speech dialog was never reached. It is a resting state with its own
   * row, not a state to design away — see the note at the foot of
   * model/permissions.ts.
   */
  it('mic denied + speech undetermined is IOS-MIC-UNASKED, and claims no grant the user never gave', () => {
    const partial: PermissionState = {
      microphone: 'denied',
      speech_recognition: 'undetermined',
    }
    expect(deniedRowFor('ios', partial)).toBe('IOS-MIC-UNASKED')
    const msg = permissionDeniedMessageFor('ios', partial, T)
    expect(msg?.kind === 'info' && msg.body[0]).toBe(PUBLISHED.get('IOS-MIC-UNASKED')?.body)
    // It must not borrow IOS-MIC's parenthetical, which asserts the speech
    // grant was given.
    expect(msg?.kind === 'info' && msg.body.join(' ')).not.toContain('is already allowed')
  })

  /**
   * The CTA rule, stated as selection rather than copy: on iOS ANY denial
   * routes to Settings. Deriving it from "is some grant still askable"
   * (`canRequest`) is true in the IOS-MIC-UNASKED tuple and yields
   * "Allow microphone" — a button promising a microphone prompt iOS will never
   * show, spending its one remaining dialog on a capability that is inert
   * without the grant just declined.
   */
  it('iOS routes every denial to Settings, never to a re-request', () => {
    const tuples: PermissionState[] = [
      { microphone: 'denied', speech_recognition: 'granted' },
      { microphone: 'denied', speech_recognition: 'undetermined' },
      { microphone: 'granted', speech_recognition: 'denied' },
      { microphone: 'denied', speech_recognition: 'denied' },
    ]
    for (const perms of tuples) {
      expect(ctaTarget('ios', perms), JSON.stringify(perms)).toBe('settings')
      expect(permissionCtaLabel('ios', perms)).toBe('Open Settings')
    }
    // …even though iOS would still show the speech dialog in that one tuple:
    // "askable" is a true fact about the OS and the wrong basis for the button.
    expect(canRequest('ios', { microphone: 'denied', speech_recognition: 'undetermined' })).toBe(
      true,
    )
  })

  it('nothing denied renders no message at all, whatever is still undetermined', () => {
    // The normal mid-flow state between iOS's two dialogs. `allGranted` is
    // false here, but nothing was refused — telling the user they turned
    // something off would be false, and `undetermined` is never "missing".
    const midFlow: PermissionState = { microphone: 'granted', speech_recognition: 'undetermined' }
    expect(deniedRowFor('ios', midFlow)).toBeNull()
    expect(permissionDeniedMessageFor('ios', midFlow, T)).toBeNull()
    expect(ctaTarget('ios', midFlow)).toBeNull()
    expect(deniedRowFor('ios', { microphone: 'undetermined', speech_recognition: 'undetermined' }))
      .toBeNull()
    expect(deniedRowFor('android', { microphone: 'undetermined' })).toBeNull()
  })

  it('the controller renders nothing when a request resolves one grant and leaves the other unasked', async () => {
    // End to end through the real controller: iOS grants the microphone and
    // returns before the speech dialog. No denial message may appear, and the
    // mic stays available so the next talk attempt asks the rest.
    const h = await mobileHarness({
      platform: 'ios',
      permissions: { microphone: 'undetermined', speech_recognition: 'undetermined' },
      grantOn: () => ({ microphone: 'granted', speech_recognition: 'undetermined' }),
    })
    await h.controller.init()

    h.controller.tapMic()
    await settle()

    const infos = infoMessages(h)
    // Only the explanation that precedes the request — no denial after it.
    expect(infos.map((m) => (m.kind === 'info' ? m.head : ''))).toEqual([
      'Asking for microphone access',
    ])
    expect(micMode(h.controller.state)).not.toBe('dimmed-permission')
  })

  it('no message body is derived — every published body appears literally in the model', () => {
    // The ownership rule with teeth: if a row were interpolated from a template
    // again, its literal would not be in the source and design's edit to the
    // catalogue would silently stop reaching the app.
    const src = readFileSync(resolve(ROOT, 'src/assistant/mobile/model/permissions.ts'), 'utf8')
    for (const id of IDS) {
      expect(src, `${id} is not a literal in permissions.ts`).toContain(
        PUBLISHED.get(id)?.body as string,
      )
    }
  })
})

describe('AC-2 — iOS requires two grants, asked once, before the first talk attempt', () => {
  it('asks for NOTHING at app open, then covers both grants behind one explanation at the first mic tap', async () => {
    const h = await mobileHarness({
      platform: 'ios',
      permissions: { microphone: 'undetermined', speech_recognition: 'undetermined' },
    })
    await h.controller.init()

    // F-001 AC-21: never at app open.
    expect(h.speech.log.prompts).toBe(0)
    expect(infoMessages(h)).toHaveLength(0)

    h.controller.tapMic()
    await settle()

    // One explanation covering both, then one OS request covering both.
    const explanation = infoMessages(h)[0]
    expect(explanation?.kind === 'info' && explanation.head).toBe('Asking for microphone access')
    expect(explanation?.kind === 'info' && explanation.body.join(' ')).toContain(
      'Speech Recognition',
    )
    expect(h.speech.log.prompts).toBe(1)
    expect(h.controller.permissions()).toEqual({
      microphone: 'granted',
      speech_recognition: 'granted',
    })
    // …and the capture actually starts once both are granted.
    expect(h.controller.state.surface).toBe('listening')
  })

  it('records each grant separately in client.permission_state, and it survives a kill', async () => {
    const h = await mobileHarness({
      platform: 'ios',
      permissions: { microphone: 'granted', speech_recognition: 'denied' },
    })
    await h.controller.init()
    await settle(h.store)

    expect(h.stores.permissionState()).toEqual({
      microphone: 'granted',
      speech_recognition: 'denied',
    })

    const reopened = await h.relaunch()
    expect(reopened.stores.permissionState()).toEqual({
      microphone: 'granted',
      speech_recognition: 'denied',
    })
  })

  for (const row of IOS_MATRIX) {
    it(`${row.name} → ${row.names.length === 0 ? 'available' : 'dimmed (never hidden), naming the missing capability'}`, async () => {
      const h = await mobileHarness({ platform: 'ios', permissions: row.perms })
      await h.controller.init()

      if (row.names.length === 0) {
        expect(micMode(h.controller.state)).toBe('available')
        h.controller.tapMic()
        await settle()
        expect(h.controller.state.surface).toBe('listening')
        expect(h.speech.log.prompts).toBe(0) // already granted → no dialog
        return
      }

      // ANY partial denial dims — it never hides (AC-2, F-001 AC-21).
      expect(micMode(h.controller.state)).toBe('dimmed-permission')

      h.controller.tapMic()
      await settle()
      expect(h.controller.state.surface).toBe('idle') // no capture
      const msg = lastInfo(h)
      expect(msg?.kind === 'info' && msg.cta).toBe('permission')
      for (const name of row.names) {
        expect(msg?.kind === 'info' && msg.body.join(' ')).toContain(name)
      }
      // iOS never re-asks once the user has answered: the CTA opens Settings.
      expect(ctaTarget('ios', row.perms)).toBe('settings')
      expect(permissionCtaLabel('ios', row.perms)).toBe('Open Settings')
      expect(h.speech.log.prompts).toBe(0)
    })
  }

  it('the CTA deep-links to Settings and never fires a request iOS would ignore', async () => {
    const h = await mobileHarness({
      platform: 'ios',
      permissions: { microphone: 'denied', speech_recognition: 'granted' },
    })
    await h.controller.init()
    h.controller.permissionCta()
    await settle()

    expect(h.speech.log.settingsOpened).toBe(1)
    expect(h.speech.log.prompts).toBe(0)
  })
})

describe('AC-3 — Android needs one grant, and permanently-denied is its own path', () => {
  it('a single RECORD_AUDIO grant makes the mic available with no second prompt', async () => {
    const h = await mobileHarness({
      platform: 'android',
      permissions: { microphone: 'undetermined' },
    })
    await h.controller.init()

    h.controller.tapMic()
    await settle()
    expect(h.speech.log.prompts).toBe(1)
    expect(h.controller.state.surface).toBe('listening')
    expect(h.controller.permissions()).toEqual({ microphone: 'granted' })
    // No iOS-only slot leaks into the Android record.
    expect(h.controller.permissions().speech_recognition).toBeUndefined()

    // second talk attempt — no further prompt
    h.speech.end('cancelled')
    h.controller.tapMic()
    await settle()
    expect(h.speech.log.prompts).toBe(1)
  })

  it('a first denial dims the mic and MAY be re-requested on the next talk attempt', async () => {
    const h = await mobileHarness({
      platform: 'android',
      permissions: { microphone: 'denied' },
      grantOn: () => ({ microphone: 'granted' }),
    })
    await h.controller.init()
    expect(micMode(h.controller.state)).toBe('dimmed-permission')
    expect(ctaTarget('android', { microphone: 'denied' })).toBe('request')
    expect(permissionCtaLabel('android', { microphone: 'denied' })).toBe('Allow microphone')

    h.controller.tapMic()
    await settle()

    expect(h.speech.log.prompts).toBe(1)
    expect(h.controller.state.surface).toBe('listening')
  })

  it('permanently denied: the dimmed mic does NOT re-request, and the message says where to grant', async () => {
    const h = await mobileHarness({
      platform: 'android',
      permissions: { microphone: 'permanently_denied' },
    })
    await h.controller.init()
    expect(micMode(h.controller.state)).toBe('dimmed-permission')

    h.controller.tapMic()
    await settle()

    // The OS will never show the prompt again — asking would be a dead button.
    expect(h.speech.log.prompts).toBe(0)
    const msg = lastInfo(h)
    expect(msg?.kind === 'info' && msg.cta).toBe('permission')
    expect(msg?.kind === 'info' && msg.body.join(' ')).toContain('App info → Permissions')
    expect(permissionCtaLabel('android', { microphone: 'permanently_denied' })).toBe(
      'Open app settings',
    )

    h.controller.permissionCta()
    await settle()
    expect(h.speech.log.settingsOpened).toBe(1)
    expect(h.speech.log.prompts).toBe(0)
  })

  it('a grant made in Settings while backgrounded is picked up on the next tap — no prompt needed', async () => {
    const h = await mobileHarness({
      platform: 'android',
      permissions: { microphone: 'permanently_denied' },
    })
    await h.controller.init()

    h.speech.setPermissions({ microphone: 'granted' }) // the user fixed it in Settings
    h.controller.tapMic()
    await settle()

    expect(h.controller.state.surface).toBe('listening')
    expect(h.speech.log.prompts).toBe(0)
  })
})

describe('AC-2 / AC-3 — typing is fully unaffected in every permission combination', () => {
  const rows: { platform: 'ios' | 'android'; perms: PermissionState }[] = [
    ...IOS_MATRIX.map((r) => ({ platform: 'ios' as const, perms: r.perms })),
    { platform: 'android', perms: { microphone: 'granted' } },
    { platform: 'android', perms: { microphone: 'denied' } },
    { platform: 'android', perms: { microphone: 'permanently_denied' } },
  ]

  for (const [i, row] of rows.entries()) {
    it(`row ${i + 1}: typed input still reaches POST /assistant/turn`, async () => {
      const h = await mobileHarness({ platform: row.platform, permissions: row.perms })
      h.server.always('GET /assistant/session', 200, { session: null, boundary: null })
      h.server.always('GET /tasks', 200, { tasks: [] })
      h.server.always('POST /assistant/turn', 200, turnResponse())
      await h.controller.init()

      h.controller.composerChange('mua sữa')
      await h.controller.send('typed')
      await settle()

      expect(h.server.turnBodies()).toHaveLength(1)
      expect(h.server.turnBodies()[0]?.['transcript']).toBe('mua sữa')
    })
  }
})

describe('AC-4 + F-001 AC-20/AC-22 — capability, not connectivity, decides the mic', () => {
  it('offline alone neither dims nor hides the mic (on-device recognition may still work)', async () => {
    const h = await mobileHarness({ platform: 'android', online: false })
    await h.controller.init()

    expect(h.controller.state.offline).toBe(true)
    expect(micMode(h.controller.state)).toBe('available')

    h.controller.tapMic()
    await settle()
    expect(h.controller.state.surface).toBe('listening')
  })

  it('recognized text while offline lands in the composer and takes the local no-AI path — zero assistant calls', async () => {
    const h = await mobileHarness({ platform: 'android', online: false })
    await h.controller.init()

    h.controller.tapMic()
    await settle()
    h.speech.feed(['mua sữa'])
    expect(h.controller.state.composer).toBe('mua sữa') // never discarded
    h.speech.end('speech-end')
    await settle()

    // "no assistant turn is attempted" (AC-4). The cold-open session READ is a
    // different thing and is allowed to have been attempted — it is how AC-8
    // reconciles; offline it simply fails and the surface hands over.
    const mutatingAssistantCalls = h.server.calls.filter(
      (c) => c.method !== 'GET' && c.path.startsWith('/assistant'),
    )
    expect(mutatingAssistantCalls).toHaveLength(0)
    expect(h.server.turnBodies()).toHaveLength(0)
    expect(h.controller.state.tasks.map((t) => t.title)).toEqual(['mua sữa'])
    expect(h.controller.state.tasks[0]?.local).toBe(true)
  })

  it('a recognizer with no language pack is TRANSIENT (dimmed, cause stated), not no-capability', async () => {
    const h = await mobileHarness({ platform: 'ios', languagePackAvailable: false })
    await h.controller.init()

    expect(micMode(h.controller.state)).toBe('dimmed-transient')

    h.controller.tapMic()
    await settle()
    const msg = lastInfo(h)
    expect(msg?.kind === 'info' && msg.head).toBe('No speech language pack yet')
    expect(msg?.kind === 'info' && msg.cta).toBe(null) // nothing to grant
    expect(h.speech.log.prompts).toBe(0)

    // …and it recovers without a permission dance when the pack arrives.
    h.speech.setLanguagePackAvailable(true)
    expect(micMode(h.controller.state)).toBe('available')
  })

  it('no recognizer at all hides the mic without an error (F-001 AC-20)', async () => {
    const h = await mobileHarness({ platform: 'ios', recognizerAvailable: false })
    await h.controller.init()

    expect(micMode(h.controller.state)).toBe('hidden')
    h.controller.tapMic()
    await settle()

    expect(h.controller.state.surface).toBe('idle')
    expect(h.controller.state.messages).toHaveLength(0) // no error, no message
    expect(h.speech.log.prompts).toBe(0)
  })
})

describe('Ops counters (spec ## Ops) — permission denials are counted by kind', () => {
  it('counts the denied grant, not merely "a denial"', async () => {
    const h = await mobileHarness({
      platform: 'ios',
      permissions: { microphone: 'granted', speech_recognition: 'denied' },
    })
    await h.controller.init()
    h.controller.tapMic()
    await settle()

    expect(h.controller.counters.permissionDenied.speech_recognition).toBe(1)
    expect(h.controller.counters.permissionDenied.microphone).toBe(0)
  })
})
