# BRIEFING — T-160 · F-005 architecture

- **Task ID:** T-160 · **Module:** assistant · **Feature:** F-005
- **Agent:** architect-agent · **Date:** 2026-08-19 · **Depends on:** T-159, T-157 (both DONE)
- **Project root:** /Users/tandt/projects/todo-ai-redesign

## What you are walking into

F-005 went through **three Gate 1 review rounds and four revisions** — 221 findings
across nine lenses. The gate is closed by owner decision. **You were one of those
lenses**, twice, and your round-3 return is in the read list: two of the findings you
raised are now settled in the spec because you named them as things nothing downstream
could catch.

The owner made an explicit split when closing the gate, and **it is the reason this
dispatch has more input than usual**:

> *A contradiction must be fixed in the spec, because only the spec can say which of its
> two sentences is true. **An unstated mechanism is what the architecture phase exists to
> state.** Making spec-agent invent answers means architect either inherits a guess or
> unpicks it.*

So revision 4 fixed 45 contradictions and **deliberately left 12 questions unanswered,
marked `Recorded, not answered` in `## API Touch Points`, in the lens's own words about
what is unknown.** Those are yours. They are not gaps in the spec; they are the spec
declining to pre-empt you.

## Read these first

1. `specs/assistant/F-005-task-detail.md` — 48 ACs, `## Data`, `## API Touch Points`
   (**the seven `Recorded, not answered` bullets are your work list**), `## Impact`'s
   fourteen subsections, `## Ops`, `## Test strategy`, `## Open Questions`.
2. `specs/assistant/api-contracts.md` and `specs/assistant/data-model.md` — what exists.
   F-005 changes both.
3. `specs/_shared/ARCHITECTURE.md` and `specs/_shared/adr/` — **especially `ADR-005`
   (session and dedupe scope is *the account*) and `ADR-009 § Amendment 2`** (the
   two-axis collection model F-005 sits on top of).
4. `reports/gate1-lenses/F-005-r3-architect.md` and `F-005-r2-architect.md` — your own
   findings, and which of them the spec answered.
5. `reports/gate1-lenses/F-005-revision-4-log.md` — what was fixed versus recorded, and
   why. Its `## What a reader should check first` section is written for you.
6. `specs/assistant/F-001-voice-assistant-view.md` — **AC-24 (rev 5) and AC-31 (rev 7)**,
   both amended *because* F-005 needed them. AC-31 rev 7 names two client predicates by
   path; the contract you write must not re-narrow either.

## The twelve, and the one that is largest

**The timezone is the big one — four lenses, and it lands on a hole ADR-005 did not
know it had.** AC-44 makes an account-stored `timezone` the single source every
date-computing path reads, and refuses a computation that has none. The spec records
three things it cannot settle:

- **No writer.** *"Refreshed from what the client reports"* names no door, and
  `req.timezone` rides `POST /assistant/turn` alone while the CRUD endpoints 400 on it.
- **No account record.** The dev lens measured the store: top-level keys are `sessions`,
  `turns`, `tasks`, `undo_records`, and auth is an `X-User-Id` header stub. **There is no
  account entity for a zone to live on** — while `ADR-005` already decided that *the
  account* is the scope for sessions and dedupe. That ADR's premise is now load-bearing
  and unbuilt.
- **The refusal is write-shaped and one use of it is a read.** AC-13's absent-flag
  resolution happens on every read of every row without a stored `due_all_day` —
  **measured: 0 of 790 rows carry one**, so on day one that is every row on every
  `GET /tasks`. Refusing the read means the list cannot render; falling back silently is
  forbidden by name in the same sentence. **AC-32 guarantees this surface works with zero
  AI calls while the assistant is erroring**, so a by-hand-only account must not be the
  account that cannot compute a date.

The other recorded items: **the 53 rows already soft-deleted with no `delete_membership`**
(18 accounts, all predating the field, and AC-41 makes them addressable); **where a
reordered step's prior position comes from** (AC-15 gives it two sources in one sentence
pair); **the client-side test-harness clock door** (AC-44 requires the harness to hold
both seams at one instant, and `/__qa__/advance-clock` is server-only — `window.__assistantSeams`
is the existing guarded precedent); **how the run count is derived** (AC-25 forbids a
stored counter and `## Data` records no completion event, so "completed at least once"
has no source once an occurrence is un-completed); **who may write `reminder_shown_at`**
(caller scoping, and whether a turn may set it — silently retiring a reminder the user
never saw); **how a set-valued recurrence member appears in a diff row** that declares
`old|null, new|null`.

## What to produce

Your own definition governs. In outline: `api-contracts.md` and `data-model.md` updated
for F-005, ADRs for the decisions that have real alternatives, and whatever platform-doc
changes follow. **Write an ADR wherever you choose between costed options** — the
timezone's home almost certainly earns one, and it may need to amend or supersede
ADR-005 rather than sit beside it.

## Three rules for this dispatch

1. **Do not re-open the spec.** Gate 1 is closed. If an AC is genuinely unbuildable as
   written, return **BLOCKED** naming the AC and why — do not amend it, and do not design
   around it silently.
2. **Answer the recorded twelve, or say explicitly which you are deferring and to what.**
   A recorded question that comes back unanswered has cost the project a full extra round
   for nothing.
3. **Never touch the spec's `## Links` block** — report paths under `links_to_record:`.
   Do not write `design/`, `qa/` or `src/`.

## Success criteria

1. Every `Recorded, not answered` bullet has an answer in a contract, a data-model entry
   or an ADR — or an explicit deferral with its owner named.
2. `AC-46`'s capture-before-apply ordering, which you called uncatchable-later, is
   expressible in the contract you write — the record-to-row mapping (successor →
   `created_ids`; cascaded step → snapshot / `post_apply`) is yours to state.
3. The contracts you touch stay consistent with **F-001 AC-24 rev 5 and AC-31 rev 7**.
4. Your return ends with `---METRICS---` and carries `memory_entry:`,
   `agent_memory_entry:` and `links_to_record:`.
