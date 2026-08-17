# BRIEFING — T-052: closing spec revision for F-002 talk-back

## Task
Revise `specs/assistant/F-002-talk-back.md` from **Gate 1 round 2**. This is the
**closing revision**. The round cap is 2 and it is reached: nothing re-reviews your output.
Write accordingly — where you are unsure, say so in the spec rather than leaving a reader to
discover it.

## Read these, in this order
1. `.claude/agents/_ethos.md`
2. `.claude/agents/_completion-protocol.md`
3. `specs/_shared/LEARNINGS.md`
4. `reports/gate1-review-F-002.md` — **the `# Round 2` section is your work order.** Clusters
   D1–D10, the MEDIUM/LOW table, and `§R-rec`'s five recovered round-1 findings.
5. `specs/assistant/F-002-talk-back.md` — the artifact you are revising (rev 2 → rev 3)
6. `specs/assistant/data-model.md` — D1 and product M-1 both land partly here
7. `design/_shared/components.md` — AC-22's frame catalogue lives here; D3 widens its slots

Per-lens returns are on disk at `reports/gate1-lenses/F-002/round{1,2}-{lens}.md` if you need
a finding's full reasoning. Do not re-read all fourteen; open one when the report's summary of
it is not enough.

## Order of work (architect's cost ranking, follow it)
**D1 first** — it disarms the fix every silence AC now depends on. Then **D2**, then **D3**,
then D4–D10, then the MEDIUM/LOW table, then §R-rec's five recovered findings.

## The one thing to understand before you start
Every one of round 2's 25 HIGH findings sits in the four ACs **revision 2 newly wrote**
(AC-18, AC-19, AC-21, AC-22). The shape is identical in all four: the AC was written to make
something falsifiable, and it asserts on a surface that does not exist — a log field not
declared in `## Data`, a module topology the shipped ports forbid, a lookup that must always
miss, a slot vocabulary narrower than the kind vocabulary opened in the same revision.

So the discipline for this revision is: **every assertion an AC makes must name a field that
`## Data` declares, or a seam the code has, or a slot `components.md` carries.** If it does
not, either add the field/seam/slot in this revision or delete the assertion. Do not write a
third layer of prose obligation over a surface that cannot carry it.

## Scope boundaries
- **No new server contract.** D2 is fixable entirely from fields already on the wire
  (`deleted_titles`, `created_titles`, `UndoResult`'s inline `{task_id, title}`).
- **D4 requires you to carve F-003 seam edits into `## Out of Scope`** — currently it forbids
  exactly the edits AC-19 needs. Name the three seams explicitly (`NativeSpeechModule` gains a
  category operation; `releaseAudioSession` moves to the arbiter; `controller.ts:101-103`'s
  subscription moves with it). The spec already did this in the opposite direction for the
  recognizer's language alignment — follow that precedent.
- **AC ids are never renumbered.** AC-8 stays retired-in-place. Round-1 and round-2 findings
  both cite ids; a renumber breaks every reference in two reports and fourteen lens returns.
- `design/_shared/components.md` — you may add rows for D3's widened slot vocabulary. Flag in
  your return that design-agent owns the frame wording so the orchestrator can route it.

## Three things you must NOT decide — leave them open, marked, and routed to the human
These are escalated and are **not yours to close**. Where an AC currently ships an answer to
one, mark it explicitly as pending an owner decision rather than silently keeping it:

1. **Is talk-back content or incidental sound?** (AC-7 + OQ1.) AC-7 currently suppresses on
   Android vibrate/silent/DND and picks iOS categories the ring/silent switch kills. Nobody
   chose that; round 1 asked only that the states be enumerated. Mark AC-7's suppression set
   as **interim, pending owner decision**, the way AC-4's answer to OQ1 is already marked.
2. **iOS Safari `gesture_required`: surface it or accept a silent failure?** Today the spec
   claims it is "surfaced rather than silent" and no AC carries that promise. Either way it
   resolves, **strike the unsupported word now** — do not leave a promise in prose that no AC
   carries. Record the open choice.
3. **May a spoken destructive confirmation omit the task titles?** Under AC-22's current slots
   "Xoá 3 việc?" names nothing, and F-001 AC-10/13 let the user answer by voice. Widen the
   slot vocabulary so the titled version is *expressible* (D3), but do not decide whether it
   is *required* — mark it pending.

## Return
Follow `_completion-protocol.md`. In the `---METRICS---` block, list under `links_to_record:`
any path you wrote — the orchestrator writes `## Links`, you do not. Also state in prose:
- which of D1–D10 you closed, and for any you could not, why
- any place you had to add a field to `## Data` or a slot to `components.md`
- anything you found that the seven lenses missed
