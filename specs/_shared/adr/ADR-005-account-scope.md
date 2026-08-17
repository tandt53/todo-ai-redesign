# ADR-005 — Session and dedupe scope: the account (OQ 4)

**Status:** accepted · 2026-08-16 · architect-agent (T-004)

## Context

OQ 4: one open `session.id` per **account** or per **device**? Not enforced
server-side today; two devices currently mean two parallel open sessions.
AC-16 additionally fixes dedupe scope as account-level with retention at least
the offline replay window, and asks how that is implemented.

## Options considered

1. **Per-device sessions.** Matches the accidental status quo; but AC-8's
   undo window ("newest applied turn of the open session") would differ per
   device — device B could undo-clobber what device A just did without either
   seeing it — and AC-16's account-level dedupe would cross session
   boundaries anyway. Two truths, one task table. Rejected.
2. **One open session per account, server-enforced.** All devices resume the
   same conversation (`GET /assistant/session` returns it); serial processing
   per session gives one receipt order across devices; undo window and
   pending questions are consistent everywhere. Chosen.

## Decision

- **One open `assistant_session` per account**, enforced at open: a turn with
  `session_id: null` resumes the account's open session or opens a new one —
  never a second parallel one. Two devices share the session; each device's
  turns interleave in the single receipt order (AC-10), and a question asked
  on one device is answerable from the other (it is just a message).
- **Dedupe implementation (AC-16):** the dedupe key is a **unique index on
  `(user_id, client_turn_id)`** on the turn row itself — account scope by
  construction, valid across session close (a replay after close targets the
  new session and the id is still recognized). Per-status behaviour as
  specced: `applied|asked|undone` re-serve the recorded outcome; `failed`
  re-attempts.
- **Retention:** dedupe lives as long as turn rows; the prototype never
  prunes, and the contract floor is **7 days** — comfortably ≥ any offline
  replay window a mobile client will hold (`client.outgoing_turn` holds at
  most one unacked turn).

## Consequences

- The undo window is globally consistent: "newest applied turn" means the
  same turn on every device; a stale affordance on device B gets the AC-6
  visible refusal, exactly as the spec words it.
- No device-id concept enters the data model at all this phase.
- Concurrent sends from two devices serialize in arrival order; the later
  one may supersede a question the earlier one just asked — that is D2's
  documented rule, not a race.
- A future multi-device "who typed this" attribution would need a device
  field on turns; deliberately out of scope now.
