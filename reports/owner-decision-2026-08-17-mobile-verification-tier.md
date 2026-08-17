# Owner decision, 2026-08-17 — accept the browser render as mobile's verification tier, for now

Owner: *"Tắt hết máy ảo đi, tạm chấp nhận test với web mobile screening."*

## The decision

The iOS Simulator and Android emulator are **shut down and not to be started**. Mobile
behaviour is verified at two tiers instead of three:

1. **Model tier** (vitest, `createSurface()`) — unchanged, and it carries most of AC-30.
2. **Browser render** (`.mobile-preview/`) — the real React Native components rendered
   through `react-native-web`, driven by the real `MobileAssistantController`.

The device tier is **deferred, not deleted**. `qa/assistant/F-001/mobile/TC-009` stays
authored and unrun.

## Why this is a reasonable trade — and exactly where it is not

The browser render is more than a mockup: it is the same component source and the same
controller, so **layout, state and copy** are genuinely exercised. That covers most of what
the device tier was wanted for.

What it **cannot** settle, and must not be reported as if it did:

- **Native text shaping.** The browser lays out text with its own engine, so the two-line
  clamp on the new-message affordance — *does the question survive, or ellipsise to
  "Waiting for your answer — Delete …"* — is **not** verified by a browser render. This is
  AC-30 clause (e)'s legibility half, and qa-mobile already flagged it as the one part of
  (e) no available tier can check. That remains true and this decision does not change it.
- **The BUG-006 scroll race on a real `ScrollView`.** RN's scroll animation and a browser's
  are different implementations. A browser render can demonstrate the *logic*; it cannot
  prove the platform's animation behaves the same way.
- Safe-area insets, keyboard avoidance, momentum scrolling, and anything the OS draws.

## The rule this creates

**Any mobile result obtained from the browser render says so.** A QA run record, a bug
report or a task note that claims mobile verification without naming the tier is a false
claim under this decision — it is exactly the "asserted presence, not position" failure
that produced BUG-004, one level up.

`.mobile-app/` (the Expo shell that builds and installs on a simulator) is **kept**, not
deleted: it works, it found BUG-003, and re-running it is the cheapest way back when a
device pass is wanted. It holds ~4.2 GB of build artefacts, all gitignored.

## Standing debt

| Owed | Why it needs a device |
|---|---|
| TC-009 (AC-30 device tier) | real layout: on-screen visibility, overlay-vs-reflow, the two-line clamp, animated scroll landing |
| BUG-006 race on mobile | RN `ScrollView` animation is not the browser's |
| F-003 AC-9/10/11/12 | still unticked from the original device-pending set |
