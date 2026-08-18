#!/usr/bin/env bash
# Layer 1 — Agent metrics capture (delegates to Node.js)
# Writes: .claude/eval/metrics/layer1/{date}-{agent}-{timestamp}.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat | node "$SCRIPT_DIR/capture-agent-metrics.cjs"
