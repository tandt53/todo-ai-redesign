# Self-Improvement Protocol (shared by all agents)
<!-- Defines how metrics are captured, aggregated, and how they feed back into agent improvement. -->
<!-- Read by: orchestrator (to act on patterns), all agents (to know what's measured). -->

---

## Two-layer metrics architecture

Metrics are captured at two layers. **Neither relies on agent self-assessment** — that's the anti-poison property.

### Layer 1 — Agent self-report (objective observation)
**Captured by:** `SubagentStop` hook (fires when a sub-agent completes)
**Contains:** agent name, duration, files changed (from `git status`), exit status
**Written to:** `.claude/eval/metrics/layer1/{date}-{agent}-{timestamp}.json`
**What it proves:** the agent ran, it touched N files, it completed or blocked. These are observable facts from outside the agent — the agent can't fake them.

### Layer 2 — External quality signals (downstream judgment)
**Captured by:** `PostToolUse` hook on `Write|Edit` for `reports/` and `qa/_shared/bugs/` files
**Contains:**
- **Reviewer writes `reports/review-F-*.md`** → extract PASS/FAIL, C1-C16 results, failure details
- **Product-agent writes `reports/product-review-F-*.md`** → extract APPROVED/CHANGES REQUESTED, issue counts
- **QA agent writes `qa/_shared/bugs/BUG-*.md`** → extract severity, root cause layer, feature
- **QA agent writes `qa/*/runs/*.md`** → extract test pass/fail/skip counts
**Written to:** `.claude/eval/metrics/layer2/{date}-{signal-type}-{feature}.json`
**What it proves:** an independent agent assessed the upstream agent's output quality. A reviewer finding 3 C4 violations is a quality signal about web-agent — it's not web-agent grading itself.

### Why this replaces agent self-reported metrics

The old design asked agents to include a `metrics:` YAML block in their return summaries — confidence, AC coverage, quality levels. This was unreliable because:
1. Agents can't accurately self-assess (they always say HIGH confidence)
2. The metrics were never actually collected (no code parsed the return summaries)
3. Self-reported quality is circular — the agent that wrote weak ACs rates them as "behavior verification"

The two-layer approach solves all three:
1. Layer 1 observes from outside — facts, not opinions
2. Both layers are captured by hooks — automatic, no agent cooperation needed
3. Layer 2 quality signals come from independent downstream agents — uncorrelated with the upstream agent

## The feedback loop

```
Agent dispatch → Agent produces output
    ↓
Layer 1 hook fires → captures: agent, duration, files changed, status
    ↓
Downstream agent runs → produces quality assessment (review report, bugs, test runs)
    ↓
Layer 2 hook fires → captures: PASS/FAIL, severity, coverage, failures
    ↓
Dashboard generator reads both layers → correlates (which agents cause most reviewer failures?)
    ↓
Orchestrator reads patterns at startup → writes corrective memory entries
    ↓
Next dispatch → Agent reads the memory entry via Layer 3 → Adjusts behavior
```

This is NOT an automated rewriting loop. The loop works through **memory** — patterns detected in metrics become memory entries that future dispatches read. If a pattern persists across 10+ dispatches, the orchestrator flags it for a **human** to decide whether to update the agent file permanently.

---

## Metrics every agent must report

Add this block to your return summary (see `_completion-protocol.md`). Every field is required. Use `null` if not applicable.

```yaml
metrics:
  # Identity
  agent: "{agent-name}"
  task: "T-{id}"
  feature: "F-{id}"
  module: "{module}"
  phase: "{phase}"                     # e.g. "author", "execute", "implement", "review-spec"
  timestamp: "{ISO-8601}"
  
  # Output quality (self-assessed — honest, not optimistic)
  files_created: {count}
  files_modified: {count}
  lines_written: {count}               # approximate — for tracking agent verbosity
  confidence: "HIGH|MEDIUM|LOW"
  
  # Spec alignment
  acs_in_scope: {count}                # how many ACs from the feature spec were in scope for this dispatch
  acs_addressed: {count}               # how many ACs you actually addressed (code, test case, design, etc.)
  acs_skipped: [{list of AC-ids}]      # which ACs you didn't address and why
  
  # Time and cost
  files_read: {count}                  # how many files you read (input token proxy)
  briefing_sufficient: true|false      # did BRIEFING.md give you everything, or did you need MANIFEST?
  memory_entries_read: {count}         # how many memory entries you loaded (Layer 2-5)
  memory_entries_useful: {count}       # how many of those actually influenced your work
  
  # Errors and drift
  blockers_hit: {count}                # times you had to stop and return BLOCKED
  drift_noted: {count}                 # spec-vs-code discrepancies observed
  assumptions_made: {count}            # times you had to guess because info was missing
  
  # Agent-specific (add your own — see per-agent sections below)
  custom: {}
```

### Per-agent custom metrics

**spec-agent:**
```yaml
custom:
  ac_count: {n}                        # how many ACs written
  ac_quality_levels:                   # self-assessed per the AC quality spectrum
    code_existence: {n}
    feature_presence: {n}
    behavior_verification: {n}
    user_outcome: {n}
  open_questions_left: {n}
  discovery_layers_completed: {n}      # of the 7 discovery layers, how many had user input
```

**architect-agent:**
```yaml
custom:
  endpoints_defined: {n}
  entities_defined: {n}
  migrations_created: {n}
  adrs_created: {n}
  platform_docs_updated: {n}
```

**design-agent:**
```yaml
custom:
  screens_created: {n}
  testids_defined: {n}
  tokens_added: {n}
  components_added: {n}
  states_per_screen: {avg}             # average number of states (default, loading, empty, error, success)
```

**web-agent / mobile-agent / backend-agent (implementers):**
```yaml
custom:
  components_created: {n}
  unit_tests_written: {n}
  unit_tests_passing: {n}
  lint_clean: true|false
  typecheck_clean: true|false
  endpoints_implemented: {n}           # backend only
  design_tokens_used: true|false       # web/mobile only — did you use tokens, not hardcoded values?
```

**qa-api-agent / qa-web-agent / qa-mobile-agent:**
```yaml
custom:
  tc_count: {n}                        # test cases written
  tc_p1_count: {n}                     # P1 test cases
  ac_coverage:                         # which ACs are covered at this platform
    total_tagged: {n}                  # ACs tagged for this platform in the spec
    covered_p1: {n}                    # ACs with at least one P1 TC
    uncovered: [{list of AC-ids}]
  automation_files: {n}                # automation scripts written
  # Phase execute only:
  tests_run: {n}
  tests_passed: {n}
  tests_failed: {n}
  tests_flaky: {n}                     # passed on retry (flake detected + fixed)
  bugs_filed: {n}
  bugs_by_layer: { api: {n}, web: {n}, mobile: {n} }
  triage_accuracy:                     # self-assessed: of the bugs you filed, how confident are you?
    high_confidence: {n}
    uncertain: {n}
```

**reviewer-agent:**
```yaml
custom:
  checks_run: {n}                      # should be 16 (C1-C16)
  checks_passed: {n}
  checks_failed: {n}
  failures_by_check: { C1: {n}, C2: {n}, ... C9: {n} }
  false_positives_suspected: {n}       # times you think a check flagged something that's actually OK
```

**product-agent:**
```yaml
custom:
  acs_evaluated: {n}
  acs_at_code_existence: {n}
  acs_at_feature_presence: {n}
  acs_at_behavior_verification: {n}
  acs_at_user_outcome: {n}
  high_issues: {n}
  medium_issues: {n}
  low_issues: {n}
  missing_requirements: {n}
  web_searches_run: {n}
  market_findings_relevant: {n}
```

---

## Where metrics are stored

The orchestrator writes metrics to `.claude/eval/metrics/` as JSON files:

```
.claude/eval/metrics/
├── 2026-04-10-spec-agent-F-001.json
├── 2026-04-10-architect-agent-F-001.json
├── 2026-04-10-design-agent-F-001.json
├── 2026-04-10-web-agent-F-001.json
├── 2026-04-10-qa-web-agent-F-001-author.json
├── 2026-04-10-qa-web-agent-F-001-execute.json
├── 2026-04-10-reviewer-agent-F-001.json
└── summary.json                       ← aggregated cross-agent stats
```

Each file is a single JSON object (the `metrics:` block from the return summary). The orchestrator appends; nothing deletes. Files are named `{date}-{agent}-{feature}-{phase?}.json`.

`summary.json` is regenerated by the orchestrator periodically (every 5 dispatches or at startup) by reading all metric files and computing:
- Per-agent averages (confidence, AC coverage, file counts)
- Trend lines (is confidence going up or down over the last 10 dispatches?)
- Cross-agent correlation (do features with high spec-agent AC quality have fewer reviewer failures?)
- Anomalies (is one agent consistently producing LOW confidence? Is one platform always uncovered?)

---

## Pattern detection (orchestrator's job)

After every 5 dispatches (or at startup if metrics exist), the orchestrator runs a lightweight pattern check:

### Check 1: AC quality drift
```
Read all spec-agent metrics.
If the average ac_quality_levels.code_existence > 30% of total ACs across last 10 features:
  → Write memory entry: "spec-agent is writing too many code-existence-level ACs.
     Push for behavior-verification or user-outcome level.
     See _qa-foundations.md section 5 for the quality spectrum."
  → Tag: spec, ac-quality, drift
```

### Check 2: QA coverage gaps
```
Read all qa-*-agent metrics.
If any platform consistently has uncovered ACs (same AC-id uncovered in 3+ features):
  → Write memory entry: "qa-{platform}-agent is consistently missing AC-{id} type requirements.
     Check if the AC is ambiguous or if the agent needs a test design technique hint."
  → Tag: qa, coverage, gap
```

### Check 3: Reviewer false positive rate
```
Read all reviewer-agent metrics.
If false_positives_suspected > 20% of checks_failed across last 10 features:
  → Write memory entry: "reviewer-agent C{n} is generating false positives.
     Consider tightening the check's heuristic or adding exceptions."
  → Tag: reviewer, false-positive, C{n}
```

### Check 4: Briefing insufficiency
```
Read all agent metrics.
If briefing_sufficient == false in > 30% of dispatches:
  → Write memory entry: "Orchestrator briefings are insufficient — agents are falling back to MANIFEST.
     The orchestrator should include more files in the 'Read these files first' list."
  → Tag: orchestrator, briefing, insufficient
```

### Check 5: Memory utility
```
Read all agent metrics.
If memory_entries_useful / memory_entries_read < 0.2 across 20+ dispatches:
  → Write memory entry: "Memory retrieval is returning mostly irrelevant entries.
     Consider improving tag quality or archiving old entries."
  → Tag: memory, relevance, low
```

### Check 6: Implementation agent test quality
```
Read all implementer metrics.
If unit_tests_passing / unit_tests_written < 0.9:
  → Write memory entry: "{agent} is writing tests that fail on first run.
     Tests should be written to pass — failing tests indicate the implementation is incomplete."
  → Tag: implementation, test-quality, {agent}
```

---

## Context sharing safeguards (anti-poison)

Metrics and memory entries are the two context-sharing mechanisms. Both are vulnerable to pollution if an agent writes misleading information (either through error or through cascading bad context). Safeguards:

### 1. Metrics are verifiable
Every metric has a verifiable backing fact:
- `files_created: 3` → the orchestrator can `ls` the output paths and confirm 3 new files
- `ac_coverage.covered_p1: 5` → the orchestrator can grep the TC files for AC-ids
- `tests_passed: 12` → the orchestrator can re-run the test command and check

The orchestrator **spot-checks** metrics against the filesystem after every 10th dispatch. If a metric doesn't match reality (e.g., agent claims 5 files created but only 3 exist), the orchestrator:
1. Writes a WARNING to the metric file: `"verified": false, "verification_note": "claimed 5 files, found 3"`
2. Does NOT use unverified metrics in pattern detection
3. Writes a memory entry: "{agent} reported inaccurate metrics on T-{id}. Cross-check future reports."

### 2. Memory entries are attributed and timestamped
Every memory entry has `agent`, `date`, `feature`, and `type` fields. If two entries contradict each other, the newer one is presumed correct (unless it's from a less-trusted source — see hierarchy below).

**Trust hierarchy for contradictions:**
1. Filesystem facts (highest trust — files exist or they don't)
2. Test runner output (second — tests pass or they don't)
3. Reviewer-agent observations (third — structural checks are deterministic)
4. Orchestrator metrics verification (fourth — spot-checked against filesystem)
5. Agent self-reports (lowest — self-assessment can be wrong)

When the orchestrator detects a contradiction:
1. Check the filesystem / test runner for ground truth
2. Mark the wrong entry `~~SUPERSEDED~~` with the correction
3. Trust the higher-ranked source

### 3. Cascading context has a decay factor
A memory entry that influenced 3+ subsequent dispatches without being verified against the filesystem gets flagged:
- `"influence_count": 5, "last_verified": null` → orchestrator triggers a verification
- If the entry is verified: reset the counter, mark `"last_verified": "{date}"`
- If the entry is wrong: supersede it, write a corrective entry

### 4. No agent writes metrics for another agent
Each agent reports its own metrics only. If qa-web-agent discovers a bug in backend-agent's output, it files a bug report — it does NOT write a metric entry for backend-agent. The orchestrator correlates the bug with backend-agent's metrics after the fact.

---

## Human escalation

The self-improvement loop through memory is bounded. If a pattern persists for **10+ dispatches** after a corrective memory entry was written:

1. The orchestrator stops the pipeline
2. Reports to the human: "Pattern {X} has persisted across 10 dispatches despite memory correction. The agent file itself may need updating. Review: {details}"
3. The human decides whether to edit the agent file, change the evaluation criteria, or dismiss the pattern

This prevents the system from endlessly writing memory entries for a problem that requires a structural fix. The human is the final arbiter — always.

---

## Evaluation mode (for sample projects)

When running against a sample project in `.claude/eval/sample-projects/`, agents operate normally but with one addition: the orchestrator compares agent outputs against **expected outputs** defined in the sample project's `.claude/eval/expected/` directory.

```
.claude/eval/sample-projects/taskflow/
├── src/                                ← pre-populated code stubs
├── package.json                        ← stack definition
├── README.md                           ← project description
├── .claude/eval/
│   ├── expected/                       ← what correct agent output looks like
│   │   ├── specs/auth/F-001-login.md   ← expected spec (for diffing)
│   │   ├── qa/auth/F-001/api/          ← expected TC structure
│   │   └── checks.json                 ← expected reviewer C1-C16 results
│   └── rubric.md                       ← scoring criteria for human evaluation
```

The orchestrator runs agents normally, then scores output against expected:
- **Structural match:** do the expected files exist with the expected sections? (not character-for-character — section headings, AC-id presence, file count)
- **Coverage match:** do TCs cover the same ACs the expected TCs cover?
- **Quality match:** is the AC quality level at least as high as expected?

Scores are written to `.claude/eval/metrics/evaluation-{project}-{date}.json`.

---

## What this protocol does NOT do

- Does not rewrite agent files automatically — memory is the feedback mechanism, humans decide structural changes
- Does not compare agents to each other for ranking — each agent is measured against its own role's criteria
- Does not require external services — everything is local filesystem + grep
- Does not add runtime cost to production dispatches — metrics are part of the return summary, not a separate call
- Does not second-guess the human — if the human approves output that metrics flag as low-quality, the metrics are recorded but no action is taken
