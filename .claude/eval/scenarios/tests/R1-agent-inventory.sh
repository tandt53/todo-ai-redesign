#!/usr/bin/env bash
# R1 — Every `*-agent` name mentioned anywhere in the template resolves to a
# real agent definition file.
#
# Catches: agents renamed without updating callers, and agent names inherited
# from a sibling template (e.g. qa-starter's `test-cases-agent`) leaking in
# during a copy-paste. Those names look plausible to a reader but the
# orchestrator can never dispatch them — it would fail to find the file.
#
# Pure grep. No dispatch.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$CLAUDE_ROOT/agents"

echo "─── R1 — agent inventory + no dangling agent references ───"

# The 12 agents this template ships.
EXPECTED_AGENTS=(
  spec-agent architect-agent design-agent
  web-agent mobile-agent backend-agent
  qa-api-agent qa-web-agent qa-mobile-agent qa-explorer-agent
  reviewer-agent product-agent
)

for a in "${EXPECTED_AGENTS[@]}"; do
  assert_file_exists "$AGENTS_DIR/${a}.md" "agent definition present: ${a}.md"
done

# No unexpected *-agent.md files (a new agent must be added to this list, which
# forces the pipeline table in ORCHESTRATION.md to be reconsidered too).
while IFS= read -r f; do
  base="$(basename "$f" .md)"
  case " ${EXPECTED_AGENTS[*]} " in
    *" $base "*) ;;
    *) _record_fail "unexpected agent file not in R1's inventory: ${base}.md" ;;
  esac
done < <(find "$AGENTS_DIR" -maxdepth 1 -name '*-agent.md')

# --- Dangling reference check ---------------------------------------------
# Words matching `<something>-agent` that are NOT dispatchable agent names.
# Prose compounds, template placeholders, filenames, and agents folded into
# another role are all legitimate; anything else is a dangling reference.
BENIGN='^(sub|inter|multi|per|cross|from|to|your|the|a|an|each|other|this|that|any|no|single|paired|implementer|test|capture|claude|coding|calling|dispatching|downstream|upstream|db|security|ai)$'

SEARCH_FILES=("$AGENTS_DIR"/*.md "$CLAUDE_ROOT/ORCHESTRATION.md")
[ -f "$CLAUDE_ROOT/README.md" ] && SEARCH_FILES+=("$CLAUDE_ROOT/README.md")

DANGLING=""
while IFS= read -r token; do
  [ -z "$token" ] && continue
  case " ${EXPECTED_AGENTS[*]} " in
    *" $token "*) continue ;;
  esac
  prefix="${token%-agent}"
  if printf '%s' "$prefix" | grep -qE "$BENIGN"; then continue; fi
  DANGLING="${DANGLING}${token} "
done < <(grep -rhoE '(^|[^a-zA-Z-])[a-z][a-z-]*-agent' "${SEARCH_FILES[@]}" 2>/dev/null \
         | grep -oE '[a-z][a-z-]*-agent$' | sort -u)

if [ -z "$DANGLING" ]; then
  _record_pass "no dangling *-agent references"
else
  for d in $DANGLING; do
    hit=$(grep -rEnH "(^|[^a-zA-Z-])${d}\b" "${SEARCH_FILES[@]}" 2>/dev/null | head -1)
    _record_fail "dangling agent reference '${d}' — not a shipped agent (first hit: ${hit})"
  done
fi

if pass_or_fail "R1"; then
  echo "R1 VERDICT: PASS"
  exit 0
else
  echo "R1 VERDICT: FAIL"
  exit 1
fi
