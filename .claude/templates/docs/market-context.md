# Market Context
<!-- Written by: humans (with product-agent spot-checking via web search) -->
<!-- Read by: product-agent (evaluates feature specs against this), spec-agent (references for discovery) -->
<!-- Lives at: docs/specs/_shared/market-context.md -->
<!-- Optional: only needed when product-agent is enabled (MANIFEST ## Product.product_review: required) -->

## Product category
[What kind of product is this? e.g. "B2B SaaS invoicing platform", "consumer fintech app", "internal operations dashboard"]

## Target users
[Who are the real users? Link to docs/specs/_shared/user-stories.md for full personas.]
- [Primary persona: description, technical level, workflow]
- [Secondary persona: description]

## Competitors
| Competitor | Strengths | Weaknesses | Our differentiation |
|---|---|---|---|
| [name] | [what they do well] | [known user complaints] | [why we're better or different] |

## Table stakes (features users assume exist)
<!-- If your product is missing any of these, it's a gap — not a "nice to have." -->
<!-- product-agent checks feature specs against this list. -->

- [ ] [e.g. "Email/password login with password reset"]
- [ ] [e.g. "Mobile responsive (not a separate app, just responsive web)"]
- [ ] [e.g. "Export to CSV for any data table"]
- [ ] [e.g. "Real-time notifications for critical events"]
- [ ] [e.g. "Dark mode"]

## Regulatory / compliance requirements
<!-- Standards the product must meet. product-agent elevates missing coverage to HIGH severity. -->
<!-- Also referenced by spec-agent during discovery to ask the right compliance questions. -->

| Standard | Scope | Key requirements |
|---|---|---|
| [e.g. PCI-DSS 3.2.1] | [e.g. payment processing] | [e.g. card data never stored, tokenize via Stripe] |
| [e.g. WCAG 2.1 AA] | [e.g. all user-facing UI] | [e.g. contrast ratios, keyboard nav, screen reader] |
| [e.g. GDPR] | [e.g. EU user data] | [e.g. consent management, right to deletion, data export] |

## Market trends (update quarterly)
<!-- What's changing in this product category? New user expectations? New regulations? -->
- [e.g. "AI-assisted features are now table stakes in invoicing — auto-categorization, smart suggestions"]
- [e.g. "Users expect real-time collaboration, not save-and-refresh"]

## Last updated
[YYYY-MM-DD] by [human or product-agent web search supplement]
