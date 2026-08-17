# Project Manifest
<!-- Master index. Keep under 120 lines. Never put content here — only links. -->

## Project
- **Name**: [project name]
- **Purpose**: [one sentence]
- **Stack**: [language · framework · database · platform]
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

shared_dir: _shared       # folder name for cross-cutting artifacts inside each root
modules: []               # business domains in this project (e.g. auth, payments). Grows as features are specced.

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
```

<!-- Alternate layouts (not active — switch by changing `layout:` above):
     - layout: flat       → no modules; everything at the root of each (e.g. specs/features/, qa/features/). For tiny projects.
     - layout: custom     → orchestrator detected an existing non-standard structure (e.g. monorepo apps/auth/).
                            Patterns override the defaults; the modules list is filled in from detection. -->

---

## Knowledge
<!-- Domain knowledge sources that spec-agent and product-agent reference. -->
<!-- Standards listed here are checked by product-agent — missing coverage is HIGH severity. -->

```yaml
standards: []             # Regulatory / compliance standards (e.g. PCI-DSS, WCAG 2.1 AA, GDPR, HIPAA)
domain_glossary: ""       # Path to a glossary file, URL, or Notion doc (e.g. specs/_shared/glossary.md)
sme_contacts: []          # Subject-matter experts (e.g. "Alice — payments domain — @alice in Slack")
reference_implementations: []  # Links to prior art or competitor references
market_context: "specs/_shared/market-context.md"  # Competitive landscape, table stakes (optional)
```

---

## Product
<!-- Controls whether product-agent is dispatched. -->
<!-- Set to "required" for B2B SaaS, fintech, healthcare, consumer products with competitors. -->
<!-- Set to "skip" for internal tools, prototypes, MVPs without market pressure. -->

```yaml
product_review: skip      # values: required | optional | skip
```

---

## Modules
<!-- Business domains in this project. Updated by orchestrator and spec-agent. -->

| Module | Purpose | Owner | Status |
|--------|---------|-------|--------|
| _shared | Cross-cutting: architecture, standards, design system, traceability | — | — |
| [module] | [one-line purpose] | — | active |

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

## Documents
<!-- Agents: read only what your task needs. Never load all docs at once. -->
<!-- The Paths section above is authoritative. The tables below are a discoverability aid. -->

### Spec (source of truth)
<!-- Per-module index lives at {specs}/{module}/index.md — see that file for the full feature list. -->
| File | Feature | Status | Owner |
|------|---------|--------|-------|
| {specs}/{module}/index.md | [module feature index] | — | spec-agent |
| {specs}/{module}/F-{id}-{slug}.md | [one file per feature] | draft\|approved | spec-agent |

### Architecture (cross-cutting, in {specs}/_shared/)
| File | Covers | Last Updated |
|------|--------|-------------|
| {specs}/_shared/ARCHITECTURE.md | System overview, tech decisions | — |
| {specs}/{module}/api-contracts.md | API shapes for the module | — |
| {specs}/{module}/data-model.md | Entities for the module | — |
| {specs}/_shared/db-schema.md | Database schema (cross-module) | — |
| {specs}/_shared/env-config.md | Environment configuration | — |
| {specs}/_shared/adr/001-*.md | [decision title] | — |
| {specs}/_shared/platform/ios.md | iOS-specific constraints | — |
| {specs}/_shared/platform/android.md | Android-specific constraints | — |
| {specs}/_shared/platform/web.md | Web-specific constraints | — |
| {specs}/_shared/platform/backend.md | Backend-specific constraints | — |

### Standards (cross-cutting)
| File | Covers | Last Updated |
|------|--------|-------------|
| {specs}/_shared/standards/coding-standards.md | Coding conventions | — |
| {specs}/_shared/standards/security-policy.md | Security requirements | — |

### Design
| File | Covers | Last Updated |
|------|--------|-------------|
| {design}/_shared/DESIGN.md | Design system, principles, components index | — |
| {design}/_shared/tokens.json | Machine-readable design tokens | — |
| {design}/_shared/components.md | Component inventory + states | — |
| {design}/{module}/screens/index.html | Navigation to module screens | — |

### QA
| File | Covers | Last Updated |
|------|--------|-------------|
| {qa}/{module}/index.md | QA index for the module | — |
| {qa}/_shared/TRACEABILITY.md | Requirement ↔ test case ↔ automation | — |
| {qa}/_shared/KNOWLEDGE.md | QA onboarding + system map | — |

## Active Agents
<!-- Updated by orchestrator when agents are spawned -->
| Agent | Task | Status | Files Claimed |
|-------|------|--------|---------------|
| — | — | — | — |

## Quick Links
- Current tasks → [.claude/state/TASKS.md](.claude/state/TASKS.md)
- Current blockers → [.claude/state/STATUS.md](.claude/state/STATUS.md)
- Latest build status → [.claude/state/STATUS.md#ci](.claude/state/STATUS.md)
