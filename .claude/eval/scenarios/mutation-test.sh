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
  # Copy ONLY what the scenarios read. `cp -R "$TEMPLATE_ROOT/."` is fine in the
  # template (a few MB) and unusable in a real project: measured at 4.9 GB there,
  # times one copy per case. That is the difference between a check that runs at
  # Gate 2 and one nobody will ever wait for. Every scenario resolves its paths
  # from $CLAUDE_ROOT or $PROJECT_ROOT, and the full set of those is `.claude/`
  # plus the root-level MANIFEST/CLAUDE files — nothing under specs/, src/, qa/,
  # design/, node_modules/ or .git/ is touched by any of them.
  cp -R "$TEMPLATE_ROOT/.claude" "$T/" 2>/dev/null
  for root_file in MANIFEST.md CLAUDE.md BRIEFING.md; do
    [ -f "$TEMPLATE_ROOT/$root_file" ] && cp "$TEMPLATE_ROOT/$root_file" "$T/"
  done
  # The artifact trees are SYMLINKED, not copied. validate-state.sh checks that
  # every path a TASKS row claims exists on disk, so a sandbox without them fails
  # for reasons having nothing to do with the mutation — and copying them is not
  # an option: one real project's claimed artifact is a 4.2 GB native build tree.
  #
  # Symlinks are safe here because of an invariant every case must keep:
  # **a mutation may only write inside `.claude/` or to a root-level file.**
  # Those are copied and therefore private to the sandbox. Nothing under specs/,
  # src/, qa/, design/ is ever mutated — the scenarios read those paths, they do
  # not rewrite them. A case that broke that rule would edit the real project,
  # so add cases accordingly.
  #
  # Everything at the top level that is not already copied gets a link, rather
  # than an allowlist of directory names: an allowlist silently misses whatever a
  # project happens to call its own trees, and the missing one shows up as a
  # scenario "red before mutation" with no hint why.
  # Dotfiles are included deliberately: the first version globbed `*` only, and a
  # real project claimed `.mobile-app/` as a task artifact — invisible to that
  # glob, so validate-state failed inside the sandbox and every R9 case reported
  # "red before mutation" with nothing pointing at the cause.
  for entry in "$TEMPLATE_ROOT"/* "$TEMPLATE_ROOT"/.[!.]*; do
    [ -e "$entry" ] || continue
    base="$(basename "$entry")"
    case "$base" in .git) continue ;; esac
    [ -e "$T/$base" ] && continue
    ln -s "$entry" "$T/$base"
  done

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

# R4 — a bare root literal returns. MANIFEST is only the source of truth for
# where things live if agents resolve THROUGH it; a bare `specs/` agrees with it
# exactly until a project moves that root, and then fails by looking somewhere
# that is not there.
run_case R4 "a bare root literal replaces a token" \
  "sed -i.bak 's|{specs}/|specs/|' $A/spec-agent.md"

# R4 — one QA agent drifts back to filing executable automation under {qa},
# where the code tooling does not reach it. Silent: the other two still use
# {tests}, and the divergence surfaces only when someone wonders why one suite
# is never typechecked.
run_case R4 "an agent files automation under {qa} again" \
  "sed -i.bak 's|{tests}/{module}/e2e/|{qa}/{module}/automation/e2e/|' $A/qa-web-agent.md"

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
# The upper bound is matched as a pattern, not pinned to a number. Pinning it to
# C14 meant that adding C15 silently turned this case into a no-op — the sweep
# reported R5 unproven, correctly, and the cause was this file rather than R5.
# A mutation case that names today's value stops mutating the day that value
# changes, which is precisely when the check matters most.
run_case R5 "stale C-range quoted with an en-dash" \
  "sed -i.bak -E 's/C1–C[0-9]+/C1–C9/' .claude/ORCHESTRATION.md"

# R6 — a protocol no agent names is dead, because dispatch appends nothing.
run_case R6 "protocol reachable from no agent" \
  "printf '# Orphan\n\nNothing references this.\n' > $A/_orphan-protocol.md"

# R7 — a second file defining a competing return block.
run_case R7 "competing return-contract definition" \
  "printf '\n---METRICS---\nstatus: DONE\n' >> $A/_ethos.md"

# R7 — the report contract. Three ways it decays, each leaving the rest intact:
# the agent stops declaring the calls it made alone, the owner starts getting
# bundled questions again, or the orchestrator substitutes its own reasoning for
# the agent's analysis.
run_case R7 "agents stop declaring the decisions they took alone" \
  "sed -i.bak 's/SELF-DECIDED/SELF-NOTES/g' $A/_completion-protocol.md"

run_case R7 "the verdict may narrate what was read instead of what was found" \
  "sed -i.bak 's/the RESULT, not the activity/a summary of the work/' $A/_completion-protocol.md"

run_case R7 "ids may reach the owner bare on lines other than the subject" \
  "sed -i.bak 's/never travels alone/is fine on its own/' $A/_completion-protocol.md"

run_case R7 "a bare feature id may stand in for the subject line" \
  "sed -i.bak 's/Never an id alone/An id is enough/' $A/_completion-protocol.md"

run_case R7 "the line budget becomes a feeling again" \
  "sed -i.bak 's/a number rather than a feeling/whatever seems right/' $A/_completion-protocol.md"

run_case R7 "a narrative section may be added outside the named zones" \
  "sed -i.bak 's/Interesting is not a zone/Add a zone when it helps/' $A/_completion-protocol.md"

run_case R7 "explanations may name the category instead of the case" \
  "sed -i.bak 's/the case, not the category/at whatever altitude suits/' $A/_completion-protocol.md"

run_case R7 "zone labels may become narrative headings" \
  "sed -i.bak 's/a label, not a sentence/as expressive as you like/' $A/_completion-protocol.md"

run_case R7 "zones may run into paragraphs again" \
  "sed -i.bak 's/One fact per line/Group facts as convenient/' $A/_completion-protocol.md"

run_case R7 "the one-line cap on head entries is removed" \
  "sed -i.bak 's/One line means one line/Entries may run long/' $A/_completion-protocol.md"

run_case R7 "self-decided calls may be argued rather than stated" \
  "sed -i.bak 's/not a defence/a full defence/' $A/_completion-protocol.md"

run_case R7 "a decision may be put to the owner with no brief in front of it" \
  "sed -i.bak 's/Never ask cold/Ask when ready/' $A/_completion-protocol.md"

run_case R7 "internal vocabulary may reach the owner unexpanded" \
  "sed -i.bak 's/expand every code the first time/use the working vocabulary/' $A/_completion-protocol.md"

run_case R7 "unrelated decisions may be bundled into one question again" \
  "sed -i.bak 's/Do not bundle unrelated decisions/Decisions may be bundled/' $A/_completion-protocol.md"

run_case R7 "the orchestrator may write the option list itself" \
  "sed -i.bak 's/wearing the agent/dressed up/' .claude/ORCHESTRATION.md"

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

# R13 — the presence test goes back to `printf | grep -qF` under pipefail. That
# pipeline reports a field MISSING precisely when it is present early and often,
# because grep exits at the first match and printf takes SIGPIPE. It reached a
# live project through a template sync and cost a spec ten false orphans.
run_case R13 "presence test returns to a pipeline that inverts on large specs" \
  "perl -0777 -pi -e 's/if \\[ -n \"\\\$needle\" \\] && case .*?; then/if printf %s \"\\\$HAY_NORM\" | grep -qF \"\\\$needle\"; then/s' .claude/tools/spec-check/declared-elements.sh"

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
  "sed -i.bak 's/in scope for every lens/written by spec-agent/' $A/_review-protocol.md"

# The absence loophole: a missing section reads as nothing to review rather than
# as the finding it is. This is how the requirement dies without anyone editing
# the requirement.
run_case R15 "a missing Impact section stops being a finding" \
  "sed -i.bak 's/itself a HIGH finding/itself unremarkable/' $A/_review-protocol.md"

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

# R15 — Gate 1.5. Three cases, one per way the design gate dies while the rest of
# it keeps looking healthy.
run_case R15 "a changed artifact stops reaching its consumers" \
  "sed -i.bak 's/its consumers re-review/it is noted/' .claude/ORCHESTRATION.md"

run_case R15 "the re-review threshold is dropped" \
  "sed -i.bak 's/while being wrong against the new version/in the usual way/' .claude/ORCHESTRATION.md"

run_case R16 "navigation edges may be described rather than drawn" \
  "sed -i.bak 's/Return an edge table/Mention the edges/' $A/design-agent.md"

run_case R15 "the design gate is removed from the pipeline" \
  "sed -i.bak 's/Gate 1.5/Gate ONE-POINT-FIVE-REMOVED/g' .claude/ORCHESTRATION.md"

# The author quietly becomes a lens over its own work — the self-consistency
# problem the gate exists to break, reintroduced by deleting one sentence.
run_case R15 "the design's author is allowed to review it" \
  "sed -i.bak 's/design-agent is not a lens here/design-agent may also review/' $A/_review-protocol.md"

# The class of finding the gate exists for, routed as a design defect instead of
# to the spec — which deletes a good rule for being written in the wrong file.
run_case R15 "a rule found only in the design stops routing to the spec" \
  "sed -i.bak 's/Deleting a good rule because/Removing the rule is fine because/' .claude/ORCHESTRATION.md"

# R15 — the built-screen check, the self-graded rubric, and the principle that
# decides whether any of this is worth its cost. Three more ways the review layer
# dies while the rest of it reads as healthy.
run_case R15 "the built screen stops being looked at" \
  "sed -i.bak 's/### C16/### C16-DISABLED/' $A/reviewer-agent.md"

# The degradation clause is what stops "no browser" reading as "matched".
run_case R15 "an unrenderable screen is allowed to read as a match" \
  "sed -i.bak 's/could not be rendered is not a screen/could not be rendered is a screen/' $A/reviewer-agent.md"

# The design rubric goes back to being graded only by its author.
run_case R15 "findings may run to paragraphs again" \
  "sed -i.bak 's/Length is part of the format/Length is the author-s call/' $A/_review-protocol.md"

run_case R15 "the checked list may be written as prose" \
  "sed -i.bak 's/checklist, not prose/as detailed as needed/' $A/_review-protocol.md"

run_case R15 "design's rubric returns to self-assessment" \
  "sed -i.bak 's/grades it instead/grades it alone/' $A/_review-protocol.md"

# R17 — the taste gate. It dies three ways: the field goes unread again, the
# gate stops blocking, or silence starts counting as approval — and the third is
# the one that leaves everything else looking intact.
run_case R17 "the design review_guide goes unread again" \
  "sed -i.bak 's/review_guide/review_notes/g' .claude/ORCHESTRATION.md"

run_case R17 "the owner's design review stops blocking implementation" \
  "sed -i.bak 's/No implementer is dispatched until this returns/Implementers may proceed meanwhile/' .claude/ORCHESTRATION.md"

run_case R17 "silence starts counting as design approval" \
  "sed -i.bak 's/Do not infer approval from silence/Approval may be inferred from silence/' .claude/ORCHESTRATION.md"

# R16 — design craft. The scenario's claim is that the aesthetic direction is
# delegated to the vendored skills rather than restated in prose, so the case
# breaks the delegation and requires the scenario to notice.
run_case R16 "the motion skill stops being read" \
  "sed -i.bak 's|skills/design/motion.md|skills/design/motion-removed.md|' $A/design-agent.md"

run_case R16 "motion stops being tied to a state change" \
  "sed -i.bak 's/explain a change/add polish/' .claude/skills/design/motion.md"

run_case R16 "accessibility reaches for ARIA before HTML" \
  "sed -i.bak 's/use the native element/add the attributes/' .claude/skills/design/accessible-components.md"

run_case R16 "screens stop enumerating the states they can reach" \
  "sed -i.bak 's/enumerates its own states/covers the usual states/' $A/design-agent.md"

run_case R16 "a state left out on purpose stops being named" \
  "sed -i.bak 's/deliberately do not draw/skip as you see fit/' $A/design-agent.md"

run_case R16 "design-agent stops delegating aesthetics to the vendored skills" \
  "sed -i.bak 's|.claude/skills/|.claude/skills-removed/|g' $A/design-agent.md"

# The catalogue rule. A named movement (Swiss, Brutalist) carries implications
# the brief never stated; these three break each half of the guard.
run_case R16 "direction may be picked from a catalogue again" \
  "sed -i.bak 's/never picked from a catalogue/or picked from a catalogue/' $A/design-agent.md"

run_case R16 "committing to a named design movement stops being barred" \
  "sed -i.bak 's/Do not name a design movement and commit to it/Name a design movement and commit to it/' $A/design-agent.md"

run_case R16 "a movement catalogue is re-added to the design skills" \
  "printf '\\n## 3. Brutalist\\n\\nPure primaries, system fonts, hard offset shadows.\\n' >> .claude/skills/design/screen-content.md"

# R18 — the communication contract goes back to being unreachable. This is the
# exact state that produced the complaint: the rules existed, ORCHESTRATION did
# not name them, and the orchestrator reported in the only vocabulary it had.
run_case R18 "the contract stops being reachable from ORCHESTRATION" \
  "perl -0777 -i -pe 's/_communication\\.md/_nowhere.md/g' .claude/ORCHESTRATION.md"

# R18 — the bare instruction returns alongside the contract. Having both is worse
# than having neither: the path the orchestrator actually follows says nothing.
run_case R18 "a bare 'Report to user' step returns" \
  "printf '\n13. Report to user\n' >> .claude/ORCHESTRATION.md"

# R18 — the contract goes back to stripping ids from anything the person reads.
# Cryptic and unciteable are both failures, and this is the second one: the
# report becomes readable prose the person cannot point at.
run_case R18 "the contract drops ids instead of glossing them" \
  "perl -0777 -i -pe 's/not to remove ids/to remove ids/' .claude/agents/_communication.md"

# R18 — the code guidance splits back into two tables. Same shape, opposite
# lessons, reason nowhere: the reader follows whichever table they read last.
run_case R18 "code guidance splits into two tables again" \
  "perl -0777 -i -pe 's/\\| Raw \\| To the person \\| The code \\|/| Raw | Say |/' .claude/agents/_communication.md"

# R18 — the file goes back to claiming every agent reads it. Under this
# template's own dispatch rule that reach does not exist, and R6 cannot catch the
# overclaim because ORCHESTRATION.md counts as a referrer.
run_case R18 "the contract claims a reach dispatch will not give it" \
  "perl -0777 -i -pe 's/\\*\\*Only the orchestrator reads this today\\.\\*\\*/Every agent reads this./' .claude/agents/_communication.md"

# R18 — the reviewer card points back at _review-protocol.md, which is the Gate 1
# lens contract and defines no report shape. A pointer that resolves to a real
# file and the wrong content fails silently: nothing errors, the reader just
# looks in the wrong place.
run_case R18 "the reviewer card points at the wrong file for the report shape" \
  "perl -0777 -i -pe 's/reviewer-agent\\.md ## Output/_review-protocol.md/' .claude/agents/_communication.md"

# R15 — the second review round goes back to re-dispatching every lens. This is
# the state measured on F-005: nine lenses, then nine again on a revision that
# did not reach every platform.
run_case R15 "the re-review round stops being scoped to what changed" \
  "perl -0777 -i -pe 's/lenses whose ACs actually changed/lenses/' .claude/ORCHESTRATION.md"

run_case R15 "the second round may widen the consumer set again" \
  "perl -0777 -i -pe 's/it never widens it/it may widen it/' .claude/ORCHESTRATION.md"

# R19 — dispatch discipline. Each case restores one half of the state that
# produced the measured waste: no gate before the briefing, a claim written from
# memory, added scope going in unmarked, and a line budget standing in for it.
run_case R19 "the gate before the briefing disappears" \
  "perl -0777 -i -pe 's/Is this a dispatch at all\?/Write the briefing/' .claude/ORCHESTRATION.md"

run_case R19 "dispatching for a list stops being refused" \
  "perl -0777 -i -pe 's/do not dispatch it/consider whether to dispatch it/' .claude/ORCHESTRATION.md"

run_case R19 "briefing claims may be written from memory again" \
  "perl -0777 -i -pe 's/must be one you just read/may be one you recall/' .claude/ORCHESTRATION.md"

run_case R19 "added scope stops being marked for the owner" \
  "perl -0777 -i -pe 's/Not asked for/Extra scope/' .claude/ORCHESTRATION.md"

run_case R19 "a line budget returns in place of the scope rule" \
  "printf '\\n**Length budget: 40 lines.**\\n' >> .claude/ORCHESTRATION.md"

# R19 — intake. Each case restores one half of the state the owner described: a
# request arriving and going straight to a dispatch, with nothing evaluated,
# nothing ordered against the queue, and no room to say "not this".
run_case R19 "intake stops blocking the dispatch" \
  "perl -0777 -i -pe 's/Until then nothing is dispatched/Dispatch while you wait/' .claude/ORCHESTRATION.md"

run_case R19 "the request-to-task distinction disappears" \
  "perl -0777 -i -pe 's/A request is not a task/A request becomes a task/' .claude/ORCHESTRATION.md"

run_case R19 "an unanswered product line gets guessed instead of asked about" \
  "perl -0777 -i -pe 's/Stop and ask for it/Infer it from the code/' .claude/ORCHESTRATION.md"

run_case R19 "the orchestrator stops recommending a priority" \
  "perl -0777 -i -pe 's/you recommend and they confirm/they decide/' .claude/ORCHESTRATION.md"

run_case R19 "an unclear request defaults to being waved through" \
  "perl -0777 -i -pe 's/it is the first kind/it is the second kind/' .claude/ORCHESTRATION.md"

run_case R19 "disagreement loses its bound and can be relitigated" \
  "perl -0777 -i -pe 's/Repeating a rejected argument is not diligence/Raise it again next time/' .claude/ORCHESTRATION.md"

run_case R19 "the product statement loses the line that refuses" \
  "perl -0777 -i -pe 's/makes a request refusable/describes the product/' CLAUDE.md"

run_case R19 "dispatch preference stops deferring to intake" \
  "perl -0777 -i -pe 's/whether a request should become a task at all/how the work is split/' .claude/ORCHESTRATION.md"

# R9 — the sanction register. A grant mechanism widens quietly, so the two ways
# it stops being narrow are exercised: the exact-triple match becoming a prefix
# match (which would license a whole tree from one row), and the dead-grant check
# going quiet (which is how a row nobody removes turns into a standing licence).
run_case R9 "a sanction matches by prefix instead of the exact path" \
  "perl -0777 -i -pe 's/if \\(t==id && a==ag && p==pa\\)/if (t==id \\&\\& a==ag \\&\\& index(pa,p)==1)/' .claude/hooks/validate-state.sh"

run_case R9 "a dead sanction stops failing the build" \
  "perl -0777 -i -pe 's/&& continue   # archived/|| continue   # archived/' .claude/hooks/validate-state.sh"

# R19 — a question is not a request. Each case restores the state that made a
# question start work: no classification step, no default when the message is
# ambiguous, or the contract half of the rule going missing.
run_case R19 "intake stops asking whether the message was a request" \
  "perl -0777 -i -pe 's/is this a request at all\\?/what the request needs/' .claude/ORCHESTRATION.md"

run_case R19 "an ambiguous message defaults to being acted on" \
  "perl -0777 -i -pe 's/it is a question\\./it is a request./' .claude/ORCHESTRATION.md"

run_case R19 "the communication contract drops the question rule" \
  "perl -0777 -i -pe 's/A question is answered, not acted on/Answer promptly/' .claude/agents/_communication.md"

# R20 — the feature-close review. The two properties that die separately: the
# review sliding to after sign-off (where it documents a decision already taken),
# and it acting on its own findings instead of handing them to the owner.
run_case R20 "the review moves to after sign-off" \
  "perl -0777 -i -pe 's/before you ask the owner to sign/after the owner signs/' .claude/ORCHESTRATION.md"

run_case R20 "a half-done row stops blocking a clean sign-off" \
  "perl -0777 -i -pe 's/signed off on a false claim/signed off with a note/' .claude/ORCHESTRATION.md"

run_case R20 "the review cancels pending work without asking" \
  "perl -0777 -i -pe 's/Nothing here edits/You may edit/' .claude/ORCHESTRATION.md"

run_case R20 "the blocked-row question disappears" \
  "perl -0777 -i -pe 's/What is the owner blocking/What is left over/' .claude/ORCHESTRATION.md"

run_case R20 "the review stops saying what it does not measure" \
  "perl -0777 -i -pe 's/summarises the queue, not the project/summarises the project/' .claude/ORCHESTRATION.md"

run_case R20 "the sign-off row stops pointing at the review" \
  "perl -0777 -i -pe 's/preceded by .## When a feature closes./human/' .claude/ORCHESTRATION.md"

run_case R20 "the shell block loses a done and stops parsing" \
  "perl -0777 -i -pe 's/  \\[ \"\\\$\\(tasks_get \"\\\$r\" Status\\)\" = \"BLOCKED\" \\] \\|\\| continue/  if true; then/' .claude/ORCHESTRATION.md"

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
