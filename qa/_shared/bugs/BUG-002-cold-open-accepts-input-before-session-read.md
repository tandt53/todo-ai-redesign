# BUG-002 — a cold open accepts and dispatches a turn before reading the session, losing the boundary message

## Metadata

| Field | Value |
|-------|-------|
| ID | BUG-002 |
| Filed | 2026-08-17 by qa-mobile-agent (T-021, `phase: execute`) |
| Severity | HIGH |
| Layer | `mobile` (`src/assistant/mobile/controller.ts` — `init()`) |
| Feature | F-003 (mobile-surface), AC-8; F-001 AC-28 |
| Failing test case | `qa/assistant/F-003/mobile/TC-030-foreground-reads-session-before-accepting-input.md` |
| Failing assertion | `qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts` → "cold open behaves identically to resume — the session read comes first (BUG-002)" |
| Status | **FIXED** 2026-08-17 (T-024) |

## Summary

On a **cold open**, the mobile client accepts new input and puts
`POST /assistant/turn` on the wire **before** `GET /assistant/session` is even
issued — so a turn typed during app start opens a *new* session, and a
previously closed session's boundary message is never rendered.

## Reproduction steps

1. Construct a mobile `Surface` for a user whose server-side session is **closed**
   (it carries a close marker, and in the repro also a question declined by the
   close).
2. Call `start()` (cold open) and, without awaiting it, set composer text and
   `submit('typed')` — the window a real user hits by typing while the app is
   still starting on a slow connection.
3. Observe the request order and the rendered conversation.

Observed request order on `/assistant/*` (3× in isolation, identical every time):

```
POST /assistant/turn
GET  /assistant/session
```

Rendered conversation after the cold open onto a **closed** session:

```
message kinds: ["user", "applied"]
boundary count: 0
```

## Expected

**F-003 AC-8:** "Every foreground transition (resume **or cold open**) re-reads
`GET /assistant/session` **before** accepting new input, and renders whatever
the server reports: an open session resumes visibly, a closed one renders
exactly one boundary message and starts clean (F-001 AC-28)."

**TC-030 expected behaviour:** "The **first** `/assistant/*` request after every
foreground is `GET /assistant/session`. A turn dispatched before it fails this
test." and "Step 3: cold open behaves identically to resume — both are
foreground transitions."

So: `GET /assistant/session` first, the input held and dispatched after the read
resolves, and exactly one `assistant-boundary-marker` message for the closed
session before the new turn renders below it.

## Actual

- `POST /assistant/turn` is the first `/assistant/*` request on a cold open.
- The turn carries `session_id: null`, so the server opens a **new** session.
  The subsequent `GET /assistant/session` then reports that new open session,
  and the closed one is never reconciled.
- **Zero** boundary messages render. The close marker, every question declined
  by the close (named with its task titles), and every late outcome are silently
  discarded — content F-001 AC-28 and TC-031 exist to guarantee.

Resume (`onForeground()`) is correct: the read completes first and the turn is
held. Only the cold-open path is broken.

## Root cause

`src/assistant/mobile/controller.ts`:

- `onForeground()` (line 141) builds its reconciliation as one promise and
  assigns it to `this.foregroundSync` (line 158). `send()` (line 387) and
  `tapMic()` (line 246) wait on that gate, and `acceptingInput()` (line 188) is
  `this.foregroundSync === null`. That is AC-8 enforced rather than intended.
- `init()` (line 123) does the equivalent reconciliation — its own comment even
  says "A cold open after a kill is the same reconciliation as a resume" — but
  it **never assigns `foregroundSync`**. During `init()`, `acceptingInput()`
  returns `true` and `send()` finds a null gate, so the turn goes straight out.

## Environment

- Run ID: `qa/assistant/runs/2026-08-17-mobile-execute.md`
- Command: `npx vitest run qa/assistant/automation/mobile`
- Stack: TypeScript strict + vitest, node env, no simulator (`specs/_shared/platform/mobile.md ## Test Harness`)
- Reproduced 3/3 in isolation — not a flake.

## Suggested next step

**mobile-agent:** in `src/assistant/mobile/controller.ts`, have `init()` set
`this.foregroundSync` around its reconciliation exactly as `onForeground()`
does — most simply by wrapping the `readPermissions()` + `super.init()` body in
the same run-promise-and-gate pattern, or by having `init()` delegate to a
shared private method that both entry points call. The gate must be set
*before* the first `await`, otherwise the same race reopens.

Watch for one detail: `super.init()` performs the session read, so the gate has
to be installed synchronously at the top of `init()` — assigning it after the
first `await this.readPermissions()` still leaves a window.

Not a bug in `_shared/AssistantController`: the gate is a mobile-owned
lifecycle rule (AC-8), and the web client has no cold-open-with-kill path.
