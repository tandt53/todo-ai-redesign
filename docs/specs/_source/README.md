# `docs/specs/_source/` — inherited requirements, verbatim and read-only

## What this is

Product requirements written for **`todo-ai`**, the existing app this project is a
redesign of. Copied here on 2026-08-17 at the owner's request, unchanged.

This repo has been **citing these documents since F-001** — `UC-20`, `UC-52 AC-52.18`,
`ADR-7`, `ADR-11` all appear in `docs/specs/assistant/` — while the documents themselves lived
only in the other repository. Every one of those citations was unresolvable from inside
this repo. That is what this directory fixes.

## Three rules, and the reasons

**1. Verbatim. Do not edit these files.** They are the other project's record, and this
copy is a mirror. Editing here creates a second home for one truth, which is `L-004`, the
failure this repo has hit more times than any other. If a requirement needs to change for
the redesign, **write that in `docs/specs/assistant/` and cite the UC** — the divergence then
has a place and a reason instead of being an invisible edit.

**2. They are in Vietnamese, and they stay in Vietnamese.** ADR-008 made the *product*
English. These are internal requirement documents, in the same category as `reports/`:
a record of what was decided and why. Translating them would destroy the reasoning while
gaining nothing — no user reads them.

**3. `ADR-N` here is NOT `ADR-00N` in `docs/specs/_shared/adr/`.** The two projects number ADRs
independently and the ranges overlap: this directory's `01-architecture.md` discusses
ADR-6, ADR-7, ADR-8, ADR-11 and ADR-12, while `docs/specs/_shared/adr/` holds ADR-001 … ADR-008
on entirely different subjects. **`ADR-7` and `ADR-007` are unrelated documents.**
When citing, write `todo-ai ADR-7` for the inherited ones and keep the zero-padded form for
this repo's own. F-001 already disambiguates once ("existing ADR-7"); F-002 does not, in
five citations — recorded as **T-066**.

## What is here

| File | What it holds |
|---|---|
| `02-use-cases.md` | **54 use cases** — the primary requirements source. UC-01…UC-20 are the conversational cases this repo has already built against; **UC-31…UC-39 are the manual todo operations that are missing from the redesign** (quick-add, complete, delete & restore, deadline/reminder pickers, priority, sub-tasks, search, recurring). Two are marked `ĐÃ BỎ` with dates — dropped deliberately, kept as record. |
| `01-architecture.md` | Architecture and the inherited ADRs (6, 7, 8, 11, 12) |
| `11-uc-conversation.md`, `13-uc-history-read.md` | Deep-dives on individual use cases |
| `04-feature-audit.md`, `10-ac-audit.md`, `12-mockup-audit.md` | Audits of coverage against the UC set |
| `03-ui-design.md`, `06-uiux.md`, `07-ui-research-mobile.md`, `09-design-nhom-I.md` | UI/UX design and research |
| `05-test-plan.md` | Test plan |
| `research-trien-khai-mobile-web.md` | Mobile/web delivery research |

## How to use them

A feature spec in `docs/specs/assistant/` should **cite** the UC it implements
(`F-001` already does: "UC-52 AC-52.18", "UC-20 AC-20.7"). The UC is the requirement;
the F-doc is this project's answer to it, and the two are allowed to differ — as long as
the F-doc says where and why.

**Do not assume a UC is still current.** These were written for the previous app; the
owner has since changed direction more than once (see `reports/owner-decision-*.md`).
A UC is evidence of what was wanted, not a standing commitment.
