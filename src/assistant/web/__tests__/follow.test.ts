// AC-30's arithmetic and its copy — the tier that can actually falsify them.
//
// Everything here is pure: no DOM, no React, no layout. That is the point. The
// component tier renders in jsdom, which has NO LAYOUT — `scrollHeight` and
// `clientHeight` are 0 there unless a test fakes them — so a "does it scroll?"
// assertion written against raw jsdom passes whatever the implementation does.
// The falsifiable half is the sum, and it lives in `_shared/model/follow.ts`
// precisely so both clients can be held to the same number.
//
// The copy assertions PARSE `design/_shared/components.md` at run time
// (L-008/L-002). If they retyped design's strings, design and implementation
// could drift apart while both halves of the test still agreed with each other.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BOTTOM_SLACK,
  distanceFromBottom,
  isAtBottom,
  newMessageAffordance,
  pendingQuestionHead,
} from '../../_shared/model/follow.ts'
import type { Message } from '../../_shared/types.ts'

const CATALOGUE_FILE = resolve(process.cwd(), 'design/_shared/components.md')
const IMPLEMENTATION_FILE = resolve(process.cwd(), 'src/assistant/_shared/model/follow.ts')

// ---------------------------------------------------------------------------
// The published catalogue, read — never hand-copied
// ---------------------------------------------------------------------------

/** The level of a markdown ATX heading, or 0 when the line is not a heading. */
function headingLevel(line: string): number {
  const m = /^(#{1,6})\s/.exec(line)
  return m === null ? 0 : (m[1] as string).length
}

/** The lines of one section — its heading to the next heading of the same or
 * higher level. Throws rather than returning nothing if the heading moves: a
 * parser that matches nothing is green exactly like one that works (L-007). */
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

const SECTION = sectionLines(readFileSync(CATALOGUE_FILE, 'utf8'), /^#{1,6}\s+NewMessageAffordance\b/)

/** The row table: `| **ID** | state | shown when | label | rendering |`. */
function publishedRows(): Map<string, { state: string; label: string }> {
  const rows = new Map<string, { state: string; label: string }>()
  for (const line of SECTION) {
    const m = /^\|\s*\*\*([A-Z-]+)\*\*\s*\|(.*)\|\s*$/.exec(line)
    if (m === null) continue
    const cells = (m[2] as string).split('|').map((c) => c.trim())
    if (cells.length !== 4) continue
    const [state, , label] = cells as [string, string, string, string]
    rows.set(m[1] as string, { state, label })
  }
  if (rows.size === 0) {
    throw new Error(`${CATALOGUE_FILE}: §NewMessageAffordance parsed to zero rows — the table moved`)
  }
  return rows
}

const PUBLISHED = publishedRows()

/** The label cell as design writes it, unwrapped from its backticks:
 *  NMA-NEW publishes two alternatives separated by ` · `; NMA-WAITING one. */
function labelForms(rowId: string): string[] {
  const row = PUBLISHED.get(rowId)
  if (row === undefined) throw new Error(`${CATALOGUE_FILE}: no row ${rowId}`)
  return [...row.label.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string)
}

/** The two accessible-name forms, from the A11y paragraph. Two literals,
 * because the punctuation differs and a template would guess. */
function accessibleNameForm(rowId: string): string {
  const text = SECTION.join('\n')
  const m = new RegExp(`${rowId}\\s*→\\s*\`([^\`]+)\``).exec(text)
  if (m === null) throw new Error(`${CATALOGUE_FILE}: no accessible-name form published for ${rowId}`)
  return m[1] as string
}

// ---------------------------------------------------------------------------
// (a) — the number, and it is the same number on both clients
// ---------------------------------------------------------------------------

describe('AC-30(a) — "at the bottom" is a number', () => {
  it('is the AC formula: content_height − (scroll_offset + viewport_height)', () => {
    expect(distanceFromBottom({ contentHeight: 2400, scrollOffset: 0, viewportHeight: 400 })).toBe(2000)
    expect(distanceFromBottom({ contentHeight: 2400, scrollOffset: 2000, viewportHeight: 400 })).toBe(0)
    // over-scroll (rubber-banding) is past the bottom, not before it
    expect(distanceFromBottom({ contentHeight: 900, scrollOffset: 700, viewportHeight: 400 })).toBe(-200)
  })

  it('holds the 48-unit slack exactly — 48 is at the bottom, 49 is not', () => {
    expect(BOTTOM_SLACK).toBe(48)
    const at = (d: number) => isAtBottom({ contentHeight: 1000 + d, scrollOffset: 600, viewportHeight: 400 })
    expect(at(47)).toBe(true)
    expect(at(48)).toBe(true)
    expect(at(49)).toBe(false)
    // and the slack is slack, not a rounding fudge: half a viewport away is away
    expect(at(200)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// (d) + (e) — one affordance, and it says something is WAITING
// ---------------------------------------------------------------------------

const at = '2026-08-17T14:00:00.000Z'

function question(id: string, head: string, resolved = false): Message {
  return {
    id,
    kind: 'question',
    turnId: `turn-${id}`,
    qkind: 'bulk_delete',
    head,
    body: null,
    options: ['Yes', 'No'],
    taskTitles: [],
    resolved,
    at,
  }
}

function outcome(id: string): Message {
  return { id, kind: 'outcome', head: 'Added 1 task', body: [], at }
}

describe('AC-30(d)/(e) — the affordance', () => {
  it('is hidden while nothing arrived below the fold (NMA-HIDDEN)', () => {
    expect(newMessageAffordance(0, [])).toBeNull()
    expect(newMessageAffordance(-1, [])).toBeNull()
  })

  it('reports a count in the two published forms, and only those two (NMA-NEW)', () => {
    const forms = labelForms('NMA-NEW')
    expect(forms).toHaveLength(2)
    const [singular, plural] = forms as [string, string]
    expect(newMessageAffordance(1, [outcome('m1')])?.label).toBe(singular)
    // the plural form is a slot over an INTEGER, never a template over the noun
    for (const n of [2, 3, 12]) {
      expect(newMessageAffordance(n, [outcome('m1')])?.label).toBe(plural.replace('{count}', String(n)))
    }
  })

  it('stops reporting and asks when a question is pending off screen (NMA-WAITING)', () => {
    const form = labelForms('NMA-WAITING')[0] as string
    const v = newMessageAffordance(3, [outcome('m1'), question('m2', 'Delete 3 tasks?'), outcome('m3')])
    expect(v?.row).toBe('NMA-WAITING')
    expect(v?.label).toBe(form.replace('{question}', 'Delete 3 tasks?'))
  })

  it('quotes the question verbatim — never re-worded for the pill', () => {
    const head = '“Meeting” matches two tasks — which one?'
    expect(newMessageAffordance(1, [question('m1', head)])?.label).toContain(head)
  })

  it('names its NEWEST reason when two questions are below the fold', () => {
    const arrived = [question('m1', 'Delete 3 tasks?'), question('m2', '2 tasks match — which one?')]
    expect(pendingQuestionHead(arrived)).toBe('2 tasks match — which one?')
  })

  it('falls back to NMA-NEW once the question resolves — answered or superseded', () => {
    const arrived = [outcome('m1'), question('m2', 'Delete 3 tasks?', true)]
    expect(pendingQuestionHead(arrived)).toBeNull()
    expect(newMessageAffordance(2, arrived)?.row).toBe('NMA-NEW')
  })

  it('distinguishes the two cases by WORDS, not only by state — colour is never alone', () => {
    const waiting = newMessageAffordance(2, [outcome('m1'), question('m2', 'Delete 3 tasks?')])
    const plain = newMessageAffordance(2, [outcome('m1'), outcome('m2')])
    expect(waiting?.label).not.toBe(plain?.label)
    expect(waiting?.accessibleName).not.toBe(plain?.accessibleName)
  })

  it('exposes the published accessible name — visible label first, then the action (2.5.3)', () => {
    const plain = newMessageAffordance(3, [outcome('m1')])
    expect(plain?.accessibleName).toBe(
      accessibleNameForm('NMA-NEW').replace('{label}', plain?.label ?? ''),
    )
    expect(plain?.accessibleName.startsWith(plain?.label ?? '')).toBe(true)

    const waiting = newMessageAffordance(1, [question('m1', 'Delete 3 tasks?')])
    expect(waiting?.accessibleName).toBe(
      accessibleNameForm('NMA-WAITING').replace('{label}', waiting?.label ?? ''),
    )
    expect(waiting?.accessibleName.startsWith(waiting?.label ?? '')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// The rule that makes the assertions above enforceable rather than a convention
// ---------------------------------------------------------------------------

describe('no label is derived — every published form appears literally in the model', () => {
  it('carries each fixed fragment of each published label verbatim (L-008)', () => {
    const src = readFileSync(IMPLEMENTATION_FILE, 'utf8')
    const forms = [...labelForms('NMA-NEW'), ...labelForms('NMA-WAITING')]
    expect(forms).toHaveLength(3)
    for (const form of forms) {
      // the slots are design's closed vocabulary — `count` (an integer) and
      // `question` (verbatim). Everything else is copy, and copy must be a
      // literal in the source: a fragment that was never written cannot ship.
      for (const fragment of form.split(/\{[a-z]+\}/)) {
        if (fragment.trim() === '') continue
        expect(src, `missing literal: “${fragment}”`).toContain(fragment)
      }
    }
  })
})
