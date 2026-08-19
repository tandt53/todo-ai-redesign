// The ONE client-side clock, and the zone every client date computation reads.
//
// ── WHY THIS FILE IS NOT A SECOND SEAM (F-005 AC-44, L-004) ─────────────────
//
// `ControllerDeps.now` is the seam. It is injectable, stored and defaulted, and
// it already feeds `dueAtForCollection` on both clients. What it could NOT do is
// reach the eight `now: Date = new Date()` **default parameters** in
// `_shared/model/{format,tasks}.ts` — a default is what makes a missed injection
// silently read the wall clock instead of raising a type error, which is the
// exact class AC-44 singles out.
//
// So this module holds **no clock of its own**. It is a registry: the bootstrap
// installs a provider that reads the controller's already-injected `now` and the
// account zone, and the eight defaults change from `new Date()` to `nowDate()`.
// One seam (`ControllerDeps.now`), one installer (`installClock`), and a grep for
// either returns every door. Building a *second* clock here — a module-level
// `Date` the controller does not own — is what AC-44 forbids by name.
//
// ── THE ZONE (ADR-010) ─────────────────────────────────────────────────────
//
// `ControllerDeps.timezone` is what this client **reports**. What it **computes
// with** is `account.timezone` from `GET /account`, and never
// `Intl.DateTimeFormat().resolvedOptions().timeZone` — that is the *one row,
// three answers* source ADR-010 rejects by name. `zoneName()` serves the
// computation zone; `null` means the account has no zone yet, which is a state
// the server refuses **writes** in and reads carry as `due_all_day: null`.
//
// ── WHY THE DEFAULT IS THE REAL CLOCK UNTIL SOMETHING INSTALLS ─────────────
//
// Not laziness, and not a fallback that hides a missed injection: with no
// provider installed there is no controller, so there is nothing to have missed.
// Every path that has a controller installs from the bootstrap, and
// `web/seams.ts setClock` drives the same provider. Model-tier unit tests that
// construct no controller keep the real clock, which is what they already
// assert against.

/** What a clock provider answers. Both members come from the controller. */
export interface ClockProvider {
  /** The instant, from `ControllerDeps.now` — never a fresh `new Date()`. */
  nowDate: () => Date
  /** `account.timezone` (ADR-010), or `null` when the account has none yet. */
  zoneName: () => string | null
}

let provider: ClockProvider | null = null

/**
 * Install the one provider. Called by the client bootstrap (`web/main.tsx`;
 * `mobile/boot.ts` owes the same call) and by nothing else — a second installer
 * would be a second answer to "what time is it", which is the whole point of
 * this file existing rather than a `let now` somewhere.
 *
 * Returns the previous provider so a harness can restore it.
 */
export function installClock(next: ClockProvider | null): ClockProvider | null {
  const before = provider
  provider = next
  return before
}

/** The installed provider, or `null` when nothing has installed one. */
export function installedClock(): ClockProvider | null {
  return provider
}

/**
 * The instant. **This is the expression the eight defaulted `now` parameters
 * use**, which is what turns them from eight wall-clock reads into eight reads
 * of the one seam.
 */
export function nowDate(): Date {
  return provider?.nowDate() ?? new Date()
}

/**
 * The zone every client-side date computation resolves in (ADR-010). `null`
 * when the account has no zone: callers state the unknown rather than guessing,
 * because a silent fallback to the device zone is a date that is a day out for
 * exactly the users it is invisible to.
 */
export function zoneName(): string | null {
  return provider?.zoneName() ?? null
}
