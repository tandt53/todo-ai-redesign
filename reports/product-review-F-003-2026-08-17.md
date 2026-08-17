# Product Review: F-003 mobile-surface

**Date**: 2026-08-17 · **Agent**: product-agent · **Phase**: review-final
**Feature**: `specs/assistant/F-003-mobile-surface.md` rev 1 · **Result**: **APPROVED**

## Summary

F-003 is the strongest spec-to-implementation chain this project has produced, and it is also the
feature where the least of what it promises has actually been observed. Both halves are true and the
sign-off has to name both.

The permission work is genuinely excellent product thinking — `IOS-MIC-UNASKED` tells a user *why*
the second dialog never appeared, which is a sentence almost no shipping app writes — and the
design→implementation contract behind it is the only check in this repo that fails when the
**upstream** artifact moves. Against that, four of twelve ACs have never been executed against an OS,
and I found by mutation that a fifth claim — AC-11's coverage — is thinner than the coverage map
says: **the automation file named in `Links.tested_by` stays 111/111 green with AC-11's central rule
destroyed.**

Nothing here is a shipping blocker, because per ADR-001 there is nothing to ship to. **I approve, and
I am explicit below about exactly what the human signature covers**, because "STRUCTURAL-PASS +
APPROVED" would otherwise read as "F-003 is done", and it is not.

**Evidence basis for every judgement in this report:**

| Judgement | Rests on |
|---|---|
| Permission copy, boundary message, offline surface, mic modes, layout | **Rendered mockups** — 51 fresh PNGs, `design-check` 21 passed / 0 failed / 6 skipped |
| AC-1 parity, AC-2/3/4/5/6/7/8 behaviour, AC-11 coverage gap (M1) | **Executed assertions** — `npm run test:all` → 453/453 exit 0, plus my own mutation run |
| AC-9 hit areas, AC-10 keyboard occlusion, AC-11 real gesture routing, AC-12 spoken output | **Neither.** No device, no simulator, no rendered RN tree. Model constants only |
| Motion / haptics absence (M3) | Executed grep over `src/assistant/mobile/` — zero `Animated`, `LayoutAnimation`, reduce-motion |

## HIGH severity — blocks sign-off

None.

## MEDIUM severity

| ID | Issue | Location | Suggested action |
|---|---|---|---|
| **M1** | **AC-11's entire defence lives outside `Links.tested_by`, and I proved it by mutation rather than by reading.** I changed `backAction` to return `'leave-view'` unconditionally — destroying AC-11's explicit clause that Android back must dismiss the keyboard first — and re-ran both tiers. `qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts`, the **only** mobile file the spec's `tested_by` names, returned **111 passed (111)**. `src/assistant/mobile/__tests__/touch-keyboard-back.test.ts` returned **1 failed | 12 passed**. Restored byte-identical (`cksum 1389563472 3318` before and after), `test:all` → 453/453. The reason is visible in the automation file: its whole AC-11 obligation is `expect(backIsBackgroundTransition()).toBe(true)` at `:466`, and that function is declared `(): true { return true }` — a literal asserted against itself, which no implementation can fail. `keyboardChangeAffectsConversation()` at `:470` (AC-10) is the same shape. AC-11 is the only one of the twelve ACs with no `describe C.` block of its own; every other AC has real controller-driven bodies in that file. | `qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts:447–471`, `src/assistant/mobile/model/lifecycle.ts:36,46` | **Add `src/assistant/mobile/__tests__/touch-keyboard-back.test.ts` to `Links.tested_by.mobile`** — it is where AC-11's real assertions live and it is currently invisible to every coverage reader. Then either delete the two tautological assertions or replace them with the controller-driven versions. Per L-003, a `tested_by` entry is a claim the file runs; the converse also needs saying — a defence not in `tested_by` is not in the coverage story. |
| **M2** | **AC-9's evidence is three unlinked hand-copies of one number.** The chain is mockup CSS → `PAINTED` in `touch.ts` → the RN `StyleSheet` in `styles.ts`, and **nothing links any pair.** No component imports `PAINTED`; no test imports `components/styles`; nothing parses the mockup. `touch.ts:63` carries the comment `// .checkbox { width: 22px; height: 22px }` and the literal `{width: 22, height: 22}`; `styles.ts:115` independently carries `width: 22, height: 22`; the iOS mockup independently carries `22px`. I checked all six interactive sizes and **they agree today** — this is a structural finding, not a live defect. But the direction of failure is the bad one: if design *shrinks* a control, `PAINTED` keeps the old number, `hitSlopFor` computes too little slop, and the real hit area drops below 44/48 while `touch-keyboard-back.test.ts:46,54` — which asserts `PAINTED` against a retyped literal — stays green. The sharpest thing about this: **the cure already exists one directory away.** `permissions.test.ts:64–78` parses `design/_shared/components.md` at test time precisely so the upstream artifact cannot move silently (L-008). AC-9 is the same class of problem, unsolved, in the same feature. | `src/assistant/mobile/model/touch.ts:50–105`, `src/assistant/mobile/components/styles.ts:114,355,369`, `src/assistant/mobile/__tests__/touch-keyboard-back.test.ts:46,54` | Apply L-008's own pattern: parse the mockup's CSS for the interactive selectors at test time and assert `PAINTED` against it, and assert the RN `StyleSheet` against `PAINTED`. Two assertions turn a three-way convention into a contract, using a technique this repo has already proven works. |
| **M3** | **Mobile ships with no motion *and* no haptics — and one token is now unreachable.** Confirmed by grep, not inference: zero occurrences of `Animated`, `LayoutAnimation`, `useNativeDriver`, `isReduceMotionEnabled` in `src/assistant/mobile/`. Web carries the full system plus `@media (prefers-reduced-motion: reduce)` at `styles.css:531`. Beyond the reviewer's finding, `tokens.json:84` states reduced motion keeps "haptics" — and `expo-haptics` is absent too, so that clause describes nothing on any platform. **My judgement: this is an honest phase boundary, not a product gap — and the accessibility argument is weaker than it first looks.** With zero animation, a user who needs reduced motion is already fully served; the risk is exactly zero today and becomes real on the day the first animation lands. So the correct action is not "build reduced-motion support now". | `design/_shared/DESIGN.md:29–31`, `design/_shared/tokens.json:84`, absence across `src/assistant/mobile/` | **Record it as a decision, and attach the condition to the future work rather than to now:** one line in DESIGN.md `## Motion` scoping the section to web for this phase, and a standing rule that the first mobile animation ships with its `prefers-reduced-motion` collapse in the same change. Also fix or scope the "haptics kept" clause. |
| **M4** | **The accessibility standard MANIFEST names is one revision behind the current baseline.** MANIFEST lists WCAG 2.1 AA. Since 28 June 2025 the EU's operative standard for mobile apps is EN 301 549 → **WCAG 2.2 AA**, with penalties up to €100,000 or 4% of revenue for in-scope services. Not blocking — ADR-001 says prototype, no distribution, no EU users — and the delta is genuinely small here: WCAG 2.2's new target-size criterion (2.5.8) asks 24×24 CSS px, and AC-9 already demands 44/48. Worth naming now because it is a one-line MANIFEST edit today and a re-audit later. | `MANIFEST.md ## Standards` | Update the named standard to WCAG 2.2 AA, or record explicitly why 2.1 is the chosen target for the prototype phase. |

## LOW — observations

- **L1 — six of the eight permission rows have never been looked at.** The mockups render exactly one row each: iOS shows `IOS-SPEECH`, Android shows `AND-PERMANENT`. **`AND-DENIED` is never rendered anywhere** — and it is the one row whose CTA differs in kind, because "Cấp quyền micro" is the only label in the catalogue that promises a prompt (`components.md` §CTA). The catalogue is the contract, the test parses it, and the strings are excellent as written. But the row with the distinct promise is the row nobody has seen on a screen.
- **L2 — the three mockups depict an identical 17-state list; there is not one mobile-specific state.** Same names, same order, web and iOS and Android. So there is no keyboard-open state, no permission-sheet state, no back-navigation state. That means AC-9, AC-10, AC-11 and AC-12 — the four ACs no test can reach — are also the four with **no depicted design state**. They are un-verified and un-drawn, which is a sharper way to say what the device-lab table says.
- **L3 — the reviewer's bookkeeping items are still open.** `qa/assistant/F-003/mobile/index.md` still records `test:all → 431` and "105 passing assertions"; I ran the tree myself and it is **453** and **111**. F-003's `known_bugs: []` still lacks the BUG-002 traceability comment that F-001 carries correctly.
- **L4 — the phone-portrait mockups were verified at desktop width.** Carried from reviewer C11; `tokens.json` declares no breakpoints, so `design-check` measured overflow at 1280px on surfaces that ship at phone width. Visible in the captures: the task list clips mid-row on "1:1 với Hà" in both mobile mockups.
- **L5 — F-001's unresolved `xóa`/`xoá` split (M5) has now been inherited by mobile.** The Android boundary capture renders `Xoá 3 việc?` inside the closed-session summary. Still not a defect, still needs the house-spelling rule I recommended in the F-001 review; it just now has a second surface.

## AC quality assessment

Rated on the `_qa-foundations` §5 spectrum. **Rating measures the AC's own strength; the Evidence column measures what has actually been observed.** They are different questions and this feature is where they diverge most.

| AC | Rating | Evidence today |
|---|---|---|
| AC-1 parity | Behaviour verification (strong) | **Executed.** TC-001…012 drive a real in-process server; one reducer makes the claim structural, not asserted |
| AC-2 iOS dual permission | **User outcome** — best AC in the feature; names the resting state, the message content, the CTA, and that typing is unaffected in *every* combination | Executed + rendered (one of five rows rendered) |
| AC-3 Android single grant | **User outcome** — the permanently-denied dead end is specified as its own path with its own CTA destination | Executed + rendered (one of three rows) |
| AC-4 offline divergence | **User outcome** — "recognized text is never discarded" is an outcome, not a mechanism | Executed + rendered; device half owed |
| AC-5 kill while listening | **User outcome** ("loses no words") | Executed against a store double. The real observable — a flush to disk before process death — is unverifiable and OQ-1 is still open |
| AC-6 kill while thinking + replay | **User outcome** | Same as AC-5, plus a genuinely strong same-`client_turn_id` replay assertion |
| AC-7 audio interruption | **User outcome** — enumerates four interruption kinds | Controller-driven at TC-029; the `describe B.` assertion for it is a list-length check on a constant |
| AC-8 foreground read | **User outcome** — and the AC that BUG-002 proved was load-bearing | **Strongest executed evidence in the feature.** The boundary message renders close reason, declined questions by title, and late outcomes — I read all three in the Android capture |
| AC-9 touch targets | Behaviour verification — "measured as hit area rather than painted size" is exactly the right clause | **Model constants only** (M2). No measurement has occurred |
| AC-10 keyboard | **User outcome** — occlusion, state-neutrality, rotation, keyboard send action | Send-parity is executed; occlusion and rotation are rendered geometry and untested |
| AC-11 system back | **User outcome** — the `BackAction` union has no destructive member by construction, which is good design | **Weakest (M1).** Real assertions exist but sit outside `tested_by`; the file inside it cannot fail on this AC |
| AC-12 screen reader + identity | **User outcome** — and the identity/announcement split is the sharpest correction in the whole project | Announcements are built from the same `Message` record the UI renders, so drift has nowhere to live — **better than F-001's web equivalent**. No screen reader has spoken one |

Not one AC sits at "code existence" or "feature presence". That is unusual and worth stating plainly.

## Market intelligence

Four queries, aimed at the three questions I was handed rather than at re-deriving F-001.

- **AC-2's permission timing is a deliberate, costly, and correct choice.** Requesting at first use rather than onboarding measurably lowers grant rates — timing reportedly moves acceptance by ~40%, and onboarding-time requests with a feature explanation outperform point-of-use ones. F-001 AC-21 and F-003 AC-2 choose point-of-use anyway. That matches Android's own canonical guidance ("request runtime permissions just before performing a restricted action; it's not advisable to request permissions in advance") and it is the right call for a product whose entire pitch is not being creepy. **Recording it as a chosen tradeoff with a number attached, not an oversight.** ([Picovoice — iOS Speech Recognition 2026](https://picovoice.ai/blog/ios-speech-recognition/), [Google — runtime permissions](https://developers.google.com/android/guides/permissions))
- **One finding I would act on: the gap *between* the two iOS dialogs.** The market read is that showing two similar system dialogs back to back reads as redundant and raises refusals, and that even one sentence between them reduces that. AC-2 puts one explanation *before* the sequence and nothing between. The mic-first ordering it specifies is the recommended one. **A follow-up worth considering, not a defect** — and note that `IOS-MIC-UNASKED` already demonstrates this team can write that sentence well. ([Picovoice](https://picovoice.ai/blog/ios-speech-recognition/))
- **AC-3 matches the Android standard pattern exactly** — graceful degradation on denial and an `APP_DETAILS_SETTINGS` deep link once permanently denied. No table stakes missing. ([Google](https://developers.google.com/android/guides/permissions), [Android Speech Recognition 2026](https://picovoice.ai/blog/android-speech-recognition/))
- **AC-4's on-device offline path is table stakes as of 2026, not a bonus.** On-device recognition (Apple SpeechAnalyzer, Gemini Nano) is now the expected private/offline tier, with cloud reserved for accuracy-critical paths; users expect voice input that works without uploading. F-003 meets the baseline. The open risk is OQ-2 (minimum OS versions), which decides how often AC-4's path is actually reachable — still unanswered. ([Picovoice — Android 2026](https://picovoice.ai/blog/android-speech-recognition/), [Yaps — best STT apps 2026](https://www.yaps.ai/blog/best-speech-to-text-apps-2026))
- **Regulatory:** EAA enforceable since 28 June 2025; mobile apps in scope must meet EN 301 549 → WCAG 2.2 AA. Screen-reader and keyboard testing surfaces 60–70% of failures automated scanners miss — which is precisely the untested half of AC-12. See M4. ([Level Access — EAA](https://www.levelaccess.com/compliance-overview/european-accessibility-act-eaa/), [OneTrust — EAA and WCAG 2.2](https://www.onetrust.com/blog/understanding-the-european-accessibility-act-and-wcag-22/))

## Next step

**APPROVED.** Answering the three questions I was handed, in order.

**1. Is the device-lab debt acceptable to sign off, and what is the human agreeing to?** Yes — and the
answer turns entirely on ADR-001. There is no store build, no deployment target and no live user, so
the cost of the unobserved half is bounded at zero today and the debt is recorded honestly rather
than hidden. What the human is agreeing to, stated so it cannot be misread later:

> The node tier is sound. **AC-9, AC-10, AC-11 and AC-12 are specified and modelled, not verified** —
> no OS has executed them. For AC-9 that means hit areas are a computation over a hand-maintained
> table (M2); for AC-10, that occlusion is rendered geometry nothing renders; for AC-11, that the
> named coverage cannot fail (M1); for AC-12, that the announcement *content* is provably correct and
> no screen reader has spoken it. Separately, the storage flush behind AC-5/AC-6 is unanswerable until
> Open Question 1 is decided, and that is the one that costs a user their words.

**Concrete mechanism, so this survives the transcript:** leave those four AC checkboxes unticked in
the spec and add a `## Verification status` block naming them as *conditionally accepted pending a
device pass*. A signature over a spec whose boxes are all ticked will be read as full verification by
the next person, whatever this report says.

**2. AC-11.** Upgraded from "worth your read" to **M1**, on mutation evidence the structural review
did not have. The fix is one line in `Links.tested_by` plus deleting two tautologies.

**3. Motion.** **Honest phase boundary, not a product gap** — see M3 for the reasoning, which is that
a surface with no animation already serves reduced-motion users. It needs recording, and the
reduced-motion collapse needs to be a precondition on the first mobile animation rather than a
follow-up ticket.

Routing: **M1 and M2 → qa-mobile-agent** (both are test-side, both are cheap, and M2 has an in-repo
reference implementation). **M3 → design-agent** (scope `## Motion`, fix the haptics clause).
**M4 and L3 → orchestrator** (one-line edits). **L1 and L2 → design-agent**, at the same time as the
device-lab pass, since the states that are undrawn are exactly the ones that are unverified.

**Sign-off remains the human's**, and it is not blocked on any agent. Nothing in this review re-opens
the spec's direction, and no Gate 1 or Gate 2 conclusion is disturbed.
