# Review Protocol (shared by every review lens)

<!-- Read by any agent dispatched with `phase: review-spec` or `phase: review-design`. -->
<!-- Defines the lens contract, the finding format, and what each gate cannot assess. -->
<!-- The orchestrator's half is ORCHESTRATION.md "Gate 1" and "Gate 1.5". -->

**Two gates, one contract.** At **Gate 1** several agents read the same feature
spec; at **Gate 1.5** several read the same design. In both, each asks only the
questions its role is qualified to ask, and in both you produce **findings, not
artifacts** — you write no files at all.

Everything below applies to both unless a section names one. The section
`## Reviewing a design` is the only part specific to Gate 1.5.

This exists because a spec reviewed from one angle ships defects that the other
angles would have caught for free. Measured on a real run: five requirement
defects reached implementation, and each cost a full dispatch to discover — a
missing capped-fee flag, a missing member-lookup endpoint, an AC naming two of
four error codes, an unspecified fixture-seeding contract, and an AC that was
only assertable once rewritten as a prohibition. Every one of them was visible in
the spec.

---

## What exists at Gate 1 — and what therefore does not

**The feature spec is the only artifact.** There is no mockup, no api-contracts,
no data model, no code. They are produced *after* this gate.

You may assess:

- whether an AC is deterministically testable
- whether an AC forces an implementation that contradicts a platform rule
- what data, fields or endpoints an AC requires that do not exist yet
- how many distinct screen states an AC implies

You may **not** assess, and must not comment on:

| Not yours at Gate 1 | Already checked at Gate 2 |
|---|---|
| testid contract conformance | C14 |
| mockup state coverage | C11 |
| endpoint ↔ handler agreement | C3 |
| documentation currency | C9 |
| whether the tests pass | C5 |

A finding about an artifact that does not exist yet is noise, and noise is what
makes a review gate get switched off. If you catch yourself writing "the mockup
should…", stop — that belongs to design-agent's own dispatch, not to your review.

---

## Reviewing a design (`phase: review-design`)

**What exists at Gate 1.5:** the feature spec with its ACs, the design system
(tokens, component inventory), and the screens or component entries this dispatch
produced. **What does not:** code, tests, and any implementation of the contracts
the design implies.

**Why this gate exists at all.** Before it, a design went straight from its author
to the implementers. The spec got a lens for every role that would consume it —
Gate 1 reads that set off the AC platform tags, so a spec tagged for three
platforms gets more lenses than one tagged for a single one. The design got
none. The code got sixteen deterministic checks. That is backwards
against cost — a design defect is cheapest to fix before anyone builds against
it, and the design is where a large share of a feature's consequential decisions
are actually made.

**The lenses are the design's consumers, and that is the rule rather than a list.**
The implementer builds it, QA writes tests against it, and the spec is the
contract it has to satisfy. Anyone who has to *act* on the drawing is qualified
to say whether they can.

- **dev lens** — can this be built? Does it need data, a field or a state the
  system cannot produce? Does it contradict a platform rule?
- **tester lens** — are the states enumerable and reachable? Is there a stable
  way to address each element? Can an assertion about this actually fail?
  **Read the edge table against the IA**: an edge listed there with no control
  drawn is a screen the user cannot leave, and it looks like nothing in a mockup.
  **Read design's per-screen state list against the ACs**: a state the ACs imply
  and the list does not name is the gap this lens exists to find, and a state the
  list says was left out on purpose is a decision rather than an omission.
- **spec lens** — does every AC this design was briefed with have a drawn state,
  and does the design **assert a rule the spec does not contain**? The second
  half is the one nobody else is positioned to ask.

**design-agent is not a lens here.** It is the author, and an author reviewing
their own drawing is the self-consistency problem this gate exists to break.

**product-agent is deliberately not a lens here either.** Value judgement stays
at Gate 3, where the built thing can be judged rather than the picture of it.
The counter-argument is real — catching *"this does not deliver what was asked"*
at design time is far cheaper than at Gate 3 — and it is recorded here rather
than settled, so the owner can pull product in by changing the switch.

### What is out of scope at Gate 1.5

| Not yours here | Covered by |
|---|---|
| token drift, overflow, contrast, duplicate testids | `design-check`, which design-agent runs before returning |
| whether the mockup renders at all | C11 |
| whether the implementation honours the testid catalogue | C14 |
| whether the tests pass | C5 |

**Taste is out of scope, and the boundary is sharper than it sounds.** *"I would
have chosen a different colour"* is not a finding. *"This colour already means
something else in the system"* is — the first is preference, the second is a
rule the design breaks. If you cannot name the rule, you are reviewing taste.

### The rubric design-agent grades itself on — one lens grades it instead

design-agent renders its own screens and answers seven questions about them
(`design-agent.md`, `visual_review:`). That is worth doing and it is still
**self-assessment**: the author scoring its own work against its own reading of
its own intent.

**The dev lens re-answers them, from the returned screenshots**, and reports only
where its answer differs from design's. Not a re-review of everything — a
disagreement list. Two identical answers cost nothing; one difference is the
entire value of the pass.

Why the dev lens and not a new one: it is already reading this design in order to
build it, it already has the screenshots in the return, and the questions need no
design training to answer — they ask what a screen *does to a viewer*, which is
the one thing every reader is qualified on.

**Answer only where you disagree, and name the rule.** *"Question 4 — two signals
carry lateness here: the heading colour and the row badge"* is a finding.
*"Question 3 — I would not have chosen this"* is not; question 3 asks whether the
audience would wince, not whether you would.

If design's return carries no `visual_review:` block, that is itself a finding:
the screens were never looked at by anyone, including their author.

### The two failures this gate is aimed at

Both are drawn from a real run, and neither is visible in a spec:

1. **A design that asserts a rule no artifact contains.** Two rules once shipped
   living only in the mockups — a heading's colour and a title naming its
   collection. The drawing became the sole authority for both, which is the wrong
   way round: the spec should say it and the drawing should show it.
2. **Something true in the markup and invisible on screen.** A heading meant to
   mark missed work rendered identically to an ordinary date heading. Every word
   of the spec was satisfied and the point of the heading was not. A lens that
   reads the *rendered* output catches this; one that reads the file does not.

---

## The anti-theatre rule

**Return either findings, or an explicit list of what you checked and found
nothing on.** "Looks fine", "no concerns", or silence is a protocol violation,
exactly like omitting the `---METRICS---` block.

This is the one rule that decides whether this gate earns its cost. Four agents
reading a spec and agreeing it seems reasonable is pure expense. The checklist you
return when you find nothing is what proves the lens was actually applied — and it
is the thing a human scans to decide whether to trust the gate without re-reading
the spec themselves.

---

## Finding format

One entry per finding. Same severity vocabulary as product-agent, so orchestrator
routing does not change.

```yaml
findings:
  - id: F1                       # your own sequence, unique within this dispatch
    severity: HIGH               # HIGH | MEDIUM | LOW
    acs: [AC-2, AC-3]            # every AC this touches. Never empty.
    claim: >                     # one sentence: what is wrong
      The spec caps the late fee at the replacement cost but declares no field
      that reports whether the cap was applied.
    consequence: >               # what breaks downstream if it ships as written
      The client can only know it was capped by recomputing the fee, which
      platform/mobile.md forbids. Earliest catch is C12, after mobile is built.
    would_not_be_a_finding_if: > # REQUIRED — makes the finding falsifiable
      The spec's ## Data section declared a capped/uncapped indicator, or an AC
      stated that the client is not expected to distinguish the two cases.
    directive: >                 # the concrete change you are asking for
      Add a boolean the response carries, and an AC that constrains it.
```

**Length is part of the format.** `claim` and `consequence` are **one sentence
each** — the block above says so and it is routinely ignored. A finding that needs
a paragraph to state is usually two findings, or one finding plus reasoning that
belongs nowhere.

**A LOW finding carries `claim` and `directive` only.** Drop `consequence` and
`would_not_be_a_finding_if`. Something that changes nothing downstream does not
earn the falsifiability apparatus; if it does earn it, it is not LOW.

**`checked:` is a checklist, not prose.** One line per entry, no wrapping. Its job
is to prove the lens was applied and to let a human decide whether to trust the
gate without re-reading the spec. Twelve entries of three lines each does neither
better than twelve entries of one.

**Severity means pipeline effect, not how strongly you feel:**

| Severity | Meaning | Effect |
|---|---|---|
| HIGH | The named ACs cannot proceed to build as written | Blocks those ACs only. Others continue. |
| MEDIUM | Should be fixed before implementation; does not invalidate the direction | Recorded in the spec's open questions |
| LOW | Worth noting | Recorded in the spec's open questions |

`would_not_be_a_finding_if:` is not ceremony. A finding you cannot state a
disproof for is an opinion, and opinions are what turn a review gate into a
debate. If you cannot fill that field, drop the finding.

When you find nothing, return the checklist instead:

```yaml
findings: []
checked:
  - "Every AC names an observable that changes when the behaviour is wrong"
  - "Every error AC has an outcome visible from outside the system"
  - "Preconditions for AC-1..AC-4 are constructible from what the spec describes"
```

---

## The `## Impact` section is in scope for every lens

The spec's `## Impact` section — what this feature changes or breaks in the
features that already exist — **is reviewable by you, in your own lens's terms**,
and this is the one place the scope rule below does not narrow.

**Why it is everyone's and not a sixth lens.** An impact claim is a claim about
an existing artifact, and the lens qualified to check it is whichever lens owns
that artifact: the dev lens verifies claims about code, the architect lens claims
about contracts and stored records, the design lens claims about the existing
component vocabulary, the tester lens claims about what the current suites
assert, the product lens claims about a shipped feature's promises. A dedicated
impact lens would duplicate all five and hold no competence of its own.

**And it is the section most likely to be wrong while looking finished.** It is
written by the one agent that has read the new spec most and the old artifacts
least. Three ways it fails, each of which is a legitimate finding:

- **A claim that is simply false** — the cited file does not say that, or the
  line moved.
- **A claim that is true and incomplete** — it names two call sites and there are
  thirteen. Incompleteness here is worse than error, because the section reads as
  a considered answer.
- **An impact silently settled** rather than raised — where the consequence
  forces a product decision, the section owed the owner a question and gave
  itself an answer instead.

**A missing `## Impact` section is itself a HIGH finding** on any feature that is
not the first in its module. Do not treat its absence as "nothing to review".

---

## Scope discipline

- **Answer your own lens's questions.** Your agent file lists them. Do not review
  the spec generally — the other lenses are covering the angles you are not, and
  four agents producing the same generic feedback is the failure mode here.
  The `## Impact` section above is the deliberate exception: every lens reads it,
  each within its own competence.
- **Write nothing.** No files, not even the spec's `## Links` block. Findings go
  in your return.
- **Do not fix.** You report; spec-agent revises.
- **One round.** You are dispatched once per review round. If a re-review follows
  a revision, you will be dispatched again with the revised spec.

---

## Returning

Follow `.claude/agents/_completion-protocol.md` as normal — it is the only file
that defines the return block, and this one does not restate it. Put the findings
block in the prose half, and **add these four lines to the standard
`---METRICS---` block**, alongside the fields the contract already requires:

```yaml
lens: tester             # tester | dev | architect | design | product
findings_high: 1
findings_medium: 2
findings_low: 0
```

A review dispatch produces no artifacts, so `files_created` and `files_modified`
are `[]` and both test counts are `0`. That is expected, not a failed dispatch.

`acs_covered` is the ACs you examined, not the ones you flagged. If it is shorter than the AC list in the
spec, say why in the prose — a lens that silently skipped ACs is worse than one
that reports nothing, because it looks like coverage.

`status: BLOCKED` is legitimate here for exactly one reason: the spec is missing a
section your lens needs in order to review at all. Name the section.
