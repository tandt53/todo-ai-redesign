# Ownership notes — the provenance MANIFEST no longer has room for

`MANIFEST.md ## Ownership.writers` is capped at 350 lines and the cap is real: a
map nobody finishes reading is a map nobody enforces. The reasoning behind two of
its grants lives here instead, unabridged. **The map itself stays in MANIFEST** —
this file explains, it never grants.

## `.claude/` — orchestrator, added 2026-08-18

The pipeline's own tooling is owned by no agent, and the orchestrator is the party
that runs `upgrade-project.sh` — so template-synced files land here under its
name. **This is not authorship.** The source of truth for everything under
`.claude/` is `claude-agents-final/templates/project-starter/`, and a fix made
HERE is erased by the next upgrade. Fix upstream, then sync.

The grant exists because C6 cannot express *"synced, not written"*, and because
the alternative was recording the sync against an agent that did not do it. The
Drift Log already carried two such edits with nowhere to attribute them.

## `{src}/` and `{tests}/` — orchestrator, added 2026-08-24

The owner's call, and the one entry in the map that describes the **session**
rather than the work. This session cannot dispatch sub-agents unless the owner
asks per task, so an implementer's work either lands under the orchestrator's
name or does not land at all. Asked to choose between recording that truthfully
and leaving the map narrow, the owner chose the map ("b", 2026-08-24).

Two things it does not mean. It is not licence to take work from an agent that
could have had it. And it does not dissolve `.claude/state/SANCTIONS.md` — a
crossing made while an agent WAS dispatchable still belongs in the register.

**Narrow this back the day dispatch returns.**

## RESTORE rights, and the one-off grant that became SANCTIONS.md

The orchestrator is the only party that can see one agent destroy another's
uncommitted work (T-076: a mutation-check restore reverted the copy catalogue by
57 lines, and 19 tests failed pointing at the parser instead of the cause). That
grant is for RESTORATION, never authorship; C6 cannot express the distinction, so
it is stated for a human to hold the orchestrator to.

T-121 was the one-off cross-subtree grant that preceded the register: a change
that had to land as a single unit, because splitting it would have left Today
defined twice. That gap is closed by `.claude/state/SANCTIONS.md` (T-282) — one
exact task+agent+path triple per row, read by C6, printed as `sanc` and never as
`ok`. **Prefixes license nothing.**
