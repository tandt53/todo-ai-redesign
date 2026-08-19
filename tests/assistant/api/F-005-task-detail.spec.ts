/**
 * F-005 task-detail — API integration suite
 * Authored 2026-08-19 by qa-api-agent (T-166, phase: author).
 *
 * SOURCES. Every ASSERTION below derives from, and only from:
 *   specs/assistant/F-005-task-detail.md          (revision 4, Gate 1 closed)
 *   specs/assistant/api-contracts.md § Feature F-005
 *   specs/assistant/data-model.md § Feature F-005
 *   specs/_shared/adr/ADR-010 … ADR-015
 * No file under src/ was read to decide what to assert (_qa-foundations §2).
 * The import block below is WIRING — public, constructor-injected composition
 * seams (Store / Interpreter / Clock, ADR-001) — and the harness doors it uses
 * live in tests/harness/qa-doors.ts, which this agent owns.
 *
 * RUNS IN-PROCESS: an http.Server built from createApp(deps) with the `__qa__`
 * doors mounted in front of it, bound to 127.0.0.1 on an ephemeral port, driven
 * by supertest. No external network, no listening harness process needed.
 *   Command: npx vitest run tests/assistant/api/F-005-task-detail.spec.ts
 *
 * TWO THINGS THIS FILE DOES DELIBERATELY, both of them lessons paid for here:
 *
 * 1. **One instant and one zone for the whole run** (AC-44, L-023). Every
 *    fixture instant is derived from `T0` — the value the clock seam is held
 *    at — and never from `new Date()`. L-023 records this project shipping a
 *    harness that pinned the seam and left the fixtures on the wall clock: 771
 *    tests were green *because the view read the wrong clock*. `POST
 *    /__qa__/set-clock` sets the seam AND writes the zone onto the account row,
 *    so the two cannot disagree.
 *
 * 2. **A default `X-Timezone` on the agent, and one deliberately zoneless
 *    agent beside it** (ADR-010). ADR-010 makes a zoneless date computation
 *    `409 TIMEZONE_UNKNOWN`, and `recordClientZone` runs in the auth step of
 *    every request — so one header establishes the account's zone and no
 *    ordinary case can observe the refusal afterwards. The refusal keeps its
 *    own client so it is asserted on purpose, not by accident.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, globalAgent, type Server } from 'node:http';

// ───────────────────────────── WIRING ─────────────────────────────
import { createApp, type AppDeps } from '../../../src/assistant/api/app.ts';
import type {
  Interpretation,
  Interpreter,
  InterpreterContext,
} from '../../../src/assistant/api/ports/interpreter.ts';
import {
  CountingInterpreter,
  QaClock,
  ReopenableStore,
  createQaDoors,
} from '../../harness/qa-doors.ts';
import usersFixture from '../../../qa/_shared/fixtures/api/f005-users.json';

const F = usersFixture as {
  users: Record<string, { x_user_id: string; role: string }>;
  clock: { t0: string; zone: string; dst_zone: string };
};

/** The one instant this run is held at. EVERY fixture date derives from it. */
const T0 = F.clock.t0; // '2026-08-19T12:00:00.000Z' — a Wednesday
const ZONE = F.clock.zone; // 'UTC'
const DST_ZONE = F.clock.dst_zone; // 'America/New_York'

const U1 = F.users['QAAPI5-U1']!.x_user_id;
const U2 = F.users['QAAPI5-U2']!.x_user_id;

// Dates named once, all of them derived from T0 in ZONE, never from a wall
// clock. T0 is Wednesday 2026-08-19T12:00:00Z, so in UTC:
const TODAY_START = '2026-08-19T00:00:00.000Z'; // AC-22's created due, all-day
const TOMORROW_0900 = '2026-08-20T09:00:00.000Z';
const NEXT_MONDAY = '2026-08-24T00:00:00.000Z';
const NEXT_THURSDAY = '2026-08-20T00:00:00.000Z';

// ───────────────────────── the fixture interpreter ─────────────────────────

/**
 * F-005's turn-path fixture rows.
 *
 * AC-36 is explicit that the permitted half is **a capability, not a
 * permission**: "The requirement is one fixture row per permitted field … so
 * the allowlist is asserted rather than assumed", on the CREATE path as well as
 * the EDIT path. And "the refused half must be expressible in order to be
 * refused" — so rows below deliberately attempt `parent_id`, `step_order` and
 * `repeat_*`, which is only possible because the contract widened the AI-facing
 * change shape to carry them and refuses them at runtime.
 *
 * The class also CAPTURES the context it was handed. That is the only
 * observable for two clauses no response can show:
 *   - AC-36's "the assistant must be able to read what it may write" —
 *     `ContextTask` gains `note` and `reminder_at`;
 *   - AC-35's "it is never offered to the interpreter as an addressable task" —
 *     a task with eight steps contributes ONE handle.
 */
class F005Interpreter implements Interpreter {
  calls = 0;
  /** The context of the most recent interpret() call. */
  lastContext: InterpreterContext | null = null;
  /** Every context, in order — for turns that fire more than once. */
  contexts: InterpreterContext[] = [];
  /** utterance (lowercased, trimmed) → interpretation builder. */
  private readonly rows = new Map<
    string,
    (ctx: InterpreterContext) => Interpretation
  >();

  constructor() {
    const handleFor = (ctx: InterpreterContext, title: string): string | null => {
      const t = ctx.tasks.find((x) => x.title.trim().toLowerCase() === title.trim().toLowerCase());
      return t?.handle ?? null;
    };
    const edit = (title: string, changes: Record<string, unknown>) =>
      (ctx: InterpreterContext): Interpretation => {
        const handle = handleFor(ctx, title);
        return handle === null
          ? { kind: 'no_match' }
          : ({ kind: 'edit', edits: [{ handle, changes }] } as unknown as Interpretation);
      };

    // ── AC-36 permitted, EDIT path: one row per permitted field ────────────
    this.rows.set('qaapi5 set the note', edit('qaapi5-note-target', { note: 'from the assistant' }));
    this.rows.set('qaapi5 set the priority', edit('qaapi5-priority-target', { priority: 'medium' }));
    this.rows.set('qaapi5 set the due date', edit('qaapi5-due-target', { due_at: TOMORROW_0900 }));
    this.rows.set('qaapi5 set the reminder', edit('qaapi5-reminder-target', { reminder_at: TOMORROW_0900 }));

    // ── AC-36 permitted, CREATE path ───────────────────────────────────────
    // "add a task to call the dentist and remind me at nine" — the sentence
    // AC-36 names as the one that silently dropped the reminder.
    this.rows.set('qaapi5 add the dentist with a reminder', () => ({
      kind: 'create',
      tasks: [
        {
          title: 'qaapi5-call-the-dentist',
          note: 'ask about the crown',
          due_at: TOMORROW_0900,
          reminder_at: TOMORROW_0900,
          priority: 'high',
        },
      ],
    }) as unknown as Interpretation);

    // ── AC-36 refused: structural fields, attempted through the turn path ──
    this.rows.set('qaapi5 make it a step', edit('qaapi5-refuse-target', { parent_id: null }));
    this.rows.set('qaapi5 move it to position two', edit('qaapi5-refuse-target', { step_order: 2 }));
    this.rows.set('qaapi5 make this weekly', edit('qaapi5-refuse-target', { repeat_frequency: 'week', repeat_interval: 1 }));
    this.rows.set('qaapi5 retire the reminder marker', edit('qaapi5-refuse-target', { reminder_shown_at: TOMORROW_0900 }));

    // ── AC-40 refused: a field rule, attempted through the turn path ───────
    this.rows.set('qaapi5 clear the title', edit('qaapi5-rule-target', { title: '   ' }));
    this.rows.set('qaapi5 blank the note', edit('qaapi5-rule-target', { note: '   \n  ' }));
    this.rows.set('qaapi5 set priority to urgent', edit('qaapi5-rule-target', { priority: 'urgent' }));
    // AC-6's rule is that whitespace-only is NO NOTE — a normalisation, which
    // the HTTP path performs and AC-40 requires the turn path to perform too.
    // The note's REFUSAL reason (`note_not_text`) is about a value that is not
    // text at all, so the attempt has to be a non-string.
    this.rows.set('qaapi5 set the note to a number', edit('qaapi5-rule-target', { note: 42 }));
    this.rows.set('qaapi5 clear the due with a repeat', edit('qaapi5-repeating-target', { due_at: null }));
    // one legal + one illegal field in ONE change: AC-18's whole-write scope
    this.rows.set('qaapi5 set the note and clear the title', edit('qaapi5-rule-target', { note: 'legal', title: '' }));

    // ── AC-46 / AC-5: turns that complete things ───────────────────────────
    this.rows.set('qaapi5 finish the repeating one', edit('qaapi5-repeating-target', { status: 'done' }));
    this.rows.set('qaapi5 finish the parent', edit('qaapi5-parent-target', { status: 'done' }));
    this.rows.set('qaapi5 rename the parent', edit('qaapi5-parent-target', { title: 'qaapi5-parent-renamed' }));
    this.rows.set('qaapi5 note the interleaved one', edit('qaapi5-interleave', { note: 'the assistant got here first' }));
    this.rows.set('qaapi5 note the undo target', edit('qaapi5-undo-target', { note: 'assistant note' }));

    // ── AC-21: a turn DELETE of a repeating task. applyDelete enumerates every
    //    non-null DIFF_FIELDS member, so this is where the per-member diff-row
    //    shape becomes observable — a turn cannot SET a repeat (AC-36).
    this.rows.set('qaapi5 delete the repeating one', (ctx) => {
      const t = ctx.tasks.find((x) => x.title === 'qaapi5-diff-repeat');
      return t === undefined
        ? { kind: 'no_match' }
        : ({ kind: 'delete', handles: [t.handle] } as unknown as Interpretation);
    });

    // ── AC-35: a turn that names a STEP title. The handle list excludes
    //    steps, so this must fall through to no_match — it is an assertion of
    //    absence and is written as one.
    this.rows.set('qaapi5 rename the step', edit('qaapi5-step-one', { title: 'qaapi5-step-renamed' }));
  }

  async interpret(ctx: InterpreterContext): Promise<Interpretation> {
    this.calls += 1;
    this.lastContext = ctx;
    this.contexts.push(ctx);
    const row = this.rows.get(ctx.transcript.trim().toLowerCase());
    if (row !== undefined) return row(ctx);
    return { kind: 'no_match' };
  }
}

// ───────────────────────────── the harness ─────────────────────────────

interface Harness {
  app: Server;
  ai: CountingInterpreter;
  fixtures: F005Interpreter;
  clock: QaClock;
  store: ReopenableStore;
  /** Default client: carries `X-Timezone`, so its account always has a zone. */
  agent: TestAgent;
  /** Deliberately zoneless client — the only way to observe AC-44's refusal. */
  zoneless: TestAgent;
  snapshotDir: string;
}

// See the F-001 suite for why: a bare RequestListener makes supertest create
// and leak one server per request, and Node's pooled agent can then land a
// later request on a stale server bound to a reused ephemeral port.
(globalAgent as unknown as { keepAlive: boolean; options: { keepAlive?: boolean } }).keepAlive = false;
(globalAgent as unknown as { options: { keepAlive?: boolean } }).options.keepAlive = false;

async function makeHarness(): Promise<Harness> {
  const fixtures = new F005Interpreter();
  const ai = new CountingInterpreter(fixtures);
  const clock = new QaClock(T0, ZONE);
  // A durable store, because AC-15's "survives a restart" has nothing to
  // survive against a store composed fresh per process. One temp dir per test
  // keeps the tiers and the tests isolated (§10).
  const snapshotDir = mkdtempSync(join(tmpdir(), 'qaapi5-'));
  const store = new ReopenableStore({ snapshotPath: join(snapshotDir, 'store.json') });
  const doors = createQaDoors({ store, clock, interpreter: ai });
  const deps: AppDeps = { store, interpreter: ai, clock, idleCloseMs: 180_000 };
  const app = createApp(deps);
  const server = createServer((req, res) => {
    if (doors(req, res)) return;
    app(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  return {
    app: server,
    ai,
    fixtures,
    clock,
    store,
    agent: request.agent(server).set('X-Timezone', ZONE),
    zoneless: request.agent(server),
    snapshotDir,
  };
}

let h: Harness;

beforeEach(async () => {
  h = await makeHarness();
  // Hold the seam AND the zone at one value for the test (AC-44, L-023).
  // Both accounts first, so the zone is on the row before any date is computed.
  await h.agent.get('/tasks').set('X-User-Id', U1).expect(200);
  await h.agent.get('/tasks').set('X-User-Id', U2).expect(200);
  await h.agent.post('/__qa__/set-clock').send({ at: T0, zone: ZONE }).expect(200);
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    h.app.closeAllConnections();
    h.app.close(() => resolve());
  });
  rmSync(h.snapshotDir, { recursive: true, force: true });
});

// ───────────────────────────── helpers ─────────────────────────────

const uuid = (): string => randomUUID();

const post = (uid: string, path: string, body: unknown = {}) =>
  h.agent.post(path).set('X-User-Id', uid).send(body as object);
const patch = (uid: string, path: string, body: unknown = {}) =>
  h.agent.patch(path).set('X-User-Id', uid).send(body as object);
const del = (uid: string, path: string) => h.agent.delete(path).set('X-User-Id', uid);
const get = (uid: string, path: string) => h.agent.get(path).set('X-User-Id', uid);

interface Task {
  id: string;
  title: string;
  note: string | null;
  due_at: string | null;
  due_all_day: boolean | null;
  reminder_at: string | null;
  reminder_shown_at: string | null;
  priority: string;
  status: string;
  parent_id: string | null;
  step_order: number | null;
  completed_by_parent: boolean;
  repeat_frequency: string | null;
  repeat_interval: number | null;
  repeat_weekdays: string | null;
  repeat_month_days: string | null;
  repeat_until: string | null;
  repeat_count: number | null;
  series_id: string | null;
  series_live: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  [k: string]: unknown;
}

/** Create through the real write path. Never for rows a write path refuses. */
const create = async (uid: string, fields: Record<string, unknown>): Promise<Task> => {
  const res = await post(uid, '/tasks', fields).expect(201);
  return res.body.task as Task;
};

const tasksOf = async (uid: string): Promise<Task[]> => {
  const res = await get(uid, '/tasks').expect(200);
  return res.body.tasks as Task[];
};

const taskById = async (uid: string, id: string): Promise<Task | undefined> =>
  (await tasksOf(uid)).find((t) => t.id === id);

/** The seed door — the ONLY producer of rows the write paths refuse. */
const seedRaw = (body: unknown) => h.agent.post('/__qa__/seed').send(body as object);

const setClock = (at: string, zone?: string, users?: string[]) =>
  h.agent.post('/__qa__/set-clock').send({ at, zone, users });

const reopenStore = () => h.agent.post('/__qa__/reopen-store').send({});

/**
 * Move the pinned instant forward by `ms`.
 *
 * Needed wherever a case turns on two timestamps DIFFERING. AC-28's third
 * condition is *"never edited (`updated_at` equals `created_at`)"*, and under a
 * frozen clock an edit leaves `updated_at` byte-equal to `created_at` — so the
 * condition is unfalsifiable and the case would assert the opposite of what it
 * names. This is L-023's shape one level down: the fixture and the subject read
 * the same held value, so the test asserts their agreement. Advancing between
 * the create and the edit is what makes the state constructible at all.
 */
const advance = (ms: number) => h.agent.post('/__qa__/advance-clock').send({ ms });

const turnBody = (transcript: string, extra: Record<string, unknown> = {}) => ({
  session_id: null,
  client_turn_id: uuid(),
  transcript,
  source: 'voice',
  ...extra,
});

const postTurn = (uid: string, transcript: string, extra: Record<string, unknown> = {}) =>
  post(uid, '/assistant/turn', turnBody(transcript, extra));

const undoTurn = (uid: string, turnId: string) =>
  post(uid, `/assistant/turn/${turnId}/undo`, { via: 'tap' });

/** A minimal raw task row for the seed door — every field the wire declares. */
const rawTask = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: uuid(),
  user_id: U1,
  title: 'qaapi5-seeded',
  note: null,
  due_at: null,
  due_all_day: null,
  reminder_at: null,
  reminder_shown_at: null,
  priority: null,
  status: 'inbox',
  parent_id: null,
  step_order: null,
  completed_by_parent: false,
  ever_completed: false,
  repeat_frequency: null,
  repeat_interval: null,
  repeat_weekdays: null,
  repeat_month_days: null,
  repeat_until: null,
  repeat_count: null,
  series_id: null,
  series_ended_at: null,
  delete_gesture_id: null,
  created_at: T0,
  updated_at: T0,
  deleted_at: null,
  ...over,
});

/** Every field name the contract declares on the wire, and nothing else. */
const WIRE_FIELDS = [
  'id', 'title', 'note', 'due_at', 'due_all_day', 'reminder_at', 'reminder_shown_at',
  'priority', 'status', 'parent_id', 'step_order', 'completed_by_parent',
  'repeat_frequency', 'repeat_interval', 'repeat_weekdays', 'repeat_month_days',
  'repeat_until', 'repeat_count', 'series_id', 'series_live',
  'created_at', 'updated_at', 'deleted_at',
].sort();

/** Fields the contract marks internal — never serialized. */
const INTERNAL_FIELDS = ['user_id', 'ever_completed', 'delete_gesture_id', 'series_ended_at'];

// ════════════════════════════════════════════════════════════════════════════
// The harness doors themselves. Three ACs have no reachable fixture without
// them, so a door that silently does nothing would make those cases green for
// the wrong reason (L-012). Each door is asserted to have actually done its
// work before any case leans on it.
// ════════════════════════════════════════════════════════════════════════════

describe('TC-01 the __qa__ doors do what they claim (AC-8, AC-15, AC-34, AC-44)', () => {
  it('TC-01a seed writes a row VERBATIM, bypassing every write rule', async () => {
    // 'urgent' is outside AC-8's four-state set, so the write path refuses it
    // by design — which is exactly why the seed door has to exist.
    const refused = await post(U1, '/tasks', { title: 'qaapi5-x', priority: 'urgent' });
    expect(refused.status).toBe(400);
    const id = uuid();
    await seedRaw({ tasks: [rawTask({ id, title: 'qaapi5-out-of-set', priority: 'urgent' })] }).expect(200);
    // the row is really there, with the value the write path refuses
    const raw = h.store.read((s) => (s as unknown as Record<string, Record<string, Task>>)['tasks']![id]);
    expect(raw).toBeDefined();
    expect(raw!.priority).toBe('urgent');
  });

  it('TC-01b seed refuses a row with no id rather than dropping it silently', async () => {
    const res = await seedRaw({ tasks: [{ title: 'qaapi5-no-id' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QA_DOOR');
  });

  it('TC-01c set-clock holds BOTH the instant and the zone (AC-44, L-023)', async () => {
    const at = '2026-12-25T08:30:00.000Z';
    const res = await setClock(at, 'Asia/Bangkok', [U1]).expect(200);
    expect(res.body.now).toBe(Date.parse(at));
    expect(res.body.zone).toBe('Asia/Bangkok');
    expect(res.body.accounts).toContain(U1);
    // the seam moved…
    expect(h.clock.now()).toBe(Date.parse(at));
    // …and the ZONE moved with it, on the account row the server reads
    const acc = await get(U1, '/account').expect(200);
    expect(acc.body.timezone).toBe('Asia/Bangkok');
    expect(acc.body.timezone_source).toBe('user');
    // a row created now carries the pinned instant, not a wall clock
    const t = await create(U1, { title: 'qaapi5-clock-check' });
    expect(t.created_at).toBe(at);
  });

  it('TC-01d reopen-store re-reads the durable snapshot in-process', async () => {
    const t = await create(U1, { title: 'qaapi5-durable' });
    const res = await reopenStore().expect(200);
    expect(res.body.reopened).toBe(true);
    expect(res.body.reopens).toBe(1);
    // the app is now serving from a store instance that was constructed AFTER
    // the write, so the row survived a restart rather than a re-read of RAM
    expect((await taskById(U1, t.id))?.title).toBe('qaapi5-durable');
  });

  it('TC-01e an unknown harness door is a stated 404, never a fall-through to the app', async () => {
    const res = await h.agent.post('/__qa__/no-such-door').send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('QA_DOOR');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-2 — every change is a field-level write
// ════════════════════════════════════════════════════════════════════════════

describe('TC-02 AC-2 field-level write, falsifiable both ways', () => {
  it('TC-02a the request carries exactly the changed keys; prior names only them', async () => {
    const t = await create(U1, { title: 'qaapi5-field-level', note: 'original', priority: 'low' });
    const res = await patch(U1, `/tasks/${t.id}`, { priority: 'high' }).expect(200);
    // `prior` is the contract's evidence that ONE field changed (ADR-015)
    expect(res.body.prior).toEqual({ priority: 'none' === t.priority ? null : t.priority });
    expect(Object.keys(res.body.prior)).toEqual(['priority']);
    // every unmentioned field is untouched
    expect(res.body.task.note).toBe('original');
    expect(res.body.task.title).toBe('qaapi5-field-level');
    // updated_at advances on every accepted change (UC-27 AC-27.1)
    expect(Date.parse(res.body.task.updated_at)).toBeGreaterThanOrEqual(Date.parse(t.updated_at));
  });

  it('TC-02b a no-op write returns prior {} and writes nothing', async () => {
    const t = await create(U1, { title: 'qaapi5-noop', priority: 'high' });
    const res = await patch(U1, `/tasks/${t.id}`, { priority: 'high' }).expect(200);
    expect(res.body.prior).toEqual({});
  });

  it('TC-02c a value changed by an assistant turn between load and save survives', async () => {
    // This is the interleaving AC-2 calls the falsifiable half, and the shape
    // `## Test strategy` names: apply a turn to field X between the surface's
    // load and its save of field Y, then assert X survived.
    const t = await create(U1, { title: 'qaapi5-interleave', priority: 'low' });
    const loaded = await taskById(U1, t.id); // the surface's load
    expect(loaded?.note).toBeNull();
    const turn = await postTurn(U1, 'qaapi5 note the interleaved one').expect(200);
    expect(turn.body.turn.outcome.kind).toBe('applied');
    // the surface now saves a DIFFERENT field, carrying only its own key
    const saved = await patch(U1, `/tasks/${t.id}`, { priority: 'high' }).expect(200);
    // a whole-object write would have posted note: null and lost the arrival
    expect(saved.body.task.note).toBe('the assistant got here first');
    expect(saved.body.task.priority).toBe('high');
  });
});

describe('TC-03 AC-26/AC-2 the multi-row response rule', () => {
  it('TC-03a a write that changes one row returns changed: []', async () => {
    const t = await create(U1, { title: 'qaapi5-single-row' });
    const res = await patch(U1, `/tasks/${t.id}`, { title: 'qaapi5-single-row-2' }).expect(200);
    expect(res.body.changed).toEqual([]);
  });

  it('TC-03b a write that changes more than one row returns every OTHER row it changed, never repeating the addressed one', async () => {
    const parent = await create(U1, { title: 'qaapi5-multi-parent' });
    const s1 = await create(U1, { title: 'qaapi5-multi-step-1', parent_id: parent.id });
    const s2 = await create(U1, { title: 'qaapi5-multi-step-2', parent_id: parent.id });
    const res = await patch(U1, `/tasks/${parent.id}`, { status: 'done' }).expect(200);
    const changedIds = (res.body.changed as Task[]).map((r) => r.id).sort();
    expect(changedIds).toEqual([s1.id, s2.id].sort());
    expect(changedIds).not.toContain(parent.id); // "never repeated here"
  });
});

// ════════════════════════════════════════════════════════════════════════════
// The two text fields, priority, and the two instants
// ════════════════════════════════════════════════════════════════════════════

describe('TC-04 AC-37 the title is never empty, and never silently truncated', () => {
  it('TC-04a blank, whitespace-only and newline-only are all refused; the task keeps its name', async () => {
    const t = await create(U1, { title: 'qaapi5-keeps-its-name' });
    for (const bad of ['', '   ', '\n', ' \n\t ']) {
      const res = await patch(U1, `/tasks/${t.id}`, { title: bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
      expect(res.body.error.field).toBe('title');
      // "the task keeps the name it had" — asserted, not assumed
      expect((await taskById(U1, t.id))?.title).toBe('qaapi5-keeps-its-name');
    }
  });

  it('TC-04b the 500-character bound: 500 accepted, 501 refused, nothing written', async () => {
    const t = await create(U1, { title: 'qaapi5-bounded-title' });
    const at500 = 'q'.repeat(500);
    await patch(U1, `/tasks/${t.id}`, { title: at500 }).expect(200);
    expect((await taskById(U1, t.id))?.title).toBe(at500);
    const over = await patch(U1, `/tasks/${t.id}`, { title: 'q'.repeat(501) });
    expect(over.status).toBe(400);
    expect(over.body.error.code).toBe('VALIDATION');
    expect(over.body.error.field).toBe('title');
    // refused, NEVER silently truncated (AC-37, product P12)
    expect((await taskById(U1, t.id))?.title).toBe(at500);
  });

  it('TC-04c a create with an empty title is refused too — the rule binds the write, not the door', async () => {
    const res = await post(U1, '/tasks', { title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('title');
    expect(await tasksOf(U1)).toHaveLength(0);
  });
});

describe('TC-05 AC-6 the note', () => {
  it('TC-05a line breaks survive the round trip', async () => {
    const note = 'first line\nsecond line\n\nfourth line';
    const t = await create(U1, { title: 'qaapi5-note-breaks', note });
    expect(t.note).toBe(note);
    expect((await taskById(U1, t.id))?.note).toBe(note);
  });

  it('TC-05b empty, whitespace-only and newline-only store NO NOTE AT ALL, never an empty string', async () => {
    // "the distinction is observable on read-back" — so read it back, and
    // assert `null` specifically. `toBeFalsy()` would pass on "" and is the
    // assertion this AC exists to forbid.
    for (const blank of ['', '   ', '\n', '\n\n  \t']) {
      const t = await create(U1, { title: `qaapi5-blank-note-${blank.length}`, note: blank });
      expect(t.note, JSON.stringify(blank)).toBeNull();
      expect(t.note).not.toBe('');
      expect((await taskById(U1, t.id))?.note).toBeNull();
    }
  });

  it('TC-05c clearing an existing note stores no note, and is observable', async () => {
    const t = await create(U1, { title: 'qaapi5-clear-note', note: 'something' });
    const res = await patch(U1, `/tasks/${t.id}`, { note: '   ' }).expect(200);
    expect(res.body.task.note).toBeNull();
    expect(res.body.prior).toEqual({ note: 'something' });
  });

  it('TC-05d the 20 000-character bound: 20 000 accepted, 20 001 refused, value not truncated', async () => {
    const t = await create(U1, { title: 'qaapi5-bounded-note' });
    const at = 'n'.repeat(20_000);
    await patch(U1, `/tasks/${t.id}`, { note: at }).expect(200);
    expect((await taskById(U1, t.id))?.note).toHaveLength(20_000);
    const over = await patch(U1, `/tasks/${t.id}`, { note: 'n'.repeat(20_001) });
    expect(over.status).toBe(400);
    expect(over.body.error.code).toBe('VALIDATION');
    expect(over.body.error.field).toBe('note');
    expect((await taskById(U1, t.id))?.note).toHaveLength(20_000); // refused, not cut
  });
});

describe('TC-06 AC-8 priority has exactly four states, and `none` is an ABSENCE', () => {
  it('TC-06a each of the four is settable and clearable in one action', async () => {
    const t = await create(U1, { title: 'qaapi5-priority-states' });
    expect(t.priority).toBe('none'); // never null on the wire
    for (const p of ['low', 'medium', 'high']) {
      const res = await patch(U1, `/tasks/${t.id}`, { priority: p }).expect(200);
      expect(res.body.task.priority).toBe(p);
    }
    const cleared = await patch(U1, `/tasks/${t.id}`, { priority: 'none' }).expect(200);
    expect(cleared.body.task.priority).toBe('none');
  });

  it('TC-06b `none` stores the ABSENCE of a value, not the string "none"', async () => {
    // The two observables AC-8 names, because the wire cannot distinguish them:
    //  (1) `applyCreate` skips null fields when building a diff, so a literal
    //      'none' would add a priority row to F-001 AC-4's message on EVERY
    //      create;
    //  (2) `taskEquals` compares ===, so stored null vs live 'none' would
    //      report every pre-F-005 row modified.
    const t = await create(U1, { title: 'qaapi5-none-absence', priority: 'none' });
    const stored = h.store.read(
      (s) => (s as unknown as Record<string, Record<string, Record<string, unknown>>>)['tasks']![t.id]!,
    );
    expect(stored['priority']).toBeNull();
    expect(stored['priority']).not.toBe('none');
    // and clearing an existing value stores the absence too
    await patch(U1, `/tasks/${t.id}`, { priority: 'high' }).expect(200);
    await patch(U1, `/tasks/${t.id}`, { priority: 'none' }).expect(200);
    const after = h.store.read(
      (s) => (s as unknown as Record<string, Record<string, Record<string, unknown>>>)['tasks']![t.id]!,
    );
    expect(after['priority']).toBeNull();
  });

  it('TC-06c a create at priority `none` emits NO priority diff row on the turn path', async () => {
    // Observable (1) above. A literal 'none' would put a priority row on every
    // create the assistant ever makes.
    const res = await postTurn(U1, 'qaapi5 add the dentist with a reminder').expect(200);
    expect(res.body.turn.outcome.kind).toBe('applied');
    const fields = (res.body.turn.diff as { field: string }[]).map((d) => d.field);
    // the create names the fields it set…
    expect(fields).toContain('title');
    expect(fields).toContain('reminder_at');
    // …and priority appears only because this fixture row sets it to 'high'.
    // A task created with no priority must not carry one:
    const plain = await create(U1, { title: 'qaapi5-plain' });
    expect(plain.priority).toBe('none');
    const plainStored = h.store.read(
      (s) => (s as unknown as Record<string, Record<string, Record<string, unknown>>>)['tasks']![plain.id]!,
    );
    expect(plainStored['priority']).toBeNull();
  });

  it('TC-06d a write carrying any other value is rejected, and nothing is written', async () => {
    const t = await create(U1, { title: 'qaapi5-priority-guard', priority: 'high' });
    for (const bad of ['urgent', 'normal', 'HIGH', '', 'none ', '1']) {
      const res = await patch(U1, `/tasks/${t.id}`, { priority: bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
      expect(res.body.error.field).toBe('priority');
      expect((await taskById(U1, t.id))?.priority).toBe('high');
    }
  });

  it('TC-06e a stored value OUTSIDE the set reads as `none` — the tolerant read (seed door)', async () => {
    // "The tolerant read's fixture cannot be built through the API, since this
    // AC's own write path refuses exactly the value it must tolerate."
    const id = uuid();
    await seedRaw({ tasks: [rawTask({ id, title: 'qaapi5-tolerant', priority: 'Urgent' })] }).expect(200);
    const row = await taskById(U1, id);
    expect(row).toBeDefined();
    expect(row!.priority).toBe('none'); // never as itself…
    expect(row!.priority).not.toBe('Urgent');
    // …and never as an error: the read succeeded, which is the other half
    const listed = await get(U1, '/tasks').expect(200);
    expect((listed.body.tasks as Task[]).map((r) => r.id)).toContain(id);
  });
});

describe('TC-07 AC-10 the two instants: set, clear, and the marker they clear', () => {
  it('TC-07a due_at and reminder_at are each set and cleared; clearing stores NO value', async () => {
    const t = await create(U1, { title: 'qaapi5-instants' });
    const set = await patch(U1, `/tasks/${t.id}`, { due_at: TOMORROW_0900, reminder_at: TOMORROW_0900 }).expect(200);
    expect(set.body.task.due_at).toBe(TOMORROW_0900);
    expect(set.body.task.reminder_at).toBe(TOMORROW_0900);
    const cleared = await patch(U1, `/tasks/${t.id}`, { due_at: null, reminder_at: null }).expect(200);
    // "not a zero date, not an empty string" — observable on read-back
    const back = await taskById(U1, t.id);
    expect(back!.due_at).toBeNull();
    expect(back!.reminder_at).toBeNull();
    expect(cleared.body.task.due_at).not.toBe('');
    expect(cleared.body.task.due_at).not.toBe('1970-01-01T00:00:00.000Z');
  });

  it('TC-07b writing OR clearing reminder_at clears reminder_shown_at', async () => {
    // Without this, "the SECOND reminder a user ever sets on a task is dead on
    // arrival, invisibly" (AC-10, tester T20).
    const t = await create(U1, { title: 'qaapi5-marker', reminder_at: TOMORROW_0900 });
    const acked = await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: TOMORROW_0900 }).expect(200);
    expect(acked.body.task.reminder_shown_at).not.toBeNull();
    // moving the reminder is a NEW reminder
    const moved = await patch(U1, `/tasks/${t.id}`, { reminder_at: '2026-08-21T09:00:00.000Z' }).expect(200);
    expect(moved.body.task.reminder_shown_at).toBeNull();
    // and so is clearing it
    await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: '2026-08-21T09:00:00.000Z' }).expect(200);
    const clearedRes = await patch(U1, `/tasks/${t.id}`, { reminder_at: null }).expect(200);
    expect(clearedRes.body.task.reminder_shown_at).toBeNull();
  });

  it('TC-07c the manual field path makes ZERO AI calls (AC-10, AC-20, AC-32)', async () => {
    const before = h.ai.count;
    const t = await create(U1, { title: 'qaapi5-zero-ai', note: 'n', priority: 'low' });
    await patch(U1, `/tasks/${t.id}`, { due_at: TOMORROW_0900 }).expect(200);
    await patch(U1, `/tasks/${t.id}`, { reminder_at: TOMORROW_0900 }).expect(200);
    await patch(U1, `/tasks/${t.id}`, { priority: 'high' }).expect(200);
    await patch(U1, `/tasks/${t.id}`, { repeat_frequency: 'week', repeat_interval: 1 }).expect(200);
    await patch(U1, `/tasks/${t.id}`, { repeat_frequency: null, repeat_interval: null }).expect(200);
    await post(U1, `/tasks/${t.id}/repeat-preview`, { repeat_frequency: 'week', repeat_interval: 1 }).expect(200);
    await del(U1, `/tasks/${t.id}`).expect(200);
    await post(U1, `/tasks/${t.id}/restore`).expect(200);
    const counted = await h.agent.get('/__qa__/ai-calls').expect(200);
    expect(h.ai.count).toBe(before);
    expect(counted.body.count).toBe(before);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-13 — a date-only due never behaves as a time nobody chose
// ════════════════════════════════════════════════════════════════════════════

describe('TC-08 AC-13 due_all_day, and its three resolution rules', () => {
  it('TC-08a a timed due is timed; a due at the local start of its own day is all-day', async () => {
    const timed = await create(U1, { title: 'qaapi5-timed-due', due_at: TOMORROW_0900 });
    expect(timed.due_all_day).toBe(false);
    const allDay = await create(U1, { title: 'qaapi5-allday-due', due_at: TODAY_START });
    expect(allDay.due_all_day).toBe(true);
  });

  it('TC-08b a STORED flag is authoritative — a date-only due is distinguishable from one at midnight', async () => {
    // The whole point of the flag: "a date-only deadline must be
    // distinguishable from one at midnight". Same instant, opposite flag,
    // because the user picked 00:00 deliberately.
    const midnightTimed = await create(U1, {
      title: 'qaapi5-midnight-timed',
      due_at: TODAY_START,
      due_all_day: false,
    });
    expect(midnightTimed.due_all_day).toBe(false);
    expect(midnightTimed.due_at).toBe(TODAY_START);
    const midnightAllDay = await create(U1, {
      title: 'qaapi5-midnight-allday',
      due_at: TODAY_START,
      due_all_day: true,
    });
    expect(midnightAllDay.due_all_day).toBe(true);
    expect(midnightAllDay.due_at).toBe(TODAY_START);
    // and the stored answer survives a read — rule 1 applies "on every tier"
    expect((await taskById(U1, midnightTimed.id))?.due_all_day).toBe(false);
  });

  it('TC-08c absent flag + a zone: the server resolves it and does NOT rewrite the row (seed door)', async () => {
    // Measured in the spec: 0 of 790 rows carry the flag, so on day one this is
    // EVERY row on every GET /tasks. Only the seed door can build such a row.
    const atStart = uuid();
    const atNoon = uuid();
    await seedRaw({
      tasks: [
        rawTask({ id: atStart, title: 'qaapi5-legacy-start', due_at: TODAY_START, due_all_day: null }),
        rawTask({ id: atNoon, title: 'qaapi5-legacy-noon', due_at: TOMORROW_0900, due_all_day: null }),
      ],
    }).expect(200);
    const rows = await tasksOf(U1);
    expect(rows.find((r) => r.id === atStart)!.due_all_day).toBe(true);
    expect(rows.find((r) => r.id === atNoon)!.due_all_day).toBe(false);
    // "The row is not rewritten by the read" — assert the STORE, not the wire
    const stored = h.store.read(
      (s) => (s as unknown as Record<string, Record<string, Record<string, unknown>>>)['tasks']!,
    );
    expect(stored[atStart]!['due_all_day']).toBeNull();
    expect(stored[atNoon]!['due_all_day']).toBeNull();
  });

  it('TC-08d the next write that touches due_at stores the resolved value', async () => {
    const id = uuid();
    await seedRaw({ tasks: [rawTask({ id, title: 'qaapi5-drains', due_at: TODAY_START, due_all_day: null })] }).expect(200);
    await patch(U1, `/tasks/${id}`, { due_at: TOMORROW_0900 }).expect(200);
    const stored = h.store.read(
      (s) => (s as unknown as Record<string, Record<string, Record<string, unknown>>>)['tasks']![id]!,
    );
    expect(stored['due_all_day']).toBe(false); // no longer null: the population drains
  });

  it('TC-08e absent flag + NO zone: the wire carries null, and the READ still succeeds', async () => {
    // "A read never refuses. AC-18's refusal governs writes; a read withholds a
    // DERIVED value, never a row." Refusing here would make GET /tasks
    // unrenderable for an account with no zone — which on day one is every row.
    const zonelessUser = uuid();
    const id = uuid();
    await seedRaw({
      accounts: [{ user_id: zonelessUser, timezone: null, timezone_source: null, timezone_set_at: null, timezone_last_report: null, timezone_last_report_at: null, created_at: T0 }],
      tasks: [rawTask({ id, user_id: zonelessUser, title: 'qaapi5-no-zone-row', due_at: TODAY_START, due_all_day: null })],
    }).expect(200);
    const res = await h.zoneless.get('/tasks').set('X-User-Id', zonelessUser);
    expect(res.status).toBe(200); // never a refusal
    const row = (res.body.tasks as Task[]).find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row!.due_all_day).toBeNull(); // NOT DETERMINED — carried explicitly
    expect(row!.due_at).toBe(TODAY_START); // the instant is unchanged
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-44 — the date OUTCOMES, and the seam that meets them
// ════════════════════════════════════════════════════════════════════════════

describe('TC-09 AC-44 one instant, one zone, one answer per row', () => {
  it('TC-09a a date computation with no zone at all is REFUSED, and writes nothing', async () => {
    const fresh = uuid();
    const refused = await h.zoneless.post('/tasks').set('X-User-Id', fresh).send({
      title: 'qaapi5-zoneless-write',
      due_at: TOMORROW_0900,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('TIMEZONE_UNKNOWN');
    expect(refused.body.error.detail).toMatchObject({ header: 'X-Timezone' });
    const after = await h.zoneless.get('/tasks').set('X-User-Id', fresh).expect(200);
    expect(after.body.tasks).toHaveLength(0);
  });

  it('TC-09b a rolled due is computed from the PREVIOUS due, never from the moment of completion', async () => {
    // This is simultaneously AC-26's rule and the falsifiable form of "one
    // injectable seam": an implementation reading an inline `new Date()` would
    // produce a different successor at a different completion moment.
    const mk = async () => {
      const t = await create(U1, {
        title: `qaapi5-roll-${uuid().slice(0, 8)}`,
        due_at: '2026-08-24T09:00:00.000Z', // a Monday
        repeat_frequency: 'week',
        repeat_interval: 1,
      });
      return t;
    };
    const a = await mk();
    const doneA = await patch(U1, `/tasks/${a.id}`, { status: 'done' }).expect(200);
    const succA = (doneA.body.changed as Task[]).find((r) => r.series_id === a.series_id)!;

    // move the clock a long way forward and do it again — same answer
    await setClock('2026-09-09T18:00:00.000Z', ZONE, [U1]).expect(200);
    const b = await mk();
    const doneB = await patch(U1, `/tasks/${b.id}`, { status: 'done' }).expect(200);
    const succB = (doneB.body.changed as Task[]).find((r) => r.series_id === b.series_id)!;

    expect(succA.due_at).toBe('2026-08-31T09:00:00.000Z'); // next Monday
    expect(succB.due_at).toBe(succA.due_at); // ticking late does not drift
  });

  it('TC-09c a daily 09:00 repeat rolled across a DST boundary is still due at 09:00 WALL CLOCK', async () => {
    // US DST ends 2026-11-01. 09:00 EDT on 31 Oct is 13:00Z; 09:00 EST on
    // 1 Nov is 14:00Z. An implementation adding 24h of milliseconds lands on
    // 13:00Z — 08:00 local, "an hour either side", which AC-44 forbids.
    await setClock('2026-10-31T12:00:00.000Z', DST_ZONE, [U1]).expect(200);
    const t = await create(U1, {
      title: 'qaapi5-dst-daily',
      due_at: '2026-10-31T13:00:00.000Z', // 09:00 EDT
      due_all_day: false,
      repeat_frequency: 'day',
      repeat_interval: 1,
    });
    const done = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    const succ = (done.body.changed as Task[]).find((r) => r.id !== t.id)!;
    expect(succ).toBeDefined();
    expect(succ.due_at).toBe('2026-11-01T14:00:00.000Z');
  });

  it('TC-09d the zone is first-report-wins; a later differing report changes nothing', async () => {
    const u = uuid();
    // Two DEVICES, so each request's report is the one that device would send.
    // `recordClientZone` runs in the auth step of EVERY request including a
    // read, so reading the account through `h.agent` would itself report UTC
    // and overwrite `timezone_last_report` — which is not a product defect but
    // it does destroy the observable, so the read is done from the same device.
    const berlin = request.agent(h.app).set('X-Timezone', 'Europe/Berlin');
    const bangkok = request.agent(h.app).set('X-Timezone', 'Asia/Bangkok');
    await berlin.get('/tasks').set('X-User-Id', u).expect(200);
    const first = await berlin.get('/account').set('X-User-Id', u).expect(200);
    expect(first.body.timezone).toBe('Europe/Berlin');
    expect(first.body.timezone_source).toBe('first-report');
    // a second device reports a different zone
    await bangkok.get('/tasks').set('X-User-Id', u).expect(200);
    const after = await bangkok.get('/account').set('X-User-Id', u).expect(200);
    expect(after.body.timezone).toBe('Europe/Berlin'); // NOT overwritten
    expect(after.body.timezone_source).toBe('first-report');
    expect(after.body.timezone_last_report).toBe('Asia/Bangkok'); // but visible
    // and the row still resolves in ONE zone, not each device's own: a due at
    // Berlin's local start of day is all-day for BOTH devices.
    const berlinMidnight = '2026-08-20T22:00:00.000Z'; // 2026-08-21T00:00 +02:00
    const t = await berlin.post('/tasks').set('X-User-Id', u)
      .send({ title: 'qaapi5-one-answer', due_at: berlinMidnight }).expect(201);
    expect(t.body.task.due_all_day).toBe(true);
    const fromBangkok = await bangkok.get('/tasks').set('X-User-Id', u).expect(200);
    expect((fromBangkok.body.tasks as Task[]).find((r) => r.id === t.body.task.id)!.due_all_day).toBe(true);
  });

  it('TC-09e PATCH /account is the only way to change an established zone; an unknown zone is refused', async () => {
    const u = uuid();
    await h.agent.get('/tasks').set('X-User-Id', u).set('X-Timezone', 'Europe/Berlin').expect(200);
    const ok = await h.agent.patch('/account').set('X-User-Id', u).send({ timezone: 'Pacific/Auckland' }).expect(200);
    expect(ok.body.timezone).toBe('Pacific/Auckland');
    expect(ok.body.timezone_source).toBe('user');
    const bad = await h.agent.patch('/account').set('X-User-Id', u).send({ timezone: 'Mars/Olympus_Mons' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION');
    const unchanged = await h.agent.get('/account').set('X-User-Id', u).expect(200);
    expect(unchanged.body.timezone).toBe('Pacific/Auckland');
  });

  it('TC-09f the BY-HAND user is safe: an ordinary GET /tasks establishes the zone (AC-32)', async () => {
    const u = uuid();
    // never sends a turn; the assistant could be erroring entirely
    await h.agent.get('/tasks').set('X-User-Id', u).expect(200);
    const created = await h.agent.post('/tasks').set('X-User-Id', u)
      .send({ title: 'qaapi5-by-hand', due_at: TOMORROW_0900 });
    expect(created.status).toBe(201); // not 409 TIMEZONE_UNKNOWN
    expect(h.ai.count).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Sub-tasks — AC-14 (create in one call), AC-15 (order), AC-18 (what a step is)
// ════════════════════════════════════════════════════════════════════════════

/** A parent with n steps, created through the real write path, in order. */
async function parentWithSteps(uid: string, n: number, prefix = 'qaapi5'): Promise<{ parent: Task; steps: Task[] }> {
  const parent = await create(uid, { title: `${prefix}-parent-${uuid().slice(0, 6)}` });
  const steps: Task[] = [];
  for (let i = 1; i <= n; i += 1) {
    steps.push(await create(uid, { title: `${prefix}-step-${i}`, parent_id: parent.id }));
  }
  return { parent, steps };
}

describe('TC-10 AC-14 a step is created in ONE call', () => {
  it('TC-10a POST /tasks accepts parent_id and returns a positioned step — not POST-then-PATCH', async () => {
    const parent = await create(U1, { title: 'qaapi5-one-call-parent' });
    const res = await post(U1, '/tasks', { title: 'qaapi5-one-call-step', parent_id: parent.id }).expect(201);
    const step = res.body.task as Task;
    expect(step.parent_id).toBe(parent.id);
    // "positioned by the server" — there is no window in which it has no
    // position, which is the state AC-3 would otherwise render to every client
    expect(step.step_order).not.toBeNull();
    expect(typeof step.step_order).toBe('number');
  });

  it('TC-10b a step created without a position is appended LAST', async () => {
    const { steps } = await parentWithSteps(U1, 3);
    const orders = steps.map((s) => s.step_order as number);
    expect(orders[1]!).toBeGreaterThan(orders[0]!);
    expect(orders[2]!).toBeGreaterThan(orders[1]!);
  });

  it('TC-10c a create SUPPLYING step_order keeps it — AC-14\'s offline replay', async () => {
    // "The replay carries the step's parent_id and its position, and the server
    // preserves a position the replay supplies rather than reassigning it."
    // The unconditional reading (server always assigns) voids this silently.
    const parent = await create(U1, { title: 'qaapi5-replay-parent' });
    await create(U1, { title: 'qaapi5-replay-first', parent_id: parent.id });
    const replayed = await create(U1, {
      id: uuid(),
      title: 'qaapi5-replayed-step',
      parent_id: parent.id,
      step_order: 7,
    });
    expect(replayed.step_order).toBe(7);
    expect((await taskById(U1, replayed.id))?.step_order).toBe(7);
  });

  it('TC-10d the steps-per-parent bound is stated and REFUSED, never silently enforced', async () => {
    // 200 per parent (api-contracts § Validation bounds). Built with the seed
    // door because 200 real creates is 200 round trips for a bound assertion.
    const parent = await create(U1, { title: 'qaapi5-bound-parent' });
    const rows = [];
    for (let i = 0; i < 200; i += 1) {
      rows.push(rawTask({ title: `qaapi5-bulk-step-${i}`, parent_id: parent.id, step_order: (i + 1) * 1024 }));
    }
    await seedRaw({ tasks: rows }).expect(200);
    const over = await post(U1, '/tasks', { title: 'qaapi5-step-201', parent_id: parent.id });
    expect(over.status).toBe(400);
    expect(over.body.error.code).toBe('VALIDATION');
    // refused, and nothing written
    const after = (await tasksOf(U1)).filter((t) => t.parent_id === parent.id);
    expect(after).toHaveLength(200);
  });
});

describe('TC-11 AC-18 what a step is, and is not', () => {
  it('TC-11a a step of a step is REFUSED, with a stated reason and nothing written', async () => {
    const { parent, steps } = await parentWithSteps(U1, 1);
    const res = await post(U1, '/tasks', { title: 'qaapi5-nested', parent_id: steps[0]!.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.field).toBe('parent_id');
    // "rather than flattened or silently dropped" — assert BOTH wrong outcomes
    const all = await tasksOf(U1);
    expect(all.find((t) => t.title === 'qaapi5-nested')).toBeUndefined(); // not flattened
    expect(all.filter((t) => t.parent_id === parent.id)).toHaveLength(1); // nothing added
  });

  it('TC-11b a step may carry NO repeat; the attempt is refused and writes nothing', async () => {
    const { steps } = await parentWithSteps(U1, 1);
    const step = steps[0]!;
    const res = await patch(U1, `/tasks/${step.id}`, { repeat_frequency: 'week', repeat_interval: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    const back = await taskById(U1, step.id);
    expect(back!.repeat_frequency).toBeNull();
    expect(back!.series_id).toBeNull();
    // and a CREATE that gives a step a repeat is refused at the same rule
    const parent2 = await create(U1, { title: 'qaapi5-repeat-step-parent' });
    const created = await post(U1, '/tasks', {
      title: 'qaapi5-repeating-step',
      parent_id: parent2.id,
      repeat_frequency: 'week',
      repeat_interval: 1,
    });
    expect(created.status).toBe(400);
  });

  it('TC-11c parent_id must name a live, non-step row OF THE CALLER\'S', async () => {
    const mine = await create(U1, { title: 'qaapi5-mine' });
    const theirs = await create(U2, { title: 'qaapi5-theirs' });
    const deleted = await create(U1, { title: 'qaapi5-deleted-parent' });
    await del(U1, `/tasks/${deleted.id}`).expect(200);
    const { steps } = await parentWithSteps(U1, 1);
    const cases: Array<[string, string]> = [
      ['unknown id', uuid()],
      ["another account's row", theirs.id],
      ['a soft-deleted row', deleted.id],
      ['a step (nesting)', steps[0]!.id],
    ];
    for (const [label, pid] of cases) {
      const res = await post(U1, '/tasks', { title: `qaapi5-bad-parent-${label}`, parent_id: pid });
      expect(res.status, label).toBe(400);
      expect(res.body.error.code, label).toBe('VALIDATION');
      expect(res.body.error.field, label).toBe('parent_id');
    }
    // the one legal parent still works, so the guard is not simply refusing all
    const ok = await post(U1, '/tasks', { title: 'qaapi5-good-parent', parent_id: mine.id });
    expect(ok.status).toBe(201);
  });

  it('TC-11d the refusal\'s scope is the WHOLE write, not the offending field', async () => {
    // "a write carrying one legal and one illegal field … leaves the task
    // exactly as it was". Revision 2 left three separately guessable
    // observables; this closes the HTTP one.
    const t = await create(U1, { title: 'qaapi5-whole-write', note: 'before' });
    const res = await patch(U1, `/tasks/${t.id}`, { note: 'after', title: '' });
    expect(res.status).toBe(400);
    const back = await taskById(U1, t.id);
    expect(back!.note).toBe('before'); // the LEGAL field was not written either
    expect(back!.title).toBe('qaapi5-whole-write');
    expect(back!.updated_at).toBe(t.updated_at); // nothing was touched at all
  });

  it('TC-11e parent_id is not patchable — a step does not change parents this phase', async () => {
    const { steps } = await parentWithSteps(U1, 1);
    const other = await create(U1, { title: 'qaapi5-other-parent' });
    const res = await patch(U1, `/tasks/${steps[0]!.id}`, { parent_id: other.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.field).toBe('parent_id');
  });
});

describe('TC-12 AC-15 the order is the user\'s, and it survives a restart', () => {
  it('TC-12a a move writes ONE row, and its prior position rides the response', async () => {
    // ADR-015: sparse positions, gaps of 1024, midpoint on a move. One row,
    // "because both alternatives break something already stated".
    const { steps } = await parentWithSteps(U1, 3);
    const [s1, s2, s3] = steps as [Task, Task, Task];
    // move s3 between s1 and s2
    const mid = Math.floor(((s1.step_order as number) + (s2.step_order as number)) / 2);
    const res = await patch(U1, `/tasks/${s3.id}`, { step_order: mid }).expect(200);
    expect(res.body.prior).toEqual({ step_order: s3.step_order });
    expect(res.body.changed).toEqual([]); // ONE row changed
    const after = (await tasksOf(U1)).filter((t) => t.parent_id === s1.parent_id)
      .sort((a, b) => (a.step_order as number) - (b.step_order as number))
      .map((t) => t.title);
    expect(after).toEqual(['qaapi5-step-1', 'qaapi5-step-3', 'qaapi5-step-2']);
  });

  it('TC-12b a drop where the step ALREADY was writes nothing and creates no undo entry', async () => {
    // "the observable AC-43's *no undo entry* and AC-16's *announces nothing*
    // are asserted against" — an absence, written as one.
    const { steps } = await parentWithSteps(U1, 2);
    const s1 = steps[0]!;
    const res = await patch(U1, `/tasks/${s1.id}`, { step_order: s1.step_order }).expect(200);
    expect(res.body.prior).toEqual({});
    expect(res.body.changed).toEqual([]);
    expect((await taskById(U1, s1.id))?.updated_at).toBe(s1.updated_at); // nothing written
  });

  it('TC-12c a gap too small to bisect renumbers the siblings and returns every row it changed', async () => {
    // ADR-015: "When the gap between neighbours is smaller than 2, the server
    // renumbers every sibling … in the same transaction and returns every row
    // it changed. The move is still one request."
    const parent = await create(U1, { title: 'qaapi5-dense-parent' });
    // adjacent positions, built by the seed door: the write path's own append
    // rule never produces a gap of 1
    const a = rawTask({ title: 'qaapi5-dense-a', parent_id: parent.id, step_order: 1000 });
    const b = rawTask({ title: 'qaapi5-dense-b', parent_id: parent.id, step_order: 1001 });
    const c = rawTask({ title: 'qaapi5-dense-c', parent_id: parent.id, step_order: 1002 });
    await seedRaw({ tasks: [a, b, c] }).expect(200);
    // ask to land between a and b, where no integer fits
    const res = await patch(U1, `/tasks/${c['id'] as string}`, { step_order: 1000 }).expect(200);
    const changed = res.body.changed as Task[];
    expect(changed.length).toBeGreaterThan(0); // the siblings it renumbered
    const ids = new Set([res.body.task.id as string, ...changed.map((r) => r.id)]);
    expect(ids.has(a['id'] as string)).toBe(true);
    expect(ids.has(b['id'] as string)).toBe(true);
    // every sibling now has a distinct position — the renumber left no collision
    const after = (await tasksOf(U1)).filter((t) => t.parent_id === parent.id);
    expect(new Set(after.map((t) => t.step_order)).size).toBe(3);
  });

  it('TC-12d the order is NEVER derived from a step\'s date — a dated step does not jump', async () => {
    const parent = await create(U1, { title: 'qaapi5-dated-parent' });
    const first = await create(U1, { title: 'qaapi5-dated-first', parent_id: parent.id });
    const second = await create(U1, { title: 'qaapi5-dated-second', parent_id: parent.id });
    // give the LAST step the EARLIEST date. A date-derived order jumps it.
    await patch(U1, `/tasks/${second.id}`, { due_at: '2026-08-19T00:00:00.000Z' }).expect(200);
    await patch(U1, `/tasks/${first.id}`, { due_at: '2026-12-31T00:00:00.000Z' }).expect(200);
    const after = (await tasksOf(U1)).filter((t) => t.parent_id === parent.id)
      .sort((x, y) => (x.step_order as number) - (y.step_order as number))
      .map((t) => t.title);
    expect(after).toEqual(['qaapi5-dated-first', 'qaapi5-dated-second']);
  });

  it('TC-12e a DONE step keeps its position and can still be moved', async () => {
    const { steps } = await parentWithSteps(U1, 3);
    const [s1, s2, s3] = steps as [Task, Task, Task];
    const done = await patch(U1, `/tasks/${s2.id}`, { status: 'done' }).expect(200);
    expect(done.body.task.step_order).toBe(s2.step_order); // kept
    const mid = Math.floor(((s1.step_order as number) + (s2.step_order as number)) / 2);
    const moved = await patch(U1, `/tasks/${s2.id}`, { step_order: mid }).expect(200);
    expect(moved.body.task.step_order).toBe(mid); // "finished" is not "no longer in this list"
    expect(moved.body.task.status).toBe('done');
    expect(s3.step_order).not.toBeNull();
  });

  it('TC-12f a list of ONE step cannot be reordered — there is nowhere to drop it', async () => {
    const { steps } = await parentWithSteps(U1, 1);
    const only = steps[0]!;
    const res = await patch(U1, `/tasks/${only.id}`, { step_order: only.step_order }).expect(200);
    expect(res.body.prior).toEqual({}); // the only reachable request is the no-op
    expect((await taskById(U1, only.id))?.step_order).toBe(only.step_order);
  });

  it('TC-12g the order SURVIVES A RESTART — asserted across a store re-open', async () => {
    // "its persistence case runs against the durable store and its restart is a
    // store re-open" (## Test strategy). Without the reopen door this assertion
    // is a re-read of the same RAM, which would pass whatever persistence does.
    const { steps } = await parentWithSteps(U1, 3);
    const [s1, s2, s3] = steps as [Task, Task, Task];
    const mid = Math.floor(((s1.step_order as number) + (s2.step_order as number)) / 2);
    await patch(U1, `/tasks/${s3.id}`, { step_order: mid }).expect(200);
    const before = (await tasksOf(U1)).filter((t) => t.parent_id === s1.parent_id)
      .sort((a, b) => (a.step_order as number) - (b.step_order as number))
      .map((t) => t.title);
    const reopened = await reopenStore().expect(200);
    expect(reopened.body.reopened).toBe(true);
    const after = (await tasksOf(U1)).filter((t) => t.parent_id === s1.parent_id)
      .sort((a, b) => (a.step_order as number) - (b.step_order as number))
      .map((t) => t.title);
    expect(after).toEqual(before);
    expect(after).toEqual(['qaapi5-step-1', 'qaapi5-step-3', 'qaapi5-step-2']);
  });

  it('TC-12h deleting a step and then restoring returns it to the position it HELD', async () => {
    // "because the order lives on the record that came back — which is a SERVER
    // ROW, not a client buffer, and therefore requires AC-41."
    const { steps } = await parentWithSteps(U1, 3);
    const s2 = steps[1]!;
    await del(U1, `/tasks/${s2.id}`).expect(200);
    const restored = await post(U1, `/tasks/${s2.id}/restore`).expect(200);
    expect(restored.body.task.step_order).toBe(s2.step_order);
    const order = (await tasksOf(U1)).filter((t) => t.parent_id === s2.parent_id)
      .sort((a, b) => (a.step_order as number) - (b.step_order as number))
      .map((t) => t.title);
    expect(order).toEqual(['qaapi5-step-1', 'qaapi5-step-2', 'qaapi5-step-3']);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-19 — what happens to a step when its parent moves. One case per door
// (L-005, L-012): four transitions, each reached only the way it names.
// ════════════════════════════════════════════════════════════════════════════

describe('TC-13 AC-19 the four parent transitions', () => {
  it('TC-13a parent completed → the steps are completed WITH it, and the cascade is recorded', async () => {
    const { parent, steps } = await parentWithSteps(U1, 3);
    const res = await patch(U1, `/tasks/${parent.id}`, { status: 'done' }).expect(200);
    const changed = res.body.changed as Task[];
    expect(changed.map((r) => r.id).sort()).toEqual(steps.map((s) => s.id).sort());
    for (const row of changed) {
      expect(row.status).toBe('done');
      // "Which is which is RECORDED, not inferred" — the flag, not updated_at
      expect(row.completed_by_parent).toBe(true);
    }
  });

  it('TC-13b parent completed with steps OUTSTANDING is allowed — the count informs, never gates', async () => {
    const { parent, steps } = await parentWithSteps(U1, 3);
    const res = await patch(U1, `/tasks/${parent.id}`, { status: 'done' });
    expect(res.status).toBe(200); // not a 400, not a 409
    expect(res.body.task.status).toBe('done');
    expect(steps).toHaveLength(3);
  });

  it('TC-13c parent un-completed → the cascade is undone, AND ONLY the cascade', async () => {
    // The case the rule exists to protect (product F1): tick a step by hand,
    // tick the parent a second later, un-complete — and keep your own tick.
    // The plausible invention (compare updated_at) is wrong for exactly this.
    const { parent, steps } = await parentWithSteps(U1, 3);
    const byHand = steps[0]!;
    const handTick = await patch(U1, `/tasks/${byHand.id}`, { status: 'done' }).expect(200);
    // a hand tick CLEARS completed_by_parent (data-model § completed_by_parent)
    expect(handTick.body.task.completed_by_parent).toBe(false);
    await patch(U1, `/tasks/${parent.id}`, { status: 'done' }).expect(200);
    const reopened = await patch(U1, `/tasks/${parent.id}`, { status: 'inbox' }).expect(200);
    const rows = await tasksOf(U1);
    const s = (id: string) => rows.find((r) => r.id === id)!;
    expect(s(byHand.id).status).toBe('done'); // the user's own tick STAYS
    expect(s(steps[1]!.id).status).not.toBe('done'); // cascade-ticked comes back
    expect(s(steps[2]!.id).status).not.toBe('done');
    expect(s(steps[1]!.id).completed_by_parent).toBe(false);
    // the un-complete is a multi-row write and says which rows it changed
    expect((reopened.body.changed as Task[]).map((r) => r.id)).toContain(steps[1]!.id);
    expect((reopened.body.changed as Task[]).map((r) => r.id)).not.toContain(byHand.id);
  });

  it('TC-13d a hand UNTICK of a cascade-ticked step also clears the flag', async () => {
    const { parent, steps } = await parentWithSteps(U1, 2);
    await patch(U1, `/tasks/${parent.id}`, { status: 'done' }).expect(200);
    const untick = await patch(U1, `/tasks/${steps[0]!.id}`, { status: 'inbox' }).expect(200);
    expect(untick.body.task.completed_by_parent).toBe(false);
    // …so un-completing the parent must NOT re-tick it as if the cascade owned it
    await patch(U1, `/tasks/${parent.id}`, { status: 'inbox' }).expect(200);
    expect((await taskById(U1, steps[0]!.id))?.status).not.toBe('done');
  });

  it('TC-13e parent deleted → its steps go with it, under ONE delete gesture', async () => {
    const { parent, steps } = await parentWithSteps(U1, 3);
    const res = await del(U1, `/tasks/${parent.id}`).expect(200);
    expect((res.body.changed as Task[]).map((r) => r.id).sort()).toEqual(steps.map((s) => s.id).sort());
    expect(await tasksOf(U1)).toHaveLength(0); // GET filters deleted rows out
    // and the undo restores the WHOLE CLUSTER in one call (AC-41, AC-43)
    const restored = await post(U1, `/tasks/${parent.id}/restore`).expect(200);
    expect(restored.body.restored).toBe(true);
    expect((restored.body.changed as Task[]).map((r) => r.id).sort()).toEqual(steps.map((s) => s.id).sort());
    expect(await tasksOf(U1)).toHaveLength(4);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Recurrence — AC-20, AC-21, AC-22, AC-23, AC-24, AC-25
// ════════════════════════════════════════════════════════════════════════════

describe('TC-14 AC-21 the shapes that exist, exactly, and nothing else', () => {
  it('TC-14a every N days / weeks / months / years is expressible', async () => {
    for (const [freq, interval] of [['day', 1], ['week', 2], ['month', 3], ['year', 1]] as const) {
      const t = await create(U1, {
        title: `qaapi5-shape-${freq}`,
        due_at: TOMORROW_0900,
        repeat_frequency: freq,
        repeat_interval: interval,
      });
      expect(t.repeat_frequency).toBe(freq);
      expect(t.repeat_interval).toBe(interval);
      expect(t.series_id).not.toBeNull();
      expect(t.series_live).toBe(true);
    }
  });

  it('TC-14b NO hourly repeat — the exclusion is refused, not coerced', async () => {
    const res = await post(U1, '/tasks', {
      title: 'qaapi5-hourly',
      due_at: TOMORROW_0900,
      repeat_frequency: 'hour',
      repeat_interval: 4,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(await tasksOf(U1)).toHaveLength(0);
  });

  it('TC-14c NO weekday selection under a DAILY rule, and no month_days under a weekly one', async () => {
    const t = await create(U1, { title: 'qaapi5-narrow', due_at: TOMORROW_0900 });
    const cases: Array<[string, Record<string, unknown>]> = [
      ['weekdays under daily', { repeat_frequency: 'day', repeat_interval: 1, repeat_weekdays: 'mo,fr' }],
      ['month_days under weekly', { repeat_frequency: 'week', repeat_interval: 1, repeat_month_days: '1,15' }],
      ['weekdays under monthly', { repeat_frequency: 'month', repeat_interval: 1, repeat_weekdays: 'mo' }],
    ];
    for (const [label, body] of cases) {
      const res = await patch(U1, `/tasks/${t.id}`, body);
      expect(res.status, label).toBe(400);
      expect(res.body.error.code, label).toBe('VALIDATION');
    }
    expect((await taskById(U1, t.id))?.repeat_frequency).toBeNull();
  });

  it('TC-14d the interval bound 1–999: 1 and 999 accepted, 0 and 1000 refused', async () => {
    for (const ok of [1, 999]) {
      const t = await create(U1, {
        title: `qaapi5-interval-${ok}`, due_at: TOMORROW_0900,
        repeat_frequency: 'day', repeat_interval: ok,
      });
      expect(t.repeat_interval).toBe(ok);
    }
    for (const bad of [0, -1, 1000]) {
      const res = await post(U1, '/tasks', {
        title: `qaapi5-interval-bad-${bad}`, due_at: TOMORROW_0900,
        repeat_frequency: 'day', repeat_interval: bad,
      });
      expect(res.status, String(bad)).toBe(400);
    }
  });

  it('TC-14e a set member is CANONICALISED, not refused; a value outside the set is refused; "" is refused', async () => {
    // ADR-011: "two equal sets are byte-equal". `"th,mo"` → `"mo,th"`.
    const weekly = await create(U1, {
      title: 'qaapi5-canon-week', due_at: TOMORROW_0900,
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'th,mo',
    });
    expect(weekly.repeat_weekdays).toBe('mo,th');
    const monthly = await create(U1, {
      title: 'qaapi5-canon-month', due_at: '2026-09-15T09:00:00.000Z',
      repeat_frequency: 'month', repeat_interval: 1, repeat_month_days: '15,1,15',
    });
    expect(monthly.repeat_month_days).toBe('1,15'); // de-duplicated and ascending
    for (const [field, bad] of [
      ['repeat_weekdays', 'funday'], ['repeat_weekdays', ''],
      ['repeat_month_days', '0'], ['repeat_month_days', '32'], ['repeat_month_days', ''],
    ] as const) {
      const res = await patch(U1, `/tasks/${weekly.id}`, { [field]: bad });
      expect(res.status, `${field}=${JSON.stringify(bad)}`).toBe(400);
    }
    // "An empty set is not representable and is not a state" — the rule WITHOUT
    // the member is how you express it, and that is accepted
    const cleared = await patch(U1, `/tasks/${weekly.id}`, { repeat_weekdays: null }).expect(200);
    expect(cleared.body.task.repeat_weekdays).toBeNull();
  });

  it('TC-14f a repeat is reported as PER-MEMBER diff rows, flat scalars, on a turn delete', async () => {
    // ADR-011's answer to the recorded diff-row question: a set rides its row
    // as the canonical string, so `data-model.md § assistant_turn`'s declared
    // `{task_id, field, old|null, new|null}` shape does NOT change and F-001
    // AC-4 renders `old → new` for a weekly rule exactly as for a title.
    // An object on either side would collide with the null sentinel — and
    // applyDelete enumerates every non-null member, so it would be emitted on
    // EVERY delete of a repeating task, which is the ordinary case.
    const t = await create(U1, {
      title: 'qaapi5-diff-repeat', due_at: '2026-08-24T09:00:00.000Z',
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo,th',
    });
    const res = await postTurn(U1, 'qaapi5 delete the repeating one').expect(200);
    expect(res.body.turn.outcome.kind).toBe('applied');
    const diff = res.body.turn.diff as { task_id: string; field: string; old: unknown; new: unknown }[];
    const byField = new Map(diff.filter((d) => d.task_id === t.id).map((d) => [d.field, d]));
    // one row PER MEMBER, each carrying a scalar or null and nothing else
    for (const [field, expected] of [
      ['repeat_frequency', 'week'],
      ['repeat_interval', 1],
      ['repeat_weekdays', 'mo,th'],
    ] as const) {
      const row = byField.get(field);
      expect(row, `missing per-member diff row for ${field}`).toBeDefined();
      expect(row!.old).toBe(expected);
      expect(row!.new).toBeNull(); // a delete: every member goes to the sentinel
      expect(typeof row!.old === 'string' || typeof row!.old === 'number').toBe(true);
    }
    // and there is no single row carrying the whole rule as an object
    expect(diff.find((d) => d.field === 'recurrence')).toBeUndefined();
    expect(diff.find((d) => typeof d.old === 'object' && d.old !== null)).toBeUndefined();
  });

  it('TC-14g a non-canonical STORED value is still readable — a read never refuses (seed door)', async () => {
    // The seed door is "the only producer of a non-canonical repeat_weekdays"
    // (api-contracts § Harness doors). What this asserts is the read rule, not
    // a canonicalisation the contract does not claim for reads.
    const id = uuid();
    await seedRaw({
      tasks: [rawTask({
        id, title: 'qaapi5-noncanon', due_at: TOMORROW_0900,
        repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'th,mo',
        series_id: uuid(),
      })],
    }).expect(200);
    const res = await get(U1, '/tasks').expect(200);
    expect((res.body.tasks as Task[]).map((r) => r.id)).toContain(id);
  });
});

describe('TC-15 AC-22 a repeating task ALWAYS has a due date', () => {
  it('TC-15a setting a repeat on a DATELESS task creates today\'s due, all-day, then aligns it', async () => {
    // "create, then align" — one order, stated in one place.
    const t = await create(U1, { title: 'qaapi5-dateless' });
    expect(t.due_at).toBeNull();
    const res = await patch(U1, `/tasks/${t.id}`, { repeat_frequency: 'day', repeat_interval: 1 }).expect(200);
    expect(res.body.task.due_at).toBe(TODAY_START); // today, in the account zone
    expect(res.body.task.due_all_day).toBe(true); // AC-13's date-only form
    expect(res.body.task.due_at).not.toBe(T0); // never the clock instant itself
  });

  it('TC-15b the created date is DISCLOSED before commit, and the disclosure is the committed date', async () => {
    const t = await create(U1, { title: 'qaapi5-disclose-create' });
    const preview = await post(U1, `/tasks/${t.id}/repeat-preview`, {
      repeat_frequency: 'day', repeat_interval: 1,
    }).expect(200);
    expect(preview.body.created).toBe(true);
    expect(preview.body.due_at).toBe(TODAY_START);
    expect(preview.body.due_all_day).toBe(true);
    expect(preview.body.refusals).toEqual([]);
    // it wrote nothing
    expect((await taskById(U1, t.id))?.due_at).toBeNull();
    // and the commit lands on exactly the disclosed date (a dry run of the
    // SAME server code — never a second implementation of the arithmetic)
    const committed = await patch(U1, `/tasks/${t.id}`, { repeat_frequency: 'day', repeat_interval: 1 }).expect(200);
    expect(committed.body.task.due_at).toBe(preview.body.due_at);
    expect(committed.body.task.due_all_day).toBe(preview.body.due_all_day);
  });

  it('TC-15c clearing the due of a repeating task is REFUSED, and never ends the repeat silently', async () => {
    const t = await create(U1, {
      title: 'qaapi5-clear-due-refused', due_at: '2026-08-24T09:00:00.000Z',
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const res = await patch(U1, `/tasks/${t.id}`, { due_at: null });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.field).toBe('due_at');
    const back = await taskById(U1, t.id);
    expect(back!.due_at).toBe(t.due_at); // still there
    expect(back!.repeat_frequency).toBe('week'); // the repeat was NOT ended
  });
});

describe('TC-16 AC-23 the due date must lie on the rule, and moves FORWARD', () => {
  it('TC-16a a due the rule does not admit moves forward, never backward', async () => {
    // The AC's own worked example: due Wednesday, rule "weekly on Monday and
    // Thursday" → the due moves to Thursday. Backward would land it in the past.
    const wednesday = '2026-08-19T09:00:00.000Z';
    const t = await create(U1, { title: 'qaapi5-align', due_at: wednesday });
    const res = await patch(U1, `/tasks/${t.id}`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo,th',
    }).expect(200);
    const moved = Date.parse(res.body.task.due_at as string);
    expect(moved).toBeGreaterThan(Date.parse(wednesday)); // FORWARD
    expect(new Date(moved).getUTCDay()).toBe(4); // Thursday
    expect(res.body.task.due_at).toBe('2026-08-20T09:00:00.000Z');
  });

  it('TC-16b the same alignment applies at all THREE entry points', async () => {
    const rule = { repeat_frequency: 'week' as const, repeat_interval: 1, repeat_weekdays: 'mo,th' };
    // (1) a due the user set
    const set = await create(U1, { title: 'qaapi5-entry-set', due_at: '2026-08-19T09:00:00.000Z' });
    const r1 = await patch(U1, `/tasks/${set.id}`, rule).expect(200);
    expect(new Date(Date.parse(r1.body.task.due_at as string)).getUTCDay()).toBe(4);
    // (2) a due AC-22 just created (today = Wednesday, so it must move)
    const dateless = await create(U1, { title: 'qaapi5-entry-created' });
    const r2 = await patch(U1, `/tasks/${dateless.id}`, rule).expect(200);
    expect(new Date(Date.parse(r2.body.task.due_at as string)).getUTCDay()).toBe(4);
    expect(r2.body.task.due_at).toBe(NEXT_THURSDAY);
    // (3) a due that was already there when the RULE changed
    const existing = await create(U1, {
      title: 'qaapi5-entry-rule-change', due_at: '2026-08-24T09:00:00.000Z', // Monday
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo',
    });
    const r3 = await patch(U1, `/tasks/${existing.id}`, { repeat_weekdays: 'fr' }).expect(200);
    expect(new Date(Date.parse(r3.body.task.due_at as string)).getUTCDay()).toBe(5); // Friday
    expect(Date.parse(r3.body.task.due_at as string)).toBeGreaterThan(Date.parse(existing.due_at!));
  });

  it('TC-16c the preview discloses the MOVE, and moved/created are distinct facts', async () => {
    const t = await create(U1, { title: 'qaapi5-preview-move', due_at: '2026-08-19T09:00:00.000Z' });
    const p = await post(U1, `/tasks/${t.id}/repeat-preview`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo,th',
    }).expect(200);
    expect(p.body.created).toBe(false); // there was already a due
    expect(p.body.moved).toBe(true);
    expect(p.body.due_at).toBe('2026-08-20T09:00:00.000Z');
    // the collection is NOT returned — the server has no opinion (ADR-009)
    expect(p.body).not.toHaveProperty('collection');
    expect(p.body).not.toHaveProperty('status');
  });

  it('TC-16d a due the rule already admits is not moved', async () => {
    const monday = '2026-08-24T09:00:00.000Z';
    const t = await create(U1, { title: 'qaapi5-already-on-rule', due_at: monday });
    const p = await post(U1, `/tasks/${t.id}/repeat-preview`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo',
    }).expect(200);
    expect(p.body.moved).toBe(false);
    expect(p.body.due_at).toBe(monday);
    const res = await patch(U1, `/tasks/${t.id}`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo',
    }).expect(200);
    expect(res.body.task.due_at).toBe(monday);
    expect(NEXT_MONDAY).toBe('2026-08-24T00:00:00.000Z'); // the date named once
  });
});

describe('TC-17 AC-24 month-day overflow lands on the last day of the month', () => {
  it('TC-17a the month-boundary table: 31 clamps, February clamps, never spills, never skips', async () => {
    // "The concrete failure is known and was shipped once": adding a month to
    // 31 January with the platform's own date arithmetic yields 3 MARCH.
    // Each row is its own fixture so a failure names one boundary.
    const rows: Array<[string, string, string]> = [
      // label,                     due (a 31st),                 expected next
      ['31 Jan → 28 Feb (2027, not a leap year)', '2027-01-31T09:00:00.000Z', '2027-02-28T09:00:00.000Z'],
      ['31 Jan → 29 Feb (2028, a leap year)', '2028-01-31T09:00:00.000Z', '2028-02-29T09:00:00.000Z'],
      ['31 Mar → 30 Apr (a 30-day month)', '2027-03-31T09:00:00.000Z', '2027-04-30T09:00:00.000Z'],
      ['31 May → 30 Jun (a 30-day month)', '2027-05-31T09:00:00.000Z', '2027-06-30T09:00:00.000Z'],
      ['31 Dec → 31 Jan (a 31-day month, unclamped)', '2027-12-31T09:00:00.000Z', '2028-01-31T09:00:00.000Z'],
    ];
    for (const [label, due, expected] of rows) {
      await setClock(due, ZONE, [U1]).expect(200);
      const t = await create(U1, {
        title: `qaapi5-clamp-${uuid().slice(0, 6)}`,
        due_at: due, due_all_day: false,
        repeat_frequency: 'month', repeat_interval: 1, repeat_month_days: '31',
      });
      const done = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
      const succ = (done.body.changed as Task[]).find((r) => r.id !== t.id);
      expect(succ, `${label}: no successor generated`).toBeDefined();
      expect(succ!.due_at, label).toBe(expected);
      // it never SPILLS into the next month, and never SKIPS a month
      const got = new Date(Date.parse(succ!.due_at!));
      const from = new Date(Date.parse(due));
      const expectedMonth = (from.getUTCMonth() + 1) % 12;
      expect(got.getUTCMonth(), `${label}: wrong month`).toBe(expectedMonth);
    }
    await setClock(T0, ZONE, [U1]).expect(200);
  });

  it('TC-17b candidates are DE-DUPLICATED after clamping — {30,31} in April is one date, not two', async () => {
    // "a rule that produces one date twice is a defect that only becomes
    // visible once the set has two members, which is precisely why the
    // month-boundary table would not have contained it" (architect F13).
    await setClock('2027-03-30T09:00:00.000Z', ZONE, [U1]).expect(200);
    const t = await create(U1, {
      title: 'qaapi5-dedupe-clamp', due_at: '2027-03-30T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'month', repeat_interval: 1, repeat_month_days: '30,31',
    });
    // 30 March → 31 March (both admitted in a 31-day month)
    const first = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    const succ1 = (first.body.changed as Task[]).find((r) => r.id !== t.id)!;
    expect(succ1.due_at).toBe('2027-03-31T09:00:00.000Z');
    // 31 March → April, where 30 and 31 BOTH clamp to the 30th. Exactly one
    // successor, dated the 30th — not two rows and not the 30th twice.
    const second = await patch(U1, `/tasks/${succ1.id}`, { status: 'done' }).expect(200);
    const succ2 = (second.body.changed as Task[]).filter((r) => r.id !== succ1.id);
    expect(succ2).toHaveLength(1);
    expect(succ2[0]!.due_at).toBe('2027-04-30T09:00:00.000Z');
    // and the third roll leaves April rather than producing the 30th again
    const third = await patch(U1, `/tasks/${succ2[0]!.id}`, { status: 'done' }).expect(200);
    const succ3 = (third.body.changed as Task[]).filter((r) => r.id !== succ2[0]!.id);
    expect(succ3).toHaveLength(1);
    expect(succ3[0]!.due_at).not.toBe('2027-04-30T09:00:00.000Z');
    await setClock(T0, ZONE, [U1]).expect(200);
  });
});

describe('TC-18 AC-25 a series ends one way, never two', () => {
  it('TC-18a until AND count together is REFUSED', async () => {
    const res = await post(U1, '/tasks', {
      title: 'qaapi5-both-endings', due_at: '2026-08-24T09:00:00.000Z',
      repeat_frequency: 'week', repeat_interval: 1,
      repeat_until: '2026-12-31', repeat_count: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(await tasksOf(U1)).toHaveLength(0);
  });

  it('TC-18b an until EARLIER than the due date is REPORTED, not silently corrected', async () => {
    const t = await create(U1, { title: 'qaapi5-until-before', due_at: '2026-09-15T09:00:00.000Z' });
    const res = await patch(U1, `/tasks/${t.id}`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_until: '2026-09-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    const back = await taskById(U1, t.id);
    expect(back!.due_at).toBe('2026-09-15T09:00:00.000Z'); // NOT moved for us
    expect(back!.repeat_until).toBeNull();
  });

  it('TC-18c the preview reports what a commit would refuse, rather than attempting it', async () => {
    const t = await create(U1, { title: 'qaapi5-preview-refusals', due_at: '2026-09-15T09:00:00.000Z' });
    const p = await post(U1, `/tasks/${t.id}/repeat-preview`, {
      repeat_frequency: 'week', repeat_interval: 1,
      repeat_until: '2026-12-31', repeat_count: 5,
    }).expect(200);
    expect(p.body.refusals.length).toBeGreaterThan(0);
    expect((p.body.refusals as { code: string }[]).map((r) => r.code)).toContain('UNTIL_AND_COUNT');
    const p2 = await post(U1, `/tasks/${t.id}/repeat-preview`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_until: '2026-09-01',
    }).expect(200);
    expect((p2.body.refusals as { code: string }[]).map((r) => r.code)).toContain('UNTIL_BEFORE_DUE');
    // it wrote nothing in either case
    expect((await taskById(U1, t.id))?.repeat_frequency).toBeNull();
  });

  it('TC-18d all FOUR endings make series_live false, and series_id survives every one', async () => {
    const mk = async (over: Record<string, unknown>) =>
      create(U1, {
        title: `qaapi5-ending-${uuid().slice(0, 6)}`,
        due_at: '2026-08-24T09:00:00.000Z',
        repeat_frequency: 'week', repeat_interval: 1,
        ...over,
      });

    // (1) cleared repeat — needs no marker; the first conjunct goes false
    const cleared = await mk({});
    expect(cleared.series_live).toBe(true);
    const afterClear = await patch(U1, `/tasks/${cleared.id}`, { repeat_frequency: null, repeat_interval: null }).expect(200);
    expect(afterClear.body.task.series_live).toBe(false);
    expect(afterClear.body.task.series_id).toBe(cleared.series_id); // never cleared
    expect(afterClear.body.task.due_at).toBe(cleared.due_at); // the occurrence stays
    expect(afterClear.body.task.status).not.toBe('archived'); // ending a repeat is not deleting a task

    // (2) end date passed
    const until = await mk({ repeat_until: '2026-08-31' });
    expect(until.series_live).toBe(true);
    await setClock('2026-09-05T09:00:00.000Z', ZONE, [U1]).expect(200);
    expect((await taskById(U1, until.id))?.series_live).toBe(false);
    await setClock(T0, ZONE, [U1]).expect(200);

    // (3) run count reached
    const counted = await mk({ repeat_count: 1 });
    const done = await patch(U1, `/tasks/${counted.id}`, { status: 'done' }).expect(200);
    // one completion, count 1 → the series is over and generated no successor
    expect((done.body.changed as Task[]).filter((r) => r.series_id === counted.series_id)).toHaveLength(0);
    expect(done.body.task.series_live).toBe(false);

    // (4) the series deleted (AC-30) — asserted in TC-20
  });

  it('TC-18e series_live is NEVER keyed off series_id', async () => {
    // "an implementation keyed off it passes the positive case and marks EVERY
    // task that ever repeated as repeating for good — the only thing on the
    // phone that explains an unexpected row, wrong on every ex-repeating task."
    const t = await create(U1, {
      title: 'qaapi5-ex-repeating', due_at: '2026-08-24T09:00:00.000Z',
      repeat_frequency: 'week', repeat_interval: 1,
    });
    await patch(U1, `/tasks/${t.id}`, { repeat_frequency: null, repeat_interval: null }).expect(200);
    const back = await taskById(U1, t.id);
    expect(back!.series_id).not.toBeNull(); // the key is still there…
    expect(back!.series_live).toBe(false); // …and the predicate says no
  });

  it('TC-18f generation is PER OCCURRENCE and idempotent — re-completing generates nothing further', async () => {
    // AC-26, phrasing corrected in revision 4 (tester T40): the guarantee is
    // "per occurrence and idempotent, not per completion event". So an
    // occurrence that has already generated its one successor generates nothing
    // on a second completion — including after AC-28 removed the first one.
    const t = await create(U1, {
      title: 'qaapi5-idempotent-gen', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1, repeat_count: 2,
    });
    const d1 = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    const occ2 = (d1.body.changed as Task[]).find((r) => r.id !== t.id)!;
    expect(occ2).toBeDefined();
    expect(occ2.series_id).toBe(t.series_id);
    // un-complete removes the untouched successor (AC-28)
    const un = await patch(U1, `/tasks/${t.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.removed).toContain(occ2.id);
    // re-completing the SAME occurrence generates NO second successor
    const d2 = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    expect((d2.body.changed as Task[]).filter((r) => r.series_id === t.series_id)).toHaveLength(0);
    const rows = await tasksOf(U1);
    expect(rows.filter((r) => r.series_id === t.series_id)).toHaveLength(1);
  });

  it('TC-18g un-completing does NOT un-count a run — a mis-tap never extends the series', async () => {
    // "So a mis-tap does not silently extend the series by one." ADR-014:
    // ever_completed is never cleared, not by un-completing and not by an undo.
    // ever_completed is internal, so the observable is series_live.
    const t = await create(U1, {
      title: 'qaapi5-no-uncount', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1, repeat_count: 1,
    });
    const done = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    expect(done.body.task.series_live).toBe(false); // 1 of 1 run used
    const un = await patch(U1, `/tasks/${t.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.task.repeat_frequency).toBe('week'); // the repeat is still set
    expect(un.body.task.series_live).toBe(false); // and the run is still counted
  });

  it('TC-18h the run count reaches its limit across DISTINCT occurrences', async () => {
    const t = await create(U1, {
      title: 'qaapi5-two-runs', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1, repeat_count: 2,
    });
    const d1 = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    const occ2 = (d1.body.changed as Task[]).find((r) => r.id !== t.id)!;
    expect(occ2.series_live).toBe(true); // 1 of 2
    const d2 = await patch(U1, `/tasks/${occ2.id}`, { status: 'done' }).expect(200);
    // run 2 reached: no third occurrence, and the series is over
    expect((d2.body.changed as Task[]).filter((r) => r.series_id === t.series_id && r.id !== occ2.id)).toHaveLength(0);
    expect(d2.body.task.series_live).toBe(false);
  });

  it('TC-18i a completion still counts after the row is soft-deleted', async () => {
    // "counting only live rows reproduces exactly the defect that reasoning
    // cites" — deletes here are SOFT, so a deleted completed row is still a run.
    const t = await create(U1, {
      title: 'qaapi5-deleted-run', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1, repeat_count: 1,
    });
    const d = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    expect(d.body.task.series_live).toBe(false);
    await del(U1, `/tasks/${t.id}`).expect(200);
    // restore it and the count has not been forgotten
    const r = await post(U1, `/tasks/${t.id}/restore`).expect(200);
    expect(r.body.task.series_live).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Generation and un-generation — AC-26, AC-27, AC-28, AC-29
// ════════════════════════════════════════════════════════════════════════════

/** A repeating occurrence, with note, priority, a reminder and n steps. */
async function repeatingWithEverything(uid: string, n = 2): Promise<{ occ: Task; steps: Task[] }> {
  const occ = await create(uid, {
    title: `qaapi5-full-${uuid().slice(0, 6)}`,
    note: 'the note the user set',
    priority: 'high',
    due_at: '2026-08-24T09:00:00.000Z', // Monday
    due_all_day: false,
    reminder_at: '2026-08-23T09:00:00.000Z', // 24h before the due
    repeat_frequency: 'week',
    repeat_interval: 1,
  });
  const steps: Task[] = [];
  for (let i = 1; i <= n; i += 1) {
    steps.push(await create(uid, { title: `qaapi5-full-step-${i}`, parent_id: occ.id }));
  }
  return { occ, steps };
}

describe('TC-19 AC-26/AC-27 completing a repeating task never loses the work', () => {
  it('TC-19a the completed occurrence stays as HISTORY and exactly one successor appears', async () => {
    const t = await create(U1, {
      title: 'qaapi5-history', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const done = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    expect(done.body.task.status).toBe('done');
    expect(done.body.task.deleted_at).toBeNull(); // history, not rubbish
    const successors = (done.body.changed as Task[]).filter((r) => r.series_id === t.series_id);
    expect(successors).toHaveLength(1); // exactly one, never a second
    expect(successors[0]!.status).not.toBe('done');
    // the response CARRIES it — the client does not need a blind GET
    expect(successors[0]!.due_at).toBe('2026-08-31T09:00:00.000Z');
    const rows = await tasksOf(U1);
    expect(rows.filter((r) => r.series_id === t.series_id)).toHaveLength(2);
  });

  it('TC-19b generation happens inside the completing write — one request, both rows', async () => {
    // "Generation happens inside the completing write's transaction: outside
    // it, a crash leaves a series with zero open occurrences instead of one."
    // The observable available at this tier is that ONE request returns both.
    const t = await create(U1, {
      title: 'qaapi5-one-write', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const done = await patch(U1, `/tasks/${t.id}`, { status: 'done' }).expect(200);
    expect(done.body.changed).toHaveLength(1);
    // and it is on disk after that single write, not after some later refresh
    const reopened = await reopenStore().expect(200);
    expect(reopened.body.reopened).toBe(true);
    const rows = await tasksOf(U1);
    expect(rows.filter((r) => r.series_id === t.series_id)).toHaveLength(2);
  });

  it('TC-19c the successor carries note, priority and EVERY step, all unticked and unclaimed', async () => {
    // AC-27's shipped failure record read as a list of what to test: the
    // original product's generator silently lost the successor's list, its
    // reminder and its sub-tasks — three bugs, all invisible.
    const { occ, steps } = await repeatingWithEverything(U1, 3);
    // tick one step by hand and let the parent cascade the rest
    await patch(U1, `/tasks/${steps[0]!.id}`, { status: 'done' }).expect(200);
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const changed = done.body.changed as Task[];
    const succ = changed.find((r) => r.series_id === occ.series_id && r.parent_id === null)!;
    expect(succ).toBeDefined();
    expect(succ.note).toBe('the note the user set');
    expect(succ.priority).toBe('high');
    const succSteps = changed.filter((r) => r.parent_id === succ.id);
    expect(succSteps).toHaveLength(3); // every step
    for (const s of succSteps) {
      expect(s.status).not.toBe('done'); // ALL UNTICKED
      expect(s.completed_by_parent).toBe(false); // and unclaimed, so a cascade
      // on the new occurrence reverses correctly
      expect(s.reminder_shown_at).toBeNull();
    }
    expect(succSteps.map((s) => s.title).sort()).toEqual(
      ['qaapi5-full-step-1', 'qaapi5-full-step-2', 'qaapi5-full-step-3'],
    );
    // step order travels too, so the successor's list is the user's list
    expect(new Set(succSteps.map((s) => s.step_order)).size).toBe(3);
  });

  it('TC-19d the reminder travels by OFFSET from the due, never as an absolute instant', async () => {
    // "an alert copied verbatim onto next month's task is already in the past".
    const { occ } = await repeatingWithEverything(U1, 0);
    const offset = Date.parse(occ.due_at!) - Date.parse(occ.reminder_at!);
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const succ = (done.body.changed as Task[]).find((r) => r.series_id === occ.series_id)!;
    expect(succ.reminder_at).not.toBe(occ.reminder_at); // not copied verbatim
    expect(Date.parse(succ.due_at!) - Date.parse(succ.reminder_at!)).toBe(offset);
    expect(Date.parse(succ.reminder_at!)).toBeGreaterThan(Date.parse(occ.reminder_at!));
    // and the marker is NOT inherited (AC-27, AC-38)
    expect(succ.reminder_shown_at).toBeNull();
  });

  it('TC-19e reminder_shown_at is never inherited, even when the completed row carried one', async () => {
    const { occ } = await repeatingWithEverything(U1, 0);
    await post(U1, `/tasks/${occ.id}/reminder-ack`, { reminder_at: occ.reminder_at }).expect(200);
    expect((await taskById(U1, occ.id))?.reminder_shown_at).not.toBeNull();
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const succ = (done.body.changed as Task[]).find((r) => r.series_id === occ.series_id)!;
    // "a successor inheriting it carries a reminder that never fires"
    expect(succ.reminder_shown_at).toBeNull();
  });

  it('TC-19f on an ALL-DAY due the offset is whole days and the reminder keeps its wall-clock time', async () => {
    // AC-27 + product F2: AC-22 creates all-day dues BY RULE, so this is the
    // default path, not an edge. The offset must never be measured from a
    // fabricated local midnight, which is what AC-13 exists to prevent.
    const occ = await create(U1, {
      title: 'qaapi5-allday-offset',
      due_at: TODAY_START, // all-day, 2026-08-19
      due_all_day: true,
      reminder_at: '2026-08-18T17:30:00.000Z', // the day before, at 17:30
      repeat_frequency: 'day', repeat_interval: 1,
    });
    expect(occ.due_all_day).toBe(true);
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const succ = (done.body.changed as Task[]).find((r) => r.series_id === occ.series_id)!;
    expect(succ.due_at).toBe('2026-08-20T00:00:00.000Z');
    expect(succ.due_all_day).toBe(true);
    // a WHOLE number of days later, and the same wall-clock time
    const before = new Date(Date.parse(occ.reminder_at!));
    const after = new Date(Date.parse(succ.reminder_at!));
    expect(after.getUTCHours()).toBe(before.getUTCHours());
    expect(after.getUTCMinutes()).toBe(before.getUTCMinutes());
    const days = (Date.parse(succ.reminder_at!) - Date.parse(occ.reminder_at!)) / 86_400_000;
    expect(Number.isInteger(days)).toBe(true);
    expect(days).toBe(1);
  });

  it('TC-19g the successor\'s placement follows the ROLLED DUE and nothing about the completed row', async () => {
    // The fourth shipped failure AC-27 names: theirs "placed the successor by
    // reading the completed row's own collection".
    const occ = await create(U1, {
      title: 'qaapi5-placement', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      status: 'archived', // a filing the successor must NOT inherit
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const succ = (done.body.changed as Task[]).find((r) => r.series_id === occ.series_id)!;
    expect(succ.due_at).toBe('2026-08-31T09:00:00.000Z');
    expect(succ.status).not.toBe('done');
    expect(succ.status).not.toBe('archived');
  });
});

describe('TC-20 AC-28 un-completing removes the successor ONLY when it is untouched', () => {
  /** Complete a repeating occurrence and hand back both rows. */
  async function completed(over: Record<string, unknown> = {}) {
    const occ = await create(U1, {
      title: `qaapi5-ac28-${uuid().slice(0, 6)}`,
      due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
      ...over,
    });
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const succ = (done.body.changed as Task[]).find((r) => r.series_id === occ.series_id && r.parent_id === null)!;
    return { occ, succ, done };
  }

  it('TC-20a an UNTOUCHED successor is removed, and the removal is HARD, not soft', async () => {
    const { occ, succ } = await completed();
    const un = await patch(U1, `/tasks/${occ.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.removed).toContain(succ.id);
    // "a soft-removed successor is a row AC-41 can restore, producing the
    // second open occurrence this whole section rests on not having"
    const restore = await post(U1, `/tasks/${succ.id}/restore`);
    expect(restore.status).toBe(404);
    expect((await tasksOf(U1)).filter((r) => r.series_id === occ.series_id)).toHaveLength(1);
  });

  it('TC-20b condition 4 — a successor that is itself DONE stays, and both rows stand', async () => {
    const { occ, succ } = await completed();
    await patch(U1, `/tasks/${succ.id}`, { status: 'done' }).expect(200);
    const un = await patch(U1, `/tasks/${occ.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.removed ?? []).not.toContain(succ.id);
    expect(await taskById(U1, succ.id)).toBeDefined();
  });

  it('TC-20c condition 3 — an EDITED successor stays (updated_at no longer equals created_at)', async () => {
    const { occ, succ } = await completed();
    // The clock is HELD for this run (AC-44), so an edit made at the same
    // instant leaves `updated_at` equal to `created_at` and the condition
    // cannot be constructed. Advance first — see `advance()`.
    await advance(60_000).expect(200);
    const edited = await patch(U1, `/tasks/${succ.id}`, { note: 'the user got here' }).expect(200);
    expect(edited.body.task.updated_at).not.toBe(edited.body.task.created_at);
    const un = await patch(U1, `/tasks/${occ.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.removed ?? []).not.toContain(succ.id);
    const still = await taskById(U1, succ.id);
    expect(still).toBeDefined();
    expect(still!.note).toBe('the user got here');
  });

  it('TC-20d condition 5 — a successor whose STEP was ticked stays; the step\'s row is what changed', async () => {
    // The condition every whole-row comparison is blind to, because ticking a
    // step touches the STEP's row and not the successor's. AC-46 and ADR-013
    // both name this as the case the natural test passes.
    const { occ, steps } = await repeatingWithEverything(U1, 2);
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const changed = done.body.changed as Task[];
    const succ = changed.find((r) => r.series_id === occ.series_id && r.parent_id === null)!;
    const succStep = changed.find((r) => r.parent_id === succ.id)!;
    expect(succStep).toBeDefined();
    // the user works on the NEW occurrence's step. The clock advances first so
    // that "the successor itself is untouched" is a real assertion rather than
    // two reads of one held instant.
    await advance(60_000).expect(200);
    await patch(U1, `/tasks/${succStep.id}`, { status: 'done' }).expect(200);
    const succBefore = await taskById(U1, succ.id);
    const un = await patch(U1, `/tasks/${occ.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.removed ?? []).not.toContain(succ.id);
    const succAfter = await taskById(U1, succ.id);
    expect(succAfter).toBeDefined();
    expect(succAfter!.updated_at).toBe(succBefore!.updated_at); // untouched itself
    expect(steps).toHaveLength(2);
  });

  it('TC-20e the five conditions are CONJUNCTIVE — a series_id mismatch alone leaves the row', async () => {
    const { occ, succ } = await completed();
    // a row that looks like a successor but belongs to no series
    const impostor = await create(U1, { title: 'qaapi5-impostor', due_at: '2026-08-31T09:00:00.000Z' });
    const un = await patch(U1, `/tasks/${occ.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.removed).toContain(succ.id);
    expect(un.body.removed ?? []).not.toContain(impostor.id);
    expect(await taskById(U1, impostor.id)).toBeDefined();
  });
});

describe('TC-21 AC-29 editing one occurrence edits only that occurrence', () => {
  it('TC-21a the edit carries forward, because the successor is generated FROM it', async () => {
    const occ = await create(U1, {
      title: 'qaapi5-carry-forward', note: 'v1', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    await patch(U1, `/tasks/${occ.id}`, { note: 'v2' }).expect(200);
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const succ = (done.body.changed as Task[]).find((r) => r.series_id === occ.series_id)!;
    expect(succ.note).toBe('v2');
  });

  it('TC-21b HISTORY is never rewritten: a rule change reaches only occurrences generated afterwards', async () => {
    const occ1 = await create(U1, {
      title: 'qaapi5-history-1', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const done = await patch(U1, `/tasks/${occ1.id}`, { status: 'done' }).expect(200);
    const occ2 = (done.body.changed as Task[]).find((r) => r.series_id === occ1.series_id)!;
    const occ1Before = await taskById(U1, occ1.id);
    // change the rule on the CURRENT occurrence
    const changed = await patch(U1, `/tasks/${occ2.id}`, { repeat_interval: 2 }).expect(200);
    expect(changed.body.task.repeat_interval).toBe(2);
    // the completed occurrence is untouched — not its rule, not its due
    const occ1After = await taskById(U1, occ1.id);
    expect(occ1After!.repeat_interval).toBe(1);
    expect(occ1After!.due_at).toBe(occ1Before!.due_at);
    expect(occ1After!.updated_at).toBe(occ1Before!.updated_at);
    // and the NEXT occurrence follows the new rule (2 weeks, not 1)
    const done2 = await patch(U1, `/tasks/${changed.body.task.id}`, { status: 'done' }).expect(200);
    const occ3 = (done2.body.changed as Task[]).find((r) => r.series_id === occ1.series_id)!;
    const gapDays = (Date.parse(occ3.due_at!) - Date.parse(changed.body.task.due_at as string)) / 86_400_000;
    expect(gapDays).toBe(14);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Delete and restore — AC-30, AC-31, AC-41
// ════════════════════════════════════════════════════════════════════════════

describe('TC-22 AC-30/AC-31 deleting names which of the two things it is about to do', () => {
  it('TC-22a the default scope is the OCCURRENCE, and it takes the row and its steps', async () => {
    const { parent, steps } = await parentWithSteps(U1, 2);
    const res = await del(U1, `/tasks/${parent.id}`).expect(200);
    expect(res.body.task.deleted_at).not.toBeNull(); // soft, as it already is
    expect((res.body.changed as Task[]).map((r) => r.id).sort()).toEqual(steps.map((s) => s.id).sort());
    expect(await tasksOf(U1)).toHaveLength(0);
  });

  it('TC-22b scope=series trashes every UNFINISHED occurrence and LEAVES every completed one', async () => {
    // The plural branch is reachable only through AC-28's two-open-occurrence
    // outcome, which is that state's only constructor.
    const occ1 = await create(U1, {
      title: 'qaapi5-series-del', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const d1 = await patch(U1, `/tasks/${occ1.id}`, { status: 'done' }).expect(200);
    const occ2 = (d1.body.changed as Task[]).find((r) => r.series_id === occ1.series_id)!;
    const step = await create(U1, { title: 'qaapi5-series-del-step', parent_id: occ2.id });
    // AC-28's constructor for a second open occurrence: complete occ2, edit its
    // successor, un-complete occ2 — both rows then stand.
    const d2 = await patch(U1, `/tasks/${occ2.id}`, { status: 'done' }).expect(200);
    const occ3 = (d2.body.changed as Task[]).find((r) => r.series_id === occ1.series_id && r.parent_id === null)!;
    await advance(60_000).expect(200);
    await patch(U1, `/tasks/${occ3.id}`, { note: 'touched' }).expect(200);
    const un = await patch(U1, `/tasks/${occ2.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.removed ?? []).not.toContain(occ3.id);

    const res = await h.agent.delete(`/tasks/${occ2.id}?scope=series`).set('X-User-Id', U1).expect(200);
    // TRASHED is `deleted_at != null`, NOT "appears in `changed`". A series
    // delete also writes `series_ended_at` on EVERY row of the series including
    // the surviving completed ones (AC-25's fourth ending), so the survivor is
    // legitimately in `changed` while not being trashed. Reading membership of
    // `changed` as "deleted" is an assertion that would fail for the right
    // reason here and pass for the wrong one elsewhere.
    const rowsInResponse = [res.body.task as Task, ...(res.body.changed as Task[])];
    const trashed = new Set(rowsInResponse.filter((r) => r.deleted_at !== null).map((r) => r.id));
    expect(trashed.has(occ2.id)).toBe(true); // unfinished
    expect(trashed.has(occ3.id)).toBe(true); // unfinished
    expect(trashed.has(step.id)).toBe(true); // and their steps
    expect(trashed.has(occ1.id)).toBe(false); // the COMPLETED one is a record of
    // work that was actually done, not rubbish
    const survivorRow = rowsInResponse.find((r) => r.id === occ1.id);
    expect(survivorRow, 'the survivor is reported, because its series ended').toBeDefined();
    expect(survivorRow!.deleted_at).toBeNull();
    const left = await tasksOf(U1);
    expect(left.map((r) => r.id)).toEqual([occ1.id]);
  });

  it('TC-22c a series delete ends the series for the SURVIVOR too — AC-25\'s fourth ending', async () => {
    // "series_live stayed TRUE for a series that no longer exists and AC-39
    // marked them as repeating forever — on the phone, the only thing that
    // explains an unexpected row" (tester T39).
    const occ1 = await create(U1, {
      title: 'qaapi5-fourth-ending', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const d = await patch(U1, `/tasks/${occ1.id}`, { status: 'done' }).expect(200);
    const occ2 = (d.body.changed as Task[]).find((r) => r.series_id === occ1.series_id)!;
    expect((await taskById(U1, occ1.id))!.series_live).toBe(true);
    await h.agent.delete(`/tasks/${occ2.id}?scope=series`).set('X-User-Id', U1).expect(200);
    const survivor = await taskById(U1, occ1.id);
    expect(survivor).toBeDefined(); // it is not trashed…
    expect(survivor!.repeat_frequency).toBe('week'); // …its repeat is still set…
    expect(survivor!.series_id).toBe(occ1.series_id); // …and it keeps the key…
    expect(survivor!.series_live).toBe(false); // …but the series is over
  });

  it('TC-22d scope=series on a row with NO series is refused', async () => {
    const t = await create(U1, { title: 'qaapi5-no-series' });
    const res = await h.agent.delete(`/tasks/${t.id}?scope=series`).set('X-User-Id', U1);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(await taskById(U1, t.id)).toBeDefined(); // nothing trashed
  });

  it('TC-22e ONE undo restores every occurrence the series delete trashed, each with its steps, in one call', async () => {
    // "Without this the most destructive action in the feature has no dialog AND
    // no defined reversal, which is worse than either alone."
    const occ1 = await create(U1, {
      title: 'qaapi5-series-restore', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const d1 = await patch(U1, `/tasks/${occ1.id}`, { status: 'done' }).expect(200);
    const occ2 = (d1.body.changed as Task[]).find((r) => r.series_id === occ1.series_id)!;
    const s1 = await create(U1, { title: 'qaapi5-sr-step-1', parent_id: occ2.id });
    const s2 = await create(U1, { title: 'qaapi5-sr-step-2', parent_id: occ2.id });
    const deleted = await h.agent.delete(`/tasks/${occ2.id}?scope=series`).set('X-User-Id', U1).expect(200);
    // again: trashed means `deleted_at != null`, not "named in `changed`"
    const trashedIds = [deleted.body.task as Task, ...(deleted.body.changed as Task[])]
      .filter((r) => r.deleted_at !== null).map((r) => r.id);
    expect(trashedIds.sort()).toEqual([occ2.id, s1.id, s2.id].sort());
    const restored = await post(U1, `/tasks/${occ2.id}/restore`).expect(200);
    expect(restored.body.restored).toBe(true);
    const backIds = [restored.body.task as Task, ...(restored.body.changed as Task[])]
      .filter((r) => r.deleted_at === null).map((r) => r.id);
    // ONE call brings back every occurrence the gesture trashed, with its steps
    expect(backIds.sort()).toEqual([occ2.id, s1.id, s2.id].sort());
    expect((await tasksOf(U1)).map((r) => r.id).sort()).toEqual([occ1.id, occ2.id, s1.id, s2.id].sort());
  });
});

describe('TC-23 AC-41 a soft-deleted task can be restored', () => {
  it('TC-23a restoring is not creating: id, step_order, series_id and created_at are kept', async () => {
    const { parent, steps } = await parentWithSteps(U1, 2);
    const repeating = await create(U1, {
      title: 'qaapi5-restore-series', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    await del(U1, `/tasks/${parent.id}`).expect(200);
    await del(U1, `/tasks/${repeating.id}`).expect(200);
    await advance(5_000).expect(200);
    const rp = await post(U1, `/tasks/${parent.id}/restore`).expect(200);
    const rr = await post(U1, `/tasks/${repeating.id}/restore`).expect(200);
    expect(rp.body.task.id).toBe(parent.id);
    expect(rp.body.task.created_at).toBe(parent.created_at);
    expect(rp.body.task.deleted_at).toBeNull(); // only deleted_at clears…
    expect(Date.parse(rp.body.task.updated_at as string)).toBeGreaterThan(Date.parse(parent.updated_at)); // …and updated_at advances
    expect(rr.body.task.series_id).toBe(repeating.series_id);
    const backSteps = (rp.body.changed as Task[]);
    for (const s of steps) {
      const back = backSteps.find((r) => r.id === s.id)!;
      expect(back).toBeDefined();
      expect(back.step_order).toBe(s.step_order);
    }
  });

  it('TC-23b restoring a STEP whose parent is still deleted restores the parent too', async () => {
    // "A step with no parent is in no collection (AC-35) and therefore
    // unreachable" — so the invariant, not a parent_id key.
    const { parent, steps } = await parentWithSteps(U1, 2);
    await del(U1, `/tasks/${parent.id}`).expect(200);
    const res = await post(U1, `/tasks/${steps[0]!.id}/restore`).expect(200);
    const backIds = [res.body.task.id as string, ...(res.body.changed as Task[]).map((r) => r.id)];
    expect(backIds).toContain(parent.id);
    const live = await tasksOf(U1);
    expect(live.map((r) => r.id)).toContain(parent.id);
  });

  it('TC-23c a row with NO membership record restores ALONE — the measured 53-row legacy case (seed door)', async () => {
    // ADR-012: "the membership of those 53 rows is genuinely unknown, and every
    // available way to infer one is a key AC-41 rejects by name". It
    // under-restores, which is the safe direction. Only the seed door can build
    // a soft-deleted row with delete_gesture_id: null.
    const legacyParent = uuid();
    const legacyStepA = uuid();
    const legacyStepB = uuid();
    await seedRaw({
      tasks: [
        rawTask({ id: legacyParent, title: 'qaapi5-legacy-parent', deleted_at: T0, delete_gesture_id: null }),
        rawTask({ id: legacyStepA, title: 'qaapi5-legacy-step-a', parent_id: legacyParent, step_order: 1024, deleted_at: T0, delete_gesture_id: null }),
        rawTask({ id: legacyStepB, title: 'qaapi5-legacy-step-b', parent_id: legacyParent, step_order: 2048, deleted_at: T0, delete_gesture_id: null }),
      ],
    }).expect(200);
    const res = await post(U1, `/tasks/${legacyParent}/restore`).expect(200);
    expect(res.body.restored).toBe(true);
    // ALONE — the sibling steps are NOT dragged back by a parent_id key
    expect((res.body.changed as Task[]).map((r) => r.id)).not.toContain(legacyStepA);
    expect((res.body.changed as Task[]).map((r) => r.id)).not.toContain(legacyStepB);
    expect((await tasksOf(U1)).map((r) => r.id)).toEqual([legacyParent]);
    // and a legacy STEP still pulls its parent, because that is an invariant
    // rather than a membership key — evaluated after the set is assembled
    const stepRes = await post(U1, `/tasks/${legacyStepA}/restore`).expect(200);
    const ids = [stepRes.body.task.id as string, ...(stepRes.body.changed as Task[]).map((r) => r.id)];
    expect(ids).toContain(legacyStepA);
    expect(ids).not.toContain(legacyStepB);
  });

  it('TC-23d restoring a row that is NOT deleted is a stated no-op — never 404, never 409', async () => {
    // "A double-tap is ordinary on an undo that is one action away wherever the
    // user is, and a silent no-op is indistinguishable from a refusal unless
    // one of them is stated."
    const t = await create(U1, { title: 'qaapi5-double-tap' });
    const res = await post(U1, `/tasks/${t.id}/restore`);
    expect(res.status).toBe(200);
    expect(res.body.restored).toBe(false); // STATED
    expect(res.body.task.deleted_at).toBeNull();
    // and a real double-tap: delete, restore, restore again
    await del(U1, `/tasks/${t.id}`).expect(200);
    const first = await post(U1, `/tasks/${t.id}/restore`).expect(200);
    expect(first.body.restored).toBe(true);
    const second = await post(U1, `/tasks/${t.id}/restore`).expect(200);
    expect(second.body.restored).toBe(false);
  });

  it('TC-23e restore is scoped to the CALLER\'S rows: another account is 404, no auth is 401', async () => {
    // "a brand-new write path is exactly where that gets missed, and no AC would
    // otherwise turn red" (product P11).
    const theirs = await create(U2, { title: 'qaapi5-their-row' });
    await del(U2, `/tasks/${theirs.id}`).expect(200);
    const cross = await post(U1, `/tasks/${theirs.id}/restore`);
    expect(cross.status).toBe(404);
    expect(cross.body.error.code).toBe('NOT_FOUND');
    // the victim's row is still deleted — the refusal did not act
    expect((await tasksOf(U2)).map((r) => r.id)).not.toContain(theirs.id);
    const restoredByOwner = await post(U2, `/tasks/${theirs.id}/restore`).expect(200);
    expect(restoredByOwner.body.restored).toBe(true);
    // an unknown id is indistinguishable from someone else's (no enumeration)
    const unknown = await post(U1, `/tasks/${uuid()}/restore`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
    const noAuth = await h.agent.post(`/tasks/${theirs.id}/restore`).send({});
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('TC-23f PATCH still 404s on a deleted row, and deleted_at is not patchable — which is why restore is a route', async () => {
    const t = await create(U1, { title: 'qaapi5-patch-deleted' });
    const notPatchable = await patch(U1, `/tasks/${t.id}`, { deleted_at: null });
    expect(notPatchable.status).toBe(400);
    expect(notPatchable.body.error.code).toBe('VALIDATION');
    await del(U1, `/tasks/${t.id}`).expect(200);
    const onDeleted = await patch(U1, `/tasks/${t.id}`, { title: 'qaapi5-resurrect' });
    expect(onDeleted.status).toBe(404);
    // a re-POST under the same id is the 409 the AC names, not a resurrection
    const rePost = await post(U1, '/tasks', { id: t.id, title: 'qaapi5-patch-deleted' });
    expect(rePost.status).toBe(409);
    expect(rePost.body.error.code).toBe('TASK_ID_EXISTS');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-34 — two records, two OPPOSITE treatments
// ════════════════════════════════════════════════════════════════════════════

/**
 * A stored task record in the PRE-F-005 shape: exactly the F-001 baseline keys
 * and none of F-005's. This is the record AC-34 is proven against, and
 * "a snapshot captured by the current build is already the new shape, so a test
 * that captures its own snapshot cannot fail this AC" — hence the seed door.
 */
const preF005Record = (t: Task, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: t.id,
  user_id: U1,
  title: t.title,
  due_at: t.due_at,
  reminder_at: t.reminder_at,
  // `priority` is part of the F-001 BASELINE, not an F-005 addition, so it is
  // PRESENT in a pre-F-005 record and must carry the row's stored value. `none`
  // is the absence of a stored value (AC-8), so the stored form is `null`.
  priority: t.priority === 'none' ? null : t.priority,
  status: t.status,
  created_at: t.created_at,
  updated_at: t.updated_at,
  deleted_at: t.deleted_at,
  ...over,
});

/** Open a real session without occupying the undo window, and return its id. */
async function openSession(uid: string): Promise<string> {
  const res = await postTurn(uid, 'qaapi5 something nobody has a rule for').expect(200);
  expect(res.body.turn.outcome.kind).toBe('no_match'); // non-mutating: no window
  return res.body.session_id as string;
}

describe('TC-24 AC-34 restoring a snapshot never unsets a field the snapshot predates', () => {
  it('TC-24a ON COMPARISON an absent key means "not recorded" and compares EQUAL to whatever is live', async () => {
    // "Widening the comparison without this rule makes every pre-F-005
    // post_apply record unequal to its live row — undefined stored versus null
    // live — for EVERY new field at once, so an undo across the change reverts
    // nothing and reports EVERY task as modified."
    const t = await create(U1, { title: 'qaapi5-old-record', due_at: TOMORROW_0900 });
    const sid = await openSession(U1);
    const turnId = uuid();
    await seedRaw({
      turns: [{
        id: turnId,
        session_id: sid,
        user_id: U1,
        seq: 99,
        client_turn_id: uuid(),
        status: 'applied',
        transcript_raw: 'qaapi5 seeded old-shape turn',
        source: 'voice',
        answer_to_turn_id: null,
        outcome: { kind: 'applied', changed_task_ids: [t.id], diff: [], created_titles: [], deleted_titles: [] },
        changed_task_ids: [t.id],
        diff: [{ task_id: t.id, field: 'title', old: 'qaapi5-old-title', new: t.title }],
        // BOTH records in the pre-F-005 shape — the whole point of the fixture
        undo_snapshot: [preF005Record(t, { title: 'qaapi5-old-title' })],
        post_apply: { [t.id]: preF005Record(t) },
        question: null,
        undo_result: null,
        created_ids: [],
        pending_op: null,
        caused_resolutions: [],
        created_at: T0,
        resolved_at: T0,
      }],
    }).expect(200);

    const res = await undoTurn(U1, turnId);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    // POST /assistant/turn/{id}/undo returns the UndoOutcome at the top level
    expect(res.body.undone).toBe(true);
    // NOT "every task reported modified": the absent keys compared equal
    expect(res.body.skipped).toEqual([]);
    expect(res.body.nothing_reverted).toBe(false);
    expect((res.body.reverted as { task_id: string }[]).map((r) => r.task_id)).toContain(t.id);
    // and the revert actually happened
    expect((await taskById(U1, t.id))?.title).toBe('qaapi5-old-title');
  });

  it('TC-24b ON REPLAY a field the stored record does not mention is left exactly as it is', async () => {
    // The opposite direction: "no value" is never written over a value the user
    // set. The live row carries a `note` and a `priority`; the record predates
    // both, so the revert must leave them alone rather than nulling them.
    const t = await create(U1, {
      title: 'qaapi5-replay-keeps', note: 'text the user typed', priority: 'high',
      due_at: TOMORROW_0900,
    });
    const sid = await openSession(U1);
    const turnId = uuid();
    await seedRaw({
      turns: [{
        id: turnId, session_id: sid, user_id: U1, seq: 99, client_turn_id: uuid(),
        status: 'applied', transcript_raw: 'qaapi5 seeded old-shape edit', source: 'voice',
        answer_to_turn_id: null,
        outcome: { kind: 'applied', changed_task_ids: [t.id], diff: [], created_titles: [], deleted_titles: [] },
        changed_task_ids: [t.id],
        diff: [{ task_id: t.id, field: 'title', old: 'qaapi5-before', new: t.title }],
        undo_snapshot: [preF005Record(t, { title: 'qaapi5-before' })],
        post_apply: { [t.id]: preF005Record(t) },
        question: null, undo_result: null, created_ids: [], pending_op: null,
        caused_resolutions: [], created_at: T0, resolved_at: T0,
      }],
    }).expect(200);

    await undoTurn(U1, turnId).expect(200);
    const after = await taskById(U1, t.id);
    expect(after!.title).toBe('qaapi5-before'); // the recorded field WAS replayed
    expect(after!.note).toBe('text the user typed'); // the unmentioned one was NOT unset
    expect(after!.priority).toBe('high');
  });

  it('TC-24c the stored record is NOT rewritten to the new shape — it is a past state', async () => {
    const t = await create(U1, { title: 'qaapi5-not-rewritten', due_at: TOMORROW_0900 });
    const sid = await openSession(U1);
    const turnId = uuid();
    await seedRaw({
      turns: [{
        id: turnId, session_id: sid, user_id: U1, seq: 99, client_turn_id: uuid(),
        status: 'applied', transcript_raw: 'qaapi5 seeded shape check', source: 'voice',
        answer_to_turn_id: null,
        outcome: { kind: 'applied', changed_task_ids: [t.id], diff: [], created_titles: [], deleted_titles: [] },
        changed_task_ids: [t.id], diff: [],
        undo_snapshot: [preF005Record(t, { title: 'qaapi5-was' })],
        post_apply: { [t.id]: preF005Record(t) },
        question: null, undo_result: null, created_ids: [], pending_op: null,
        caused_resolutions: [], created_at: T0, resolved_at: T0,
      }],
    }).expect(200);
    await get(U1, '/assistant/session').expect(200); // an ordinary read of history
    const stored = h.store.read(
      (s) => (s as unknown as Record<string, Record<string, Record<string, unknown>>>)['turns']![turnId]!,
    );
    const snap = (stored['undo_snapshot'] as Record<string, unknown>[])[0]!;
    expect(Object.keys(snap)).not.toContain('note');
    expect(Object.keys(snap)).not.toContain('due_all_day');
    expect(Object.keys(snap)).not.toContain('step_order');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-35 — a step is in no collection, in no count, and is not a handle
// ════════════════════════════════════════════════════════════════════════════

describe('TC-25 AC-35 a step is never offered to the interpreter as an addressable task', () => {
  it('TC-25a a task with EIGHT steps contributes exactly ONE handle', async () => {
    // "The handle list is the sharpest of the five": a task with eight steps
    // contributes nine handles today, so the assistant can rename, complete and
    // bulk-delete steps by name and read step titles aloud in a confirmation.
    const { parent, steps } = await parentWithSteps(U1, 8);
    expect(steps).toHaveLength(8);
    await postTurn(U1, 'qaapi5 something nobody has a rule for').expect(200);
    const ctx = h.fixtures.lastContext!;
    expect(ctx).not.toBeNull();
    const titles = ctx.tasks.map((c) => c.title);
    expect(titles).toContain(parent.title);
    for (const s of steps) expect(titles, `step offered as a handle: ${s.title}`).not.toContain(s.title);
    expect(ctx.tasks).toHaveLength(1);
  });

  it('TC-25b a turn that names a step title falls through — an assertion of ABSENCE', async () => {
    const { parent } = await parentWithSteps(U1, 2);
    // the fixture row for 'qaapi5 rename the step' resolves by TITLE against the
    // context it is handed. With steps excluded there is no handle to resolve,
    // so the only reachable outcome is a fall-through.
    const res = await postTurn(U1, 'qaapi5 rename the step').expect(200);
    expect(res.body.turn.outcome.kind).toBe('no_match');
    expect(res.body.turn.changed_task_ids).toEqual([]);
    expect(res.body.turn.diff).toEqual([]);
    const rows = await tasksOf(U1);
    expect(rows.find((r) => r.title === 'qaapi5-step-renamed')).toBeUndefined();
    expect(rows.filter((r) => r.parent_id === parent.id)).toHaveLength(2);
  });

  it('TC-25c an ORDINARY unfiled task is still a handle — the mutation guard AC-35 names', async () => {
    // "routing the exclusion through `isFiled` makes the collection half pass
    // while breaking INV-INBOX-FILING, so the case must ALSO assert that an
    // ordinary unfiled task is still in Inbox."
    const plain = await create(U1, { title: 'qaapi5-ordinary-inbox' });
    expect(plain.status).toBe('inbox');
    expect(plain.parent_id).toBeNull();
    await postTurn(U1, 'qaapi5 something nobody has a rule for').expect(200);
    expect(h.fixtures.lastContext!.tasks.map((c) => c.title)).toContain('qaapi5-ordinary-inbox');
  });

  it('TC-25d steps come back as ORDINARY ROWS on the wire, carrying parent_id and step_order', async () => {
    // "There is no nested representation on the wire; the client nests."
    const { parent, steps } = await parentWithSteps(U1, 3);
    const rows = await tasksOf(U1);
    expect(rows).toHaveLength(4);
    for (const s of steps) {
      const row = rows.find((r) => r.id === s.id)!;
      expect(row.parent_id).toBe(parent.id);
      expect(typeof row.step_order).toBe('number');
      expect(row).not.toHaveProperty('steps'); // no nesting
    }
    expect(rows.find((r) => r.id === parent.id)).not.toHaveProperty('steps');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-36 / AC-40 — the turn path: what may be set, and what binds the write
// ════════════════════════════════════════════════════════════════════════════

describe('TC-26 AC-36 the permitted half is a CAPABILITY, not a permission', () => {
  it('TC-26a one fixture row per permitted field on the EDIT path, each actually applied', async () => {
    // "an implementation that allowlists four fields and leaves every one
    // unreachable passes an AC that only grants permission."
    const cases: Array<[string, string, string, unknown]> = [
      ['qaapi5-note-target', 'qaapi5 set the note', 'note', 'from the assistant'],
      ['qaapi5-priority-target', 'qaapi5 set the priority', 'priority', 'medium'],
      ['qaapi5-due-target', 'qaapi5 set the due date', 'due_at', TOMORROW_0900],
      ['qaapi5-reminder-target', 'qaapi5 set the reminder', 'reminder_at', TOMORROW_0900],
    ];
    for (const [title, utterance, field, expected] of cases) {
      const t = await create(U1, { title });
      const res = await postTurn(U1, utterance).expect(200);
      expect(res.body.turn.outcome.kind, `${field}: ${JSON.stringify(res.body.turn.outcome)}`).toBe('applied');
      expect(res.body.turn.changed_task_ids).toContain(t.id);
      expect((res.body.turn.diff as { field: string }[]).map((d) => d.field), field).toContain(field);
      expect((await taskById(U1, t.id))![field], field).toEqual(expected);
    }
  });

  it('TC-26b one fixture row per permitted field on the CREATE path — the broken door', async () => {
    // "applyCreate hardcodes reminder_at: null and carries no note … so 'add a
    // task to call the dentist and remind me at nine' creates the task and
    // SILENTLY DROPS the reminder, with a diff that never mentions it.
    // Revision 2's wording is satisfied by an edit row alone, which is exactly
    // how the create half would have shipped green."
    const res = await postTurn(U1, 'qaapi5 add the dentist with a reminder').expect(200);
    expect(res.body.turn.outcome.kind).toBe('applied');
    const created = (await tasksOf(U1)).find((r) => r.title === 'qaapi5-call-the-dentist');
    expect(created).toBeDefined();
    expect(created!.note).toBe('ask about the crown');
    expect(created!.reminder_at).toBe(TOMORROW_0900);
    expect(created!.due_at).toBe(TOMORROW_0900);
    expect(created!.priority).toBe('high');
    // and the diff DESCRIBES the create completely (F-001 AC-2/AC-4)
    const fields = (res.body.turn.diff as { field: string }[]).map((d) => d.field);
    for (const f of ['title', 'note', 'due_at', 'reminder_at', 'priority']) {
      expect(fields, `create diff omits ${f}`).toContain(f);
    }
  });

  it('TC-26c the assistant can READ what it may write — note and reminder_at are in the context', async () => {
    const t = await create(U1, {
      title: 'qaapi5-context-read', note: 'the note it must be able to read',
      reminder_at: TOMORROW_0900,
    });
    await postTurn(U1, 'qaapi5 something nobody has a rule for').expect(200);
    const ctx = h.fixtures.lastContext!;
    const seen = ctx.tasks.find((c) => c.title === t.title) as unknown as Record<string, unknown>;
    expect(seen).toBeDefined();
    // "'push the reminder an hour later' has nothing to read today"
    expect(Object.keys(seen)).toContain('note');
    expect(Object.keys(seen)).toContain('reminder_at');
    expect(seen['note']).toBe('the note it must be able to read');
    expect(seen['reminder_at']).toBe(TOMORROW_0900);
  });
});

describe('TC-27 AC-36/AC-40 the refused turn — an outcome, not a silence', () => {
  /** Every refusal assertion in one place: the reason AND that nothing was written. */
  async function expectRefused(
    utterance: string,
    target: Task,
    expectedReason: string | null,
  ): Promise<Record<string, unknown>> {
    const before = await taskById(U1, target.id);
    const res = await postTurn(U1, utterance).expect(200);
    const outcome = res.body.turn.outcome as Record<string, unknown>;
    expect(outcome['kind'], `${utterance}: ${JSON.stringify(outcome)}`).toBe('refused');
    if (expectedReason !== null) expect(outcome['reason'], utterance).toBe(expectedReason);
    // the task is UNCHANGED …
    const after = await taskById(U1, target.id);
    expect(after, utterance).toEqual(before);
    // … it does NOT enter changed_task_ids …
    expect(res.body.turn.changed_task_ids, utterance).toEqual([]);
    // … no diff row is emitted …
    expect(res.body.turn.diff, utterance).toEqual([]);
    // … so no message can name a task and then fail to say what happened to it
    // (the F-001 AC-4 failure `## Impact` §1 exists to prevent), and the turn
    // never occupies or advances the undo window
    const undo = await undoTurn(U1, res.body.turn.id);
    expect(undo.status, utterance).toBe(409);
    expect(undo.body.error.code).toBe('UNDO_REFUSED');
    expect(undo.body.error.detail.reason).toBe('not_undoable');
    // and the turn's own status stays `applied` — the status machine is untouched
    expect(res.body.turn.status, utterance).toBe('applied');
    return outcome;
  }

  it('TC-27a a STRUCTURAL field attempted through the turn path is refused', async () => {
    // "The refused half must be expressible in order to be refused" — this is
    // reachable only because the AI-facing change shape carries these fields
    // and the write path refuses them at runtime, which is the choice AC-36
    // makes over a type-level impossibility.
    for (const utterance of [
      'qaapi5 make it a step',
      'qaapi5 move it to position two',
      'qaapi5 make this weekly',
    ]) {
      const t = await create(U1, { title: 'qaapi5-refuse-target' });
      const outcome = await expectRefused(utterance, t, null);
      expect(['structural_field_not_settable', 'repeat_on_step'], utterance)
        .toContain(outcome['reason']);
      await del(U1, `/tasks/${t.id}`).expect(200); // keep the title unique
    }
  });

  it('TC-27b a turn may NOT set reminder_shown_at — it would retire a reminder the user never saw', async () => {
    const t = await create(U1, { title: 'qaapi5-refuse-target', reminder_at: TOMORROW_0900 });
    await expectRefused('qaapi5 retire the reminder marker', t, null);
    expect((await taskById(U1, t.id))?.reminder_shown_at).toBeNull();
  });

  it('TC-27c AC-40 — one row per FIELD RULE, attempted through the turn path', async () => {
    // "Today taskChangesFrom holds 'title must be non-empty' … and it is called
    // ONLY from the HTTP handlers. applyEdit assigns straight onto the row, so
    // the turn path never calls any of it." A grep for the validator's name must
    // return both doors; this is the behavioural half of that.
    const rules: Array<[string, string]> = [
      ['qaapi5 clear the title', 'empty_title'],
      ['qaapi5 set the note to a number', 'note_not_text'],
      ['qaapi5 set priority to urgent', 'priority_not_in_set'],
    ];
    for (const [utterance, reason] of rules) {
      const t = await create(U1, { title: 'qaapi5-rule-target', note: 'kept', priority: 'low' });
      const outcome = await expectRefused(utterance, t, null);
      expect(typeof outcome['reason'], utterance).toBe('string');
      // the reason is one the contract enumerates, and names the right rule
      expect(
        ['empty_title', 'note_not_text', 'priority_not_in_set', 'length_exceeded'],
        `${utterance} → ${String(outcome['reason'])}`,
      ).toContain(outcome['reason']);
      expect(outcome['reason'], utterance).toBe(reason);
      await del(U1, `/tasks/${t.id}`).expect(200);
    }
  });

  it('TC-27c2 AC-40 — a rule that NORMALISES normalises at both doors, and is not a refusal', async () => {
    // AC-40's claim is "same rule, same rejected value; the outcome is stated
    // PER PATH" — not "every rule is a refusal". AC-6's rule for the note is a
    // normalisation (whitespace-only is stored as no note at all), and the
    // HTTP door performs it with a 200. So the turn door must perform the same
    // rule, not invent a refusal the HTTP door does not have. Asserting a
    // refusal here would have pinned a DIVERGENCE between the two doors, which
    // is the defect AC-40 exists to close, written backwards.
    const viaHttp = await create(U1, { title: 'qaapi5-normalise-http', note: 'kept' });
    const http = await patch(U1, `/tasks/${viaHttp.id}`, { note: '   \n ' }).expect(200);
    expect(http.body.task.note).toBeNull();
    expect(http.body.prior).toEqual({ note: 'kept' });

    const viaTurn = await create(U1, { title: 'qaapi5-rule-target', note: 'kept' });
    const turn = await postTurn(U1, 'qaapi5 blank the note').expect(200);
    expect(turn.body.turn.outcome.kind).toBe('applied');
    expect((await taskById(U1, viaTurn.id))?.note).toBeNull();
    // and the diff reports it as a clear, never as an empty string
    const row = (turn.body.turn.diff as { field: string; new: unknown }[]).find((d) => d.field === 'note')!;
    expect(row.new).toBeNull();
    expect(row.new).not.toBe('');
  });

  it('TC-27d clearing the due of a repeating task is refused on the TURN path too', async () => {
    const t = await create(U1, {
      title: 'qaapi5-repeating-target', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const outcome = await expectRefused('qaapi5 clear the due with a repeat', t, null);
    expect(outcome['reason']).toBe('clear_due_while_repeating');
    expect((await taskById(U1, t.id))?.due_at).toBe('2026-08-24T09:00:00.000Z');
  });

  it('TC-27e ONE LEGAL AND ONE ILLEGAL field in one change writes NOTHING AT ALL', async () => {
    // AC-18's whole-write scope, on the door AC-36 deliberately widens. "the
    // ordinary case now that four fields are speakable."
    const t = await create(U1, { title: 'qaapi5-rule-target', note: 'before' });
    const outcome = await expectRefused('qaapi5 set the note and clear the title', t, 'empty_title');
    expect(outcome['field']).toBe('title');
    const after = await taskById(U1, t.id);
    expect(after!.note).toBe('before'); // the LEGAL field was not written
    expect(after!.title).toBe('qaapi5-rule-target');
  });

  it('TC-27f the refusal carries a reason from the contract\'s closed list, and a field or null', async () => {
    const REASONS = new Set([
      'empty_title', 'priority_not_in_set', 'note_not_text', 'structural_field_not_settable',
      'step_not_addressable', 'nesting_too_deep', 'repeat_on_step', 'until_and_count',
      'end_before_due', 'clear_due_while_repeating', 'timezone_unknown', 'length_exceeded',
    ]);
    const t = await create(U1, { title: 'qaapi5-rule-target' });
    const res = await postTurn(U1, 'qaapi5 clear the title').expect(200);
    const o = res.body.turn.outcome as Record<string, unknown>;
    expect(o['kind']).toBe('refused');
    expect(REASONS.has(o['reason'] as string), String(o['reason'])).toBe(true);
    expect(Object.keys(o).sort()).toEqual(['field', 'kind', 'reason', 'task_id'].sort());
    expect(o['task_id']).toBe(t.id); // "the task the turn was about; unchanged"
    // the three excluded improvisations, by name
    expect(o['kind']).not.toBe('no_match'); // the task WAS matched
    expect(res.body.turn.status).not.toBe('failed'); // not a server fault
    expect(o['reason']).not.toBeUndefined(); // not "write nothing and say nothing"
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-38 — the reminder acknowledgement write
// ════════════════════════════════════════════════════════════════════════════

describe('TC-28 AC-38 the SERVER writes reminder_shown_at, on an acknowledgement the client sends', () => {
  it('TC-28a acknowledging sets the marker iff reminder_at matches, and reports acknowledged: true', async () => {
    const t = await create(U1, { title: 'qaapi5-ack', reminder_at: '2026-08-18T09:00:00.000Z' });
    expect(t.reminder_shown_at).toBeNull();
    const res = await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: t.reminder_at }).expect(200);
    expect(res.body.acknowledged).toBe(true);
    expect(res.body.task.reminder_shown_at).toBe(T0); // = now, the held instant
    expect(Object.keys(res.body).sort()).toEqual(['acknowledged', 'changed', 'task'].sort());
  });

  it('TC-28b an UNACKNOWLEDGED reminder reappears at every read; an acknowledged one is distinguishable', async () => {
    // AC-38's single falsifiable clause, and the whole reason it carries (api):
    // "an ACKNOWLEDGED reminder does not reappear on the next launch, on the
    // next device, or after a reload" — a server-persistence assertion
    // observable at no other layer. Revision 4 struck "surfaced once".
    const unacked = await create(U1, { title: 'qaapi5-unacked', reminder_at: '2026-08-18T09:00:00.000Z' });
    const acked = await create(U1, { title: 'qaapi5-acked', reminder_at: '2026-08-18T09:00:00.000Z' });
    await post(U1, `/tasks/${acked.id}/reminder-ack`, { reminder_at: acked.reminder_at }).expect(200);
    // "reminder_shown_at is carried on the wire, so a client can tell an
    // unacknowledged reminder from an acknowledged one without asking"
    const first = await tasksOf(U1);
    expect(first.find((r) => r.id === unacked.id)!.reminder_shown_at).toBeNull();
    expect(first.find((r) => r.id === acked.id)!.reminder_shown_at).not.toBeNull();
    // across a RELOAD — the durable store re-opened, which is the closest this
    // tier gets to "the next launch, the next device"
    await reopenStore().expect(200);
    const second = await tasksOf(U1);
    expect(second.find((r) => r.id === unacked.id)!.reminder_shown_at).toBeNull();
    expect(second.find((r) => r.id === acked.id)!.reminder_shown_at).not.toBeNull();
  });

  it('TC-28c a MOVED reminder is 409 REMINDER_MOVED, and nothing is written', async () => {
    // "the reminder was changed underneath and acknowledging the old instant
    // must not retire the new one."
    const t = await create(U1, { title: 'qaapi5-moved', reminder_at: '2026-08-18T09:00:00.000Z' });
    await patch(U1, `/tasks/${t.id}`, { reminder_at: '2026-08-21T09:00:00.000Z' }).expect(200);
    const res = await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: '2026-08-18T09:00:00.000Z' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REMINDER_MOVED');
    expect((await taskById(U1, t.id))?.reminder_shown_at).toBeNull(); // nothing written
    // acknowledging the CURRENT instant works
    const ok = await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: '2026-08-21T09:00:00.000Z' }).expect(200);
    expect(ok.body.acknowledged).toBe(true);
  });

  it('TC-28d acknowledging on a DONE or DELETED row is a no-op returning acknowledged: false', async () => {
    const done = await create(U1, { title: 'qaapi5-ack-done', reminder_at: '2026-08-18T09:00:00.000Z' });
    await patch(U1, `/tasks/${done.id}`, { status: 'done' }).expect(200);
    const r1 = await post(U1, `/tasks/${done.id}/reminder-ack`, { reminder_at: '2026-08-18T09:00:00.000Z' }).expect(200);
    expect(r1.body.acknowledged).toBe(false);
    expect(r1.body.task.reminder_shown_at).toBeNull();

    const gone = await create(U1, { title: 'qaapi5-ack-deleted', reminder_at: '2026-08-18T09:00:00.000Z' });
    await del(U1, `/tasks/${gone.id}`).expect(200);
    const r2 = await post(U1, `/tasks/${gone.id}/reminder-ack`, { reminder_at: '2026-08-18T09:00:00.000Z' }).expect(200);
    expect(r2.body.acknowledged).toBe(false);
  });

  it('TC-28e reminder_shown_at is writable through THIS DOOR AND NO OTHER', async () => {
    const t = await create(U1, { title: 'qaapi5-one-door', reminder_at: '2026-08-18T09:00:00.000Z' });
    const viaPatch = await patch(U1, `/tasks/${t.id}`, { reminder_shown_at: T0 });
    expect(viaPatch.status).toBe(400);
    expect(viaPatch.body.error.code).toBe('VALIDATION');
    expect(viaPatch.body.error.field).toBe('reminder_shown_at');
    const viaCreate = await post(U1, '/tasks', { title: 'qaapi5-create-marker', reminder_shown_at: T0 });
    expect(viaCreate.status).toBe(400);
    expect(viaCreate.body.error.field).toBe('reminder_shown_at');
    expect((await taskById(U1, t.id))?.reminder_shown_at).toBeNull();
  });

  it('TC-28f the ack door is scoped to the caller\'s rows: 404 across accounts, 401 without auth', async () => {
    const theirs = await create(U2, { title: 'qaapi5-their-reminder', reminder_at: '2026-08-18T09:00:00.000Z' });
    const cross = await post(U1, `/tasks/${theirs.id}/reminder-ack`, { reminder_at: theirs.reminder_at });
    expect(cross.status).toBe(404);
    expect(cross.body.error.code).toBe('NOT_FOUND');
    expect((await taskById(U2, theirs.id))?.reminder_shown_at).toBeNull(); // untouched
    const noAuth = await h.agent.post(`/tasks/${theirs.id}/reminder-ack`).send({ reminder_at: theirs.reminder_at });
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('UNAUTHENTICATED');
    const unknown = await post(U1, `/tasks/${uuid()}/reminder-ack`, { reminder_at: T0 });
    expect(unknown.status).toBe(404);
  });

  it('TC-28g reminder_at is REQUIRED on the ack body, and an unknown field is refused', async () => {
    const t = await create(U1, { title: 'qaapi5-ack-body', reminder_at: '2026-08-18T09:00:00.000Z' });
    const missing = await post(U1, `/tasks/${t.id}/reminder-ack`, {});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION');
    const extra = await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: t.reminder_at, force: true });
    expect(extra.status).toBe(400);
    expect(extra.body.error.code).toBe('VALIDATION');
    expect(extra.body.error.field).toBe('force');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-46 — a row the server causes belongs to the turn's undo record.
// Two STRUCTURALLY DISTINCT cases, not one parameterised over a shared setup,
// because the AC now states two rules and they are met by different mechanisms
// (ADR-013's per-class revert condition).
// ════════════════════════════════════════════════════════════════════════════

describe('TC-29 AC-46 a turn that completes a REPEATING task, then undone', () => {
  it('TC-29a the generated successor is in the turn\'s record and the undo removes it', async () => {
    // "A voice turn can set status: 'done' — status is in DIFF_FIELDS — so
    // undoing that turn would reopen the completed occurrence and leave the
    // successor standing: TWO OPEN OCCURRENCES of one series."
    const occ = await create(U1, {
      title: 'qaapi5-repeating-target', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const turn = await postTurn(U1, 'qaapi5 finish the repeating one').expect(200);
    expect(turn.body.turn.outcome.kind).toBe('applied');
    const succ = (await tasksOf(U1)).find((r) => r.series_id === occ.series_id && r.id !== occ.id);
    expect(succ, 'the turn generated no successor').toBeDefined();

    const undo = await undoTurn(U1, turn.body.turn.id).expect(200);
    expect(undo.body.undone).toBe(true);
    const after = await tasksOf(U1);
    // the occurrence is reopened …
    expect(after.find((r) => r.id === occ.id)!.status).not.toBe('done');
    // … and the successor is GONE, not left standing
    expect(after.find((r) => r.id === succ!.id)).toBeUndefined();
    expect(after.filter((r) => r.series_id === occ.series_id)).toHaveLength(1);
  });

  it('TC-29b a successor whose STEP the user worked on is NOT hard-deleted by the undo', async () => {
    // AC-46 + ADR-013: "undo removes a created row when taskEquals(current,
    // post_apply) — a whole-row comparison over ten scalars — and AC-28's fifth
    // condition is 'no step of it ticked or changed', which touches the STEP's
    // row and not the successor's. Left at the whole-row comparison, undo
    // hard-deletes a successor whose steps the user has worked on … and the
    // natural test for this AC passes."
    const occ = await create(U1, {
      title: 'qaapi5-repeating-target', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    await create(U1, { title: 'qaapi5-rt-step', parent_id: occ.id });
    const turn = await postTurn(U1, 'qaapi5 finish the repeating one').expect(200);
    const rows = await tasksOf(U1);
    const succ = rows.find((r) => r.series_id === occ.series_id && r.id !== occ.id && r.parent_id === null)!;
    const succStep = rows.find((r) => r.parent_id === succ.id)!;
    expect(succStep).toBeDefined();
    await advance(60_000).expect(200);
    await patch(U1, `/tasks/${succStep.id}`, { status: 'done' }).expect(200);

    const undo = await undoTurn(U1, turn.body.turn.id).expect(200);
    const after = await tasksOf(U1);
    // the successor STAYS — the case AC-28 exists to protect
    expect(after.find((r) => r.id === succ.id)).toBeDefined();
    // and it is reported, by its own title, in the skipped set
    const skippedTitles = (undo.body.skipped as { title?: string }[]).map((r) => r.title);
    expect(skippedTitles).toContain(succ.title);
    // never a step title — steps are neither drawn (AC-35) nor addressable
    expect(skippedTitles).not.toContain(succStep.title);
  });
});

describe('TC-30 AC-46 a turn that completes a PARENT, then undone', () => {
  it('TC-30a the cascaded steps are unticked, and NO STEP TITLE appears in the reverted message', async () => {
    // The case revision 3 could not have passed: AC-28's five conditions cannot
    // be satisfied by a cascade-ticked step BY CONSTRUCTION, so one rule over
    // both classes left every cascaded step un-reverted. Eight steps, because
    // "a voice 'done' on a parent with eight steps would render nine diff lines
    // naming step titles the user has never seen".
    const parent = await create(U1, { title: 'qaapi5-parent-target' });
    const steps: Task[] = [];
    for (let i = 1; i <= 8; i += 1) {
      steps.push(await create(U1, { title: `qaapi5-pt-step-${i}`, parent_id: parent.id }));
    }
    const turn = await postTurn(U1, 'qaapi5 finish the parent').expect(200);
    expect(turn.body.turn.outcome.kind).toBe('applied');
    const cascaded = await tasksOf(U1);
    for (const s of steps) {
      const row = cascaded.find((r) => r.id === s.id)!;
      expect(row.status).toBe('done');
      expect(row.completed_by_parent).toBe(true);
    }
    // ── the undo record covers what the TURN CAUSED …
    const undo = await undoTurn(U1, turn.body.turn.id).expect(200);
    expect(undo.body.undone).toBe(true);
    const after = await tasksOf(U1);
    expect(after.find((r) => r.id === parent.id)!.status).not.toBe('done');
    for (const s of steps) {
      const row = after.find((r) => r.id === s.id)!;
      expect(row.status, `${s.title} was left ticked by the undo`).not.toBe('done');
      expect(row.completed_by_parent).toBe(false);
    }
    // ── … while the MESSAGE covers what the user asked for. An assertion of
    //    absence: no step title anywhere in the reverted turn's outcome.
    const messageText = JSON.stringify({
      reverted: undo.body.reverted, skipped: undo.body.skipped,
    });
    for (const s of steps) {
      expect(messageText, `step title leaked into the reverted message: ${s.title}`)
        .not.toContain(s.title);
    }
    expect(messageText).toContain(parent.title); // the parent IS named
    // and the turn's own diff renders ONE line, not nine
    const diffTaskIds = new Set((turn.body.turn.diff as { task_id: string }[]).map((d) => d.task_id));
    expect(diffTaskIds.has(parent.id)).toBe(true);
    for (const s of steps) expect(diffTaskIds.has(s.id), s.title).toBe(false);
    expect(turn.body.turn.changed_task_ids).toEqual([parent.id]);
  });

  it('TC-30b a hand tick made BEFORE the turn survives the undo — the completed_by_parent guard', async () => {
    // "a step the user had already ticked before stays ticked". Read charitably
    // as whole-row replay with no guard, the undo reverts hand ticks the user
    // made — the case completed_by_parent exists to distinguish, and L-012's
    // shape.
    const parent = await create(U1, { title: 'qaapi5-parent-target' });
    const byHand = await create(U1, { title: 'qaapi5-pt-hand', parent_id: parent.id });
    const cascaded = await create(U1, { title: 'qaapi5-pt-cascade', parent_id: parent.id });
    await patch(U1, `/tasks/${byHand.id}`, { status: 'done' }).expect(200);
    const turn = await postTurn(U1, 'qaapi5 finish the parent').expect(200);
    await undoTurn(U1, turn.body.turn.id).expect(200);
    const after = await tasksOf(U1);
    expect(after.find((r) => r.id === byHand.id)!.status).toBe('done'); // kept
    expect(after.find((r) => r.id === cascaded.id)!.status).not.toBe('done'); // reverted
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-5 — a hand edit participates in F-001's undo contract unchanged
// ════════════════════════════════════════════════════════════════════════════

describe('TC-31 AC-5 a hand edit makes the task modified-since, and the undo names it', () => {
  it('TC-31a with updated_at HELD EQUAL, the edited field alone is what makes the task modified', async () => {
    // tester T8: "`task-equals`'s field list contains `updated_at`, so a hand
    // edit to ANY field is detected as modified-since whether or not the edited
    // field ever joined the comparison — the assertion passes for a reason
    // unrelated to what it claims (L-012). The proof is a case in which
    // `updated_at` is HELD EQUAL and the field alone differs."
    //
    // The clock seam is what makes that constructible: with the instant held,
    // the hand edit writes the same `updated_at` the turn did, so `updated_at`
    // cannot be the reason the comparison fails.
    const t = await create(U1, { title: 'qaapi5-undo-target', priority: 'low' });
    const turn = await postTurn(U1, 'qaapi5 note the undo target').expect(200);
    expect(turn.body.turn.outcome.kind).toBe('applied');
    const afterTurn = await taskById(U1, t.id);
    expect(afterTurn!.note).toBe('assistant note');

    // the hand edit: a DIFFERENT field, at the same held instant
    const edited = await patch(U1, `/tasks/${t.id}`, { priority: 'high' }).expect(200);
    expect(edited.body.task.updated_at).toBe(afterTurn!.updated_at); // HELD EQUAL
    expect(edited.body.task.priority).toBe('high');

    const undo = await undoTurn(U1, turn.body.turn.id).expect(200);
    // the task is SKIPPED and NAMED — F-001 AC-7's contract, unchanged
    expect((undo.body.skipped as { task_id: string; title: string }[]).map((r) => r.task_id)).toContain(t.id);
    expect((undo.body.skipped as { title: string }[]).map((r) => r.title)).toContain('qaapi5-undo-target');
    expect(undo.body.nothing_reverted).toBe(true); // it was the only task
    // and nothing was silently overwritten: the hand edit stands
    const after = await taskById(U1, t.id);
    expect(after!.priority).toBe('high');
    expect(after!.note).toBe('assistant note');
  });

  it('TC-31b an UNTOUCHED task is reverted, so TC-31a is not green for a trivial reason', async () => {
    // The control case. Without it, TC-31a would pass against an undo that
    // skips everything always.
    const t = await create(U1, { title: 'qaapi5-undo-target', priority: 'low' });
    const turn = await postTurn(U1, 'qaapi5 note the undo target').expect(200);
    const undo = await undoTurn(U1, turn.body.turn.id).expect(200);
    expect(undo.body.undone).toBe(true);
    expect(undo.body.skipped).toEqual([]);
    expect(undo.body.nothing_reverted).toBe(false);
    expect((await taskById(U1, t.id))?.note).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-20 — the repeat is a PICKER, not a sentence
// ════════════════════════════════════════════════════════════════════════════

describe('TC-32 AC-20 setting and clearing a repeat needs no AI', () => {
  it('TC-32a set, preview and clear a repeat with the AI-call counter frozen at zero', async () => {
    // "This repo has no model (map D1, ADR-001), so a spoken cadence has nothing
    // to interpret it. The picker is therefore the whole mechanism, not the
    // fallback." And AC-36 refuses a turn that tries — TC-27a.
    const before = h.ai.count;
    const t = await create(U1, { title: 'qaapi5-picker', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false });
    await post(U1, `/tasks/${t.id}/repeat-preview`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo',
    }).expect(200);
    const set = await patch(U1, `/tasks/${t.id}`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo',
    }).expect(200);
    expect(set.body.task.series_live).toBe(true);
    const cleared = await patch(U1, `/tasks/${t.id}`, {
      repeat_frequency: null, repeat_interval: null, repeat_weekdays: null,
    }).expect(200);
    expect(cleared.body.task.repeat_frequency).toBeNull();
    expect(cleared.body.task.series_live).toBe(false);
    expect(h.ai.count).toBe(before);
    expect((await h.agent.get('/__qa__/ai-calls').expect(200)).body.count).toBe(before);
  });

  it('TC-32b named cadences resolve into AC-21\'s rule set — "every weekday" is weekly on five days', async () => {
    // product F12: "Named cadences cost no model change; they are labels over
    // rules that already exist." The API's job is that the rule is expressible.
    const t = await create(U1, { title: 'qaapi5-weekdays', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false });
    const res = await patch(U1, `/tasks/${t.id}`, {
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo,tu,we,th,fr',
    }).expect(200);
    expect(res.body.task.repeat_weekdays).toBe('mo,tu,we,th,fr');
    expect(res.body.task.series_live).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Contract conformance, the error-code matrix, and the auth matrix on the two
// brand-new write paths
// ════════════════════════════════════════════════════════════════════════════

describe('TC-33 contract drift — the wire shape is exactly what the contract declares', () => {
  it('TC-33a every declared field is present on every row, and NO undocumented field is', async () => {
    // "A field present in the response but absent from api-contracts.md is an
    // information leak, not a feature."
    const { parent } = await parentWithSteps(U1, 1);
    await create(U1, {
      title: 'qaapi5-shape-repeat', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      note: 'n', priority: 'high', reminder_at: '2026-08-23T09:00:00.000Z',
      repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo,th',
    });
    const rows = await tasksOf(U1);
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      expect(Object.keys(row).sort(), row.title).toEqual(WIRE_FIELDS);
      for (const internal of INTERNAL_FIELDS) {
        expect(Object.keys(row), `${internal} leaked on ${row.title}`).not.toContain(internal);
      }
    }
    expect(parent.id).toBeTruthy();
  });

  it('TC-33b priority is never null on the wire, and series_live / completed_by_parent are never absent', async () => {
    const t = await create(U1, { title: 'qaapi5-never-null' });
    for (const row of [t, (await taskById(U1, t.id))!]) {
      expect(row.priority).toBe('none');
      expect(row.priority).not.toBeNull();
      expect(typeof row.series_live).toBe('boolean');
      expect(typeof row.completed_by_parent).toBe('boolean');
    }
  });

  it('TC-33c every mutating endpoint answers the declared envelope, and only that', async () => {
    const t = await create(U1, { title: 'qaapi5-envelopes' });
    const created = await post(U1, '/tasks', { title: 'qaapi5-envelope-create' }).expect(201);
    expect(Object.keys(created.body).sort()).toEqual(['changed', 'task'].sort());
    const patched = await patch(U1, `/tasks/${t.id}`, { title: 'qaapi5-envelopes-2' }).expect(200);
    expect(Object.keys(patched.body).sort()).toEqual(['changed', 'prior', 'task'].sort());
    const preview = await post(U1, `/tasks/${t.id}/repeat-preview`, { repeat_frequency: 'day', repeat_interval: 1 }).expect(200);
    expect(Object.keys(preview.body).sort()).toEqual(['created', 'due_all_day', 'due_at', 'moved', 'refusals'].sort());
    const deleted = await del(U1, `/tasks/${t.id}`).expect(200);
    expect(Object.keys(deleted.body).sort()).toEqual(['changed', 'task'].sort());
    const restored = await post(U1, `/tasks/${t.id}/restore`).expect(200);
    expect(Object.keys(restored.body).sort()).toEqual(['changed', 'restored', 'task'].sort());
  });

  it('TC-33d `removed` is present only when a row was HARD-removed, and carries ids', async () => {
    const plain = await create(U1, { title: 'qaapi5-no-removed' });
    const p = await patch(U1, `/tasks/${plain.id}`, { title: 'qaapi5-no-removed-2' }).expect(200);
    expect(p.body.removed ?? []).toEqual([]); // omitted when empty
    const occ = await create(U1, {
      title: 'qaapi5-has-removed', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const done = await patch(U1, `/tasks/${occ.id}`, { status: 'done' }).expect(200);
    const succ = (done.body.changed as Task[])[0]!;
    const un = await patch(U1, `/tasks/${occ.id}`, { status: 'inbox' }).expect(200);
    expect(un.body.removed).toEqual([succ.id]);
    expect(typeof (un.body.removed as string[])[0]).toBe('string');
  });

  it('TC-33e the server still has no opinion about collections (ADR-009)', async () => {
    // "F-005 does not move that boundary." `today` stays a rejected write value.
    const rejected = await post(U1, '/tasks', { title: 'qaapi5-today-status', status: 'today' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('VALIDATION');
    const rows = await tasksOf(U1);
    expect(rows).toHaveLength(0);
    const t = await create(U1, { title: 'qaapi5-no-collection', due_at: TODAY_START });
    expect(t).not.toHaveProperty('collection');
    expect(t.status).toBe('inbox');
  });
});

describe('TC-34 the error-code matrix, one case per declared code', () => {
  it('TC-34a 400 VALIDATION — every reason the contract enumerates', async () => {
    const live = await create(U1, { title: 'qaapi5-matrix-live' });
    const { steps } = await parentWithSteps(U1, 1);
    const repeating = await create(U1, {
      title: 'qaapi5-matrix-repeating', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const cases: Array<[string, () => Promise<{ status: number; body: any }>]> = [
      ['unknown field', () => post(U1, '/tasks', { title: 'qaapi5-x', colour: 'red' })],
      ['illegal field value', () => patch(U1, `/tasks/${live.id}`, { priority: 'urgent' })],
      ['parent_id not a live non-step row', () => post(U1, '/tasks', { title: 'qaapi5-x', parent_id: steps[0]!.id })],
      ['a step given a repeat', () => patch(U1, `/tasks/${steps[0]!.id}`, { repeat_frequency: 'week', repeat_interval: 1 })],
      ['a step given a parent', () => patch(U1, `/tasks/${steps[0]!.id}`, { parent_id: live.id })],
      ['until AND count', () => patch(U1, `/tasks/${repeating.id}`, { repeat_until: '2026-12-31', repeat_count: 3 })],
      ['until before the due date', () => patch(U1, `/tasks/${repeating.id}`, { repeat_until: '2026-08-01' })],
      ['clearing due_at while a repeat is set', () => patch(U1, `/tasks/${repeating.id}`, { due_at: null })],
      ['a bound exceeded', () => patch(U1, `/tasks/${live.id}`, { title: 'q'.repeat(501) })],
      ['scope=series on a row with no series', async () => h.agent.delete(`/tasks/${live.id}?scope=series`).set('X-User-Id', U1)],
      ['a non-creatable field', () => post(U1, '/tasks', { title: 'qaapi5-x', series_live: true })],
      ['a non-patchable field', () => patch(U1, `/tasks/${live.id}`, { series_id: uuid() })],
    ];
    for (const [label, run] of cases) {
      const res = await run();
      expect(res.status, label).toBe(400);
      expect(res.body.error.code, label).toBe('VALIDATION');
      expect(typeof res.body.error.message, label).toBe('string');
    }
  });

  it('TC-34b 409 TIMEZONE_UNKNOWN — on every write door that computes a date', async () => {
    const doors: Array<[string, (u: string) => Promise<{ status: number; body: any }>]> = [
      ['POST /tasks', (u) => h.zoneless.post('/tasks').set('X-User-Id', u).send({ title: 'qaapi5-tz', due_at: TOMORROW_0900 })],
      ['POST /tasks with a repeat', (u) => h.zoneless.post('/tasks').set('X-User-Id', u)
        .send({ title: 'qaapi5-tz2', due_at: TOMORROW_0900, repeat_frequency: 'week', repeat_interval: 1 })],
    ];
    for (const [label, run] of doors) {
      const fresh = uuid();
      const res = await run(fresh);
      expect(res.status, label).toBe(409);
      expect(res.body.error.code, label).toBe('TIMEZONE_UNKNOWN');
      expect(res.body.error.detail, label).toMatchObject({ header: 'X-Timezone' });
      // nothing written
      const after = await h.zoneless.get('/tasks').set('X-User-Id', fresh).expect(200);
      expect(after.body.tasks, label).toHaveLength(0);
    }
  });

  it('TC-34c 409 REMINDER_MOVED, and 409 TASK_ID_EXISTS', async () => {
    const t = await create(U1, { title: 'qaapi5-codes', reminder_at: TOMORROW_0900 });
    const moved = await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: '2026-01-01T00:00:00.000Z' });
    expect(moved.status).toBe(409);
    expect(moved.body.error.code).toBe('REMINDER_MOVED');
    const collide = await post(U1, '/tasks', { id: t.id, title: 'qaapi5-collide' });
    expect(collide.status).toBe(409);
    expect(collide.body.error.code).toBe('TASK_ID_EXISTS');
    expect((await taskById(U1, t.id))?.title).toBe('qaapi5-codes'); // never overwritten
  });

  it('TC-34d 401 UNAUTHENTICATED and 404 NOT_FOUND on every F-005 route', async () => {
    const mine = await create(U1, { title: 'qaapi5-auth-matrix' });
    const theirs = await create(U2, { title: 'qaapi5-auth-victim' });
    const probes: Array<[string, string, unknown?]> = [
      ['post', `/tasks/${mine.id}/restore`, {}],
      ['post', `/tasks/${mine.id}/reminder-ack`, { reminder_at: T0 }],
      ['post', `/tasks/${mine.id}/repeat-preview`, { repeat_frequency: 'day', repeat_interval: 1 }],
      ['get', '/account'],
      ['patch', '/account', { timezone: 'UTC' }],
    ];
    for (const [method, path, body] of probes) {
      const bare = await (h.agent as unknown as Record<string, (p: string) => TestAgent>)[method]!(path)
        .send(body as object);
      expect(bare.status, `bare ${method} ${path}`).toBe(401);
      expect(bare.body.error.code).toBe('UNAUTHENTICATED');
      const empty = await (h.agent as unknown as Record<string, (p: string) => TestAgent>)[method]!(path)
        .set('X-User-Id', '').send(body as object);
      expect(empty.status, `empty ${method} ${path}`).toBe(401);
    }
    // cross-account and unknown ids are indistinguishable — no enumeration
    for (const [label, id] of [["another account's row", theirs.id], ['an unknown uuid', uuid()]] as const) {
      for (const route of ['restore', 'reminder-ack', 'repeat-preview']) {
        const body = route === 'reminder-ack' ? { reminder_at: T0 }
          : route === 'repeat-preview' ? { repeat_frequency: 'day', repeat_interval: 1 } : {};
        const res = await post(U1, `/tasks/${id}/${route}`, body);
        expect(res.status, `${route} ${label}`).toBe(404);
        expect(res.body.error.code, `${route} ${label}`).toBe('NOT_FOUND');
      }
    }
    // the victim's row is intact
    expect((await taskById(U2, theirs.id))?.title).toBe('qaapi5-auth-victim');
  });
});

describe('TC-35 idempotency, concurrency, and the pinned contract inversion', () => {
  it('TC-35a POST /tasks now ACCEPTS reminder_at — the inversion the contract names', async () => {
    // "Contract inversion, deliberate and named so nobody weakens the assertion
    // instead: api/__tests__/tasks.test.ts:74 asserts that POST /tasks with
    // reminder_at returns 400 naming the field. That assertion must now be
    // inverted — it pins the gap F-005 closes."
    const res = await post(U1, '/tasks', { title: 'qaapi5-inversion', reminder_at: TOMORROW_0900 });
    expect(res.status).toBe(201);
    expect(res.body.task.reminder_at).toBe(TOMORROW_0900);
  });

  it('TC-35b restore and reminder-ack are idempotent — repeated calls create no second effect', async () => {
    const t = await create(U1, { title: 'qaapi5-idempotent', reminder_at: TOMORROW_0900 });
    await del(U1, `/tasks/${t.id}`).expect(200);
    const first = await post(U1, `/tasks/${t.id}/restore`).expect(200);
    const second = await post(U1, `/tasks/${t.id}/restore`).expect(200);
    expect(first.body.restored).toBe(true);
    expect(second.body.restored).toBe(false);
    expect((await tasksOf(U1)).filter((r) => r.id === t.id)).toHaveLength(1);

    const a1 = await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: TOMORROW_0900 }).expect(200);
    const a2 = await post(U1, `/tasks/${t.id}/reminder-ack`, { reminder_at: TOMORROW_0900 }).expect(200);
    expect(a1.body.acknowledged).toBe(true);
    expect(a2.body.task.reminder_shown_at).toBe(a1.body.task.reminder_shown_at);
  });

  it('TC-35c N concurrent completions of one repeating occurrence generate at most ONE successor', async () => {
    // The concurrency probe the agent definition asks for: the side effect must
    // happen exactly once, not N times. AC-26: "no occurrence generates a
    // second."
    const occ = await create(U1, {
      title: 'qaapi5-concurrent', due_at: '2026-08-24T09:00:00.000Z', due_all_day: false,
      repeat_frequency: 'week', repeat_interval: 1,
    });
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => patch(U1, `/tasks/${occ.id}`, { status: 'done' })),
    );
    for (const r of results) expect(r.status).toBe(200);
    const rows = await tasksOf(U1);
    expect(rows.filter((r) => r.series_id === occ.series_id)).toHaveLength(2); // occurrence + ONE successor
  });

  it('TC-35d a read reflects the write immediately — no stale cache', async () => {
    const t = await create(U1, { title: 'qaapi5-read-after-write' });
    await patch(U1, `/tasks/${t.id}`, { note: 'written', priority: 'high' }).expect(200);
    const back = await taskById(U1, t.id);
    expect(back!.note).toBe('written');
    expect(back!.priority).toBe('high');
  });

  it('TC-35e the repeat-preview writes NOTHING, however many times it is called', async () => {
    const t = await create(U1, { title: 'qaapi5-preview-pure', due_at: '2026-08-19T09:00:00.000Z' });
    const before = await taskById(U1, t.id);
    for (let i = 0; i < 3; i += 1) {
      await post(U1, `/tasks/${t.id}/repeat-preview`, {
        repeat_frequency: 'week', repeat_interval: 1, repeat_weekdays: 'mo,th',
      }).expect(200);
    }
    const after = await taskById(U1, t.id);
    expect(after).toEqual(before); // byte-identical: updated_at did not move
  });
});
