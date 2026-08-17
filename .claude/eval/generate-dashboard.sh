#!/usr/bin/env bash
# Generate static dashboard or start live server
# Usage:
#   bash .claude/eval/generate-dashboard.sh          # static build + open
#   bash .claude/eval/generate-dashboard.sh --serve   # live server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$1" = "--serve" ]; then
  node "$SCRIPT_DIR/server.js"
  exit 0
fi

# Static build — inject both metric layers into the HTML.
# The placeholders below must match dashboard.html exactly; a rename on one side
# silently produces a report with no data (that is a bug this file already had).
node -e "
const fs = require('fs');
const path = require('path');

const template = path.join('$SCRIPT_DIR', 'dashboard.html');
const output = path.join('$SCRIPT_DIR', 'dashboard-report.html');

function readLayer(name) {
  const dir = path.join('$SCRIPT_DIR', 'metrics', name);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== 'summary.json')
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean);
}

const layer1 = readLayer('layer1');
const layer2 = readLayer('layer2');

if (!layer1.length && !layer2.length) {
  console.log('No metrics found in metrics/layer1 or metrics/layer2 — nothing to build.');
  console.log('Dispatch an agent first, or run the live server: bash .claude/eval/generate-dashboard.sh --serve');
  process.exit(1);
}

let html = fs.readFileSync(template, 'utf8');

for (const [token, data] of [['__INJECT_LAYER1__', layer1], ['__INJECT_LAYER2__', layer2]]) {
  const marker = '/*' + token + '*/[]';
  if (!html.includes(marker)) {
    console.error('FATAL: placeholder ' + marker + ' not found in dashboard.html.');
    console.error('The static build and the template have drifted — the report would contain no data.');
    process.exit(2);
  }
  html = html.replace(marker, JSON.stringify(data));
}

fs.writeFileSync(output, html);
console.log('Dashboard generated:', output);
console.log(' ', layer1.length, 'dispatches (layer 1),', layer2.length, 'quality signals (layer 2)');
" || exit 1

echo "Opening in browser..."
open "$SCRIPT_DIR/dashboard-report.html" 2>/dev/null || xdg-open "$SCRIPT_DIR/dashboard-report.html" 2>/dev/null || echo "Open: $SCRIPT_DIR/dashboard-report.html"
