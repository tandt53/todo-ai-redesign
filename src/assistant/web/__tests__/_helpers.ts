// Web-tier test harness.
//
// The wire fixtures and the fake server are platform-neutral and live in
// src/assistant/_shared/testing/fixtures.ts (the mobile tier asserts the same
// contract); they are re-exported here so this file stays the one import the
// web suites need.

import { AssistantApi } from '../../_shared/api/client.ts'
import { AssistantController } from '../../_shared/controller.ts'
import { ClientStores } from '../../_shared/model/client-stores.ts'
import type { NewMsg } from '../../_shared/model/messages.ts'
import { MemoryDurableStore } from '../../_shared/ports/durable-store.ts'
import { ScriptedTranscriptSource } from '../../_shared/ports/transcript-source.ts'
import type { SpeechCapability } from '../../_shared/ports/transcript-source.ts'
import { FakeServer, T0 } from '../../_shared/testing/fixtures.ts'
import type { TaskWire } from '../../_shared/types.ts'

export {
  T0,
  task,
  turn,
  applied,
  appliedTurn,
  askedTurn,
  session,
  boundary,
  turnResponse,
  undoOutcome,
  FakeServer,
} from '../../_shared/testing/fixtures.ts'
export type { Call } from '../../_shared/testing/fixtures.ts'

/** A real `GET /tasks` through the same fetch seam the app uses — the
 * user-visible "is it actually on the server" read, not an inspection of the
 * fake's internals. */
export async function serverTasks(server: FakeServer): Promise<TaskWire[]> {
  const res = await new AssistantApi({ userId: 'user-1', fetchFn: server.fetchFn }).listTasks()
  if (res.kind !== 'ok') throw new Error(`GET /tasks failed: ${res.kind}`)
  return res.value.tasks
}

/**
 * The controller, with one extra door for tests: a message ARRIVING that the
 * user did not just submit.
 *
 * AC-30 separates "a message arrived" from "you sent something", and only the
 * first can happen while the user is scrolled up — so the follow tests need to
 * drive an arrival. It goes through the reducer's own `append` action and the
 * real subscriber notification (assigning `controller.state` would render
 * nothing), which is why this is a subclass rather than a poke at the state.
 */
export class TestController extends AssistantController {
  push(messages: NewMsg[]): void {
    this.dispatch({ type: 'append', messages })
  }
}

export interface Harness {
  controller: TestController
  server: FakeServer
  speech: ScriptedTranscriptSource
  stores: ClientStores
  store: MemoryDurableStore
  ids: string[]
}

let uuidSeq = 0

/** A controller wired to fakes: no network, no browser, deterministic ids. */
export function harness(
  opts: {
    capability?: SpeechCapability
    online?: boolean
    store?: MemoryDurableStore
    server?: FakeServer
  } = {},
): Harness {
  const server = opts.server ?? new FakeServer()
  const speech = new ScriptedTranscriptSource(opts.capability ?? 'available')
  const store = opts.store ?? new MemoryDurableStore()
  const stores = new ClientStores(store, 'user-1')
  const ids: string[] = []
  let online = opts.online ?? true
  const controller = new TestController({
    api: new AssistantApi({ userId: 'user-1', fetchFn: server.fetchFn }),
    speech,
    stores,
    uuid: () => {
      uuidSeq += 1
      const id = `cid-${uuidSeq}`
      ids.push(id)
      return id
    },
    now: () => T0,
    timezone: 'Asia/Ho_Chi_Minh',
    onlineNow: () => online,
  })
  const original = controller.setOnline.bind(controller)
  controller.setOnline = (next: boolean) => {
    online = next
    original(next)
  }
  return { controller, server, speech, stores, store, ids }
}

// ---------------------------------------------------------------------------
// AC-30 — a layout, because jsdom has none
// ---------------------------------------------------------------------------

/**
 * jsdom performs NO LAYOUT: `scrollHeight` and `clientHeight` are always 0, so
 * `distance_from_bottom` is 0 for every element and every user reads as "at the
 * bottom". A scroll assertion written against raw jsdom therefore passes
 * whatever the implementation does — which is one of the two reasons BUG-004
 * shipped ("the unit tier cannot see it"; asserting *presence* is not asserting
 * *position*).
 *
 * This installs a layout that behaves like a real one in the one respect AC-30
 * depends on: **the content really grows when a message is appended.** Height
 * is derived from the message nodes actually in the DOM, not from a constant.
 * That is what makes AC-30(a) falsifiable here — an implementation that samples
 * *after* the append reads the grown `contentHeight`, concludes the user is no
 * longer at the bottom, and fails the (b) tests below.
 *
 * `scrollTop` is left alone: jsdom does store and return it, so it is the one
 * genuine observable, and it is what the assertions read.
 */
export function fakeLayout(
  el: HTMLElement,
  opts: { viewportHeight: number; rowHeight: number },
): void {
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => opts.viewportHeight,
  })
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => el.querySelectorAll('.msg, .boundary, .invite').length * opts.rowHeight,
  })
}

/** Put the viewport at the bottom of its current content, the way a user who
 * has just read the newest message is. */
export function scrollToBottom(el: HTMLElement): void {
  el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
}

/**
 * Record every animated scroll. `Element.scrollTo` does not exist in jsdom, so
 * installing it is also what lets the implementation take its animated branch
 * at all — with no spy the routine falls back to `scrollTop`, and AC-30(g)
 * would look satisfied for the wrong reason.
 */
export function recordScrollTo(el: HTMLElement): ScrollToOptions[] {
  const calls: ScrollToOptions[] = []
  ;(el as unknown as { scrollTo: (o: ScrollToOptions) => void }).scrollTo = (o) => {
    calls.push(o)
    el.scrollTop = o.top ?? el.scrollTop
  }
  return calls
}

/**
 * An animated scroll that does **not** land synchronously — the one thing
 * `recordScrollTo` cannot model, and the whole of BUG-006.
 *
 * `recordScrollTo` assigns `scrollTop` inside the call, so every scroll it
 * records has already arrived by the time the next line runs; there is no
 * window for anything to happen *during* one. A smooth scroll in a browser has
 * exactly that window, and BUG-006 lives in it: the reply to the user's own
 * turn appends while the (h) scroll is still moving, the live offset reads
 * "not at the bottom", and clause (c) holds the view over a message the user
 * is waiting for.
 *
 * Two details are copied from the browser rather than made convenient:
 * - **the target is clamped when the scroll is ISSUED**, not when it lands, so
 *   content appended mid-flight does not silently extend the animation. That
 *   staleness is half of the defect (the report's `1138 − 515 = 623`, landing
 *   121 short of a bottom that had moved to 744).
 * - **a re-aim carries on from wherever the surface is now**, the way
 *   `scrollTo` on an already-scrolling element does.
 */
export function animateScrollTo(el: HTMLElement): {
  /** every animated scroll issued, in order */
  calls: ScrollToOptions[]
  /** the offset the current animation is carrying, clamped as at issue time */
  target: () => number | null
  /** move part of the way there — the mid-flight sample AC-30(a) must not trust */
  advance: (fraction: number) => void
  /** let it arrive */
  settle: () => void
} {
  const calls: ScrollToOptions[] = []
  let from = el.scrollTop
  let aimed: number | null = null
  ;(el as unknown as { scrollTo: (o: ScrollToOptions) => void }).scrollTo = (o) => {
    calls.push(o)
    from = el.scrollTop
    const top = o.top ?? el.scrollTop
    aimed = Math.max(0, Math.min(top, el.scrollHeight - el.clientHeight))
  }
  return {
    calls,
    target: () => aimed,
    advance: (fraction) => {
      if (aimed === null) return
      el.scrollTop = Math.round(from + (aimed - from) * fraction)
    },
    settle: () => {
      if (aimed === null) return
      el.scrollTop = aimed
    },
  }
}

/** `prefers-reduced-motion` (AC-30(g)). jsdom ships no `matchMedia`, so the
 * query has to be answered by hand; returns a restore function. */
export function setReducedMotion(reduce: boolean): () => void {
  const g = globalThis as unknown as { matchMedia?: unknown }
  const before = g.matchMedia
  g.matchMedia = (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
  })
  return () => {
    if (before === undefined) delete g.matchMedia
    else g.matchMedia = before
  }
}
