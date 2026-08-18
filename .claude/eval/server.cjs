const http = require('http');
const fs = require('fs');
const path = require('path');

// Column positions come from TASKS.md's own header via the shared reader —
// see .claude/lib/tasks.cjs. Never re-derive them here.
const { parseTasks: parseTasksTable } = require('../lib/tasks.cjs');

const PORT = process.env.PORT || 8080;
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const EVAL_DIR = __dirname;
const METRICS_L1 = path.join(EVAL_DIR, 'metrics/layer1');
const METRICS_L2 = path.join(EVAL_DIR, 'metrics/layer2');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function readMetrics(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== 'summary.json')
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean);
}

function parseTasks() {
  const tasksFile = path.join(PROJECT_ROOT, '.claude', 'state', 'TASKS.md');
  if (!fs.existsSync(tasksFile)) return { done: [], in_progress: [], pending: [], blocked: [] };

  return parseTasksTable(fs.readFileSync(tasksFile, 'utf8'));
}

function parseStatus() {
  const statusFile = path.join(PROJECT_ROOT, '.claude', 'state', 'STATUS.md');
  if (!fs.existsSync(statusFile)) return { in_flight: [], phase: 'unknown' };

  const content = fs.readFileSync(statusFile, 'utf8');

  // Extract current phase
  const phaseMatch = content.match(/\*\*Current\*\*:\s*(\w+)/);
  const phase = phaseMatch ? phaseMatch[1] : 'unknown';

  // Extract in-flight agents
  const inFlight = [];
  const rows = content.match(/^\|\s*T-\d+\s*\|.+$/gm) || [];
  for (const row of rows) {
    const m = row.match(/^\|\s*(T-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
    if (m && m[2].trim() !== '—') {
      inFlight.push({ task_id: m[1].trim(), agent: m[2].trim(), module: m[3].trim(), feature: m[4].trim() });
    }
  }
  return { in_flight: inFlight, phase };
}

function parseBriefing() {
  const file = path.join(PROJECT_ROOT, 'BRIEFING.md');
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, 'utf8');

  const task = content.match(/\*\*Task:\*\*\s*(.+)/)?.[1]?.trim() || '';
  const agent = content.match(/\*\*Agent:\*\*\s*(.+)/)?.[1]?.trim() || '';
  const module = content.match(/\*\*Module:\*\*\s*(.+)/)?.[1]?.trim() || '';
  const feature = content.match(/\*\*Feature:\*\*\s*(.+)/)?.[1]?.trim() || '';
  const status = content.match(/\*\*Status:\*\*\s*(.+)/)?.[1]?.trim() || 'IN PROGRESS';

  return { task, agent, module, feature, status };
}

function parseBlockers() {
  const file = path.join(PROJECT_ROOT, '.claude', 'state', 'STATUS.md');
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8');

  const blockers = [];
  const rows = content.match(/^\|\s*B-\d+\s*\|.+$/gm) || [];
  for (const row of rows) {
    const m = row.match(/^\|\s*(B-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
    if (m && m[1].trim() !== '—') {
      blockers.push({ id: m[1].trim(), description: m[2].trim(), waiting_on: m[3].trim(), raised_by: m[4].trim() });
    }
  }
  return blockers;
}

const server = http.createServer((req, res) => {
  // API: return metrics as JSON
  if (req.url === '/api/metrics') {
    const layer1 = readMetrics(METRICS_L1);
    const layer2 = readMetrics(METRICS_L2);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ layer1, layer2 }));
    return;
  }

  // API: return layer1 only
  if (req.url === '/api/metrics/layer1') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(readMetrics(METRICS_L1)));
    return;
  }

  // API: return tasks from TASKS.md
  if (req.url === '/api/tasks') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(parseTasks()));
    return;
  }

  // API: return status from STATUS.md
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(parseStatus()));
    return;
  }

  // API: return current briefing
  if (req.url === '/api/briefing') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(parseBriefing()));
    return;
  }

  // API: return blockers
  if (req.url === '/api/blockers') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(parseBlockers()));
    return;
  }

  // API: return pipeline diagram
  if (req.url === '/api/pipeline') {
    const mmdFile = path.join(EVAL_DIR, 'pipeline.mmd');
    if (fs.existsSync(mmdFile)) {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end(fs.readFileSync(mmdFile, 'utf8'));
    } else {
      res.writeHead(404);
      res.end('pipeline.mmd not found');
    }
    return;
  }

  // API: return layer2 only
  if (req.url === '/api/metrics/layer2') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(readMetrics(METRICS_L2)));
    return;
  }

  // Default route → dashboard
  let filePath = req.url === '/' ? '/dashboard.html' : req.url;
  const fullPath = path.join(EVAL_DIR, filePath);

  // Security: don't serve files outside eval dir
  if (!fullPath.startsWith(EVAL_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(fullPath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(fullPath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  res.end(fs.readFileSync(fullPath));
});

server.listen(PORT, () => {
  console.log(`\n  Agent Pipeline Dashboard`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  API endpoints:`);
  console.log(`    GET /api/metrics        — all metrics (layer1 + layer2)`);
  console.log(`    GET /api/metrics/layer1  — agent performance`);
  console.log(`    GET /api/metrics/layer2  — quality signals\n`);
});
