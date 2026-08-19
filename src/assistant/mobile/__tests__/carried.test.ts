// § CarriedNotice on the phone — F-005 AC-47's `(mobile)` half, AC-2's failed and
// offline-refused states, and AC-43's undo offer.
//
// The copy assertions **parse `design/_shared/components.md`** rather than compare
// against retyped strings. That is L-008 rule 2 and the reason is directional: a
// hand-transcribed expectation turns a contract check into a self-agreement check,
// so design and the implementation can drift apart while both halves of the test
// still agree with each other. Parsing the owning artifact fails when the
// **upstream** moves, which is the direction drift actually travels.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CN_DELETED,
  CN_FAILED,
  CN_FIELD_LABEL,
  CN_OFFLINE,
  CN_SUPERSEDED,
  cnUndo,
  cnUndone,
  copyField,
  regionName,
} from '../../_shared/model/notice-copy.ts'
import type { CopyField } from '../../_shared/model/notice-copy.ts'
import { initialState } from '../../_shared/model/reducer.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { Notice, UndoAction, UndoOffer } from '../../_shared/types.ts'
import { SHELL_A11Y_IDS } from '../model/a11y.ts'
import { carriedRegionOccupied, carriedRowFor, carriedRows } from '../model/carried.ts'
import { T0 } from './_helpers.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const MD = readFileSync(resolve(ROOT, 'design/_shared/components.md'), 'utf8')
const SECTION = MD.split('## CarriedNotice')[1] as string
const MOBILE_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The seven-row literal-message table, parsed per field. */
function literalTable(): Map<string, { failed: string; offline: string; superseded: string }> {
  const rows = new Map<string, { failed: string; offline: string; superseded: string }>()
  const start = SECTION.indexOf('| Field | CN-FAILED | CN-OFFLINE | CN-SUPERSEDED |')
  expect(start, 'the literal-message table is missing from § CarriedNotice').toBeGreaterThan(-1)
  for (const line of SECTION.slice(start).split('\n')) {
    const m = /^\|\s*([a-z_]+)\s*\|\s*`(.+?)`\s*\|\s*`(.+?)`\s*\|\s*`(.+?)`\s*\|/.exec(line)
    if (m === null) {
      if (rows.size > 0 && line.trim() === '') break
      continue
    }
    rows.set(m[1] as string, {
      failed: m[2] as string,
      offline: m[3] as string,
      superseded: m[4] as string,
    })
  }
  return rows
}

/** design's `{task}` slot filled with a title, so a parsed cell can be compared to
 * a rendered sentence. It is a `verbatim` slot — the task's own title, never
 * re-worded — so this is the only substitution the comparison performs. */
function fill(cell: string, title: string): string {
  return cell.replaceAll('{task}', title)
}

function noticeWith(over: Partial<Notice> = {}): Notice {
  return {
    taskId: 'task-1',
    taskTitle: 'Buy milk',
    fields: [{ field: 'note', value: 'call first', baseline: null, reason: 'failed', superseded: false }],
    ended: null,
    at: T0,
    ...over,
  }
}

function stateWith(over: Partial<AppState> = {}): AppState {
  return { ...initialState('available'), ...over }
}

describe('§ CarriedNotice — the literals are design’s, parsed not retyped', () => {
  it('all seven user-settable fields are published, and no more', () => {
    // *"The seven fields are the user-settable set F-005 AC-1 names, and no more"* —
    // `due_all_day`, `parent_id`, `step_order` and `series_id` are not user controls,
    // so no write of theirs can produce a notice.
    const rows = literalTable()
    expect([...rows.keys()].sort()).toEqual([
      'deadline',
      'note',
      'priority',
      'reminder',
      'repeat',
      'step',
      'title',
    ])
  })

  it('every CN-FAILED, CN-OFFLINE and CN-SUPERSEDED sentence matches its published cell', () => {
    const rows = literalTable()
    for (const [field, cells] of rows) {
      const f = field as CopyField
      expect(CN_FAILED[f]('Buy milk'), `${field} CN-FAILED`).toBe(fill(cells.failed, 'Buy milk'))
      expect(CN_OFFLINE[f]('Buy milk'), `${field} CN-OFFLINE`).toBe(fill(cells.offline, 'Buy milk'))
      expect(CN_SUPERSEDED[f]('Buy milk'), `${field} CN-SUPERSEDED`).toBe(
        fill(cells.superseded, 'Buy milk'),
      )
    }
  })

  it('CN-DELETED is design’s one literal', () => {
    expect(SECTION).toContain('`"{task}" was deleted. What you typed wasn\'t saved.`')
    expect(CN_DELETED('Buy milk')).toBe('"Buy milk" was deleted. What you typed wasn\'t saved.')
  })

  it('CN-UNDO and CN-UNDONE are four literals each, one per class of undoable action', () => {
    const actions: UndoAction[] = [
      { kind: 'delete-task', taskId: 't1', title: 'Buy milk' },
      { kind: 'delete-step', taskId: 't2', title: 'Plan the party', parentId: 'p1' },
      { kind: 'delete-series', taskId: 't3', title: 'Water the plants' },
      { kind: 'move-step', taskId: 't4', title: 'Plan the party', priorStepOrder: 2 },
    ]
    for (const a of actions) {
      // Compared with the title set to design's own `{task}` slot, so the rendered
      // sentence is byte-comparable with the published cell. This is the direction
      // that catches a reworded literal upstream — the whole point of parsing rather
      // than retyping.
      const slotted = { ...a, title: '{task}' } as UndoAction
      expect(SECTION.includes(cnUndo(slotted)), `CN-UNDO ${a.kind}: ${cnUndo(slotted)}`).toBe(true)
      expect(
        SECTION.includes(cnUndone(slotted)),
        `CN-UNDONE ${a.kind}: ${cnUndone(slotted)}`,
      ).toBe(true)
    }
    // four distinct literals, not one template
    expect(new Set(actions.map(cnUndo)).size).toBe(4)
    expect(new Set(actions.map(cnUndone)).size).toBe(4)
  })

  it('the seven field labels are design’s, and the region has design’s two names', () => {
    for (const label of Object.values(CN_FIELD_LABEL)) {
      expect(SECTION.includes('`' + label + '`'), `${label} is not published`).toBe(true)
    }
    expect(SECTION).toContain('`Unsaved changes`')
    expect(SECTION).toContain('`Undo offer`')
    expect(regionName(0)).toBe('Undo offer')
    expect(regionName(2)).toBe('Unsaved changes')
  })

  it('no published body is derived — every literal appears verbatim in the model source', () => {
    // L-008 rule 3: the assertion that makes "literals, never templates" enforceable
    // rather than a convention. A template interpolating the field name would serve
    // plausible text for combinations nobody enumerated.
    const src = readFileSync(resolve(ROOT, 'src/assistant/_shared/model/notice-copy.ts'), 'utf8')
    for (const table of [CN_FAILED, CN_OFFLINE, CN_SUPERSEDED]) {
      for (const f of Object.keys(table) as CopyField[]) {
        // the invariant part of each sentence, with the slot removed
        const body = table[f]('§SLOT§').split('§SLOT§')
        for (const part of body) {
          if (part.length < 4) continue
          expect(src.includes(part), `derived body for ${f}: ${part}`).toBe(true)
        }
      }
    }
  })

  it('the wire→copy mapping is a closed switch, never a prettifier', () => {
    // A `field.replace('_',' ')` would render fluent text for a combination nobody
    // enumerated. Each mapping is asserted, including the two that collapse.
    expect(copyField('title')).toBe('title')
    expect(copyField('due_at')).toBe('deadline')
    expect(copyField('due_all_day')).toBe('deadline')
    expect(copyField('reminder_at')).toBe('reminder')
    expect(copyField('step_order')).toBe('step')
    // the six ADR-011 repeat members all report under the one control the user
    // actually touches
    for (const m of [
      'repeat_frequency',
      'repeat_interval',
      'repeat_weekdays',
      'repeat_month_days',
      'repeat_until',
      'repeat_count',
    ]) {
      expect(copyField(m), m).toBe('repeat')
    }
  })
})

describe('§ CarriedNotice — the row states, and the precedence between them', () => {
  it('one failed field takes the per-field literal', () => {
    const row = carriedRowFor(noticeWith())
    expect(row.id).toBe('CN-FAILED')
    expect(row.sentence).toBe(CN_FAILED.note('Buy milk'))
    expect(row.blocks).toHaveLength(1)
    expect(row.blocks[0]?.label).toBe('Note')
    expect(row.blocks[0]?.value).toBe('call first')
    expect(row.blocks[0]?.retryable).toBe(true)
  })

  it('TWO OR MORE fields take the aggregate sentence, and the fields are named by their blocks', () => {
    // AC-47: one notice per task, never one per field. AC-2: several fields can be in
    // flight together, each keeping its own value and its own retry, with the
    // failures aggregating into ONE status message. The row is the aggregation and
    // the blocks inside it are the per-field guarantees.
    const row = carriedRowFor(
      noticeWith({
        fields: [
          { field: 'note', value: 'call first', baseline: null, reason: 'failed', superseded: false },
          { field: 'priority', value: 'high', baseline: 'none', reason: 'failed', superseded: false },
        ],
      }),
    )
    expect(row.id).toBe('CN-FAILED')
    expect(row.sentence).toBe('Couldn\'t save your changes to "Buy milk".')
    expect(row.blocks.map((b) => b.label)).toEqual(['Note', 'Priority'])
    // Retry is per FIELD, not per row — two failed fields, two retryable blocks.
    expect(row.blocks.filter((b) => b.retryable)).toHaveLength(2)
  })

  it('a SUPERSEDED field reports and offers NO retry', () => {
    // Keeping the retry would be a control that overwrites the newer stored value
    // with the stale failed one — the resurrection door AC-4 and AC-47 close
    // everywhere else. Retyping is the available action, and it is an ordinary edit.
    const row = carriedRowFor(
      noticeWith({
        fields: [
          {
            field: 'note',
            value: 'call first',
            baseline: null,
            reason: 'failed',
            superseded: true,
            storedNow: 'ring the bell',
          },
        ],
      }),
    )
    expect(row.id).toBe('CN-SUPERSEDED')
    expect(row.sentence).toBe(CN_SUPERSEDED.note('Buy milk'))
    expect(row.blocks[0]?.retryable).toBe(false)
    // it says WHICH newer value the field holds, not merely that it moved
    expect(row.blocks[0]?.storedNow).toBe('ring the bell')
  })

  it('supersession is a TRANSITION, not an ending — the row still renders', () => {
    // AC-47 revision 4's correction: *"A later successful write does not end it; it
    // supersedes it"*. The notice stands, carrying the superseded text and no retry,
    // until the user dismisses it — which is what stops a typed value disappearing
    // without being mentioned.
    const n = noticeWith({
      fields: [
        {
          field: 'note',
          value: 'call first',
          baseline: null,
          reason: 'failed',
          superseded: true,
          storedNow: 'ring the bell',
        },
      ],
    })
    const rows = carriedRows(stateWith({ notices: [n] }))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('CN-SUPERSEDED')
    // and the value the user typed is still legible in it
    expect(rows[0]?.blocks[0]?.value).toBe('call first')
  })

  it('a DELETED task’s notice still renders — design’s D26 answer', () => {
    // The subtlety design flagged explicitly for whoever owns the model: an `ended`
    // notice filtered out of the region would be the last legible copy of the user's
    // typed value disappearing on a deletion it did not cause. *"CN-DELETED renders
    // and is removed only by Dismiss or a reload."*
    const n = noticeWith({ ended: 'task-deleted' })
    const rows = carriedRows(stateWith({ notices: [n] }))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('CN-DELETED')
    expect(rows[0]?.sentence).toBe(CN_DELETED('Buy milk'))
    // no retry — a retry aimed at a soft-deleted row is dead or a resurrection
    expect(rows[0]?.blocks.every((b) => !b.retryable)).toBe(true)
    // …and the value is still readable
    expect(rows[0]?.blocks[0]?.value).toBe('call first')
  })

  it('the precedence rule — deleted dominates, then failed, then offline, then superseded', () => {
    // *"The row wears the state of its worst field; each block still states its own."*
    const mixed = [
      { field: 'note', value: 'a', baseline: null, reason: 'offline-refused' as const, superseded: false },
      { field: 'priority', value: 'high', baseline: 'none', reason: 'failed' as const, superseded: false },
    ]
    expect(carriedRowFor(noticeWith({ fields: mixed })).id).toBe('CN-FAILED')
    // offline alone
    expect(
      carriedRowFor(noticeWith({ fields: [mixed[0]!] })).id,
    ).toBe('CN-OFFLINE')
    // deleted is task-level and dominates everything
    expect(carriedRowFor(noticeWith({ fields: mixed, ended: 'task-deleted' })).id).toBe('CN-DELETED')
  })
})

describe('AC-43 — the undo offer renders in this family, and does not stack', () => {
  const offer = (over: Partial<UndoOffer> = {}): UndoOffer => ({
    action: { kind: 'delete-task', taskId: 't1', title: 'Buy milk' },
    at: T0,
    used: false,
    ...over,
  })

  it('CN-UNDO renders FIRST, above every notice', () => {
    // It is the newest event and the only row with a window another action closes, so
    // it is the one the eye should reach first.
    const rows = carriedRows(stateWith({ notices: [noticeWith()], undoOffer: offer() }))
    expect(rows.map((r) => r.id)).toEqual(['CN-UNDO', 'CN-FAILED'])
    expect(rows[0]?.action).toBe('put-back')
  })

  it('once `Put back` is used the row becomes CN-UNDONE and carries no action', () => {
    // It is MARKED used rather than cleared, because CN-UNDONE is what reports that
    // the reversal happened — a row that vanished would report nothing.
    const rows = carriedRows(stateWith({ undoOffer: offer({ used: true }) }))
    expect(rows[0]?.id).toBe('CN-UNDONE')
    expect(rows[0]?.action).toBe(null)
    expect(rows[0]?.sentence).toBe('"Buy milk" is back on the list.')
  })

  it('notices order NEWEST FIRST under the offer', () => {
    const older = noticeWith({ taskId: 'a', taskTitle: 'Older', at: '2026-08-10T00:00:00.000Z' })
    const newer = noticeWith({ taskId: 'b', taskTitle: 'Newer', at: '2026-08-16T00:00:00.000Z' })
    const rows = carriedRows(stateWith({ notices: [older, newer] }))
    expect(rows.map((r) => r.taskId)).toEqual(['b', 'a'])
  })

  it('the region is occupied only when it holds something', () => {
    expect(carriedRegionOccupied(stateWith())).toBe(false)
    expect(carriedRegionOccupied(stateWith({ notices: [noticeWith()] }))).toBe(true)
    expect(carriedRegionOccupied(stateWith({ undoOffer: offer() }))).toBe(true)
  })
})

describe('the row’s accessible name carries the whole value', () => {
  it('the name includes the sentence, the field label and the typed value', () => {
    // § CarriedNotice: *"The row's accessible name carries the whole value, including
    // the part that scrolled."* A screen-reader user gets what a sighted user can
    // read back — which is the point of a component that exists to carry a value.
    const row = carriedRowFor(noticeWith())
    expect(row.a11yName).toContain(CN_FAILED.note('Buy milk'))
    expect(row.a11yName).toContain('Note')
    expect(row.a11yName).toContain('call first')
  })

  it('a superseded block names the newer value in the accessible name too', () => {
    const row = carriedRowFor(
      noticeWith({
        fields: [
          {
            field: 'note',
            value: 'call first',
            baseline: null,
            reason: 'failed',
            superseded: true,
            storedNow: 'ring the bell',
          },
        ],
      }),
    )
    expect(row.a11yName).toContain('call first')
    expect(row.a11yName).toContain('ring the bell')
  })
})

describe('the lifetime rule — there is NO TIMER, and the absence is the requirement', () => {
  // AC-47 (*"elapsing is not a resolution"*), AC-43's rule, and AC-33's 2.2.1 at the
  // strength its two siblings state it: **not by a timer, not by a timer that a
  // focus or a hover extends, and not by any duration however long.** Because there
  // is no time limit, WCAG 2.2.1 is not engaged at all — there is nothing to adjust.
  //
  // The requirement is an ABSENCE, so it cannot be asserted by calling anything.
  // This reads the two files as text, which is the only observable an absence has.
  const files = ['model/carried.ts', 'components/CarriedNotices.tsx']

  for (const f of files) {
    it(`${f} contains no timer of any kind`, () => {
      const src = readFileSync(resolve(MOBILE_SRC, f), 'utf8')
      // Comments talk about timers at length; code must not use one.
      const code = src
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n')
      for (const banned of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'Date.now']) {
        expect(code.includes(banned), `${f} uses ${banned}`).toBe(false)
      }
    })
  }

  it('design publishes no timer either — the enders are the user’s act or a reload', () => {
    expect(SECTION).toContain('There is no timer anywhere in this family')
    expect(SECTION).toContain("removed only by the user's own act, or by a reload")
  })
})

describe('the five ids are design’s, and the component applies all of them', () => {
  it('every id is published in § CarriedNotice’s testid table', () => {
    for (const id of [
      SHELL_A11Y_IDS.carriedNotices,
      SHELL_A11Y_IDS.carriedNotice,
      SHELL_A11Y_IDS.carriedNoticeRetry,
      SHELL_A11Y_IDS.carriedNoticeUndo,
      SHELL_A11Y_IDS.carriedNoticeDismiss,
    ]) {
      expect(SECTION.includes('`' + id + '`'), `${id} is not published`).toBe(true)
    }
  })

  it('the component applies each of them through the catalogue constant', () => {
    // A source scan, labelled as one (the component is RN and cannot be mounted
    // here). What it buys honestly is the one failure a scan can see: an id nobody
    // built. The rendered observable is QA's device automation.
    const src = readFileSync(resolve(MOBILE_SRC, 'components/CarriedNotices.tsx'), 'utf8')
    for (const key of [
      'carriedNotices',
      'carriedNotice',
      'carriedNoticeRetry',
      'carriedNoticeUndo',
      'carriedNoticeDismiss',
    ]) {
      expect(src.includes(`SHELL_A11Y_IDS.${key}`), `${key} is not applied`).toBe(true)
    }
    // and never as a literal, which the catalogue check could not police
    for (const id of Object.values(SHELL_A11Y_IDS)) {
      expect(src.includes(`'${id}'`), `${id} appears as a literal`).toBe(false)
    }
  })

  it('the region is mounted at the FRAME, not inside the surface host', () => {
    // AC-47 requires the notice visible on Talk AND Settings. `ShellHost` returns
    // early for S4 Settings, so a region mounted inside it is invisible there —
    // meeting the requirement at three of five surfaces, which is the failure mode
    // the AC names.
    const frame = readFileSync(resolve(MOBILE_SRC, 'components/AssistantScreen.tsx'), 'utf8')
    const host = readFileSync(resolve(MOBILE_SRC, 'components/ShellHost.tsx'), 'utf8')
    expect(frame).toContain('<CarriedNotices')
    expect(host).not.toContain('CarriedNotices')
  })
})
