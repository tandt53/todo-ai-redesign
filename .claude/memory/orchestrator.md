
## 2026-08-23 — Write the archive file BEFORE trimming the queue, and verify it landed

Ran the DONE-row cap down by taking the 38 oldest DONE rows, and the validator went from
3 violations to 31 — 28 of them "T-109 depends on T-108, which is not a task in this
queue".

**The first diagnosis was wrong, and worth recording because it was plausible:** that C3
resolves `Depends` against `TASKS.md` alone, so archiving a referenced row breaks the link
— which is what the 2026-08-18 STATUS note predicted and what T-149 was filed to fix.
**T-149's fix is already in place.** `validate-state.sh:193-196` builds `ALL_IDS` from
`TASKS.md` UNION `TASKS-archive.md`. Archiving by age is safe.

The actual cause was mechanical: **one script removed the rows from `TASKS.md` and
truncated `TASKS-archive.md` in the same run**, and crashed between the two writes. The
rows existed nowhere. The rule is ordering, not selection: **append to the archive first,
read it back and assert every id landed, and only then trim the queue.**

The generalisable half is the diagnosis, not the crash: a failure that matches a known,
documented tension will be attributed to that tension. Check whether the documented fix is
already in the code before re-deriving the theory it came from.

## 2026-08-23 — Two different `split('|')` offsets in the same session, and the bug was silent

`line.split('|')` on a full row puts **ID at [1]**, Depends at [7], Status at [8].
`re.match(r'^\| T-\d+ \|(.*)$').group(1).split('|')` puts **Title at [0]**, Status at [6],
Artifacts at [7], Outcome at [8].

Both were used within ten minutes. Comparing `cell(l,2)` — Title — against a set of task
IDs made **every one of 88 rows look like a leaf**, and the script reported "leaves: 88"
in a tone of complete confidence. Nothing errored.

Use `.claude/lib/tasks.sh` / `tasks.cjs`, which resolve columns by header name. That reader
exists because three hand-rolled copies of "Status is field 9" broke silently once before;
writing a fourth by hand in a throwaway script is the same mistake wearing a smaller hat.

## 2026-08-23 — A grant mechanism must be built to be narrow, and proved narrow

Two C6 violations stood all day because both were **true**: an implementer had written a
file under `{tests}/`, and the three ways to make the check pass were to widen that
agent's map permanently (the one crossing most worth keeping closed), to move the citation
to an agent that did not do the work (a false record), or to leave the gate red forever.

The fourth option was to give the check a way to say *sanctioned once* — which MANIFEST
had already identified as the missing thing, in those words.

**What made it safe is not the register, it is what the register refuses.** One exact
`task + agent + path` triple per row. A prefix licenses nothing: `tests/` does not cover
`tests/auth/a.spec.ts`, because a mechanism that accepts prefixes is a mechanism that
licenses trees. A grant naming the wrong agent licenses nothing. A grant whose task no
longer names that path **fails** rather than lingering, because nobody removes a row that
costs nothing to leave. And a sanctioned crossing prints as `sanc` and is counted in the
verdict line — never as `ok`, because a grant that reads like a pass is how the next one
gets issued without anyone deciding to.

All six properties are asserted by scenario, each made to fail first. **Two of this repo's
own recorded hazards were walked straight into while building it:** matching `T-[0-9]+`
drops lettered sub-tasks (R9 says this has bitten the queue twice — it would have turned a
granted sanction into an unexplainable violation), and `OUT="$(validator)"` under `set -e`
**aborted the scenario mid-block while the suite still printed PASS for the checks that had
already run.** That second one is the shape of every green-over-broken finding this project
has hit: the harness did not lie, it stopped, and stopping looked like success.

The rule: when you build the thing that lets a check be bypassed, spend the effort on the
bypass's *limits*, and prove each limit by breaking it. The permissive case works by
construction; only the refusals need evidence.

## 2026-08-23 — An artifact list is a claim about the present, not a record of the past

C1 failed on T-278: it named `src/assistant/mobile/components/VoiceFab.tsx` and the file
was gone. Both halves were correct — that row really did edit the file in the morning
(setting the FAB's accessible name to "Talk"), and a later row really did delete it in the
afternoon when the owner retired the control.

The check is right and so is the history. What is wrong is putting one in the other's
column. **`Artifacts` means "go and look at these", and C1 tests exactly that.** A file
that existed when the work was done and was retired later belongs in `Outcome`, as prose,
where it stays a true record without being asserted as a live path.

The fix is one line and the rule is general: **when a later task deletes a file an earlier
task claims, move the path into the earlier row's account and leave the surviving paths in
its list.** Do not delete the sentence — the work happened — and do not weaken the check to
accept absent files, which would cost every other row its existence guarantee to spare one.

Same shape as the sanction register: a check that cannot express a legitimate history is
fixed by recording the history somewhere the check does not read, not by teaching the check
to accept anything.
