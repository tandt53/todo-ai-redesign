# Memory Protocol (shared by all agents)
<!-- Agents read memory before starting work and write memory after completing work. -->
<!-- Memory captures non-obvious knowledge that helps future agents avoid mistakes and reuse patterns. -->
<!-- This protocol uses a 5-layer retrieval hierarchy with a hard token budget of ~2300 tokens. -->

---

## Memory file structure

```
memory/                          ← at project root (not under docs/ or qa/)
├── MEMORY.md                    ← project-wide append-only log
├── MEMORY-archive.md            ← entries older than 60 days (auto-archived)
├── spec-agent.md
├── architect-agent.md
├── web-agent.md
├── mobile-agent.md
├── backend-agent.md
├── qa-api-agent.md
├── qa-web-agent.md
├── qa-mobile-agent.md
├── reviewer-agent.md
└── product-agent.md             ← (if product-agent is enabled in this project)
```

---

## Five-layer retrieval hierarchy

Memory is not "load everything." It's a hierarchy: each layer answers a different question at a different cost. Total budget: **~2300 tokens** on top of BRIEFING.md. Memory must never crowd out the feature spec and api-contracts — those are the actual work files.

### Layer 1 — Task context (already done via BRIEFING.md)
**Strategy:** read BRIEFING.md (your briefing was written by the orchestrator)
**Tokens:** ~300 (included in your normal startup, not counted against memory budget)
**When:** always, first step of every dispatch

You already do this. BRIEFING.md contains the task, module, feature_id, files to read, and a context summary. This replaces the old "read MANIFEST + STATUS + TASKS on every dispatch."

The orchestrator reads MANIFEST + STATUS + TASKS; you don't.

### Layer 2 — Recent memory (temporal proximity)
**Strategy:** tail read
**Tokens:** ~600
**When:** every dispatch, after reading BRIEFING.md and _qa-foundations.md (if QA agent)

```bash
tail -n 200 memory/MEMORY.md 2>/dev/null || echo "No project memory yet"
```

The last ~10 entries. Recent decisions and patterns are almost always relevant — they represent what just happened in the project. No search needed; temporal proximity is a strong signal.

### Layer 3 — Semantic search (topic relevance)
**Strategy:** tag-based grep
**Tokens:** ~600
**When:** every dispatch, after Layer 2

```bash
# Extract domain tags from your briefing (what domain does this task touch?)
# Example: for a password-reset task in the auth module
for tag in auth password reset session token; do
  grep -A 8 "Tags:.*$tag" memory/MEMORY.md 2>/dev/null
done
```

The orchestrator's BRIEFING.md may include a `memory_tags:` field listing the tags to search. If present, use those. If absent, derive tags from the task title + module name.

Limit: read the top 5 matching entries. Don't load 20. If tag-search consistently misses relevant entries, the project should consider upgrading to vector search (see "Growth management" below) — but start with grep.

### Layer 4 — Exact lookup (ID and keyword)
**Strategy:** structured grep
**Tokens:** ~400
**When:** triggered by specific conditions, not every dispatch

Trigger conditions:
- You encounter a reference to a past decision or ADR → grep for that ID
- You are about to make an architectural choice → `grep -A 8 "Type: constraint" memory/MEMORY.md`
- Your task has a specific feature ID → `grep -A 8 "Feature: F-003" memory/MEMORY.md`
- You are working on auth, payments, or security → always check constraints: `grep -A 8 "Type: constraint" memory/MEMORY.md | grep -i "auth\|payment\|security"`
- You are about to implement something complex → `grep -A 8 "Type: mistake" memory/[your-agent-name].md` (learn from past mistakes)

### Layer 5 — Agent-specific memory (procedural knowledge)
**Strategy:** direct file read
**Tokens:** ~400
**When:** every dispatch, after Layer 1

```bash
cat memory/[your-agent-name].md 2>/dev/null || echo "No agent memory yet"
```

Your accumulated patterns, mistakes, and conventions for this project. Always small (kept under 100 lines). Always read fully. This is "muscle memory" — how you've learned to work in this codebase.

---

## Startup sequence (copy into every agent)

After BRIEFING.md and any shared protocol files (like `_qa-foundations.md`), do:

```
# Layer 5: Agent-specific memory (always)
Read memory/[your-agent-name].md

# Layer 2: Recent project memory (always)
Read last 200 lines of memory/MEMORY.md

# Layer 3: Semantic search (by task domain tags)
Grep memory/MEMORY.md for tags matching your task's domain

# Layer 4: Constraints (always before implementing; skip for read-only tasks like review)
Grep memory/MEMORY.md for "Type: constraint"

# Layer 4: Feature-specific (when task has a feature ID)
Grep memory/MEMORY.md for "Feature: F-[your-feature-id]"
```

**Total memory tokens: ~2300.** If your memory reads exceed this, you're loading too much. Trim Layer 3 results to top 5 and Layer 4 to top 3.

---

## Memory write protocol

Agents write memory **after completing a task**, not during. The write goes through the **orchestrator** — you include a `memory_entry:` field in your return summary, and the orchestrator appends it to `memory/MEMORY.md`. You do NOT write to MEMORY.md directly (single-writer rule: orchestrator owns all state files).

### Three triggers — write only when one applies

1. **Non-obvious decision made** — you chose approach A over B for a reason not documented elsewhere
2. **Mistake caught and fixed** — you went down the wrong path, wasted time, found the real cause
3. **Reusable pattern discovered** — you found something other agents should know about

**If none apply, skip.** Quality over quantity — 30 high-signal entries beats 300 obvious ones.

### Entry format (include in your return summary's `memory_entry:` field)

```markdown
## [YYYY-MM-DD] [short title] — [your-agent-name]
**Type:** decision | mistake | pattern | constraint | convention
**Feature:** F-[id] | cross-cutting
**Tags:** [2-5 comma-separated domain tags, e.g., auth, e2e, database, middleware]
---
[What happened, why, and what the next agent should do differently. 3-6 lines.]
[Include: the specific file/location where this applies]
[Include: the alternative that was rejected and why (for decisions)]
```

### Agent-specific memory (separate file)

If a lesson is specific to your agent type and would be useful across multiple future tasks in this project, also include it in your return summary as `agent_memory_entry:`. The orchestrator appends it to `memory/[your-agent-name].md`. Format:

```markdown
## [short title]
**Context:** [when this applies]
**Pattern/Lesson:** [what to do]
**Example:** [optional — concrete example from this task]
```

Keep `memory/[agent-name].md` under 100 lines. If it grows beyond that, promote the most universal entries to `memory/MEMORY.md` and trim.

---

## Superseding stale entries

When a decision changes, don't just add a new entry — mark the old one superseded. Include both actions in your return summary:

```
memory_supersede: "2026-04-05 JWT with HS256 — architect-agent"
memory_entry: |
  ## 2026-04-10 JWT with RS256 — architect-agent
  **Type:** decision
  **Feature:** cross-cutting
  **Tags:** auth, jwt, security, cryptography
  ---
  Switched from HS256 to RS256 for JWT signing. HS256 uses a shared secret (single
  point of compromise). RS256 uses asymmetric keys (private key signs, public key
  verifies — services only need the public key). See ADR specs/_shared/adr/005-jwt-rs256.md.
  Supersedes: 2026-04-05 "JWT with HS256" entry.
```

The orchestrator appends `~~SUPERSEDED by 2026-04-10 entry~~` to the old entry and appends the new one. Layer 3 and Layer 4 grep will still find the old entry, but the `~~SUPERSEDED~~` marker signals agents to ignore it and follow the superseding entry.

---

## Avoiding context poisoning

| Poison scenario | Defence |
|---|---|
| Stale decision loaded (old library choice) | `~~SUPERSEDED~~` marker + agents skip superseded entries |
| Wrong project context | Memory is per-project — separate files per project root |
| Too much retrieval | Hard token budget: ~2300 tokens total across Layers 2-5 |
| Contradictory entries | Write protocol: always search before writing, supersede not duplicate |
| Irrelevant semantic results | Top-5 limit for Layer 3, not top-20 |
| Memory file grows unwieldy | Auto-archive at 500 lines (see below) |
| Agent self-reports inaccurate metrics | Orchestrator spot-checks metrics against filesystem (see below) |
| Cascading bad context (one wrong entry influences 5+ dispatches) | Influence tracking + periodic verification (see below) |

### Trust hierarchy for contradictions

When two memory entries or sources contradict each other, trust the higher-ranked source:

1. **Filesystem facts** (highest) — files exist or they don't, file contents are what they are
2. **Test runner output** — tests pass or they don't, coverage numbers are real
3. **Reviewer-agent observations** — structural checks are deterministic
4. **Orchestrator metrics verification** — spot-checked against filesystem
5. **Agent self-reports** (lowest) — self-assessment can be wrong, metrics can be inflated

When you encounter a memory entry that conflicts with what you observe, do not silently follow the entry. Report the contradiction in your return summary's `drift_noted` field. The orchestrator resolves it by checking against the higher-ranked source.

### Metrics verification (orchestrator's job)

Every metric in a return summary has a verifiable backing fact:
- `files_created: 3` → orchestrator can `ls` the output paths
- `ac_coverage.covered_p1: 5` → orchestrator can grep TC files for AC-ids
- `tests_passed: 12` → orchestrator can re-run the test command

The orchestrator spot-checks metrics after every 10th dispatch. If a metric doesn't match reality:
1. Marks the metric file with `"verified": false`
2. Does NOT use unverified metrics in pattern detection
3. Writes a memory entry: "{agent} reported inaccurate metrics. Cross-check future reports."

### Cascading influence tracking

A memory entry that is referenced in 3+ subsequent dispatches' `memory_read:` fields without being verified triggers a verification:
- Orchestrator checks the entry's claims against the current filesystem state
- If still true: marks `"last_verified": "{date}"`, resets influence counter
- If stale or wrong: supersedes the entry with a corrective one

This prevents a single wrong entry from propagating unchecked through the system.

### What agents must NEVER do with memory

- Never follow a memory entry that contradicts what you can directly observe (filesystem, test output)
- Never write a memory entry about another agent's behavior — you can file bugs or note drift, but you can't characterize what another agent "should have done"
- Never write a memory entry based on assumptions — only on observed facts and decisions you made
- Never bulk-load memory entries from external sources — each entry must be earned by a single dispatch

---

## Token budget

| Layer | Tokens | Notes |
|---|---|---|
| Layer 1: BRIEFING.md | ~300 | Already done in normal startup |
| Layer 2: Recent memory | ~600 | Last ~10 entries via tail |
| Layer 3: Semantic search | ~600 | Top 5 tag matches |
| Layer 4: Exact lookups | ~400 | Only when triggered |
| Layer 5: Agent memory | ~400 | Always small (< 100 lines) |
| **Total** | **~2300** | Task content (feature spec, api-contracts, code) gets the rest |

---

## Growth management

### Monthly: archive old entries

When MEMORY.md exceeds 500 lines, the orchestrator (during its startup archival check) moves entries older than 60 days to `memory/MEMORY-archive.md`. Agents don't load the archive by default. Layer 4 exact search can reach it when a specific old entry is referenced:

```bash
grep -A 8 "Feature: F-001" memory/MEMORY-archive.md
```

### Quarterly: consolidate duplicates

If multiple entries say the same thing, merge into one canonical entry and mark the others superseded. Target: no two entries that contradict or duplicate each other.

### Promote to docs when repeated 3+ times

If a pattern appears in memory more than 3 times, it belongs in a permanent doc:
- Coding pattern → `specs/_shared/standards/coding-standards.md`
- Platform convention → `specs/_shared/platform/{platform}.md`
- Constraint → feature spec's `## Domain Rules` section (when we add it)

Memory is for accumulated learning, not permanent conventions. If something is always true, it should be in a doc that every agent reads on every dispatch — not in a grep-searched log.

---

## What this file does NOT cover

- **How to structure BRIEFING.md** — see `agents/orchestrator.md ## The briefing (BRIEFING.md)`
- **sqlite-vec / vector search** — if tag-based grep consistently misses relevant entries at 500+ entries, consider upgrading to vector search. Not needed for most projects. Document the upgrade path separately if you reach that scale.
- **Cross-project memory** — this protocol is per-project. Agent-specific files (`memory/[agent-name].md`) are project-scoped. Universal cross-project lessons should be added to the agent's definition file (`agents/[agent-name].md`) directly, not to project memory.

---

## Examples

### Good entries (write these):

```markdown
## 2026-04-05 Auth redirect loop was a seeding issue — qa-web-agent
**Type:** mistake
**Feature:** F-001
**Tags:** e2e, auth, database, fixtures, environment
---
Spent 45min debugging an auth redirect loop in Playwright e2e. Root cause: empty
users table — test fixtures weren't seeded after DB reset, not a middleware bug.
Lesson: before debugging auth e2e failures, always check if the test DB has user
records (`SELECT count(*) FROM users`). Run a count query first.
```

```markdown
## 2026-04-05 Supabase RLS requires user_id on every user-data table — architect-agent
**Type:** constraint
**Feature:** cross-cutting
**Tags:** supabase, rls, auth, database, security
---
Supabase RLS policies require auth.uid() to match a user_id column. Every new table
storing user-specific data needs: (1) a user_id UUID FK column, (2) an RLS policy
granting access only when auth.uid() = user_id. Check existing policies in
supabase/migrations/ for the exact pattern. Missing an RLS policy = data leak.
```

### Bad entries (don't write these):

```markdown
# Too obvious — derivable from package.json
Summary: Project uses Next.js App Router.

# Too vague — not actionable
Summary: Used the existing auth pattern.

# Ephemeral — won't matter next dispatch
Summary: Ran tests on port 3001 instead of 3000.
```
