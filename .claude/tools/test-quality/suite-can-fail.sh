#!/usr/bin/env bash
# Does this feature's test suite detect a broken implementation?
#
#   bash .claude/tools/test-quality/suite-can-fail.sh \
#     --files "src/auth/api/login.ts src/auth/web/LoginForm.tsx" \
#     --test-cmd "npm test -- auth"
#
# C5 proves the suite runs and is green. It never proves the green means
# anything. A test that asserts nothing runs clean and satisfies AC coverage,
# and the coverage matrix reports 100% for a feature nothing verifies.
#
# So: break the implementation on purpose and require the suite to notice.
# One detected mutation is enough — the question is whether the suite CAN fail,
# not what fraction of mutants it kills. Full mutation testing is a per-language
# tool (Stryker, mutmut, PIT); if the project has one, run that instead and use
# this only where it does not.
#
# Polarity matters: a mutation that changes no behaviour (it landed in a comment
# or an unreachable branch) simply does not count. Only "no mutation anywhere
# was noticed" is a finding. That way an inert mutation can never produce a
# false accusation.
#
# Exit: 0 = the suite detected a break (or the check could not run — see notes),
#       1 = the suite stayed green through every mutation.

set -uo pipefail

FILES=""
TEST_CMD=""
MAX_ATTEMPTS="${SUITE_CAN_FAIL_ATTEMPTS:-4}"

while [ $# -gt 0 ]; do
  case "$1" in
    --files) FILES="$2"; shift 2 ;;
    --test-cmd) TEST_CMD="$2"; shift 2 ;;
    --attempts) MAX_ATTEMPTS="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -z "$FILES" ] && { echo "suite-can-fail: --files is required (from the feature spec's Links.implemented_in)" >&2; exit 2; }
[ -z "$TEST_CMD" ] && { echo "suite-can-fail: --test-cmd is required (from docs/specs/_shared/platform/{layer}.md ## Test Harness)" >&2; exit 2; }

if ! command -v git >/dev/null 2>&1 || ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "suite-can-fail: not a git repository — cannot guarantee the working tree is restored. Skipped."
  exit 0
fi

# Mutating tracked files is only safe if git can put them back. A dirty file
# would be indistinguishable from a mutation left behind by a crash.
DIRTY=""
for f in $FILES; do
  [ -f "$f" ] || continue
  git diff --quiet -- "$f" 2>/dev/null || DIRTY="$DIRTY $f"
done
if [ -n "$DIRTY" ]; then
  echo "suite-can-fail: uncommitted changes in:$DIRTY"
  echo "  Commit or stash them first — this check edits files and restores them with git."
  exit 0
fi

restore() { for f in $FILES; do [ -f "$f" ] && git checkout -- "$f" 2>/dev/null; done; }
trap restore EXIT INT TERM

echo "suite-can-fail: baseline run"
if ! eval "$TEST_CMD" >/dev/null 2>&1; then
  echo "  baseline is already failing — fix the suite before asking whether it can fail."
  echo "  (a red suite 'detects' every mutation, which proves nothing)"
  exit 0
fi
echo "  baseline green"

# Mutation sites, cheapest and most language-agnostic first. Each is a semantic
# edit, not a formatting one: a comparison that flips, a boolean that inverts, a
# boundary that moves by one.
attempt=0
detected=0

try_mutation() {
  local file="$1" sed_expr="$2" label="$3"
  [ "$detected" -eq 1 ] && return 0
  [ "$attempt" -ge "$MAX_ATTEMPTS" ] && return 0

  # Only proceed if the edit actually changes the file.
  #
  # perl, not sed. The first-occurrence idiom `0,/re/s///` is a GNU extension:
  # BSD sed (every macOS) accepts the expression, changes nothing, and exits 0.
  # Every mutation then silently no-ops, the tool concludes "no mutation site
  # found", and C12 certifies whatever it is handed. perl's non-global s///
  # replaces the first match on every platform.
  local before after
  before="$(cksum < "$file")"
  perl -0777 -i -pe "$sed_expr" "$file" 2>/dev/null
  after="$(cksum < "$file")"
  if [ "$before" = "$after" ]; then
    git checkout -- "$file" 2>/dev/null
    return 0
  fi

  attempt=$((attempt + 1))
  echo "  mutation $attempt: $label in $file"
  if eval "$TEST_CMD" >/dev/null 2>&1; then
    echo "    suite still green"
  else
    echo "    suite failed — it detects this break"
    detected=1
  fi
  git checkout -- "$file" 2>/dev/null
}

for f in $FILES; do
  [ -f "$f" ] || continue
  case "$f" in
    *test*|*spec*|*__tests__*) continue ;;   # never mutate the tests themselves
  esac
  try_mutation "$f" 's/(?<![<>=!])===?(?!=)/!=/'            "flip an equality comparison"
  try_mutation "$f" 's/\btrue\b/false/'                      "invert a boolean literal"
  try_mutation "$f" 's/(?<![<>=!])>=/</'                      "move a boundary"
  try_mutation "$f" 's/\breturn [a-zA-Z_][a-zA-Z0-9_]*;/return null;/' "blank a return value"
done

echo
if [ "$attempt" -eq 0 ]; then
  echo "suite-can-fail: no mutation site found in the given files — nothing exercised." >&2
  echo "This is INCONCLUSIVE, not a pass: the check never ran, so it proves nothing" >&2
  echo "about the suite. Either the files hold no recognised mutation site, or the" >&2
  echo "mutation engine is broken on this platform. C12 must not be marked PASS." >&2
  exit 3
fi

if [ "$detected" -eq 1 ]; then
  echo "suite-can-fail: PASS — the suite detected a broken implementation ($attempt mutation(s) tried)"
  exit 0
fi

echo "suite-can-fail: FAIL — $attempt mutation(s) applied, the suite stayed green through all of them."
echo "  The implementation was broken on purpose and no test noticed. Coverage is"
echo "  satisfied by tests that do not verify behaviour: check that the linked"
echo "  tests assert on outcomes rather than on the call completing."
exit 1
