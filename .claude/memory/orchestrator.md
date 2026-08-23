
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
