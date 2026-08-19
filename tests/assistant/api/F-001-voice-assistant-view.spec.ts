/**
 * F-001 voice-assistant-view — API integration suite (phase: execute)
 * Authored 2026-08-16 by qa-api-agent (T-007b, phase: author) from spec rev 3
 * + api-contracts.md + data-model.md + ADR-004/005/006. Every ASSERTION below
 * derives only from those documents, never from src/ — QA independence
 * (_qa-foundations §2).
 *
 * Wiring fixed 2026-08-16 (T-007b, phase: execute): the authoring draft
 * guessed at export names/shapes that didn't exist (store/memory.ts
 * createMemoryStore(), a nested `config:` deps object, a title-keyed
 * Interpreter). Reading src/assistant/api/{app,store/memory-store,ports/*}.ts
 * to fix the WIRING is explicitly in scope for phase: execute (orchestrator
 * bug report) — the real Interpreter port is handle-based (ADR-002: candidate
 * tasks arrive as opaque handles t1..tn, never uuids), so the fixture
 * interpreter below is a from-scratch implementation of that port, not a
 * port of the old title-keyed shim. See the run record at
 * qa/assistant/runs/ for what changed and why (script bugs vs product bugs).
 *
 * Runs in-process: an http.Server built from createApp(deps), bound to
 * 127.0.0.1 on an ephemeral port, driven by supertest — no external network.
 * Command: npx vitest run tests/assistant/api
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { randomUUID } from 'node:crypto';
import { createServer, globalAgent, type Server } from 'node:http';

// ───────────────────────────── WIRING ─────────────────────────────
// Real exports, verified 2026-08-16 by reading src/assistant/api/*.ts.
import { createApp, type AppDeps } from '../../../src/assistant/api/app.ts';
import { MemoryStore } from '../../../src/assistant/api/store/memory-store.ts';
import type { Store, StoreState } from '../../../src/assistant/api/store/store.ts';
import { FakeClock } from '../../../src/assistant/api/ports/clock.ts';
import type {
  AnswerClass,
  Interpretation,
  Interpreter,
  InterpreterContext,
} from '../../../src/assistant/api/ports/interpreter.ts';
import usersFixture from '../../../qa/_shared/fixtures/api/users.json';

const U1 = (usersFixture as any).users['QAAPI-U1'].x_user_id as string;
const U2 = (usersFixture as any).users['QAAPI-U2'].x_user_id as string;
const U3 = (usersFixture as any).users['QAAPI-U3'].x_user_id as string;

/** Simple normalization for fixture matching — independent of the engine's
 * own ADR-006 undo-phrase normalizer. The undo phrase ("undo" — the whole
 * closed list since ADR-006's amendment of 2026-08-17) never reaches this
 * interpreter at all: the real voice-undo guard (engine/normalize.ts)
 * intercepts it before interpretation is called, so this class needs no
 * undo-phrase handling of its own — TC-23/24/40's zero-AI-call assertions are
 * proven by the real guard, not simulated here.
 *
 * The retired phrase "hoàn tác" is the opposite case and is deliberately NOT
 * given a rule below: it now takes the ordinary turn path, so it must fall
 * through matchCommand() to the default `no_match`. TC-23's retirement test
 * asserts exactly that, and it would silently stop asserting it if a rule for
 * the phrase were ever added here. */
const normalize = (s: string): string => s.trim().toLowerCase();

/**
 * QA's fixture Interpreter (phase: execute wiring). Implements the real
 * Interpreter port directly, handle-based per ADR-002. Rule-matched by regex
 * against the transcript patterns this suite's TCs send; every utterance and
 * its expected interpretation is documented in the canonical fixture table
 * qa/assistant/F-001/api/utterance-intent-fixtures.json (unchanged) — this
 * class is the runtime realization of those same rows against a real
 * per-turn handle context, which the static JSON can't resolve on its own.
 * The stub replaces MODEL INTERPRETATION ONLY, including answer
 * classification (spec, Test strategy); orchestration, gating, persistence,
 * dedupe and undo all run real in src/assistant/api/engine/.
 */
class QaFixtureInterpreter implements Interpreter {
  calls = 0;
  latencyMs = 0;
  /** utterance (normalized) → forced Interpretation, for late-success retries (TC-26). */
  readonly overrides = new Map<string, Interpretation>();

  async interpret(ctx: InterpreterContext): Promise<Interpretation> {
    this.calls += 1;
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));

    const raw = ctx.transcript.trim();
    const norm = normalize(raw);

    const override = this.overrides.get(norm);
    if (override !== undefined) return override;

    if (norm === 'qaapi trigger model failure') {
      throw new Error('qaapi injected interpreter failure');
    }

    if (ctx.question !== null) {
      const answer = this.classifyAnswer(norm, ctx);
      if (answer !== null) return answer;
    }

    const command = this.matchCommand(raw, ctx.tasks);
    if (command !== null) return command;

    return { kind: 'no_match' };
  }

  /** Only reached when a question is bound. Returns null (not unclassifiable)
   * for anything that isn't a recognized answer, so the caller falls through
   * to command matching — that's what lets an unrelated command supersede a
   * pending question (D2, TC-07), and what makes a genuinely ambiguous
   * utterance land on the default no_match → engine's `unclassifiable`
   * outcome (TC-08) instead of being force-classified here. */
  private classifyAnswer(norm: string, ctx: InterpreterContext): Interpretation | null {
    const q = ctx.question!;
    const optIdx = q.options.findIndex((o) => normalize(o) === norm);
    if (optIdx !== -1) {
      if (q.kind === 'bulk_delete') {
        const type: AnswerClass['type'] = optIdx === 0 ? 'affirmative' : 'negative';
        return { kind: 'answer', answer: { type } as AnswerClass };
      }
      // clarify: the option text IS the candidate's title — resolve to its handle
      const target = ctx.tasks.find((t) => normalize(t.title) === norm);
      return {
        kind: 'answer',
        answer:
          target !== undefined
            ? { type: 'selection', handle: target.handle }
            : { type: 'unclassifiable' },
      };
    }
    if (['yes', 'ok', 'ừ', 'đúng vậy, xoá đi'].includes(norm)) {
      return { kind: 'answer', answer: { type: 'affirmative' } };
    }
    if (['no', 'không'].includes(norm)) {
      return { kind: 'answer', answer: { type: 'negative' } };
    }
    return null;
  }

  private matchCommand(text: string, tasks: InterpreterContext['tasks']): Interpretation | null {
    const findExact = (title: string) => {
      const want = normalize(title);
      return tasks.find((t) => normalize(t.title) === want);
    };
    const findByPrefix = (prefix: string) =>
      tasks.filter((t) => t.title.toLowerCase().startsWith(prefix));

    let m: RegExpExecArray | null;

    if ((m = /^rename #d1 to (.+)$/i.exec(text)) !== null) {
      const target = findExact('qaapi-draft-report');
      return target !== undefined
        ? { kind: 'edit', edits: [{ handle: target.handle, changes: { title: m[1]!.trim() } }] }
        : { kind: 'no_match' };
    }
    if ((m = /^rename (.+) to (.+)$/i.exec(text)) !== null) {
      const target = findExact(m[1]!);
      return target !== undefined
        ? { kind: 'edit', edits: [{ handle: target.handle, changes: { title: m[2]!.trim() } }] }
        : { kind: 'no_match' };
    }
    if ((m = /^mark (.+) done$/i.exec(text)) !== null) {
      const target = findExact(m[1]!);
      return target !== undefined
        ? { kind: 'edit', edits: [{ handle: target.handle, changes: { status: 'done' } }] }
        : { kind: 'no_match' };
    }
    if (/^add a task (.+)$/i.test(text)) {
      const title = text.replace(/^add a task /i, '').trim();
      return { kind: 'create', tasks: [{ title }] };
    }
    if (/^add (.+)$/i.test(text)) {
      const rest = text.replace(/^add /i, '').trim();
      const titles = rest
        .split(/,\s*| and /i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return { kind: 'create', tasks: titles.map((title) => ({ title })) };
    }
    if (/^delete all my qaapi shopping tasks$/i.test(text)) {
      return { kind: 'delete', handles: findByPrefix('qaapi-shop-').map((t) => t.handle) };
    }
    if (/^delete both qaapi report tasks$/i.test(text)) {
      return { kind: 'delete', handles: findByPrefix('qaapi-report-').map((t) => t.handle) };
    }
    if (/^delete the report task$/i.test(text)) {
      return {
        kind: 'clarify',
        handles: findByPrefix('qaapi-report-').map((t) => t.handle),
        pending_op: { op: 'delete' },
      };
    }
    if (/^delete the unicorn task$/i.test(text)) {
      return { kind: 'no_match' };
    }
    if ((m = /^delete (qaapi-[\w-]+)$/i.exec(text)) !== null) {
      const target = findExact(m[1]!);
      return { kind: 'delete', handles: target !== undefined ? [target.handle] : [] };
    }
    if (/^what'?s on sunday\??$/i.test(text)) {
      return { kind: 'query' };
    }
    return null;
  }
}

/** Store fault injector for TC-02: fail the Nth write to state.tasks inside a
 * single transact() call. Proves mid-apply failures leave zero partial
 * writes — MemoryStore.transact clones state into a draft and only swaps it
 * in on a normal return, so any throw (from our proxy or otherwise) discards
 * every write the callback made, including ones before the injected fault. */
class QaFaultStore implements Store {
  private readonly inner: MemoryStore;
  private armed = false;
  private failOnWrite = 0;
  private writes = 0;

  constructor(inner: MemoryStore) {
    this.inner = inner;
  }

  arm(failOnWrite: number): void {
    this.armed = true;
    this.failOnWrite = failOnWrite;
    this.writes = 0;
  }

  disarm(): void {
    this.armed = false;
  }

  read<T>(fn: (state: StoreState) => T): T {
    return this.inner.read(fn);
  }

  transact<T>(fn: (state: StoreState) => T): T {
    return this.inner.transact((state) => {
      if (!this.armed) return fn(state);
      const bump = (): void => {
        this.writes += 1;
        if (this.writes === this.failOnWrite) {
          throw new Error('qaapi injected store fault');
        }
      };
      const tasksProxy = new Proxy(state.tasks, {
        set: (target, prop, value) => {
          bump();
          return Reflect.set(target, prop, value);
        },
        deleteProperty: (target, prop) => {
          bump();
          return Reflect.deleteProperty(target, prop);
        },
      });
      const stateProxy = new Proxy(state, {
        get: (target, prop) => (prop === 'tasks' ? tasksProxy : Reflect.get(target, prop)),
      });
      return fn(stateProxy);
    });
  }
}

interface Harness {
  app: Server; // already-listening http.Server — supertest uses its bound address directly
  ai: QaFixtureInterpreter;
  clock: FakeClock;
  store: QaFaultStore;
  /**
   * The suite's default client. Carries `X-Timezone: UTC` on EVERY request.
   *
   * Why (T-166): ADR-010 / F-005 AC-44 made the account timezone the one
   * source every date computation reads, and a date computation with no zone
   * is `409 TIMEZONE_UNKNOWN`. `recordClientZone` runs in the auth step of
   * every request, so one header on one request establishes the account's zone
   * for the process — but this suite creates a fresh store per test, so every
   * test needs it. TC-14 and TC-17 (both seed a `due_at`) went red on exactly
   * that: `expected 201, got 409`.
   *
   * It is a default header on the agent rather than ~200 per-call `.set()`
   * edits because the zone is a property of the CLIENT, not of any one
   * request: supertest's `request(server)` has no such hook and
   * `request.agent(server)` does (superagent `Agent._setDefaults`). A per-call
   * fix would also have to be re-applied by every case added afterwards, and
   * the failure mode of forgetting is a 409 that looks like a product bug.
   */
  agent: TestAgent;
  /**
   * A deliberately ZONELESS client — no `X-Timezone`, ever.
   *
   * It exists because the fix above would otherwise make `409
   * TIMEZONE_UNKNOWN` unassertable everywhere in this suite: once every
   * request carries a zone, no request can observe the refusal, and a
   * regression that dropped the refusal entirely would go unnoticed. Keeping
   * one zoneless door means the refusal is asserted ON PURPOSE (see the guard
   * case at the end of the auth/validation block) rather than by accident.
   *
   * It must not be used for ordinary seeding: a zoneless request whose
   * computation needs a zone is refused, which is the whole point.
   */
  zoneless: TestAgent;
}

// Avoid a documented class of Node/supertest flake: passing supertest a bare
// RequestListener makes it call http.createServer(listener).listen(0) PER
// REQUEST, leaking one never-closed server per call; combined with Node's
// pooled keep-alive agent, a later test's request can land on a stale
// server bound to a since-reused ephemeral port. Fix: build exactly ONE
// already-listening server per test (below) and disable the pooling agent
// that makes stale sockets outlive their server.
(globalAgent as unknown as { keepAlive: boolean; options: { keepAlive?: boolean } }).keepAlive =
  false;
(globalAgent as unknown as { options: { keepAlive?: boolean } }).options.keepAlive = false;

async function makeHarness(): Promise<Harness> {
  const ai = new QaFixtureInterpreter();
  const clock = new FakeClock('2026-08-16T09:00:00.000Z');
  const store = new QaFaultStore(new MemoryStore());
  const deps: AppDeps = { store, interpreter: ai, clock, idleCloseMs: 180_000 };
  const server = createServer(createApp(deps));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  // See the Harness doc comments: the default agent carries the zone, the
  // zoneless one deliberately does not.
  const agent = request.agent(server).set('X-Timezone', 'UTC');
  const zoneless = request.agent(server);
  return { app: server, ai, clock, store, agent, zoneless };
}

// ───────────────────────────── helpers ─────────────────────────────

const uuid = (): string => randomUUID();

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const DRAFT_REF_RE = /#d\d+/;

let h: Harness;
beforeEach(async () => {
  h = await makeHarness(); // isolated store per test — parallel-safe by construction (§10)
});
afterEach(
  () =>
    new Promise<void>((resolve) => {
      h.app.closeAllConnections(); // no socket survives its server
      h.app.close(() => resolve());
    }),
);

const postTurn = (uid: string, body: Record<string, unknown>) =>
  h.agent.post('/assistant/turn').set('X-User-Id', uid).send(body);

const turn = (transcript: string, extra: Record<string, unknown> = {}) => ({
  session_id: null,
  client_turn_id: uuid(),
  transcript,
  source: 'voice',
  ...extra,
});

const getSession = (uid: string) => h.agent.get('/assistant/session').set('X-User-Id', uid);
const getTasks = async (uid: string) => {
  const res = await h.agent.get('/tasks').set('X-User-Id', uid).expect(200);
  return res.body.tasks as any[];
};
const seedTask = async (uid: string, fields: Record<string, unknown>) => {
  const res = await h.agent.post('/tasks').set('X-User-Id', uid).send(fields).expect(201);
  return res.body.task as any;
};
const undoTurn = (uid: string, turnId: string, via: 'tap' | 'voice' = 'tap') =>
  h.agent.post(`/assistant/turn/${turnId}/undo`).set('X-User-Id', uid).send({ via });
const closeSession = (uid: string, sessionId: string) =>
  h.agent
    .post('/assistant/session/close')
    .set('X-User-Id', uid)
    .send({ session_id: sessionId, reason: 'user_closed' });

/** Seed the 3 shop tasks + fire the bulk-delete question. Returns asked-turn info. */
async function pendingBulkDelete(uid: string) {
  for (const t of ['qaapi-shop-eggs', 'qaapi-shop-bread', 'qaapi-shop-cheese'])
    await seedTask(uid, { title: t });
  const res = await postTurn(uid, turn('delete all my qaapi shopping tasks')).expect(200);
  expect(res.body.turn.status).toBe('asked');
  return { qid: res.body.turn.id as string, sid: res.body.session_id as string, res };
}

/** All string values of assistant-RENDERED fields (never transcript_raw — the
 * user's own words legitimately echo, TC-36). */
function renderedStrings(node: any, out: string[] = [], key = ''): string[] {
  const RENDER_KEYS = new Set([
    'task_titles', 'options', 'heard_transcript', 'created_titles', 'deleted_titles',
    'alternative', 'title', 'message',
  ]);
  if (typeof node === 'string') {
    if (RENDER_KEYS.has(key)) out.push(node);
  } else if (Array.isArray(node)) {
    node.forEach((v) => renderedStrings(v, out, key));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) if (k !== 'transcript_raw' && k !== 'transcript') renderedStrings(v, out, k);
  }
  return out;
}

// ───────────────────────────── TC-01/02/03/04 — apply, atomicity, gate ─────────────────────────────

describe('AC-1 apply atomicity (TC-01, TC-02)', () => {
  it('TC-01 applying turn lands atomically and read-back returns it', async () => {
    const res = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
    expect(res.body.kind).toBe('turn');
    expect(res.body.replayed).toBe(false);
    expect(res.body.turn.status).toBe('applied');
    expect(res.body.turn.outcome.kind).toBe('applied');
    expect(res.body.turn.changed_task_ids).toHaveLength(1);
    for (const d of res.body.turn.diff) expect(d.old).toBeNull(); // create ⇒ old=null
    const tasks = await getTasks(U1);
    expect(tasks.filter((t) => t.title === 'qaapi-buy-milk')).toHaveLength(1);
    expect(tasks[0].id).toBe(res.body.turn.changed_task_ids[0]);
  });

  it('TC-02 mid-apply store fault leaves ZERO of 3 tasks; clean retry same id applies all 3', async () => {
    h.store.arm(2); // fail the 2nd task write inside the single apply-phase transaction
    const id1 = uuid();
    const body = turn('add qaapi-pack-bags, qaapi-book-taxi and qaapi-print-tickets', { client_turn_id: id1 });
    const failed = await postTurn(U1, body).expect(500); // pinned: 500 APPLY_FAILED (contract rule 6)
    expect(failed.body.error.code).toBe('APPLY_FAILED');
    expect(failed.body.turn.status).toBe('failed'); // atomic abort, turn resolves failed
    expect(failed.body.turn.transcript_raw).toBe('add qaapi-pack-bags, qaapi-book-taxi and qaapi-print-tickets'); // AC-23
    const after = await getTasks(U1);
    expect(after.filter((t) => String(t.title).startsWith('qaapi-'))).toHaveLength(0); // all-or-nothing
    h.store.disarm();
    const retry = await postTurn(U1, body).expect(200); // failed → pending re-attempt (AC-16)
    expect(retry.body.turn.status).toBe('applied');
    expect((await getTasks(U1)).filter((t) => String(t.title).startsWith('qaapi-'))).toHaveLength(3);
  });
});

describe('AC-9 bulk-delete gate (TC-03, TC-04)', () => {
  it('TC-03 bulk delete asks, names count+titles, applies NOTHING', async () => {
    const { res } = await pendingBulkDelete(U1);
    const q = res.body.turn.question;
    expect(q.kind).toBe('bulk_delete');
    expect(q.task_titles).toEqual(
      expect.arrayContaining(['qaapi-shop-eggs', 'qaapi-shop-bread', 'qaapi-shop-cheese']),
    );
    expect(q.options.length).toBeGreaterThan(0);
    expect(res.body.turn.changed_task_ids).toEqual([]);
    expect(res.body.turn.diff).toEqual([]);
    expect(await getTasks(U1)).toHaveLength(3); // zero mutation (AC-1 carve-out)
  });

  it('TC-03 boundary: exactly 2 targets already gates', async () => {
    await seedTask(U1, { title: 'qaapi-report-q3' });
    await seedTask(U1, { title: 'qaapi-report-q4' });
    const res = await postTurn(U1, turn('delete both qaapi report tasks')).expect(200);
    expect(res.body.turn.status).toBe('asked');
    expect(res.body.turn.question.kind).toBe('bulk_delete');
  });

  it('TC-04 single-task delete applies immediately, named by title, undoable', async () => {
    await seedTask(U1, { title: 'qaapi-buy-milk' });
    const res = await postTurn(U1, turn('delete qaapi-buy-milk')).expect(200);
    expect(res.body.turn.status).toBe('applied');
    expect(res.body.turn.outcome.deleted_titles).toEqual(['qaapi-buy-milk']);
    expect((await getTasks(U1)).find((t) => t.title === 'qaapi-buy-milk')).toBeUndefined();
    const undo = await undoTurn(U1, res.body.turn.id).expect(200);
    expect(undo.body.reverted.map((r: any) => r.title)).toEqual(['qaapi-buy-milk']);
    expect((await getTasks(U1)).find((t) => t.title === 'qaapi-buy-milk')).toBeDefined();
  });
});

// ───────────────────────────── TC-05..11 — D2 resolution ─────────────────────────────

describe('AC-10/AC-12 question resolution (TC-05..TC-11)', () => {
  it('TC-05 affirmative executes with full anatomy; resolution recorded one-shot', async () => {
    const { qid, sid } = await pendingBulkDelete(U1);
    const res = await postTurn(U1, turn('yes', { session_id: sid })).expect(200);
    expect(res.body.turn.outcome.kind).toBe('resolution');
    expect(res.body.turn.outcome.result).toBe('executed');
    expect(res.body.resolutions).toEqual([{ question_turn_id: qid, result: 'executed' }]);
    expect(res.body.turn.outcome.executed.deleted_titles).toHaveLength(3);
    expect(await getTasks(U1)).toHaveLength(0);
    const sess = await getSession(U1).expect(200);
    const asked = sess.body.session.messages.find((m: any) => m.id === qid);
    expect(asked.question.resolution.result).toBe('executed');
  });

  it('TC-06 negative declines — zero deletion, visible outcome', async () => {
    const { qid, sid } = await pendingBulkDelete(U1);
    const res = await postTurn(U1, turn('no', { session_id: sid })).expect(200);
    expect(res.body.resolutions).toEqual([{ question_turn_id: qid, result: 'declined' }]);
    expect(res.body.turn.outcome.executed).toBeUndefined();
    expect(await getTasks(U1)).toHaveLength(3);
  });

  it('TC-07 unrelated command supersedes AND proceeds', async () => {
    const { qid, sid } = await pendingBulkDelete(U1);
    const res = await postTurn(U1, turn('add a task qaapi-call-dentist', { session_id: sid })).expect(200);
    expect(res.body.turn.status).toBe('applied'); // the command proceeded
    expect(res.body.resolutions).toEqual([{ question_turn_id: qid, result: 'declined_superseded' }]);
    const tasks = await getTasks(U1);
    expect(tasks.find((t) => t.title === 'qaapi-call-dentist')).toBeDefined();
    expect(tasks.filter((t) => String(t.title).startsWith('qaapi-shop-'))).toHaveLength(3); // delete never ran
  });

  it('TC-08 unclassifiable answers execute NOTHING; question stays pending, then still resolvable', async () => {
    const { qid, sid } = await pendingBulkDelete(U1);
    for (const u of ['hmm maybe', 'what do you mean']) {
      const res = await postTurn(U1, turn(u, { session_id: sid })).expect(200);
      expect(res.body.turn.outcome.kind).toBe('unclassifiable');
      expect(res.body.turn.outcome.question_turn_id).toBe(qid);
      expect(res.body.resolutions).toEqual([]);
      expect(await getTasks(U1)).toHaveLength(3); // ZERO deletion — the spec-mandated assertion
    }
    const sess = await getSession(U1).expect(200);
    expect(sess.body.session.messages.find((m: any) => m.id === qid).question.resolution).toBeNull();
    const yes = await postTurn(U1, turn('yes', { session_id: sid })).expect(200); // still resolvable
    expect(yes.body.turn.outcome.result).toBe('executed');
    expect(await getTasks(U1)).toHaveLength(0);
  });

  it('TC-09 late answer never executes — already_resolved; record immutable', async () => {
    const { qid, sid } = await pendingBulkDelete(U1);
    // capture the question's own literal option text BEFORE it resolves — a
    // tap always sends the option verbatim (ethos §9: never invented text)
    const sessBefore = await getSession(U1).expect(200);
    const affirmativeOption = sessBefore.body.session.messages.find((m: any) => m.id === qid)
      .question.options[0];
    await postTurn(U1, turn('no', { session_id: sid })).expect(200); // resolve: declined
    // Script-fix (T-007b phase:execute triage): a voice/typed answer binds to
    // "the newest UNRESOLVED question" (AC-10) — once qid is the only question
    // and it's resolved, there is by definition no unresolved question left to
    // bind a bare "yes" to, so a contextless late voice answer falls through
    // to normal interpretation (no_match) rather than already_resolved. The
    // already-resolved race is only reachable through an EXPLICIT binding —
    // which is exactly what a tap always carries (api-contracts.md request
    // schema: "tap answers only: explicit binding to the question's turn").
    // This TC now exercises that path; TC-10 covers the same explicit-binding
    // mechanism for a still-unresolved older question.
    const late = await postTurn(
      U1,
      turn(affirmativeOption, { session_id: sid, source: 'tap', answer_to_turn_id: qid }),
    ).expect(200);
    expect(late.body.turn.outcome.result).toBe('already_resolved');
    expect(late.body.turn.outcome.executed).toBeUndefined();
    expect(await getTasks(U1)).toHaveLength(3); // the late tap deleted NOTHING
    const sess = await getSession(U1).expect(200);
    expect(sess.body.session.messages.find((m: any) => m.id === qid).question.resolution.result).toBe('declined');
  });

  it('TC-10 serial receipt order; explicit tap binding executes after an unclassifiable non-supersede', async () => {
    // Script-fix (T-007b phase:execute triage): the original scenario tried to
    // hold TWO simultaneously-pending questions (Q1 bulk_delete, Q2 clarify)
    // by asking Q2 while Q1 was still unresolved. That's not achievable: D2's
    // own rule ("any unrelated new command supersedes the question") applies
    // to Q2's own creation too, since asking a new question is itself an
    // unrelated interpretable command — so Q1 is superseded the instant Q2 is
    // asked. The original assertion (`resolutions[0].question_turn_id === q1`)
    // didn't check `result`, so it passed either way — a false green that hid
    // the mismatch (Q1 landed on already_resolved, not executed). Re-read
    // against AC-10/D2: the spec consistently frames "the pending question" as
    // singular, so this is a test-authoring gap, not a product bug — the real
    // engine's supersede behavior is contractually correct.
    // Rewritten to test what IS achievable and still valuable: an
    // UNCLASSIFIABLE utterance does NOT supersede (distinct from an
    // interpretable command, TC-07/TC-08's distinction applied here), so an
    // explicit tap binding sent afterward still reaches the same, still-only,
    // still-pending question and genuinely executes it.
    const { qid: q1, sid } = await pendingBulkDelete(U1);
    const amb = await postTurn(U1, turn('hmm maybe', { session_id: sid })).expect(200);
    expect(amb.body.turn.outcome.kind).toBe('unclassifiable'); // does NOT supersede
    const sess = await getSession(U1).expect(200);
    const q1row = sess.body.session.messages.find((m: any) => m.id === q1);
    expect(q1row.question.resolution).toBeNull(); // still genuinely pending
    const affirmativeOption = q1row.question.options[0]; // literal text, never invented
    const tap = await postTurn(U1, turn(affirmativeOption, { session_id: sid, source: 'tap', answer_to_turn_id: q1 })).expect(200);
    expect(tap.body.resolutions[0]).toEqual({ question_turn_id: q1, result: 'executed' });
    expect(await getTasks(U1)).toHaveLength(0);
    // seq strictly increasing in receipt order
    const seqs = (await getSession(U1).expect(200)).body.session.messages.map((m: any) => m.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
  });

  it('TC-10 concurrent distinct turns all apply exactly once, serially', async () => {
    const bodies = [1, 2, 3].map(() => turn('add a task qaapi-buy-milk'));
    const results = await Promise.all(bodies.map((b) => postTurn(U1, b)));
    results.forEach((r) => expect(r.status).toBe(200));
    expect((await getTasks(U1)).filter((t) => t.title === 'qaapi-buy-milk')).toHaveLength(3);
  });

  it('TC-11 affirmative re-validates against ask-time snapshot: changed/deleted dropped, actual count named', async () => {
    const { sid } = await pendingBulkDelete(U1);
    const tasks = await getTasks(U1);
    const bread = tasks.find((t) => t.title === 'qaapi-shop-bread');
    const cheese = tasks.find((t) => t.title === 'qaapi-shop-cheese');
    await h.agent.patch(`/tasks/${bread.id}`).set('X-User-Id', U1).send({ title: 'qaapi-shop-bread-URGENT' }).expect(200);
    await h.agent.delete(`/tasks/${cheese.id}`).set('X-User-Id', U1).expect(200);
    const yes = await postTurn(U1, turn('yes', { session_id: sid })).expect(200);
    expect(yes.body.turn.outcome.result).toBe('executed');
    expect(yes.body.turn.outcome.executed.deleted_titles).toEqual(['qaapi-shop-eggs']); // actual count 1
    const after = await getTasks(U1);
    expect(after.find((t) => t.title === 'qaapi-shop-bread-URGENT')).toBeDefined(); // changed task NOT deleted
  });
});

describe('AC-13 clarification (TC-12)', () => {
  it('TC-12 ambiguous reference → clarify with real candidates; tap answer executes chosen only', async () => {
    await seedTask(U1, { title: 'qaapi-report-q3' });
    await seedTask(U1, { title: 'qaapi-report-q4' });
    const res = await postTurn(U1, turn('delete the report task')).expect(200);
    const q = res.body.turn.question;
    expect(q.kind).toBe('clarify');
    expect(q.task_titles).toEqual(expect.arrayContaining(['qaapi-report-q3', 'qaapi-report-q4']));
    expect(await getTasks(U1)).toHaveLength(2); // nothing changed until answered
    const tap = await postTurn(U1, turn(q.options[0], { session_id: res.body.session_id, source: 'tap', answer_to_turn_id: res.body.turn.id })).expect(200);
    expect(tap.body.turn.outcome.result).toBe('executed');
    expect(await getTasks(U1)).toHaveLength(1); // exactly one deleted, the other untouched
  });
});

// ───────────────────────────── TC-13/14 — honesty ─────────────────────────────

describe('honesty outcomes (TC-13, TC-14)', () => {
  it('TC-13 no_match quotes the heard transcript; task table deep-equal unchanged', async () => {
    await seedTask(U1, { title: 'qaapi-buy-milk' });
    const before = await getTasks(U1);
    const res = await postTurn(U1, turn('delete the unicorn task')).expect(200);
    expect(res.body.turn.outcome.kind).toBe('no_match');
    expect(res.body.turn.outcome.heard_transcript).toBe('delete the unicorn task');
    expect(res.body.turn.changed_task_ids).toEqual([]);
    expect(await getTasks(U1)).toEqual(before); // nothing edited, nothing created
  });

  it('TC-14 unsupported_query names the alternative, leaks no task data, mutates nothing', async () => {
    await seedTask(U1, { title: 'qaapi-sunday-brunch', due_at: '2026-08-23T10:00:00Z' });
    const before = await getTasks(U1);
    const res = await postTurn(U1, turn("what's on Sunday?")).expect(200);
    expect(res.body.turn.outcome.kind).toBe('unsupported_query');
    // Contract-fixed literal — api-contracts.md §9 / data-model.md TurnOutcome.
    // English since ADR-008 (owner decision 2026-08-17: English is the product
    // language); it was Vietnamese between the T-015g Gate-3 localization pass
    // and T-069. Pinned verbatim, not imported from src/, so a silent
    // re-wording of the refusal copy fails here.
    expect(res.body.turn.outcome.alternative).toBe('the on-screen list and its filters');
    expect(JSON.stringify(res.body.turn.outcome)).not.toContain('qaapi-sunday-brunch'); // no fabricated answer
    expect(await getTasks(U1)).toEqual(before);
  });
});

// ───────────────────────────── TC-15..24 — undo contract ─────────────────────────────

describe('AC-6/7/8 undo (TC-15..TC-22)', () => {
  it('TC-15 undo edit restores prior fields; turn stays visible as undone', async () => {
    await seedTask(U1, { title: 'qaapi-buy-milk' });
    const edit = await postTurn(U1, turn('rename qaapi-buy-milk to qaapi-buy-oat-milk')).expect(200);
    const undo = await undoTurn(U1, edit.body.turn.id).expect(200);
    expect(undo.body).toMatchObject({ undone: true, already_undone: false, nothing_reverted: false, via: 'tap' });
    expect((await getTasks(U1))[0].title).toBe('qaapi-buy-milk');
    const sess = await getSession(U1).expect(200);
    expect(sess.body.session.messages.find((m: any) => m.id === edit.body.turn.id).status).toBe('undone');
  });

  it('TC-16 undo create removes all 3 (whole-turn scope) and they stay removed', async () => {
    const create = await postTurn(U1, turn('add qaapi-pack-bags, qaapi-book-taxi and qaapi-print-tickets')).expect(200);
    const undo = await undoTurn(U1, create.body.turn.id).expect(200);
    expect(undo.body.reverted).toHaveLength(3);
    expect(await getTasks(U1)).toHaveLength(0);
    expect(await getTasks(U1)).toHaveLength(0); // fresh second read: stays removed
  });

  it('TC-17 undo delete restores every field intact (same id, deep-equal minus updated_at)', async () => {
    // status 'archived', not 'today': ADR-009 narrowed the write vocabulary to
    // inbox | done | archived, so POST /tasks now answers 400 on 'today'. The
    // seed still needs a non-default status — the point of the case is that a
    // restore is field-by-field lossless — and 'archived' is the member no
    // other path writes.
    const orig = await seedTask(U1, { title: 'qaapi-dentist', due_at: '2026-08-20T08:00:00Z', priority: 'high', status: 'archived' });
    const del = await postTurn(U1, turn('delete qaapi-buy-milk', { transcript: 'delete qaapi-dentist' })).expect(200);
    // the generic "delete {qaapi-title}" rule resolves this by exact title
    await undoTurn(U1, del.body.turn.id).expect(200);
    const restored = (await getTasks(U1)).find((t) => t.title === 'qaapi-dentist');
    expect(restored).toBeDefined();
    const strip = ({ updated_at, ...rest }: any) => rest;
    expect(strip(restored)).toEqual(strip(orig));
  });

  it('TC-18 not_newest refusal, then window re-opens after undoing the newer turn', async () => {
    const a = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
    const b = await postTurn(U1, turn('rename qaapi-buy-milk to qaapi-buy-oat-milk')).expect(200);
    const refused = await undoTurn(U1, a.body.turn.id).expect(409);
    expect(refused.body.error).toMatchObject({ code: 'UNDO_REFUSED', detail: { reason: 'not_newest', turn_id: a.body.turn.id } });
    await undoTurn(U1, b.body.turn.id).expect(200);
    await undoTurn(U1, a.body.turn.id).expect(200); // A is newest applied again
    expect(await getTasks(U1)).toHaveLength(0);
  });

  it('TC-19 session_closed refusal by tap and by voice', async () => {
    const a = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
    await closeSession(U1, a.body.session_id).expect(200);
    for (const via of ['tap', 'voice'] as const) {
      const r = await undoTurn(U1, a.body.turn.id, via).expect(409);
      expect(r.body.error.detail.reason).toBe('session_closed');
    }
    expect((await getTasks(U1)).find((t) => t.title === 'qaapi-buy-milk')).toBeDefined(); // nothing reverted
  });

  it('TC-20 already-undone replay: same success, already_undone, NO second revert over moved state', async () => {
    await seedTask(U1, { title: 'qaapi-buy-milk' });
    const edit = await postTurn(U1, turn('rename qaapi-buy-milk to qaapi-buy-oat-milk')).expect(200);
    await undoTurn(U1, edit.body.turn.id).expect(200);
    const task = (await getTasks(U1))[0];
    await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', U1).send({ title: 'qaapi-buy-milk-2L' }).expect(200);
    const replay = await undoTurn(U1, edit.body.turn.id).expect(200);
    expect(replay.body).toMatchObject({ undone: true, already_undone: true });
    expect((await getTasks(U1))[0].title).toBe('qaapi-buy-milk-2L'); // replay did NOT revert again
  });

  it('TC-21 later manual mutation is skipped and named; unmodified tasks still revert', async () => {
    const create = await postTurn(U1, turn('add qaapi-pack-bags, qaapi-book-taxi and qaapi-print-tickets')).expect(200);
    const taxi = (await getTasks(U1)).find((t) => t.title === 'qaapi-book-taxi');
    await h.agent.patch(`/tasks/${taxi.id}`).set('X-User-Id', U1).send({ title: 'qaapi-book-taxi-7am' }).expect(200);
    const undo = await undoTurn(U1, create.body.turn.id).expect(200);
    expect(undo.body.skipped).toEqual([{ task_id: taxi.id, title: 'qaapi-book-taxi-7am', reason: 'modified_since_apply' }]);
    expect(undo.body.reverted).toHaveLength(2);
    expect(undo.body.nothing_reverted).toBe(false);
    const after = await getTasks(U1);
    expect(after).toHaveLength(1);
    expect(after[0].title).toBe('qaapi-book-taxi-7am'); // later work never clobbered
  });

  it('TC-22 all skipped → nothing_reverted:true, never a success revert', async () => {
    await seedTask(U1, { title: 'qaapi-buy-milk' });
    const edit = await postTurn(U1, turn('rename qaapi-buy-milk to qaapi-buy-oat-milk')).expect(200);
    const task = (await getTasks(U1))[0];
    await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', U1).send({ title: 'qaapi-buy-soy-milk' }).expect(200);
    const undo = await undoTurn(U1, edit.body.turn.id).expect(200);
    expect(undo.body).toMatchObject({ reverted: [], nothing_reverted: true });
    expect((await getTasks(U1))[0].title).toBe('qaapi-buy-soy-milk');
    // pinned (data-model UndoResult): all-skipped still transitions applied → undone
    const sess = await getSession(U1).expect(200);
    expect(sess.body.session.messages.find((m: any) => m.id === edit.body.turn.id).status).toBe('undone');
    const replay = await undoTurn(U1, edit.body.turn.id).expect(200); // consumed → idempotent replay
    expect(replay.body).toMatchObject({ already_undone: true, nothing_reverted: true });
    expect((await getTasks(U1))[0].title).toBe('qaapi-buy-soy-milk'); // still zero writes
  });
});

describe('AC-8 non-mutating turns vs the undo window (TC-40)', () => {
  it('TC-40 a misheard utterance between apply and undo does NOT spend the undo', async () => {
    const applied = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
    const sid = applied.body.session_id;
    const noMatch = await postTurn(U1, turn('delete the unicorn task', { session_id: sid })).expect(200);
    expect(noMatch.body.turn.changed_task_ids).toEqual([]);
    await postTurn(U1, turn("what's on Sunday?", { session_id: sid })).expect(200);
    // undo of the non-mutating turn itself → not_undoable (pinned error-table clause)
    const refused = await undoTurn(U1, noMatch.body.turn.id).expect(409);
    expect(refused.body.error).toMatchObject({ code: 'UNDO_REFUSED', detail: { reason: 'not_undoable' } });
    // the mutating turn is STILL the newest mutating applied turn → undo succeeds, not not_newest
    const undo = await undoTurn(U1, applied.body.turn.id).expect(200);
    expect(undo.body.reverted.map((r: any) => r.title)).toEqual(['qaapi-buy-milk']);
    expect(await getTasks(U1)).toHaveLength(0);
  });

  it('TC-40 declined resolution is applied-but-non-mutating: not_undoable itself, window untouched', async () => {
    const applied = await postTurn(U1, turn('add a task qaapi-call-dentist')).expect(200);
    const { sid } = await pendingBulkDelete(U1);
    const declined = await postTurn(U1, turn('no', { session_id: sid })).expect(200);
    expect(declined.body.turn.changed_task_ids).toEqual([]);
    const refused = await undoTurn(U1, declined.body.turn.id).expect(409);
    expect(refused.body.error.detail.reason).toBe('not_undoable');
    await undoTurn(U1, applied.body.turn.id).expect(200); // the "no" spent nothing
  });

  it('TC-40 voice undo with only non-mutating applied turns: not_undoable, zero AI for the phrase', async () => {
    const nm = await postTurn(U3, turn('delete the unicorn task')).expect(200);
    await postTurn(U3, turn("what's on Sunday?", { session_id: nm.body.session_id })).expect(200);
    const before = h.ai.calls;
    const res = await postTurn(U3, turn('undo', { session_id: nm.body.session_id })).expect(409);
    expect(res.body.error).toMatchObject({ code: 'UNDO_REFUSED', detail: { reason: 'not_undoable' } });
    expect(h.ai.calls).toBe(before); // guard fired before interpretation
    expect((await getTasks(U3)).find((t) => /^undo$/i.test(t.title))).toBeUndefined();
  });
});

describe('AC-5 voice-undo guard (TC-23, TC-24)', () => {
  it('TC-23 undo phrases short-circuit: kind=undo, real revert, no turn row, ZERO AI calls', async () => {
    const create = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
    const sid = create.body.session_id;
    const before = h.ai.calls;
    const msgCount = (await getSession(U1).expect(200)).body.session.messages.length;
    const res = await postTurn(U1, turn('undo', { session_id: sid })).expect(200);
    expect(res.body.kind).toBe('undo');
    expect(res.body.turn).toBeNull();
    expect(res.body.undo).toMatchObject({ undone: true, via: 'voice' });
    expect(h.ai.calls).toBe(before); // interpreter never called
    const tasks = await getTasks(U1);
    expect(tasks.find((t) => /^undo$/i.test(t.title))).toBeUndefined(); // never a task named undo
    expect((await getSession(U1).expect(200)).body.session.messages).toHaveLength(msgCount); // no new turn row
  });

  it('TC-23 normalization variants all short-circuit; longer paraphrase does NOT', async () => {
    // ADR-006 normalization: trim, lowercase, Unicode NFC, strip terminal
    // punctuation. UT-UNDO-NORM-1/2/3 hit trim+case+punctuation together, case
    // alone, and punctuation alone. The NFC clause is no longer reachable
    // through this list: since the amendment of 2026-08-17 the closed list is
    // the single ASCII phrase "undo", which has no decomposed form. ADR-006
    // § Amendment keeps NFC deliberately (it is the engine-wide utterance
    // normalization contract, not a Vietnamese affordance), so it is unasserted
    // here rather than removed — flagged in the run record, not silently dropped.
    for (const phrase of ['  Undo.  ', 'UNDO', 'undo!']) {
      const create = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
      const before = h.ai.calls;
      const res = await postTurn(U1, turn(phrase, { session_id: create.body.session_id })).expect(200);
      expect(res.body.kind).toBe('undo');
      expect(res.body.undo).toMatchObject({ undone: true, via: 'voice' });
      expect(h.ai.calls).toBe(before);
      expect(await getTasks(U1)).toHaveLength(0); // the revert really happened
    }
    const before = h.ai.calls;
    const res = await postTurn(U1, turn('undo the last thing')).expect(200);
    expect(res.body.kind).toBe('turn'); // normal turn — goes to the model
    expect(h.ai.calls).toBe(before + 1);
    expect(res.body.turn.outcome.kind).toBe('no_match');
  });

  it('TC-23 the retired phrase "hoàn tác" is an ordinary turn: interpreted, no_match, reverts nothing', async () => {
    // The change ADR-006 § Amendment (2026-08-17) made, asserted directly.
    // UNDO_PHRASES was {"undo", "hoàn tác"}; it is now {"undo"}, so the
    // Vietnamese phrase no longer short-circuits. Every clause below is the
    // negation of a TC-23 step-1 clause, which is what makes this test able to
    // fail if the phrase were ever re-added to the list.
    const create = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
    const sid = create.body.session_id;
    const before = h.ai.calls;
    const msgCount = (await getSession(U1).expect(200)).body.session.messages.length;

    const res = await postTurn(U1, turn('hoàn tác', { session_id: sid })).expect(200);
    expect(res.body.kind).toBe('turn'); // NOT 'undo' — the guard does not fire
    expect(res.body.undo).toBeNull();
    expect(h.ai.calls).toBe(before + 1); // it reaches the interpreter now
    expect(res.body.turn.outcome.kind).toBe('no_match');
    expect(res.body.turn.outcome.heard_transcript).toBe('hoàn tác'); // AC-14 echo

    // AC-14's guarantee survives the retirement, and so does AC-5's shape of it:
    // the phrase creates nothing and reverts nothing.
    const tasks = await getTasks(U1);
    expect(tasks.find((t) => /^hoàn tác$/i.test(t.title))).toBeUndefined();
    expect(tasks.map((t) => t.title)).toEqual(['qaapi-buy-milk']); // create NOT undone
    expect(res.body.turn.changed_task_ids).toEqual([]);
    // a real turn row now exists for it (the guard path creates none)
    expect((await getSession(U1).expect(200)).body.session.messages).toHaveLength(msgCount + 1);
    // the create is still the newest applied turn — the phrase spent no undo window
    const undo = await undoTurn(U1, create.body.turn.id).expect(200);
    expect(undo.body).toMatchObject({ undone: true, via: 'tap' });
  });

  it('TC-24 voice undo with no applied turn: 409 not_undoable, no task, no AI call, question untouched', async () => {
    const { qid, sid } = await pendingBulkDelete(U3);
    const before = h.ai.calls;
    const id1 = uuid();
    const refusalBody = turn('undo', { session_id: sid, client_turn_id: id1 });
    const res = await postTurn(U3, refusalBody).expect(409);
    expect(res.body.error).toMatchObject({ code: 'UNDO_REFUSED', detail: { reason: 'not_undoable' } });
    expect(h.ai.calls).toBe(before);
    expect(await getTasks(U3)).toHaveLength(3);
    const sess = await getSession(U3).expect(200);
    expect(sess.body.session.messages.find((m: any) => m.id === qid).question.resolution).toBeNull();
    // pinned (contract rule 3): the refusal CONSUMED id1 — after a turn applies,
    // a same-id retry re-serves the recorded 409 and never undoes the new turn
    const applied = await postTurn(U3, turn('add a task qaapi-buy-milk', { session_id: sid })).expect(200);
    const replay = await postTurn(U3, refusalBody).expect(409);
    expect(replay.body.error).toMatchObject({ code: 'UNDO_REFUSED', detail: { reason: 'not_undoable' } });
    expect((await getTasks(U3)).find((t) => t.title === 'qaapi-buy-milk')).toBeDefined(); // step-5 turn NOT undone
    expect(applied.body.turn.status).toBe('applied');
  });
});

// ───────────────────────────── TC-25..28 — idempotency ─────────────────────────────

describe('AC-16 dedupe (TC-25..TC-28)', () => {
  it('TC-25 terminal-status replays re-serve without re-executing', async () => {
    // applied
    const ida = uuid();
    await postTurn(U1, turn('add a task qaapi-buy-milk', { client_turn_id: ida })).expect(200);
    const ra = await postTurn(U1, turn('add a task qaapi-buy-milk', { client_turn_id: ida })).expect(200);
    expect(ra.body.replayed).toBe(true);
    expect((await getTasks(U1)).filter((t) => t.title === 'qaapi-buy-milk')).toHaveLength(1); // not two
    // asked — replay the SAME client_turn_id of the original asked turn (a
    // fresh id here would be a different scenario: an unrelated command
    // superseding the pending question, not a dedupe replay)
    const { qid: askedQid, sid: askedSid } = await pendingBulkDelete(U3);
    const askedTurnRow = (await getSession(U3).expect(200)).body.session.messages.find(
      (m: any) => m.id === askedQid,
    );
    const replayAsked = await postTurn(
      U3,
      turn('delete all my qaapi shopping tasks', {
        client_turn_id: askedTurnRow.client_turn_id,
        session_id: askedSid,
      }),
    ).expect(200);
    expect(replayAsked.body.replayed).toBe(true);
    expect(replayAsked.body.turn.id).toBe(askedQid); // same asked turn re-served, not a new one
    expect(
      (await getTasks(U3)).filter((t) => String(t.title).startsWith('qaapi-shop-')),
    ).toHaveLength(3); // not re-asked, not re-executed
    // undone
    await seedTask(U1, { title: 'qaapi-x' });
    const idu = uuid();
    const e = await postTurn(U1, turn('rename qaapi-buy-milk to qaapi-buy-oat-milk', { client_turn_id: idu })).expect(200);
    await undoTurn(U1, e.body.turn.id).expect(200);
    const ru = await postTurn(U1, turn('rename qaapi-buy-milk to qaapi-buy-oat-milk', { client_turn_id: idu })).expect(200);
    expect(ru.body.replayed).toBe(true);
    expect((await getTasks(U1)).find((t) => t.title === 'qaapi-buy-oat-milk')).toBeUndefined(); // not re-applied
  });

  it('TC-25 divergent-body same-id is reuse: 409 CLIENT_TURN_ID_REUSED, nothing executes', async () => {
    const ida = uuid();
    await postTurn(U1, turn('add a task qaapi-buy-milk', { client_turn_id: ida })).expect(200);
    // divergent transcript → reuse, not replay (contract rule 2, pinned)
    const reused = await postTurn(U1, turn('add a task qaapi-call-dentist', { client_turn_id: ida })).expect(409);
    expect(reused.body.error.code).toBe('CLIENT_TURN_ID_REUSED');
    const tasks = await getTasks(U1);
    expect(tasks.find((t) => t.title === 'qaapi-call-dentist')).toBeUndefined(); // nothing executed
    expect(tasks.filter((t) => t.title === 'qaapi-buy-milk')).toHaveLength(1);
    // divergent source is also reuse
    const reused2 = await postTurn(U1, turn('add a task qaapi-buy-milk', { client_turn_id: ida, source: 'typed' })).expect(409);
    expect(reused2.body.error.code).toBe('CLIENT_TURN_ID_REUSED');
    // session_id / timezone differences are EXCLUDED from the comparison → still a replay
    const okReplay = await postTurn(U1, turn('add a task qaapi-buy-milk', { client_turn_id: ida, timezone: 'Asia/Ho_Chi_Minh' })).expect(200);
    expect(okReplay.body.replayed).toBe(true);
  });

  it('TC-26 502 AI_ERROR persists words; retry same id re-attempts once', async () => {
    const id1 = uuid();
    const body = turn('qaapi trigger model failure', { client_turn_id: id1 });
    const fail = await postTurn(U1, body).expect(502);
    expect(fail.body.error.code).toBe('AI_ERROR');
    expect(fail.body.turn.status).toBe('failed');
    expect(fail.body.turn.transcript_raw).toBe('qaapi trigger model failure');
    const sess = await getSession(U1).expect(200);
    expect(sess.body.session.messages.some((m: any) => m.status === 'failed')).toBe(true); // AC-23
    expect(await getTasks(U1)).toHaveLength(0);
    // late success: same utterance now interprets as a create
    h.ai.overrides.set(normalize('qaapi trigger model failure'), { kind: 'create', tasks: [{ title: 'qaapi-late-win' }] });
    const retry = await postTurn(U1, body).expect(200);
    expect(retry.body.replayed).toBe(false); // re-attempt, not replay
    expect(retry.body.turn.status).toBe('applied');
    expect((await getTasks(U1)).filter((t) => t.title === 'qaapi-late-win')).toHaveLength(1);
    const replay = await postTurn(U1, body).expect(200); // now applied → replay
    expect(replay.body.replayed).toBe(true);
    expect((await getTasks(U1)).filter((t) => t.title === 'qaapi-late-win')).toHaveLength(1);
  });

  it('TC-27 post-close replay: SESSION_CLOSED → re-sync → same id lands in NEW session, then dedupes', async () => {
    const first = await postTurn(U3, turn('add a task qaapi-buy-milk')).expect(200);
    const sid1 = first.body.session_id;
    await closeSession(U3, sid1).expect(200);
    const id1 = uuid();
    const stale = await postTurn(U3, turn('add a task qaapi-call-dentist', { session_id: sid1, client_turn_id: id1 })).expect(409);
    expect(stale.body.error.code).toBe('SESSION_CLOSED');
    await getSession(U3).expect(200); // re-sync
    const replayNew = await postTurn(U3, turn('add a task qaapi-call-dentist', { client_turn_id: id1 })).expect(200);
    expect(replayNew.body.session_id).not.toBe(sid1); // new session
    expect(replayNew.body.replayed).toBe(false);
    const dedupe = await postTurn(U3, turn('add a task qaapi-call-dentist', { client_turn_id: id1 })).expect(200);
    expect(dedupe.body.replayed).toBe(true); // id recognized across the close
    expect((await getTasks(U3)).filter((t) => t.title === 'qaapi-call-dentist')).toHaveLength(1);
  });

  it('TC-28 five concurrent identical requests apply exactly once', async () => {
    h.ai.latencyMs = 30; // widen the pending window so IN_FLIGHT is reachable
    const id1 = uuid();
    const body = turn('add a task qaapi-buy-milk', { client_turn_id: id1 });
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => postTurn(U1, body)));
    const fresh = results.filter((r) => r.status === 200 && r.body.replayed === false);
    const replays = results.filter((r) => r.status === 200 && r.body.replayed === true);
    const inflight = results.filter((r) => r.status === 409 && r.body.error?.code === 'IN_FLIGHT');
    expect(fresh).toHaveLength(1);
    expect(replays.length + inflight.length).toBe(4);
    h.ai.latencyMs = 0;
    expect((await getTasks(U1)).filter((t) => t.title === 'qaapi-buy-milk')).toHaveLength(1);
  });
});

// ───────────────────────────── TC-29..31 — session lifecycle ─────────────────────────────

describe('AC-28 session lifecycle (TC-29..TC-31)', () => {
  it('TC-29 idle-close boundary at exactly 180s; single boundary with declined questions + late outcomes', async () => {
    const applied = await postTurn(U3, turn('add a task qaapi-buy-milk')).expect(200);
    const { qid } = await pendingBulkDelete(U3);
    h.clock.advance(179_999);
    const open = await getSession(U3).expect(200);
    expect(open.body.session).not.toBeNull(); // 179 999 ms: still open
    h.clock.advance(1);
    const closed = await getSession(U3).expect(200);
    expect(closed.body.session).toBeNull(); // 180 000 ms: lazily closed
    const b = closed.body.boundary;
    expect(b.close_reason).toBe('idle');
    expect(b.declined_questions).toEqual([
      expect.objectContaining({
        turn_id: qid,
        kind: 'bulk_delete',
        task_titles: expect.arrayContaining(['qaapi-shop-eggs', 'qaapi-shop-bread', 'qaapi-shop-cheese']),
      }),
    ]);
    expect(await getTasks(U3)).toHaveLength(4); // close-decline executed nothing
    const undo = await undoTurn(U3, applied.body.turn.id).expect(409); // idle close ended the window
    expect(undo.body.error.detail.reason).toBe('session_closed');
    const fresh = await postTurn(U3, turn('add a task qaapi-call-dentist')).expect(200);
    expect(fresh.body.session_id).not.toBe(applied.body.session_id); // clean start
  });

  it('TC-30 explicit close declines the pending question, leaves an already-superseded one untouched, replays idempotently', async () => {
    // Script-fix (T-007b phase:execute triage): the original scenario expected
    // TWO independently-pending questions to both get declined at close — same
    // false premise as TC-10 above (asking Q2 while Q1 is unresolved supersedes
    // Q1 via D2, it doesn't leave two questions pending). Rewritten to assert
    // what's actually true and still contract-relevant: close declines only
    // the genuinely-pending question, and does NOT overwrite an
    // already-resolved (superseded) one — a real "close must not clobber
    // prior resolutions" check the original scenario never actually exercised.
    const { qid: q1, sid } = await pendingBulkDelete(U1);
    await seedTask(U1, { title: 'qaapi-report-q3' });
    await seedTask(U1, { title: 'qaapi-report-q4' });
    const clarify = await postTurn(U1, turn('delete the report task', { session_id: sid })).expect(200);
    const q2 = clarify.body.turn.id;
    const preClose = await getSession(U1).expect(200);
    expect(preClose.body.session.messages.find((m: any) => m.id === q1).question.resolution).toMatchObject({
      result: 'declined_superseded',
    });
    const res = await closeSession(U1, sid).expect(200);
    expect(res.body.session).toMatchObject({ status: 'closed', close_reason: 'user_closed' });
    expect(res.body.declined_question_turn_ids).toEqual([q2]); // only the still-pending one
    expect(res.body.already_closed).toBe(false);
    expect(await getTasks(U1)).toHaveLength(5); // zero deletions
    const again = await closeSession(U1, sid).expect(200);
    expect(again.body.already_closed).toBe(true);
    const sess = await getSession(U1).expect(200);
    expect(sess.body.boundary.close_reason).toBe('user_closed');
    expect(sess.body.boundary.declined_questions).toHaveLength(1); // just q2 — q1 not re-declined
    expect(sess.body.boundary.declined_questions[0].turn_id).toBe(q2);
  });

  it('TC-31 resume returns full history in seq order incl. failed transcript; null session_id resumes', async () => {
    await postTurn(U3, turn('add a task qaapi-buy-milk')).expect(200);
    await postTurn(U3, turn('qaapi trigger model failure')).expect(502);
    await pendingBulkDelete(U3);
    const sess = await getSession(U3).expect(200);
    expect(sess.body.boundary).toBeNull();
    const msgs = sess.body.session.messages;
    expect(msgs.map((m: any) => m.status)).toEqual(['applied', 'failed', 'asked']);
    expect(msgs[1].transcript_raw).toBe('qaapi trigger model failure'); // AC-23 words kept
    const seqs = msgs.map((m: any) => m.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    const next = await postTurn(U3, turn('add a task qaapi-call-dentist')).expect(200);
    expect(next.body.session_id).toBe(sess.body.session.id); // resume, not new
  });
});

// ───────────────────────────── TC-32..39 — auth, isolation, validation, contract ─────────────────────────────

describe('security + validation matrices (TC-32, TC-33, TC-34)', () => {
  it('TC-32 401 UNAUTHENTICATED on every endpoint without/with-empty X-User-Id, zero side effects', async () => {
    const t = await seedTask(U1, { title: 'qaapi-guard' });
    const probes: Array<[string, string, unknown?]> = [
      ['post', '/assistant/turn', turn('add a task qaapi-buy-milk')],
      ['get', '/assistant/session'],
      ['post', '/assistant/session/close', { session_id: uuid(), reason: 'user_closed' }],
      ['post', `/assistant/turn/${uuid()}/undo`, { via: 'tap' }],
      ['get', '/tasks'],
      ['post', '/tasks', { title: 'qaapi-x' }],
      ['patch', `/tasks/${t.id}`, { title: 'qaapi-hacked' }],
      ['delete', `/tasks/${t.id}`],
    ];
    for (const [method, path, body] of probes) {
      const bare = await (h.agent as any)[method](path).send(body);
      expect(bare.status, `${method} ${path}`).toBe(401);
      expect(bare.body.error.code).toBe('UNAUTHENTICATED');
      const empty = await (h.agent as any)[method](path).set('X-User-Id', '').send(body);
      expect(empty.status, `${method} ${path} (empty header)`).toBe(401);
    }
    const after = await getTasks(U1);
    expect(after).toHaveLength(1);
    expect(after[0].title).toBe('qaapi-guard'); // nothing mutated by any probe
  });

  it('TC-33 foreign ids behave as 404 exactly like unknown ids; no data leak, no mutation', async () => {
    const taskB = await seedTask(U2, { title: 'qaapi-u2-private' });
    const sessB = await postTurn(U2, turn('add a task qaapi-buy-milk')).expect(200);
    const probes: Array<[string, string, unknown?]> = [
      ['post', '/assistant/turn', turn('add a task qaapi-buy-milk', { session_id: sessB.body.session_id })],
      ['post', '/assistant/turn', turn('yes', { answer_to_turn_id: sessB.body.turn.id })],
      ['post', `/assistant/turn/${sessB.body.turn.id}/undo`, { via: 'tap' }],
      ['post', '/assistant/session/close', { session_id: sessB.body.session_id, reason: 'user_closed' }],
      ['patch', `/tasks/${taskB.id}`, { title: 'qaapi-stolen' }],
      ['delete', `/tasks/${taskB.id}`],
    ];
    for (const [method, path, body] of probes) {
      const res = await (h.agent as any)[method](path).set('X-User-Id', U1).send(body);
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    // unknown-uuid variants must be indistinguishable (no enumeration oracle)
    const unknown = await h.agent.patch(`/tasks/${uuid()}`).set('X-User-Id', U1).send({ title: 'x' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
    // victim state intact
    const bTasks = await getTasks(U2);
    expect(bTasks.map((t) => t.title)).toEqual(expect.arrayContaining(['qaapi-u2-private', 'qaapi-buy-milk']));
    expect((await getTasks(U1)).find((t) => t.title === 'qaapi-u2-private')).toBeUndefined();
  });

  it('TC-34 validation 400s with zero side effects, before persistence and before the interpreter', async () => {
    const seeded = await seedTask(U1, { title: 'qaapi-guard' });
    const aiBefore = h.ai.calls;
    const bad: Array<[string, string, unknown]> = [
      ['post', '/assistant/turn', { ...turn('x'), transcript: undefined }],
      ['post', '/assistant/turn', turn('')],
      ['post', '/assistant/turn', { ...turn('x'), transcript: null }],
      ['post', '/assistant/turn', { ...turn('add a task qaapi-buy-milk'), client_turn_id: undefined }],
      ['post', '/assistant/turn', { ...turn('add a task qaapi-buy-milk'), client_turn_id: 'not-a-uuid' }],
      ['post', '/assistant/turn', { ...turn('add a task qaapi-buy-milk'), source: 'telepathy' }],
      ['post', '/assistant/session/close', { reason: 'user_closed' }],
      ['post', '/tasks', {}],
      ['post', '/tasks', { title: 'qaapi-x', status: 'bogus' }],
      ['patch', `/tasks/${seeded.id}`, { status: 'bogus' }],
    ];
    for (const [method, path, body] of bad) {
      const res = await (h.agent as any)[method](path).set('X-User-Id', U1).send(body);
      expect(res.status, `${method} ${path} ${JSON.stringify(body)}`).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    }
    const malformed = await h.agent
      .post('/assistant/turn').set('X-User-Id', U1)
      .set('Content-Type', 'application/json').send('{"transcript": "trunc');
    expect(malformed.status).toBe(400);
    // pinned (contract Conventions): unknown request fields → 400 VALIDATION naming the field, every endpoint
    const unknownProbes: Array<[string, string, unknown, string]> = [
      ['post', '/assistant/turn', { ...turn('add a task qaapi-buy-milk'), foo: 1 }, 'foo'],
      ['post', '/assistant/session/close', { session_id: uuid(), reason: 'user_closed', force: true }, 'force'],
      ['post', '/tasks', { title: 'qaapi-x', color: 'red' }, 'color'],
    ];
    for (const [method, path, body, field] of unknownProbes) {
      const res = await (h.agent as any)[method](path).set('X-User-Id', U1).send(body);
      expect(res.status, `unknown field ${field} on ${path}`).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
      expect(res.body.error.field).toBe(field);
    }
    expect(h.ai.calls).toBe(aiBefore); // rejected before interpretation
    expect(await getTasks(U1)).toHaveLength(1); // no task side effects
    const sess = await getSession(U1).expect(200);
    expect(sess.body.session).toBeNull(); // no turn row was ever persisted for a 400
  });

  /**
   * TC-41 — the guard on this suite's own zone default (added T-166).
   *
   * `Harness.agent` sends `X-Timezone: UTC` on every request, which is what
   * un-broke TC-14 and TC-17 after ADR-010 landed. That default has a cost:
   * with a zone always present, NOTHING in this suite can observe
   * `409 TIMEZONE_UNKNOWN` any more, so a regression that dropped the refusal
   * entirely — or one that silently fell back to the server's own zone, which
   * `F-005 AC-44` forbids by name — would leave every test in this file green.
   *
   * So the refusal keeps a deliberate home. `Harness.zoneless` is a client that
   * has never sent the header on any request, which
   * `api-contracts.md § When the zone is absent` says is the only way to reach
   * this refusal, and the assertion is that a date-computing WRITE from it is
   * refused, names the header, and writes nothing — while a read from the same
   * client still succeeds, because "a read never refuses".
   *
   * Own-mutation check (§5 "would this notice if the implementation broke?"):
   * remove the refusal and the first two assertions go red; make the read
   * refuse too and the third goes red.
   */
  it('TC-41 a zoneless client is refused on a date-computing write, and still served on a read', async () => {
    const ZL = uuid(); // its own account — U1's zone is established by h.agent
    const refused = await h.zoneless.post('/tasks').set('X-User-Id', ZL).send({
      title: 'qaapi-zoneless-due',
      due_at: '2026-08-20T08:00:00.000Z',
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('TIMEZONE_UNKNOWN');
    expect(refused.body.error.detail).toMatchObject({ header: 'X-Timezone' });
    // "a refused write writes nothing" (F-005 AC-18) — asserted, not assumed
    const afterRefusal = await h.zoneless.get('/tasks').set('X-User-Id', ZL).expect(200);
    expect(afterRefusal.body.tasks).toHaveLength(0);
    // a read never refuses, even for an account with no zone at all
    const dateless = await h.zoneless
      .post('/tasks').set('X-User-Id', ZL).send({ title: 'qaapi-zoneless-dateless' }).expect(201);
    expect(dateless.body.task.title).toBe('qaapi-zoneless-dateless');
    const read = await h.zoneless.get('/tasks').set('X-User-Id', ZL).expect(200);
    expect(read.body.tasks).toHaveLength(1);
  });
});

describe('contract conformance (TC-35, TC-36, TC-37)', () => {
  it('TC-35 exact key sets — documented fields present, no undocumented fields', async () => {
    const applied = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
    expect(Object.keys(applied.body).sort()).toEqual(['kind', 'replayed', 'resolutions', 'session_id', 'turn', 'undo'].sort());
    expect(applied.body.undo).toBeNull();
    const voiceUndo = await postTurn(U1, turn('undo', { session_id: applied.body.session_id })).expect(200);
    expect(Object.keys(voiceUndo.body.undo).sort()).toEqual(
      ['turn_id', 'undone', 'already_undone', 'reverted', 'skipped', 'nothing_reverted', 'via'].sort(),
    );
    const closeRes = await closeSession(U1, applied.body.session_id).expect(200);
    expect(Object.keys(closeRes.body).sort()).toEqual(['already_closed', 'declined_question_turn_ids', 'session'].sort());
    const sess = await getSession(U1).expect(200);
    expect(Object.keys(sess.body).sort()).toEqual(['boundary', 'session'].sort());
    expect(Object.keys(sess.body.boundary).sort()).toEqual(
      ['session_id', 'closed_at', 'close_reason', 'declined_questions', 'late_outcomes'].sort(),
    );
    const err = await h.agent.get('/assistant/session').expect(401);
    expect(Object.keys(err.body)).toEqual(['error']);
    expect(Object.keys(err.body.error)).toEqual(expect.arrayContaining(['code', 'message']));
  });

  it('TC-36 no #d tokens and no raw uuids in rendered strings, across turn, session and boundary payloads', async () => {
    await seedTask(U1, { title: 'qaapi-draft-report' });
    const res = await postTurn(U1, turn('rename #d1 to qaapi-final-report')).expect(200);
    await pendingBulkDelete(U1);
    const sess = await getSession(U1).expect(200);
    for (const payload of [res.body, sess.body]) {
      for (const s of renderedStrings(payload)) {
        expect(s, `rendered string leaked internals: "${s}"`).not.toMatch(DRAFT_REF_RE);
        expect(s, `rendered string leaked uuid: "${s}"`).not.toMatch(UUID_RE);
      }
    }
  });

  it('TC-37 non-JSON audio body rejected; no audio ever persisted or echoed', async () => {
    const bin = await h.agent
      .post('/assistant/turn').set('X-User-Id', U1)
      .set('Content-Type', 'audio/webm').send(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42]));
    expect(bin.status).toBe(400);
    const smuggle = await postTurn(U1, { ...turn('add a task qaapi-buy-milk'), audio: 'QUJDRA=='.repeat(1000) });
    // pinned (contract Conventions): unknown field → 400 VALIDATION naming it; and no audio round-trips
    expect(smuggle.status).toBe(400);
    expect(smuggle.body.error.code).toBe('VALIDATION');
    expect(smuggle.body.error.field).toBe('audio');
    expect(JSON.stringify(smuggle.body)).not.toContain('QUJDRA==');
    const sess = await getSession(U1).expect(200);
    expect(JSON.stringify(sess.body)).not.toContain('QUJDRA==');
    expect(JSON.stringify(sess.body)).not.toContain('"audio"');
  });
});

describe('manual path + cancel race (TC-38, TC-39)', () => {
  it('TC-38 full CRUD through /tasks with the AI-call counter frozen at zero', async () => {
    const before = h.ai.calls;
    const created = await seedTask(U1, { title: 'qaapi-manual-1', priority: 'high' });
    await h.agent.patch(`/tasks/${created.id}`).set('X-User-Id', U1).send({ title: 'qaapi-manual-1-edited' }).expect(200);
    await h.agent.patch(`/tasks/${created.id}`).set('X-User-Id', U1).send({ status: 'done' }).expect(200);
    const del = await h.agent.delete(`/tasks/${created.id}`).set('X-User-Id', U1).expect(200);
    expect(del.body.task.deleted_at).toBeTruthy(); // soft delete
    expect(await getTasks(U1)).toHaveLength(0);
    // pinned: optional client-generated id (offline local path — no temporary-id mapping)
    const clientId = uuid();
    const own = await h.agent.post('/tasks').set('X-User-Id', U1).send({ id: clientId, title: 'qaapi-offline-1' }).expect(201);
    expect(own.body.task.id).toBe(clientId);
    const replay = await h.agent.post('/tasks').set('X-User-Id', U1).send({ id: clientId, title: 'qaapi-offline-1' }).expect(409);
    expect(replay.body.error.code).toBe('TASK_ID_EXISTS'); // own-replay = already-synced ack
    const collide = await h.agent.post('/tasks').set('X-User-Id', U1).send({ id: clientId, title: 'qaapi-different-title' }).expect(409);
    expect(collide.body.error.code).toBe('TASK_ID_EXISTS');
    const after = await getTasks(U1);
    expect(after.filter((t) => t.id === clientId)).toHaveLength(1);
    expect(after.find((t) => t.id === clientId).title).toBe('qaapi-offline-1'); // never overwritten
    expect(h.ai.calls).toBe(before); // ZERO interpretation calls for the whole manual path
  });

  it('TC-39 a sent turn always completes; late outcome served by GET and undoable; no cancel route', async () => {
    h.ai.latencyMs = 25; // in-flight window in which the client "cancels" (which sends nothing)
    const res = await postTurn(U1, turn('add a task qaapi-buy-milk')).expect(200);
    h.ai.latencyMs = 0;
    expect(res.body.turn.status).toBe('applied'); // ran to completion regardless of any client cancel
    expect((await getTasks(U1)).find((t) => t.title === 'qaapi-buy-milk')).toBeDefined();
    const sess = await getSession(U1).expect(200);
    const late = sess.body.session.messages.find((m: any) => m.id === res.body.turn.id);
    expect(late.status).toBe('applied'); // the late outcome a re-opening client renders
    await undoTurn(U1, res.body.turn.id).expect(200); // applied + Undo, never pretending the cancel won
    for (const path of [`/assistant/turn/${res.body.turn.id}/cancel`, '/assistant/cancel']) {
      const probe = await h.agent.post(path).set('X-User-Id', U1).send({});
      expect(probe.status, path).toBeGreaterThanOrEqual(400); // deliberately-absent endpoint stays absent
    }
  });
});
