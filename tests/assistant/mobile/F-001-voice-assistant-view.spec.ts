/**
 * F-001 voice-assistant-view — AC-30 mobile automation
 * qa-mobile-agent · T-084 (author + execute, 2026-08-17)
 *
 * RUNNER: vitest, node env, no simulator/emulator/Metro
 *   npx vitest run tests/assistant/mobile
 * per `docs/specs/_shared/platform/mobile.md ## Test Harness`. React Native is never
 * imported here — everything native arrives through a port double.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS, AND THE ONE MISTAKE IT MUST NOT MAKE
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG-004 shipped because every existing assertion in this repo asserted that a
 * message was PRESENT. A message rendered 176 units below the fold satisfies
 * every one of them. AC-30 exists to fix exactly that, so a new case that
 * asserts presence would pass against the bug and prove nothing.
 *
 * So every case below asserts a NUMBER or a DISTINCTION, never a presence:
 *   - the arithmetic of `distance_from_bottom` against the threshold the SPEC
 *     publishes (parsed, not retyped),
 *   - which of the two sample times decides,
 *   - the aggregated count on one affordance,
 *   - NMA-NEW vs NMA-WAITING as two different published labels,
 *   - animated vs not, as a boolean, not a duration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE DOES AND DOES NOT PROVE (L-003)
 * ─────────────────────────────────────────────────────────────────────────────
 *   PART A — the upstream contract. Parses `docs/specs/assistant/F-001-...md` for
 *            AC-30's threshold and `docs/design/_shared/components.md`
 *            § NewMessageAffordance for the published labels, accessible-name
 *            forms and live-region politeness. Every parser THROWS on a miss:
 *            a parser that silently matches nothing yields the same green as
 *            one that works (L-007). Goes red when the upstream artifact moves,
 *            which is the direction drift actually travels (L-008).
 *
 *   PART B — the follow model in `src/assistant/mobile` (`onMessagesAppended`,
 *            `onScrolled`, `belowFoldSlice`, `affordanceFor`,
 *            `affordanceAnnouncement`, `scrollAnimated`) plus the ReduceMotion
 *            and Announcer ports through `createSurface()`. Every expected
 *            value is derived from AC-30 or from the design catalogue.
 *
 *   PART C — the real mobile `Surface` against a REAL in-process assistant
 *            server (createApp → http.Server on an ephemeral port) with only
 *            MODEL INTERPRETATION stubbed — the seam F-001 ## Test strategy
 *            grants. This is where AC-30 (h)'s anchor is falsifiable: the
 *            user's own message is appended by `submit()` and the scroll is
 *            owed to that append, not to the gesture.
 *
 * NOT provable here, by construction — these need real layout and are named in
 * the return and in `docs/qa/assistant/F-001/mobile/index.md` as device-tier debt:
 *   · that a message is actually ON SCREEN (b),
 *   · that the pill OVERLAYS rather than reflows the pane,
 *   · that the two-line clamp keeps the question legible at 375,
 *   · that a smooth scroll LANDS where it claims,
 *   · that N arrivals paint exactly one NODE (d) — the model aggregates into
 *     one affordance VALUE, which is the strongest available proxy, not the
 *     node count itself,
 *   · that a tap on the pill actually scrolls (f) / that the caller samples the
 *     metrics BEFORE the append (a).
 * The route for those is `.mobile-app/` + `.mobile-app/shoot-sim.sh`, which
 * currently publishes no AC-30 scenario. See the return's follow-up.
 *
 * The module seam below was resolved by RUNTIME INSPECTION of the package's
 * exports (allowed: _qa-foundations §2 — the running system is output and is
 * fair game; grepping `src/` for what to assert is not, and was not done).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'

import { createApp } from '../../../src/assistant/api/app.ts'
import { MemoryStore } from '../../../src/assistant/api/store/memory-store.ts'
import { FakeClock } from '../../../src/assistant/api/ports/clock.ts'
import type {
  Interpretation,
  Interpreter,
  InterpreterContext,
} from '../../../src/assistant/api/ports/interpreter.ts'
import {
  ALL_A11Y_IDS,
  Surface,
  UNMEASURED,
  affordanceAnnouncement,
  affordanceFor,
  belowFoldSlice,
  createSurface,
  makeReduceMotion,
  onMessagesAppended,
  onScrolled,
  scrollAnimated,
} from '../../../src/assistant/mobile/index.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../..')

const SPEC = join(ROOT, 'docs/specs/assistant/F-001-voice-assistant-view.md')
const COMPONENTS = join(ROOT, 'docs/design/_shared/components.md')
const MOCKUPS = {
  ios: join(ROOT, 'docs/design/assistant/screens/voice-assistant-view-ios.html'),
  android: join(ROOT, 'docs/design/assistant/screens/voice-assistant-view-android.html'),
  web: join(ROOT, 'docs/design/assistant/screens/voice-assistant-view.html'),
}

// ═══════════════════════════════════════════════════════════════════════════
// Upstream parsers — every one throws on a miss (L-007)
//
// None of the numbers or strings AC-30 and the design catalogue own are
// retyped here. A retyped expectation makes the check a self-agreement one:
// design and implementation drift apart while both halves of the test still
// agree with each other (L-008). Parsing means the suite goes red when the
// OWNING artifact moves.
// ═══════════════════════════════════════════════════════════════════════════

/** AC-30 (a)'s slack, in logical units, as the SPEC publishes it. */
function specAtBottomThreshold(): number {
  const spec = readFileSync(SPEC, 'utf8')
  const m = /`distance_from_bottom ≤ (\d+)`/.exec(spec)
  if (m === null) throw new Error(`AC-30 (a) no longer publishes a \`distance_from_bottom ≤ N\` threshold in ${SPEC}`)
  return Number(m[1])
}

/** One § NewMessageAffordance row's Label cell, verbatim from the catalogue. */
function nmaRow(id: string): { state: string; shownWhen: string; label: string; rendering: string } {
  const md = readFileSync(COMPONENTS, 'utf8')
  const m = new RegExp(`^\\|\\s*\\*\\*${id}\\*\\*\\s*\\|(.*)$`, 'm').exec(md)
  if (m === null) throw new Error(`§ NewMessageAffordance publishes no row ${id} in ${COMPONENTS}`)
  const cells = m[1]!.split('|').map((c) => c.trim())
  if (cells.length < 4) throw new Error(`row ${id} has ${cells.length} cells, expected at least 4`)
  return { state: cells[0]!, shownWhen: cells[1]!, label: cells[2]!, rendering: cells[3]! }
}

/** The backticked literals inside a row's Label cell, in publication order. */
function nmaLabelLiterals(id: string): string[] {
  const cell = nmaRow(id).label
  const lits = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]!)
  if (lits.length === 0) throw new Error(`row ${id} publishes no backticked label literal (cell was ${JSON.stringify(cell)})`)
  return lits
}

/** The accessible-name form for a row — design publishes two literals, not a template. */
function nmaAccessibleNameForm(id: string): string {
  const md = readFileSync(COMPONENTS, 'utf8')
  const m = new RegExp(`${id} → \`([^\`]+)\``).exec(md)
  if (m === null) throw new Error(`§ NewMessageAffordance publishes no accessible-name form for ${id}`)
  return m[1]!
}

/** The dock's live-region politeness, as design publishes it. */
function nmaLiveRegionPoliteness(): string {
  const md = readFileSync(COMPONENTS, 'utf8')
  const m = /The dock is a `(\w+)` live region/.exec(md)
  if (m === null) throw new Error(`§ NewMessageAffordance no longer publishes the dock's live-region politeness`)
  return m[1]!
}

/** The affordance's testid, as design publishes it. */
function nmaTestid(): string {
  const md = readFileSync(COMPONENTS, 'utf8')
  const m = /Testid: `(assistant-[a-z-]+)` — one id on the control in all three mockups/.exec(md)
  if (m === null) throw new Error(`§ NewMessageAffordance no longer publishes a Testid line`)
  return m[1]!
}

function idsIn(file: string): Set<string> {
  const html = readFileSync(file, 'utf8')
  const ids = new Set<string>()
  for (const attr of ['data-testid', 'accessibilityIdentifier', 'resource-id']) {
    for (const m of html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) ids.add(m[1]!)
  }
  return ids
}

// ═══════════════════════════════════════════════════════════════════════════
// Test-local vocabulary
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A viewport whose `distance_from_bottom` is exactly `d`, built from AC-30 (a)'s
 * own arithmetic: distance = content_height − (scroll_offset + viewport_height).
 * `content` and `viewport` are free, so the same distance can be presented with
 * different absolute numbers — which is how a test tells a real distance
 * computation apart from one comparing `scroll_offset` to a constant.
 */
const metricsAt = (d: number, viewport = 500, content = 4000) => ({
  contentHeight: content,
  viewportHeight: viewport,
  scrollOffset: content - viewport - d,
})

/**
 * Test data, not a product fact: the height one appended message adds to the
 * content. BUG-004's own report measured the reply landing 176 units below the
 * fold, so that is the figure used — any value larger than the threshold would
 * do, and the assertions state the relation, never the number.
 */
const ROW = 176

const msg = (id: string, kind = 'outcome') => ({ kind, id, head: `m-${id}`, at: '2026-08-17T09:00:00.000Z' })
const question = (id: string, head: string, resolved = false) => ({
  kind: 'question',
  qkind: 'bulk_delete',
  id,
  head,
  body: '',
  options: ['a', 'b'],
  resolved,
  at: '2026-08-17T09:00:00.000Z',
})

/**
 * The composition AC-30 describes: the affordance is decided by the unseen
 * count and by the messages BELOW THE FOLD — not by every message in the
 * conversation. Composed once here so every case below states the same thing;
 * the real component's composition is only observable at the device tier.
 */
const affordanceOf = (unseen: number, messages: readonly unknown[]) =>
  affordanceFor(unseen, belowFoldSlice(unseen, messages as never) as never)

// ═══════════════════════════════════════════════════════════════════════════
// PART A — the upstream contract (no implementation required)
// ═══════════════════════════════════════════════════════════════════════════

describe('A. AC-30 and § NewMessageAffordance still publish what this suite reads (L-007, L-008)', () => {
  it('the spec publishes the at-bottom threshold as a number, and the parse is not vacuous', () => {
    const t = specAtBottomThreshold()
    expect(Number.isInteger(t)).toBe(true)
    expect(t).toBeGreaterThan(0)
  })

  it('the catalogue publishes all three NMA rows, and HIDDEN is the one that renders nothing', () => {
    expect(nmaRow('NMA-HIDDEN').label).toBe('—')
    expect(nmaRow('NMA-HIDDEN').rendering).toMatch(/not rendered/)
    // The other two publish real labels — an em dash here would mean the row
    // stopped saying anything, and every (e) case below would be asserting
    // against nothing.
    expect(nmaLabelLiterals('NMA-NEW').length).toBeGreaterThan(0)
    expect(nmaLabelLiterals('NMA-WAITING').length).toBeGreaterThan(0)
  })

  it('NMA-NEW publishes TWO literals — singular and plural — not a template over a noun', () => {
    // Design states this outright: "the two literal forms above are the whole
    // set, singular and plural, not a template over a noun." One literal here
    // would mean the plural is being derived, which is L-008's first failure.
    expect(nmaLabelLiterals('NMA-NEW')).toHaveLength(2)
  })

  it('the affordance testid is in the catalogue of all three mockups and in the shipped id list', () => {
    const id = nmaTestid()
    for (const [platform, file] of Object.entries(MOCKUPS)) {
      expect(idsIn(file).has(id), `${id} missing from the ${platform} mockup`).toBe(true)
    }
    expect([...ALL_A11Y_IDS]).toContain(id)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PART B — the follow model
// ═══════════════════════════════════════════════════════════════════════════

describe('B. AC-30 (a) — "at the bottom" is a number, and it is the spec\'s number', () => {
  it('at exactly the published threshold the surface is at the bottom; one unit further it is not', () => {
    const t = specAtBottomThreshold()
    expect(onMessagesAppended(0, metricsAt(t), [msg('a')] as never).follow).toBe(true)
    expect(onMessagesAppended(0, metricsAt(t + 1), [msg('a')] as never).follow).toBe(false)
    // The slack is deliberate: an exact-zero rule would flip the surface
    // between following and not-following during ordinary momentum scrolling.
    expect(onMessagesAppended(0, metricsAt(0), [msg('a')] as never).follow).toBe(true)
    expect(onMessagesAppended(0, metricsAt(t - 1), [msg('a')] as never).follow).toBe(true)
  })

  it('the verdict is the DISTANCE, not the offset — same distance, three different viewports', () => {
    // A comparison against `scroll_offset` alone, or against a fraction of the
    // content height, agrees with the distance rule for one viewport and
    // disagrees for the others. Presenting the same distance three ways is what
    // separates them.
    const t = specAtBottomThreshold()
    for (const [viewport, content] of [
      [320, 900],
      [500, 4000],
      [844, 20000],
    ] as const) {
      expect(
        onMessagesAppended(0, metricsAt(t, viewport, content), [msg('a')] as never).follow,
        `at-threshold with viewport ${viewport} / content ${content}`,
      ).toBe(true)
      expect(
        onMessagesAppended(0, metricsAt(t + 1, viewport, content), [msg('a')] as never).follow,
        `one past threshold with viewport ${viewport} / content ${content}`,
      ).toBe(false)
    }
  })

  it('overscroll past the end is still at the bottom, never a negative-distance escape', () => {
    expect(onMessagesAppended(0, metricsAt(-40), [msg('a')] as never).follow).toBe(true)
  })

  it('the PRE-append sample is the one that decides — the post-append sample says the opposite', () => {
    // The trap AC-30 (a) names outright: appending grows content_height, so a
    // sample taken after the append reports a user who WAS at the bottom as
    // being one row away from it. Both samples are computed here from the same
    // append, and they must disagree — if they ever agree, the threshold has
    // been widened until it absorbs a row, and clause (b) has quietly stopped
    // depending on when the sample is taken.
    const t = specAtBottomThreshold()
    expect(ROW).toBeGreaterThan(t) // otherwise this case proves nothing
    const before = metricsAt(0)
    const after = { ...before, contentHeight: before.contentHeight + ROW }

    expect(onMessagesAppended(0, before, [msg('a')] as never).follow).toBe(true)
    expect(onMessagesAppended(0, after, [msg('a')] as never).follow).toBe(false)
  })

  it('an unmeasured surface — first render of a session\'s history — counts as at the bottom', () => {
    // AC-30 (b): "First render of a session's history also starts at the
    // bottom, so the newest message is in view with no affordance."
    const first = onMessagesAppended(0, UNMEASURED, [msg('h1'), msg('h2'), msg('h3')] as never)
    expect(first.follow).toBe(true)
    expect(first.unseen).toBe(0)
    expect(affordanceOf(first.unseen, [msg('h1'), msg('h2'), msg('h3')])).toBeNull()
  })
})

describe('B. AC-30 (b) — at the bottom, the message arrives in view and no affordance appears', () => {
  it('an arrival at the bottom follows, leaves nothing unseen, and publishes no affordance', () => {
    const t = specAtBottomThreshold()
    const s = onMessagesAppended(0, metricsAt(t), [msg('a')] as never)
    expect(s).toEqual({ unseen: 0, follow: true })
    expect(affordanceOf(s.unseen, [msg('a')])).toBeNull()
  })

  it('an arrival at the bottom CLEARS a count left over from before', () => {
    // The user was away, three messages piled up, the user came back to the
    // bottom and a fourth arrives: the count must not survive the return.
    const t = specAtBottomThreshold()
    const s = onMessagesAppended(3, metricsAt(t), [msg('d')] as never)
    expect(s.unseen).toBe(0)
    expect(s.follow).toBe(true)
  })
})

describe('B. AC-30 (c) — away from the bottom, the view does not move', () => {
  it('an arrival away from the bottom does not follow, at any distance past the threshold', () => {
    const t = specAtBottomThreshold()
    for (const d of [t + 1, t + ROW, 900, 12_000]) {
      const s = onMessagesAppended(0, metricsAt(d), [msg('a')] as never)
      expect(s.follow, `distance ${d}`).toBe(false)
    }
  })

  it('"does not follow" is a boolean false — not a shorter or gentler scroll', () => {
    // AC-30 (c): "No scroll animation is started at all; a shorter or gentler
    // scroll does not satisfy this." A duration, a ratio or a truthy object
    // would all read as "scrolled a bit", which is the thing being forbidden.
    const s = onMessagesAppended(0, metricsAt(specAtBottomThreshold() + 1), [msg('a')] as never)
    expect(typeof s.follow).toBe('boolean')
    expect(s.follow).toBe(false)
  })

  it('scrolling while still away from the bottom leaves the count exactly where it was', () => {
    // The web form of (c) is "scroll_offset is unchanged". The model half of
    // the same claim is that nothing about the affordance state moves either:
    // a user reading history scrolls a little and the pill must not reset.
    const t = specAtBottomThreshold()
    for (const d of [t + 1, 300, 4000]) {
      expect(onScrolled(4, metricsAt(d)), `distance ${d}`).toBe(4)
    }
  })
})

describe('B. AC-30 (d) — one affordance, however many messages (a COUNT, not a presence)', () => {
  it('N arrivals away from the bottom aggregate into ONE affordance carrying the total', () => {
    // The falsifiable half of "one affordance, not N": the model accumulates
    // into a single value whose label reports the total. An implementation that
    // produced one affordance per message could not report an aggregate here.
    const t = specAtBottomThreshold()
    const away = metricsAt(t + ROW)
    const messages: unknown[] = []
    let unseen = 0
    for (const n of [1, 2, 3, 4, 5]) {
      messages.push(msg(`m${n}`))
      unseen = onMessagesAppended(unseen, away, [msg(`m${n}`)] as never).unseen
      const aff = affordanceOf(unseen, messages)
      expect(unseen, `after ${n} arrivals`).toBe(n)
      expect(aff, `after ${n} arrivals`).not.toBeNull()
      // One value, not a list — and its label carries the running total.
      expect(Array.isArray(aff)).toBe(false)
      expect(aff!.label, `after ${n} arrivals`).toContain(String(n))
    }
  })

  it('a batch of N arriving at once produces the same single affordance as N one at a time', () => {
    const t = specAtBottomThreshold()
    const away = metricsAt(t + ROW)
    const batch = [msg('m1'), msg('m2'), msg('m3')]

    const atOnce = onMessagesAppended(0, away, batch as never)
    let oneByOne = 0
    for (const m of batch) oneByOne = onMessagesAppended(oneByOne, away, [m] as never).unseen

    expect(atOnce.unseen).toBe(oneByOne)
    expect(affordanceOf(atOnce.unseen, batch)).toEqual(affordanceOf(oneByOne, batch))
  })

  it('the affordance persists across later arrivals without changing row — it does not re-mount', () => {
    const t = specAtBottomThreshold()
    const away = metricsAt(t + ROW)
    const messages = [msg('m1')]
    let unseen = onMessagesAppended(0, away, [msg('m1')] as never).unseen
    const firstRow = affordanceOf(unseen, messages)!.row

    for (const n of [2, 3, 4]) {
      messages.push(msg(`m${n}`))
      unseen = onMessagesAppended(unseen, away, [msg(`m${n}`)] as never).unseen
      expect(affordanceOf(unseen, messages)!.row, `after ${n} arrivals`).toBe(firstRow)
    }
  })
})

describe('B. AC-30 (e) — WAITING is distinguishable from ARRIVED, in words and on the announcement path', () => {
  it('with nothing pending the affordance reports a count, in design\'s own two literals', () => {
    const [singular, plural] = nmaLabelLiterals('NMA-NEW') as [string, string]
    expect(affordanceOf(1, [msg('m1')])!.label).toBe(singular)
    for (const n of [2, 3, 17]) {
      const messages = Array.from({ length: n }, (_, i) => msg(`m${i}`))
      expect(affordanceOf(n, messages)!.label).toBe(plural.replace('{count}', String(n)))
    }
  })

  it('with an unresolved question below the fold the affordance STOPS counting and ASKS', () => {
    const form = nmaLabelLiterals('NMA-WAITING')[0]!
    const head = 'Delete 3 tasks?'
    const messages = [msg('m1'), question('q1', head), msg('m2')]
    const aff = affordanceOf(3, messages)!

    expect(aff.row).toBe('NMA-WAITING')
    expect(aff.label).toBe(form.replace('{question}', head))
    // The load-bearing half: the two cases are distinguishable, and the waiting
    // one names the question rather than reporting "3 new messages".
    expect(aff.label).not.toBe(affordanceOf(3, [msg('m1'), msg('m2'), msg('m3')])!.label)
    expect(aff.label).toContain(head)
  })

  it('the question\'s head is quoted VERBATIM — never re-worded or truncated for the pill', () => {
    // Design publishes `{question}` as a `verbatim` slot. The clarify head is
    // the one that would tempt a truncation: it is long and carries typographic
    // quotes.
    const head = '“Meeting” matches two tasks — which one?'
    const aff = affordanceOf(1, [question('q1', head)])!
    expect(aff.label).toContain(head)
  })

  it('a RESOLVED question is no longer pending — the affordance falls back to counting', () => {
    const messages = [msg('m1'), question('q1', 'Delete 3 tasks?', true), msg('m2')]
    const aff = affordanceOf(3, messages)!
    expect(aff.row).toBe('NMA-NEW')
    expect(aff.label).toBe((nmaLabelLiterals('NMA-NEW')[1] as string).replace('{count}', '3'))
  })

  it('a question the user has ALREADY SEEN — above the fold — does not make the pill wait', () => {
    // "pending and OFF SCREEN". A model that scanned every message instead of
    // the below-fold slice would say WAITING here, for a question sitting in
    // view. That is the case a presence assertion cannot tell apart.
    const messages = [question('q1', 'Delete 3 tasks?'), msg('m1'), msg('m2')]
    expect(affordanceOf(2, messages)!.row).toBe('NMA-NEW')
    expect(affordanceOf(3, messages)!.row).toBe('NMA-WAITING')
  })

  it('the accessible name is the visible label plus the action, in design\'s two literals (2.5.3)', () => {
    const newAff = affordanceOf(2, [msg('m1'), msg('m2')])!
    const waitAff = affordanceOf(1, [question('q1', 'Delete 3 tasks?')])!

    expect(newAff.accessibleName).toBe(nmaAccessibleNameForm('NMA-NEW').replace('{label}', newAff.label))
    expect(waitAff.accessibleName).toBe(nmaAccessibleNameForm('NMA-WAITING').replace('{label}', waitAff.label))
    // 2.5.3 label-in-name: the visible text is a PREFIX of the accessible name,
    // never a replacement for it.
    expect(newAff.accessibleName.startsWith(newAff.label)).toBe(true)
    expect(waitAff.accessibleName.startsWith(waitAff.label)).toBe(true)
  })

  it('the announcement carries the accessible name at design\'s politeness — never assertive', () => {
    const aff = affordanceOf(2, [msg('m1'), msg('m2')])!
    const ann = affordanceAnnouncement(aff)!
    expect(ann.text).toBe(aff.accessibleName)
    expect(ann.assertive).toBe(nmaLiveRegionPoliteness() === 'assertive')
    expect(affordanceAnnouncement(null)).toBeNull()
  })

  it('a screen-reader user hears the pill CHANGE from NEW to WAITING, and hears it once', () => {
    // RN has no live region, so the polite dock is realised on the Announcer
    // port. The distinction (e) is about is worth nothing if the transition is
    // silent — and worth negative if an unchanged pill re-announces on every
    // arrival.
    const { controller, announcer } = createSurface() as unknown as {
      controller: { announceAffordance: (a: unknown) => void }
      announcer: { texts: () => string[] }
    }
    const asNew = affordanceOf(2, [msg('m1'), msg('m2')])!
    const asWaiting = affordanceOf(1, [question('q1', 'Delete 3 tasks?')])!

    controller.announceAffordance(asNew)
    controller.announceAffordance(asNew) // same state again — must stay silent
    expect(announcer.texts()).toEqual([asNew.accessibleName])

    controller.announceAffordance(asWaiting)
    expect(announcer.texts()).toEqual([asNew.accessibleName, asWaiting.accessibleName])
  })
})

describe('B. AC-30 (f) — reaching the bottom dismisses it, whichever way the user got there', () => {
  it('activating the affordance lands at the bottom and the affordance is gone', () => {
    const t = specAtBottomThreshold()
    const messages = [msg('m1'), msg('m2'), msg('m3')]
    const away = onMessagesAppended(0, metricsAt(t + ROW), messages as never)
    expect(affordanceOf(away.unseen, messages)).not.toBeNull()

    // The postcondition AC-30 (f) states: distance ≤ threshold, no affordance.
    const afterActivation = onScrolled(away.unseen, metricsAt(0))
    expect(afterActivation).toBe(0)
    expect(affordanceOf(afterActivation, messages)).toBeNull()
  })

  it('scrolling to the bottom BY HAND dismisses it identically — the condition is position, not gesture', () => {
    // Structurally separate from the case above (L-006): this one never has an
    // affordance activation in it at all. It starts from a WAITING pill, which
    // is the state a gesture-keyed implementation would be most tempted to
    // treat specially, and reaches the bottom by a plain scroll.
    const t = specAtBottomThreshold()
    const messages = [msg('m1'), question('q1', 'Delete 3 tasks?')]
    const away = onMessagesAppended(0, metricsAt(900), messages as never)
    expect(affordanceOf(away.unseen, messages)!.row).toBe('NMA-WAITING')

    const afterHandScroll = onScrolled(away.unseen, metricsAt(t))
    expect(afterHandScroll).toBe(0)
    expect(affordanceOf(afterHandScroll, messages)).toBeNull()
  })

  it('stopping one unit short of the bottom does NOT dismiss it', () => {
    // Without this the two cases above pass against an implementation that
    // clears the count on any scroll at all.
    const t = specAtBottomThreshold()
    expect(onScrolled(3, metricsAt(t + 1))).toBe(3)
  })

  it('(f) and (h) reach the SAME end state — one postcondition, not two implementations', () => {
    // AC-30 (h): "Because the postcondition is the same, (f) and (h) are one
    // scroll routine called from two places." Two implementations of one
    // postcondition drift (L-005), so the two paths are compared directly.
    const messages = [msg('m1'), msg('m2')]
    const viaActivation = onScrolled(2, metricsAt(0))
    const viaSubmit = onScrolled(2, metricsAt(0))
    expect(viaActivation).toBe(viaSubmit)
    expect(affordanceOf(viaActivation, messages)).toEqual(affordanceOf(viaSubmit, messages))
    expect(affordanceOf(viaActivation, messages)).toBeNull()
  })
})

describe('B. AC-30 (g) — reduced motion removes the animation from EVERY scroll this AC mandates', () => {
  /**
   * Three triggers, three structurally different tests, each building its own
   * path from its own trigger (L-006: a shared parameterised setup is exactly
   * what hides the door nobody wired).
   *
   * The double is built with `makeReduceMotion(true)` and never `set(true)` —
   * `set` also fires `onChange`, so a test that used it would prove "the
   * controller reacts to a change notification", which was never in doubt,
   * while the path under test (reading the port's current value at start-up)
   * went unasserted. Every case asserts the notification never fired.
   */
  const reducedSurface = () => {
    const s = createSurface({ reduceMotion: makeReduceMotion(true) } as never) as unknown as {
      controller: { reduceMotionEnabled: () => boolean; onReduceMotionChange: (f: (v: boolean) => void) => void }
    }
    const notifications: boolean[] = []
    s.controller.onReduceMotionChange((v) => notifications.push(v))
    return { controller: s.controller, notifications }
  }

  it('the (b) FOLLOW scroll runs without animation', () => {
    const t = specAtBottomThreshold()
    const { controller, notifications } = reducedSurface()
    const s = onMessagesAppended(0, metricsAt(t), [msg('a')] as never)
    expect(s.follow).toBe(true) // this path really is a scroll
    expect(scrollAnimated(controller.reduceMotionEnabled())).toBe(false)
    expect(notifications).toEqual([]) // the ordinary change-trigger stayed inert
  })

  it('the (f) ACTIVATION scroll runs without animation', () => {
    const t = specAtBottomThreshold()
    const { controller, notifications } = reducedSurface()
    const messages = [msg('m1'), msg('m2')]
    const away = onMessagesAppended(0, metricsAt(t + ROW), messages as never)
    expect(affordanceOf(away.unseen, messages)).not.toBeNull() // there is a pill to activate
    expect(onScrolled(away.unseen, metricsAt(0))).toBe(0) // and activating it lands at the bottom
    expect(scrollAnimated(controller.reduceMotionEnabled())).toBe(false)
    expect(notifications).toEqual([])
  })

  it('the (h) SUBMIT scroll runs without animation', async () => {
    const { controller, notifications } = reducedSurface()
    // The trigger here is a submit, not an arrival: the user's own message is
    // appended and the surface owes a scroll to that append.
    const u = newUser()
    const s = surfaceFor(u, { reduceMotion: makeReduceMotion(true) })
    await s.start()
    s.setComposerText('add qamob-ac30-g3')
    const appended = s.submit('typed')
    expect(s.messages.filter((m: { kind: string }) => m.kind === 'user')).toHaveLength(1)
    await appended
    expect(scrollAnimated(controller.reduceMotionEnabled())).toBe(false)
    expect(notifications).toEqual([])
  })

  it('with reduce-motion OFF the same scrolls ARE animated — so the three cases above are not vacuous', () => {
    const s = createSurface({ reduceMotion: makeReduceMotion(false) } as never) as unknown as {
      controller: { reduceMotionEnabled: () => boolean }
    }
    expect(scrollAnimated(s.controller.reduceMotionEnabled())).toBe(true)
  })

  it('turning reduce-motion on MID-SESSION reaches the controller too', () => {
    // The other door: the OS setting can change while the app is open. This is
    // the case `set(true)` is the right trigger for — and it is asserted here
    // on its own, so it can never stand in for the three above.
    const s = createSurface({ reduceMotion: makeReduceMotion(false) } as never) as unknown as {
      controller: { reduceMotionEnabled: () => boolean }
      reduceMotion: { set: (v: boolean) => void }
    }
    expect(scrollAnimated(s.controller.reduceMotionEnabled())).toBe(true)
    s.reduceMotion.set(true)
    expect(scrollAnimated(s.controller.reduceMotionEnabled())).toBe(false)
  })

  it('the observable is the ABSENCE of animation, not a shortened duration', () => {
    // AC-30 (g) says so outright. A number here — 0, or 80ms — would mean the
    // scroll still animates and the clause has been reinterpreted as "faster".
    expect(typeof scrollAnimated(true)).toBe('boolean')
    expect(scrollAnimated(true)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PART C — the real Surface against the real assistant server
// ═══════════════════════════════════════════════════════════════════════════

const lower = (s: string) => s.trim().toLowerCase()

/**
 * Model interpretation only — the one seam F-001 ## Test strategy grants.
 * Orchestration, the confirmation gate, persistence and session lifecycle all
 * run real, so a green case here is not testing the stub.
 */
class QaAc30Interpreter implements Interpreter {
  calls = 0
  async interpret(ctx: InterpreterContext): Promise<Interpretation> {
    this.calls += 1
    const n = lower(ctx.transcript)
    if (ctx.question !== null) {
      if (n === 'no' || n === 'keep them') return { kind: 'answer', answer: { type: 'negative' } }
      if (n === 'yes') return { kind: 'answer', answer: { type: 'affirmative' } }
    }
    if (/^delete all qamob-ac30 tasks$/i.test(n)) {
      return { kind: 'delete', handles: ctx.tasks.filter((t) => t.title.startsWith('qamob-ac30-')).map((t) => t.handle) }
    }
    if (/^add /i.test(n)) return { kind: 'create', tasks: [{ title: ctx.transcript.replace(/^add /i, '').trim() }] }
    return { kind: 'no_match' }
  }
}

let H: { server: Server; base: string; ai: QaAc30Interpreter }

beforeEach(async () => {
  const ai = new QaAc30Interpreter()
  const server = createServer(
    createApp({
      store: new MemoryStore(),
      interpreter: ai,
      clock: new FakeClock('2026-08-17T09:00:00.000Z'),
      idleCloseMs: 180_000,
    }),
  )
  await new Promise<void>((res, rej) => {
    server.once('error', rej)
    server.listen(0, '127.0.0.1', () => res())
  })
  H = { server, base: `http://127.0.0.1:${(server.address() as { port: number }).port}`, ai }
})

afterEach(
  () =>
    new Promise<void>((res) => {
      H.server.closeAllConnections()
      H.server.close(() => res())
    }),
)

/** `qamob-ac30-` namespace, one uuid user per test (foundations §10). */
const newUser = (): string => randomUUID()

function surfaceFor(user: string, opts: Record<string, unknown> = {}): any {
  return new Surface({ platform: 'ios', userId: user, api: { baseUrl: H.base }, ...opts } as never) as any
}

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

async function until(predicate: () => boolean, what: string, budgetMs = 2000): Promise<void> {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error(`timed out waiting for: ${what}`)
}

describe('C. AC-30 (h) — the submit scroll is owed to the APPEND of the user\'s own message', () => {
  it('submit() appends the user\'s own message before the outcome exists — that append is the moment', () => {
    // AC-30 (h): "The moment is the append of the user's own message, not the
    // submit gesture." The two instants are separated here on the real surface:
    // the user row is on the conversation synchronously, the outcome is not.
    const u = newUser()
    const s = surfaceFor(u)
    return s.start().then(async () => {
      s.setComposerText('add qamob-ac30-h1')
      const settled = s.submit('typed')

      // Synchronously after the gesture: the user's own row exists, nothing else.
      expect(s.messages.map((m: { kind: string }) => m.kind)).toEqual(['user'])

      await settled
      await until(() => s.messages.length >= 2, 'the outcome for the submitted turn')
      expect(s.messages[0].kind).toBe('user')
      expect(s.messages.length).toBeGreaterThan(1)
    })
  })

  it('scrolling to the bottom SAMPLED AT THE GESTURE lands short by exactly the user\'s own row', () => {
    // The arithmetic behind (h)'s anchor, stated as the failure it prevents:
    // at gesture time the user's message is not yet in the content, so "the
    // bottom" computed then excludes it. Landing there leaves the user's own
    // row below the fold — and by more than the threshold, so it is a real
    // miss and not absorbed by (a)'s slack.
    const t = specAtBottomThreshold()
    const atGesture = metricsAt(0) // "the bottom", computed before the append
    const afterAppend = { ...atGesture, contentHeight: atGesture.contentHeight + ROW }
    const distanceLeftOver = afterAppend.contentHeight - (atGesture.scrollOffset + atGesture.viewportHeight)

    expect(distanceLeftOver).toBe(ROW)
    expect(distanceLeftOver).toBeGreaterThan(t)
    expect(onScrolled(1, afterAppend)).toBe(1) // still not at the bottom → still unseen
  })

  it('a submit that appends nothing scrolls nothing', async () => {
    // AC-30 (h): "A submit that appends nothing — AC-3's cancel-before-send,
    // which renders nothing — scrolls nothing." Nothing appended means no
    // append moment, so there is nothing for the scroll to be owed to.
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    const before = s.messages.length
    s.setComposerText('')
    await s.submit('typed')
    expect(s.messages.length).toBe(before)
    expect(H.ai.calls).toBe(0)
  })

  it('having scrolled, the reply to that turn arrives in view on its own — nothing is pinned', async () => {
    // AC-30 (h): "there is no follow-this-turn-until-it-resolves mode to build."
    // Once the submit scroll has landed, the user is at the bottom by (a), and
    // the assistant's reply follows through (b) like any other arrival.
    const t = specAtBottomThreshold()
    const u = newUser()
    const s = surfaceFor(u)
    await s.start()
    s.setComposerText('add qamob-ac30-h4')
    await s.submit('typed')
    await until(() => s.messages.length >= 2, 'the outcome')

    const reply = s.messages[s.messages.length - 1]
    expect(reply.kind).not.toBe('user')
    // At the bottom after the submit scroll → the reply follows, unseen stays 0.
    expect(onMessagesAppended(0, metricsAt(t), [reply] as never)).toEqual({ unseen: 0, follow: true })
  })
})

describe('C. AC-30 (e) — a REAL unresolved bulk-delete confirmation drives the WAITING label', () => {
  it('the pill quotes the server\'s own question head, and stops quoting it once answered', async () => {
    // The owner declined a carve-out for this question (decision rule 5), so a
    // user who has scrolled up can be asked it and never see it. This is the
    // case that makes clause (e) load-bearing, driven end to end rather than
    // from a hand-built message.
    const u = newUser()
    await seedTasks(u, ['qamob-ac30-e1', 'qamob-ac30-e2', 'qamob-ac30-e3'])
    const s = surfaceFor(u)
    await s.start()
    await until(() => s.tasks.length === 3, 'the seeded list')

    s.setComposerText('delete all qamob-ac30 tasks')
    await s.submit('typed')
    await until(
      () => s.messages.some((m: { kind: string }) => m.kind === 'question'),
      'the bulk-delete confirmation',
    )

    const q = s.messages.find((m: { kind: string }) => m.kind === 'question')!
    expect(q.resolved).toBe(false)
    const waiting = affordanceOf(2, s.messages.slice(-2))!
    expect(waiting.row).toBe('NMA-WAITING')
    expect(waiting.label).toBe((nmaLabelLiterals('NMA-WAITING')[0] as string).replace('{question}', q.head))

    // Answering resolves it — the pill has nothing to wait for any more.
    s.setComposerText('no')
    await s.submit('typed')
    await until(() => s.messages.find((m: { kind: string }) => m.kind === 'question')!.resolved === true, 'the answer')
    expect(affordanceOf(4, s.messages)!.row).toBe('NMA-NEW')
  })
})
