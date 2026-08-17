#!/usr/bin/env bash
# Drive the installed app through every scenario on one simulator and capture
# each screen. simctl/adb cannot tap, so each scenario is opened as a deep link
# and the app replays it through the real controller (see App.tsx).
set -u
PLAT="$1"; OUT="$2"; ID="${3:-}"
S=(idle-empty listening listening-words thinking applied-diff idle-tasks \
   question-confirm applied-delete reverted question-clarify no-match error \
   offline reconnected mic-permission mic-transient mic-hidden)
mkdir -p "$OUT"
for name in "${S[@]}"; do
  if [ "$PLAT" = ios ]; then
    xcrun simctl terminate "$ID" com.todoai.sim >/dev/null 2>&1
    sleep 1
    xcrun simctl openurl "$ID" "com.todoai.sim://s/$name" >/dev/null 2>&1
  else
    adb shell am force-stop com.todoai.sim >/dev/null 2>&1
    sleep 1
    adb shell am start -a android.intent.action.VIEW -d "todoai://s/$name" -p com.todoai.sim >/dev/null 2>&1
  fi
  sleep 9
  if [ "$PLAT" = ios ]; then
    xcrun simctl io "$ID" screenshot "$OUT/S-ios-$name.png" >/dev/null 2>&1
  else
    adb exec-out screencap -p > "$OUT/S-android-$name.png" 2>/dev/null
  fi
  echo "  ✓ S-$PLAT-$name"
done
