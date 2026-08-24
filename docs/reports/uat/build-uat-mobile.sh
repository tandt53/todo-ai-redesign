#!/usr/bin/env bash
# Build the mobile half of the acceptance book from REAL device screenshots.
#
#   bash docs/reports/uat/build-uat-mobile.sh
#
# Output: docs/reports/uat/uat-mobile.html
#
# Why this is a second book rather than a section inside uat-real.html: that one
# is produced by Playwright against the web client and runs anywhere; this one
# needs a booted simulator and emulator, which a cloud session does not have.
# Merging them into one script would mean the whole book fails to build on the
# machine that can only produce half of it — which is exactly how the mobile
# client came to be missing from the first book with only a sentence to say so.
#
# The two books share their stylesheet, their card structure and their verdict
# controls, taken from uat-real.html at build time rather than copied, so they
# cannot drift apart.
set -euo pipefail
cd "$(dirname "$0")/../../.."
SHOTS="${SHOTS:-output/app-shots/mobile}"
[ -d "$SHOTS" ] || { echo "chưa có ảnh: $SHOTS — chạy .mobile-app/shoot-mobile.sh trước"; exit 1; }
python3 docs/reports/uat/render-mobile.py "$SHOTS" > docs/reports/uat/uat-mobile.html
echo "docs/reports/uat/uat-mobile.html  $(du -h docs/reports/uat/uat-mobile.html | cut -f1)"
