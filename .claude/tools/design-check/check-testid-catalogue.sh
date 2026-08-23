#!/usr/bin/env bash
# T-271 — Does every testid drawn in a mockup appear in the component catalogue?
#
# testid-contract.sh checks mockup vs implementation. This check fills the
# other gap: mockup vs catalogue (components.md). An id can be drawn in a
# mockup and never declared in the catalogue, which means:
#   - The catalogue is incomplete as a contract document
#   - An implementer reading only the catalogue misses the id
#   - Nobody knows whether the id was an intentional addition or an accident
#
# Live example that motivated this check: detail-copy-button was added to
# three mockups by a fix and declared nowhere until an agent noticed by hand.
#
# Scope: ALL mockup HTML files under {design}/{module}/screens/, covering
# web data-testid, iOS accessibilityIdentifier, and Android resource-id.
# The earlier check was scoped to the app shell; this one covers every surface.
#
# Usage:
#   bash check-testid-catalogue.sh [--design-root docs/design]
#
# Exit: 0 = every mockup testid appears in the catalogue,
#       1 = at least one is missing.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

DESIGN_ROOT=""

# Parse args
while [ $# -gt 0 ]; do
  case "$1" in
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

if [ -z "$DESIGN_ROOT" ] || [ ! -d "$DESIGN_ROOT" ]; then
  echo "testid-catalogue: design root not found — nothing to check."
  exit 0
fi

COMPONENTS_MD="${DESIGN_ROOT}/_shared/components.md"
if [ ! -f "$COMPONENTS_MD" ]; then
  echo "testid-catalogue: ${COMPONENTS_MD#"$ROOT"/} not found — nothing to compare against."
  exit 0
fi

# ── Find all mockup HTML files ──
MOCKUP_FILES="$(find "$DESIGN_ROOT" -path '*/screens/*.html' 2>/dev/null | sort)"
if [ -z "$MOCKUP_FILES" ]; then
  echo "testid-catalogue: no screen mockups found — nothing to check."
  exit 0
fi

# ── Extract all unique testids from mockups ──
# Three platform attributes:
#   web:     data-testid="..."
#   iOS:     accessibilityIdentifier="..."
#   Android: resource-id="..."
#
# contentDescription is NOT an identity attribute (see testid-contract.sh);
# resource-id is the correct Android identity attribute.
MOCKUP_IDS="$(echo "$MOCKUP_FILES" | while IFS= read -r f; do
  perl -ne '
    while (/(?:data-testid|accessibilityIdentifier|resource-id)\s*=\s*"([^"]+)"/g) {
      print "$1\n";
    }
  ' "$f"
done | sort -u)"

if [ -z "$MOCKUP_IDS" ]; then
  echo "testid-catalogue: mockups declare no testids — nothing to check."
  exit 0
fi

TOTAL="$(printf '%s\n' "$MOCKUP_IDS" | grep -c .)"
MISSING=0
FOUND=0
MISSING_IDS=""

# ── Check each mockup testid against the catalogue ──
# A testid is "declared" if it appears anywhere in components.md — in a formal
# table, in backticks in prose, or as a bare word. The catalogue format is
# free-form markdown; grep -F on the full file is the reliable approach.
while IFS= read -r id; do
  [ -z "$id" ] && continue
  if grep -qF -- "$id" "$COMPONENTS_MD" 2>/dev/null; then
    FOUND=$((FOUND + 1))
  else
    MISSING=$((MISSING + 1))
    # Find which mockup file(s) carry this id
    sources=""
    while IFS= read -r f; do
      if grep -qF -- "$id" "$f" 2>/dev/null; then
        sources="${sources}$(basename "$f") "
      fi
    done <<< "$MOCKUP_FILES"
    printf '  FAIL  [testid-catalogue] %s: drawn in mockup(s) (%s) but absent from components.md\n' \
      "$id" "$(echo "$sources" | sed 's/ $//')"
  fi
done <<< "$MOCKUP_IDS"

echo ""
if [ "$MISSING" -gt 0 ]; then
  echo "testid-catalogue: ${FOUND}/${TOTAL} testid(s) catalogued, ${MISSING} missing from components.md"
  exit 1
else
  echo "testid-catalogue: all ${TOTAL} mockup testid(s) appear in components.md"
  exit 0
fi
