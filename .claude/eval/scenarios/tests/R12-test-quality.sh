#!/usr/bin/env bash
# R12 — The suite-can-fail check actually distinguishes a real suite from a
# hollow one.
#
# C5 proves the suite runs green. C2 proves every AC-id is referenced by a P1
# test case. Neither reads an assertion, so a test that calls the code and
# asserts nothing satisfies both — and the coverage matrix reports 100% for a
# feature no test would defend.
#
# This scenario builds two projects that differ only in their tests: one that
# asserts on outcomes, one that calls the same functions and asserts nothing.
# The tool must pass the first and fail the second. Anything else means C12 is
# a formality.
#
# It also pins the guards, because a tool that mutates source files and then
# fails to restore them is worse than no tool at all.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TOOL="$CLAUDE_ROOT/tools/test-quality/suite-can-fail.sh"
REVIEWER="$CLAUDE_ROOT/agents/reviewer-agent.md"
QAFOUND="$CLAUDE_ROOT/agents/_qa-foundations.md"

echo "─── R12 — suite-can-fail separates a real suite from a hollow one ───"

assert_file_exists "$TOOL" "suite-can-fail.sh present"
assert_file_contains "$REVIEWER" 'C12' "reviewer defines C12"
assert_file_contains "$REVIEWER" 'suite-can-fail.sh' "C12 runs the tool"
assert_file_contains "$QAFOUND" 'Coverage is not quality' \
  "QA foundations states the coverage-is-not-quality rule"

# The tool must defer to a project's own mutation tooling rather than growing
# into a scoring system it cannot maintain across languages.
assert_file_contains "$REVIEWER" 'mutation-testing command' \
  "C12 defers to a project-declared mutation tool when one exists"

if ! command -v git >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  _record_fail "git and node are required to exercise the tool"
  pass_or_fail "R12" && echo "R12 VERDICT: PASS" || { echo "R12 VERDICT: FAIL"; exit 1; }
  exit 0
fi

# ── Build a project whose behaviour is worth testing ───────────────────────
make_project() {
  local dir="$1" kind="$2"
  mkdir -p "$dir/src" "$dir/test"
  cat > "$dir/src/rule.js" <<'JS'
export function allow(user) {
  if (user.attempts >= 3) return false;
  return user.active === true;
}
JS
  cat > "$dir/package.json" <<'JSON'
{ "type": "module", "scripts": { "test": "node --test test/*.test.js" } }
JSON

  if [ "$kind" = "real" ]; then
    cat > "$dir/test/rule.test.js" <<'JS'
import { test } from 'node:test';
import assert from 'node:assert';
import { allow } from '../src/rule.js';
test('AC-1 active user allowed', () => { assert.equal(allow({attempts:0,active:true}), true); });
test('AC-2 blocked after 3 attempts', () => { assert.equal(allow({attempts:3,active:true}), false); });
test('AC-3 inactive refused', () => { assert.equal(allow({attempts:0,active:false}), false); });
JS
  else
    # Same AC-ids, same code paths exercised, no assertion anywhere.
    cat > "$dir/test/rule.test.js" <<'JS'
import { test } from 'node:test';
import { allow } from '../src/rule.js';
test('AC-1 active user allowed', () => { allow({attempts:0,active:true}); });
test('AC-2 blocked after 3 attempts', () => { allow({attempts:3,active:true}); });
test('AC-3 inactive refused', () => { allow({attempts:0,active:false}); });
JS
  fi

  ( cd "$dir" && git init -q . \
    && git config user.email r12@test && git config user.name r12 \
    && git add -A && git commit -qm init ) >/dev/null 2>&1
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

make_project "$WORK/real" real
make_project "$WORK/hollow" hollow

# Both suites must be green to start, or the comparison proves nothing.
for kind in real hollow; do
  if ( cd "$WORK/$kind" && npm test ) >/dev/null 2>&1; then
    _record_pass "$kind fixture: baseline suite is green"
  else
    _record_fail "$kind fixture: baseline suite is not green — fixture is broken, not the tool"
  fi
done

# ── The discrimination this whole check exists for ─────────────────────────
if ( cd "$WORK/real" && bash "$TOOL" --files "src/rule.js" --test-cmd "npm test" ) >/dev/null 2>&1; then
  _record_pass "a suite that asserts on outcomes is reported as able to fail"
else
  _record_fail "false positive: an asserting suite was reported as unable to fail"
fi

if ( cd "$WORK/hollow" && bash "$TOOL" --files "src/rule.js" --test-cmd "npm test" ) >/dev/null 2>&1; then
  _record_fail "a suite with no assertions was reported as able to fail — C12 catches nothing"
else
  _record_pass "a suite with no assertions is caught"
fi

# ── Guards ─────────────────────────────────────────────────────────────────
# Mutating tracked files is only acceptable if they come back.
( cd "$WORK/hollow" && bash "$TOOL" --files "src/rule.js" --test-cmd "npm test" ) >/dev/null 2>&1 || true
if [ -z "$( cd "$WORK/hollow" && git status --porcelain )" ]; then
  _record_pass "working tree is restored after mutation"
else
  _record_fail "tool left the working tree dirty — source files were mutated and not restored"
fi

# A dirty tree must abort: an uncommitted edit is indistinguishable from a
# mutation left behind by an earlier crash.
printf '\n// local edit\n' >> "$WORK/real/src/rule.js"
DIRTY_OUT="$( cd "$WORK/real" && bash "$TOOL" --files "src/rule.js" --test-cmd "npm test" 2>&1 || true )"
if printf '%s' "$DIRTY_OUT" | grep -qi 'uncommitted changes'; then
  _record_pass "refuses to run against a dirty working tree"
else
  _record_fail "ran against a dirty tree — a restore would discard the user's edit"
fi
( cd "$WORK/real" && git checkout -- src/rule.js ) >/dev/null 2>&1

# A red baseline "detects" every mutation, so it must be reported, not counted.
cat > "$WORK/real/test/broken.test.js" <<'JS'
import { test } from 'node:test';
import assert from 'node:assert';
test('deliberately failing', () => { assert.equal(1, 2); });
JS
( cd "$WORK/real" && git add -A && git commit -qm broken ) >/dev/null 2>&1
RED_OUT="$( cd "$WORK/real" && bash "$TOOL" --files "src/rule.js" --test-cmd "npm test" 2>&1 || true )"
if printf '%s' "$RED_OUT" | grep -qi 'already failing'; then
  _record_pass "a red baseline is reported rather than counted as detection"
else
  _record_fail "a red baseline was treated as a working check"
fi

if pass_or_fail "R12"; then
  echo "R12 VERDICT: PASS"
  exit 0
else
  echo "R12 VERDICT: FAIL"
  exit 1
fi
