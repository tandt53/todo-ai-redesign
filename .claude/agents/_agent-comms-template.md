# Agent Communication Channel

This file enables asynchronous communication between agents during feature development.

## How It Works

1. **Agents post questions** — Any agent can ask questions to other agents in their summary
2. **Main Claude routes questions** — I see questions and dispatch the relevant agent to answer
3. **Answers are posted here** — Async communication log preserved for all agents to read
4. **All agents read this file** — Added to BRIEFING.md file list automatically

## Message Format

```markdown
## YYYY-MM-DD HH:MM — {from-agent} → {to-agent}
**Context:** {Feature ID, task, brief context}
**Q:** {Question}

## YYYY-MM-DD HH:MM — {to-agent} → {from-agent}
**A:** {Answer}
```

---

## Active Conversations

<!-- New messages are added here -->

---

## Resolved Conversations

<!-- Completed Q&A threads are moved here for reference -->

---

## Example

```markdown
## 2026-04-12 14:23 — web-agent → backend-agent
**Context:** F-001 login, implementing posts list UI with infinite scroll
**Q:** Should the /posts endpoint support pagination? If so, what's the default page size?

## 2026-04-12 14:45 — backend-agent → web-agent
**A:** Yes, use query params: `?page=1&limit=20`
- Default limit: 20 posts
- Max limit: 100 posts
- Returns: `{ posts: [...], total: 150, page: 1, hasMore: true }`
```
