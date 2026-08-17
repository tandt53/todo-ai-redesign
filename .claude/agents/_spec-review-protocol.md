# Spec Review Protocol (shared by every Gate 1 lens)

<!-- Read by any agent dispatched with `phase: review-spec`. -->
<!-- Defines the lens contract, the finding format, and what Gate 1 cannot assess. -->
<!-- The orchestrator's half of this is ORCHESTRATION.md "Gate 1". -->

At Gate 1 several agents read the same feature spec at the same time, each asking
only the questions its role is qualified to ask. You are one of them. You produce
**findings, not artifacts** — you write no files at all.

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

## Scope discipline

- **Answer your own lens's questions.** Your agent file lists them. Do not review
  the spec generally — the other lenses are covering the angles you are not, and
  four agents producing the same generic feedback is the failure mode here.
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
