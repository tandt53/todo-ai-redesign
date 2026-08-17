#!/usr/bin/env bash
# Session digest writer — captures a historical snapshot at session end
#
# Hook: Stop (fires when Claude Code session ends or when /clear is called)
# Reads: .claude/eval/metrics/layer1/*.json and .claude/eval/metrics/layer2/*.json from the current project
# Writes: ~/.claude/eval/history/{project}-{feature}-{date}.json
#
# Each digest is a compact summary of one pipeline session — not the raw metrics,
# just enough to render trend lines across projects and time.

set -e

HISTORY_DIR="$HOME/.claude/eval/history"
mkdir -p "$HISTORY_DIR"

PROJECT_NAME=$(basename "$(pwd)")
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE=$(date -u +"%Y-%m-%d")
TIMESTAMP=$(date +%s)

# Check if this project has metrics
# Layer1/Layer2 live under the global history (Option A); LEGACY_DIR stays project-local
# for backward compatibility with older manual eval runs.
L1_DIR="$HOME/.claude/eval/history/${PROJECT_NAME}/layer1"
L2_DIR="$HOME/.claude/eval/history/${PROJECT_NAME}/layer2"
LEGACY_DIR=".claude/eval/metrics"

# Count Layer 1 dispatches
L1_COUNT=0
if [ -d "$L1_DIR" ]; then
  L1_COUNT=$(find "$L1_DIR" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
fi

# Count legacy metrics (from manual eval runs)
LEGACY_COUNT=0
if [ -d "$LEGACY_DIR" ]; then
  LEGACY_COUNT=$(find "$LEGACY_DIR" -maxdepth 1 -name "*.json" ! -name "summary.json" 2>/dev/null | wc -l | tr -d ' ')
fi

TOTAL_DISPATCHES=$((L1_COUNT + LEGACY_COUNT))

# Skip if no metrics at all
if [ "$TOTAL_DISPATCHES" -eq 0 ]; then
  exit 0
fi

# --- Extract Layer 2 signals ---

# Reviews
REVIEW_TOTAL=0; REVIEW_PASS=0; REVIEW_FAIL=0; FAILED_CHECKS=""
if [ -d "$L2_DIR" ]; then
  for f in "$L2_DIR"/*-review-*.json; do
    [ -f "$f" ] || continue
    REVIEW_TOTAL=$((REVIEW_TOTAL + 1))
    result=$(jq -r '.result // ""' "$f" 2>/dev/null)
    if [ "$result" = "STRUCTURAL-PASS" ]; then
      REVIEW_PASS=$((REVIEW_PASS + 1))
    elif [ "$result" = "STRUCTURAL-FAIL" ]; then
      REVIEW_FAIL=$((REVIEW_FAIL + 1))
      checks=$(jq -r '.failed_checks // ""' "$f" 2>/dev/null)
      FAILED_CHECKS="$FAILED_CHECKS,$checks"
    fi
  done
fi

# Bugs
BUG_TOTAL=0; BUG_CRITICAL=0; BUG_HIGH=0
if [ -d "$L2_DIR" ]; then
  for f in "$L2_DIR"/*-bug-*.json; do
    [ -f "$f" ] || continue
    BUG_TOTAL=$((BUG_TOTAL + 1))
    sev=$(jq -r '.severity // ""' "$f" 2>/dev/null)
    [ "$sev" = "CRITICAL" ] && BUG_CRITICAL=$((BUG_CRITICAL + 1))
    [ "$sev" = "HIGH" ] && BUG_HIGH=$((BUG_HIGH + 1))
  done
fi

# Test runs
TESTS_PASSED=0; TESTS_FAILED=0
if [ -d "$L2_DIR" ]; then
  for f in "$L2_DIR"/*-run-*.json; do
    [ -f "$f" ] || continue
    p=$(jq -r '.tests_passed // 0' "$f" 2>/dev/null)
    fl=$(jq -r '.tests_failed // 0' "$f" 2>/dev/null)
    TESTS_PASSED=$((TESTS_PASSED + p))
    TESTS_FAILED=$((TESTS_FAILED + fl))
  done
fi

# Features touched
FEATURES=""
if [ -d "$LEGACY_DIR" ]; then
  FEATURES=$(find "$LEGACY_DIR" -maxdepth 1 -name "*.json" ! -name "summary.json" -exec jq -r '.feature // empty' {} \; 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
fi
if [ -d "$L1_DIR" ]; then
  L1_FEATURES=$(find "$L1_DIR" -name "*.json" -exec jq -r '.feature // empty' {} \; 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
  [ -n "$L1_FEATURES" ] && FEATURES="$FEATURES,$L1_FEATURES"
fi
FEATURES=$(echo "$FEATURES" | tr ',' '\n' | sort -u | grep -v '^$' | tr '\n' ',' | sed 's/,$//')

# Agents involved
AGENTS=""
if [ -d "$LEGACY_DIR" ]; then
  AGENTS=$(find "$LEGACY_DIR" -maxdepth 1 -name "*.json" ! -name "summary.json" -exec jq -r '.agent // empty' {} \; 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
fi

# Fix loops (review_fail count = number of fix loops needed)
FIX_LOOPS=$REVIEW_FAIL

# Clean up failed_checks
FAILED_CHECKS=$(echo "$FAILED_CHECKS" | tr ',' '\n' | grep -v '^$' | sort | uniq -c | sort -rn | awk '{print $2"("$1"x)"}' | tr '\n' ',' | sed 's/,$//')

# --- Determine overall pipeline result ---
PIPELINE_RESULT="IN_PROGRESS"
if [ "$REVIEW_TOTAL" -gt 0 ]; then
  if [ "$REVIEW_PASS" -gt 0 ] && [ "$REVIEW_FAIL" -eq 0 ]; then
    PIPELINE_RESULT="PASS"
  elif [ "$REVIEW_PASS" -gt 0 ]; then
    PIPELINE_RESULT="PASS_AFTER_FIXES"
  else
    PIPELINE_RESULT="FAIL"
  fi
fi

# --- Write digest ---
OUTFILE="$HISTORY_DIR/${PROJECT_NAME}-${DATE}-${TIMESTAMP}.json"

cat > "$OUTFILE" << EOF
{
  "project": "$PROJECT_NAME",
  "date": "$DATE",
  "timestamp": "$NOW",
  "features": "$FEATURES",
  "pipeline_result": "$PIPELINE_RESULT",
  "dispatches": $TOTAL_DISPATCHES,
  "agents_involved": "$AGENTS",
  "fix_loops": $FIX_LOOPS,
  "review": {
    "total": $REVIEW_TOTAL,
    "passed": $REVIEW_PASS,
    "failed": $REVIEW_FAIL,
    "common_failures": "$FAILED_CHECKS"
  },
  "bugs": {
    "total": $BUG_TOTAL,
    "critical": $BUG_CRITICAL,
    "high": $BUG_HIGH
  },
  "tests": {
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED
  }
}
EOF
