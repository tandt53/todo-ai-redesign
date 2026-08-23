#!/usr/bin/env bash
# T-275 — Does every var(--x) reference in a CSS file resolve to a declaration?
#
# Pure text check, no browser needed. Catches the defect class where a CSS
# variable is consumed but never declared — the property using it becomes
# invalid at computed-value time and silently falls back to its initial value
# (or inherits), which is invisible in source and invisible to every check
# that does not render.
#
# Legitimate patterns that are NOT flagged:
#   1. var(--x, fallback) — the fallback means the property will not be invalid
#      even if --x is never defined. Still a possible bug (the declaration was
#      deleted and the fallback is a vestige), but the fallback is a deliberate
#      safety net and crying wolf on it makes the check noisy.
#   2. Variables declared inside a media query, [data-theme] block, or any
#      selector — not just bare :root. A declaration anywhere in the file
#      counts.
#   3. Variables that reference other variables (--accent: var(--color-dark-accent))
#      — the reference is checked against declarations, not values.
#
# Scope: CSS files under src/ and mockup HTML files under the design root.
#
# Usage:
#   bash check-undefined-vars.sh [--src-dir src] [--design-root docs/design]
#
# Exit: 0 = every reference resolves, 1 = at least one undefined reference.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

SRC_DIR="${ROOT}/src"
DESIGN_ROOT=""

# Parse args
while [ $# -gt 0 ]; do
  case "$1" in
    --src-dir) SRC_DIR="$2"; shift 2 ;;
    --design-root) DESIGN_ROOT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Resolve design root from MANIFEST if not provided
if [ -z "$DESIGN_ROOT" ]; then
  MANIFEST="$ROOT/MANIFEST.md"
  DESIGN_ROOT="$(awk '
    /^roots:/ { r = 1; next }
    r && /^[a-z_]+:/ { r = 0 }
    r && /^  design: / { v = $2; gsub(/"/, "", v); sub(/\/$/, "", v); print v; exit }
  ' "$MANIFEST" 2>/dev/null)"
  [ -n "$DESIGN_ROOT" ] && DESIGN_ROOT="${ROOT}/${DESIGN_ROOT}"
fi

TOTAL_UNDEF=0
TOTAL_FILES=0
TOTAL_PASS=0

check_file() {
  local file="$1"
  local relpath="${file#"$ROOT"/}"

  # Use perl for all extraction — grep cannot handle --var patterns safely
  # (it treats them as flags).

  # ── Collect all declarations: --name: value ──
  # Matches inside any rule context. We extract just the variable name.
  local declarations
  declarations="$(perl -ne '
    # Match CSS variable declarations: --name: value
    # Must appear as a property declaration (preceded by { ; newline or start)
    while (/(--[A-Za-z0-9_-]+)\s*:/g) {
      print "$1\n";
    }
  ' "$file" | sort -u)"

  # ── Collect all var(--x) references, classified by fallback ──
  # No-fallback: var(--name) — the closing paren follows (possibly with whitespace)
  # With-fallback: var(--name, ...) — a comma follows the name
  local refs_no_fallback
  refs_no_fallback="$(perl -ne '
    while (/var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g) {
      print "$1\n" if $2 eq ")";
    }
  ' "$file" | sort -u)"

  local refs_with_fallback
  refs_with_fallback="$(perl -ne '
    while (/var\(\s*(--[A-Za-z0-9_-]+)\s*,/g) {
      print "$1\n";
    }
  ' "$file" | sort -u)"

  if [ -z "$refs_no_fallback" ] && [ -z "$refs_with_fallback" ]; then
    return 0  # No var() references at all
  fi

  TOTAL_FILES=$((TOTAL_FILES + 1))
  local file_undef=0

  # Build a lookup set from declarations (one per line in a temp var)
  # Check each no-fallback reference against it
  while IFS= read -r varname; do
    [ -z "$varname" ] && continue

    # Check if this variable is declared anywhere in the file
    if ! printf '%s\n' "$declarations" | grep -qxF -- "$varname" 2>/dev/null; then
      file_undef=$((file_undef + 1))

      # Find consuming line numbers using perl (safe with -- prefixed names)
      local lines
      lines="$(perl -ne "
        print \"\$.\n\" if /var\\(\\s*\\Q${varname}\\E\\s*[,)]/;
      " "$file" | tr '\n' ',' | sed 's/,$//')"

      printf '  FAIL  [undefined-var] %s: %s is consumed (line %s) but never declared\n' \
        "$relpath" "$varname" "$lines"
    fi
  done <<< "$refs_no_fallback"

  TOTAL_UNDEF=$((TOTAL_UNDEF + file_undef))
  if [ "$file_undef" -eq 0 ]; then
    local ref_count
    ref_count="$(printf '%s\n' "$refs_no_fallback" | grep -c . || true)"
    local fb_count
    fb_count="$(printf '%s\n' "$refs_with_fallback" | grep -c . || true)"
    printf '  ok    [undefined-var] %s: %s ref(s) resolve, %s with fallback skipped\n' \
      "$relpath" "$ref_count" "$fb_count"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  fi
}

# ── Find CSS files under src/ ──
if [ -d "$SRC_DIR" ]; then
  while IFS= read -r f; do
    check_file "$f"
  done < <(find "$SRC_DIR" -name '*.css' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | sort)
fi

# ── Find mockup HTML files (they inline <style> with var references) ──
if [ -n "$DESIGN_ROOT" ] && [ -d "$DESIGN_ROOT" ]; then
  while IFS= read -r f; do
    check_file "$f"
  done < <(find "$DESIGN_ROOT" -path '*/screens/*.html' 2>/dev/null | sort)
fi

echo ""
if [ "$TOTAL_UNDEF" -gt 0 ]; then
  echo "undefined-var: ${TOTAL_PASS} file(s) clean, ${TOTAL_UNDEF} undefined reference(s) found"
  exit 1
else
  if [ "$TOTAL_FILES" -eq 0 ]; then
    echo "undefined-var: no CSS files with var() references found — nothing to check"
  else
    echo "undefined-var: all references resolve in ${TOTAL_FILES} file(s)"
  fi
  exit 0
fi
