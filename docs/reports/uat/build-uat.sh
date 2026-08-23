#!/usr/bin/env bash
# Rebuild the UAT flow document from the current design mockups.
#
#   bash docs/reports/uat/build-uat.sh
#
# Output: docs/reports/uat/uat-flows.html — one self-contained file, images
# embedded, no sibling folder needed. That matters: an earlier version referenced
# a shots/ directory and every image broke the moment the file was opened on its own.
#
# The flow map lives in flows.json and is the ONLY hand-written part. The build
# refuses to finish if a captured state is in no flow, or a flow names a state
# that does not exist — a UAT document that silently drops a state is worse than
# one that never claimed coverage.
set -euo pipefail
cd "$(dirname "$0")/../../.."
BROWSER="${DESIGN_CHECK_BROWSER:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "1/3  chụp màn hình từ docs/design/assistant/screens/"
DESIGN_CHECK_BROWSER="$BROWSER" UAT_TMP="$TMP" node docs/reports/uat/capture.mjs
echo "2/3  nén"
UAT_TMP="$TMP" python3 docs/reports/uat/compress.py
echo "3/3  sinh HTML"
UAT_TMP="$TMP" python3 docs/reports/uat/render.py
echo "xong: docs/reports/uat/uat-flows.html"
