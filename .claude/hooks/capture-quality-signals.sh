#!/usr/bin/env bash
# Layer 2 — External quality signal capture
# PostToolUse hook for Write/Edit on reports/ and qa/_shared/bugs/
#
# Captures judgment signals from DOWNSTREAM agents:
#   - reviewer-agent writes reports/review-F-*.md → extract PASS/FAIL, C1-C14 results, failure count
#   - product-agent writes reports/product-review-F-*.md → extract APPROVED/CHANGES REQUESTED, issue counts
#   - qa-*-agent writes qa/_shared/bugs/BUG-*.md → extract severity, layer, feature
#   - qa-*-agent writes qa/*/runs/*.md → extract pass/fail counts
#
# Writes: .claude/eval/metrics/layer2/{timestamp}-{signal-type}-{feature}.json
# Triggered: every time a Write/Edit succeeds on a reports/ or qa/ file

set -e

INPUT=$(cat)

# Extract the file path that was written
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_response.filePath // .tool_input.file_path // ""' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE=$(date -u +"%Y-%m-%d")

# Project identity
PROJECT_NAME=$(basename "$(pwd)")
PROJECT_ROOT="$(pwd)"

# Project-local metrics directory
METRICS_DIR="${PROJECT_ROOT}/.claude/eval/metrics/layer2"
mkdir -p "$METRICS_DIR"

BASENAME=$(basename "$FILE_PATH")

# --- Reviewer report ---
if echo "$FILE_PATH" | grep -q "reports/review-F-"; then
  # Extract feature ID
  FEATURE=$(echo "$BASENAME" | grep -o 'F-[0-9]\+' | head -1)

  # Extract result (STRUCTURAL-PASS or STRUCTURAL-FAIL)
  RESULT=$(grep -o 'STRUCTURAL-[A-Z]*' "$FILE_PATH" | head -1 || echo "UNKNOWN")

  # Count check results
  CHECKS_PASSED=$(grep -c '| PASS |' "$FILE_PATH" 2>/dev/null || echo "0")
  CHECKS_FAILED=$(grep -c '| FAIL |' "$FILE_PATH" 2>/dev/null || echo "0")

  # Extract which checks failed
  FAILED_CHECKS=$(grep '| FAIL |' "$FILE_PATH" | grep -o 'C[0-9]' | tr '\n' ',' | sed 's/,$//' || echo "")

  cat > "$METRICS_DIR/${DATE}-review-${FEATURE:-unknown}.json" << EOF
{
  "layer": 2,
  "signal_type": "review",
  "feature": "${FEATURE:-unknown}",
  "timestamp": "$NOW",
  "source_file": "$FILE_PATH",
  "result": "$RESULT",
  "checks_passed": $CHECKS_PASSED,
  "checks_failed": $CHECKS_FAILED,
  "failed_checks": "$FAILED_CHECKS",
  "project": "$PROJECT_NAME"
}
EOF
  exit 0
fi

# --- Product review ---
if echo "$FILE_PATH" | grep -q "reports/product-review-F-"; then
  FEATURE=$(echo "$BASENAME" | grep -o 'F-[0-9]\+' | head -1)
  RESULT=$(grep -oE 'APPROVED|CHANGES REQUESTED' "$FILE_PATH" | head -1 || echo "UNKNOWN")
  HIGH=$(grep -c '| H-' "$FILE_PATH" 2>/dev/null || echo "0")
  MEDIUM=$(grep -c '| M-' "$FILE_PATH" 2>/dev/null || echo "0")

  cat > "$METRICS_DIR/${DATE}-product-review-${FEATURE:-unknown}.json" << EOF
{
  "layer": 2,
  "signal_type": "product_review",
  "feature": "${FEATURE:-unknown}",
  "timestamp": "$NOW",
  "source_file": "$FILE_PATH",
  "result": "$RESULT",
  "high_issues": $HIGH,
  "medium_issues": $MEDIUM,
  "project": "$PROJECT_NAME"
}
EOF
  exit 0
fi

# --- Bug report ---
if echo "$FILE_PATH" | grep -q "bugs/BUG-"; then
  FEATURE=$(grep -oE 'F-[0-9]+' "$FILE_PATH" | head -1 || echo "unknown")
  SEVERITY=$(grep -oE 'CRITICAL|HIGH|MEDIUM|LOW' "$FILE_PATH" | head -1 || echo "unknown")
  LAYER=$(grep -E '^\| Layer' "$FILE_PATH" | grep -oE 'api|web|mobile' | head -1 || echo "unknown")
  BUG_ID=$(echo "$BASENAME" | grep -o 'BUG-[0-9]\+' || echo "unknown")

  cat > "$METRICS_DIR/${DATE}-bug-${BUG_ID}.json" << EOF
{
  "layer": 2,
  "signal_type": "bug",
  "bug_id": "$BUG_ID",
  "feature": "$FEATURE",
  "timestamp": "$NOW",
  "source_file": "$FILE_PATH",
  "severity": "$SEVERITY",
  "root_cause_layer": "$LAYER",
  "project": "$PROJECT_NAME"
}
EOF
  exit 0
fi

# --- Test run ---
if echo "$FILE_PATH" | grep -q "runs/"; then
  FEATURE=$(echo "$FILE_PATH" | grep -oE 'F-[0-9]+' || echo "unknown")
  PLATFORM=$(echo "$BASENAME" | grep -oE 'api|web|mobile' | head -1 || echo "unknown")
  PASSED=$(grep -c '| PASS |' "$FILE_PATH" 2>/dev/null || echo "0")
  FAILED=$(grep -c '| FAIL |' "$FILE_PATH" 2>/dev/null || echo "0")
  SKIPPED=$(grep -c '| SKIP |' "$FILE_PATH" 2>/dev/null || echo "0")

  cat > "$METRICS_DIR/${DATE}-run-${PLATFORM}-${FEATURE}.json" << EOF
{
  "layer": 2,
  "signal_type": "test_run",
  "feature": "$FEATURE",
  "platform": "$PLATFORM",
  "timestamp": "$NOW",
  "source_file": "$FILE_PATH",
  "tests_passed": $PASSED,
  "tests_failed": $FAILED,
  "tests_skipped": $SKIPPED,
  "project": "$PROJECT_NAME"
}
EOF
  exit 0
fi
