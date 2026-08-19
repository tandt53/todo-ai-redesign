# architect-agent — procedural memory

Layer 5. Read fully at every dispatch. Keep under 100 lines: this is muscle memory
for this codebase, not a log.

---

## When a spec's refusal rule is write-shaped and a read needs it, split the rule
**Context:** an AC routes an absent value to a refusal defined for writes.
**Pattern/Lesson:** *"a refused write writes nothing"* has no referent on a read, and both
improvisations are bad — refuse the read (the list will not render) or fall back silently
(forbidden by name). The answer is that **a read withholds a derived value and never a
row**, carrying an explicit unknown on the wire (F-005: `due_all_day: null` = *not
determined*, and the client renders the due as a date with no clock time). Nothing is
guessed, and it fails in the direction the AC exists to protect. **Ask which direction the
unknown fails in — that is usually the whole argument.**

## When a value must have one source and several reporters, name one installer
**Context:** a field several channels can report (F-005's `timezone`: an `X-Timezone`
header and the pre-existing turn-body field).
**Pattern/Lesson:** name **one installer** called from the earliest shared point — here the
auth step, before routing — and route every channel through it. Two consequences worth
having in advance: a grep for the installer returns every door (**L-005's own remedy,
applied before the second door exists**), and the absent-value case becomes **unreachable
for any client that speaks the protocol** — which turned an unactionable user-facing
refusal into a client contract violation and closed a product finding for free.

## A set-valued field can be made scalar by canonical encoding
**Context:** a field the surrounding mechanisms assume is scalar.
**Pattern/Lesson:** sorted, de-duplicated, joined (`"mo,th"`, `"1,15,31"`) keeps
`taskEquals`'s `===`, `cloneTask`'s shallow spread and the declared `{old|null, new|null}`
diff-row shape untouched — so the snapshot-aliasing bug becomes **unreachable rather than
fixed**, and a document this feature does not own is met rather than amended. **Prefer
making a bug class unreachable over fixing it in four places.**

## An ADR whose premise is unbuilt is amended, not worked around
**Context:** ADR-005 scoped sessions and dedupe to *the account* since 2026-08-16, and the
store had no account entity. **Pattern/Lesson:** when a new feature needs the row an older
ADR has been reasoning about, the honest move is an ADR that **amends** it and creates the
entity — not a parallel structure that leaves two answers to "what is an account".
