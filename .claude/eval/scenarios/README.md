# Eval scenarios — pre-merge regression for prompt files

These are **prompt-eval scenarios**: tests that validate the agent / protocol /
orchestration Markdown files are internally consistent. They are not tests of
your product — they are tests of this template's own prompts.

Run them before merging **any** change to `agents/*.md`, `ORCHESTRATION.md`, or
`hooks/*.sh`:

```bash
bash .claude/eval/scenarios/run-scenarios.sh        # all of it, < 1 second
bash .claude/eval/scenarios/run-scenarios.sh R3 R5  # specific scenarios
```

## Why this exists

Prompt files fail silently. If an agent is told to read
`agents/_qa-foundations.md` and that file was renamed, the agent reads nothing,
raises no error, and simply produces worse output — you find out weeks later
from a bad test suite. Nothing in a normal CI run catches that. These scenarios
do, for free.

## What ships today

Everything here is **R-tier**: no `claude` CLI, no network, no API cost, about a
second for the whole suite. That keeps it cheap enough to run on every commit.

## Proving the checks can fail

```bash
bash run-scenarios.sh mutation        # all cases
bash run-scenarios.sh mutation R5 R9  # selected scenarios
```

A green suite tells you the checks did not fire. It does not tell you they
*can* fire. Three times in this template a check reported PASS while doing
nothing:

- **R9** stayed green while the shell task reader returned zero rows. It
  compared column-name declarations across four parsers, and those agreed
  perfectly while one parser was blind.
- **R5** reported "all quoted C-ranges agree" while its dash pattern was a
  bracket class containing a multibyte character, so it could not match an
  en-dash — most of the references it claimed to check.
- The design checker silently dropped the last CSS variable of every `:root`
  block, because its regex required a trailing semicolon.

All three are one defect: comparing declarations instead of exercising
behaviour. `mutation-test.sh` breaks exactly one thing each scenario claims to
catch and requires that scenario to fail. A case that does not fail is the
finding.

**Adding a scenario means adding a case there.** A scenario with no mutation
case is unproven, and unproven is not the same as passing.

## What each scenario catches

R1–R7 are static analysis (grep / awk / file existence) — they check that files
agree with each other. **R8 and R9 are different: they execute the real thing**
and assert on its output. That distinction matters, because the three defects R8
was written for were invisible to static checks: every file involved was
internally consistent and the thing still did not work. When you add a scenario,
ask which kind you need — agreement between files, or evidence that something
actually runs.

R9 does both, and the executable half is the important one: it runs
`validate-state.sh` against a deliberately broken queue and requires a non-zero
exit. A validator that always passes is worse than no validator, because it
certifies whatever it is handed.

| Scenario | Catches |
|----------|---------|
| **R1** | An agent name that no longer resolves to a file — renames with missed callers, or names copied in from a sibling template. Also fails on a new `*-agent.md` not registered in R1's inventory, which forces the pipeline table to be reconsidered. |
| **R2** | Broken/missing YAML frontmatter, or a `name:` that drifted from the filename. |
| **R3** | A `_protocol.md` reference that resolves to nothing, and any QA agent that stopped requiring `_qa-foundations.md`. |
| **R4** | Machine-specific absolute paths (`/Users/...`) hardcoded into a prompt instead of resolving through `MANIFEST.md ## Paths`. |
| **R5** | The reviewer's C-check range quoted inconsistently. Derives N from the `### C<n>` headings in `reviewer-agent.md` and fails any file quoting a different bound. |
| **R6** | A shared protocol no agent reads. Dispatch passes only the agent file + BRIEFING, so a protocol nothing references is dead — the agent silently loses that discipline with no error. |
| **R7** | The return contract disagreeing across its three parties: the agents that emit it, `ORCHESTRATION.md` that routes on it, and `capture-agent-metrics.cjs` that parses it. |
| **R8** | A dashboard build that reports success while emitting a page with no data. Runs the real `generate-dashboard.sh` against fixture metrics in a temp dir and asserts the payload survives into the HTML. |
| **R11** | A design check that certifies whatever it is handed. Runs the real `check-design.mjs` against mockups built to break it — a token drifted from `tokens.json`, a variable the tokens file never declared, content wider than a declared breakpoint, a state switcher that changes nothing, a duplicate testid, a testid never visible in any state — and requires each to be reported. Also pins the no-browser path: an unlaunchable browser must degrade to a skip, because a checker that crashes without one breaks every review for a reason unrelated to the code. |
| **R12** | A test suite that satisfies coverage while verifying nothing. Builds two projects differing only in their tests — one asserting on outcomes, one calling the same functions and asserting nothing — and requires the tool to pass the first and fail the second. Also pins the guards: the working tree must come back, a dirty tree must abort, and a red baseline must be reported rather than counted as detection. |
| **R13** | A field declared in a spec's `## Data` table and then never constrained by an AC, recorded as an Open Question, or excluded. Nothing else in the pipeline looks for it: the implementer invents a behaviour, QA writes from the spec so never covers the omission, and C2 reports full coverage. Fixtures pin both directions — an accounted spec must pass, and a field parked in Open Questions must count, or the only way to satisfy the check would be to fabricate a decision. |
| **R14** | The implementation quietly dropping a testid the mockup declared. design-agent declares the catalogue, the implementer applies it, QA builds selectors from it — nine files describe that contract and nothing checked it. The symptom points elsewhere: a dropped id surfaces as a selector that will not resolve, reads as flakiness, gets quarantined. Also pins that an *extra* testid is a note rather than a failure, so implementers are not pushed to strip hooks the design has not caught up with. |
| **R9** | The state contract disagreeing across its four parties: `TASKS.md` declares the columns, `ORCHESTRATION.md` selects by field index, `validate-state.sh` enforces C1–C5 against the same indices, and `server.cjs` renders them. Reordering a column without updating every parser fails silently — every task reads as PENDING and "next" dispatches the same one forever. Also pins the caps in `MANIFEST ## Limits` to values the shipped template actually meets, guards the seed copy against drift, and executes the validator against a broken queue to prove it can fail. |
| **R10** | Concurrent-write hazards the template creates for itself: more than one agent told to write the feature spec's `## Links` block, or agents told to treat the single-slot `BRIEFING.md` as their contract while six of them run in parallel. |
| **R15** | Gate 1's multi-lens review degrading into a formality: a lens that lost its `review-spec` section, a lens that can pass by saying nothing, a lens with no boundary telling it which artifacts do not exist yet, or an orchestrator that skips the free static check before spending four dispatches. |

Every scenario here was written against a real defect found in this template:
a leaked `test-cases-agent` reference (R1), a dead `_agent-comms.md` link (R3), a
`C1-C8` quote left behind when C9 was added (R5), five protocols that zero agents
referenced (R6), a `---METRICS---` contract that no agent emitted — so every
dispatch reached the dashboard as `status: unknown` (R7), and a static dashboard
build that substituted a placeholder absent from the template, emitting a
byte-identical copy of the page while printing "3 dispatches loaded" (R8).

## When a scenario fails

Don't merge the prompt change. The scenario telling you what is wrong is the
point of having it. If the failure is the *scenario's* bug rather than the
prompt's, fix the scenario — but every red is a stop signal.

## Adding a scenario

1. Write `tests/R<n>-short-name.sh`. Exit 0 = PASS, 77 = SKIP (environment
   problem, not an agent problem), anything else = FAIL.
2. `source ../lib/assert.sh` and use its helpers; end with `pass_or_fail "R<n>"`.
   If the scenario runs anything, do it in `mktemp -d` with a `trap` cleanup —
   a scenario that writes into the project it is checking is a scenario nobody
   will run twice. R8 is the worked example.
3. Add the ID to the `R)` line in `run-scenarios.sh` and a row to the table above.
4. **Negative-test it.** Copy `.claude/` to a scratch dir, inject the bug the
   scenario is supposed to catch, and confirm it goes red. A scenario that has
   never failed is a scenario you have no reason to trust.

Reach for a scenario that actually dispatches `claude` only when the behavior
genuinely cannot be validated statically — those cost minutes and money, and
this suite's value comes from being cheap enough to never skip.
