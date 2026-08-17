# Project Learnings

<!--
Durable, human-curated insights about this codebase. Agents read this on startup
to avoid re-deriving lessons the pipeline has already paid for.

OWNERSHIP:
- reviewer-agent APPENDS entries when a C1–C14 failure reveals a pattern worth remembering
  (e.g., a bug with a recurring shape, a contract-drift class, a test anti-pattern).
- Humans CURATE: prune outdated entries, promote recurring ones into standards docs,
  correct framing.
- Spec-agent, architect-agent, and QA agents READ — they do not write.

SCOPE: entries should be general enough to guide future work, specific enough to act on.
"Be careful with async" is too vague. "In Next.js 14, page props `params` is a Promise and
must be awaited before destructuring" is actionable.
-->

## Format

Each entry is a level-2 heading (`## L-NNN — short title`) with:

- **Date added** — YYYY-MM-DD by {agent or human}
- **Trigger** — what prompted this lesson? (bug ID, review fail, task ID, spec revision)
- **Pattern** — the lesson, one paragraph. Phrase as *what went wrong* or *what works*.
- **How to apply** — concrete guidance for future work. Name files/functions/conventions.
- **Scope** — file globs or modules where this applies (or `project-wide`)
- **Stale check** — when should this be revisited? (specific date or `permanent`)

Entries are **append-only by agents**; humans may edit or delete.

---

## Entries

<!-- Agents append new entries below this line. Humans may reorder or prune. -->

### L-001 — C12's mutation tool destroys untracked files; back up before running it

> **RESOLVED 2026-08-17 (orchestrator).** The repo now has a baseline commit
> (`b83d9c6`), so `git checkout --` restores mutated files and
> `suite-can-fail.sh` can no longer leave source corrupted while reporting PASS.
> Verified by mutating `permissions.ts` and restoring it. The entry stays as the
> record of four consecutive reviews where a manual restore was the only thing
> preventing shipped mutations — and as the reason a fresh project should be
> committed before its first C12 run.

- **Date added** — 2026-08-16 by reviewer-agent
- **Trigger** — T-008, F-001 structural review. The C12 run mutated `src/assistant/api/errors.ts` and left it mutated on disk.
- **Pattern** — `.claude/tools/test-quality/suite-can-fail.sh` guards the working tree with `git diff --quiet` and restores with `git checkout -- <file>`. Both assume the target files are **tracked**. For an untracked file `git diff --quiet` reports clean (so the dirty-tree guard waves it through) and `git checkout --` cannot restore it (so the mutation is permanent). In a project whose first commit has not landed — which is every project during its first feature — the tool silently corrupts the implementation it was asked to evaluate. The check reports PASS while leaving broken code behind, which is worse than reporting nothing.
- **How to apply** — Before running C12 in a repo where `git status --porcelain` shows `??` for the implementation files: copy the source tree to a scratch directory, record `find <src> -type f -exec cksum {} \;` sorted to a manifest, run the tool, then diff the manifest and restore from the copy on any difference. Re-run the suite after restoring to confirm green. The durable fix is to make the tool's dirty-check use `git ls-files --error-unmatch` (or `git status --porcelain`) so untracked files trip the guard instead of slipping past it.
- **Scope** — project-wide; any C12 dispatch before the repo has a baseline commit
- **Stale check** — revisit once `suite-can-fail.sh` guards untracked files, or once this repo has a baseline commit

### L-002 — Tool verdicts that grep source text are evidence, not proof — check the rendered/executed observable

- **Date added** — 2026-08-16 by reviewer-agent
- **Trigger** — T-008, F-001 structural review. C14 reported 3 of 22 testids missing; all 3 were present. A first C12 web run reported FAIL having mutated only config files.
- **Pattern** — Two of the three tool-driven checks in this review returned a wrong verdict for the same underlying reason: they inspect **source text** and reason about it line by line, while the property they claim to check is a **runtime** one. `testid-contract.sh` matches `data-testid=` with a single-line regex, so an attribute computed by a multi-line JSX ternary (`data-testid={ cond ? 'a' : 'b' }`) is invisible and reads as absent. `suite-can-fail.sh` iterates files in `find` order with a 4-attempt budget, so a layer whose entry point, test seams, and build config sort first exhausts the budget on code no unit test covers and reports the suite cannot fail. Both failures point away from the real state of the code, and both are the *confident* kind of wrong — a specific list of named testids, a specific count of surviving mutations.
- **How to apply** — When a text-scanning tool reports a failure, confirm it against an execution observable before writing it into a report. For testids: render the component and query the DOM (`src/assistant/web/__tests__/app.test.tsx:310` does exactly this — parse the mockup catalogue, render every state, assert `missing` and `invented` are both empty; prefer this over the grep tool). For mutation checks: pass the behavioural core explicitly via `--files` (reducers, controllers, message builders, components) rather than a whole directory, and treat mutations landing in `main.*`, `*.config.*`, or seam/bootstrap files as inert rather than as findings — the tool's own header says a mutation that changes no behaviour does not count. Record which observable settled it, so the next reviewer inherits the resolution rather than the tool's verdict.
- **Scope** — project-wide; `.claude/tools/design-check/testid-contract.sh`, `.claude/tools/test-quality/suite-can-fail.sh`
- **Stale check** — permanent (the class of failure outlives either specific tool)

### L-003 — A test file that was never executed still counts as coverage everywhere except reality

- **Date added** — 2026-08-16 by reviewer-agent
- **Trigger** — T-008e, F-001 structural re-verify. Both automation suites named in `Links.tested_by` had never run: the api spec failed 46/46 on `require('../../src/assistant/api/store/memory')` (real path `store/memory-store.ts`, real export `MemoryStore`, and `require` in an ESM package), and the e2e spec collected 0 tests because `@playwright/test` was never installed and no Playwright config exists. The previous review pass reported C5 PASS on "167 passed".
- **Pattern** — The unit tiers and the automation tier were verified by *different commands*, and only the unit commands were ever run. `specs/_shared/platform/*.md ## Test Harness` names `vitest run src/assistant/{api,web}` — both green, both honest, both scoped to `src/**`. Nothing in that harness contract reaches `qa/**`, so an automation file can be authored, listed in `Links.tested_by`, counted by a coverage matrix, and cited in 72 TC markdown files while never once being imported. The failure is invisible from every direction that matters: C1 sees a non-empty path that exists, C2 sees P1 TCs that cite the right ACs, and C5 sees a green suite — because C5 was pointed at the other tier. The tell was `package.json`'s own aggregate command: `npm run test:all` (`vitest run`, no path) was red at `46 failed | 167 passed`, and nobody had run it.
- **How to apply** — For C5, run the platform-doc commands **and** every executable artifact named in `Links.tested_by`, separately, and report them as separate numbers. A `tested_by` entry pointing at a `.spec.ts`/`.test.ts` is a claim that the file runs; verify it by running it, not by confirming it exists and is non-empty. Run the project's own aggregate command (`test:all` or equivalent) at least once — it is the cheapest way to find a tier nobody is executing. When a QA agent authors automation against a layout it has not imported (watch for comments like "per backend.md store/ layout; align imports"), treat that as unrun until proven otherwise. Corollary: an AC whose only assertion lives in a dead suite is uncovered in practice — F-001's `undone: true` on the idempotent-replay path survived a C12 mutation for exactly this reason.
- **Scope** — project-wide; any feature whose `Links.tested_by` names files outside the platform docs' test-harness paths
- **Stale check** — revisit once C5's procedure requires executing `Links.tested_by` entries explicitly, or once a single test command covers every declared tier

### L-004 — A "single source of truth" that lives in two files announces its drift as a workaround, not as a failure

- **Date added** — 2026-08-16 by reviewer-agent
- **Trigger** — T-012, F-001 structural re-verify (pass 3). The canonical utterance→intent fixture table exists as `qa/assistant/F-001/api/utterance-intent-fixtures.json` (24 rows) *and* `src/assistant/api/ports/fixture-table.ts` (23 rows); the QA copy declares `UT-DELETE-BULK-2` and the implementation copy does not.
- **Pattern** — The spec's Test strategy declares **one** table "shared by QA and implementers", and MANIFEST `## Ownership` exists precisely to stop a fact being copied between files. But the table has to be *data* for QA to read and *code* for the server to execute, so it was written twice, and the copies diverged by one row. The tell was not a red test. Both automation tiers hit the missing row, and both **independently invented a local replacement** — the web harness via `QA_EXTRA_ROWS` (`qa-test-server.ts:41`) and the api suite via an inline stub branch (`spec.ts:174`) — each using the extension mechanism the spec sanctions, each documented, each green. The suites pass, the coverage matrix is satisfied, and nothing anywhere reports that the shared artifact is no longer shared. Two agents solving the same missing precondition in two different places, both correctly, is the signature: when a divergence shows up as duplicated workarounds instead of a failure, the thing that diverged was a duplicated source of truth.
- **How to apply** — When a spec declares an artifact canonical and "shared" across roles, check early whether it is physically one file. If it cannot be (data on one side, executable on the other), make one the generated or imported product of the other rather than a hand-kept twin, and say so in `MANIFEST ## Ownership`. When reviewing, treat *any* `EXTRA_ROWS` / `extend the fixtures` / `local override` construct as a question to ask upstream, not as the accepted design it is documented to be — it is cheap to add and therefore records a gap silently. Note the reviewer-side limit that let this survive three passes: C9 sweeps endpoints against api-contracts.md and entities against data-model.md, so an artifact that is neither is outside every numbered check even when it is named canonical in the spec.
- **Scope** — project-wide; any artifact a spec calls canonical and shared that exists in more than one file. Currently: the F-001 fixture table.
- **Stale check** — revisit once the fixture table has one physical home (or a generated second copy), or once a check covers spec-declared canonical artifacts that are neither endpoints nor data-model entities

### L-005 — A rule enforced by one entry point and merely intended by another is the shape both F-003 bugs took

- **Date added** — 2026-08-17 by reviewer-agent
- **Trigger** — T-022, F-003 structural review. BUG-002 (cold open accepted input before the session read) and BUG-001's mobile half (offline creates never replayed) were filed independently, days apart, by different assertions — and turned out to be the same defect twice.
- **Pattern** — Both bugs are a state machine with **two doors into the same room, and the guard standing at only one of them**. `onForeground()` gated input on the session read via `foregroundSync`; `init()` ran the same reconciliation and never installed the gate, so a cold open dispatched a turn before `GET /assistant/session` and a previously closed session's boundary message was silently lost. Independently, `setOnline()` replayed offline-created tasks and `onForeground()` did not — so a user who reopened the app while still offline, then regained connectivity through the foreground path rather than a connectivity event, never got their tasks replayed. In both cases the AC named **two** triggers ("resume **or cold open**", "reconnect") and the implementation honoured one. The fix both times was the same move: stop duplicating the obligation at each entry point and route every entry through a **single shared installer** that performs it. The tell for reviewers is structural, not behavioural — when an AC's subject is a *transition* rather than an action, count the code paths that can produce that transition and check the obligation is attached to the transition, not to one of its callers.
- **How to apply** — When an AC names two or more triggers for one obligation (resume/cold-open, reconnect/foreground, retry/replay), write one test per trigger and make them **structurally different tests**, not one parameterised over a shared setup — a shared setup is exactly what hides the door nobody guarded. Every pre-existing AC-8 test `await`ed `init()` before asserting, which is precisely why the cold-open race survived authoring: awaiting the entry point collapses the race the AC is about. Drive the entry point **without** awaiting it and assert on what is observable mid-flight. In the implementation, prefer one installer (`foregroundSync`, `syncLocalTasks`) called by every entry point over the same three lines repeated per path; a grep for the installer's name should return every door.
- **Scope** — project-wide; `src/assistant/_shared/controller.ts` and `src/assistant/mobile/controller.ts` in particular, and any AC phrased as "every X transition …"
- **Stale check** — permanent (the shape outlives these two bugs)

### L-006 — An assertion that drives the wrong trigger passes whether or not the path it names works

- **Date added** — 2026-08-17 by reviewer-agent
- **Trigger** — T-022, F-003 structural review. Every reconnect assertion in TC-021 drove `connectivity.set(true)`, which always fires `onChange` — so the assertions were green whether or not the foreground reconnect path existed. The gap was found by mutation, not by the suite.
- **Pattern** — The test named one path and exercised another. `connectivity.set(true)` unconditionally fires the `onChange` callback, and the replay was wired to `onChange`; so the assertion proved "replay happens when `onChange` fires", which was never in doubt, while claiming to prove "a reconnect replays offline creates". The half of the AC that mattered — that a **foreground** is also a reconnect, with no connectivity event at all — had no assertion, and the missing behaviour (L-005) sat behind a green test for the whole authoring pass. This is worse than an untested AC, because the coverage matrix reports it covered. The fix was TC-040: a `Connectivity` double whose callback **never fires**, so the only way the replay can happen is the path under test. That is the general remedy — to test that path P causes effect E, disable every other cause of E rather than adding another assertion on E.
- **How to apply** — When a test double has a setter that also fires a notification (`set(true)` → `onChange`), treat it as testing the notification, not the setter. For any AC of the form "X is also a Y", build the double so the ordinary Y-trigger is inert — a no-op callback, a null listener — and let the test fail if the implementation was relying on it. Reviewers: when a mutation survives in a file whose ACs look well covered, suspect this before suspecting the mutation is inert; a suite that cannot distinguish two causes of the same effect will kill no mutant in either.
- **Scope** — project-wide; `qa/assistant/automation/mobile/`, any test using the `Connectivity` / `AppLifecycle` doubles
- **Stale check** — permanent

### L-007 — `testid-contract.sh` silently scans nothing when handed a directory, and reads no id applied by a helper

- **Date added** — 2026-08-17 by reviewer-agent
- **Trigger** — T-022, F-003 structural review. C14 reported `0 honoured, 22 missing` — every id in the catalogue. All 22 are present and correct.
- **Pattern** — Two independent defects stack into one maximally-confident wrong answer. First, `ids_in()` iterates `for f in $1` and skips anything failing `[ -f "$f" ]`, so **directories are silently ignored** — and the reviewer protocol says to pass `Links.implemented_in`, which for F-003 is `[src/assistant/mobile/, src/assistant/_shared/]`, two directories. The tool scanned **zero bytes** and reported every declared id missing, with no warning that its input matched no files. Second, even given an explicit file list the regex is `(data-testid|testID|…)\s*=\s*…`, which only sees an id written as a literal attribute; the mobile implementation applies every id as `{...a11yProps(A11Y_IDS.micButton, {…})}`, a spread of a helper's return value, so the literal `testID=` never appears in a component at all. This is L-002's class, but the directory defect is worse than L-002's, because there the tool at least read the file it was wrong about — here a wrong argument shape produces a full-catalogue FAIL that looks exactly like a real contract breach.
- **How to apply** — Never accept a `testid-contract.sh` result without first confirming it read something: if `honoured + undeclared == 0` while the mockups declare a non-empty catalogue, assume the input matched no files and re-run with an explicit file list (`find <dir> -type f \( -name '*.ts' -o -name '*.tsx' \)`). Then settle the verdict against the executed observable, not the grep — for F-003 that is `src/assistant/mobile/__tests__/a11y.test.ts`, which parses both mockups and asserts the catalogue against `ALL_A11Y_IDS` in **both** directions, plus a check that every catalogue key is referenced in `components/`. The durable fixes are to make `ids_in()` recurse (or fail loudly on a path that matches no file) and to teach the regex the `a11yProps(A11Y_IDS.x)` / spread form.
- **Scope** — project-wide; `.claude/tools/design-check/testid-contract.sh`, and any feature whose `implemented_in` names directories rather than files
- **Stale check** — revisit once `testid-contract.sh` recurses directories and errors on an empty scan

### L-008 — Derived copy passes every test and hides the combinations nobody enumerated; literals + a parsed upstream catalogue expose them

- **Date added** — 2026-08-17 by reviewer-agent
- **Trigger** — T-032, F-003 structural re-verify (pass 2). Replacing an interpolating permission-copy template with literals cited by row ID exposed an eighth iOS tuple (mic `denied` · speech `undetermined`) that no spec, mockup, test or review had ever named — and, one step later, a live bug in the adjacent tuple.
- **Pattern** — Two distinct failures share one root, and both are invisible to a green suite. First: **derived copy silently satisfies an enumerated domain it does not cover.** A template that interpolates the missing capability into a sentence produces plausible output for *every* tuple, including the ones nobody thought about, so the gap has no observable — the suite asserts the three combinations someone listed and the template quietly serves the fourth. Deleting the template and demanding literals turns the unenumerated case into a compile-or-test failure, because a literal that was never written does not exist. Second: **a hand-transcribed expectation converts a contract check into a self-agreement check.** If the test retypes design's strings, design and implementation can drift apart while both halves of the test still agree with each other. The fix used here is the durable one: the test *parses* the upstream artifact (`design/_shared/components.md` § MicControl) at run time and asserts per row ID, so it fails when the **upstream** artifact moves — the direction drift actually travels, and the direction almost every other cross-artifact check in this repo is blind to, because it compares two things the implementation controls.
- **How to apply** — When copy, messages, or any enumerated string set is owned by one artifact and consumed by another: (1) the consumer stores **literals** cited by a stable row ID, never a template that interpolates the varying part — templates are how an unenumerated combination ships fluent text nobody reviewed; (2) the test **reads and parses the owning artifact**, never a retyped copy — see `src/assistant/mobile/__tests__/permissions.test.ts:64-78` for the parser and `:106-113` for the per-row assertion; (3) add a test that reads the consumer as **text** and requires every published body to appear as a literal (`no message body is derived — every published body appears literally in the model`) — this is the assertion that makes rule 1 enforceable rather than a convention; (4) assert the *reason* a row differs from its siblings, not only its content, so a later "harmonising" edit fails instead of quietly changing what a user is told. **Reviewers: verify such a claim by mutation, not by reading.** Change one word in the upstream artifact, confirm the suite goes red, restore byte-identical (L-001 applies — checksum first), confirm green. A parser that silently matches nothing yields the same green as a parser that works, which is L-007's defect wearing different clothes. Corollary for implementers: when removing a derivation exposes a case with no specified answer, **route it — do not invent the row.** That refusal is what produced the correct row here, and the follow-up work found a real bug in the tuple next to it.
- **Scope** — project-wide; `design/_shared/components.md` ↔ `src/assistant/mobile/model/permissions.ts` is the reference implementation. Applies to any spec-declared canonical artifact consumed by code — the same class L-004 names, solved rather than merely detected.
- **Stale check** — permanent (the shape outlives this catalogue)
