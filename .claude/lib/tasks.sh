#!/usr/bin/env bash
# Shared TASKS.md reader. Sourced by .claude/hooks/validate-state.sh and by the
# selection step in .claude/ORCHESTRATION.md.
#
# Column positions are resolved from the header row at runtime — never
# hardcoded. Before this existed, "Status is field 9" was written out in three
# places (the orchestrator's awk, the validator's awk, the dashboard's regex).
# Reordering a column updated one of them and broke the other two silently:
# Status read from the wrong position means every task looks PENDING and "next"
# dispatches the same task forever.
#
# Resolving by name means reordering columns is simply not a breaking change.
#
# Constraint: column names must be single words (no spaces), because the header
# is split on "|" and each cell is used verbatim as a key.
#
# bash 3.2 compatible — no associative arrays.

TASKS_FILE=""
TASKS_COLS=""

# tasks_init <path-to-TASKS.md> — returns 1 if there is no header row to read.
# tasks_live — the file with HTML comments removed.
#
# Comments must be stripped the same way `lib/tasks.js` strips them: non-greedy,
# so a SINGLE-LINE `<!-- ... -->` closes on its own line. A sed range
# (`/<!--/,/-->/d`) cannot do this — it starts at the opening line and searches
# for the terminator on LATER lines only, so one inline comment swallows every
# line up to the next `-->`. TASKS.md ships exactly such a comment in its
# archival instructions, above the task table: with the sed version, every real
# task row was deleted and `next` reported "No pending tasks" forever while the
# dashboard (which uses tasks.js) listed them correctly.
tasks_live() {
  awk '
    {
      line = $0
      while (1) {
        if (incomment) {
          p = index(line, "-->")
          if (p == 0) { line = ""; break }
          line = substr(line, p + 3); incomment = 0
        } else {
          p = index(line, "<!--")
          if (p == 0) break
          pre = substr(line, 1, p - 1)
          rest = substr(line, p + 4)
          q = index(rest, "-->")
          if (q == 0) { line = pre; incomment = 1; break }
          line = pre substr(rest, q + 3)
        }
      }
      print line
    }' "$TASKS_FILE"
}

tasks_init() {
  TASKS_FILE="$1"
  [ -f "$TASKS_FILE" ] || return 1
  local header
  # Resolve the header from the LIVE content, not the raw file. The raw file also
  # contains the column list inside a fenced documentation block near the top;
  # grepping raw picks that one up, so the columns would come from prose while
  # the rows come from the table. They agree today only by coincidence.
  header="$(tasks_live | grep -m1 -E '^\| *ID *\|' 2>/dev/null || true)"
  [ -z "$header" ] && return 1
  TASKS_COLS="$(printf '%s\n' "$header" | awk -F'|' '
    { for (i = 2; i < NF; i++) { v = $i; gsub(/^ +| +$/, "", v); if (v != "") printf "%s:%d\n", v, i } }')"
  [ -n "$TASKS_COLS" ]
}

# tasks_index <ColumnName> — 1-based cut/awk field number, empty if absent.
tasks_index() {
  printf '%s\n' "$TASKS_COLS" | awk -F: -v n="$1" '$1 == n { print $2; exit }'
}

# tasks_rows — live rows only. TASKS.md ships commented-out examples shaped
# exactly like real rows; a parser that does not strip them dispatches phantoms.
# Placeholder rows are deliberately kept: callers report them differently
# (the orchestrator tells the user to fill the row in; the validator skips it).
tasks_rows() {
  tasks_live | grep '^| T-' || true
}

# tasks_get <row> <ColumnName>
tasks_get() {
  local i
  i="$(tasks_index "$2")"
  [ -z "$i" ] && return 1
  printf '%s\n' "$1" | cut -d'|' -f"$i" | sed 's/^ *//; s/ *$//'
}

# tasks_is_none <value> — true for an empty cell, "—" or "-".
tasks_is_none() {
  case "$1" in "" | "—" | "-") return 0 ;; *) return 1 ;; esac
}

# tasks_split <comma-separated cell> — one entry per line, trimmed.
tasks_split() {
  printf '%s' "$1" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' || true
}

# tasks_is_placeholder <row> — an unfilled shipped template row.
tasks_is_placeholder() {
  case "$(tasks_get "$1" Agent)" in "" | \[*\]) return 0 ;; *) return 1 ;; esac
}

# tasks_done_ids — IDs whose Status is DONE.
tasks_done_ids() {
  local si ii
  si="$(tasks_index Status)"; ii="$(tasks_index ID)"
  tasks_rows | awk -F'|' -v s="$si" -v i="$ii" '
    { st = $s; id = $i; gsub(/^ +| +$/, "", st); gsub(/^ +| +$/, "", id)
      if (st == "DONE") print id }'
}

# tasks_select_next — the deterministic selection rule:
#   PENDING rows whose dependencies are all DONE, ordered by (Pri, row order).
# Prints the winning row, or nothing.
#
# The dependency filter is not optional. Selecting on Status alone hands an
# agent a task whose input does not exist yet, and an agent facing a missing
# input tends to invent one rather than return BLOCKED.
tasks_select_next() {
  local pi di si done_ids
  pi="$(tasks_index Pri)"; di="$(tasks_index Depends)"; si="$(tasks_index Status)"
  # Newlines cannot travel through `awk -v` — awk rejects the assignment with
  # "newline in string" and the whole selection silently returns nothing. With
  # zero or one DONE row that never fires, which is why the template's own seed
  # (one placeholder row) kept this green; the first real project with several
  # completed tasks lost `next` entirely. Join on commas instead.
  done_ids="$(tasks_done_ids | paste -sd, -)"

  tasks_rows | awk -F'|' -v p="$pi" -v d="$di" -v s="$si" -v donelist="$done_ids" '
    BEGIN { n = split(donelist, a, ",")
            for (i = 1; i <= n; i++) if (a[i] != "") DONE[a[i]] = 1 }
    { pri = $p; dep = $d; st = $s
      gsub(/^ +| +$/, "", pri); gsub(/^ +| +$/, "", dep); gsub(/^ +| +$/, "", st)
      if (st != "PENDING") next
      if (dep != "" && dep != "—" && dep != "-") {
        m = split(dep, dd, ",")
        for (j = 1; j <= m; j++) {
          gsub(/^ +| +$/, "", dd[j])
          if (!(dd[j] in DONE)) next
        }
      }
      # %06d zero-pads the row number so one lexical sort resolves both keys.
      printf "%s%06d\t%s\n", pri, NR, $0 }' \
    | sort | head -1 | cut -f2-
}

# tasks_has_pending — true when at least one PENDING row exists, regardless of
# whether its dependencies are met. Lets callers tell "queue empty" apart from
# "everything is waiting on something".
tasks_has_pending() {
  local si
  si="$(tasks_index Status)"
  tasks_rows | awk -F'|' -v s="$si" '
    { st = $s; gsub(/^ +| +$/, "", st); if (st == "PENDING") found = 1 }
    END { exit !found }'
}

# tasks_count_status <STATUS>
tasks_count_status() {
  local si
  si="$(tasks_index Status)"
  tasks_rows | awk -F'|' -v s="$si" -v want="$1" '
    { st = $s; gsub(/^ +| +$/, "", st); if (st == want) c++ } END { print c + 0 }'
}
