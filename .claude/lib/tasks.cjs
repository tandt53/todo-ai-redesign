// Shared TASKS.md reader for Node consumers (currently .claude/eval/server.cjs).
//
// The bash half lives in .claude/lib/tasks.sh and follows the same rule:
// column positions are resolved from the header row at runtime, never
// hardcoded. "Status is field 9" used to be written out in three places, and
// reordering a column silently broke the two that were not updated.
//
// Constraint: column names must be single words, because the header is split
// on "|" and each cell is used verbatim as a key.

'use strict';

// Statuses a task row may carry. PARTIAL shares the in-progress bucket: it is
// real work in flight, and the dashboard has one "active" lane.
const BUCKET = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PARTIAL: 'in_progress',
  BLOCKED: 'blocked',
  DONE: 'done',
  // CANCELLED is deliberately absent — a cancelled task is not work in any lane.
};

const NONE = new Set(['', '—', '-']);

function isNone(v) {
  return NONE.has((v || '').trim());
}

function splitCell(v) {
  if (isNone(v)) return [];
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function cells(line) {
  // "| a | b |" → ["", " a ", " b ", ""] — keep the interior only.
  const parts = line.split('|');
  return parts.slice(1, parts.length - 1).map(s => s.trim());
}

// parseTable(content) → { columns: {Name: i}, rows: [{ID, Status, ...}] }
function parseTable(content) {
  // Commented-out example rows are shaped exactly like real ones.
  const live = String(content).replace(/<!--[\s\S]*?-->/g, '');
  const lines = live.split('\n');

  const headerLine = lines.find(l => /^\|\s*ID\s*\|/.test(l));
  if (!headerLine) return { columns: {}, rows: [] };

  const names = cells(headerLine);
  const columns = {};
  names.forEach((n, i) => {
    if (n) columns[n] = i;
  });

  const rows = [];
  for (const line of lines) {
    // T-\d+ ALONE drops every lettered sub-task (T-070b, T-121c). The shell
    // reader counts them and this one did not, so the dashboard silently omitted
    // rows the orchestrator was acting on. Same pattern bit an archival script in
    // this project on 2026-08-18, which moved every numbered row and left its
    // lettered children behind.
    if (!/^\|\s*T-\d+[a-z]?\s*\|/.test(line)) continue;
    const c = cells(line);
    const row = {};
    for (const [name, i] of Object.entries(columns)) row[name] = c[i] ?? '';
    rows.push(row);
  }
  return { columns, rows };
}

// parseTasks(content) → { pending, in_progress, blocked, done }
// Shape kept for the dashboard: buckets of task objects.
function parseTasks(content) {
  const tasks = { done: [], in_progress: [], pending: [], blocked: [] };
  const { rows } = parseTable(content);

  for (const row of rows) {
    const bucket = BUCKET[(row.Status || '').toUpperCase()];
    if (!bucket) continue; // CANCELLED, or an unfilled placeholder row

    tasks[bucket].push({
      id: row.ID,
      title: row.Title,
      module: row.Module,
      feature: row.Feature,
      agent: row.Agent,
      priority: row.Pri,
      depends: row.Depends,
      artifacts: splitCell(row.Artifacts),
      outcome: isNone(row.Outcome) ? '' : row.Outcome,
      status: bucket,
    });
  }
  return tasks;
}

module.exports = { parseTable, parseTasks, splitCell, isNone, BUCKET };
