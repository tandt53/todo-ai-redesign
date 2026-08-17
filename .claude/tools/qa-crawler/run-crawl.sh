#!/bin/bash

# ─── QA Google Car — Daily Crawl Runner ──────────────────
#
# Usage:
#   ./run-crawl.sh <project-name>
#   ./run-crawl.sh odc-academy
#   ./run-crawl.sh my-new-app
#
# Cron setup (runs every morning at 8:00 AM):
#   0 8 * * * /path/to/qa-crawler/run-crawl.sh odc-academy >> /path/to/qa-crawler/projects/odc-academy/logs/cron.log 2>&1
#
# Prerequisites:
#   npm install -g @playwright/cli@latest
#   playwright-cli install --skills
#   npm install -g @anthropic-ai/claude-code
# ─────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="$1"

if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: ./run-crawl.sh <project-name>"
  echo ""
  echo "Available projects:"
  for d in "$SCRIPT_DIR/projects"/*/; do
    if [ -f "$d/crawl.config.json" ]; then
      echo "  - $(basename "$d")"
    fi
  done
  echo ""
  echo "Create a new project:"
  echo "  mkdir projects/<name>"
  echo "  cp crawl.config.template.json projects/<name>/crawl.config.json"
  echo "  # Edit the config with your app's URL and credentials"
  exit 1
fi

PROJECT_DIR="$SCRIPT_DIR/projects/$PROJECT_NAME"
LOG_DIR="$PROJECT_DIR/logs"
OUTPUT_DIR="$PROJECT_DIR/output"
LOG_FILE="$LOG_DIR/crawl-$(date +%Y-%m-%d).log"

# Validate project exists
if [ ! -d "$PROJECT_DIR" ]; then
  echo "Project not found: $PROJECT_DIR"
  echo "Create it with: mkdir projects/$PROJECT_NAME && cp crawl.config.template.json projects/$PROJECT_NAME/crawl.config.json"
  exit 1
fi

if [ ! -f "$PROJECT_DIR/crawl.config.json" ]; then
  echo "Config not found: $PROJECT_DIR/crawl.config.json"
  echo "Create it with: cp crawl.config.template.json projects/$PROJECT_NAME/crawl.config.json"
  exit 1
fi

mkdir -p "$LOG_DIR"
mkdir -p "$OUTPUT_DIR/knowledge/pages"
mkdir -p "$OUTPUT_DIR/knowledge/flows"

echo "========================================" | tee -a "$LOG_FILE"
echo "QA Crawler started at $(date)"           | tee -a "$LOG_FILE"
echo "Project: $PROJECT_NAME"                   | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

cd "$SCRIPT_DIR"

# Check prerequisites
if ! command -v claude &> /dev/null; then
  echo "Claude Code not found. Install with: npm install -g @anthropic-ai/claude-code" | tee -a "$LOG_FILE"
  exit 1
fi

if ! command -v playwright-cli &> /dev/null; then
  echo "playwright-cli not found. Install with: npm install -g @playwright/cli@latest" | tee -a "$LOG_FILE"
  exit 1
fi

echo "Prerequisites OK" | tee -a "$LOG_FILE"
echo "Reading CLAUDE.md instructions..." | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Launch Claude Code with project context
claude --print \
  "You are a QA crawler agent. The active project is '$PROJECT_NAME' (project dir: projects/$PROJECT_NAME/). Read CLAUDE.md for your full instructions, then read projects/$PROJECT_NAME/crawl.config.json for the target app configuration. All output goes to projects/$PROJECT_NAME/output/. Execute the full crawl now — login if needed, explore every page, run QA intelligence analysis, and write all output files. Be thorough." \
  2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo "" | tee -a "$LOG_FILE"

if [ $EXIT_CODE -eq 0 ]; then
  echo "Crawl completed at $(date)" | tee -a "$LOG_FILE"

  # Print summary of output files
  echo "" | tee -a "$LOG_FILE"
  echo "Output files:" | tee -a "$LOG_FILE"
  PAGE_COUNT=$(ls "$OUTPUT_DIR/knowledge/pages/"*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "  Pages crawled: $PAGE_COUNT" | tee -a "$LOG_FILE"
  for f in knowledge/qa-intelligence.json catalog.md sitemap.json; do
    if [ -f "$OUTPUT_DIR/$f" ]; then
      SIZE=$(wc -c < "$OUTPUT_DIR/$f")
      echo "  $f ($SIZE bytes)" | tee -a "$LOG_FILE"
    fi
  done

  # A clean session exit is NOT proof of a successful crawl. `claude --print`
  # returns 0 whenever the nested session ends tidily — including when the agent
  # correctly DECLINES to crawl (unreachable host, bad config) rather than
  # fabricating pages. Gate on the artifacts instead, or an orchestrator routing
  # on exit code alone records a failed crawl as a success.
  if [ "$PAGE_COUNT" -eq 0 ] || [ ! -f "$OUTPUT_DIR/knowledge/pageIndex.json" ]; then
    echo "" | tee -a "$LOG_FILE"
    echo "Crawl produced no knowledge: pages=$PAGE_COUNT, pageIndex.json missing=$([ -f "$OUTPUT_DIR/knowledge/pageIndex.json" ] && echo no || echo yes)" | tee -a "$LOG_FILE"
    echo "The nested session exited cleanly but wrote no crawl output — treat this as a FAILED crawl." | tee -a "$LOG_FILE"
    echo "Common causes: target_url unreachable, auth rejected, or the crawler declined the work." | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    exit 3
  fi
else
  echo "Crawl failed (exit code $EXIT_CODE) at $(date)" | tee -a "$LOG_FILE"
fi

echo "========================================" | tee -a "$LOG_FILE"
exit $EXIT_CODE
