#!/usr/bin/env bash
# Mutation sweep — proves each scenario can actually fail.
#
#   bash .claude/eval/scenarios/mutation-test.sh          # all cases
#   bash .claude/eval/scenarios/mutation-test.sh R5 R9    # selected scenarios
#
# Why this exists: three times in this template a check reported PASS while
# doing nothing.
#
#   - R9 stayed green while the shell task reader returned zero rows, because it
#     compared column-name declarations across four parsers and those agreed
#     perfectly while one parser was blind.
#   - R5 reported "all quoted C-ranges agree" while its dash pattern was a
#     bracket class holding a multibyte character, so it could not match an
#     en-dash — which is most of the references it claimed to have checked.
#   - The design checker silently dropped the last CSS variable of every :root
#     block, because its regex required a trailing semicolon.
#
# All three are the same defect: the check compared declarations instead of
# exercising behaviour. A scenario that has never been observed failing is not
# evidence of anything — it certifies whatever it is handed.
#
# Each case below breaks exactly one thing a scenario claims to catch, and the
# sweep requires that scenario to fail. A case that does NOT fail is the
# finding: it means the claim is unenforced.
#
# Adding a scenario without adding a case here leaves it unproven. Say so in the
# scenario's own header if you cannot write a case.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"   # the project-starter root

WANT=("$@")
want() {
  [ "${#WANT[@]}" -eq 0 ] && return 0
  local s
  for s in "${WANT[@]}"; do [ "$s" = "$1" ] && return 0; done
  return 1
}

PROVEN=0
UNPROVEN=0
declare -a UNPROVEN_LIST=()

# run_case <scenario> <description> <mutation-shell>
# The mutation runs with $T set to a throwaway copy of the template.
run_case() {
  local scenario="$1" desc="$2" mutation="$3"
  want "$scenario" || return 0

  local T
  T="$(mktemp -d)"
  cp -R "$TEMPLATE_ROOT/." "$T/" 2>/dev/null

  local test_script
  test_script="$(ls "$T/.claude/eval/scenarios/tests/${scenario}-"*.sh 2>/dev/null | head -1)"
  if [ -z "$test_script" ]; then
    printf '  ??    %-4s %s — no test script found\n' "$scenario" "$desc"
    rm -rf "$T"
    UNPROVEN=$((UNPROVEN + 1)); UNPROVEN_LIST+=("$scenario: no script")
    return 0
  fi

  # Sanity: the scenario must PASS before the mutation, or the case proves
  # nothing — a scenario already failing would "catch" any mutation.
  if ! ( cd "$T" && bash "$test_script" ) >/dev/null 2>&1; then
    printf '  ??    %-4s %s — scenario already fails unmutated\n' "$scenario" "$desc"
    rm -rf "$T"
    UNPROVEN=$((UNPROVEN + 1)); UNPROVEN_LIST+=("$scenario: red before mutation")
    return 0
  fi

  ( cd "$T" && eval "$mutation" ) >/dev/null 2>&1

  if ( cd "$T" && bash "$test_script" ) >/dev/null 2>&1; then
    printf '  MISS  %-4s %s\n' "$scenario" "$desc"
    UNPROVEN=$((UNPROVEN + 1)); UNPROVEN_LIST+=("$scenario: $desc")
  else
    printf '  ok    %-4s %s\n' "$scenario" "$desc"
    PROVEN=$((PROVEN + 1))
  fi
  rm -rf "$T"
}

echo "─── mutation sweep — each scenario must fail when its claim is broken ───"

A=".claude/agents"
S=".claude/eval/scenarios"

# R1 — an agent name that resolves to no file.
run_case R1 "reference to a nonexistent agent" \
  "printf '\nDispatch ghost-agent for this phase.\n' >> .claude/ORCHESTRATION.md"

# R2 — frontmatter name that no longer matches the filename.
run_case R2 "frontmatter name drifts from filename" \
  "sed -i.bak 's/^name: spec-agent\$/name: spec-agent-renamed/' $A/spec-agent.md"

# R3 — a referenced protocol file that no longer exists.
run_case R3 "referenced protocol file removed" \
  "rm -f $A/_qa-foundations.md"

# R4 — a machine-specific absolute path in a prompt.
run_case R4 "absolute machine path in a prompt" \
  "printf '\nRead /Users/someone/projects/app/specs/thing.md first.\n' >> $A/spec-agent.md"

# R5 — a stale C-range quote. En-dash specifically: the ASCII form was the only
# one the old pattern could see.
#
# The mutation is a plain substitution, and it must stay one. It was written as
# `0,/C1–C14/s//C1–C9/` — GNU sed's first-match-only form, which BSD sed (macOS)
# rejects by silently doing nothing and exiting 0. So on a Mac this case mutated
# nothing, R5 stayed green, and the sweep reported R5 unproven — correctly, and
# for a reason that looked like R5's fault rather than the case's. A mutation
# case that cannot mutate is the same defect this whole file exists to catch,
# one level up. Keep every case POSIX; there is one en-dash occurrence, so
# replacing all of them is what replacing the first one meant anyway.
run_case R5 "stale C-range quoted with an en-dash" \
  "sed -i.bak 's/C1–C14/C1–C9/' .claude/ORCHESTRATION.md"

# R6 — a protocol no agent names is dead, because dispatch appends nothing.
run_case R6 "protocol reachable from no agent" \
  "printf '# Orphan\n\nNothing references this.\n' > $A/_orphan-protocol.md"

# R7 — a second file defining a competing return block.
run_case R7 "competing return-contract definition" \
  "printf '\n---METRICS---\nstatus: DONE\n' >> $A/_ethos.md"

# R8 — a renamed injection placeholder must abort the build, not emit a page
# with no data.
run_case R8 "dashboard injection placeholder renamed" \
  "sed -i.bak 's/__INJECT_LAYER1__/__INJECT_LAYER1_RENAMED__/' .claude/eval/dashboard.html"

# R9 — the state contract. Two mutations: one structural, one behavioural.
run_case R9 "consumer re-derives a column position" \
  "sed -i.bak 's|cell() { tasks_get \"\$1\" \"\$2\"; }|cell() { printf \"%s\" \"\$1\" \| cut -d\"\|\" -f9; }|' .claude/hooks/validate-state.sh"

run_case R9 "shell reader stops resolving columns by name" \
  "sed -i.bak 's|i=\"\$(tasks_index \"\$2\")\"|i=9|' .claude/lib/tasks.sh"

# R9 — the ESM half. The failure this pair exists for: CommonJS in a .js file
# works in this template (no package.json) and throws in a real project (which
# declares type: module). Renaming the shared reader back to .js is that bug,
# reproduced exactly.
run_case R9 "the shared reader goes back to a .js extension" \
  "mv .claude/lib/tasks.cjs .claude/lib/tasks.js"

# The class rule, separately: a NEW file carrying CommonJS with a .js extension.
# This is the one that catches the next person rather than the last one.
run_case R9 "a new .js file under .claude/ carries CommonJS" \
  "printf 'const x = require(\"fs\");\nmodule.exports = { x };\n' > .claude/lib/helper.js"

# R9 — the readers must agree about LETTERED sub-tasks. This is the divergence
# that was hiding behind the ESM crash: the node reader matched `T-\d+` and so
# counted T-899 while dropping T-899a, and the dashboard silently omitted rows
# the orchestrator was acting on.
run_case R9 "node reader stops matching lettered sub-tasks" \
  "sed -i.bak 's/T-\\\\d+\[a-z\]?/T-\\\\d+/' .claude/lib/tasks.cjs"

# R10 — an agent told to write a block the orchestrator owns.
run_case R10 "agent told to write the Links block directly" \
  "printf '\nWrite the feature spec ## Links block yourself when you finish.\n' >> $A/web-agent.md"

# R11 — the design checker stops detecting drift.
run_case R11 "design checker stops comparing tokens" \
  "sed -i.bak 's|if (!declared.has(name)) {|if (false) {|' .claude/tools/design-check/check-design.mjs"

# R12 — the suite-can-fail tool stops discriminating. Declaring detection
# unconditionally is the shape this failure takes in practice: the tool reports
# every suite as healthy and C12 becomes a formality.
run_case R12 "suite-can-fail always reports detection" \
  "sed -i.bak 's|^detected=0\$|detected=1|' .claude/tools/test-quality/suite-can-fail.sh"

# R13 — the declared-elements check stops noticing orphans. Counting every field
# as accounted for is how this one dies quietly: it keeps printing a tally.
run_case R13 "declared-elements counts every field as accounted for" \
  "sed -i.bak 's/ORPHANS + 1/ORPHANS + 0/' .claude/tools/spec-check/declared-elements.sh"

# R14 — the testid contract check stops noticing dropped ids. Counting every
# declared id as honoured is how it would die: the tally keeps printing.
run_case R14 "testid-contract counts every id as honoured" \
  "sed -i.bak 's/MISSING + 1/MISSING + 0/' .claude/tools/design-check/testid-contract.sh"

# R15 — Gate 1. Four cases, because the gate has four independent ways to die
# and each of them leaves the others looking healthy.
#
# R15 and R16 shipped with no case here at all, which by this file's own rule
# made them unproven rather than passing — and R15 is the scenario guarding the
# gate that the impact contract was then added to. Building on an unproven check
# adds words, not protection, so the debt is paid before the new assertions rest
# on it.

# A lens that can pass by saying nothing. This is the gate's oldest failure mode:
# four agents agreeing a spec seems reasonable is pure expense.
run_case R15 "a lens is no longer told to return a checked: list" \
  "sed -i.bak 's/checked/reviewed-quietly/g' $A/qa-web-agent.md"

# The impact contract, half one: the section stops being required. The gate then
# reviews a section that is never written, which reads as compliance.
run_case R15 "spec-agent stops requiring the Impact section" \
  "sed -i.bak 's/what breaks if nobody looks/what the feature adds/' $A/spec-agent.md"

# The impact contract, half two: the section is still written and nobody is told
# to read it. The scope-discipline rule then quietly excludes it, since it is not
# any single lens's own question.
run_case R15 "the protocol stops putting Impact in scope for every lens" \
  "sed -i.bak 's/in scope for every lens/written by spec-agent/' $A/_spec-review-protocol.md"

# The absence loophole: a missing section reads as nothing to review rather than
# as the finding it is. This is how the requirement dies without anyone editing
# the requirement.
run_case R15 "a missing Impact section stops being a finding" \
  "sed -i.bak 's/itself a HIGH finding/itself unremarkable/' $A/_spec-review-protocol.md"

# R17 — the executor half. Three cases, one per way the link can break: the
# playbook forgets it is the writer, the protocol stops naming an executor (so
# the sweep has nothing to check and must say so rather than pass), and the
# paths stop resolving.
run_case R17 "the playbook stops naming the memory return fields" \
  "sed -i.bak 's/agent_memory_entry/agent_notes_entry/g' .claude/ORCHESTRATION.md"

run_case R17 "the protocol stops delegating, so the sweep examines nothing" \
  "sed -i.bak 's/through the \*\*orchestrator\*\*/by hand/' $A/_memory-protocol.md"

# MANIFEST.md sits at the project-starter root, which IS the sandbox root the
# mutation runs in — an earlier version of this case wrote `../MANIFEST.md` and
# so edited a file outside the copy, mutating nothing. The sweep reported it
# unproven, which was the sweep working.
run_case R17 "MANIFEST stops declaring where memory lives" \
  "sed -i.bak 's/^  memory_agent:/  disabled_memory_agent:/' MANIFEST.md"

# R16 — design craft. The scenario's claim is that the aesthetic direction is
# delegated to the vendored skills rather than restated in prose, so the case
# breaks the delegation and requires the scenario to notice.
run_case R16 "design-agent stops delegating aesthetics to the vendored skills" \
  "sed -i.bak 's|.claude/skills/|.claude/skills-removed/|g' $A/design-agent.md"

echo
echo "─── ${PROVEN} proven fallible, ${UNPROVEN} unproven ───"
if [ "$UNPROVEN" -gt 0 ]; then
  echo
  echo "Unproven claims — these scenarios did not fail when their claim was broken:"
  for u in "${UNPROVEN_LIST[@]}"; do echo "  - $u"; done
  echo
  echo "An unproven check is not a passing check. Fix the scenario, or record in"
  echo "its header why the claim cannot be exercised."
  exit 1
fi
echo "Every exercised claim is enforced."
exit 0
