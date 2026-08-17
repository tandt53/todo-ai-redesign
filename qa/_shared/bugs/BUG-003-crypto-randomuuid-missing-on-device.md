# BUG-003 — the mobile client cannot generate an id on a real device runtime

- **Severity:** HIGH — blocks every turn on device; the app is unusable on a handset
- **Found:** 2026-08-17, first execution of the client on an iOS Simulator (T-057)
- **Status:** OPEN
- **Affects:** `src/assistant/_shared/controller.ts:97` — shared, so mobile **and** web read it
- **Platforms:** iOS + Android (React Native / Hermes). Web is unaffected.

## What happens

Sending any turn on the simulator throws before a request is made:

```
ERROR  [Error: Uncaught (in promise, id: 0): "ReferenceError: Property 'crypto' doesn't exist"]
```

The screen renders correctly and then nothing responds — no error bubble, no retry
affordance, because the throw happens in the controller before the turn is
composed. The user sees a dead app, not a failure.

## Root cause

```ts
// src/assistant/_shared/controller.ts:97
this.uuid = deps.uuid ?? (() => crypto.randomUUID())
```

`crypto.randomUUID()` is a Web Crypto global. It exists in Node ≥ 19 and in
browser secure contexts (localhost counts), and it **does not exist in Hermes**,
the JS engine React Native runs on device. The default is therefore correct on
every tier the project executes and wrong on the only tier that ships.

`this.uuid()` is called at `:261` (`clientTurnId`, every turn) and `:594`, so
the first user action fails.

## Why no existing check caught it

This is `LEARNINGS.md` L-003 in its purest form — *an AC whose only assertion
lives in a tier nobody executes is uncovered in practice while every coverage
check reports it covered.*

- **469/469 unit tests pass.** They run under vitest in Node, where `crypto` is a global.
- **The Playwright/browser tier passes.** Browsers expose `crypto.randomUUID` on localhost.
- **The react-native-web render passes.** Same reason — it is still a browser.
- `specs/_shared/platform/mobile.md` states the tier gap as a deliberate choice:
  *"This phase ships prototype-grade RN code whose logic is fully unit-tested
  under Node with vitest — no simulator, no emulator, no Metro."* The gap was
  known; this is the first defect to come out of it.

Note that the tests **cannot** catch this even in principle by injecting `uuid`:
every harness passes its own `uuid` for determinism, so the production default
is the one line no test ever exercises.

## Fix

Replace the default with one that works on all three runtimes. Do **not** reach
for a `uuid` npm package — the id only needs to be unique per client turn, and
`_shared/` must stay dependency-free (it is imported by web, mobile and tests).

Suggested shape — feature-detect, then fall back:

```ts
this.uuid = deps.uuid ?? defaultUuid
// defaultUuid: use globalThis.crypto?.randomUUID?.() when present,
// else compose an RFC-4122 v4 string from Math.random().
```

**Prove it fails first.** A regression test must exercise the *production
default*, not an injected one — construct a controller with no `uuid` dep while
`globalThis.crypto` is temporarily undefined, and assert it still produces a
turn id. Without that, the fix is untestable by the same tier gap that hid it.

## Follow-up worth deciding separately

Two other Web-only globals should be audited the same way before a device build
is attempted again: anything reached through `globalThis` in `_shared/`. This
one was found by running the app; the rest have the same blind spot.
