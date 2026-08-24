#!/usr/bin/env bash
# Photograph the REAL mobile app on both phones, Talk surface and Tasks surface.
#
#   bash .mobile-app/shoot-mobile.sh                    # both platforms, every state
#   bash .mobile-app/shoot-mobile.sh ios                # one platform
#   OUT=/tmp/shots bash .mobile-app/shoot-mobile.sh     # choose the folder
#
# Why this exists alongside shoot-sim.sh: that script covers the 17 Talk states
# and stops there, because the Tasks surface has no deep link of its own. Every
# attempt to reach it by tapping is unreliable — `idb ui text` trips the React
# Native dev menu mid-string and swallows the rest of what you typed, which is
# how three task titles came back truncated and looked like an app defect.
#
# So the Tasks surface is reached the one way that holds: seed through a deep
# link that already loads tasks, then press the single control that switches
# surfaces, and read the accessibility tree to confirm the switch happened
# before the shutter. No typing anywhere.
set -u
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$(dirname "$0")/.."
OUT="${OUT:-output/app-shots/mobile}"
IOS_UDID="${IOS_UDID:-$(xcrun simctl list devices 2>/dev/null | grep -m1 Booted | grep -oE '[0-9A-F-]{36}')}"
WANT="${1:-both}"

TALK=(idle-empty listening thinking applied-diff idle-tasks question-confirm \
      applied-delete reverted question-clarify no-match error offline mic-permission)
# Tasks-surface states now have deep links of their own (App.tsx). Before they
# existed this list held seeds that were tapped into place, and a run came back
# with the Talk surface captioned as the task list.
TASKS=(tasks-empty tasks-list tasks-drawer)

mkdir -p "$OUT"

# A debug build dies at launch if it cannot reach Metro, and the failure looks
# nothing like its cause: the process appears, the launcher takes focus back,
# and every screenshot is the home screen. The emulator reaches the host only
# through these forwards, and they do not survive an emulator restart.
if adb devices 2>/dev/null | grep -q 'device$'; then
  adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1
  adb reverse tcp:4460 tcp:4460 >/dev/null 2>&1
fi

ready() {  # $1 platform — block until the app has painted something we can identify
  # `menu-` is in the list because the drawer states paint nothing else: the
  # drawer covers the surface, so waiting only for `shell-` or `tasks-bar` sees
  # a brief flash of the list underneath and returns before the drawer arrives.
  local n=0
  while [ $n -lt 40 ]; do
    if [ "$1" = ios ]; then
      idb ui describe-all --udid "$IOS_UDID" 2>/dev/null | grep -q 'shell-\|tasks-bar\|assistant-\|menu-' && return 0
    else
      adb shell uiautomator dump /sdcard/w.xml >/dev/null 2>&1 &&
        adb shell cat /sdcard/w.xml 2>/dev/null | grep -q 'shell-\|tasks-bar\|assistant-\|menu-' && return 0
    fi
    sleep 1; n=$((n+1))
  done
  return 1
}

open_scenario() {  # $1 platform  $2 scenario
  if [ "$1" = ios ]; then
    xcrun simctl terminate "$IOS_UDID" com.todoai.sim >/dev/null 2>&1
    sleep 1
    xcrun simctl openurl "$IOS_UDID" "com.todoai.sim://s/$2" >/dev/null 2>&1
  else
    adb shell am force-stop com.todoai.sim >/dev/null 2>&1
    sleep 1
    # Android registers the scheme `todoai`, iOS registers the bundle id as the
    # scheme. One URL for both silently opens nothing on Android — the launcher
    # keeps focus and every shot comes back as the home screen.
    adb shell am start -a android.intent.action.VIEW -d "todoai://s/$2" >/dev/null 2>&1
  fi
  ready "$1"
}

centre_of() {  # $1 platform  $2 testid → "x y", empty if absent
  if [ "$1" = ios ]; then
    idb ui describe-all --udid "$IOS_UDID" 2>/dev/null | python3 -c "
import json,sys
try: j=json.load(sys.stdin)
except Exception: sys.exit()
for x in j:
    if x.get('AXUniqueId')=='$2':
        f=x['frame']; print(int(f['x']+f['width']/2), int(f['y']+f['height']/2)); break"
  else
    adb shell uiautomator dump /sdcard/w.xml >/dev/null 2>&1
    adb shell cat /sdcard/w.xml 2>/dev/null | python3 -c "
import sys,re
x=sys.stdin.read()
m=(re.search(r'resource-id=\"$2\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"',x)
   or re.search(r'bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"[^>]*resource-id=\"$2\"',x))
if m: print((int(m.group(1))+int(m.group(3)))//2, (int(m.group(2))+int(m.group(4)))//2)"
  fi
}

tap() {  # $1 platform  $2 testid → 0 if it was there and was tapped
  local p; p="$(centre_of "$1" "$2")"
  [ -z "$p" ] && return 1
  if [ "$1" = ios ]; then idb ui tap --udid "$IOS_UDID" $p >/dev/null 2>&1
  else adb shell input tap $p >/dev/null 2>&1; fi
  sleep 2; return 0
}

goto_collection() {  # $1 platform  $2 label — tap a row in the open drawer
  local p
  if [ "$1" = ios ]; then
    p="$(idb ui describe-all --udid "$IOS_UDID" 2>/dev/null |
      python3 "$SELF_DIR/pick.py" ios "$2")"
  else
    adb shell uiautomator dump /sdcard/w.xml >/dev/null 2>&1
    p="$(adb shell cat /sdcard/w.xml 2>/dev/null |
      python3 "$SELF_DIR/pick.py" android "$2")"
  fi
  [ -z "$p" ] && return 1
  if [ "$1" = ios ]; then idb ui tap --udid "$IOS_UDID" $p >/dev/null 2>&1
  else adb shell input tap $p >/dev/null 2>&1; fi
  sleep 2; return 0
}

has_present() {  # $1 platform  $2 testid
  if [ "$1" = ios ]; then
    idb ui describe-all --udid "$IOS_UDID" 2>/dev/null | grep -q "$2"
  else
    adb shell uiautomator dump /sdcard/w.xml >/dev/null 2>&1
    adb shell cat /sdcard/w.xml 2>/dev/null | grep -q "$2"
  fi
}

has_rows() {  # $1 platform — is there at least one task row on screen?
  # Match the checkbox, not the row: iOS collapses the row into its children in
  # the accessibility tree, so `assistant-task-row` never appears there even
  # when six tasks are plainly on screen.
  if [ "$1" = ios ]; then
    idb ui describe-all --udid "$IOS_UDID" 2>/dev/null | grep -qE 'assistant-task-checkbox|assistant-task-row'
  else
    adb shell uiautomator dump /sdcard/w.xml >/dev/null 2>&1
    adb shell cat /sdcard/w.xml 2>/dev/null | grep -qE 'assistant-task-checkbox|assistant-task-row'
  fi
}

shot() {  # $1 platform  $2 name
  sleep 1
  if [ "$1" = ios ]; then xcrun simctl io "$IOS_UDID" screenshot "$OUT/$1-$2.png" >/dev/null 2>&1
  else adb exec-out screencap -p > "$OUT/$1-$2.png" 2>/dev/null; fi
  [ -s "$OUT/$1-$2.png" ] && echo "  ok  $1-$2" || echo "  --  $1-$2 (trống)"
}

run_platform() {  # $1 = ios | android
  local p="$1"
  echo "== $p =="
  for s in "${TALK[@]}"; do
    open_scenario "$p" "$s" || { echo "  --  $p-talk-$s (app không lên)"; continue; }
    shot "$p" "talk-$s"
  done
  for s in "${TASKS[@]}"; do
    open_scenario "$p" "$s" || { echo "  --  $p-$s (app không lên)"; continue; }
    # A row must be on screen before the shutter for the states that promise
    # one. Confirming the surface changed says nothing about whether it has
    # any content, which is how an empty list got captioned as the task list.
    # Each state promises something different, so each asserts on its own
    # evidence. Asserting rows everywhere marks the drawer state as broken —
    # the drawer covers the list, so no checkbox is in the tree while it is open.
    sleep 1   # let the last dispatch settle before asking what is on screen
    case "$s" in
      tasks-empty)  ok=yes ;;
      tasks-drawer) has_present "$p" menu-collection-row && ok=yes || ok=no ;;
      *)            has_rows "$p" && ok=yes || ok=no ;;
    esac
    if [ "$ok" = yes ]; then
      shot "$p" "$s"
    else
      echo "  --  $p-$s (không thấy thứ trạng thái này hứa)"
    fi
  done
}

[ "$WANT" = both ] || [ "$WANT" = ios ] && { [ -n "$IOS_UDID" ] && run_platform ios || echo "== ios == không có simulator nào đang chạy"; }
[ "$WANT" = both ] || [ "$WANT" = android ] && { adb devices 2>/dev/null | grep -q 'device$' && run_platform android || echo "== android == không có emulator nào đang chạy"; }

echo
echo "$(ls "$OUT"/*.png 2>/dev/null | wc -l | tr -d ' ') ảnh trong $OUT"

# Identical frames under different captions are the worst failure this script
# can produce: a reviewer ticks "pass" on a step they never saw. It happened —
# question-confirm, applied-delete and reverted all came back as the same iOS
# frame, because the chip tap and the undo tap never fired and every state
# stopped at the confirm question. Nothing in the capture could tell.
python3 - "$OUT" <<'DUP'
import hashlib, os, sys, collections
out = sys.argv[1]
seen = collections.defaultdict(list)
for f in sorted(os.listdir(out)):
    if not f.endswith('.png'):
        continue
    seen[hashlib.md5(open(os.path.join(out, f), 'rb').read()).hexdigest()].append(f)
dups = [v for v in seen.values() if len(v) > 1]
if dups:
    print()
    print('CẢNH BÁO — các ảnh giống hệt nhau, tức có bước không thực sự xảy ra:')
    for group in dups:
        print('  ' + ' = '.join(group))
DUP
