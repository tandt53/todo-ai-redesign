# Stack Detection Protocol (shared by all implementation agents)
<!-- Include this logic in every implementation agent -->

## How to Detect the Project Stack

### Step 1 — Read MANIFEST.md `## Stack` field
This is the authoritative source. The orchestrator fills this in on first run.

### Step 2 — Read MANIFEST `## Paths.platform_docs`/{web,mobile,backend}.md
Full conventions, libraries, patterns, and constraints for this specific project.
Canonical filenames: `web.md`, `mobile.md`, `backend.md`. Never `api.md`.
If the file does not exist: **stop and return BLOCKED to the orchestrator — architect-agent must create it.**

### Step 3 — Verify against existing code
If the source root (resolve from MANIFEST `## Paths.roots.src`) already has code, read 2–3 existing files to confirm actual patterns used.
Follow existing patterns even if they differ from what you would choose — consistency beats preference.

### Step 4 — If stack is ambiguous or missing
Do NOT guess. Return BLOCKED to the orchestrator with a one-line reason ("missing platform_docs/web.md" or "MANIFEST stack field empty"). Never invent a stack.
