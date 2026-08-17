# eval/ Directory

This directory contains **single-project evaluation tools** for the multi-agent system.

## Active Tools (Keep)

### Metrics & Validation
- **`validate-metrics.py`** - Validates metrics JSON consistency (numbers add up, files exist)
- **`metrics-collector.py`** - Stores, verifies, and reports on agent metrics

### Usage

**Validate metrics:**
```bash
python3 .claude/eval/validate-metrics.py scan .claude/eval/metrics/
```

**Collect and report metrics:**
```bash
python3 .claude/eval/metrics-collector.py summary --dir=.claude/eval/metrics
python3 .claude/eval/metrics-collector.py report --dir=.claude/eval/metrics
```

## Metrics Storage

Each project stores its own metrics locally:
- `.claude/eval/metrics/layer1/` - Objective agent performance data (JSON)
- `.claude/eval/metrics/layer2/` - Code quality signals (JSON)
- `.claude/eval/sessions/` - Session summaries (Markdown)

Metrics are captured automatically by hooks in `.claude/hooks/` when agents are dispatched.

## Deprecated Files (Removed)

The following files were removed as part of cleanup:
- `generate-dashboard.py` - Dashboard generation (needs consolidation)
- `generate-history-dashboard.py` - Historical dashboard (needs consolidation)
- `dashboard.html` - Old template
- `dashboard-report.html` - Generated output
- `aggregate-projects.sh` - Cross-project aggregation (metrics are now single-project only)
- `run-eval.sh` - Outdated workflow (referenced removed orchestrator/CTO agent)
- `AGENT-TEST-DESIGN.md` - Historical design doc
- `AGENT-TESTING-SUMMARY.md` - Duplicate summary
- `COMPLETION-REPORT.md` - One-time completion report
- `TEST-RESULTS-FINAL.md` - Historical snapshot
- `QUICK-START.md` - Duplicate getting started guide

## What's Left to Build

**Unified Dashboard Generator:**
Currently missing a single dashboard that:
- Reads from `.claude/eval/metrics/layer1/` and `layer2/`
- Reads from `.claude/eval/sessions/`
- Shows historical trends across sessions
- Can aggregate multiple projects
- Outputs single self-contained HTML file

This should replace the two removed dashboard generators.

## Notes

- Metrics are stored in project-local `.claude/eval/metrics/layer1/` and `layer2/`
- Session summaries in project-local `.claude/eval/sessions/`
- Hooks that capture metrics are in `.claude/hooks/` (standard location)
