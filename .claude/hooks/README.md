# Project-Local Hooks

This directory contains Claude Code hooks that are **project-specific** (not global).

## Hook Scripts

### capture-agent-metrics.sh
**Trigger:** PostToolUse:Task (fires after every Task tool dispatch)

**Captures:**
- Agent type (spec-agent, qa-api-agent, etc.)
- Task ID (T-015, T-016, etc.)
- Feature ID (F-001, F-002, etc.)
- Status (DONE, APPROVE, REJECT, BLOCKED)
- Files created/modified during dispatch
- Timestamp

**Output:** `.claude/eval/metrics/layer1/{date}-{agent}-{timestamp}.json`

### capture-quality-signals.sh
**Trigger:** PostToolUse:Write|Edit (fires after every file write/edit)

**Captures:**
- Code quality signals
- File complexity changes
- Pattern violations

**Output:** `.claude/eval/metrics/layer2/` (quality signals)

### capture-session-digest.sh
**Trigger:** Stop (fires at end of Claude Code session)

**Captures:**
- Session summary
- Total tasks completed
- Agent dispatch count
- Overall metrics

**Output:** `.claude/eval/sessions/{date}-{timestamp}.md`

### capture-events.sh
**Trigger:** PostToolUse:Task|Agent and Stop

**Captures:** one JSON line per observed transition — task ID, agent, `status:`
from the `---METRICS---` block, the artifact paths claimed, and an
`evidence_conflict` marker when an agent reports `DONE` having created no files.

**Output:** `.claude/eval/events.jsonl` (append-only)

**Why it exists alongside STATUS.md / TASKS.md:** the state files record what the
agent *claimed*; this log records what the harness *observed*. Different writers
with different trust levels means the log can audit the state files. It also
survives a corrupted state file, and gives dashboards a data source that costs no
agent prompt budget. An agent can neither forge nor forget an entry here, because
it never writes one.

### validate-state.sh
**Trigger:** Stop — also safe to run by hand: `bash .claude/hooks/validate-state.sh`

**Checks** (exits non-zero on violation):

| Check | Rule |
|---|---|
| C1 | Every `DONE`/`PARTIAL` task names ≥1 artifact, and each artifact exists on disk |
| C2 | Every artifact path sits under a root declared in `MANIFEST ## Paths` |
| C3 | Every `Depends` entry references a task ID that exists |
| C4 | No duplicate task IDs |
| C5 | MANIFEST/STATUS/TASKS are within the caps in `MANIFEST ## Limits` |
| C6 | Every artifact lands inside its agent's subtree, per `MANIFEST writers:` |
| C7 | `events.jsonl` does not contradict `TASKS.md` |

C1 and C2 together are the core invariant: a completed task must have produced
something, in a place the project declared. C5 is what keeps session-start reads
from silently degrading into skimming. C6 is what makes the lock-free design
safe — agents stay in their own subtrees only if something checks after the
fact. C7 compares the two writers: if the harness saw an agent return `DONE`
having created nothing, that task must not be sitting at `DONE`.

A rule with no check here is a rule that will drift — if you add a convention,
add its check.

## Configuration

Hooks are configured in `.claude/settings.json` at the project root:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/capture-agent-metrics.sh",
            "timeout": 10,
            "statusMessage": "Capturing agent metrics..."
          }
        ]
      }
    ]
  }
}
```

## Metrics Storage

All metrics are stored **locally in the project**:

- **Layer 1 (Objective):** `.claude/eval/metrics/layer1/` — Factual agent performance data
- **Layer 2 (Quality):** `.claude/eval/metrics/layer2/` — Code quality signals
- **Sessions:** `.claude/eval/sessions/` — Per-session summaries

### Why Local?

1. **Version controlled** — Metrics tracked with code
2. **Project-specific** — Each project has its own standards
3. **Shareable** — Team can analyze metrics together
4. **Portable** — No global state dependencies

## Usage

Hooks fire automatically. No manual action required.

### View Metrics

```bash
# List all captured metrics
ls -lht .claude/eval/metrics/layer1/

# View latest metric
cat $(ls -t .claude/eval/metrics/layer1/*.json | head -1) | jq .

# Count agents by type
jq -r '.agent' .claude/eval/metrics/layer1/*.json | sort | uniq -c

# Average files changed per agent
jq '.files_changed' .claude/eval/metrics/layer1/*.json | awk '{sum+=$1; count++} END {print sum/count}'
```

### Aggregate Metrics

```bash
# Generate summary report
bash .claude/eval/scripts/aggregate-metrics.sh

# Compare agent efficiency
bash .claude/eval/scripts/compare-agents.sh
```

## Troubleshooting

### Hooks not firing?

1. **Check settings.json exists:**
   ```bash
   cat .claude/settings.json | jq .
   ```

2. **Check hooks are executable:**
   ```bash
   ls -l .claude/hooks/*.sh
   chmod +x .claude/hooks/*.sh
   ```

3. **Test hook manually:**
   ```bash
   echo '{"tool_input":{"subagent_type":"test-agent","description":"TEST-001"},"tool_output":"Status: DONE"}' | \
     bash .claude/hooks/capture-agent-metrics.sh

   # Check output
   ls -lh .claude/eval/metrics/layer1/
   ```

4. **Restart Claude Code session** (hooks load at session start)

### No metrics directory?

```bash
mkdir -p .claude/eval/metrics/layer1
mkdir -p .claude/eval/metrics/layer2
mkdir -p .claude/eval/sessions
```

## Customization

### Add Custom Metrics

Edit `capture-agent-metrics.sh` to extract additional fields:

```bash
# Example: Extract LOC from output
LOC=$(echo "$TOOL_OUTPUT" | grep -oE '[0-9]+ lines' | grep -oE '[0-9]+' || echo "0")

# Add to JSON output
cat > "$OUTFILE" << METRIC_EOF
{
  ...
  "lines_of_code": $LOC,
  ...
}
METRIC_EOF
```

### Change Metrics Directory

Edit hook scripts and change `METRICS_DIR`:

```bash
# Default: .claude/eval/metrics/layer1
METRICS_DIR="${PROJECT_ROOT}/.claude/eval/metrics/layer1"

# Custom: docs/reports/agent-metrics
METRICS_DIR="${PROJECT_ROOT}/reports/agent-metrics"
```

## Git Integration

### Track Metrics (Recommended)

```bash
# .gitignore — do NOT ignore metrics
# Metrics are valuable project history
```

### Ignore Metrics (Optional)

If you prefer not to commit metrics:

```bash
# .gitignore
.claude/eval/metrics/
.claude/eval/sessions/
```

## See Also

- `../../docs/HOOK-FIX-SUMMARY.md` — Hook configuration details
- `../eval/scripts/aggregate-metrics.sh` — Metric aggregation script
- `.claude/settings.json` — Hook configuration
