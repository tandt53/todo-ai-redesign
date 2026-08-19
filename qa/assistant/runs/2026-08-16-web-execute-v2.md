# Web e2e run record — F-001, execute pass v2 (T-016)

**Date:** 2026-08-16 · **Agent:** qa-web-agent · **Phase:** execute (re-run after a copy change)
**Feature:** F-001 voice-assistant-view · **Platform:** web
**Trigger:** web-agent (T-015c) translated all UI copy to Vietnamese and added the WCAG 4.1.3 live-region wiring. This pass re-binds the suite's text assertions to the shipped copy, adds 4.1.3 coverage (TC-033, TC-034), and re-executes.

**Result: 36/36 PASS, three consecutive clean runs. Zero product bugs filed. Zero flakes observed.**

---

## 1. Where the expected strings came from (and why it matters)

The briefing pointed at `src/assistant/web/` as the source of truth for the new strings. That framing is worth correcting for the record, because `_qa-foundations.md` §2 and §8.6 forbid reading `src/` to decide what to assert — tests written from the implementation mirror the implementation's bugs, including a mistranslation.

The spec settles it without ambiguity. F-001 ## Conversation model, "Naming convention":

> The user-visible wording of every label, message and accessible name — and the language it is written in — is the design system's to specify (`design/_shared/components.md`); no AC in this spec mandates a literal English string in the product.

So the authority for copy is `design/_shared/components.md` plus the design mockup, and that is what the new assertions trace to. `src/assistant/web/model/messages.ts` and the components were read (the briefing directed it, and this is a re-binding of existing assertions rather than a decision about what to assert) — but as the *subject* of comparison, not as the authority. Where the implementation and the design disagreed, the disagreement is recorded below as drift rather than absorbed into a passing assertion.

Practical consequence: two assertions were deliberately **not** pinned to the implementation's literal string. See §4.

## 2. What changed

| File | Change |
|---|---|
| `tests/assistant/e2e/F-001-voice-assistant-view.spec.ts` | New `VN` copy block (one place for every user-visible literal, each traced to components.md); ~30 text assertions re-bound; TC-033 + TC-034 added |
| `tests/assistant/pages/AssistantPage.ts` | State words; row-action accessible names (`Sửa "…"` / `Xóa "…"`); new 4.1.3 helpers `conversationLog()`, `alertRegions()`, `expectInsideLiveRegion()`, `expectAnnounced()` |
| `qa/assistant/F-001/web/*.md` | 19 TC files re-quoted to the shipped copy; 2 new TC files (TC-033, TC-034); `index.md` updated (34 TCs, 36 tests, AC-19 map, copy-language note) |

Task titles (`Buy milk`, `Plan Monday`, …) are **fixture data, not copy** — they come from the canonical fixture table and are unchanged. Only UI copy moved.

### Page-object check requested by the briefing
The briefing asked whether text-based locators had crept into `AssistantPage.ts`. Findings:
- The 22 catalogue locators are all `getByTestId` — clean, nothing to fix.
- The row edit/delete locators use `getByRole('button', { name })` with the row's accessible name. That is **not** a text locator that crept in; it is the documented selector-contract fallback (role + accessible name ranks above text/CSS) for two controls that carry no catalogue testid. They were re-bound to the Vietnamese names, not converted to testids — inventing testids the design catalogue does not contain would violate the "no invented contracts" rule. If design wants them testid-addressable, that is a catalogue request, and it is noted in §7.
- `messageByText` remains the one bare-text lookup, still used only where the copy *is* the assertion (TC-018's verbatim transcript echo).

## 3. WCAG 4.1.3 coverage added

AC-19 names five criteria. Four had TCs; 4.1.3 had none. Two TCs now cover it:

- **TC-033 — status messages announced via the live region.** Verifies the region exists *before* the first message (a region created with its first message never announces it — W3C **F103**), that the outcome renders **inside** the region rather than beside it, that the announced text carries all four facts AC-19 demands (what changed, how many, which tasks by title, that undo is available — the AC explicitly rejects announcing the state word alone), and that focus does not move.
- **TC-034 — errors announced immediately, exactly once.** Verifies zero assertive regions at rest, then exactly one `role="alert"` carrying the error head and retry, and — the load-bearing assertion — that the error bubble's **nearest** live ancestor resolves to `alert` rather than the enclosing polite `log`. Nearest-ancestor is what actually decides politeness for an added node, so this is the assertion that proves "immediately rather than queued behind earlier output"; a mere `getByRole('alert')` count would pass with the alert anywhere on the page.

Containment is checked with `Node.closest()` **in the page**, not inferred from layout.

## 4. Two assertions deliberately left unpinned

`AssistantPage.expectThinking()` / `currentState()` match `/Đang xử lý|Đang nghĩ/` rather than one literal, and this is intentional:

- the design mockup's thinking state word is **"Đang nghĩ…"**; the app renders **"Đang xử lý…"**;
- no AC fixes either string (the spec disclaims literal copy entirely);
- pinning the app's word would be writing the assertion from the implementation — the exact thing §2 of the QA foundations forbids;
- pinning the mockup's word would fail the suite over a wording difference that violates no requirement.

What AC-29 actually requires is that the thinking state carry a visible cue. The alternation asserts exactly that and no more, and the divergence is reported below as drift for design + web-agent to settle. Same reasoning applies to the cancel pill ("Huỷ" mockup / "Hủy" app).

## 5. Mutation checks — proof the new tests can fail

A green test proves nothing until it has been shown to go red. Each mutation was applied to the running app, the suite re-run, and the source restored (verified: `role="log"` and the applied-head string are back in place; no source files are modified in the final state).

| Mutation | Expected to fail | Result |
|---|---|---|
| Remove `role="log"` from the conversation surface | TC-033 | **FAILED** as required (region count 0) |
| Remove `role="alert"` from the error bubble | TC-034 | **FAILED** as required (assertive region count 0 ≠ 1) |
| `appliedHead` copy `"Đã thêm"` → `"Đã tạo"` | TC-001, TC-033 | **FAILED** as required (both; TC-033 at the announced-content step) |

In each case the *other* WCAG TCs stayed green, so the mutations were discriminating rather than blanket-breaking. One diagnostic improvement came out of this: `expectInsideLiveRegion()` now asserts visibility before evaluating, so a missing message fails in a second with a clear message instead of hanging for the 30 s locator timeout.

## 6. Triage log

**Empty.** No test failed in any of the three clean runs, so no failure reached triage — no flakes to fix, no script bugs beyond the planned copy re-binding, no product bugs to file.

This is the expected shape for a pure content change, and it matches the briefing's prior (217/218 unit clean before the change). It was verified rather than assumed: the three consecutive full runs are the flake probe, and §5 is the evidence that the green is load-bearing rather than tautological.

## 7. Drift noted (not fixed — not this agent's call)

| # | Drift | Severity | Owner |
|---|---|---|---|
| D1 | Thinking state word: mockup "Đang nghĩ…" vs app "Đang xử lý…" | LOW — no AC mandates either | design-agent + web-agent |
| D2 | Cancel pill: mockup "Huỷ" vs app "Hủy" (both valid orthographies) | LOW | design-agent + web-agent |
| D3 | **"xóa" vs "xoá" inconsistency inside the shipped app**: the confirm-question head renders `Xóa {n} việc?` (`model/messages.ts`) while the affirmative chip renders `Xoá {n} việc` (`api/engine/turns.ts` `bulkDeleteOptions`). Two spellings of the same word, one screen apart, in one product. | LOW — cosmetic, violates no AC, but it is a visible inconsistency in the primary confirm flow | web-agent + backend-agent; design to pick the house spelling |
| D4 | Chip copy is generated **server-side** (`bulkDeleteOptions` in the api engine) while every other user-visible string lives in the web layer. Localisation is therefore split across two layers, which is how D3 arose in the first place. | LOW (structural) | architect-agent — worth an explicit call before a second locale exists |

None of these blocks the feature. D3 is the one a human might want to fix before sign-off, since it is user-visible on the primary confirm path.

## 8. Open item carried forward (unchanged from v1)

AC-19 requires 4.1.3 to be "verified against a real screen reader, not inferred from markup (W3C F103)". TC-033/TC-034 verify substantially more than markup — region-before-content, containment, announced content, politeness resolution, focus stability — but they are still not a screen-reader observation. **A manual NVDA/VoiceOver pass remains outstanding for full AC-19 sign-off.** It is stated here rather than quietly folded into the automated PASS, and both TC files repeat the limitation in their Notes.

## 9. Evidence

```
$ npx tsc --noEmit
exit 0

$ npm run test:e2e          # run 1 (after copy sync + new TCs)
36 passed (35.5s)           exit 0

$ npx playwright test -g "TC-033|TC-034"    # mutation: role=log and role=alert removed
2 failed, 4 passed (16.3s)  exit 1   <- required failure

$ npx playwright test -g "TC-001|TC-033"    # mutation: appliedHead copy changed
2 failed, 5 passed (46.7s)  exit 1   <- required failure

$ npm run test:e2e          # run 2 (source restored)
36 passed (34.2s)           exit 0

$ npm run test:e2e          # run 3
36 passed (41.2s)           exit 0
```

Harness: `tests/harness/qa-test-server.ts` (real app + FakeClock + counting interpreter) on :4460 and `npm run dev:web` on :5173, both auto-started by `playwright.config.ts`. Ready signal observed in every run (`qa e2e harness … listening on http://localhost:4460`).
Test-data namespace: `qaweb-tc{nn}-{seq}@qa.example.com`, one account per TC (`_qa-foundations.md` §10). No unscoped destructive operations.
