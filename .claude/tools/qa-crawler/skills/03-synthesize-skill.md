# Skill: Phase 2 — Synthesize Flows & Build Catalog

This phase runs after crawling is complete. No browser needed.
You read all the page knowledge files and connect them into user flows,
then generate the human-readable catalog and sitemap.

---

## Path Convention

All paths are relative to the **active project directory** (`projects/<project-name>/`).
- `<project>` = `projects/<project-name>` (e.g., `projects/odc-academy`)
- `output/` = `<project>/output/`
- `tests/` = `<project>/tests/`

---

## Input

Read all files in `<project>/output/knowledge/pages/*.json`.
Read `<project>/output/knowledge/pageIndex.json` for the full route map.

---

## Step 1 — Identify User Flows

A **user flow** is a sequence of pages a user navigates to accomplish a goal.

Think like a product manager or QA engineer:
- What are the main things a user does in this app?
- Which pages are connected by those actions?
- What is the happy path? What are the edge cases?

### How to identify flows

Look for patterns in the `leadsTo` connections between pages:
- **Linear sequences** → `/cart → /checkout/address → /checkout/payment → /confirm`
- **Hub and spoke** → `/dashboard` links to many features
- **Auth gates** → pages that redirect to `/login` if not authenticated
- **Wizard patterns** → multi-step forms with Next/Back buttons
- **CRUD patterns** → list → detail → edit → save

### Common flow types to look for

| Flow Type | Example |
|---|---|
| Authentication | Register → Verify Email → Login → Dashboard |
| Onboarding | Welcome → Setup Profile → Choose Plan → Dashboard |
| Core feature | Search → Results → Detail → Action |
| Settings change | Settings → Edit → Save → Confirmation |
| Checkout | Cart → Address → Payment → Confirm → Success |
| Account management | Profile → Edit → Save |
| Destructive action | Settings → Delete Account → Confirm → Logged out |

### For each flow you identify, write `<project>/output/knowledge/flows/<flow-name>.json`:

```json
{
  "name": "Checkout Flow",
  "description": "User purchases items from cart through to order confirmation",
  "trigger": "User clicks Checkout from cart page",
  "testPriority": "critical",
  "steps": [
    {
      "order": 1,
      "page": "/cart",
      "pageFile": "pages/cart.json",
      "action": "User reviews items and clicks Proceed to Checkout",
      "actionLocator": "role=button[name='Proceed to Checkout']",
      "expectedOutcome": "Navigates to /checkout/address"
    },
    {
      "order": 2,
      "page": "/checkout/address",
      "pageFile": "pages/checkout-address.json",
      "action": "User fills in shipping address and clicks Continue",
      "actionLocator": "role=button[name='Continue']",
      "expectedOutcome": "Navigates to /checkout/payment"
    },
    {
      "order": 3,
      "page": "/checkout/payment",
      "pageFile": "pages/checkout-payment.json",
      "action": "User enters payment details and clicks Place Order",
      "actionLocator": "role=button[name='Place Order']",
      "expectedOutcome": "Navigates to /checkout/confirm with order number visible"
    },
    {
      "order": 4,
      "page": "/checkout/confirm",
      "pageFile": "pages/checkout-confirm.json",
      "action": "User sees order confirmation",
      "expectedOutcome": "Order number displayed, confirmation email sent"
    }
  ],
  "alternativePaths": [
    {
      "name": "Payment failure",
      "description": "Invalid card → error message → retry payment"
    }
  ],
  "relatedFlows": ["auth-flow", "cart-flow"]
}
```

---

## Step 2 — Write `<project>/output/knowledge/flows/index.json`

A summary of all flows found:

```json
{
  "synthesizedAt": "2026-04-08T08:05:00.000Z",
  "totalFlows": 6,
  "flows": [
    {
      "name": "Checkout Flow",
      "file": "flows/checkout-flow.json",
      "priority": "critical",
      "steps": 4
    },
    {
      "name": "Authentication Flow",
      "file": "flows/auth-flow.json",
      "priority": "critical",
      "steps": 3
    }
  ]
}
```

---

## Step 3 — Write `<project>/output/catalog.md`

Human-readable summary for the QA team. Structure:

```markdown
# 📋 QA Knowledge Base
> Built: April 8, 2026
> App: https://your-app.com
> Pages: 24 | Flows: 6

---

## 🚀 User Flows

### Critical
- **Checkout Flow** — 4 steps → `flows/checkout-flow.json`
- **Authentication Flow** — 3 steps → `flows/auth-flow.json`

### High
- **Profile Update Flow** — 2 steps → `flows/profile-update-flow.json`

---

## 📄 Pages

### /dashboard
**Summary:** Main landing page after login. Shows activity overview and quick navigation.
**Layout:** sidebar-nav + content-grid
**Priority:** medium
**Elements:** 3 buttons, 0 forms, 1 dropdown
**Leads to:** /settings, /profile, /billing, /reports

### /settings/profile
**Summary:** Allows users to update personal info, avatar, and password.
**Layout:** settings-panel
**Priority:** high
**Elements:** 2 buttons (1 ⚠️ destructive), 2 forms, 1 modal
**Leads to:** /settings/billing, /settings/security

---

## 🗺️ Sitemap

/
├── /dashboard
├── /settings
│   ├── /settings/profile
│   ├── /settings/billing
│   └── /settings/security
├── /users
│   └── /users/:id
└── /checkout
    ├── /checkout/cart
    ├── /checkout/address
    ├── /checkout/payment
    └── /checkout/confirm

---

## 📊 Coverage Summary

| Priority | Pages | Has Forms | Destructive Actions |
|---|---|---|---|
| Critical | 4 | 4 | 1 |
| High | 8 | 6 | 2 |
| Medium | 9 | 2 | 0 |
| Low | 3 | 0 | 0 |

## ⚠️ Destructive Actions Found
- `/settings/profile` — Delete Account modal
- `/users/:id` — Remove User button
- `/billing` — Cancel Subscription button

## 🔴 Error Pages Found
- `/reports/export` — 500 error during crawl
```

---

## Step 4 — Write `<project>/output/sitemap.json`

Machine-readable sitemap for tooling:

```json
{
  "generatedAt": "2026-04-08T08:05:00.000Z",
  "baseUrl": "https://your-app.com",
  "totalPages": 24,
  "totalFlows": 6,
  "tree": {
    "/": {
      "/dashboard": {},
      "/settings": {
        "/settings/profile": {},
        "/settings/billing": {},
        "/settings/security": {}
      },
      "/users": {
        "/users/:id": {}
      }
    }
  },
  "byPriority": {
    "critical": ["/login", "/checkout/payment", "/checkout/confirm"],
    "high": ["/settings/profile", "/settings/billing", "/users/:id"],
    "medium": ["/dashboard", "/reports"],
    "low": ["/about", "/help"]
  }
}
```

---

## End of Phase 2

Print final summary:

```
✅ QA Knowledge Base Built
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Pages crawled:        24
  User flows identified: 6
    → critical:          2
    → high:              3
    → medium:            1
  Destructive actions:   3  ⚠️
  Error pages:           1  🔴
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Knowledge base written to: ./<project>/output/
    ✅ knowledge/pages/     (24 files)
    ✅ knowledge/flows/     (6 files)
    ✅ knowledge/pageIndex.json
    ✅ knowledge/flows/index.json
    ✅ catalog.md
    ✅ sitemap.json

  Next steps:
    → Generate tests:  claude "generate tests for checkout flow"
    → Fix failures:    claude "fix failing tests in <project>/tests/"
```
