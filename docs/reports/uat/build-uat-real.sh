#!/usr/bin/env bash
# Rebuild the UAT book from the RUNNING product.
#
#   bash docs/reports/uat/build-uat-real.sh            # every flow
#   bash docs/reports/uat/build-uat-real.sh F9 F12     # just these, merged in
#
# Output: docs/reports/uat/uat-real.html — one self-contained file, images
# embedded, no sibling folder needed.
#
# It boots the same two processes the e2e suite uses (the QA API harness and the
# Vite dev server), drives the real web client, and photographs what a person
# would see. There is no compression pass: 58 frames of a dark UI are 2.5 MB raw,
# and re-encoding cost minutes while softening the text a reviewer has to read.
#
# The mobile client is React Native with no browser entry point, so it is not in
# this book. That absence is stated on the page rather than filled with drawings.
set -euo pipefail
cd "$(dirname "$0")/../../.."
BROWSER="${DESIGN_CHECK_BROWSER:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
TMP="${UAT_TMP:-/tmp/uatreal}"
API_PORT="${PORT:-4460}"; WEB_PORT="${WEB_PORT:-5173}"
mkdir -p "$TMP/png"

started=""
if ! curl -sf "http://localhost:$API_PORT/__qa__/ai-calls" >/dev/null 2>&1; then
  PORT="$API_PORT" npm run test:e2e:harness >"$TMP/harness.log" 2>&1 &
  started="$started $!"
fi
if ! curl -sf "http://localhost:$WEB_PORT/" >/dev/null 2>&1; then
  WEB_PORT="$WEB_PORT" npm run dev:web >"$TMP/vite.log" 2>&1 &
  started="$started $!"
fi
# shellcheck disable=SC2064
trap "kill $started 2>/dev/null || true" EXIT
for _ in $(seq 1 40); do
  curl -sf "http://localhost:$API_PORT/__qa__/ai-calls" >/dev/null 2>&1 \
    && curl -sf "http://localhost:$WEB_PORT/" >/dev/null 2>&1 && break
  sleep 1
done

echo "1/2  chụp sản phẩm đang chạy"
DESIGN_CHECK_BROWSER="$BROWSER" UAT_TMP="$TMP" UAT_STAMP="$(date -u +%FT%TZ)" \
  node docs/reports/uat/capture-real.mjs "$@"
echo "2/2  sinh HTML"
UAT_TMP="$TMP" python3 docs/reports/uat/render-real.py
echo "xong: docs/reports/uat/uat-real.html"
