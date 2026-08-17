# Mobile Platform Spec
<!-- Written by: architect-agent | Read by: mobile-agent, qa-mobile-agent -->

## Stack
```
Framework:        [React Native | Expo (managed) | Flutter | Swift+Kotlin (native)]
Language:         [TypeScript | Dart | Swift + Kotlin]
Version:          [RN 0.74 | Flutter 3.x | iOS 17 / Android API 33]
Navigation:       [React Navigation 6 | Expo Router | GoRouter | NavigationStack]
State:            [Zustand | Riverpod | BLoC | @Observable]
Data fetching:    [React Query | Riverpod | async/await]
Local storage:    [MMKV | Hive | SwiftData | Room]
HTTP client:      [axios | dio | URLSession | Retrofit]
Push notifs:      [Notifee | FCM/APNs direct | other]
Testing (unit):   [Jest | flutter_test | XCTest | JUnit]
Testing (E2E):    Appium via WebdriverIO
```

## Project Structure
```
[paste actual source structure here]
# default domain-modular layout:
#   {src}/{module}/mobile/      (cross-platform RN/Flutter) or
#   {src}/{module}/ios/  {src}/{module}/android/   (native)
#   {src}/{module}/__tests__/   (colocated unit tests)
# Resolve real paths via MANIFEST ## Paths.module_src.
```

## Platforms Targeted
```
iOS:     [minimum version — e.g. iOS 16]
Android: [minimum API level — e.g. API 26 / Android 8]
Tablets: [supported? responsive layout rules]
```

## Navigation Patterns
```
Root navigator:   [Stack | Tab | Drawer — and structure]
Auth flow:        [how unauthenticated users are redirected]
Deep links:       [scheme and path patterns]
Back behavior:    [iOS swipe-back: enabled | Android back: behavior]
```

## State Management Pattern
```typescript
// [Paste the exact pattern for global state — e.g. Zustand slice template]
// [Or Riverpod provider pattern for Flutter]
```

## API Client Setup
```typescript
// [Paste the API client config — base URL, auth headers, interceptors]
```

## Design Token Usage
```
Token file:    MANIFEST ## Paths.design_tokens → `mobile` section
iOS pt / Android dp conversion: 1:1 (tokens file values are unitless numbers)
Applying:      [how tokens are imported and applied in this project]
```

## Accessibility IDs Convention
<!-- E2E tests rely on these — must be consistent -->
```
Web (data-testid):         [element-name] e.g. "login-email-input"
iOS (accessibilityLabel):  same value
Android (contentDescription): same value
Pattern:                   [screen-name]-[element-name]
```

## Permissions
<!-- List all runtime permissions the app requests and when -->
| Permission | Platform | When requested | Reason shown to user |
|-----------|---------|---------------|---------------------|
| Camera | iOS + Android | [trigger] | [user-facing reason] |
| Notifications | iOS + Android | [trigger] | [user-facing reason] |

## Build Configuration
```
iOS:
  Bundle ID:     [com.company.app]
  Signing:       [Xcode managed | manual — profiles in {specs}/_shared/platform/ios-signing.md]
  Schemes:       [debug | staging | release]

Android:
  Application ID: [com.company.app]
  Build variants: [debug | staging | release]
  Signing:        [keystore location and config — see {specs}/_shared/env-config.md]
```

## Commands
```bash
# React Native / Expo
start:          [npx expo start | npx react-native start]
ios:            [npx expo run:ios | npx react-native run-ios]
android:        [npx expo run:android | npx react-native run-android]
test:           [jest --testPathPattern={src}/{module}]   # resolve via MANIFEST ## Paths.unit_tests
e2e-ios:        [npx wdio run wdio.conf.ts --platform ios]
e2e-android:    [npx wdio run wdio.conf.ts --platform android]

# Flutter
run:            [flutter run]
test:           [flutter test]
build-ios:      [flutter build ios]
build-android:  [flutter build apk]
```

## Key Constraints
- [e.g. "Offline mode required — all reads must work without network"]
- [e.g. "App must pass App Store review — no private API usage"]
- [e.g. "Android must support back gesture — never disable it"]
- [e.g. "All user-visible strings must use i18n keys"]

---

## Test Harness
<!-- Owned by orchestrator. Brought up before qa-mobile-agent execution phase. Includes the API, Appium server, and simulator/emulator boot. qa-mobile-agent reads the harness outputs at runtime. -->

```yaml
test_harness:
  up: |
    docker compose -f compose.test.yml up -d &&
    appium --base-path /wd/hub &
    xcrun simctl boot "iPhone 15" 2>/dev/null || true &&
    emulator -avd Pixel_7_API_34 -no-snapshot -no-audio -no-boot-anim &
  wait_for: |
    curl -fsS http://localhost:4723/status &&
    xcrun simctl list devices booted | grep -q "iPhone 15" &&
    adb shell getprop sys.boot_completed | grep -q 1
  reset: ""    # per-test app reset is typically done inside the test script via driver.reset()
  down: |
    docker compose -f compose.test.yml down -v &&
    pkill -f appium &&
    xcrun simctl shutdown "iPhone 15" 2>/dev/null &&
    adb -s emulator-5554 emu kill 2>/dev/null
  base_url: "http://localhost:3000"                    # API the mobile app talks to
  appium_url: "http://localhost:4723/wd/hub"           # where qa-mobile-agent connects Appium driver
  ios_simulator: "iPhone 15"                           # default simulator
  android_emulator: "Pixel_7_API_34"                   # default emulator
  ios_bundle_id: "com.example.app.dev"
  android_package: "com.example.app.dev"
  ios_app_path: "./builds/ios/app-dev.app"             # built by mobile-agent, consumed here
  android_apk_path: "./builds/android/app-dev.apk"
  env_file: ".env.test"
```

**Notes:**
- Mobile harnesses are heavy. Expect 60–120s startup time for Appium + both simulators. Factor this into dispatch scheduling.
- If the project only targets iOS (or only Android), omit the unused lines from `up` / `wait_for` / `down`.
- The app build is produced by `mobile-agent` as part of its completion checklist. `ios_app_path` and `android_apk_path` point at those build outputs.
- Real devices (vs. simulators) can be declared by overriding `ios_simulator` / `android_emulator` with a device UDID. Real-device runs should happen in CI, not on every dispatch.
