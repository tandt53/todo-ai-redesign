# AI Feature: [Feature Name]
<!-- Extends feature.md for AI-specific concerns -->
<!-- Written by: spec-agent (AI section detail confirmed with backend-agent) -->

**ID**: F-[number]
**Type**: chat | rag | generation | classification | agentic | vision
**Status**: draft | approved | in-progress | done

---

## Purpose
<!-- What problem does this AI feature solve? Why is AI the right tool? -->
<!-- If a deterministic solution would work, use that instead. -->

---

## Acceptance Criteria
<!-- Same format as feature.md, but include quality thresholds -->
- [ ] Given [input], the AI response [behavior] — quality score ≥ [threshold]
- [ ] Response latency p95 < [N]ms (or: streaming first token < [N]ms)
- [ ] Cost per call < $[X]
- [ ] Eval dataset pass rate ≥ [N]%

---

## AI Design

### Use Case
`chat` | `rag` | `generation` | `classification/extraction` | `agentic` | `vision`

### Model Tier
`fast` | `balanced` | `best` — and why

### Provider
[Anthropic | OpenAI | Gemini | open-source | decided at implementation]

### Input
| Field | Type | Max size | Notes |
|-------|------|----------|-------|
| [field] | string/image/file | [limit] | [notes] |

### Output
| Field | Type | Format | Notes |
|-------|------|--------|-------|
| [field] | string/json/stream | [format] | [notes] |

### Context / Memory (if applicable)
- History window: [how many turns | summarization strategy]
- External context: [RAG source | documents | user data]
- Session persistence: [how long conversation is kept]

---

## Quality Requirements

### Eval Criteria
<!-- What does "correct" mean for this feature? Be specific. -->
| Criterion | Weight | Measurement |
|-----------|--------|-------------|
| [e.g. Factual accuracy] | [high/med/low] | [exact match | LLM judge | human review] |
| [e.g. Tone appropriate] | | |
| [e.g. Stays in scope] | | |

### Minimum Eval Score
- Overall: ≥ [N]% before shipping
- Per category: ≥ [N]% for [critical category]

### Regression Threshold
- Alert if score drops > [N]% from baseline
- Block deploy if score drops > [N]%

---

## Cost Constraints
- Max cost per call: $[X]
- Expected call volume: [N]/day
- Monthly budget: $[X]
- Caching allowed: yes/no — [what can be cached]

---

## Safety Requirements
- PII in input: [yes/no — which fields, how handled]
- PII in output: [yes/no — mitigation]
- Content filtering: [required? which categories]
- Agentic actions allowed: [list — or "none"]
- Human approval required for: [list — or "none"]

---

## Latency Requirements
- Acceptable UX: [streaming | async job | inline blocking]
- First token target: < [N]ms (if streaming)
- Total response target: < [N]s

---

## Fallback Behavior
<!-- What happens when the AI call fails or returns low quality? -->
- Provider down: [fallback model | cached response | error message]
- Rate limited: [queue | degrade | error]
- Output fails validation: [retry once | default response | human escalation]
- Response too slow: [timeout at Ns | show partial | cancel]

---

## Out of Scope
- [What this AI feature explicitly does NOT do]

---

## Open Questions
- [ ] [Question about model choice, cost, quality tradeoff, etc.]
