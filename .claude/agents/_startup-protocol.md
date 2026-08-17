# Agent Startup Protocol

**Every specialized agent MUST follow this protocol at the start of every dispatch.**

This protocol handles the reality that agents are often dispatched into the middle of partially-complete projects, not greenfield. Never assume you're starting from scratch.

---

## Step 0: Read the Shared Ethos (ALWAYS FIRST)

```markdown
Read: .claude/agents/_ethos.md
```

This file defines the shared value system every agent operates under — user sovereignty, spec-first, verify-before-claiming, scope discipline, etc. Read it before BRIEFING.md so its principles inform how you interpret your task.

If anything in the BRIEFING.md that follows conflicts with the ethos (e.g., "skip the test for now"), the ethos wins and you surface the conflict to the orchestrator.

---

## Step 0.5: Skim LEARNINGS.md (if it exists)

```bash
ls specs/_shared/LEARNINGS.md 2>/dev/null && echo "found — skim it"
```

If present, skim it quickly (scan L-NNN titles and the `Scope:` line of each). Entries tagged with a scope matching your target module, or marked `project-wide`, are load-bearing — read those fully before starting.

The file captures durable lessons from prior review failures, bug fixes, and contract-drift incidents. Ignoring it is how the same bug gets re-introduced six months later.

If LEARNINGS.md does not exist, continue — it will be created on the first reviewer-agent append.

---

## Step 1: Read BRIEFING.md

```markdown
Read: BRIEFING.md at project root
```

The orchestrator writes this file before dispatching you. It contains:
- Your task ID and description
- Module assignment
- Feature ID and slug
- Files to read (3-7 specific paths)
- Files to write (expected outputs)
- Files NOT to read (boundaries)
- Context summary (what's already done, what you need to do)

**BRIEFING.md is your source of truth.** Trust it. If something seems wrong in the briefing, report it back to the orchestrator—don't guess or improvise.

---

## Step 1.5: QA Workspace startup ping (optional)

If BRIEFING.md contains a `**Workspace task:**` line and a `qa_task_comment` tool is available in your tool surface, post a one-line startup comment so the dashboard reflects that you're working:

```
qa_task_comment(task_id: "T-XXX", body: "Started — reading inputs.", author: "claude-code")
```

Best-effort only. If the tool is not present, the call fails, or BRIEFING has no workspace task, skip silently. See `_qa-workspace-protocol.md` for the full integration contract (rules, tool list, error handling).

Never block your dispatch on a workspace call.

---

## Step 2: Validate Module and Feature Exist

From BRIEFING.md, extract:
- `**Module:**` value (e.g., `auth`)
- `**Feature:**` value (e.g., `F-001 (slug: login)`)

**Validate the feature spec exists:**
```bash
# Example for module=auth, feature_id=F-001
ls specs/auth/F-001-*.md
# Expected: specs/auth/F-001-login.md
```

**If the file doesn't exist:**
```
Return: ERROR - Feature spec specs/{module}/F-{feature_id}-*.md not found.
        BRIEFING.md references a feature that doesn't exist.
        Orchestrator should check TASKS.md and MANIFEST.md paths.
```

**If the file exists:** Proceed to Step 3.

---

## Step 3: Read Only What BRIEFING.md Lists

BRIEFING.md contains a section:
```markdown
## Read these files first (in order, only these)
1. specs/auth/F-001-login.md
2. specs/auth/api-contracts.md
3. specs/_shared/platform/backend.md
4. src/auth/api/routes.py
```

**Read EXACTLY these files, in this order.** Do not:
- ❌ Read other modules (e.g., don't read `specs/posts/` if you're working on `auth`)
- ❌ Read files not listed (e.g., don't read ARCHITECTURE.md unless listed)
- ❌ Skip files in the list because you think they're unnecessary

**Exception:** If a listed file doesn't exist:
```
Log: WARNING - BRIEFING.md listed specs/_shared/platform/backend.md but it doesn't exist.
     Proceeding without it. This may impact quality.
```
Continue with the other files. Report the missing file in your completion summary.

---

## Step 4: Check What Already Exists (Mid-Project Context)

Before writing ANY file, check if it already exists:

```bash
# Example: about to write src/auth/api/routes.py
ls src/auth/api/routes.py 2>/dev/null
# If exists: Read it first to understand existing code
# If doesn't exist: You're creating new, proceed
```

**If the file exists:**
1. Read the entire file
2. Understand what's already implemented
3. Check if your task is to:
   - **Add** to it (implement a new endpoint in existing routes.py)
   - **Fix** it (bug report points to this file)
   - **Refactor** it (BRIEFING.md says "restructure routes.py")
4. Only modify what's needed for your task—don't rewrite existing working code

**If the file doesn't exist:**
1. Create it from scratch
2. Follow the patterns from reference files listed in BRIEFING.md (e.g., "5. src/auth/api/login.py  # pattern reference")

---

## Step 5: Understand the Feature's Current State

Features progress through phases: Spec → Architect → Design → Implementation → QA → Review

Check the feature spec's `## Links` section to see what's already done:

```markdown
# From specs/auth/F-001-login.md:

## Links
- **Status**: IMPL_COMPLETE  ← feature is past spec/architect/design phase
- **Architecture**: specs/_shared/ARCHITECTURE.md  ← exists
- **API Contracts**: specs/auth/api-contracts.md  ← exists
- **Data Model**: specs/auth/data-model.md  ← exists
- **Design Screens**: design/auth/screens/login.html  ← exists
- **Implemented In**:
  - src/auth/api/routes.py (backend)
  - src/auth/web/LoginForm.tsx (web)  ← web is done
  - ❌ mobile not started yet  ← mobile is your job
```

**Extract:**
- What phase is the feature in? (Spec approved? Architecture done? Implementation in progress?)
- What platforms are done? (API implemented? Web implemented? Mobile pending?)
- Are there existing test cases? (Check `qa/{module}/F-{id}/` directories)

**Adjust your work accordingly:**
- If api-contracts.md exists → read it, implement exactly what it specifies
- If design screens exist → read them, match the visual exactly
- If other platforms are implemented → read them for patterns (e.g., web uses Zod, mobile should too)

---

## Step 6: Execute Your Task (Not Before)

Only now, after Steps 1-5, begin your actual work:
- Write files listed in BRIEFING.md `## Write to`
- Follow conventions from reference files
- Stay within scope (don't implement features beyond your ACs)
- Run tests if your agent type supports it (backend-agent, web-agent, mobile-agent)

### Tool Usage (MANDATORY)

You MUST use Claude Code's built-in tools to create and modify files. Do NOT use XML tags, markdown code blocks, or any other format to represent file writes. Use these exact tools:

- **Write** — Create new files or completely rewrite existing ones. Use `file_path` (absolute path) and `content` parameters.
- **Edit** — Modify part of an existing file. Use `file_path`, `old_string`, and `new_string` parameters.
- **Read** — Read file contents. Use `file_path` parameter.
- **Bash** — Run shell commands (mkdir, npm, git, tests, etc.). Use `command` parameter.

**Create directories before writing files:**
```
Bash: mkdir -p specs/auth
Write: file_path=/absolute/path/specs/auth/F-001-login.md, content=...
```

**NEVER do this:**
- ❌ `<write_file>` or `<read_file>` XML tags — these are NOT real tools and will silently fail
- ❌ Showing file content in a code block and saying "I created this file" — you did not
- ❌ Describing what you would write without actually calling the Write tool

**If a file write fails:** Report it in your summary as a blocker. Do not claim DONE if files were not created.

---

## Step 7: Return Structured Summary

**The return contract lives in `.claude/agents/_completion-protocol.md`. Read it before
you return — it is the single source of truth and this file does not restate it.**

The shape in brief: a short human-readable markdown summary, then the mandatory
`---METRICS---` YAML block as the very last thing in your output. The
orchestrator routes on `status:` from that block; the Layer-1 hook parses the
rest into the dashboard. A return without the block cannot be routed.

Do not invent a return format. Do not copy a format from another agent's
transcript. Open `_completion-protocol.md`.

---

## Common Mid-Project Scenarios

### Scenario 1: You're mobile-agent, web is already done

```markdown
# BRIEFING.md says:
**Module:** auth
**Feature:** F-001 (login)
**Context:** Backend and web are complete. You're implementing mobile.

# What you do:
1. Read specs/auth/F-001-login.md  ← ACs, requirements
2. Read specs/auth/api-contracts.md  ← API to call
3. Read src/auth/web/LoginForm.tsx  ← See patterns (Zod validation, error handling)
4. Read design/auth/screens/login-ios.html  ← Visual target
5. Implement src/auth/mobile/LoginScreen.tsx  ← Your work
6. Match web's patterns (same Zod schema, same error messages)
```

### Scenario 2: You're qa-web-agent, implementation is done

```markdown
# BRIEFING.md says:
**Phase:** execute
**Context:** web-agent completed implementation. Run your test automation.

# What you do:
1. Read qa/auth/F-001/web/TC-W001-*.md  ← Test cases (you wrote these in phase=author)
2. Read qa/auth/automation/e2e/tests/login.spec.ts  ← Your automation (you wrote this)
3. Run: npx playwright test qa/auth/automation/e2e/tests/login.spec.ts
4. If tests fail → file bugs in qa/_shared/bugs/
5. If tests pass → return PASS
```

### Scenario 3: You're reviewer-agent, everything is "done"

```markdown
# BRIEFING.md says:
**Task:** Review F-003 (password reset) before human sign-off

# What you do:
1. Read specs/auth/F-003-password-reset.md  ← ACs
2. Walk qa/auth/F-003/{api,web,mobile}/  ← Check every AC has test cases
3. Check src/auth/api/routes.py  ← Validate no hardcoded secrets
4. Check design/auth/screens/password-reset.html  ← Validate testid coverage
5. Run C1-C14 checks (spec quality, coverage, contracts, data, code, docs, security, ops readiness, doc-sync, scope boundary, design render, suite-can-fail, declared elements, testid contract)
6. Return STRUCTURAL-PASS or STRUCTURAL-FAIL with issues
```

---

## What NOT to Do (Common Mistakes)

❌ **Don't assume greenfield:** Always check what exists before creating.
❌ **Don't read files not in BRIEFING:** Scope creep wastes tokens and time.
❌ **Don't hallucinate file paths:** Use Bash ls or Glob to verify paths.
❌ **Don't skip validation:** If BRIEFING references module `posts` but specs/posts/ doesn't exist, stop and report error.
❌ **Don't rewrite working code:** If routes.py has 5 endpoints and you're adding a 6th, don't regenerate the other 5.
❌ **Don't ignore existing patterns:** If web uses React Hook Form + Zod, mobile should too (unless spec says otherwise).

---

## Validation Checklist (Before Returning)

Before submitting your completion summary, verify:

- [ ] All files in BRIEFING "Write to" section created/modified
- [ ] No files outside your scope touched
- [ ] If you modified existing files, changes are minimal and scoped
- [ ] Tests run (if your agent type supports it)
- [ ] All ACs assigned to you are covered
- [ ] Structured summary includes: Status, Files, Validation, AC Coverage, Drift, Next Steps
- [ ] If you noted drift, you documented what was expected vs what you found

---

## Emergency Fallback

If BRIEFING.md is missing or corrupt:

```
Return: ERROR - BRIEFING.md not found or unreadable.
        Orchestrator must write BRIEFING.md before dispatching agents.
        Refusing to proceed without briefing.
```

Never proceed without a valid BRIEFING.md. Do not fall back to reading MANIFEST + STATUS + TASKS yourself—that's the orchestrator's job.

---

**This protocol is MANDATORY for all specialized agents.**
Orchestrator: Ensure every agent's prompt includes "Read .claude/agents/_startup-protocol.md and follow it exactly."
