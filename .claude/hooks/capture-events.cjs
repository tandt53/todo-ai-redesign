#!/usr/bin/env node
// Append-only event log. Reads a Claude Code hook envelope on stdin, appends
// one JSON line to .claude/eval/events.jsonl, and never throws.
//
// Only this hook writes the file. Agents write TASKS.md/STATUS.md; the harness
// writes here. Two writers with different trust levels means the log can audit
// the state files — most usefully, it records when an agent reported DONE
// having created no files, which the state file alone would not preserve.
//
// It also measures the orchestrator, which nothing else does. Every other hook
// captures a dispatched agent; the thing choosing what to dispatch was invisible.
// A request the person makes opens an EPISODE, and Stop closes it with a summary
// of what that one ask consumed. That unit is the missing one: dispatches were
// always recorded, never grouped by the question they were answering, so
// "25 minutes and zero bytes for a colour-options question" left no trace a
// query could find.
//
// Nothing here is self-reported. The orchestrator does not get asked how it did,
// for the same reason agents are not: the answer is always fine.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG_DIR = path.join(ROOT, '.claude', 'eval');
const LOG = path.join(LOG_DIR, 'events.jsonl');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let inp;
  try {
    inp = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const event = inp.hook_event_name || inp.hook_event || '';
  const tool = inp.tool_name || '';

  // A person spoke. Everything until the next Stop belongs to this request.
  //
  // The prompt TEXT is not stored — only its size and the session. The log is a
  // project file that may be committed, and the value here is the boundary, not
  // the wording. Set ORCHESTRATOR_METRICS_PROMPT=1 to keep the first 200
  // characters when diagnosing which kinds of ask go wrong.
  if (event === 'UserPromptSubmit') {
    const prompt = String(inp.prompt || inp.user_prompt || '');
    append({
      event: 'request',
      session: inp.session_id || null,
      prompt_chars: prompt.length,
      prompt: process.env.ORCHESTRATOR_METRICS_PROMPT === '1' ? prompt.slice(0, 200) : null,
    });
    process.exit(0);
  }

  if (event === 'Stop') {
    summariseEpisode(inp.session_id || null);
    append({ event: 'session_stop', session: inp.session_id || null });
    process.exit(0);
  }

  if (!/^(Task|Agent)$/.test(tool)) process.exit(0);

  // The agent's return text lives under one of several keys depending on the
  // Claude Code version; take the first that carries usable text.
  let out = inp.tool_output || inp.tool_response || inp.tool_result || '';
  if (typeof out !== 'string') {
    try {
      const p = typeof out === 'object' ? out : JSON.parse(out);
      out = p?.content?.[0]?.text || p?.text || p?.output || JSON.stringify(p);
    } catch {
      out = String(out);
    }
  }

  const input = inp.tool_input || {};
  const desc = String(input.description || '');

  // Dispatch descriptions are written as "T-001 — <desc>" by ORCHESTRATION.md.
  const task = (desc.match(/\bT-\d+\b/) || [])[0] || null;
  // Multi-part names must win: "qa-web-agent" must not be read as "web-agent",
  // which is what a bare [a-z]+-agent yields, since the hyphen is a word boundary.
  const agent = (desc.match(/\b([a-z]+(?:-[a-z]+)*-agent)\b/) || [])[1] || input.subagent_type || null;

  // status: lives in the ---METRICS--- block defined by _completion-protocol.md.
  const metrics = out.match(/---METRICS---\n([\s\S]+?)$/);
  const block = metrics ? metrics[1] : '';
  const status =
    (block.match(/^status:\s*([A-Za-z_]+)/m) || [])[1]?.toUpperCase() ||
    (out.match(/(?:^|\n)\s*status:\s*(DONE|PARTIAL|BLOCKED|APPROVE|REJECT)/i) || [])[1]?.toUpperCase() ||
    // A return with no block is itself the signal — the orchestrator must not
    // treat it as success, so record it rather than dropping the event.
    'UNKNOWN';

  const artifacts = [...listOf(block, 'files_created'), ...listOf(block, 'files_modified')];

  append({
    event: 'agent_return',
    task,
    agent,
    status,
    artifacts,
    // The derived-status rule from _completion-protocol.md: DONE with nothing
    // on disk is not a completion. Recording the contradiction here makes it
    // auditable even if the orchestrator credits the task anyway.
    evidence_conflict: status === 'DONE' && artifacts.length === 0 ? 'done_without_artifacts' : null,
    session: inp.session_id || null,
  });
});

// Both list syntaxes the contract allows: inline [a, b] and multiline "- a".
function listOf(text, key) {
  const inline = text.match(new RegExp(`^${key}:\\s*\\[(.*?)\\]`, 'm'));
  if (inline) {
    return inline[1]
      .split(',')
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  const multi = text.match(new RegExp(`^${key}:\\s*\\n((?:[ \\t]*-[ \\t]*.+\\n?)+)`, 'm'));
  if (multi) {
    return multi[1]
      .split('\n')
      .map(l => l.replace(/^[ \t]*-[ \t]*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return [];
}

// Close the open episode: everything logged since the last `request`.
//
// Read-then-summarise at Stop rather than counting as we go, because a hook is a
// separate process each time and has nowhere to keep a counter. The log is the
// state.
function summariseEpisode(session) {
  let lines;
  try {
    lines = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean);
  } catch {
    return; // no log yet — nothing to close
  }

  // Walk back to the last request. Stop early at a previous episode summary:
  // that boundary means this one was already closed and Stop fired again.
  const window = [];
  let started = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { continue; }
    if (e.event === 'episode') return;      // already summarised
    if (e.event === 'request') { started = e; break; }
    window.push(e);
  }
  if (!started) return;                     // no request opened — nothing to measure

  const returns = window.filter(e => e.event === 'agent_return');
  const tasks = returns.map(e => e.task).filter(Boolean);
  const seen = new Set();
  const repeated = [...new Set(tasks.filter(t => seen.has(t) || (seen.add(t), false)))];

  const startedAt = Date.parse(started.ts);
  const duration = Number.isFinite(startedAt)
    ? Math.max(0, Math.round((Date.now() - startedAt) / 1000))
    : null;

  append({
    event: 'episode',
    session,
    duration_seconds: duration,
    prompt_chars: started.prompt_chars ?? null,
    dispatches: returns.length,
    agents: [...new Set(returns.map(e => e.agent).filter(Boolean))],
    artifacts: returns.reduce((n, e) => n + (e.artifacts ? e.artifacts.length : 0), 0),
    // A dispatch that produced nothing. One is a blocked task; several against
    // one question is the shape R19 was written for.
    zero_artifact_returns: returns.filter(e => e.evidence_conflict === 'done_without_artifacts').length,
    blocked_returns: returns.filter(e => e.status === 'BLOCKED').length,
    unknown_returns: returns.filter(e => e.status === 'UNKNOWN').length,
    // The same task dispatched twice inside one ask is rework the orchestrator
    // caused — a briefing that did not carry what the agent needed.
    repeated_tasks: repeated,
  });
}

function append(obj) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
  } catch {
    // Never break the session being observed.
  }
}
