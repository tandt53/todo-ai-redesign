# Product Review: F-{id} {slug}
<!-- Written by: product-agent (optional agent — only when MANIFEST ## Product.product_review != skip) -->
<!-- Lives at: docs/reports/product-review-F-{id}-{date}.md (or -final-{date}.md for Phase 2) -->

**Date**: {YYYY-MM-DD}
**Agent**: product-agent
**Phase**: review-spec | review-final
**Feature**: docs/specs/{module}/F-{id}-{slug}.md
**Result**: APPROVED | CHANGES REQUESTED

## Summary
[2-3 sentences. What was evaluated, overall assessment, what must happen next.]

## HIGH severity — blocks architect-agent
<!-- Omit section if none -->
| ID | Issue | Location | Required action |
|----|-------|----------|----------------|
| H-001 | [specific issue] | AC-{n} or requirement | [what must change] |

## MEDIUM severity — fix before implementation
<!-- Omit section if none -->
| ID | Issue | Location | Suggested action |
|----|-------|----------|-----------------|
| M-001 | [specific issue] | AC-{n} | [suggestion] |

## LOW — observations
<!-- Omit section if none -->
- [observation]

## AC quality assessment
| AC | Platform tags | Current level | Target | Action needed |
|----|--------------|--------------|--------|---------------|
| AC-1 | (api, web, mobile) | Behavior verification | Sufficient | — |
| AC-2 | (api, web) | Code existence | User outcome | [rewrite suggestion] |

## Approved ACs
| AC | Platform tags | Status | Notes |
|----|--------------|--------|-------|
| AC-1 | (api, web, mobile) | APPROVED | — |

## Market intelligence
[3-5 bullet points from web search. Cite sources.]
- [finding] — [implication for spec]

## Missing requirements identified
| ID | Description | Severity | Evidence |
|----|-------------|----------|---------|
| MISS-001 | [missing requirement] | HIGH/MEDIUM | [why it must exist] |

## Next step
[Explicit: "Resolve H-001 and MISS-001, then re-run product-agent"
 or "No blockers — architect-agent can proceed"]
