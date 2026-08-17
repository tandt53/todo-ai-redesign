# Project Learnings

<!--
Durable, human-curated insights about this codebase. Agents read this on startup
to avoid re-deriving lessons the pipeline has already paid for.

OWNERSHIP:
- reviewer-agent APPENDS entries when a C1–C14 failure reveals a pattern worth remembering
  (e.g., a bug with a recurring shape, a contract-drift class, a test anti-pattern).
- Humans CURATE: prune outdated entries, promote recurring ones into standards docs,
  correct framing.
- Spec-agent, architect-agent, and QA agents READ — they do not write.

SCOPE: entries should be general enough to guide future work, specific enough to act on.
"Be careful with async" is too vague. "In Next.js 14, page props `params` is a Promise and
must be awaited before destructuring" is actionable.
-->

## Format

Each entry is a level-2 heading (`## L-NNN — short title`) with:

- **Date added** — YYYY-MM-DD by {agent or human}
- **Trigger** — what prompted this lesson? (bug ID, review fail, task ID, spec revision)
- **Pattern** — the lesson, one paragraph. Phrase as *what went wrong* or *what works*.
- **How to apply** — concrete guidance for future work. Name files/functions/conventions.
- **Scope** — file globs or modules where this applies (or `project-wide`)
- **Stale check** — when should this be revisited? (specific date or `permanent`)

Entries are **append-only by agents**; humans may edit or delete.

---

## Entries

<!-- Agents append new entries below this line. Humans may reorder or prune. -->

### L-000 — (example, delete before first real entry)

- **Date added** — 2026-01-01 by human
- **Trigger** — placeholder
- **Pattern** — This is what an entry looks like. Replace with a real one after the first real learning lands.
- **How to apply** — Read this template, then delete L-000 once there's a genuine L-001.
- **Scope** — n/a
- **Stale check** — delete on first real entry
