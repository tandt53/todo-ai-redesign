#!/usr/bin/env bash
# What one request cost — read from .claude/eval/events.jsonl
#
#   bash .claude/eval/orchestrator-report.sh          # recent episodes
#   bash .claude/eval/orchestrator-report.sh --all    # every episode
#
# Every other metric in this template measures a dispatched agent. This one
# measures the thing choosing what to dispatch, because that choice is where the
# expensive mistakes are: a question answered with three agent runs costs more
# than a poorly written test case ever will, and nothing recorded it.
#
# An episode is one request, from the moment the person speaks to the moment the
# turn ends. Dispatches were always logged; they were never grouped by the ask
# they were serving, so waste had no unit.
#
# Ranked by artifacts produced, lowest first. That ordering is the point: an
# episode with dispatches and no artifacts is either a question that should have
# been answered directly, or work that failed and was reported as done.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$SCRIPT_DIR/events.jsonl"
LIMIT=15
[ "${1:-}" = "--all" ] && LIMIT=100000

if [ ! -s "$LOG" ]; then
  echo "orchestrator-report: no events yet at $LOG"
  echo "  Episodes are recorded from the first request after the UserPromptSubmit"
  echo "  hook is wired in settings.json."
  exit 0
fi

command -v node >/dev/null 2>&1 || { echo "orchestrator-report: node not found — skipped."; exit 0; }

node - "$LOG" "$LIMIT" <<'NODE'
const fs = require('fs');
const [log, limitArg] = process.argv.slice(2);
const limit = parseInt(limitArg, 10);

const episodes = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean)
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(e => e && e.event === 'episode');

if (!episodes.length) {
  console.log('orchestrator-report: no episodes recorded yet.');
  console.log('  A request opens one and Stop closes it. If dispatches are being');
  console.log('  logged but episodes are not, UserPromptSubmit is not wired.');
  process.exit(0);
}

const n = episodes.length;
const sum = k => episodes.reduce((a, e) => a + (e[k] || 0), 0);
const withDispatch = episodes.filter(e => e.dispatches > 0);
const barren = withDispatch.filter(e => (e.artifacts || 0) === 0);
const rework = episodes.filter(e => (e.repeated_tasks || []).length > 0);

console.log(`─── orchestrator: ${n} episode(s) ───\n`);
console.log(`  dispatches            ${sum('dispatches')} across ${withDispatch.length} episode(s) that dispatched`);
console.log(`  artifacts             ${sum('artifacts')}`);
console.log(`  answered directly     ${n - withDispatch.length} episode(s) — no agent run`);
console.log(`  dispatched, no output  ${barren.length} episode(s) — the shape worth reading`);
console.log(`  reported done, empty  ${sum('zero_artifact_returns')} return(s)`);
console.log(`  blocked returns       ${sum('blocked_returns')}`);
console.log(`  returns with no block ${sum('unknown_returns')} — protocol violation, not routable`);
console.log(`  rework                ${rework.length} episode(s) dispatched a task twice\n`);

const shown = episodes
  .map((e, i) => ({ ...e, i }))
  .sort((a, b) => (a.artifacts || 0) - (b.artifacts || 0) || (b.dispatches || 0) - (a.dispatches || 0))
  .slice(0, limit);

console.log('  ' + ['#', 'when', 'secs', 'disp', 'artf', 'empty', 'agents'].join('\t'));
for (const e of shown) {
  const when = (e.ts || '').slice(5, 16).replace('T', ' ');
  const agents = (e.agents || []).join(',') || '—';
  const flag = (e.dispatches > 0 && (e.artifacts || 0) === 0) ? ' ←' : '';
  console.log(`  ${e.i + 1}\t${when}\t${e.duration_seconds ?? '?'}\t${e.dispatches}\t${e.artifacts}\t${e.zero_artifact_returns}\t${agents}${flag}`);
}

console.log(`\n  ← dispatched and produced nothing. Either the ask needed an answer`);
console.log(`    rather than a pipeline, or the work failed and came back as done.`);
console.log(`\n  Not captured here: whether a dispatch was worth making, and whether`);
console.log(`  the report the person got was any good. Neither is a file.`);
NODE
