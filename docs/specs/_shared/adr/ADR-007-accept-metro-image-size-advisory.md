# ADR-007 — Accept the metro/`image-size` advisory for the prototype phase

**Status:** accepted · 2026-08-17 · product owner (decision), architect-agent
(write-up) · **expires — see Review conditions**

## Context

Adding the React Native client (F-003) took `npm audit` from **high: 0**
(F-001 baseline) to **7 high, 0 critical** — a regression this repo
introduced, not inherited noise.

All 7 rows share one root cause: **`image-size`** — denial of service via
infinite loops in its ICNS parser (GHSA-w3rx-r6r6-pgpr) and JXL/HEIF parsers
(GHSA-5p2g-fcmc-qvqq). CVSS 7.5, `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` —
**availability only**, no confidentiality or integrity impact. Chain:
`react-native` (direct dep) → `@react-native/community-cli-plugin` → `metro`
→ `image-size`; `metro-config` and `metro-transform-worker` are the same
metro root. **metro is React Native's build-time bundler — it does not ship
inside the application**, so nothing here is reachable at app runtime.

**Threat model, honestly:** exploitation needs a crafted ICNS/JXL/HEIF image
*processed at bundle time*, so an attacker must land that image in this
project's assets or a dependency's. Implausible today (local prototype,
in-repo assets, no CI bundling foreign input); plausible with an untrusted
asset pipeline, third-party asset packages, or public CI bundling fork PRs.
Even then the payoff is a hung build, not data loss.

## Options considered

1. **`npm audit fix`** (non-force) — verified: resolves nothing.
2. **`npm audit fix --force`** — verified: its only remediation is
   `react-native@0.72.17`, a **downgrade** from `^0.87.0` (~15 minor versions
   back, with its own older advisory surface) that would break F-003. No
   upgrade target exists — RN 0.87 is current and still carries this metro
   subtree. Strictly worse; rejected.
3. **Accept, scoped and expiring** — chosen.

## Decision

Accept the 7 advisories, scoped to: the **prototype phase**, a
**build-time-only** dependency, in a repo with **no deployment target** and no
public CI. Covers exactly the `image-size` root cause reached through metro —
it generalises to no other advisory.

## Review conditions (this expires; it does not rot)

Re-audit and drop the exception unless it still holds: **before** any
public/shared CI bundling untrusted contributions (the trigger that makes the
threat model real); **before** any release, app-store submission, or first
deployment target; **on every `react-native`/`metro` upgrade** — if audit
clears, delete this ADR rather than renewing it; otherwise at the next feature
touching `package.json`.

**What would change the answer:** the advisory upgraded to **critical** or
re-scored with C/I impact (today `C:N/I:N`); a **runtime-reachable** path
found (`image-size` in the shipped app, not the bundler); an untrusted asset
pipeline or third-party asset package entering the project; or a
non-downgrade upstream fix (then it is just an upgrade, not a tradeoff).

## Consequences

`npm audit` stays non-clean this phase. **Reviewer C7 should read this as a
documented accepted risk (conditional pass), not an unreviewed failure** —
provided the output still matches this ADR: 7 high / 0 critical, `image-size`
via metro only. Any new advisory, or any critical, falls outside the exception
and fails C7 normally. Every fact above reproduces from `npm audit --json`.
