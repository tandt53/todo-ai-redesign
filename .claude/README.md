# Project Starter Template

This template provides a complete setup for Claude Code multi-agent projects with automatic metrics capture.

## What's Included

### 1. Hook Configuration (`.claude/settings.json`)

Project-local hooks that fire automatically:
- **PostToolUse:Task** → Captures agent metrics
- **PostToolUse:Write|Edit** → Captures quality signals
- **Stop** → Captures session summary

### 2. Hook Scripts (`.claude/hooks/`)

- `capture-agent-metrics.sh` — Layer 1 metrics (objective facts)
- `capture-quality-signals.sh` — Layer 2 metrics (quality signals)
- `capture-session-digest.sh` — Session summaries
- `README.md` — Hook documentation

### 3. Metrics Directories (`.claude/eval/metrics/`)

- `layer1/` — Agent performance metrics (JSON)
- `layer2/` — Code quality signals (JSON)
- `../sessions/` — Session summaries (Markdown)

### 4. Embedded QA Crawler (`.claude/tools/qa-crawler/`)

A Playwright-based crawler used by `qa-explorer-agent` to explore existing web apps and produce a structured QA knowledge base. Invoked via `.claude/tools/qa-crawler/run-crawl.sh <project-name>`. See `.claude/tools/qa-crawler/README.md` for crawler-specific docs.

## Prerequisites for qa-explorer-agent

The embedded crawler needs Playwright CLI and Claude Code on PATH. Install once per machine:

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills
npm install -g @anthropic-ai/claude-code
```

If either is missing at dispatch time, `qa-explorer-agent` returns BLOCKED with install instructions. No action needed unless you plan to run exploratory crawls.

## Quick Start

### Option 1: Copy Template to New Project

```bash
# From claude-agents-final directory
cp -r templates/project-starter/* /path/to/new-project/
cd /path/to/new-project
```

### Option 2: Use Init Script

```bash
# From claude-agents-final directory
bash scripts/init-project.sh /path/to/new-project
```

### Option 3: Manual Setup

1. **Copy hook configuration:**
   ```bash
   mkdir -p .claude
   cp templates/project-starter/.claude/settings.json .claude/
   ```

2. **Copy hook scripts:**
   ```bash
   mkdir -p .claude/hooks
   cp templates/project-starter/.claude/hooks/* .claude/hooks/
   chmod +x .claude/hooks/*.sh
   ```

3. **Create metrics directories:**
   ```bash
   mkdir -p .claude/eval/metrics/layer1 .claude/eval/metrics/layer2 .claude/eval/sessions
   ```

## Verification

After setup, verify hooks work:

```bash
# Test hook manually
echo '{"tool_input":{"subagent_type":"test-agent","description":"TEST-001"},"tool_output":"Status: DONE"}' | \
  bash .claude/hooks/capture-agent-metrics.sh

# Check metric was created
ls -lh .claude/eval/metrics/layer1/
```

## Usage

Once set up:

1. **Start Claude Code in your project**
2. **Dispatch any agent via Task tool**
3. **Metrics automatically captured** to `.claude/eval/metrics/layer1/`
4. **View metrics:**
   ```bash
   cat $(ls -t .claude/eval/metrics/layer1/*.json | head -1) | jq .
   ```

## Project Structure

```
your-project/
├── .claude/
│   ├── settings.json          ← Hook configuration
│   └── hooks/                 ← Hook scripts
│       ├── capture-agent-metrics.sh
│       ├── capture-quality-signals.sh
│       ├── capture-session-digest.sh
│       └── README.md
│   ├── eval/
│   │   ├── metrics/
│   │   │   ├── layer1/        ← Agent metrics (JSON)
│   │   │   └── layer2/        ← Quality signals (JSON)
│   │   └── sessions/          ← Session summaries (MD)
├── MANIFEST.md                ← project config at root (Add from templates/docs/)
└── .claude/
    └── state/
        ├── STATUS.md          ← pipeline state (Add from templates/docs/)
        └── TASKS.md           ← task queue (Add from templates/docs/)
```

## Next Steps

1. **Add MANIFEST.md at root:** `cp .claude/templates/docs/MANIFEST.md ./`
2. **Add STATUS.md to state:** `mkdir -p .claude/state && cp .claude/templates/docs/STATUS.md .claude/state/`
3. **Add TASKS.md to state:** `cp .claude/templates/docs/TASKS.md .claude/state/`
4. **Configure agents:** Set up `agents/` directory if needed
5. **Start building:** Use Claude Code with automatic metrics!

## Customization

### Change Metrics Location

Edit `.claude/hooks/capture-agent-metrics.sh`:

```bash
# Default
METRICS_DIR="${PROJECT_ROOT}/.claude/eval/metrics/layer1"

# Custom
METRICS_DIR="${PROJECT_ROOT}/reports/metrics"
```

### Add Custom Metrics

Edit hook scripts to extract additional fields from agent output.

### Disable Hooks

Comment out or remove sections from `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      // {
      //   "matcher": "Task",
      //   ...disabled
      // }
    ]
  }
}
```

## Troubleshooting

### Hooks not firing?

1. Check `.claude/settings.json` exists in project root
2. Check hook scripts are executable: `chmod +x .claude/hooks/*.sh`
3. Restart Claude Code session

### No metrics directory?

```bash
mkdir -p .claude/eval/metrics/layer1 .claude/eval/metrics/layer2 .claude/eval/sessions
```

## Git Integration

### Recommended: Commit Metrics

Metrics provide valuable project history. Add to version control:

```bash
git add .claude/eval/
git commit -m "Add agent metrics"
```

### Optional: Ignore Metrics

If you prefer not to commit metrics:

```gitignore
# .gitignore
.claude/eval/metrics/
.claude/eval/sessions/
```

## See Also

- `.claude/hooks/README.md` — Hooks documentation
- `../../docs/HOOK-FIX-SUMMARY.md` — Hook implementation details
- `.claude/settings.json` — Hook configuration reference
