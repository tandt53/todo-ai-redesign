#!/usr/bin/env node
// Append-only event log. Reads a Claude Code hook envelope on stdin, appends
// one JSON line to .claude/eval/events.jsonl, and never throws.
//
// Only this hook writes the file. Agents write TASKS.md/STATUS.md; the harness
// writes here. Two writers with different trust levels means the log can audit
// the state files — most usefully, it records when an agent reported DONE
// having created no files, which the state file alone would not preserve.

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

  if (event === 'Stop') {
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

function append(obj) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
  } catch {
    // Never break the session being observed.
  }
}
