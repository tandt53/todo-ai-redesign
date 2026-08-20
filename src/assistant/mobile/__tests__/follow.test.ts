// F-001 AC-30 — following new messages (BUG-004), mobile half.
//
// Eight clauses, and every one of them is a decision over a viewport sample, so
// every one of them is node-testable without a simulator. What this tier cannot
// claim, and does not: that React Native's `scrollToEnd` moves real pixels, or
// that VoiceOver reads the pill. Those are QA's device pass.
//
// ONE HOME FOR THE FACTS. The threshold, the arithmetic and every published
// string live in `_shared/model/follow.ts`, which web uses too — AC-30(a) says
// 48 is "the same number on both clients", and a second declaration would be
// L-004's shape. The assertions below therefore import the shared symbols by
// name, so a mobile-local re-declaration would show up here as two symbols
// rather than passing quietly.
//
// COPY IS PARSED, NEVER RETYPED. `docs/design/_shared/components.md`
// § NewMessageAffordance owns the two label forms and the two accessible-name
// literals; the assertions read that section at run time and compare per row ID,
// so they fail when the UPSTREAM artifact moves — the direction drift actually
// travels, and the direction a hand-transcribed expectation is blind to (L-008).
// Every parse is paired with a non-vacuity guard, because a parser that silently
// matches nothing is green exactly like one that works (L-007).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BOTTOM_SLACK,
  distanceFromBottom,
  isAtBottom,
  newMessageAffordance,
  userIsAtBottom,
} from '../../_shared/model/follow.ts'
import type { Message } from '../../_shared/types.ts'
import { affordanceAnnouncement } from '../model/announce.ts'
import {
  UNMEASURED,
  affordanceFor,
  belowFoldSlice,
  onFlightSample,
  onMessagesAppended,
  onScrollIssued,
  onScrolled,
  onUserTookHold,
  scrollAnimated,
} from '../model/follow.ts'
import type { ScrollMetrics } from '../model/follow.ts'
import { mobileHarness } from './_helpers.ts'

const ROOT = resolve(import.meta.dirname, '../../../..')
const COMPONENTS_MD = resolve(ROOT, 'docs/design/_shared/components.md')
const MOBILE_FOLLOW_SRC = resolve(import.meta.dirname, '../model/follow.ts')
const SHARED_FOLLOW_SRC = resolve(ROOT, 'src/assistant/_shared/model/follow.ts')
const HOOK_SRC = resolve(import.meta.dirname, '../components/useNewMessageFollow.ts')

// ---------------------------------------------------------------------------
// One home for the shared facts
// ---------------------------------------------------------------------------

/** Source with comment lines stripped. The prose in `mobile/model/follow.ts`
 * quotes the published copy and the old duplicate constant on purpose — it is
 * explaining what does NOT live there — and a scan that counted prose would fail
 * on the explanation rather than on the code. Same device as
 * `interface-language.test.ts`. */
function codeOf(path: string): string {
  const src = readFileSync(path, 'utf8')
  expect(src.length, `${path} is empty — the scan would be vacuous`).toBeGreaterThan(500)
  const code = src
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
  expect(code.length, `${path} is all comment — the scan would be vacuous`).toBeGreaterThan(200)
  return code
}

describe('AC-30(a) — "the same number on both clients" is written once', () => {
  it('the comment-stripping scan is not vacuous: it still sees declarations and literals', () => {
    // The guard L-007 asks for. If `codeOf` ever strips everything, every
    // "mobile does not re-declare this" assertion below goes green for the
    // wrong reason.
    const mobileSrc = codeOf(MOBILE_FOLLOW_SRC)
    expect(mobileSrc).toContain('export function onMessagesAppended')
    expect(mobileSrc).toContain('export const UNMEASURED')
    // …and the same filter applied to the module that DOES hold the copy still
    // finds it, so a false negative below would be visible here.
    expect(codeOf(SHARED_FOLLOW_SRC)).toContain('new message')
  })

  it('mobile declares no threshold, no arithmetic and no copy of its own', () => {
    // The near-miss this guards against: mobile briefly held its own
    // `AT_BOTTOM_SLACK = 48` next to the shared `BOTTOM_SLACK = 48`. Because the
    // two names DIFFERED, a grep for either returned one clean site and nothing
    // reported them when they stopped agreeing — L-004 with its usual detection
    // removed. This assertion is that missing report.
    const mobileSrc = codeOf(MOBILE_FOLLOW_SRC)
    const sharedSrc = readFileSync(SHARED_FOLLOW_SRC, 'utf8')
    expect(sharedSrc, 'the shared module no longer declares the threshold').toContain(
      'export const BOTTOM_SLACK = 48',
    )

    // Non-vacuity for the scan itself: the shape it looks for is real.
    expect(/export const [A-Z_]*SLACK\b/.test(sharedSrc)).toBe(true)
    // …and mobile has none of it.
    expect(mobileSrc, 'mobile re-declares the slack').not.toMatch(/export const [A-Z_]*SLACK\b/)
    expect(mobileSrc, 'mobile re-declares the arithmetic').not.toMatch(
      /export function (distanceFromBottom|isAtBottom)\b/,
    )
    for (const literal of ['new message', 'Waiting for your answer', 'scroll to newest']) {
      expect(mobileSrc, `mobile re-declares the copy: "${literal}"`).not.toContain(literal)
    }
    expect(mobileSrc, 'mobile does not import the shared module').toContain(
      "from '../../_shared/model/follow.ts'",
    )
  })

  it('the shared arithmetic is what mobile answers with', () => {
    expect(BOTTOM_SLACK).toBe(48)
    expect(distanceFromBottom(viewport())).toBe(0)
    expect(isAtBottom(viewport())).toBe(true)
    // the slack is inclusive at its edge, and one unit past it is not at bottom
    expect(isAtBottom(viewport({ contentHeight: 2000 + BOTTOM_SLACK }))).toBe(true)
    expect(isAtBottom(viewport({ contentHeight: 2000 + BOTTOM_SLACK + 1 }))).toBe(false)
    // the slack is deliberate, not "near enough": an exact-zero test would flip
    // the surface between following and not-following on ordinary residue.
    expect(isAtBottom(viewport({ scrollOffset: 1500 - 3 }))).toBe(true)
  })

  it('an unmeasured viewport counts as at the bottom — first render starts there', () => {
    // The same answer web reaches from a null scroller.
    expect(isAtBottom(UNMEASURED)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// The published catalogue, parsed
// ---------------------------------------------------------------------------

function nmaSection(): string {
  const md = readFileSync(COMPONENTS_MD, 'utf8')
  const after = md.split('## NewMessageAffordance')[1]
  expect(after, 'components.md no longer has a § NewMessageAffordance').toBeDefined()
  return (after as string).split('\n## ')[0] as string
}

/** Row ID → the backticked label forms design publishes for it. */
function publishedLabels(): Map<string, string[]> {
  const rows = new Map<string, string[]>()
  for (const line of nmaSection().split('\n')) {
    const m = /^\|\s*\*\*(NMA-[A-Z]+)\*\*\s*\|[^|]*\|[^|]*\|([^|]*)\|/.exec(line)
    if (m === null) continue
    const forms = [...(m[2] as string).matchAll(/`([^`]+)`/g)].map((f) => f[1] as string)
    rows.set(m[1] as string, forms)
  }
  return rows
}

function publishedAccessibleName(row: string): string {
  const m = new RegExp(`${row} → \`([^\`]+)\``).exec(nmaSection())
  expect(m, `components.md publishes no accessible name for ${row}`).not.toBeNull()
  return (m as RegExpExecArray)[1] as string
}

describe('AC-30 — the affordance transcribes design’s catalogue, it does not compose one', () => {
  it('the parse is not vacuous: all three rows are found, with the label column read', () => {
    const rows = publishedLabels()
    expect([...rows.keys()].sort()).toEqual(['NMA-HIDDEN', 'NMA-NEW', 'NMA-WAITING'])
    // NMA-HIDDEN publishes an em dash, not a label — it is not rendered at all.
    expect(rows.get('NMA-HIDDEN')).toEqual([])
    expect(rows.get('NMA-NEW')).toHaveLength(2)
    expect(rows.get('NMA-WAITING')).toHaveLength(1)
  })

  it('NMA-NEW carries both published forms — singular and plural are two literals, not a template over a noun', () => {
    const [singular, plural] = publishedLabels().get('NMA-NEW') as [string, string]
    expect(labelOf(1)).toBe(singular)
    expect(labelOf(2)).toBe(plural.replace('{count}', '2'))
    expect(labelOf(7)).toBe(plural.replace('{count}', '7'))
    // …and the two really do differ, or this assertion would hold vacuously.
    expect(singular).not.toBe(plural)
  })

  it('NMA-WAITING quotes the question’s own head verbatim, in design’s frame', () => {
    const [form] = publishedLabels().get('NMA-WAITING') as [string]
    for (const head of ['Delete 3 tasks?', '“Meeting” matches two tasks — which one?']) {
      const view = affordanceFor(1, [question('q1', head)])
      expect(view?.row).toBe('NMA-WAITING')
      expect(view?.label).toBe(form.replace('{question}', head))
      // `question` is a `verbatim` slot: passed through unmodified, never
      // re-worded for the pill.
      expect(view?.label).toContain(head)
    }
  })

  it('the accessible name is the visible label plus the action — two literals, because the punctuation differs', () => {
    const newName = publishedAccessibleName('NMA-NEW')
    const waitName = publishedAccessibleName('NMA-WAITING')
    expect(newName).not.toBe(waitName)

    const counted = affordanceFor(3, [aiMessage('m1'), aiMessage('m2'), aiMessage('m3')])
    expect(counted?.accessibleName).toBe(newName.replace('{label}', counted?.label as string))
    const asking = affordanceFor(1, [question('q1', 'Delete 3 tasks?')])
    expect(asking?.accessibleName).toBe(waitName.replace('{label}', asking?.label as string))

    // WCAG 2.5.3: the visible text is always a PREFIX of the accessible name,
    // never a replacement.
    expect(counted?.accessibleName.startsWith(counted?.label as string)).toBe(true)
    expect(asking?.accessibleName.startsWith(asking?.label as string)).toBe(true)
  })

  it('no label is derived — every published fixed part appears as a literal in the OWNING module', () => {
    // L-008 rule 3: this is the assertion that makes "literals, not templates"
    // enforceable rather than a convention. A template that interpolated the
    // noun would satisfy every behavioural assertion above and fail here.
    // The owner is the shared module, which is exactly the point of the merge.
    const src = readFileSync(SHARED_FOLLOW_SRC, 'utf8')
    expect(src.length, 'the shared module is empty — the scan would be vacuous').toBeGreaterThan(500)
    const fixedParts = [...publishedLabels().values()]
      .flat()
      .map((form) => form.replace(/\{[a-z]+\}/g, '').trim())
      .filter((part) => part.length > 0)
    expect(fixedParts.length, 'no fixed parts were extracted').toBeGreaterThan(1)
    for (const part of fixedParts) {
      expect(src, `"${part}" is not a literal in _shared/model/follow.ts`).toContain(part)
    }
  })
})

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const AT = '2026-08-17T09:00:00.000Z'

function viewport(over: Partial<ScrollMetrics> = {}): ScrollMetrics {
  return { contentHeight: 2000, scrollOffset: 1500, viewportHeight: 500, ...over }
}

function aiMessage(id: string): Message {
  return { id, kind: 'no-match', heard: 'call the dentist', at: AT } as Message
}

function userMessage(id: string): Message {
  return {
    id,
    kind: 'user',
    text: 'move the budget review to four',
    via: 'typed',
    at: AT,
    queued: false,
    clientTurnId: 'cid-1',
  } as Message
}

function question(id: string, head: string, resolved = false): Message {
  return {
    id,
    kind: 'question',
    turnId: `turn-${id}`,
    qkind: 'bulk_delete',
    head,
    body: null,
    options: ['Delete 3 tasks', 'Keep them'],
    taskTitles: ['Buy milk', 'Order the cake', 'Collect the parcel'],
    resolved,
    at: AT,
  } as Message
}

/** The NMA-NEW label for `n` arrivals, taken from the real builder. */
function labelOf(n: number): string {
  const messages = Array.from({ length: n }, (_, i) => aiMessage(`m${i}`))
  return affordanceFor(n, messages)?.label as string
}

const AWAY = viewport({ scrollOffset: 200 })
const ATBOTTOM = viewport()

// ---------------------------------------------------------------------------
// (a) — the ordering that makes the number mean anything
// ---------------------------------------------------------------------------

describe('AC-30(a) — the sample is taken BEFORE the append', () => {
  it('SAMPLING AFTER THE APPEND INSTEAD switches the whole feature off', () => {
    // This is the defect the clause exists to prevent, asserted rather than
    // described: it would ship looking like "the feature just doesn't work
    // sometimes". The user IS at the bottom; appending grows content_height by
    // the new row's height; a sample taken afterwards reports them as away.
    const before = viewport()
    const after = { ...before, contentHeight: before.contentHeight + 120 }

    expect(isAtBottom(before)).toBe(true)
    expect(isAtBottom(after)).toBe(false)

    // The decision function takes the sample as an argument precisely so the
    // caller has to name which one it is handing over.
    expect(onMessagesAppended(0, before, [aiMessage('m1')]).follow).toBe(true)
    expect(onMessagesAppended(0, after, [aiMessage('m1')]).follow).toBe(false)
  })

  it('the hook takes its sample from a stored pre-append measurement, never from a fresh read', () => {
    // The behavioural half above cannot see WHICH sample the view passes, and
    // the view is React Native so this tier cannot render it. What is checkable
    // is that the decision is made in the commit that appended (before RN's
    // content-size callback for the new content) and reads the stored ref.
    //
    // This is where mobile legitimately differs from web: web samples the DOM
    // during render, because the element still holds the pre-append content at
    // that moment. RN has no synchronously readable geometry — measurements
    // arrive as events — so the sample must be kept.
    const src = readFileSync(HOOK_SRC, 'utf8')
    expect(src.length, 'the hook is empty — the scan would be vacuous').toBeGreaterThan(500)
    expect(src, 'the append decision no longer runs in a layout effect').toContain('useLayoutEffect')
    expect(src, 'the append decision no longer feeds it the stored sample').toContain(
      'onMessagesAppended(unseen, sample.current, arrived',
    )
  })
})

describe('AC-30(a) — …and not while a scroll of OURS is passing through (BUG-006)', () => {
  it('the mid-flight sample from the report is not the user’s position', () => {
    // BUG-006's t1, replayed: the clause-(h) scroll is still moving, the reply
    // to that same turn appends, and the live sample says 270 units from the
    // bottom. Read literally that is clause (c), and the answer to what the user
    // just said is left below the fold.
    const midFlight: ScrollMetrics = { contentHeight: 1327, scrollOffset: 474, viewportHeight: 583 }
    expect(distanceFromBottom(midFlight)).toBe(270)
    expect(isAtBottom(midFlight), 'setup: the live sample must read NOT at the bottom').toBe(false)

    const reply = aiMessage('a1')
    expect(onMessagesAppended(0, midFlight, [reply]).follow, 'the defect').toBe(false)
    expect(
      onMessagesAppended(0, midFlight, [reply], { ourScrollInFlight: true }).follow,
      'a scroll of ours in flight still read as the user being away',
    ).toBe(true)
    expect(onMessagesAppended(0, midFlight, [reply], { ourScrollInFlight: true }).unseen).toBe(0)
  })

  it('the answer comes from the SHARED predicate, not a second one written here', () => {
    // AC-30(a) is "the same number on both clients", and BUG-006's resolution is
    // part of (a). Web reached it first; a mobile re-derivation would be L-004's
    // shape again, one clause further in.
    const mobileSrc = codeOf(MOBILE_FOLLOW_SRC)
    expect(mobileSrc, 'mobile no longer reads the shared predicate').toContain('userIsAtBottom(')
    expect(mobileSrc, 'mobile re-declares the predicate').not.toMatch(
      /export function userIsAtBottom\b/,
    )
    // …and it agrees with the shared file about what the flag means.
    expect(userIsAtBottom(AWAY, true)).toBe(true)
    expect(userIsAtBottom(AWAY, false)).toBe(false)
  })

  it('an in-flight allowance does NOT survive the scroll — the three ways it ends', () => {
    // A flag that is only ever raised turns "follow while we are on our way"
    // into "follow always", which is clause (c) deleted rather than BUG-006
    // fixed. Each ending is a transition, so each one is checkable here.
    const issued = onScrollIssued(true, 424)
    expect(issued.inFlight).toBe(true)

    // 1. arrival — a sample within the threshold
    const arrived = onFlightSample(issued, viewport({ scrollOffset: 1500 }))
    expect(arrived.flight.inFlight).toBe(false)
    expect(arrived.takenOver).toBe(false)

    // 2. taken over — an offset that moved AWAY from the bottom. Ours only ever
    //    travels toward it.
    const moving = onFlightSample(issued, viewport({ scrollOffset: 600 })).flight
    expect(moving.inFlight, 'progress toward the bottom is not a takeover').toBe(true)
    const taken = onFlightSample(moving, viewport({ scrollOffset: 200 }))
    expect(taken.flight.inFlight).toBe(false)
    expect(taken.takenOver).toBe(true)
    // one unit of device-pixel residue is not a takeover — the same reason
    // clause (a) carries slack at all
    expect(onFlightSample(moving, viewport({ scrollOffset: 599 })).takenOver).toBe(false)

    // 3. the user took hold, before anything has moved
    expect(onUserTookHold(moving).inFlight).toBe(false)
  })

  it('an INSTANT scroll is never in flight — which is why reduce-motion never had this', () => {
    // Clause (g)'s scroll has already arrived when the call returns, so there is
    // no window for anything to land during it. TC-046 passes and always did,
    // and that is precisely why reduce-motion coverage cannot catch a regression
    // of BUG-006.
    expect(onScrollIssued(false, 424).inFlight).toBe(false)
    expect(onScrollIssued(scrollAnimated(true), 424).inFlight).toBe(false)
    expect(onScrollIssued(scrollAnimated(false), 424).inFlight).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// (b) (c) (d)
// ---------------------------------------------------------------------------

describe('AC-30(b) — at the bottom, the message arrives in view', () => {
  it('follows, and raises no affordance', () => {
    const out = onMessagesAppended(0, ATBOTTOM, [aiMessage('m1')])
    expect(out.follow).toBe(true)
    expect(out.unseen).toBe(0)
    expect(affordanceFor(out.unseen, [aiMessage('m1')])).toBeNull()
  })

  it('a first render of history starts at the bottom, with no affordance', () => {
    const history = [userMessage('h1'), aiMessage('h2')]
    const out = onMessagesAppended(0, UNMEASURED, history)
    expect(out.follow).toBe(true)
    expect(affordanceFor(out.unseen, history)).toBeNull()
  })

  it('history REPLACED mid-session is a first render too, whatever the old viewport said', () => {
    // F-001 AC-28's clean start replaces the conversation with a single boundary
    // message. It is not an append, so the pre-append sample describes a
    // viewport that no longer exists — and "first render of a session's history
    // also starts at the bottom" governs instead. Without this branch a clean
    // start arriving while the user was scrolled up would hold the view on
    // content that had just been discarded and raise an affordance for it.
    const boundary = {
      id: 'b1',
      kind: 'boundary',
      head: 'Session closed — idle',
      lines: ['Declined on close: “Delete 3 tasks?”'],
      at: AT,
    } as Message
    const out = onMessagesAppended(4, AWAY, [boundary], { replacedHistory: true })
    expect(out.follow).toBe(true)
    expect(out.unseen).toBe(0)
  })
})

describe('AC-30(c) — not at the bottom, the view does not move', () => {
  it('starts no scroll at all — not a shorter one, not a gentler one', () => {
    const out = onMessagesAppended(0, AWAY, [aiMessage('m1')])
    expect(out.follow).toBe(false)
    expect(out.unseen).toBe(1)
  })

  it('an append with nothing in it moves nothing and adds nothing', () => {
    // AC-3's cancel-before-send renders nothing, and AC-30(h) says a submit
    // that appends nothing scrolls nothing.
    const out = onMessagesAppended(1, AWAY, [])
    expect(out.follow).toBe(false)
    expect(out.unseen).toBe(1)
  })
})

describe('AC-30(d) — ONE affordance, however many messages', () => {
  it('after N ≥ 2 arrivals there is exactly one affordance, and it counts them', () => {
    const messages: Message[] = []
    let unseen = 0
    const rows = new Set<string>()
    for (const n of [1, 2, 3, 4, 5]) {
      const m = aiMessage(`m${n}`)
      messages.push(m)
      const out = onMessagesAppended(unseen, AWAY, [m])
      expect(out.follow, `arrival ${n} must not move the view`).toBe(false)
      unseen = out.unseen
      const view = affordanceFor(unseen, messages)
      expect(view, `arrival ${n} must still show a control`).not.toBeNull()
      rows.add((view as { row: string }).row)
    }
    // The count is the assertion the clause names: after five appends there is
    // one control reporting five, not five controls.
    expect(unseen).toBe(5)
    expect(rows.size).toBe(1)
    expect(affordanceFor(5, messages)?.label).toBe(labelOf(5))
  })

  it('it appears on the FIRST message that arrives while away, and persists across later ones', () => {
    const first = aiMessage('m1')
    const one = onMessagesAppended(0, AWAY, [first])
    expect(affordanceFor(one.unseen, [first])).not.toBeNull()
    const second = aiMessage('m2')
    const two = onMessagesAppended(one.unseen, AWAY, [second])
    // Same control, same row — the count grew rather than the control
    // duplicating or re-mounting.
    expect(two.unseen).toBe(2)
    expect(affordanceFor(two.unseen, [first, second])?.row).toBe('NMA-NEW')
  })

  it('the below-the-fold set is the TAIL of the conversation, never the whole of it', () => {
    const messages = [aiMessage('old1'), aiMessage('old2'), question('q1', 'Delete 3 tasks?')]
    expect(belowFoldSlice(1, messages).map((m) => m.id)).toEqual(['q1'])
    expect(belowFoldSlice(0, messages)).toEqual([])
    // …so a question the user has ALREADY seen cannot make the pill say the app
    // is waiting.
    expect(affordanceFor(0, messages)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// (e) — waiting, not merely arrived
// ---------------------------------------------------------------------------

describe('AC-30(e) — it says something is WAITING, not merely that something arrived', () => {
  it('an unresolved question below the fold makes it NMA-WAITING, quoting the question', () => {
    const q = question('q1', 'Delete 3 tasks?')
    const out = onMessagesAppended(0, AWAY, [q])
    const view = affordanceFor(out.unseen, [q])
    expect(view?.row).toBe('NMA-WAITING')
    expect(view?.accessibleName).toContain('Delete 3 tasks?')
  })

  it('the two cases are DISTINGUISHABLE in words, so colour is never the sole carrier', () => {
    const arrivedOnly = affordanceFor(1, [aiMessage('m1')])
    const waiting = affordanceFor(1, [question('q1', 'Delete 3 tasks?')])
    expect(arrivedOnly?.row).not.toBe(waiting?.row)
    expect(arrivedOnly?.label).not.toBe(waiting?.label)
    expect(arrivedOnly?.accessibleName).not.toBe(waiting?.accessibleName)
    // One undifferentiated "new messages" rendering serving both does not
    // satisfy the clause.
    expect(waiting?.label).not.toBe(labelOf(1))
  })

  it('NMA-WAITING outranks NMA-NEW whatever else arrived — a count cannot say the app is waiting', () => {
    const messages = [aiMessage('m1'), question('q1', 'Delete 3 tasks?'), aiMessage('m2')]
    const view = affordanceFor(3, messages)
    expect(view?.row).toBe('NMA-WAITING')
    expect(view?.label).not.toBe(labelOf(3))
  })

  it('a RESOLVED question is no longer pending, so the control falls back to NMA-NEW', () => {
    // Answered, or declined by a later unrelated turn (§ Outcome
    // declined-superseded) — either way it is not waiting on the user.
    const messages = [question('q1', 'Delete 3 tasks?', true), aiMessage('m2')]
    const view = affordanceFor(2, messages)
    expect(view?.row).toBe('NMA-NEW')
    expect(view?.label).toBe(labelOf(2))
  })

  it('it names its NEWEST reason when two questions are below the fold', () => {
    const older = question('q1', 'Delete 3 tasks?')
    const newer = question('q2', '“Meeting” matches two tasks — which one?')
    const view = affordanceFor(2, [older, newer])
    expect(view?.label).toContain('“Meeting” matches two tasks — which one?')
    expect(view?.label).not.toContain('Delete 3 tasks?')
  })

  it('mobile and the shared builder are the same answer, not two that agree', () => {
    // `affordanceFor` is an adapter, not a second implementation: it supplies
    // the tail and delegates. Asserted so a future edit cannot quietly make it
    // decide anything of its own.
    const messages = [aiMessage('m1'), question('q1', 'Delete 3 tasks?')]
    expect(affordanceFor(2, messages)).toEqual(newMessageAffordance(2, messages))
    expect(affordanceFor(1, messages)).toEqual(newMessageAffordance(1, [messages[1] as Message]))
  })
})

// ---------------------------------------------------------------------------
// (f) — activation, and the dismissal condition
// ---------------------------------------------------------------------------

describe('AC-30(f) — reaching the bottom dismisses it, whichever way you got there', () => {
  it('a sample at the bottom clears the affordance — the condition is BEING there, not the gesture', () => {
    expect(onScrolled(2, ATBOTTOM)).toBe(0)
    expect(affordanceFor(onScrolled(2, ATBOTTOM), [aiMessage('m1'), aiMessage('m2')])).toBeNull()
  })

  it('a sample still away from the bottom leaves it exactly as it was', () => {
    expect(onScrolled(2, AWAY)).toBe(2)
  })

  it('activation and submit share ONE routine, called from three places', () => {
    // (f) and (h) have the same postcondition, and two implementations of one
    // postcondition drift (L-005). The AC asks that a grep for the routine's
    // name return every caller; this is that grep, executed.
    const src = readFileSync(HOOK_SRC, 'utf8')
    const references = [...src.matchAll(/\bscrollToNewest\b/g)]
    // Non-vacuity first (L-007): a renamed routine must fail here loudly rather
    // than pass over an empty grep.
    expect(references.length, 'scrollToNewest has been renamed or removed').toBeGreaterThan(2)
    expect(src, 'the routine is no longer defined here').toContain('const scrollToNewest =')

    // The three triggers, each reaching the SAME routine:
    //   (b) an append while at the bottom — and (h) with it, because they are
    //       one append rule, which is exactly why (h) cannot land short;
    expect(src, '(b)/(h) no longer route through the routine').toMatch(
      /if \(outcome\.follow\) \{\s*\n\s*scrollToNewest\(\)/,
    )
    //   (f) activating the affordance — the same function object, not a copy.
    expect(src, '(f) no longer routes through the routine').toContain(
      'activateAffordance: scrollToNewest',
    )

    // …and there is no second implementation of the postcondition anywhere in
    // the module: exactly one call into React Native's scroll API.
    expect([...src.matchAll(/scrollToEnd\(/g)], 'a second scroll implementation').toHaveLength(1)
  })

  it('tapping ONLY scrolls — the pill never answers, dismisses or resolves anything', () => {
    // The pill's only behavioural prop is `onPress`, and the only thing the hook
    // hands it is the scroll routine: it cannot become a second, quieter answer
    // path (AC-10 keeps the OptionChips the only way to answer).
    const pill = readFileSync(
      resolve(import.meta.dirname, '../components/NewMessageAffordance.tsx'),
      'utf8',
    )
    expect(pill.length).toBeGreaterThan(500)
    expect(pill).not.toContain('chipTap')
    expect(pill).not.toContain('controller')
  })
})

// ---------------------------------------------------------------------------
// (g) — reduced motion
// ---------------------------------------------------------------------------

describe('AC-30(g) — reduced motion binds EVERY scroll this AC mandates', () => {
  it('the observable is the ABSENCE of animation, not a shortened duration', () => {
    expect(scrollAnimated(false)).toBe(true)
    expect(scrollAnimated(true)).toBe(false)
  })

  it('the guard sits on the scroll itself, not on the clauses that trigger it', () => {
    // The clause is a quantifier, not a list, because a three-item list with a
    // guard on two is the shape that produced BUG-001 and BUG-002 (L-005). So
    // there is exactly ONE place `animated` is decided, and it is inside the one
    // routine every path ends at.
    const src = readFileSync(HOOK_SRC, 'utf8')
    expect([...src.matchAll(/scrollAnimated\(/g)]).toHaveLength(1)
    expect([...src.matchAll(/animated:/g)]).toHaveLength(1)
  })

  it('the setting is read at scroll time, so flipping it mid-session takes effect', async () => {
    // AC-30(g) names `AccessibilityInfo.isReduceMotionEnabled()` for mobile and
    // `prefers-reduced-motion` for web, so the two SOURCES are the AC's own,
    // not a divergence. Here it arrives through the `ReduceMotion` port.
    const h = await mobileHarness({ platform: 'ios' })
    expect(h.controller.reduceMotionEnabled()).toBe(false)
    h.reduceMotion.set(true)
    expect(h.controller.reduceMotionEnabled()).toBe(true)
    expect(scrollAnimated(h.controller.reduceMotionEnabled())).toBe(false)
    h.reduceMotion.set(false)
    expect(scrollAnimated(h.controller.reduceMotionEnabled())).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// (h) — the user's own submit
// ---------------------------------------------------------------------------

describe('AC-30(h) — submitting a turn scrolls to the bottom', () => {
  it('scrolls from wherever the view was, and clears the affordance', () => {
    const out = onMessagesAppended(2, AWAY, [userMessage('u1')])
    expect(out.follow).toBe(true)
    // The end state is identical to (f)'s: at the bottom, no affordance.
    expect(out.unseen).toBe(0)
    expect(affordanceFor(out.unseen, [userMessage('u1')])).toBeNull()
  })

  it('the moment is the APPEND of the user’s message, not the submit gesture', () => {
    // F-001 renders the turn optimistically, so these are two different
    // instants and the earlier one is wrong: at gesture time the message is not
    // in the content yet and the scroll lands short by exactly that row. The
    // rule is therefore expressed over what arrived, never over an event fired
    // at the tap.
    const gestureWithNoAppend = onMessagesAppended(1, AWAY, [])
    expect(gestureWithNoAppend.follow).toBe(false)
    expect(gestureWithNoAppend.unseen).toBe(1)

    expect(onMessagesAppended(1, AWAY, [userMessage('u1')]).follow).toBe(true)
  })

  it('nothing is pinned beyond that append — the reply arrives in view through (b), on its own', () => {
    // Having scrolled, the user is at the bottom by (a), so the assistant's
    // reply follows through the ordinary at-the-bottom rule. There is no
    // follow-this-turn-until-it-resolves mode.
    const afterSubmit = onMessagesAppended(1, AWAY, [userMessage('u1')])
    expect(afterSubmit.follow).toBe(true)
    expect(onMessagesAppended(afterSubmit.unseen, ATBOTTOM, [aiMessage('a1')]).follow).toBe(true)

    // …and it does NOT reopen rule 5: a confirmation arriving with no send from
    // this user is still governed by (c) and (e).
    const q = question('q9', 'Delete 3 tasks?')
    const unsolicited = onMessagesAppended(0, AWAY, [q])
    expect(unsolicited.follow).toBe(false)
    expect(affordanceFor(unsolicited.unseen, [q])?.row).toBe('NMA-WAITING')
  })
})

// ---------------------------------------------------------------------------
// The announcement path (F-001 AC-19 / F-003 AC-12)
// ---------------------------------------------------------------------------

describe('AC-30(e) — the distinction reaches a screen reader too', () => {
  it('the announcement is built from the control, not authored beside it', () => {
    const view = affordanceFor(1, [question('q1', 'Delete 3 tasks?')])
    const a = affordanceAnnouncement(view)
    expect(a?.text).toBe(view?.accessibleName)
    // Polite, never assertive: interrupting the message being read in order to
    // say something is waiting would bury the content already arriving.
    expect(a?.assertive).toBe(false)
    expect(affordanceAnnouncement(null)).toBeNull()
  })

  it('the controller announces its arrival and its CHANGE, but not a re-render', async () => {
    // React Native has no live region (web gets `aria-live` from the DOM), so
    // components.md's "polite live region" is this imperative announcement.
    const h = await mobileHarness({ platform: 'ios' })
    h.announcer.clear()

    const arrived = affordanceFor(1, [aiMessage('m1')])
    h.controller.announceAffordance(arrived)
    h.controller.announceAffordance(arrived) // same words: not news
    expect(h.announcer.texts()).toHaveLength(1)
    expect(h.announcer.texts()[0]).toBe(arrived?.accessibleName)

    const messages = [aiMessage('m1'), question('q1', 'Delete 3 tasks?')]
    h.controller.announceAffordance(affordanceFor(2, messages))
    expect(h.announcer.texts()).toHaveLength(2)
    expect(h.announcer.texts()[1]).toContain('Delete 3 tasks?')
    expect(h.announcer.announcements.every((a) => !a.assertive)).toBe(true)

    // Hidden again, then back: the second arrival is news once more.
    h.controller.announceAffordance(null)
    h.controller.announceAffordance(arrived)
    expect(h.announcer.texts()).toHaveLength(3)
  })
})
