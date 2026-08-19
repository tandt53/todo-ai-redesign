# Project Manifest
<!-- Master index. Never put content here — only links. -->
<!-- Size limits are declared in ## Limits below and enforced by
     .claude/hooks/validate-state.sh — not by this comment. -->

## Project
- **Name**: todo-ai redesign — voice-first
- **Purpose**: Redesign todo-ai as a voice-first todo app: the user talks to an AI assistant to create, edit, and delete todos.
- **Stack**: TypeScript · React (web) · React Native (mobile) · vitest · prototype-grade, no real backend this phase
- **Repo**: [url]

---

## Paths
<!-- Single source of truth for where artifacts live in THIS project. -->
<!-- Agents read this section to discover file locations — never hardcode paths. -->
<!-- Substitute {module} with the agent's assigned module at read time. -->

```yaml
layout: domain-modular    # values: domain-modular | flat | custom
roots:
  specs: specs/
  design: design/
  src: src/
  qa: qa/
  # Inherited requirements from `todo-ai`, the app this project redesigns. Copied
  # verbatim 2026-08-17 and READ-ONLY — see specs/_source/README.md for why editing
  # them here is L-004's shape, and for the ADR-7 vs ADR-007 namespace rule.
  # This repo has cited UC-20 / UC-52 / ADR-7 / ADR-11 since F-001 while the
  # documents lived only in the other repository; this root makes those resolve.
  source_requirements: specs/_source/
  # Tooling root, not a product artifact root: the Expo shell that builds and
  # installs the mobile client onto a simulator/emulator so its screens can be
  # exercised on a real runtime. Added 2026-08-17 (T-057) — the first device run
  # found two defects (BUG-003, BUG-004) that no other tier could reach.
  # It imports src/ and design/ and is never imported BY them.
  sim_harness: .mobile-app/

shared_dir: _shared       # folder name for cross-cutting artifacts inside each root
modules: [assistant]               # business domains in this project (e.g. auth, payments). Grows as features are specced.

patterns:
  # Per-module artifact locations. {module} is substituted at read time.
  # For feature_spec, {feature_id} and {feature_slug} are also substituted
  # (e.g. module=auth, feature_id=003, feature_slug=password-reset → specs/auth/F-003-password-reset.md).
  feature_index:        "{specs}/{module}/index.md"                        # table of features in this module
  feature_spec:         "{specs}/{module}/F-{feature_id}-{feature_slug}.md"  # one file per feature
  api_contracts:        "{specs}/{module}/api-contracts.md"
  data_model:           "{specs}/{module}/data-model.md"
  design_notes:         "{specs}/{module}/design-notes.md"
  design_screens:       "{design}/{module}/screens/"
  module_src:           "{src}/{module}/"
  unit_tests:           "{src}/{module}/__tests__/"

  # QA paths — per platform. Each platform QA agent owns its own subtree.
  # Test cases are sharded per platform because one AC often needs multiple TCs across layers.
  test_cases_api:       "{qa}/{module}/F-{feature_id}/api/"      # owned by qa-api-agent
  test_cases_web:       "{qa}/{module}/F-{feature_id}/web/"      # owned by qa-web-agent
  test_cases_mobile:    "{qa}/{module}/F-{feature_id}/mobile/"   # owned by qa-mobile-agent
  test_automation_api:    "{qa}/{module}/automation/api/"        # API integration tests (supertest/httpx)
  test_automation_web:    "{qa}/{module}/automation/e2e/"        # Playwright e2e
  test_automation_mobile: "{qa}/{module}/automation/mobile/"     # Appium/WDIO
  test_runs:            "{qa}/{module}/runs/"                    # execution records, shared across platforms
  test_cases:           "{qa}/{module}/"                         # legacy generic pointer; prefer the per-platform keys above
  bugs:                 "{qa}/{shared_dir}/bugs/"                # BUG-{nnn}-{slug}.md, filed by any QA agent, tagged with layer:
  reports:              "reports/"                               # reviewer + product-agent output; the Layer-2 metrics hook watches this prefix

  # Cross-cutting (use {shared_dir}, not {module})
  architecture:       "{specs}/{shared_dir}/ARCHITECTURE.md"
  platform_docs:      "{specs}/{shared_dir}/platform/"
  coding_standards:   "{specs}/{shared_dir}/standards/coding-standards.md"
  security_policy:    "{specs}/{shared_dir}/standards/security-policy.md"
  adrs:               "{specs}/{shared_dir}/adr/"
  non_functional:     "{specs}/{shared_dir}/non-functional-req.md"
  user_stories:       "{specs}/{shared_dir}/user-stories.md"
  glossary:           "{specs}/{shared_dir}/glossary.md"
  design_system:      "{design}/{shared_dir}/DESIGN.md"
  design_tokens:      "{design}/{shared_dir}/tokens.json"
  design_components:  "{design}/{shared_dir}/components.md"
  shared_src:         "{src}/{shared_dir}/"
  qa_knowledge:       "{qa}/{shared_dir}/KNOWLEDGE.md"
  traceability:       "{qa}/{shared_dir}/TRACEABILITY.md"
  learnings:          "{specs}/{shared_dir}/LEARNINGS.md"   # durable cross-cutting lessons; reviewer appends, humans curate
  memory:             "memory/"                             # _memory-protocol.md read layers 2-5; ORCHESTRATOR is the sole writer
  memory_log:         "memory/MEMORY.md"                    # project-wide append-only log (layers 2-4)
  memory_agent:       "memory/{agent}.md"                   # one file per agent — layer 5, procedural knowledge for that role
```

<!-- Alternate layouts (not active — switch by changing `layout:` above):
     - layout: flat       → no modules; everything at the root of each (e.g. specs/features/, qa/features/). For tiny projects.
     - layout: custom     → orchestrator detected an existing non-standard structure (e.g. monorepo apps/auth/).
                            Patterns override the defaults; the modules list is filled in from detection. -->

---

## Ownership
<!-- Which file is authoritative for which fact. Cross-reference by identifier; -->
<!-- never copy content between files. When two files state the same fact they -->
<!-- drift, and the drift surfaces late — usually as a check that passes against -->
<!-- one copy and fails against the other. -->

```yaml
ownership:
  # Requirements
  acceptance_criteria: "{specs}/{module}/F-{feature_id}-{feature_slug}.md"  # TCs cite AC-IDs, never restate AC text
  ac_platform_tags:    "{specs}/{module}/F-{feature_id}-{feature_slug}.md"  # decides which QA agents cover the AC
  api_contract_shapes: "{specs}/{module}/api-contracts.md"

  # QA
  test_case_definitions: "{qa}/{module}/F-{feature_id}/{platform}/"   # per-platform; not mirrored into STATUS.md
  test_case_status:      "{qa}/{module}/F-{feature_id}/{platform}/"   # lives with the test case it describes
  test_run_records:      "{qa}/{module}/runs/"
  bug_records:           "{qa}/{shared_dir}/bugs/"
  traceability_matrix:   "{qa}/{shared_dir}/TRACEABILITY.md"

  # Pipeline state
  task_queue:      ".claude/state/TASKS.md"
  pipeline_state:  ".claude/state/STATUS.md"
  gate_verdicts:   "{reports}/"

  # Cross-cutting
  architecture_decisions: "{specs}/{shared_dir}/adr/"
  durable_lessons:        "{specs}/{shared_dir}/LEARNINGS.md"
```

<!-- The map above answers "which file is authoritative for this fact" — it is -->
<!-- read by humans and agents, and it is not mechanically checkable: no script -->
<!-- can tell that a TC restated an AC instead of citing it. -->
<!-- The map below answers "which agent may write here", which IS checkable. -->
<!-- validate-state.sh C6 fails a task whose artifacts land outside its agent's -->
<!-- subtree. This is the durable half of the per-dispatch write scope that -->
<!-- BRIEFING.md states and then throws away. -->

```yaml
writers:
  # The orchestrator also owns the simulator harness (it is orchestration
  # tooling, owned by no agent) and may file a bug report for a defect it found
  # itself — T-057 ran the app on a device and hit two. Filing is not the same
  # as authoring test cases, which stays with the qa-* agents.
  # Two additions on 2026-08-17, both with reasons that outlive the incident:
  #
  # {specs}/{shared_dir}/LEARNINGS.md — the convention says reviewer-agent appends
  #   durable failure patterns. But L-009 (Gate 1 consolidation silently drops
  #   single-lens findings) and L-010 (git checkout on a tracked file with
  #   uncommitted changes) are ORCHESTRATION failures: they happen between
  #   dispatches, where no reviewer is looking. If only reviewer-agent may write
  #   here, that whole class of lesson has nowhere to go. This is a gap in the
  #   ownership model, not an exception to it.
  #
  # RESTORE rights on any artifact — the orchestrator is the only party that can
  #   see one agent destroy another's uncommitted work (T-076: a mutation-check
  #   restore reverted the copy catalogue by 57 lines and 19 tests failed pointing
  #   at the parser instead of the cause). This grant is for RESTORATION, never
  #   authorship; C6 cannot express that distinction, so it is stated here for a
  #   human to hold the orchestrator to.
  # Cross-cutting records the orchestrator maintains, plus the landing place for a
  # ONE-OFF cross-subtree grant it issued: when a change must land as a single unit
  # (T-121 — splitting it would have left Today defined twice) the acting agent
  # crosses lines under an explicit grant and the files are recorded on the
  # orchestrator row rather than widening that agent permanently. The map cannot
  # express "sanctioned once"; that is the gap, not the crossing.
  # `.claude/` added 2026-08-18. The pipeline's own tooling is owned by no agent,
  # and the orchestrator is the party that runs `upgrade-project.sh` — so
  # template-synced files land here under its name. This is not authorship: the
  # source of truth for everything under `.claude/` is
  # `claude-agents-final/templates/project-starter/`, and a fix made HERE is
  # erased by the next upgrade. Fix upstream, then sync. The grant exists because
  # C6 cannot express "synced, not written", and because the alternative was
  # recording the sync against an agent that did not do it. The Drift Log already
  # carried two such edits with nowhere to attribute them.
  orchestrator:      ["reports/", ".claude/", ".mobile-app/", "MANIFEST.md", "{specs}/_source/", "{specs}/{shared_dir}/LEARNINGS.md", "{specs}/{shared_dir}/uc-coverage-map.md", "{design}/", "{qa}/"]
  # `reports/gate1-lenses/` added 2026-08-18, and it is a map change rather than a
  # third one-off grant. Every Gate 1 revision owes a per-finding log, that log
  # belongs beside the lens returns it answers (which is where the next round's
  # lenses look for it), and `reports/` is otherwise the orchestrator's. Three
  # consecutive dispatches — T-143, T-153, T-154 — put the path in the briefing and
  # tripped C6 each time, attributing to the agent a crossing the ORCHESTRATOR
  # caused. The map could not express a standing pattern, so it was expressed as a
  # repeated mistake instead. Scope is the directory, not `reports/`: the lens
  # returns and consolidations in it stay the orchestrator's to write.
  spec-agent:        ["{specs}/", "{design}/{shared_dir}/components.md", "reports/gate1-lenses/"]
  architect-agent:   ["{specs}/"]
  design-agent:      ["{design}/"]
  # implementers also own the root build manifests (platform docs make the
  # first implementer create them; they are shared config, not source)
  backend-agent:     ["{src}/", "package.json", "tsconfig.json", ".gitignore"]
  web-agent:         ["{src}/", "package.json", "tsconfig.json", ".gitignore"]
  mobile-agent:      ["{src}/", "package.json", "tsconfig.json", ".gitignore"]
  qa-api-agent:      ["{qa}/"]
  qa-web-agent:      ["{qa}/", "playwright.config.ts", "vitest.config.ts", "package.json", "tsconfig.json"]
  qa-mobile-agent:   ["{qa}/"]
  qa-explorer-agent: ["{qa}/"]
  reviewer-agent:    ["reports/", "{specs}/{shared_dir}/LEARNINGS.md"]
  product-agent:     ["reports/"]
```

---

## Limits
<!-- Read at session start by the orchestrator and enforced by -->
<!-- .claude/hooks/validate-state.sh (check C5). A file that must be read every -->
<!-- session has a size beyond which it stops being read carefully: it gets -->
<!-- skimmed, then misread, and a misread contract produces confidently wrong -->
<!-- work. These numbers exist to force archival before that point. -->

```yaml
limits:
  manifest_lines: 350   # this file. The template itself ships at ~249 lines, so a
                        # 250 cap left one line of headroom and tripped C5 the
                        # first time anyone added a module row or a comment.
                        # MANIFEST is config, not a log — there is nothing to
                        # archive out of it, so the cap exists only to keep it
                        # readable. Lower it if this file starts accruing prose.
  status_lines:   100   # .claude/state/STATUS.md
  tasks_lines:    300   # .claude/state/TASKS.md — triggers archival to TASKS-archive.md
  done_rows:       60   # DONE rows in TASKS.md before archival, independent of line count.
                        # RAISED from 50 on 2026-08-18, and it reverts when T-149
                        # lands. The cap and C3 are mutually unsatisfiable right
                        # now: archiving is not deletion, but C3 resolves Depends
                        # against TASKS.md alone, so moving a row a live row still
                        # names turns one FAIL into eight (measured, then
                        # reverted). Of 52 DONE rows exactly two were archivable.
                        # Raising the number is the honest move only because the
                        # ARCHIVAL MECHANISM is what is broken, not the queue's
                        # size — do not raise it again to buy silence.
```

---

## Knowledge
<!-- Domain knowledge sources that spec-agent and product-agent reference. -->
<!-- Standards listed here are checked by product-agent — missing coverage is HIGH severity. -->

```yaml
standards: [WCAG 2.1 AA]  # voice-first REQUIRES a non-voice path for every action
domain_glossary: ""
sme_contacts: []

# THE PRODUCT BEING REDESIGNED. Read before speccing — extend/replace its UCs by
# code, never reinvent them blind. These are absolute paths into the existing repo.
existing_requirements:
  use_cases:      "/Users/tandt/projects/todo-ai/docs/02-use-cases.md"   # 95 UCs, UC-/AC- codes cited in code
  architecture:   "/Users/tandt/projects/todo-ai/docs/01-architecture.md"
  ui_design:      "/Users/tandt/projects/todo-ai/docs/03-ui-design.md"
  feature_audit:  "/Users/tandt/projects/todo-ai/docs/04-feature-audit.md" # built vs designed
  uiux:           "/Users/tandt/projects/todo-ai/docs/06-uiux.md"          # motion system, gestures

reference_implementations: []
market_context: ""        # not written — product-agent marks Lens 2 weakened accordingly
```

---

## Product
<!-- Controls whether product-agent is dispatched. -->
<!-- Set to "required" for B2B SaaS, fintech, healthcare, consumer products with competitors. -->
<!-- Set to "skip" for internal tools, prototypes, MVPs without market pressure. -->

```yaml
product_review: required      # values: required | optional | skip
spec_review:    full      # full = every applicable role lens reviews the spec at
                          #        Gate 1, in parallel, before any build work
                          # product-only = previous behaviour, product-agent alone
                          # skip = static spec checks only
                          # C13 runs in all three modes. See ORCHESTRATION "Gate 1".
design_review:  full      # full = dev + tester + spec lenses read the design at
                          #        Gate 1.5, before any implementer is dispatched
                          # skip = design-check only (mechanical)
                          # See ORCHESTRATION "Gate 1.5".
```

<!-- What `skip` gives up, stated so the choice is informed rather than silent: -->
<!--   - the independent re-derivation of the requirement list at gate 1, which -->
<!--     is the only step that looks for requirements nobody wrote down -->
<!--   - the rendered look at the built screens, judged against this project's -->
<!--     own design system -->
<!-- What it does NOT give up: reviewer C11 still renders the mockups, and C14 -->
<!-- still checks the implementation honours their testid contract. Whether a -->
<!-- screen matches what was approved is structural and always runs; whether it -->
<!-- is any good is judgement, and that is what `skip` opts out of. -->

<!-- C10 and C13 also remain: the spec must still declare its scope boundary -->
<!-- and account for every field it names. Those are reviewer checks, not -->
<!-- product-agent's, precisely so that skipping this gate does not remove the -->
<!-- floor under requirements. -->


---

## Modules
<!-- Business domains in this project. Updated by orchestrator and spec-agent. -->

| Module | Purpose | Owner | Status |
|--------|---------|-------|--------|
| _shared | Cross-cutting: architecture, standards, design system, traceability | — | — |
| assistant | Voice conversation that manages the todo list | — | active |

---

## Source Tree (default domain-modular layout)
<!-- Default convention for new projects. Adapt to existing structures — never relocate existing files. -->
```
project/
├── MANIFEST.md              ← project config (this file)
├── CLAUDE.md                ← project-owned; @imports .claude/ORCHESTRATION.md
├── .claude/
│   ├── ORCHESTRATION.md     ← template-owned agent-orchestration guide
│   ├── state/
│   │   ├── STATUS.md        ← live pipeline state
│   │   └── TASKS.md         ← task queue
├── specs/
│   ├── _shared/          ← ARCHITECTURE, standards, ADRs, glossary
│   └── {module}/
│       ├── index.md              ← table of features in this module
│       ├── F-{id}-{slug}.md      ← one file per feature (e.g. F-003-password-reset.md)
│       ├── api-contracts.md      ← shared by all features in the module
│       ├── data-model.md
│       └── design-notes.md
├── design/
│   ├── _shared/          ← DESIGN.md, tokens.json, components.md
│   └── {module}/screens/
├── src/
│   ├── _shared/          ← cross-cutting code (or `shared/`)
│   └── {module}/         ← web/ mobile/ api/ __tests__/ colocated
└── qa/
    ├── _shared/          ← KNOWLEDGE.md, TRACEABILITY.md, shared fixtures
    └── {module}/         ← test cases, automation/, runs/
```

## Active Agents
<!-- Updated by orchestrator when agents are spawned -->
| Agent | Task | Status | Files Claimed |
|-------|------|--------|---------------|
| — | — | — | — |

## Quick Links
- Current tasks → [.claude/state/TASKS.md](.claude/state/TASKS.md)
- Current blockers → [.claude/state/STATUS.md](.claude/state/STATUS.md)
- Latest build status → [.claude/state/STATUS.md#ci](.claude/state/STATUS.md)
