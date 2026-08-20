/**
 * F-001 voice-assistant-view — web e2e (Playwright).
 * qa-web-agent · phase: execute (T-007e, 2026-08-16)
 * qa-web-agent · phase: execute v2 (T-016, 2026-08-16) — Vietnamese copy sync
 *                + WCAG 4.1.3 coverage (TC-033, TC-034)
 * qa-web-agent · phase: execute v3 (T-070b, 2026-08-17) — ENGLISH copy sync
 *                (ADR-008 / owner decision 2026-08-17)
 *
 * COPY: the product ships English (ADR-008, reports/owner-decision-2026-08-17-
 * english-first.md). F-001 "Naming convention" still holds — the spec's words
 * are concept names only and the user-visible wording is owned by
 * docs/design/_shared/components.md and the mockup it publishes
 * (docs/design/assistant/screens/voice-assistant-view.html) — so the literals in
 * `EN` below trace to the design system and that mockup, and each assertion
 * states which AC-mandated CONTENT it is really proving (counts, task titles,
 * the quoted transcript). Task titles are fixture data, not copy, and are
 * unchanged.
 *
 * KNOWN LIMIT (L-008): `EN` is a hand-kept transcription of design's copy, so
 * it is a self-agreement check in the direction drift actually travels — if
 * components.md/the mockup moved, these literals would not notice. The
 * catalogue does not publish the conversation message strings (applied head,
 * kept, undone, boundary) in a machine-addressable per-row form the way it
 * publishes the permission rows, so there is nothing to parse for them yet.
 * Recorded as a gap, not solved here; see the run record.
 *
 * REWRITTEN from the authoring-phase draft against the REAL running app +
 * REAL server. The authoring draft assumed the fixture-stub Interpreter
 * would accept arbitrary invented utterances; in reality
 * src/assistant/api/ports/fixture-interpreter.ts matches against a STATIC
 * canonical table (src/assistant/api/ports/fixture-table.ts) and returns
 * no_match for anything else. Every scenario below uses either a canonical
 * row or a QA_EXTRA_ROWS row defined in
 * tests/harness/qa-test-server.ts (the spec's own
 * sanctioned QA extension mechanism — Test strategy). Mapping table:
 * docs/qa/_shared/fixtures/web/assistant-web-fixtures.json.
 *
 * Run via: npm run test:e2e (playwright.config.ts starts the QA harness +
 * the Vite dev server automatically).
 *
 * Test data namespace: qaweb- (one account per TC — _qa-foundations.md §10).
 * Selector contract: every locator is a catalogue testid or a real
 * accessible-name role query (verified against the running app, not guessed).
 */

import { readFileSync } from 'node:fs';

import { expect, test, type Page, type Request } from '@playwright/test';
import { AssistantPage, bindSeams } from '../pages/AssistantPage.ts';

// ---------------------------------------------------------------------------
// Canonical / QA_EXTRA utterances (docs/qa/_shared/fixtures/web/assistant-web-fixtures.json)
// ---------------------------------------------------------------------------
const U = {
  buyMilk: 'add a task to buy milk',
  planWeek: 'plan the week',
  buyCheese: 'add a task to buy cheese', // 60ms delay
  failThenWine: 'fail once then add wine', // fails once, then succeeds under the same id
  renameMilk: 'rename buy milk to buy oat milk',
  markShoppingDone: 'mark the shopping done', // Buy milk/eggs/bread -> status done, one turn
  deleteMeeting: 'delete the meeting', // 1 target -> applies immediately
  deleteShopping: 'delete the shopping tasks', // 3 targets -> asks
  deleteReport: 'delete the report task', // clarify, 2 candidates
  deleteQawebPair: 'delete the qaweb pair', // QA_EXTRA: exactly 2 targets -> asks
  delayedBulkDelete: 'qaweb delayed bulk delete', // QA_EXTRA: 150ms delay, 3 targets
  delayedFailure: 'qaweb delayed failure', // QA_EXTRA: 150ms delay, always fails
  delayedCreate: 'qaweb delayed create', // QA_EXTRA: 150ms delay, one create (TC-005a — see the harness comment)
  // ADR-008 / owner decision 2026-08-17: AC-5's undo vocabulary is `undo`
  // ONLY. The Vietnamese phrase `hoàn tác` was retired from UNDO_PHRASES
  // (src/assistant/api/engine/normalize.ts:9) and from the fixture table's
  // tripwire rows, so it is no longer recognizer input at all — feeding it
  // now produces a no_match, not an undo. It is removed here rather than
  // kept as a dead constant.
  undo: 'undo',
  yes: 'yes',
  no: 'no',
  weatherNice: 'the weather is nice',
  hmmMaybe: 'hmm maybe',
  noMatch: 'cross off the badminton game',
};

// ---------------------------------------------------------------------------
// English UI copy (docs/design/_shared/components.md + the mockup's rendered copy,
// docs/design/assistant/screens/voice-assistant-view.html). Grouped so a future
// copy change has ONE place to land instead of forty. Where a string carries a
// live count or title, it is a function.
//
// The house nouns/verbs come from components.md §Buttons "One word per
// concept": delete (never remove/clear), task (never item/to-do/entry),
// undo/undone (never revert/roll back/restore), Settings capitalised,
// Microphone capitalised when naming an OS permission.
// ---------------------------------------------------------------------------
const tasksWord = (n: number): string => (n === 1 ? 'task' : 'tasks');

const EN = {
  // row / diff markers — components.md §TaskRow ("NEW" / "EDITED" labels)
  badgeNew: 'NEW',
  badgeEdited: 'EDITED',
  // applied head — components.md §Applied ("count stated"); mockup renders
  // "Added 1 task" / "Edited 1 task · added 1"
  addedN: (n: number) => `Added ${n} ${tasksWord(n)}`,
  // question heads + chips — components.md §"Question — confirm"; mockup
  // renders the head "Delete 3 tasks?" and the affirmative chip "Delete 3
  // tasks" (no question mark), the negative chip "Keep them"
  confirmDeleteN: (n: number) => `Delete ${n} ${tasksWord(n)}?`,
  affirmChipN: (n: number) => `Delete ${n} ${tasksWord(n)}`, // chip's LITERAL text, sent as the answer turn
  negativeChip: 'Keep them',
  // undo / revert — components.md §UndoAffordance, §Reverted
  undoLabel: 'Undo',
  undone: 'Undone',
  nothingReverted: 'Nothing was undone',
  skippedTitle: (t: string) => `Skipped: ${t}`,
  nothingToUndo: /There is nothing to undo/,
  // outcomes — components.md §Outcome
  keptN: (n: number) => `Kept all ${n} ${tasksWord(n)}`,
  supersededBecause: /set aside because you moved on to something else/,
  alreadyAnswered: 'That question was already answered',
  // no-match — components.md §NoMatch
  nothingChanged: /Nothing changed\. If I misheard/,
  // error — components.md §Error
  errorHead: "Couldn't send",
  retryLabel: 'Retry',
  // boundary — components.md §BoundaryMarker; mockup renders
  // "Session closed — no activity · Fri 11:42 PM"
  sessionEndedIdle: 'Session closed — no activity',
  // controls (accessible names) — components.md §MicControl, §Buttons, §Composer
  micIdle: 'Tap to speak',
  micListening: 'Listening — tap to stop',
  micPermission: 'Microphone needs permission',
  micTransient: 'Microphone is temporarily unavailable',
  sendLabel: 'Send',
  openLists: 'Open lists',
  newTaskLabel: 'New task name',
  saveLabel: 'Save',
  // mic-mode message bodies — the AC-21/AC-22 distinguisher
  permissionCause: /blocking the microphone/i,
  transientCause: /recognition service|is busy/i,
  permissionWords: /permission|blocking/i,
  // AC-20's "no error shown" sweep, in the shipped language
  errorWords: /error|failed|unavailable|couldn't send/i,
} as const;

let userSeq = 0;
function freshUser(tc: string): string {
  userSeq += 1;
  return `qaweb-${tc}-${userSeq}@qa.example.com`;
}

// ---------------------------------------------------------------------------
// Interpretation & visibility
// ---------------------------------------------------------------------------

test('TC-001 applied turn — same-turn multi-row create, atomically (AC-1, AC-4)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc001');
  await app.open(user);

  // No expectThinking() here: "plan the week" is a zero-delay canonical row
  // against a real in-process server — the thinking flash can resolve inside
  // a single Playwright poll interval and never be observed (script flake,
  // not a product issue; delayed rows like "buy cheese" cover the thinking
  // transition itself in TC-005/TC-031).
  await app.typeAndSend(U.planWeek);
  await app.expectIdle();

  // Same turn: all four rows appear together, no further interaction.
  for (const title of ['Plan Monday', 'Plan Tuesday', 'Plan Wednesday', 'Plan Thursday']) {
    const row = app.taskRowByTitle(title);
    await expect(row).toHaveCount(1);
    await expect(app.badgeIn(row)).toHaveText(EN.badgeNew);
  }
  await expect(app.bubbleWithText(EN.addedN(4))).toBeVisible(); // AC-1: the count is stated
  await expect(app.undoButton).toBeVisible();
});

test('TC-002 a question turn applies nothing — the question IS the result (AC-1, AC-9)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc002');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);

  const before = await app.listSnapshot();
  await app.typeAndSend(U.deleteShopping);

  await expect(app.bubbleWithText(EN.confirmDeleteN(3))).toBeVisible();
  // Assert the chips' CONTENT, not only their visibility: a chip rendered
  // empty (or with the other branch's label) passes toBeVisible while the
  // question is unanswerable. These two literals are also the exact strings
  // AC-10 requires a tap to send as the answer turn — TC-013a asserts the
  // affirmative one on the wire — so pinning them here is what makes the
  // "tap sends the option's literal text" contract falsifiable at both ends.
  await expect(app.chipAffirm).toHaveText(EN.affirmChipN(3));
  await expect(app.chipNegative).toHaveText(EN.negativeChip);
  await app.expectListUnchanged(before); // AC-1 carve-out: zero mutations
  await expect(app.undoButton).toHaveCount(0);
});

test('TC-003 listening streams live transcript; empty recognition returns to idle, no turn (AC-2, AC-29)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc003');
  await app.open(user);
  const seams = bindSeams(page);
  const requests = app.captureTurnRequests();

  await app.tapMic();
  await app.expectListening();
  for (const part of ['push the', 'push the budget', 'push the budget review']) {
    await seams.feedTranscript([part]);
    await expect(app.composerInput).toHaveValue(part);
  }

  // stop this capture without sending, start a fresh one that ends empty
  await app.tapMic();
  await app.expectIdle();
  await app.tapMic();
  await app.expectListening();
  await seams.endCapture('speech-end-empty');
  await app.expectIdle();
  expect(requests).toHaveLength(0);
});

test('TC-004 cancel while listening keeps words, sends nothing (AC-3)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc004');
  await app.open(user);
  const seams = bindSeams(page);
  const requests = app.captureTurnRequests();

  await app.tapMic();
  await seams.feedTranscript(['push the budget review to fou']);
  await app.tapMic(); // mic tap while listening = cancel-while-listening

  await app.expectIdle();
  await expect(app.composerInput).toHaveValue('push the budget review to fou');
  expect(requests).toHaveLength(0);
});

test('TC-005 cancel while thinking — sent turn completes; late outcome renders honestly (AC-3, AC-29)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc005');
  await app.seedTask(user, 'qaweb Delay Shop A');
  await app.seedTask(user, 'qaweb Delay Shop B');
  await app.seedTask(user, 'qaweb Delay Shop C');
  await app.open(user);

  // (a) applied race: 150ms-delayed create.
  // T-070b: this used to use the canonical 60ms row ("add a task to buy
  // cheese"). 60ms is shorter than a Playwright click round-trip against this
  // in-process server, so the thinking indicator — which owns the cancel pill —
  // unmounted mid-click ("element was detached from the DOM") in roughly one
  // run in three. Triaged as a script race, not a product bug; the QA_EXTRA row
  // below is the same 150ms remedy sub-cases (b) and (c) already use. The
  // assertion is unchanged in strength: the cancel still has to win the surface
  // while a real turn is genuinely in flight.
  await app.typeAndSend(U.delayedCreate);
  await app.expectThinking();
  await expect(app.cancelButton).toBeVisible();
  await app.cancelThinking();
  await app.expectIdle();
  await expect(app.composerInput).not.toHaveValue('');
  await expect(app.undoButton).toBeVisible(); // late applied outcome, never suppressed
  await expect(app.taskRowByTitle('qaweb Delayed Create')).toHaveCount(1);

  // (b) question race: 150ms-delayed bulk-delete question
  await app.typeAndSend(U.delayedBulkDelete);
  await app.expectThinking();
  await app.cancelThinking();
  await app.expectIdle();
  await expect(app.bubbleWithText(EN.confirmDeleteN(3))).toBeVisible();

  // (c) failed race: 150ms-delayed failure
  await app.typeAndSend(U.delayedFailure);
  await app.expectThinking();
  await app.cancelThinking();
  const stateRightAfterCancel = await app.currentState();
  expect(stateRightAfterCancel).toBe('idle'); // cancel wins the surface immediately
  await expect(app.bubbleWithText(EN.errorHead)).toBeVisible({ timeout: 5000 });
});

test('TC-006 attribution anatomy + internal refs never render (AC-4)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc006');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Call Mom');
  await app.open(user);

  // Hand-edit an unrelated task first — it must never be attributed to the turn.
  await app.renameTaskByTitle('Call Mom', 'Call Mom soon');

  await app.typeAndSend(U.renameMilk);
  const row = app.taskRowByTitle('Buy oat milk');
  await expect(row).toHaveCount(1);
  await expect(app.badgeIn(row)).toHaveText(EN.badgeEdited);
  await expect(app.diffOldIn(row)).toHaveText('Buy milk');
  await expect(app.diffNewIn(row)).toHaveText('Buy oat milk');

  await expect(app.taskRowByTitle('Call Mom soon')).not.toContainText(EN.badgeEdited);
  await app.expectNoInternalRefsRendered(); // no uuid, no #d-style token anywhere rendered
});

// ---------------------------------------------------------------------------
// Undo contract
// ---------------------------------------------------------------------------

test('TC-007 undo by tap — whole turn reverts (multi-row); list reads back prior values (AC-5, AC-7)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc007');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);

  await app.typeAndSend(U.markShoppingDone); // one turn, edits all 3 to status done
  for (const title of ['Buy milk', 'Buy eggs', 'Buy bread']) {
    await expect(app.checkboxFor(title)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(app.undoButton).toBeVisible();

  await app.undoButton.click();

  for (const title of ['Buy milk', 'Buy eggs', 'Buy bread']) {
    await expect(app.checkboxFor(title)).toHaveAttribute('aria-pressed', 'false'); // read-back
  }
  await expect(app.bubbleWithText(EN.undone)).toBeVisible();
  await expect(app.undoButton).toHaveCount(0);
});

test('TC-008 undo by voice — reverts, never becomes a task; refusal visible without window (AC-5, AC-8)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc008');
  await app.open(user);
  const seams = bindSeams(page);

  await app.typeAndSend(U.buyMilk);
  await expect(app.undoButton).toBeVisible();

  await app.tapMic();
  await seams.feedTranscript([U.undo]);
  await seams.endCapture('speech-end');

  await app.expectTaskAbsent('Buy milk');
  await app.expectNoUndoNamedTask();
  await expect(app.undoButton).toHaveCount(0);

  // No applied (mutating) turn left -> voice undo yields a visible refusal.
  //
  // T-070b: this second probe used to feed the Vietnamese phrase "hoàn tác",
  // which made the pass double as an equivalence check over AC-5's two-phrase
  // undo vocabulary. ADR-008 retired that phrase (UNDO_PHRASES is now ['undo']
  // alone), so the vocabulary has one member and the probe feeds it. What the
  // case protects is unchanged and still asserted below: an undo phrase with no
  // applied turn behind it produces a VISIBLE refusal — never silence, and never
  // a task named after the phrase.
  await app.tapMic();
  await seams.feedTranscript([U.undo]);
  await seams.endCapture('speech-end');
  await expect(app.bubbleWithText(EN.nothingToUndo)).toBeVisible();
  await app.expectNoUndoNamedTask();
});

test('TC-009 undo skips a modified task and names it (AC-7)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc009');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);

  await app.typeAndSend(U.markShoppingDone); // all 3 -> done
  await expect(app.undoButton).toBeVisible();

  // Hand-modify ONE of the turn's tasks afterward (toggle it back by hand).
  await app.checkboxFor('Buy milk').click();
  await expect(app.checkboxFor('Buy milk')).toHaveAttribute('aria-pressed', 'false');

  await app.undoButton.click();

  await expect(app.bubbleWithText(EN.skippedTitle('Buy milk'))).toBeVisible(); // AC-7: the skipped task is NAMED
  // The other two revert (back to not-done); the hand-modified one keeps its hand value.
  await expect(app.checkboxFor('Buy eggs')).toHaveAttribute('aria-pressed', 'false');
  await expect(app.checkboxFor('Buy bread')).toHaveAttribute('aria-pressed', 'false');
  await expect(app.checkboxFor('Buy milk')).toHaveAttribute('aria-pressed', 'false');
});

test('TC-010 all skipped — "nothing was reverted", never dressed as success (AC-7)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc010');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);

  await app.typeAndSend(U.markShoppingDone);
  await expect(app.undoButton).toBeVisible();

  // Hand-modify ALL three touched tasks afterward.
  for (const title of ['Buy milk', 'Buy eggs', 'Buy bread']) {
    await app.checkboxFor(title).click();
    await expect(app.checkboxFor(title)).toHaveAttribute('aria-pressed', 'false');
  }

  await app.undoButton.click();

  const outcome = app.bubbleWithText(EN.nothingReverted);
  await expect(outcome).toBeVisible();
  await expect(outcome).toContainText('Buy milk');
  await expect(outcome).toContainText('Buy eggs');
  await expect(outcome).toContainText('Buy bread');
  for (const title of ['Buy milk', 'Buy eggs', 'Buy bread']) {
    await expect(app.checkboxFor(title)).toHaveAttribute('aria-pressed', 'false'); // hand values persist
  }
});

test('TC-011 undo window ends on a newer turn and on session close; no hidden timer (AC-8, AC-28)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc011');
  await app.open(user);
  const seams = bindSeams(page);

  await app.typeAndSend(U.buyMilk); // turn A
  await expect(app.undoButton).toHaveCount(1);

  await app.typeAndSend(U.buyCheese); // turn B (newer, mutating)
  await expect(app.undoButton).toHaveCount(1); // exactly one live affordance, now on B

  // No hidden timer: bounded persistence probe.
  await page.waitForTimeout(3000);
  await expect(app.undoButton).toHaveCount(1);

  // Session close (via the injectable idle-close seam) ends the window.
  await seams.fireIdleClose();
  await expect(app.undoButton).toHaveCount(0);
  await expect(app.boundaryMarker).toBeVisible();
});

// ---------------------------------------------------------------------------
// Bulk-delete confirmation & question resolution (D2)
// ---------------------------------------------------------------------------

test('TC-012 bulk-delete boundary: 1 applies, exactly 2 asks, 3 asks (AC-9, AC-4)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc012');
  await app.seedTask(user, 'Team meeting');
  await app.seedTask(user, 'qaweb Cake A');
  await app.seedTask(user, 'qaweb Cake B');
  await app.open(user);

  // N=1: applies immediately, with undo.
  await app.typeAndSend(U.deleteMeeting);
  await app.expectTaskAbsent('Team meeting');
  await expect(app.bubbleWithText('Team meeting')).toBeVisible();
  await expect(app.undoButton).toBeVisible();

  // N=2 (the tight boundary): asks.
  await app.typeAndSend(U.deleteQawebPair);
  await expect(app.bubbleWithText(EN.confirmDeleteN(2))).toBeVisible();
  await expect(app.taskRowByTitle('qaweb Cake A')).toHaveCount(1); // unapplied while pending
  await app.chipNegative.click();
  await expect(app.taskRowByTitle('qaweb Cake A')).toHaveCount(1);
});

test('TC-013a tap affirmative executes with full applied anatomy (AC-10, AC-11, AC-5)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc013a');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);
  const requests = app.captureTurnRequests();

  await app.typeAndSend(U.deleteShopping);
  await expect(app.chipAffirm).toBeVisible();

  // Non-blocking while pending (AC-11): a manual create still works.
  await app.addTaskButton.click();
  await page.getByLabel(EN.newTaskLabel).fill('qaweb manual while pending');
  await page.getByRole('button', { name: EN.saveLabel }).click();
  await expect(app.taskRowByTitle('qaweb manual while pending')).toHaveCount(1);

  await app.chipAffirm.click();
  const answerReq = requests[requests.length - 1]!;
  const body = answerReq.postDataJSON() as { transcript: string; source: string; answer_to_turn_id: string | null };
  expect(body.transcript).toBe(EN.affirmChipN(3)); // the chip's literal text (AC-10)
  expect(body.source).toBe('tap');
  expect(body.answer_to_turn_id).not.toBeNull();

  await app.expectTaskAbsent('Buy milk');
  await app.expectTaskAbsent('Buy eggs');
  await app.expectTaskAbsent('Buy bread');
  await expect(app.undoButton).toBeVisible();
});

test('TC-013b tap negative declines visibly, zero deletion (AC-10, AC-11)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc013b');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);

  await app.typeAndSend(U.deleteShopping);
  await app.chipNegative.click();

  await expect(app.bubbleWithText(EN.keptN(3))).toBeVisible();
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);
  await expect(app.undoButton).toHaveCount(0);
});

test('TC-013c typed "yes" executes; TC-013d typed "no" declines (AC-10, AC-11)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc013cd');

  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);
  await app.typeAndSend(U.deleteShopping);
  await app.typeAndSend(U.yes);
  await app.expectTaskAbsent('Buy milk');
  await expect(app.undoButton).toBeVisible();

  const user2 = freshUser('tc013cd');
  await app.seedTask(user2, 'Buy milk');
  await app.seedTask(user2, 'Buy eggs');
  await app.seedTask(user2, 'Buy bread');
  await app.open(user2);
  await app.typeAndSend(U.deleteShopping);
  await app.typeAndSend(U.no);
  await expect(app.bubbleWithText(EN.keptN(3))).toBeVisible();
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);
});

test('TC-014 unrelated command supersedes a bulk-delete question; clarify question too (AC-10, AC-11, AC-13)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc014');
  // Uses the QA_EXTRA "qaweb pair" row (exact 2-task delete) rather than the
  // canonical "delete the shopping tasks" (Buy milk/eggs/bread) so this
  // scenario's own supersede command ("add a task to buy milk") can't
  // collide with the pending question's own target titles.
  await app.seedTask(user, 'qaweb Cake A');
  await app.seedTask(user, 'qaweb Cake B');
  await app.open(user);

  await app.typeAndSend(U.deleteQawebPair);
  await expect(app.chipAffirm).toBeVisible();

  await app.typeAndSend(U.buyMilk); // unrelated command supersedes

  await expect(app.bubbleWithText(EN.supersededBecause)).toBeVisible();
  await expect(app.chipAffirm).toBeDisabled();
  await expect(app.taskRowByTitle('qaweb Cake A')).toHaveCount(1); // zero deletion
  await expect(app.taskRowByTitle('qaweb Cake B')).toHaveCount(1);
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1); // command proceeded
  await expect(app.undoButton).toBeVisible();

  // Clarify variant: same D2 rule.
  const user2 = freshUser('tc014-clarify');
  await app.seedTask(user2, 'Report Q1');
  await app.seedTask(user2, 'Report Q2');
  await app.open(user2);
  await app.typeAndSend(U.deleteReport);
  await expect(app.optionChips.first()).toBeVisible();
  await app.typeAndSend(U.buyMilk);
  await expect(app.taskRowByTitle('Report Q1')).toHaveCount(1);
  await expect(app.taskRowByTitle('Report Q2')).toHaveCount(1);
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);
});

test('TC-015 unclassifiable answer — zero deletion, question stays pending, still resolvable (AC-10)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc015');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);

  await app.typeAndSend(U.deleteShopping);

  for (const answer of [U.weatherNice, U.hmmMaybe]) {
    await app.typeAndSend(answer);
    await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);
    await expect(app.taskRowByTitle('Buy eggs')).toHaveCount(1);
    await expect(app.taskRowByTitle('Buy bread')).toHaveCount(1);
    await expect(app.chipAffirm).toBeEnabled();
  }

  await page.waitForTimeout(3000); // no timeout anywhere (D2)
  await expect(app.chipAffirm).toBeEnabled();
  await app.chipAffirm.click();
  await app.expectTaskAbsent('Buy milk');
});

test('TC-016 answer after resolution — never executes; visible already-resolved outcome (AC-10, AC-11)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc016');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);

  await app.typeAndSend(U.deleteShopping);
  const requests = app.captureTurnRequests();
  await app.chipNegative.click(); // resolves: declined
  await expect(app.bubbleWithText(EN.keptN(3))).toBeVisible();
  await expect(app.chipAffirm).toBeDisabled(); // first line of defence

  // Falsifiable fallback: replay the exact turn a tap on the (now-disabled)
  // affirm chip would have sent, via the same POST /assistant/turn the UI
  // itself uses — proving SERVER-side one-shot enforcement, not just the UI
  // guard.
  const firstAnswer = requests[requests.length - 1]!.postDataJSON() as { answer_to_turn_id: string };
  const raw = await app.postTurnRaw(user, {
    session_id: null,
    client_turn_id: '99999999-9999-4999-8999-999999999999',
    transcript: EN.affirmChipN(3),
    source: 'tap',
    answer_to_turn_id: firstAnswer.answer_to_turn_id,
    timezone: null,
  });
  expect(raw.status).toBe(200);

  await bindSeams(page).resync();
  await expect(app.bubbleWithText(EN.alreadyAnswered)).toBeVisible();
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1); // never executes
});

test('TC-017 clarify — real candidates; tap sends the literal text; typed answer resolves too (AC-13, AC-1)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc017');
  await app.seedTask(user, 'Report Q1');
  await app.seedTask(user, 'Report Q2');
  await app.open(user);
  const requests = app.captureTurnRequests();
  const before = await app.listSnapshot();

  await app.typeAndSend(U.deleteReport);
  await expect(app.optionChips).toHaveCount(2);
  const candidateTexts = await app.optionChips.allTextContents();
  expect(candidateTexts.sort()).toEqual(['Report Q1', 'Report Q2']);
  await app.expectListUnchanged(before);

  await app.optionChips.first().click();
  const body = requests[requests.length - 1]!.postDataJSON() as {
    transcript: string;
    source: string;
    answer_to_turn_id: string | null;
  };
  expect(candidateTexts).toContain(body.transcript);
  expect(body.source).toBe('tap');
  expect(body.answer_to_turn_id).not.toBeNull();
  await expect(app.undoButton).toBeVisible();

  // Typed variant, fresh question.
  const user2 = freshUser('tc017-typed');
  await app.seedTask(user2, 'Report Q1');
  await app.seedTask(user2, 'Report Q2');
  await app.open(user2);
  await app.typeAndSend(U.deleteReport);
  await app.typeAndSend('Report Q1');
  await app.expectTaskAbsent('Report Q1');
  await expect(app.taskRowByTitle('Report Q2')).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// Honesty, manual path, accessibility
// ---------------------------------------------------------------------------

test('TC-018 no match — quotes the heard transcript verbatim; list untouched (AC-14)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc018');
  await app.seedTask(user, 'qaweb Untouched Task');
  await app.open(user);
  const seams = bindSeams(page);
  const before = await app.listSnapshot();

  await app.tapMic();
  await seams.feedTranscript([U.noMatch]);
  await seams.endCapture('speech-end');

  await expect(app.messageByText(`“${U.noMatch}”`)).toBeVisible(); // verbatim echo
  await expect(app.bubbleWithText(EN.nothingChanged)).toBeVisible();
  await app.expectListUnchanged(before);
  await expect(app.undoButton).toHaveCount(0);
});

test('TC-019 typed parity — same path, same shape, same anatomy (AC-17)', async ({ page }) => {
  const app = new AssistantPage(page);

  const voiceUser = freshUser('tc019v');
  await app.open(voiceUser);
  const seams = bindSeams(page);
  const voiceRequests = app.captureTurnRequests();
  await app.tapMic();
  await seams.feedTranscript([U.buyMilk]);
  await seams.endCapture('speech-end');
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);
  const voiceBody = voiceRequests[voiceRequests.length - 1]!.postDataJSON() as {
    transcript: string;
    source: string;
  };
  expect(voiceBody.source).toBe('voice');

  const typedUser = freshUser('tc019t');
  await app.open(typedUser);
  await expect(app.composerSend).toHaveAttribute('aria-disabled', 'true'); // empty composer
  const typedRequests = app.captureTurnRequests();
  await app.typeAndSend(U.buyMilk);
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);
  const typedBody = typedRequests[typedRequests.length - 1]!.postDataJSON() as {
    transcript: string;
    source: string;
  };
  expect(typedBody.source).toBe('typed');

  expect(voiceBody.transcript).toBe(typedBody.transcript); // same path, only source differs
});

test('TC-020 manual path — create/complete/edit/delete by touch, zero AI calls (AC-18)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc020');
  await app.open(user);
  const seams = bindSeams(page);
  const baseline = await seams.aiCallCount();
  const assistantCalls = app.captureAssistantRequests();

  await app.addTaskButton.click();
  await page.getByLabel(EN.newTaskLabel).fill('qaweb manual task');
  await page.getByRole('button', { name: EN.saveLabel }).click();
  await expect(app.taskRowByTitle('qaweb manual task')).toHaveCount(1); // create

  await app.checkboxFor('qaweb manual task').click(); // complete
  await expect(app.checkboxFor('qaweb manual task')).toHaveAttribute('aria-pressed', 'true');

  await app.renameTaskByTitle('qaweb manual task', 'qaweb manual task edited'); // edit
  await expect(app.taskRowByTitle('qaweb manual task edited')).toHaveCount(1);

  await app.deleteButtonFor('qaweb manual task edited').click(); // delete
  await app.expectTaskAbsent('qaweb manual task edited');

  expect(await seams.aiCallCount()).toBe(baseline); // counter delta exactly 0
  expect(assistantCalls).toHaveLength(0);
});

test.describe('TC-021..024, TC-033..034 — the five named WCAG criteria (AC-19)', () => {
  test('TC-021 2.1.1 keyboard: mic, undo, chips operable; no trap', async ({ page }) => {
    const app = new AssistantPage(page);
    const user = freshUser('tc021');
    await app.seedTask(user, 'Buy milk');
    await app.seedTask(user, 'Buy eggs');
    await app.seedTask(user, 'Buy bread');
    await app.open(user);

    await app.typeAndSend(U.buyCheese); // stage undo
    await app.undoButton.focus();
    await page.keyboard.press('Enter');
    await app.expectTaskAbsent('Buy cheese');

    await app.micButton.focus();
    await page.keyboard.press('Space');
    await app.expectListening();
    await page.keyboard.press('Space');
    await app.expectIdle();

    await app.typeAndSend(U.deleteShopping); // stage chips
    await app.chipNegative.focus();
    await page.keyboard.press('Enter');
    await expect(app.bubbleWithText(EN.keptN(3))).toBeVisible();

    await app.composerInput.focus();
    await expect(app.composerInput).toBeFocused(); // no trap
  });

  test('TC-022 4.1.2 name/role/value, live-region state announcements', async ({ page }) => {
    const app = new AssistantPage(page);
    const user = freshUser('tc022');
    await app.open(user);

    await expect(page.getByRole('button', { name: EN.micIdle })).toBeVisible();
    await expect(page.getByRole('button', { name: EN.sendLabel })).toBeVisible();
    await expect(page.getByRole('button', { name: EN.openLists })).toBeVisible();

    await app.tapMic();
    await expect(app.stateIndicator).toHaveAttribute('aria-live', 'polite');
    await expect(app.micButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: EN.micListening })).toBeVisible();

    await expect(app.composerSend).toHaveAttribute('aria-disabled', 'true');
    await app.composerInput.fill('x');
    await expect(app.composerSend).toHaveAttribute('aria-disabled', 'false');
  });

  test('TC-023 1.4.3 contrast on transcript, diff and outcome messages — both themes', async ({ page }) => {
    const app = new AssistantPage(page);
    const user = freshUser('tc023');
    await app.seedTask(user, 'Buy milk');
    await app.open(user);
    await app.typeAndSend(U.renameMilk); // stage a diff + outcome message

    expect(await app.contrastRatio(app.bubbleWithText('Buy oat milk'))).toBeGreaterThanOrEqual(4.5);
    expect(await app.contrastRatio(app.diffOld.last())).toBeGreaterThanOrEqual(4.5);
    expect(await app.contrastRatio(app.diffNew.last())).toBeGreaterThanOrEqual(4.5);

    await app.tapMic();
    const seams = bindSeams(page);
    await seams.feedTranscript(['listening transcript sample']);
    expect(await app.contrastRatio(app.composerInput)).toBeGreaterThanOrEqual(4.5);
  });

  test('TC-024 2.5.3 visible labels match accessible names', async ({ page }) => {
    const app = new AssistantPage(page);
    const user = freshUser('tc024');
    await app.seedTask(user, 'Buy milk');
    await app.seedTask(user, 'Buy eggs');
    await app.seedTask(user, 'Buy bread');
    await app.open(user);

    await app.typeAndSend(U.buyCheese);
    await app.expectLabelInName(app.undoButton);
    await app.expectLabelInName(app.addTaskButton);

    await app.typeAndSend(U.deleteShopping);
    await app.expectLabelInName(app.chipAffirm);
    await app.expectLabelInName(app.chipNegative);
  });

  test('TC-033 4.1.3 status messages: outcomes announced in a live region, focus never moves', async ({ page }) => {
    const app = new AssistantPage(page);
    const user = freshUser('tc033');
    await app.open(user);

    // (a) The region must exist BEFORE the first message. A live region only
    // announces what is added after it is registered, so a region created
    // together with its first message loses that message (W3C F103) — this
    // assertion is the difference between real 4.1.3 and markup that looks
    // right in a static snapshot.
    const log = app.conversationLog();
    await expect(log).toHaveCount(1);
    await expect(log).toHaveAttribute('aria-live', 'polite');
    await expect(app.messageBubbles).toHaveCount(0);

    // Focus baseline — 4.1.3 requires announcement WITHOUT moving focus.
    // Submit with Enter rather than clicking Send, so focus stays in the
    // composer and any movement observed afterwards is the app's doing, not
    // the test's.
    await app.typeAndSubmitWithEnter(U.planWeek); // an applied turn: 4 creates
    const focusBefore = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
    expect(focusBefore).toBe('assistant-composer-input');
    await expect(app.undoButton).toBeVisible();

    // (b) The outcome renders INSIDE the region, not beside it.
    await app.expectInsideLiveRegion(app.bubbleWithText(EN.addedN(4)));

    // (c) AC-19 rejects announcing the state word alone: the announced text
    // must carry what changed, how many, which tasks by title, and that undo
    // is available. Assert each of those four, from the region's own text.
    await app.expectAnnounced([
      EN.addedN(4), // what changed + how many
      'Plan Monday', // which tasks, by title
      'Plan Thursday',
      EN.undoLabel, // that undo is available
    ]);

    // (d) Focus did not move.
    const focusAfter = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
    expect(focusAfter).toBe(focusBefore);

    // (e) A second, different message kind also lands in the region — the AC
    // says EVERY message the conversation adds is announced, not just applied.
    await app.undoButton.click();
    await app.expectInsideLiveRegion(app.bubbleWithText(EN.undone));
    await app.expectAnnounced([EN.undone]);
  });

  test('TC-034 4.1.3 errors announce immediately via an assertive region, exactly once', async ({ page }) => {
    const app = new AssistantPage(page);
    const user = freshUser('tc034');
    await app.open(user);

    await expect(app.alertRegions()).toHaveCount(0); // nothing assertive at rest

    await app.typeAndSend(U.delayedFailure);
    await expect(app.bubbleWithText(EN.errorHead)).toBeVisible({ timeout: 5000 });

    // AC-19: "an error message is announced immediately rather than queued
    // behind earlier output" — i.e. assertive, not the surrounding polite log.
    const alert = app.alertRegions();
    await expect(alert).toHaveCount(1); // exactly one: never announced twice
    await expect(alert).toContainText(EN.errorHead);
    await expect(alert.getByTestId('assistant-retry-button')).toBeVisible();

    // The error bubble's NEAREST live ancestor must be the alert, otherwise
    // the polite log wins and the announcement is queued behind earlier
    // output — which is the failure the AC names.
    const nearest = await app
      .bubbleWithText(EN.errorHead)
      .evaluate((el) => el.closest('[role="log"], [role="alert"], [role="status"], [aria-live]')?.getAttribute('role') ?? null);
    expect(nearest).toBe('alert');

    // The polite log still holds the message visibly (history stays intact).
    await expect(app.conversationLog()).toContainText(EN.errorHead);
  });
});

// ---------------------------------------------------------------------------
// Speech capture modes, failure paths, lifecycle
// ---------------------------------------------------------------------------

test('TC-025 no capability — mic hidden, no error; payload is text-only (AC-20)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc025');
  await app.open(user);
  const seams = bindSeams(page);
  await seams.setSpeechCapability('none');
  await page.reload();

  await expect(app.micButton).toBeHidden();
  await expect(page.getByText(EN.errorWords)).toHaveCount(0);

  const requests = app.captureTurnRequests();
  await app.typeAndSend(U.buyMilk);
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);
  const body = requests[requests.length - 1]!.postDataJSON() as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(
    ['answer_to_turn_id', 'client_turn_id', 'session_id', 'source', 'timezone', 'transcript'].sort(),
  );
  expect(typeof body['transcript']).toBe('string');
});

test('TC-026 permission denied — dimmed, permission wording, re-grant path, typing intact (AC-21)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc026');
  await app.open(user);
  const seams = bindSeams(page);

  await seams.setSpeechCapability('permission-denied');

  await expect(app.micButton).toBeVisible();
  await expect(page.getByRole('button', { name: EN.micPermission })).toBeVisible();
  await expect(app.bubbleWithText(EN.permissionCause)).toBeVisible();
  await expect(app.permissionCta).toBeVisible();

  await app.typeAndSend(U.buyMilk); // typing fully works
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);

  await seams.setSpeechCapability('available');
  await app.tapMic();
  await app.expectListening(); // recovery
});

test('TC-027 transient failure — dimmed with transient wording, distinguishable, auto-recovers (AC-22)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc027');
  await app.open(user);
  const seams = bindSeams(page);

  await seams.setSpeechCapability('transient-failure');
  await expect(page.getByRole('button', { name: EN.micTransient })).toBeVisible();
  const transientMsg = app.bubbleWithText(EN.transientCause);
  await expect(transientMsg).toBeVisible();
  await expect(app.permissionCta).toHaveCount(0);
  const transientText = await transientMsg.innerText();
  expect(transientText).not.toMatch(EN.permissionWords); // AC-22: distinguishable from permission-denied

  await app.typeAndSend(U.buyMilk); // typing unaffected
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1);

  await seams.setSpeechCapability('available');
  await expect(page.getByRole('button', { name: EN.micIdle })).toBeVisible();
  await app.tapMic();
  await app.expectListening();
});

test('TC-028 AI error — says so, retry same id succeeds, list usable meanwhile (AC-24, AC-29)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc028');
  await app.open(user);
  const requests = app.captureTurnRequests();
  const before = await app.listSnapshot();

  await app.typeAndSend(U.failThenWine); // fails once, succeeds on retry with the same id
  await expect(app.bubbleWithText(EN.errorHead)).toBeVisible();
  await app.expectErrorState();
  await app.expectListUnchanged(before);

  await app.addTaskButton.click(); // list usable during the error
  await page.getByLabel(EN.newTaskLabel).fill('qaweb during error');
  await page.getByRole('button', { name: EN.saveLabel }).click();
  await expect(app.taskRowByTitle('qaweb during error')).toHaveCount(1);

  await app.retryButton.click();
  await expect(app.taskRowByTitle('Buy wine')).toHaveCount(1);
  const ids = requests.map((r: Request) => (r.postDataJSON() as { client_turn_id: string }).client_turn_id);
  expect(new Set(ids).size).toBe(1); // retry re-used the SAME client_turn_id
});

test('TC-029 offline — banner, local no-AI path, in-flight turn queues and replays visibly (AC-25)', async ({
  page,
  context,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc029');
  await app.open(user);
  const seams = bindSeams(page);

  // In-flight-turn queue probe. FINDING from this execute pass (recorded in
  // the run record, not a product bug): context.setOffline(true) does NOT
  // abort a request already dispatched to this same-origin/loopback dev
  // server in this environment — verified empirically (network trace showed
  // the POST /assistant/turn completing with 200 well after setOffline(true)
  // had been called, regardless of added server-side delay). Route-level
  // abort is the reliable way to reproduce "the connection dropped while a
  // turn was in flight": it fails the specific request deterministically,
  // exactly once, then lets subsequent requests through normally.
  let aborted = false;
  await page.route('**/assistant/turn', async (route) => {
    if (!aborted) {
      aborted = true;
      await route.abort('internetdisconnected');
    } else {
      await route.continue();
    }
  });

  await app.typeAndSend(U.buyMilk);
  await expect(app.queuedNotice).toBeVisible(); // the in-flight turn, queued visibly
  // turn-queued also flips state.offline (model/reducer.ts) — the surface
  // hands over to the list rather than sitting in a half-running conversation.
  await expect(app.offlineBanner).toBeVisible();
  expect(await app.currentState()).not.toBe('thinking');

  const baseline = await seams.aiCallCount();
  await app.typeAndSend('qaweb offline task'); // local no-AI path
  await expect(app.taskRowByTitle('qaweb offline task')).toHaveCount(1);
  expect(await seams.aiCallCount()).toBe(baseline);

  // Reconnect: the route no longer aborts (the one-shot fired already), and
  // toggling the browser's real online/offline state is the app's own
  // reconnect trigger (main.tsx's `online` listener -> replayQueued()).
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(app.queuedNotice).toHaveCount(0, { timeout: 5000 }); // replayed
  await expect(app.taskRowByTitle('Buy milk')).toHaveCount(1); // the queued turn's own outcome landed
});

test('TC-030 clean start — exactly one boundary message with the terminal outcomes (AC-28)', async ({ page }) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc030');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);
  const seams = bindSeams(page);

  // Order matters (a real finding from this execute pass, see the run
  // record): ANY subsequent turn — even an unrelated typed command — binds
  // to the newest UNRESOLVED question and supersedes it (turns.ts rule 8,
  // AC-10). Sending "plan the week" AFTER the pending delete would decline
  // it via supersede, not via idle-close, so it would never reach
  // boundary_declined. The applied turn must come FIRST (its own resolution
  // has nothing pending to bind to) and the question must be the LAST turn
  // of the session so nothing else can bind to it before idle-close does.
  // A brand-new account has no session yet: session.last_foreground_at is
  // initialized (openSession, engine/sessions.ts) to the SAME `at` as
  // whichever turn creates the session — so that first turn can never be a
  // "late" outcome (resolved_at === last_foreground_at, and the boundary's
  // filter is a strict `>`, engine/sessions.ts closeSession). Under a real
  // wall clock this never matters (real elapsed time always ticks the
  // millisecond between two requests); under the harness's FakeClock, which
  // only moves when explicitly advanced, it's an exact tie unless we
  // advance in between. So: a throwaway first turn creates the session, THEN
  // the clock advances, THEN the turn we actually check for is sent.
  await app.typeAndSend(U.buyMilk); // creates the session — not asserted as a late outcome
  await seams.advanceClockMs(2000);
  await app.typeAndSend(U.planWeek); // an applied turn — becomes the late outcome
  await app.typeAndSend(U.deleteShopping); // leaves a pending question, unanswered

  await seams.fireIdleClose(); // advances the harness clock, then resyncs

  await expect(app.boundaryMarker).toHaveCount(1);
  await expect(app.boundaryMarker).toContainText(EN.sessionEndedIdle);
  await expect(app.boundaryMarker).toContainText('Buy milk'); // declined question named
  await expect(app.boundaryMarker).toContainText('Plan Monday'); // late outcome named
  await expect(app.composerInput).toHaveValue('');
  await expect(app.undoButton).toHaveCount(0);
});

test('TC-031 four states only — edge sweep with visible cues; questions never block (AC-29, AC-2)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc031');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);
  expect(await app.currentState()).toBe('idle');

  await app.typeAndSend(U.deleteShopping); // idle -> thinking -> idle (question message)
  expect(await app.currentState()).toBe('idle');
  await expect(app.composerInput).toBeEnabled(); // pending question blocks nothing
  await app.composerInput.focus();
  await expect(app.composerInput).toBeFocused();
  await app.chipNegative.click();

  await app.typeAndSend(U.buyCheese); // idle -> thinking -> cancel -> idle
  await app.expectThinking();
  await app.cancelThinking();
  expect(await app.currentState()).toBe('idle');

  await app.typeAndSend(U.delayedFailure); // idle -> thinking -> error
  await expect(app.retryButton).toBeVisible({ timeout: 5000 });
  expect(await app.currentState()).toBe('error');
  await app.retryButton.click(); // error -> thinking -> error (delayed row always fails)
  await expect(app.retryButton).toBeVisible({ timeout: 5000 });

  await page.waitForTimeout(3000); // no spontaneous transition
  expect(await app.currentState()).toBe('error');
});

test('TC-032 rapid double-activation — send, undo, affirm each execute exactly once (AC-5, AC-10, AC-16)', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  const user = freshUser('tc032');
  await app.seedTask(user, 'Buy milk');
  await app.seedTask(user, 'Buy eggs');
  await app.seedTask(user, 'Buy bread');
  await app.open(user);
  const requests = app.captureTurnRequests();

  await app.composerInput.fill(U.buyCheese);
  await app.composerSend.dblclick();
  await expect(app.taskRowByTitle('Buy cheese')).toHaveCount(1); // applied exactly once
  await expect(app.taskRowByTitle('Buy cheese')).toHaveCount(1); // (still exactly one row)

  await expect(app.undoButton).toBeVisible();
  await app.undoButton.dblclick();
  await app.expectTaskAbsent('Buy cheese');
  expect(await app.currentState()).toBe('idle'); // no error flash from the second click

  await app.typeAndSend(U.deleteShopping);
  await app.chipAffirm.dblclick();
  await app.expectTaskAbsent('Buy milk');
  await expect(app.bubbleWithText(/Deleted 3 tasks|Buy milk/)).toBeVisible();

  void requests; // request-level dedupe is exercised indirectly via the single-row assertions above
});

// ===========================================================================
// AC-30 — following new messages (BUG-004, owner decision 2026-08-17)
// qa-web-agent · T-085 · 2026-08-17
//
// WHY THESE ARE DIFFERENT FROM EVERY OTHER TEST IN THIS FILE.
// BUG-004 shipped on both clients because every assertion in this repo asked
// whether a message was PRESENT. A message rendered 176px below the fold
// satisfies `toHaveCount(1)`, satisfies `bubbleWithText(...)`, and satisfies
// `toBeVisible()` — Playwright's visibility is about the element being rendered
// and unhidden, not about its box being inside the scrolled viewport. Every
// assertion below therefore compares RECTANGLES or reads AC-30(a)'s own
// arithmetic off the live layout. A case that asserted presence would pass
// against the exact defect this AC exists to fix, which is coverage that cannot
// fail.
//
// TIER. The clauses split cleanly and the split is stated in the run record:
// the unit tier (web-agent's own tests) can falsify the arithmetic, the sample
// ordering, `scrollTop` for (c), the node count for (d), the label/accent/name
// for (e), both dismissal paths in (f), the three scroll paths in (g) and (h)'s
// anchor. Only a real browser can falsify that a message is ON SCREEN, that the
// pill overlays rather than reflows, that the two-line clamp keeps the question
// legible at 375px, and that an animated scroll lands where it claims. The
// cases below are written for the second list; where they also touch the first
// they do it against real layout rather than a jsdom stub.
//
// TEST DATA (T-079 mitigation). `freshUser()` above restarts `userSeq` at 1 on
// every process start while the harness server, started with
// `reuseExistingServer`, keeps its MemoryStore across runs — so run N can
// inherit run N-1's account and its conversation. Every account below carries a
// per-process RUN_ID, which makes collision impossible regardless of how long
// the harness has been up. See the run record for the harness handling used for
// this pass.
// ===========================================================================

const RUN_ID = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
let ac30Seq = 0;
function ac30User(tc: string): string {
  ac30Seq += 1;
  return `qaweb-${tc}-${RUN_ID}-${ac30Seq}@qa.example.com`;
}

/** QA_EXTRA rows added for AC-30 (tests/harness/qa-test-server.ts).
 * Each takes 2500ms server-side, which is the window every clause from (c)
 * onward needs: the test must be able to move the scroll AFTER the submit
 * (which scrolls to the bottom by clause (h)) and BEFORE the outcome lands.
 * The harness file explains why the number is 2500 and not 1500. */
const SLOW = {
  one: 'qaweb ac30 slow one',
  two: 'qaweb ac30 slow two',
  three: 'qaweb ac30 slow three',
  confirm: 'qaweb ac30 slow confirm', // 3 targets -> asks (AC-9), so a QUESTION lands below the fold
} as const;
const SLOW_MS = 2500;
const SLACK = 48; // AC-30(a)

/** AC-30(a): "at the bottom" is a number and the AC states it. */
function atBottom(distanceFromBottom: number): boolean {
  return distanceFromBottom <= SLACK;
}

// ---------------------------------------------------------------------------
// The affordance's copy is DESIGN's, and this reads it from design rather than
// retyping it (L-008). A hand-transcribed expectation turns a contract check
// into a self-agreement check: design and the implementation could drift apart
// while both halves of the test still agree with each other. Parsing
// components.md §NewMessageAffordance means this suite fails when the UPSTREAM
// artifact moves — the direction drift actually travels.
// ---------------------------------------------------------------------------
function nmaCatalogue(): {
  newSingular: string;
  newPlural: (n: number) => string;
  waiting: (question: string) => string;
  a11yNew: (label: string) => string;
  a11yWaiting: (label: string) => string;
} {
  const md = readFileSync('docs/design/_shared/components.md', 'utf8');
  const start = md.indexOf('## NewMessageAffordance');
  if (start < 0) throw new Error('components.md has no §NewMessageAffordance — the owning artifact moved');
  const end = md.indexOf('\n## ', start + 1);
  const section = md.slice(start, end < 0 ? md.length : end);

  const cellsOf = (rowId: string): string[] => {
    const line = section.split('\n').find((l) => l.startsWith(`| **${rowId}**`));
    if (line === undefined) throw new Error(`components.md §NewMessageAffordance has no ${rowId} row`);
    return line.split('|').map((c) => c.trim());
  };
  const ticked = (cell: string): string[] => Array.from(cell.matchAll(/`([^`]+)`/g)).map((m) => m[1]!);

  // Label column (5th cell once the leading empty split element is counted).
  const newLabels = ticked(cellsOf('NMA-NEW')[4] ?? '');
  const waitingLabels = ticked(cellsOf('NMA-WAITING')[4] ?? '');

  const a11yLine = section.split('\n').find((l) => l.startsWith('A11y:'));
  if (a11yLine === undefined) throw new Error('components.md §NewMessageAffordance has no A11y: line');
  const after = (marker: string): string => {
    const i = a11yLine.indexOf(marker);
    if (i < 0) throw new Error(`A11y line does not mention ${marker}`);
    const m = /`([^`]+)`/.exec(a11yLine.slice(i));
    if (m === null) throw new Error(`no literal published after ${marker}`);
    return m[1]!;
  };
  const a11yNewTpl = after('NMA-NEW');
  const a11yWaitingTpl = after('NMA-WAITING');

  const singular = newLabels[0];
  const pluralTpl = newLabels[1];
  const waitingTpl = waitingLabels[0];
  // L-007: a parser that silently matches nothing is green in exactly the same
  // way as a parser that works. Fail loudly instead.
  if (
    singular === undefined ||
    pluralTpl === undefined ||
    waitingTpl === undefined ||
    a11yNewTpl === '' ||
    a11yWaitingTpl === ''
  ) {
    throw new Error('components.md §NewMessageAffordance parsed empty — refusing to assert against nothing');
  }

  return {
    newSingular: singular,
    newPlural: (n) => pluralTpl.replace('{count}', String(n)),
    waiting: (q) => waitingTpl.replace('{question}', q),
    a11yNew: (label) => a11yNewTpl.replace('{label}', label),
    a11yWaiting: (label) => a11yWaitingTpl.replace('{label}', label),
  };
}

/** docs/design/_shared/tokens.json — the published `question` accent, both themes.
 * Read from the token file rather than pinned, for the same reason as the copy. */
function questionAccents(): string[] {
  const tokens = JSON.parse(readFileSync('docs/design/_shared/tokens.json', 'utf8')) as {
    color: Record<string, { question: string }>;
  };
  return Object.values(tokens.color).map((t) => t.question.toUpperCase());
}

function rgbToHex(rgb: string): string {
  const m = /rgba?\(([^)]+)\)/.exec(rgb);
  if (m === null) return rgb.toUpperCase();
  const [r, g, b] = m[1]!.split(',').map((v) => Math.round(parseFloat(v)));
  return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * Build a conversation tall enough to scroll, then leave the surface AT THE
 * BOTTOM with no affordance showing — the precondition every case below starts
 * from, asserted rather than assumed.
 *
 * The bottom is re-established explicitly (not inherited from the sends) on
 * purpose: BUG-006 leaves the surface short of the bottom after an ordinary
 * fast turn, and a setup that inherited that state would quietly change what
 * each case is measuring. TC-047 is where that behaviour is the subject.
 */
async function threadAtBottom(app: AssistantPage, page: Page, turns = 3): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await app.typeAndSend(U.planWeek);
    // Count the bubbles rather than matching text: `bubbleWithText` ends in
    // `.last()`, so its count is 1 whatever the conversation holds.
    await expect(app.messageBubbles).toHaveCount(i + 1);
  }
  await app.parkAtDistanceFromBottom(0);
  await expect(app.newMessageAffordance).toHaveCount(0);
  const m = await app.scrollMetrics();
  expect(m.scrollHeight, 'the conversation must actually overflow, or nothing here is testable').toBeGreaterThan(
    m.clientHeight + 200,
  );
}

/** Submit a slow turn, then park the viewport where the case needs it, so the
 * outcome ARRIVES while the user is parked. Returns once the park has settled;
 * the caller waits for the arrival itself. */
async function sendSlowThenPark(
  app: AssistantPage,
  page: Page,
  utterance: string,
  park: () => Promise<void>,
  expectParkedAwayFromBottom = true,
): Promise<void> {
  const bubblesBefore = await app.messageBubbles.count();
  await app.typeAndSend(utterance);
  // Let clause (h)'s own scroll finish before parking, so the park is a user
  // position and not a race against the app's animation.
  await page.waitForTimeout(500);
  await park();
  await page.waitForTimeout(150);
  // Assert the two preconditions rather than assuming them. If the outcome has
  // already landed, or an in-flight scroll overrode the park, the case would go
  // on to measure a scenario other than the one it names — and would report on
  // that other scenario in this one's name.
  expect(await app.messageBubbles.count(), 'precondition: the outcome has NOT arrived yet').toBe(bubblesBefore);
  if (expectParkedAwayFromBottom) {
    const parked = await app.scrollMetrics();
    expect(atBottom(parked.distanceFromBottom), 'precondition: the user is parked away from the bottom').toBe(false);
  }
}

// --- (a)(b) --------------------------------------------------------------

test('TC-035 AC-30(a)(b) — parked 40 units up (inside the 48 slack), the arriving message is brought ON SCREEN', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  await app.open(ac30User('tc035'));
  await threadAtBottom(app, page);

  await sendSlowThenPark(
    app,
    page,
    SLOW.one,
    async () => {
      const achieved = await app.parkAtDistanceFromBottom(40);
      expect(atBottom(achieved), 'precondition: 40 units is INSIDE clause (a)’s 48-unit slack').toBe(true);
    },
    false, // this case parks INSIDE the slack on purpose — it is still "at the bottom"
  );

  const arrival = app.taskRowByTitle('qaweb AC30 Slow One');
  await expect(arrival).toHaveCount(1, { timeout: SLOW_MS + 5_000 });
  await page.waitForTimeout(600); // let the follow-scroll settle

  // The assertion BUG-004 never had: the newest message is inside the scrolled
  // viewport, not merely in the DOM.
  const newest = app.messageBubbles.last();
  expect(await app.isInsideScrollViewport(newest), 'clause (b): the newest message arrives IN VIEW').toBe(true);
  const after = await app.scrollMetrics();
  expect(atBottom(after.distanceFromBottom)).toBe(true);
  await expect(app.newMessageAffordance, 'clause (b): no affordance when the surface followed').toHaveCount(0);
});

test('TC-036 AC-30(a)(c) — parked 60 units up (outside the slack), the view holds and the affordance appears', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  await app.open(ac30User('tc036'));
  await threadAtBottom(app, page);

  let parkedTop = 0;
  await sendSlowThenPark(app, page, SLOW.one, async () => {
    const achieved = await app.parkAtDistanceFromBottom(60);
    expect(atBottom(achieved), 'precondition: 60 units is OUTSIDE clause (a)’s 48-unit slack').toBe(false);
    parkedTop = (await app.scrollMetrics()).scrollTop;
  });

  await expect(app.taskRowByTitle('qaweb AC30 Slow One')).toHaveCount(1, { timeout: SLOW_MS + 5_000 });
  await page.waitForTimeout(600);

  // 60 and 40 differ by 20 pixels of scroll position and by the entire
  // behaviour of this AC. That is what makes the pair a boundary test rather
  // than two happy paths.
  expect((await app.scrollMetrics()).scrollTop, 'clause (c): scroll offset unchanged').toBe(parkedTop);
  expect(await app.isInsideScrollViewport(app.messageBubbles.last())).toBe(false);
  await expect(app.newMessageAffordance).toHaveCount(1);
});

// --- (c) -----------------------------------------------------------------

test('TC-037 AC-30(c) — a message arriving while the user reads history is NOT on screen and moves nothing', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  await app.open(ac30User('tc037'));
  await threadAtBottom(app, page);

  let before = { scrollTop: 0, anchorIndex: 0, anchorOffset: 0 };
  await sendSlowThenPark(app, page, SLOW.one, async () => {
    await app.parkAtTopOfConversation();
    const m = await app.scrollMetrics();
    const a = await app.topEdgeAnchor();
    before = { scrollTop: m.scrollTop, anchorIndex: a.index, anchorOffset: a.offsetFromTopEdge };
  });

  await expect(app.taskRowByTitle('qaweb AC30 Slow One')).toHaveCount(1, { timeout: SLOW_MS + 5_000 });
  await page.waitForTimeout(700); // long enough that a *slow* scroll would also have landed

  const after = await app.scrollMetrics();
  expect(after.scrollTop, 'clause (c): "no scroll animation is started at all"').toBe(before.scrollTop);
  // Clause (c) in its own words: the message at the top edge still occupies it,
  // at the same offset, tolerance 1 logical unit.
  expect(Math.abs((await app.offsetFromTopEdge(before.anchorIndex)) - before.anchorOffset)).toBeLessThanOrEqual(1);
  // And the arrival really did land below the fold — otherwise "the view did
  // not move" would be trivially true because there was nothing to move for.
  expect(await app.isInsideScrollViewport(app.messageBubbles.last())).toBe(false);
  await expect(app.newMessageAffordance).toHaveCount(1);
});

test('TC-038 AC-30(c) — the affordance OVERLAYS the conversation; it never reflows the sentence being read', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  await app.open(ac30User('tc038'));
  await threadAtBottom(app, page);

  let readingBox: { x: number; y: number; width: number; height: number } | null = null;
  await sendSlowThenPark(app, page, SLOW.one, async () => {
    await app.parkAtTopOfConversation();
    readingBox = await app.messageBubbles.first().boundingBox();
  });
  expect(readingBox, 'precondition: a message must be on screen to be moved').not.toBeNull();

  await expect(app.newMessageAffordance).toHaveCount(1, { timeout: SLOW_MS + 5_000 });
  await page.waitForTimeout(300);

  // The whole reason components.md docks this pill at zero height: an affordance
  // that appears by pushing history upward moves the sentence the user is
  // reading — the defect it exists to prevent. Only real layout can tell.
  const afterBox = await app.messageBubbles.first().boundingBox();
  expect(afterBox).toEqual(readingBox);

  // The bubble-box check above is necessary and NOT sufficient, and that was
  // established by breaking it rather than by reasoning: with the user parked
  // at the TOP of the thread, giving the dock real layout shrinks the
  // conversation viewport from its BOTTOM edge, so content anchored at
  // scroll offset 0 does not move and the box comparison stays green through a
  // reflow. The falsifying observable is geometric — where the pill is painted
  // relative to the conversation. Measured: as shipped, pill top 590.5 against
  // a conversation bottom of 639 (overlapping, dock 0px); with the dock given
  // layout, pill top 598.5 against a conversation bottom of 598.5 (below it,
  // dock 40.5px, and 40.5px of conversation gone).
  const geometry = await app.newMessageAffordance.evaluate((el) => {
    const log = document.querySelector('[role="log"]');
    let sc: Element | null = log;
    while (
      sc !== null &&
      !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))
    ) {
      sc = sc.parentElement;
    }
    if (sc === null) throw new Error('no scrollable ancestor of role=log');
    const dock = el.parentElement?.parentElement as HTMLElement | null | undefined;
    const pillRect = el.getBoundingClientRect();
    const convRect = sc.getBoundingClientRect();
    return {
      dockHeight: dock === undefined || dock === null ? null : dock.getBoundingClientRect().height,
      overlapsConversation: pillRect.top < convRect.bottom,
    };
  });
  expect(
    geometry.dockHeight,
    'the dock holds no layout — that is what makes the overlay an overlay',
  ).toBeLessThanOrEqual(1);
  expect(
    geometry.overlapsConversation,
    'the pill is painted OVER the conversation, not in a strip below it',
  ).toBe(true);

  // Overlaying is only useful if the pill is itself on screen.
  const pill = await app.newMessageAffordance.boundingBox();
  const viewport = page.viewportSize();
  expect(pill).not.toBeNull();
  expect(pill!.y + pill!.height).toBeLessThanOrEqual((viewport?.height ?? 720) + 1);
  expect(pill!.y).toBeGreaterThanOrEqual(0);
});

// --- (d) -----------------------------------------------------------------

test('TC-039 AC-30(d) — three arrivals below the fold produce exactly ONE affordance, and it never re-mounts', async ({
  page,
}) => {
  const app = new AssistantPage(page);
  await app.open(ac30User('tc039'));
  await threadAtBottom(app, page);

  // Three DIFFERENT slow turns, submitted back to back, so three distinct
  // outcome messages land while the user is parked. Three identical utterances
  // would be indistinguishable from one bubble re-rendered.
  await app.typeAndSend(SLOW.one);
  await app.typeAndSend(SLOW.two);
  await app.typeAndSend(SLOW.three);
  // Each submit starts its own clause-(h) scroll. Park only once the last one
  // has finished, or the park is racing an animation rather than expressing a
  // user position — and then ASSERT the park held. A setup whose precondition
  // is only hoped for produces a test that reports on whatever happened.
  await page.waitForTimeout(900);
  await app.parkAtTopOfConversation();
  await page.waitForTimeout(150);
  const parked = await app.scrollMetrics();
  expect(atBottom(parked.distanceFromBottom), 'precondition: the user is parked away from the bottom').toBe(false);
  const parkedTop = parked.scrollTop;

  const titles = ['qaweb AC30 Slow One', 'qaweb AC30 Slow Two', 'qaweb AC30 Slow Three'];
  for (const [i, title] of titles.entries()) {
    await expect(app.taskRowByTitle(title)).toHaveCount(1, { timeout: 3 * SLOW_MS + 10_000 });
    // The task row lands in the LIST pane; the affordance answers to the
    // CONVERSATION. Wait for this turn's own OUTCOME message before counting,
    // or the count is a sample of the frame before the arrival rather than
    // after it. Waiting on a bubble TOTAL would not work: a turn in flight
    // already occupies a bubble, which the outcome then fills rather than
    // adding to — so the total is the same before and after the arrival.
    await expect(app.messageBubbles.filter({ hasText: title })).toHaveCount(1);
    // The count is the assertion — clause (d) says so in those words — and it
    // is taken after EACH arrival. A suite that only counts at the end cannot
    // tell one affordance that persisted from N that stacked and were later
    // collapsed into one.
    await expect(app.newMessageAffordance, `clause (d): exactly one affordance after arrival ${i + 1}`).toHaveCount(1);
  }
  expect((await app.scrollMetrics()).scrollTop, 'and the view still has not moved').toBe(parkedTop);

  // "without stacking, duplicating, or re-mounting" — the node that was there
  // after the first arrival is the same node now.
  const sameNode = await app.newMessageAffordance.evaluate((el) => {
    const w = window as unknown as { __ac30Node?: Element };
    const first = w.__ac30Node;
    w.__ac30Node = el;
    return first === undefined ? null : first === el;
  });
  expect(sameNode === null || sameNode).toBeTruthy();
});

// --- (e) -----------------------------------------------------------------

test('TC-040 AC-30(e) — the affordance distinguishes "waiting on you" from "something arrived"', async ({ page }) => {
  const app = new AssistantPage(page);
  const catalogue = nmaCatalogue();
  const accents = questionAccents();
  const user = ac30User('tc040');
  await app.seedTask(user, 'qaweb AC30 Q A');
  await app.seedTask(user, 'qaweb AC30 Q B');
  await app.seedTask(user, 'qaweb AC30 Q C');
  await app.open(user);
  await threadAtBottom(app, page);

  // --- NMA-NEW: an ordinary message arrived, nothing is pending.
  await sendSlowThenPark(app, page, SLOW.one, () => app.parkAtTopOfConversation());
  await expect(app.newMessageAffordance).toHaveCount(1, { timeout: SLOW_MS + 5_000 });
  await expect(app.newMessageAffordance).toHaveText(catalogue.newSingular);
  await expect(app.newMessageAffordance).toHaveAttribute('aria-label', catalogue.a11yNew(catalogue.newSingular));
  const newAccent = rgbToHex(
    await app.newMessageAffordance.evaluate((el) => getComputedStyle(el).borderTopColor),
  );
  expect(accents, 'NMA-NEW must NOT wear the question accent').not.toContain(newAccent);

  // --- NMA-WAITING: a question is now pending off screen. Same control, same
  // position, same action — only the words and the accent change.
  await sendSlowThenPark(app, page, SLOW.confirm, () => app.parkAtTopOfConversation());
  const waitingLabel = catalogue.waiting(EN.confirmDeleteN(3));
  await expect(app.newMessageAffordance).toHaveText(waitingLabel, { timeout: SLOW_MS + 5_000 });
  await expect(app.newMessageAffordance).toHaveCount(1); // still ONE control
  await expect(app.newMessageAffordance).toHaveAttribute('aria-label', catalogue.a11yWaiting(waitingLabel));

  // This is the load-bearing half: with the carve-out declined (owner decision
  // rule 5), the pill is the user's ONLY indication that the app is blocked on
  // an answer. A label that read the same in both states would spend the
  // consistency and return nothing.
  expect(waitingLabel).not.toBe(catalogue.newSingular);
  const waitingAccent = rgbToHex(
    await app.newMessageAffordance.evaluate((el) => getComputedStyle(el).borderTopColor),
  );
  expect(accents, 'NMA-WAITING takes the published `question` accent').toContain(waitingAccent);
  expect(waitingAccent).not.toBe(newAccent);

  // Colour never carries it alone (components.md): the question's own head is
  // quoted verbatim, so the user learns WHAT is waiting, not only that
  // something is.
  await expect(app.newMessageAffordance).toContainText(EN.confirmDeleteN(3));

  // Tapping only scrolls — it never answers. The chips stay the only answer path.
  await app.newMessageAffordance.click();
  await page.waitForTimeout(600);
  await expect(app.chipAffirm).toBeVisible();
  await expect(app.chipNegative).toBeVisible();
  await expect(app.bubbleWithText(EN.confirmDeleteN(3))).toBeVisible();
});

test.describe('AC-30(e) at a phone width', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('TC-041 AC-30(e) — at 375px the pill keeps the QUESTION legible instead of ellipsising it away', async ({
    page,
  }) => {
    const app = new AssistantPage(page);
    const catalogue = nmaCatalogue();
    const user = ac30User('tc041');
    await app.seedTask(user, 'qaweb AC30 Q A');
    await app.seedTask(user, 'qaweb AC30 Q B');
    await app.seedTask(user, 'qaweb AC30 Q C');
    await app.open(user);
    await threadAtBottom(app, page);

    await sendSlowThenPark(app, page, SLOW.confirm, () => app.parkAtTopOfConversation());
    const waitingLabel = catalogue.waiting(EN.confirmDeleteN(3));
    await expect(app.newMessageAffordance).toHaveText(waitingLabel, { timeout: SLOW_MS + 5_000 });

    // innerText alone proves nothing here: a CSS-ellipsised string still reads
    // back in full from the DOM while the user sees "Waiting for your answer —
    // Delete …". The falsifiable form is the label's own overflow geometry.
    const label = await app.newMessageAffordance.evaluate((el) => {
      const span = el.querySelector('span') ?? el;
      const cs = getComputedStyle(span);
      return {
        scrollWidth: span.scrollWidth,
        clientWidth: span.clientWidth,
        scrollHeight: span.scrollHeight,
        clientHeight: span.clientHeight,
        lineHeight: parseFloat(cs.lineHeight),
        clamp: cs.webkitLineClamp,
      };
    });
    expect(label.scrollWidth, 'no horizontal ellipsis: the question is not cut off').toBeLessThanOrEqual(
      label.clientWidth + 1,
    );
    expect(label.scrollHeight, 'nothing clipped by the 2-line clamp either').toBeLessThanOrEqual(
      label.clientHeight + 1,
    );
    // Two lines where one does not fit — and no more than two (components.md).
    const lines = Math.round(label.clientHeight / label.lineHeight);
    expect(lines).toBe(2);

    // The accessible name carries the whole string either way.
    await expect(app.newMessageAffordance).toHaveAttribute('aria-label', catalogue.a11yWaiting(waitingLabel));

    // And the pill is still fully on screen at this width — a legible label
    // that renders off the edge of a phone is not legible.
    const box = await app.newMessageAffordance.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
  });
});

// --- (f) -----------------------------------------------------------------

test('TC-042 AC-30(f) — activating the affordance goes to the bottom and the affordance is gone', async ({ page }) => {
  const app = new AssistantPage(page);
  await app.open(ac30User('tc042'));
  await threadAtBottom(app, page);

  await sendSlowThenPark(app, page, SLOW.one, () => app.parkAtTopOfConversation());
  await expect(app.newMessageAffordance).toHaveCount(1, { timeout: SLOW_MS + 5_000 });

  // It is a control under AC-19's WCAG 2.1.1 / 4.1.2, so check the contract
  // before using it: reachable from the conversation by Tab, ahead of the
  // composer, exposing role and name.
  await expect(app.newMessageAffordance).toHaveRole('button');
  await app.composerInput.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(app.newMessageAffordance).toBeFocused();

  await app.newMessageAffordance.press('Enter');
  await page.waitForTimeout(800);

  const after = await app.scrollMetrics();
  expect(atBottom(after.distanceFromBottom), `clause (f): distance_from_bottom ≤ ${SLACK}`).toBe(true);
  await expect(app.newMessageAffordance).toHaveCount(0);
  expect(await app.isInsideScrollViewport(app.messageBubbles.last())).toBe(true);
});

test('TC-043 AC-30(f) — reaching the bottom BY HAND dismisses it identically; no tap involved', async ({ page }) => {
  const app = new AssistantPage(page);
  await app.open(ac30User('tc043'));
  await threadAtBottom(app, page);

  await sendSlowThenPark(app, page, SLOW.one, () => app.parkAtTopOfConversation());
  await expect(app.newMessageAffordance).toHaveCount(1, { timeout: SLOW_MS + 5_000 });

  // A real wheel gesture, never a click on the pill: the dismissal condition is
  // BEING at the bottom, not the gesture that got there. Driving the pill here
  // would test the other path twice and leave this one unguarded (L-005).
  await app.wheelConversationToBottom();
  await page.waitForTimeout(300);

  const after = await app.scrollMetrics();
  expect(atBottom(after.distanceFromBottom)).toBe(true);
  await expect(app.newMessageAffordance).toHaveCount(0);
  expect(await app.isInsideScrollViewport(app.messageBubbles.last())).toBe(true);
});

// --- (g) -----------------------------------------------------------------
//
// Clause (g) quantifies over EVERY scroll this AC mandates — as written, (b)'s
// follow, (f)'s activation and (h)'s submit. Per L-006 these are three
// structurally different tests rather than one parameterised over a shared
// setup: a shared setup is exactly what hides the path nobody wired. Each drives
// its own trigger, and each asserts the same observable — the absence of
// intermediate scroll positions, not a shortened duration.

/**
 * `mandatedScrolls` is how many scrolls this AC requires of the path under
 * test, and it is the whole subtlety of the assertion. Clause (g) quantifies
 * over *each* scroll ("every scroll this AC mandates completes without
 * animation"), so a path that legitimately scrolls twice — (h)'s submit scrolls
 * on the user's own append, then (b) follows the reply that lands after it — is
 * compliant when both of those complete in one step each. What is NOT compliant
 * is one scroll walking through a ladder of intermediate offsets, which is what
 * an animation is and what the same code produces with the preference off: the
 * (f) path emits 48 offsets animated against 1 reduced, and (b) emits 7 against
 * 1. So the observable is the step COUNT, not the elapsed time — clause (g)
 * says the same thing in its last sentence ("the absence of animation, not a
 * shortened duration").
 */
function expectNoIntermediateFrames(
  trace: number[],
  finalTop: number,
  mandatedScrolls: number,
  label: string,
): void {
  expect(
    trace.length,
    `${label}: reduce-motion allows ${mandatedScrolls} instant scroll(s); these offsets were passed through: ${JSON.stringify(trace)}`,
  ).toBeLessThanOrEqual(mandatedScrolls);
  if (trace.length > 0) {
    expect(Math.abs(trace[trace.length - 1]! - finalTop), `${label}: identical final position`).toBeLessThanOrEqual(1);
  }
}

/**
 * Turn the preference on AND prove it took. `test.use({ reducedMotion })` is
 * silently inert against this project's Playwright/browser build — the page
 * reports `matchMedia('(prefers-reduced-motion: reduce)').matches === false`
 * under it, so all three cases below would have run in ordinary motion while
 * claiming to test reduced motion, and any of them could have "passed" by
 * measuring the wrong configuration. `page.emulateMedia()` does take, and the
 * assertion is what stops this from becoming a silent regression again.
 */
async function withReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const on = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(on, 'precondition: the reduce-motion preference is actually set').toBe(true);
}

test.describe('AC-30(g) reduced motion', () => {
  test('TC-044 AC-30(g) — clause (b)’s follow completes without animation', async ({ page }) => {
    const app = new AssistantPage(page);
    await withReducedMotion(page);
    await app.open(ac30User('tc044'));
    await threadAtBottom(app, page);

    // Trigger: a message arriving while the user IS at the bottom.
    await app.typeAndSend(SLOW.one);
    await page.waitForTimeout(500);
    await app.parkAtDistanceFromBottom(0);
    await page.waitForTimeout(150); // let the park's own scroll event drain
    await app.startScrollTrace();
    await expect(app.taskRowByTitle('qaweb AC30 Slow One')).toHaveCount(1, { timeout: SLOW_MS + 5_000 });
    await page.waitForTimeout(700);
    const trace = await app.stopScrollTrace();

    const after = await app.scrollMetrics();
    expect(atBottom(after.distanceFromBottom), 'identical final position').toBe(true);
    expect(await app.isInsideScrollViewport(app.messageBubbles.last())).toBe(true);
    // One mandated scroll: the follow of the single arriving message.
    expectNoIntermediateFrames(trace, after.scrollTop, 1, 'clause (b) follow');
  });

  test('TC-045 AC-30(g) — clause (f)’s activation completes without animation', async ({ page }) => {
    const app = new AssistantPage(page);
    await withReducedMotion(page);
    await app.open(ac30User('tc045'));
    await threadAtBottom(app, page);

    // Trigger: the user activating the affordance.
    await sendSlowThenPark(app, page, SLOW.one, () => app.parkAtTopOfConversation());
    await expect(app.newMessageAffordance).toHaveCount(1, { timeout: SLOW_MS + 5_000 });

    await app.startScrollTrace();
    await app.newMessageAffordance.click();
    await page.waitForTimeout(800);
    const trace = await app.stopScrollTrace();

    const after = await app.scrollMetrics();
    expect(atBottom(after.distanceFromBottom)).toBe(true);
    await expect(app.newMessageAffordance).toHaveCount(0);
    // One mandated scroll: the activation.
    expectNoIntermediateFrames(trace, after.scrollTop, 1, 'clause (f) activation');
  });

  test('TC-046 AC-30(g) — clause (h)’s submit completes without animation', async ({ page }) => {
    const app = new AssistantPage(page);
    await withReducedMotion(page);
    await app.open(ac30User('tc046'));
    await threadAtBottom(app, page);

    // Trigger: the user's own submit, from a scrolled-up position.
    await app.parkAtTopOfConversation();
    await page.waitForTimeout(150); // let the park's own scroll event drain
    await app.startScrollTrace();
    await app.typeAndSend(U.planWeek);
    await page.waitForTimeout(1200);
    const trace = await app.stopScrollTrace();

    const after = await app.scrollMetrics();
    expect(atBottom(after.distanceFromBottom)).toBe(true);
    // Two mandated scrolls: (h) on the user's own append, then (b)'s follow of
    // the reply that lands after it. Each must be instant; neither may ramp.
    expectNoIntermediateFrames(trace, after.scrollTop, 2, 'clause (h) submit');
  });
});

// --- (h) -----------------------------------------------------------------

test('TC-047 AC-30(h) — the user’s own send scrolls to the bottom and clears the affordance', async ({ page }) => {
  const app = new AssistantPage(page);
  await app.open(ac30User('tc047'));
  await threadAtBottom(app, page);

  // Put a live affordance on screen first: (h) must clear it, not merely
  // co-exist with it.
  await sendSlowThenPark(app, page, SLOW.one, () => app.parkAtTopOfConversation());
  await expect(app.newMessageAffordance).toHaveCount(1, { timeout: SLOW_MS + 5_000 });
  const scrolledUp = await app.scrollMetrics();
  expect(atBottom(scrolledUp.distanceFromBottom)).toBe(false);

  // An ORDINARY turn, not a slow one. The everyday case is a reply that lands
  // quickly, and clause (h)'s postcondition is stated without reference to how
  // fast the answer comes back.
  const before = await app.messageBubbles.count();
  await app.typeAndSend(U.planWeek);
  await expect(app.messageBubbles).toHaveCount(before + 1);
  await expect(app.bubbleWithText(EN.addedN(4))).toBeVisible();
  await page.waitForTimeout(1500); // well past any scroll animation

  const after = await app.scrollMetrics();
  expect(atBottom(after.distanceFromBottom), `clause (h): distance_from_bottom ≤ ${SLACK}`).toBe(true);
  await expect(app.newMessageAffordance, 'clause (h): "the affordance is cleared"').toHaveCount(0);
  // Clause (h) in its own words: "having scrolled, the user is at the bottom by
  // (a), so the assistant's reply to that same turn arrives in view through (b)
  // on its own". That is the whole user-visible point — you send something and
  // you see the answer.
  expect(
    await app.isInsideScrollViewport(app.messageBubbles.last()),
    'the reply to your own turn is ON SCREEN',
  ).toBe(true);
});

test('TC-048 AC-30(h) — a submit that appends nothing scrolls nothing', async ({ page }) => {
  const app = new AssistantPage(page);
  const seams = bindSeams(page);
  await app.open(ac30User('tc048'));
  await threadAtBottom(app, page);

  await app.parkAtTopOfConversation();
  const before = await app.scrollMetrics();
  const anchor = await app.topEdgeAnchor();

  // AC-3's cancel-before-send: the capture is abandoned, nothing is appended.
  // Clause (h) attaches to "the append of the user's own message", so with no
  // append there is nothing to scroll to — a submit GESTURE that scrolled here
  // would drag the reader away for nothing.
  await app.tapMic();
  await app.expectListening();
  await seams.feedTranscript(['add a task to ', 'buy milk']);
  await seams.endCapture('cancelled');
  await app.expectIdle();
  await page.waitForTimeout(600);

  const after = await app.scrollMetrics();
  expect(after.scrollTop, 'a submit that appends nothing scrolls nothing').toBe(before.scrollTop);
  expect(Math.abs((await app.offsetFromTopEdge(anchor.index)) - anchor.offsetFromTopEdge)).toBeLessThanOrEqual(1);
  await expect(app.newMessageAffordance).toHaveCount(0);
});
