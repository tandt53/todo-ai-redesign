#!/usr/bin/env node
// Layer 1 — Rich agent metrics capture
// PostToolUse hook for Agent/Task dispatch completions
// Writes: .claude/eval/metrics/layer1/{date}-{agent}-{timestamp}.json

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const projectName = path.basename(projectRoot);
const metricsDir = path.join(projectRoot, '.claude', 'eval', 'metrics', 'layer1');

// Read hook input from stdin
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => raw += chunk);
process.stdin.on('end', () => {
  try {
    const inp = JSON.parse(raw);
    const metric = parseMetric(inp);
    if (metric) writeMetric(metric);
  } catch {}
});

function parseMetric(inp) {
  const toolInput = inp.tool_input || {};
  const description = toolInput.description || '';
  const prompt = toolInput.prompt || '';

  // --- Parse tool_output (plain string or JSON with content[].text) ---
  let rawOutput = inp.tool_output || inp.tool_response || inp.tool_result || '';
  let outputText = '';
  let durationMs = 0;

  if (typeof rawOutput === 'string') {
    try {
      const parsed = JSON.parse(rawOutput);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.content)) {
          outputText = parsed.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');
        } else {
          outputText = rawOutput;
        }
        durationMs = parsed.totalDurationMs || 0;
      } else {
        outputText = rawOutput;
      }
    } catch {
      outputText = rawOutput;
    }
  } else if (rawOutput && typeof rawOutput === 'object') {
    if (Array.isArray(rawOutput.content)) {
      outputText = rawOutput.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
    }
    durationMs = rawOutput.totalDurationMs || 0;
  }

  // --- Agent name ---
  let agent = toolInput.subagent_type || '';
  if (!agent || agent === 'general-purpose') {
    const m = prompt.match(/name:\s*(\S+-agent)/);
    if (m) agent = m[1];
  }
  if (!agent) {
    const m = prompt.match(/# (spec|architect|design|backend|web|mobile|qa-api|qa-web|qa-mobile|reviewer|product)[ -]agent/i);
    if (m) agent = m[1].toLowerCase().replace(' ', '-') + '-agent';
  }
  if (!agent) {
    const m = description.match(/(spec|architect|design|backend|web|mobile|qa-api|qa-web|qa-mobile|reviewer|product)-agent/i);
    if (m) agent = m[0].toLowerCase();
  }
  if (!agent) return null;

  // --- Task ID & Feature ID ---
  const taskMatch = description.match(/T-\d+/);
  const taskId = taskMatch ? taskMatch[0] : 'unknown';

  const featureMatch = (description + ' ' + outputText + ' ' + prompt).match(/F-\d+/);
  const featureId = featureMatch ? featureMatch[0] : 'unknown';

  // --- Parse ---METRICS--- YAML block (preferred, reliable) ---
  let metricsBlock = null;
  const metricsMatch = outputText.match(/---METRICS---\n([\s\S]+?)$/);
  if (metricsMatch) {
    try {
      // Simple YAML parser for our known fields
      const yaml = metricsMatch[1];
      metricsBlock = {};

      // Scalar fields
      const scalar = (key) => {
        const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
        return m ? m[1].trim() : null;
      };

      // Array fields (inline [a, b] or multiline - items)
      const arr = (key) => {
        // Inline: key: [a, b, c]
        const inline = yaml.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm'));
        if (inline) return inline[1].split(',').map(s => s.trim()).filter(Boolean);
        // Multiline: key:\n  - a\n  - b
        const block = yaml.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)+)`, 'm'));
        if (block) return block[1].match(/^\s+-\s+(.+)$/gm)?.map(l => l.replace(/^\s+-\s+/, '').trim()) || [];
        return [];
      };

      metricsBlock.status = scalar('status');
      metricsBlock.confidence = scalar('confidence');
      metricsBlock.files_created = arr('files_created');
      metricsBlock.files_modified = arr('files_modified');
      metricsBlock.tests_passing = parseInt(scalar('tests_passing')) || 0;
      metricsBlock.tests_total = parseInt(scalar('tests_total')) || 0;
      metricsBlock.acs_covered = arr('acs_covered');
      metricsBlock.blockers = arr('blockers');
      metricsBlock.bugs_filed = arr('bugs_filed');
    } catch {}
  }

  // --- Status (from METRICS block or regex fallback) ---
  const status = metricsBlock?.status?.toUpperCase()
    || (outputText.match(/(?:Status|status)[:\*]*\s*(DONE|BLOCKED|PARTIAL|ERROR|APPROVE|REJECT)/i)?.[1]?.toUpperCase())
    || 'unknown';

  // --- Confidence ---
  const confidence = metricsBlock?.confidence?.toUpperCase() || 'unknown';

  // --- Files created (from METRICS block or regex fallback) ---
  const filesCreated = metricsBlock?.files_created?.length
    ? metricsBlock.files_created
    : [...new Set((outputText.match(/(?:src|specs|qa|design|reports)\/[\w/\-\.]+\.\w+/g) || []))].sort();

  // --- Files on disk ---
  function countFiles(dir, ext) {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    const walk = d => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) walk(path.join(d, f.name));
        else if (!ext || f.name.endsWith(ext)) count++;
      }
    };
    walk(dir);
    return count;
  }

  function countLOC(dir) {
    if (!fs.existsSync(dir)) return 0;
    let lines = 0;
    const walk = d => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, f.name);
        if (f.isDirectory()) walk(full);
        else if (f.name.endsWith('.ts') || f.name.endsWith('.tsx')) {
          try { lines += fs.readFileSync(full, 'utf8').split('\n').length; } catch {}
        }
      }
    };
    walk(dir);
    return lines;
  }

  const specsDir = path.join(projectRoot, 'specs');
  const srcDir = path.join(projectRoot, 'src');
  const qaDir = path.join(projectRoot, 'qa');

  const specsCount = countFiles(specsDir, '.md');
  const srcCount = countFiles(srcDir, '.ts') + countFiles(srcDir, '.tsx');
  const qaCount = countFiles(qaDir);
  const totalLoc = countLOC(srcDir);

  // Test files
  let testCount = 0;
  if (fs.existsSync(srcDir)) {
    const walk = d => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) walk(path.join(d, f.name));
        else if (f.name.includes('.test.')) testCount++;
      }
    };
    walk(srcDir);
  }

  // --- Tests (from METRICS block or regex fallback) ---
  const testsPassing = metricsBlock?.tests_passing
    || parseInt(outputText.match(/(\d+)\s+(?:tests?\s+)?pass/i)?.[1]) || 0;
  const testsFailing = parseInt(outputText.match(/(\d+)\s+(?:tests?\s+)?fail/i)?.[1]) || 0;
  const testsTotal = metricsBlock?.tests_total
    || parseInt(outputText.match(/(\d+)(?:\/\d+)?\s+tests?/i)?.[1]) || 0;

  // --- ACs (from METRICS block or regex fallback) ---
  const acs = metricsBlock?.acs_covered?.length
    ? metricsBlock.acs_covered
    : [...new Set(outputText.match(/AC-\d+/g) || [])].sort();

  // --- Blockers (from METRICS block or regex fallback) ---
  // Use the summary text (before ---METRICS---) for regex fallback, not the full output
  const textForParsing = metricsMatch ? outputText.slice(0, metricsMatch.index) : outputText;
  const blockers = metricsBlock?.blockers?.length
    ? metricsBlock.blockers
    : textForParsing.split('\n')
        .filter(l => /blocker|blocked|cannot|missing|not available|not running/i.test(l))
        .slice(0, 3)
        .map(l => l.trim());

  // --- Bugs filed ---
  const bugsFiled = metricsBlock?.bugs_filed || [];

  // --- Summary (markdown part before ---METRICS---) ---
  const summaryText = metricsMatch
    ? outputText.slice(0, metricsMatch.index).trim().slice(0, 3000)
    : (outputText.slice(0, 3000) || 'No summary available');

  const now = new Date();

  return {
    layer: 1,
    agent,
    task_id: taskId,
    task_description: description,
    feature_id: featureId,
    timestamp: now.toISOString().replace(/\.\d+Z$/, 'Z'),
    status,
    duration_seconds: Math.floor(durationMs / 1000),
    files_created: filesCreated,
    files_created_count: filesCreated.length,
    project_stats: {
      spec_files: specsCount,
      source_files: srcCount,
      test_files: testCount,
      qa_files: qaCount,
      total_loc: totalLoc,
    },
    confidence,
    tests: {
      passing: testsPassing,
      failing: testsFailing,
      total: testsTotal,
    },
    acs_covered: acs.length ? acs.join(',') : 'none',
    blockers: blockers.length ? blockers.join(' | ') : 'none',
    bugs_filed: bugsFiled,
    summary: summaryText,
    capture_method: 'hook:PostToolUse',
    project: projectName,
  };
}

function writeMetric(metric) {
  fs.mkdirSync(metricsDir, { recursive: true });
  const date = new Date().toISOString().split('T')[0];
  // Millisecond precision, plus a collision suffix. Second-granularity names let
  // two dispatches of the same agent in the same second silently overwrite each
  // other — the losing dispatch vanishes from the dashboard with no error.
  const ts = Date.now();
  let outfile = path.join(metricsDir, `${date}-${metric.agent}-${ts}.json`);
  for (let n = 1; fs.existsSync(outfile); n++) {
    outfile = path.join(metricsDir, `${date}-${metric.agent}-${ts}-${n}.json`);
  }
  fs.writeFileSync(outfile, JSON.stringify(metric, null, 2));
}
