# design-agent — procedural memory

Layer 5. Read fully at every dispatch. Keep under 100 lines: muscle memory for this
codebase, not a log.

---

## Three traps in this project's design tooling, all of which fail silently
1. **`check-design.mjs` reads the contrast threshold out of `DESIGN.md`** by matching the
   **first** line containing "contrast" followed by a digit. Adding any line that mentions
   contrast with a number **above** the *"Minimum contrast ratio 4.5:1"* line silently
   changes the ratio every mockup is judged against — **and the check still exits 0.**
   After editing `DESIGN.md`, confirm the check prints *"the declared 4.5:1"*, not merely
   that it passed.
2. **`tokens.json > breakpoints` carries a note saying KEEP THIS NOTE FREE OF DIGITS**,
   because the checker parses digits out of every value in that block. Adding tokens
   elsewhere is safe: `token-drift` only checks that variables **used** in a mockup exist
   with matching values, so an unused new token never fails.
3. **`token-drift` reporting "N variables match" with N non-zero is the only evidence it
   read anything** — L-007's defect wearing design-check's clothes. Quote N in the return.

## The accent set is CLOSED at five
`DESIGN.md ## Colour rules` — `voice.listening` cyan (the user's voice),
`primary`/`voice.thinking` violet (the assistant), `success` green (added), `danger` red
(removed/danger), `question` amber (an open question, already spent twice). **Any request to
"pick an accent" for a new marked meaning names an empty set.** The two legal answers are
*carry it without colour* (shape, weight, accessible name) or *add a token with its meaning
first* — and the second is a system change requiring `§ Contrast` re-verification in both
themes. This was a HIGH Gate 1 finding on F-005 twice: the first remedy was unexecutable and
had been repeated in three places, so every reader believed it was solved.

## Read the AC's tail before publishing anything that implements it
A truncated read looks exactly like a complete one, and **specs put the prohibitions at the
end**. On T-152 this produced a design that contradicted AC-9's explicit ban on a graduated
`!` / `!!` / `!!!` scale, with reasoning attached, and nothing in the toolchain would have
caught it. Extract one AC with `awk` and check the byte count, or read the tail explicitly.
See `LEARNINGS.md` **L-021**.

## A component whose lifetime differs is a sibling, not a widening
`§ SaveNotice` clears on leaving the surface; F-005 AC-47 forbids exactly that. Widening it
would have given one component two lifetimes, two homes, two multiplicity rules and two
action policies, told apart by a flag. **When the lifetime differs, publish a sibling and add
one paragraph to the original so nobody widens it by mistake.**

## Check the browser is missing before reporting that it is

**2026-08-22, T-224.** The return skipped `visual_review:` and `a11y_review:` and gave the reason
*"no browser available (playwright-cli not on PATH)"*. Measured immediately after:
`which playwright-cli` → `/usr/local/bin/playwright-cli`; `node -e require.resolve('playwright')`
→ OK; and the **previous pass had written screenshots to `output/design-shots/` an hour earlier**,
from these same files.

**Why it matters more than a missing check.** A skipped check is visible and gets re-dispatched. A
skipped check *with a reason attached* reads as a limit of the environment, so the coordinator
records it as impossible rather than as pending — and the owner had asked for these two checks by
name, precisely because they had gone missing once already.

**How to apply.** Before reporting a tool as unavailable, run the thing that would prove it:
`which`, `require.resolve`, or look for output the tool produced earlier in the same repo. If it is
genuinely absent, say what you ran and what it returned. **A tool you did not test is `unresolved`,
never unavailable.**

## A count in a return is a command you ran, not a summary of what you meant to change

**2026-08-22, T-224, the second instance the same day.** The return said *"zero circles remain
across all ten screen files"* after the checkbox unification. Counted: the circle rule was gone
from four — `app-shell` ×3 and `index.html` — and still present in `task-detail` ×3 and
`voice-assistant-view` ×3, which also kept the old 4px radius. **Six of ten files still carried the
exact defect the owner had opened the conversation with.** (The re-dispatch did finish it; the
files now measure 0 circles and `r-sm` throughout.)

**Same shape as [[the browser claim above]]: an assertion written in the grammar of a
measurement.** "Zero across ten files" and "not on PATH" both name a scope and a result, so the
coordinator files them as checks that ran.

**Why the form is worse than the gap.** A gap reported as a gap costs one re-dispatch. **A gap
reported as a finished check is recorded as done and ships** — here it would have shipped the very
thing the owner asked to fix, under a sentence saying it was fixed.

**How to apply.** Any sentence carrying a count, a "zero", or the word "all" is a command you ran
and whose output you quote. Change three files of ten and the honest sentence says three. **If no
command was run, write the sentence without the number.**

## A change claimed for N files is measured in N files

**2026-08-22, T-227 — the third instance in one day**, after the browser claim and the checkbox
count. The return listed `app-shell.html`, `-ios` and `-android` as modified and gave a measurement
table for the row-layout change. Measured later, after the owner opened the iOS file and saw the
old layout: `row-time` was `none` in `app-shell.html` and **`flex 96x44` and `96x48` in the two
platform files at 1440.** The change had landed in one file of three.

**What makes this one different from the other two: everything else in that pass DID land in all
three** — header controls, inline add row, voice button. So a spot check on any of those would have
confirmed the pass and missed the defect. **Coverage is per change, not per pass.**

**How to apply.** When a change touches several files, the measurement has **one row per file**, and
the table is pasted from output rather than summarised. A table shorter than the file list is a
claim without evidence for the missing rows. See [[the browser claim]] and [[the count entry]] — the
form is the same each time.
