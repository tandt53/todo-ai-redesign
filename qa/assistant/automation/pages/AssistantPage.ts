/**
 * F-001 voice-assistant-view — Page Object (web).
 * qa-web-agent · phase: execute · 2026-08-16 (T-007e)
 * qa-web-agent · phase: execute v2 · 2026-08-16 (T-016) — copy sync + 4.1.3
 *
 * SELECTOR CONTRACT: every locator below comes from the design mockup's
 * 22-testid catalogue (design/assistant/screens/voice-assistant-view.html),
 * from getByRole with the mockup's accessible names, or (sparingly) from
 * getByText where the copy itself IS the assertion (e.g. the transcript
 * echo). CSS selectors: never. Verified against the real components
 * (src/assistant/web/components/*.tsx) during this execute pass — every
 * testid used here exists in the running app.
 *
 * COPY CONTRACT (T-016): the product's user-visible wording is Vietnamese.
 * The spec is explicit that it does not own it — F-001 ## Conversation model
 * ("Naming convention"): the spec's English words are concept names, and
 * "the user-visible wording of every label, message and accessible name — and
 * the language it is written in — is the design system's to specify
 * (design/_shared/components.md)". So every literal string asserted below is
 * traceable to components.md or to the design mockup, NOT to whatever the
 * implementation happens to render; where the two disagree, the disagreement
 * is recorded as drift in the run record rather than absorbed into an
 * assertion. Task TITLES ("Buy milk") are fixture data, not copy, and stay as
 * they are.
 *
 * HARNESS SEAMS (execute-phase binding): the spec's Test strategy names
 * three seams.
 *   - Injectable transcript source → window.__assistantSeams, installed by
 *     web-agent behind a test-mode guard (src/assistant/web/seams.ts),
 *     active whenever the page URL carries ?qaUser=.
 *   - AI-call counter + injectable idle-close timer → NOT exposed by the
 *     plain `npm run dev:assistant` entrypoint. qa-test-server.ts
 *     (qa/assistant/automation/harness/) is the QA-owned harness that adds
 *     both over HTTP at /__qa__/ai-calls and /__qa__/advance-clock; see its
 *     header comment for why a harness was necessary instead of the plain
 *     entrypoint. bindSeams() below talks to that harness.
 */

import type { APIRequestContext, Locator, Page, Request } from '@playwright/test';
import { expect } from '@playwright/test';

/** The spec-declared harness seams (Test strategy, F-001 rev 3). */
export interface AssistantSeams {
  /** Injectable transcript source: feed recognized-text increments while listening (AC-2, AC-20–22). */
  feedTranscript(parts: string[]): Promise<void>;
  /** End the capture: 'speech-end' | 'speech-end-empty' | 'cancelled'. */
  endCapture(mode: 'speech-end' | 'speech-end-empty' | 'cancelled'): Promise<void>;
  /** Capability & permission injection: none / denied / transient-failure / recovered / granted. */
  setSpeechCapability(
    state: 'available' | 'none' | 'permission-denied' | 'transient-failure' | 'recovered',
  ): Promise<void>;
  /** Re-read GET /assistant/session and re-render (also how a harness-side clock jump becomes visible). */
  resync(): Promise<void>;
  /** AI-call counter (AC-18, AC-25): cumulative count of interpreter calls, read from the QA harness. */
  aiCallCount(): Promise<number>;
  /** Advance the harness's injectable clock, then resync (AC-28 idle-close seam). */
  fireIdleClose(ms?: number): Promise<void>;
  /** Advance the harness's injectable clock WITHOUT resyncing or crossing the
   * idle-close threshold — for tests that need real elapsed-time ordering
   * between two actions (e.g. distinct resolved_at vs last_foreground_at
   * instants) without ending the session. The FakeClock only moves when
   * asked; unlike systemClock, two calls with nothing in between return the
   * identical millisecond, which a real wall clock would never do. */
  advanceClockMs(ms: number): Promise<void>;
}

/** Real binding against window.__assistantSeams (client) + the QA harness's
 * /__qa__/* endpoints (server) — see qa-test-server.ts. `apiBase` defaults to
 * the page's own origin (the Vite dev server), which proxies /assistant and
 * /tasks to the harness (same-origin as the browser sees it); the two
 * /__qa__/* control endpoints are harness-only and are NOT proxied by Vite
 * (its proxy list is /assistant + /tasks only — vite.config.ts), so those two
 * calls go straight to the harness's own port. */
// NOTE: every page.evaluate callback below is serialized and re-run INSIDE
// the browser — it cannot close over any outer (Node-side) function or
// variable except the explicit second argument Playwright passes through.
// The "seams missing" guard is therefore inlined in each callback rather
// than factored into a shared Node-side helper.

export function bindSeams(page: Page, harnessBaseUrl = 'http://localhost:4460'): AssistantSeams {
  const resync = (): Promise<void> =>
    page.evaluate(() => {
      const seams = window.__assistantSeams;
      if (seams === undefined) throw new Error('window.__assistantSeams is not installed (missing ?qaUser=)');
      return seams.resync();
    });

  return {
    feedTranscript: (parts) =>
      page.evaluate((p) => {
        const seams = window.__assistantSeams;
        if (seams === undefined) throw new Error('window.__assistantSeams is not installed (missing ?qaUser=)');
        return seams.feedTranscript(p);
      }, parts),
    endCapture: (mode) =>
      page.evaluate((m) => {
        const seams = window.__assistantSeams;
        if (seams === undefined) throw new Error('window.__assistantSeams is not installed (missing ?qaUser=)');
        return seams.endCapture(m);
      }, mode),
    setSpeechCapability: (state) =>
      page.evaluate((c) => {
        const seams = window.__assistantSeams;
        if (seams === undefined) throw new Error('window.__assistantSeams is not installed (missing ?qaUser=)');
        return seams.setSpeechCapability(c);
      }, state),
    resync,
    aiCallCount: async () => {
      const res = await page.request.get(`${harnessBaseUrl}/__qa__/ai-calls`);
      const body = (await res.json()) as { count: number };
      return body.count;
    },
    fireIdleClose: async (ms) => {
      await page.request.post(`${harnessBaseUrl}/__qa__/advance-clock`, { data: { ms: ms ?? 200_000 } });
      await resync();
    },
    advanceClockMs: async (ms) => {
      await page.request.post(`${harnessBaseUrl}/__qa__/advance-clock`, { data: { ms } });
    },
  };
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const DRAFT_REF_RE = /#d\d+/;

/**
 * State words (AC-29's visible cue per state).
 *
 * `listening` is fixed: the mockup and the app both say "Đang nghe…".
 *
 * `thinking` is NOT pinned to one literal. The design mockup's state word is
 * "Đang nghĩ…"; the running app renders "Đang xử lý…". No AC fixes either
 * string (F-001 "Naming convention"), so pinning one would make this test fail
 * on a wording difference that violates no requirement — and pinning the app's
 * word would be writing the assertion from the implementation. What AC-29
 * actually requires is that the thinking state carry a visible cue, so the
 * alternation below asserts exactly that much and no more. The
 * design↔implementation divergence is reported as drift, not silently
 * absorbed. Same reasoning for the cancel pill ("Huỷ" mockup / "Hủy" app).
 */
const LISTENING_WORD = 'Đang nghe';
const THINKING_WORD = /Đang xử lý|Đang nghĩ/;

export interface TaskRowSnapshot {
  /** First innerText line of the row — the task title. */
  title: string;
  /** Remaining innerText lines (meta/badges/diff), joined. */
  rest: string;
  done: boolean;
}

export class AssistantPage {
  readonly page: Page;

  // ---- the 22-testid catalogue, verbatim ----
  readonly drawerButton: Locator;
  readonly addTaskButton: Locator;
  readonly taskRows: Locator;
  readonly taskCheckboxes: Locator;
  readonly undoButton: Locator;
  readonly chipAffirm: Locator;
  readonly chipNegative: Locator;
  readonly optionChips: Locator;
  readonly retryButton: Locator;
  readonly queuedNotice: Locator;
  readonly boundaryMarker: Locator;
  readonly permissionCta: Locator;
  readonly stateIndicator: Locator;
  readonly offlineBanner: Locator;
  readonly composerInput: Locator;
  readonly micButton: Locator;
  readonly composerSend: Locator;
  readonly messageBubbles: Locator;
  readonly diffOld: Locator;
  readonly diffNew: Locator;
  readonly rowBadges: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawerButton = page.getByTestId('assistant-drawer-button');
    this.addTaskButton = page.getByTestId('assistant-add-task-button');
    this.taskRows = page.getByTestId('assistant-task-row');
    this.taskCheckboxes = page.getByTestId('assistant-task-checkbox');
    this.undoButton = page.getByTestId('assistant-undo-button');
    this.chipAffirm = page.getByTestId('assistant-chip-affirm');
    this.chipNegative = page.getByTestId('assistant-chip-negative');
    this.optionChips = page.getByTestId('assistant-option-chip');
    this.retryButton = page.getByTestId('assistant-retry-button');
    this.queuedNotice = page.getByTestId('assistant-queued-notice');
    this.boundaryMarker = page.getByTestId('assistant-boundary-marker');
    this.permissionCta = page.getByTestId('assistant-permission-cta');
    this.stateIndicator = page.getByTestId('assistant-state-indicator');
    this.offlineBanner = page.getByTestId('assistant-offline-banner');
    this.composerInput = page.getByTestId('assistant-composer-input');
    this.micButton = page.getByTestId('assistant-mic-button');
    this.composerSend = page.getByTestId('assistant-composer-send');
    this.messageBubbles = page.getByTestId('assistant-message-bubble');
    this.diffOld = page.getByTestId('assistant-diff-old');
    this.diffNew = page.getByTestId('assistant-diff-new');
    this.rowBadges = page.getByTestId('assistant-row-badge');
    this.cancelButton = page.getByTestId('assistant-cancel-button');
  }

  // ---- navigation ----

  async open(user: string): Promise<void> {
    await this.page.goto(`/?qaUser=${encodeURIComponent(user)}`);
    await expect(this.composerInput).toBeVisible();
  }

  // ---- seeding via the real /tasks API (manual path — zero AI calls) ----

  /** POST /tasks directly (page.request shares the page's baseURL, so this
   * goes through the same Vite proxy the browser uses). Used to establish
   * preconditions the way a real prior manual action would. */
  async seedTask(
    user: string,
    title: string,
    fields: { due_at?: string | null; priority?: string | null; status?: string } = {},
  ): Promise<{ id: string }> {
    const res = await this.page.request.post('/tasks', {
      headers: { 'X-User-Id': user, 'content-type': 'application/json' },
      data: { title, ...fields },
    });
    if (res.status() !== 201) {
      throw new Error(`seedTask failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { task: { id: string } };
    return { id: body.task.id };
  }

  /** Raw turn POST, bypassing the UI — used only where the UI itself
   * structurally prevents driving a scenario (TC-016: a resolved question's
   * chips are disabled, so a stale/racing answer can only be sent as the
   * literal normal-turn request the tap WOULD have sent). */
  async postTurnRaw(
    user: string,
    body: {
      session_id: string | null;
      client_turn_id: string;
      transcript: string;
      source: 'voice' | 'typed' | 'tap';
      answer_to_turn_id: string | null;
      timezone: string | null;
    },
    request: APIRequestContext = this.page.request,
  ): Promise<{ status: number; body: unknown }> {
    const res = await request.post('/assistant/turn', {
      headers: { 'X-User-Id': user, 'content-type': 'application/json' },
      data: body,
    });
    return { status: res.status(), body: await res.json().catch(() => null) };
  }

  // ---- composer / channels ----

  async typeAndSend(text: string): Promise<void> {
    await this.composerInput.fill(text);
    await this.composerSend.click();
  }

  async typeAndSubmitWithEnter(text: string): Promise<void> {
    await this.composerInput.fill(text);
    await this.composerInput.press('Enter');
  }

  async tapMic(): Promise<void> {
    await this.micButton.click();
  }

  /** AC-3 thinking-state cancel — the pill in the thinking indicator row. (Listening-cancel is the mic tap.) */
  async cancelThinking(): Promise<void> {
    await this.cancelButton.click();
  }

  // ---- state observations (the four states, AC-29) ----

  async expectListening(): Promise<void> {
    await expect(this.stateIndicator).toBeVisible();
    await expect(this.stateIndicator).toContainText(LISTENING_WORD);
    await expect(this.micButton).toHaveAttribute('aria-pressed', 'true');
  }

  async expectThinking(): Promise<void> {
    await expect(this.stateIndicator).toBeVisible();
    await expect(this.stateIndicator).toContainText(THINKING_WORD);
  }

  async expectIdle(): Promise<void> {
    await expect(this.stateIndicator).toBeHidden();
    await expect(this.composerInput).toBeEnabled();
    await expect(this.micButton).toHaveAttribute('aria-pressed', 'false');
  }

  async expectErrorState(): Promise<void> {
    await expect(this.retryButton).toBeVisible();
    await expect(this.stateIndicator).toBeHidden();
  }

  /**
   * Exclusivity probe (TC-031, AC-29): at most one non-idle state cue-set
   * holds at any observation point; idle is none-of-the-above with an
   * interactive composer.
   */
  async currentState(): Promise<'idle' | 'listening' | 'thinking' | 'error'> {
    const indicatorVisible = await this.stateIndicator.isVisible();
    const indicatorText = indicatorVisible ? await this.stateIndicator.innerText() : '';
    const listening = indicatorVisible && indicatorText.includes(LISTENING_WORD);
    const thinking = indicatorVisible && THINKING_WORD.test(indicatorText);
    const error = await this.retryButton.isVisible().catch(() => false);
    const flags = [listening, thinking, error].filter(Boolean);
    expect(flags.length, 'at most one non-idle state cue-set may hold (AC-29)').toBeLessThanOrEqual(1);
    if (listening) return 'listening';
    if (thinking) return 'thinking';
    if (error) return 'error';
    return 'idle';
  }

  // ---- task list pane (the source of truth) ----

  async listSnapshot(): Promise<TaskRowSnapshot[]> {
    const rows = await this.taskRows.all();
    const out: TaskRowSnapshot[] = [];
    for (const row of rows) {
      const lines = (await row.innerText())
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const pressed = await row.getByRole('button').first().getAttribute('aria-pressed').catch(() => null);
      out.push({ title: lines[0] ?? '', rest: lines.slice(1).join(' · '), done: pressed === 'true' });
    }
    return out;
  }

  taskRowByTitle(title: string): Locator {
    return this.taskRows.filter({ hasText: title });
  }

  async expectTaskAbsent(title: string): Promise<void> {
    await expect(this.taskRowByTitle(title)).toHaveCount(0);
  }

  async expectListUnchanged(before: TaskRowSnapshot[]): Promise<void> {
    const after = await this.listSnapshot();
    expect(after).toEqual(before);
  }

  /** Manual row actions — no testid in the catalogue, but each carries a
   * proper accessible name (TaskListPane.tsx), which the selector contract
   * ranks above text/CSS. */
  editButtonFor(title: string): Locator {
    return this.taskRowByTitle(title).getByRole('button', { name: `Sửa “${title}”` });
  }

  deleteButtonFor(title: string): Locator {
    return this.taskRowByTitle(title).getByRole('button', { name: `Xóa “${title}”` });
  }

  checkboxFor(title: string): Locator {
    return this.taskRowByTitle(title).getByTestId('assistant-task-checkbox');
  }

  async renameTaskByTitle(oldTitle: string, newTitle: string): Promise<void> {
    await this.editButtonFor(oldTitle).click();
    // Not `taskRowByTitle(oldTitle).getByRole('textbox')`: TaskRow.tsx swaps
    // the row's text content for an <input> in edit mode, so the row's
    // innerText no longer contains oldTitle once editing starts — a `hasText`
    // filter re-evaluated at this point would find zero rows. The edit
    // input carries the SAME accessible name as the button that opened it
    // (`Sửa "${task.title}"`, and task.title hasn't changed yet), so query
    // by role+name directly instead of re-filtering the row by its old text.
    const input = this.page.getByRole('textbox', { name: `Sửa “${oldTitle}”` });
    await input.fill(newTitle);
    await input.press('Enter');
  }

  // ---- conversation observations ----

  latestBubble(): Locator {
    return this.messageBubbles.last();
  }

  bubbleWithText(text: string | RegExp): Locator {
    return this.messageBubbles.filter({ hasText: text }).last();
  }

  /** Bare text lookup — used ONLY where the copy itself IS the assertion
   * (e.g. TC-018's verbatim transcript echo). Prefer bubbleWithText. */
  messageByText(text: string | RegExp): Locator {
    return this.page.getByText(text).last();
  }

  badgeIn(row: Locator): Locator {
    return row.getByTestId('assistant-row-badge');
  }

  diffOldIn(scope: Locator): Locator {
    return scope.getByTestId('assistant-diff-old');
  }

  diffNewIn(scope: Locator): Locator {
    return scope.getByTestId('assistant-diff-new');
  }

  /** AC-4 honesty scan: no uuid, no #d-style draft-ref anywhere rendered. */
  async expectNoInternalRefsRendered(): Promise<void> {
    const text = await this.page.locator('body').innerText();
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(DRAFT_REF_RE);
  }

  /** Bounded "never a task named undo" check (AC-5/AC-8, TC-008). */
  async expectNoUndoNamedTask(): Promise<void> {
    const titles = (await this.listSnapshot()).map((r) => r.title.toLowerCase());
    for (const t of titles) {
      expect(t).not.toBe('undo');
      expect(t).not.toBe('hoàn tác');
    }
  }

  // ---- wire capture ----

  captureTurnRequests(): Request[] {
    const captured: Request[] = [];
    this.page.on('request', (req) => {
      if (req.url().includes('/assistant/turn') && req.method() === 'POST') captured.push(req);
    });
    return captured;
  }

  /** Every request to /assistant/* observed on this page since attach —
   * the black-box proof for AC-18's "zero AI calls" during manual ops. */
  captureAssistantRequests(): Request[] {
    const captured: Request[] = [];
    this.page.on('request', (req) => {
      if (/\/assistant\//.exec(req.url()) !== null) captured.push(req);
    });
    return captured;
  }

  // ---- accessibility helpers ----

  /**
   * WCAG 4.1.3 (TC-033/TC-034, AC-19). The conversation surface IS the live
   * region — the region a status message must land *inside* to be announced.
   */
  conversationLog(): Locator {
    return this.page.getByRole('log');
  }

  /** Assertive regions currently on the page (error bubbles — AC-19's "announced immediately"). */
  alertRegions(): Locator {
    return this.page.getByRole('alert');
  }

  /**
   * The falsifiable half of 4.1.3: a live region only announces nodes added
   * INSIDE it. Asserting the region exists proves nothing on its own — a
   * message rendered as a sibling of the region is visible but silent, which
   * is exactly the F103 failure AC-19 names. So this checks containment, by
   * running `Node.contains` in the page rather than trusting layout.
   */
  async expectInsideLiveRegion(target: Locator): Promise<void> {
    const region = this.conversationLog();
    await expect(region).toHaveCount(1);
    // Fail fast and legibly if the message itself never rendered, rather than
    // letting the evaluate below sit on a never-resolving locator.
    await expect(target).toBeVisible();
    const contained = await target.evaluate((el) => {
      const live = el.closest('[role="log"], [role="alert"], [role="status"], [aria-live]');
      return {
        found: live !== null,
        role: live?.getAttribute('role') ?? null,
        live: live?.getAttribute('aria-live') ?? null,
      };
    });
    expect(contained.found, 'message must render inside a live region, not beside it').toBe(true);
    // role=log has an implicit aria-live of polite; role=alert an implicit assertive.
    expect([contained.role, contained.live]).not.toEqual([null, null]);
  }

  /**
   * AC-19 explicitly rejects announcing the state word alone: the announced
   * text must carry the same information a sighted user reads — what changed,
   * how many, which tasks by title, and that undo is available. This reads the
   * live region's text and requires each expected fragment to be present.
   */
  async expectAnnounced(fragments: Array<string | RegExp>): Promise<void> {
    const text = await this.conversationLog().innerText();
    for (const f of fragments) {
      if (typeof f === 'string') expect(text, `live region must announce "${f}"`).toContain(f);
      else expect(text, `live region must announce ${String(f)}`).toMatch(f);
    }
  }

  /** WCAG 1.4.3 (TC-023): contrast ratio of a locator's fg over its effective (alpha-composited) bg. */
  async contrastRatio(target: Locator): Promise<number> {
    return target.evaluate((el) => {
      const parse = (c: string): [number, number, number, number] => {
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (m === null) return [0, 0, 0, 1];
        const p = m[1]!.split(',').map((v) => parseFloat(v));
        return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p.length > 3 ? (p[3] ?? 1) : 1];
      };
      const effectiveBg = (start: Element | null): [number, number, number] => {
        let acc: [number, number, number] = [255, 255, 255];
        const chain: Array<[number, number, number, number]> = [];
        let node = start;
        while (node !== null) {
          chain.push(parse(getComputedStyle(node).backgroundColor));
          node = node.parentElement;
        }
        for (let i = chain.length - 1; i >= 0; i--) {
          const layer = chain[i];
          if (layer === undefined) continue;
          const [r, g, b, a] = layer;
          acc = [acc[0] * (1 - a) + r * a, acc[1] * (1 - a) + g * a, acc[2] * (1 - a) + b * a];
        }
        return acc;
      };
      const lum = (rgb: [number, number, number]): number => {
        const f = (v: number): number => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
      };
      const fgRaw = parse(getComputedStyle(el).color);
      const fg: [number, number, number] = [fgRaw[0], fgRaw[1], fgRaw[2]];
      const bg = effectiveBg(el);
      const l1 = lum(fg);
      const l2 = lum(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    });
  }

  /** WCAG 2.5.3 (TC-024): accessible name contains the visible label. */
  async expectLabelInName(control: Locator): Promise<void> {
    const visible = (await control.innerText()).trim().toLowerCase();
    if (visible === '') return; // icon-only: vacuously satisfied; names asserted in TC-022
    const accName = (await control.getAttribute('aria-label')) ?? (await control.innerText());
    expect(accName.trim().toLowerCase()).toContain(visible);
  }
}

// Ambient shape of the test-mode-only global (src/assistant/web/seams.ts).
declare global {
  interface Window {
    __assistantSeams?: {
      feedTranscript(parts: string[]): Promise<void>;
      endCapture(mode: 'speech-end' | 'speech-end-empty' | 'cancelled'): Promise<void>;
      setSpeechCapability(
        state: 'available' | 'none' | 'permission-denied' | 'transient-failure' | 'recovered',
      ): Promise<void>;
      resync(): Promise<void>;
    };
  }
}
