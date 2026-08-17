# AI Cost Model
<!-- Written by: backend-agent (AI features are backend features) | Read by: architect-agent, reviewer-agent -->
<!-- Updated whenever a new AI feature is added or a model changes -->

## Provider Pricing Reference
<!-- Update when providers change pricing -->
| Model | Input $/1M tokens | Output $/1M tokens | Notes |
|-------|------------------|--------------------|-------|
| claude-haiku-4-5 | $0.80 | $4.00 | Fast tier |
| claude-sonnet-4-5 | $3.00 | $15.00 | Balanced tier |
| claude-opus-4-5 | $15.00 | $75.00 | Best tier |
| gpt-4o-mini | $0.15 | $0.60 | Fast tier |
| gpt-4o | $2.50 | $10.00 | Balanced tier |
| text-embedding-3-small | $0.02 | — | Embeddings |
| text-embedding-3-large | $0.13 | — | Embeddings |

---

## Feature Cost Estimates

<!-- backend-agent adds one section per AI feature -->

### Feature: [name] (F-[id])
**Use case**: [type]
**Model**: [model]
**Prompt caching**: yes/no

#### Token Budget (per call)
| Component | Tokens | Cacheable |
|-----------|--------|-----------|
| System prompt | ~[N] | yes |
| Retrieved context (RAG) | ~[N] | no |
| Conversation history | ~[N] | partial |
| User input | ~[N] | no |
| **Total input** | **~[N]** | |
| Output | ~[N] | — |

#### Monthly Cost Projection
| Daily calls | Cost/call (no cache) | Cost/call (cached) | Monthly |
|-------------|---------------------|--------------------|---------|
| 1,000 | $[X] | $[X] | $[X] |
| 10,000 | $[X] | $[X] | $[X] |
| 100,000 | $[X] | $[X] | $[X] |

#### Cost Controls in Place
- [ ] Prompt caching enabled (saves ~[N]% on system prompt tokens)
- [ ] Semantic cache: TTL=[N]min, expected hit rate=[N]%
- [ ] Rate limit: [N] calls/user/minute
- [ ] Model downgrade: use [fast model] if [balanced model] queue > [N]s
- [ ] Cost alert: trigger at $[X]/day

---

## Total Monthly AI Cost Estimate

| Feature | Daily calls | Monthly cost | Notes |
|---------|-------------|-------------|-------|
| [feature 1] | | $[X] | |
| [feature 2] | | $[X] | |
| **Total** | | **$[X]** | |

## Cost Alert Thresholds
- Warning: $[X]/day (Slack notification)
- Critical: $[X]/day (PagerDuty)
- Hard limit: $[X]/day (rate limit all AI endpoints until reset)
