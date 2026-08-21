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
