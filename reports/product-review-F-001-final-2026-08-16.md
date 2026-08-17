# Product Review: F-001 voice-assistant-view
**Date**: 2026-08-16 **Agent**: product-agent **Phase**: review-final
**Feature**: specs/assistant/F-001-voice-assistant-view.md **Result**: CHANGES REQUESTED

## Summary

The built feature delivers what Gate 1 approved, and delivers it well: every state I looked at
carries the honesty and reversibility this spec was rewritten around — the reverted message names
the task it skipped and says why, the no-match message quotes what it heard, the superseded message
says "Kept your 3 tasks. The delete was set aside because you moved on." That is above the market
baseline for this feature class, not at it.

Two gaps survive to this gate because no C1–C14 check reads for them. **The shipped UI is English
in every user-facing string, while `components.md` — the design system named in the spec's own
`designed_in` — prescribes Vietnamese for those same strings**, in a project whose audience bar is
Momo/Zalo and whose engine already accepts "hoàn tác" as voice undo. And **the conversation pane,
which is where every outcome in this feature lands, is not a live region**, so the non-voice path
the spec promises under WCAG 2.1 AA announces the state word and never the result.

Both are narrow, both are fixable in the implementation layer, and neither invalidates the
direction. But `MANIFEST ## Knowledge` makes declared-standard coverage HIGH severity and this is
drift from an approved artifact, so it is not mine to wave through.

## HIGH severity — blocks sign-off

| ID | Issue | Location | Required action |
|---|---|---|---|
| **H1** | **All user-facing copy ships in English; the approved design system specifies Vietnamese.** `components.md:32` names the MicControl's accessible names as "Nhấn để nói" / "Đang nghe — nhấn để dừng" / "Micro cần quyền truy cập"; §Message bubbles gives QueuedTurnNotice as "Đang chờ mạng — sẽ gửi lại" and the empty conversation state as "Nói đi, tôi ghi."; §Buttons states *"Standard copy for standard actions: 'Hoàn tác', 'Thử lại', 'Gửi' — no themed replacements."* The build ships `'Microphone needs permission'` / `'Microphone unavailable right now'` (`Composer.tsx:20–21`), `aria-label="Send"` (`:81`), "Say it. / I'll write it down.", "Waiting for network — will resend", "Undo", "Retry". `grep` for Vietnamese diacritics across `src/assistant/web/` returns **zero** files; the only Vietnamese in `src/` is in the API engine (`engine/normalize.ts`, `ports/fixture-table.ts`) — i.e. the app *listens* in Vietnamese and *replies* in English. All 17 mockup states render English too, so the drift starts in the design layer and was carried, not introduced, by web-agent. No i18n library is present in `package.json`. | `design/_shared/components.md:32,55,57,94` vs `src/assistant/web/components/*.tsx`, `design/assistant/screens/voice-assistant-view.html` | **Human decision, then one of two paths.** (a) Localise the shipped strings to the Vietnamese `components.md` already specifies and re-render the mockups; or (b) amend `components.md` to declare English-first for the prototype and open a named localisation feature. Do not leave the design system and the build disagreeing — `components.md` is what the next implementer and the next QA author will read. |
| **H2** | **WCAG 2.1 AA 4.1.3 (Status Messages) is not met on the feature's primary output surface, and AC-19 does not name it.** `ConversationPane.tsx` carries **zero** `role`/`aria-*` attributes. The only live regions in the app are `Chrome.tsx:74` (offline banner, `role="status"`) and `VoiceSurface.tsx:26` (`aria-live="polite"` on the state indicator, which announces the *state word* — idle/listening/thinking/error — not the outcome). So a user on a screen reader who types a command (the non-voice path AC-17/AC-18/AC-21 promise, and which `Purpose` cites WCAG 2.1 AA to justify) hears "Thinking…" and then nothing: "Added 1 task", "Delete 3 tasks?", "Nothing was reverted — both tasks changed afterward", and "That didn't go through" all appear without focus change and without announcement. This is the F103 failure pattern verbatim. AC-19 enumerates 2.1.1, 4.1.2, 1.4.3 and 2.5.3 by name and stops — the four web TCs mirror it exactly (`grep` over `qa/assistant/F-001/web/`: 4×1.4.3, 4×2.1.1, 4×4.1.2, 5×2.5.3, **0×4.1.3**), so the omission propagated cleanly from spec to test plan and nothing downstream could catch it. `MANIFEST ## Knowledge` declares `standards: [WCAG 2.1 AA]` with "missing coverage is HIGH severity". | `src/assistant/web/components/ConversationPane.tsx` (no live region); `specs/assistant/F-001-voice-assistant-view.md` AC-19 | Add 4.1.3 to AC-19; give the conversation pane a polite live region (or `role="log"`) so each new message is announced, with the Error bubble as `role="alert"`; add one web TC that asserts the announced text, verified against a real screen reader for the P1 paths. Note that `components.md:32` *already* assumed "live-region announcements on state change" — the mic got them, the messages did not. |

## MEDIUM severity

| ID | Issue | Location | Suggested action |
|---|---|---|---|
| **M1** | **Internal vocabulary leaked into shipped user copy.** The error bubble reads "The assistant couldn't process **this turn**" and the offline banner reads "**1 turn waiting**". "Turn" is this system's domain word (`turn.status`, `client_turn_id`); a user has no such concept. Every other string in the feature is written in plain language, which makes these two stand out as the places the data model showed through. | error + offline states | "The assistant couldn't handle that" / "1 waiting to send". |
| **M2** | **The `listening` mockup drops the Undo affordance; AC-8 and the implementation both keep it.** Compare `idle-tasks` (the "Added 1 task" bubble carries Undo) with `listening` (same bubble, no Undo). AC-8 ends the undo window only on a newer *applying* turn or session close — "No hidden timer" — and starting to listen is neither. The **implementation is correct**: `model/reducer.ts:349–357` derives `undoableTurnId` purely from the message list, with no dependence on surface state. So this is a defect in the design artifact, not the build — but the mockup is the contract QA authors and future implementers read, and it currently depicts a rule the spec forbids. | `design/assistant/screens/voice-assistant-view.html` `listening` state | Re-author the `listening` state with the Undo affordance present. |
| **M3** | **The session boundary marker renders its flanking hairlines across the body copy.** In the `boundary` screenshot the two short rules sit vertically centred on the whole three-line marker block, which lands them level with "Declined by closing: …" rather than beside the "Session ended — idle · Fri 11:42 PM" title. It reads as a rendering glitch. This is the first thing a returning user sees each morning, so it is the wrong place to look broken. | `boundary` state, all three mockups | Anchor the rules to the title line, or drop them and rely on the centred muted type. |
| **M4** | **The clarify question does not tell the user it is non-blocking; the confirm question does.** `question-confirm` carries the caption "answer by tap, voice, or typing — your list keeps working meanwhile", which is exactly AC-11's promise made visible and is one of the best pieces of copy in the feature. `question-clarify` has no caption and only two candidate chips — no visible escape, nothing saying the list still works or that saying something else is allowed. AC-10's supersede rule does work here, but nothing on screen teaches it. | `question-clarify` state | Carry the same caption onto the clarify bubble. |

## LOW — observations

- **L1** — In `question-confirm`, "Delete 3 tasks" (destructive) and "Keep them" (safe) sit adjacent at identical size and outline weight, destructive first. NN/G's proximity-of-consequential-options guidance argues for separating or de-emphasising the destructive one. Mitigated here because AC-11 gives the executed outcome full Undo, so the mistake is recoverable — recorded, not pressed.
- **L2** — "4 open today" is hardcoded in all three mockups (`voice-assistant-view.html:582` and siblings) while the Today group visibly holds 3 open + 1 completed. Mockup fixture only — the string does not exist in `src/`, so nothing ships wrong. Worth correcting so the mockup doesn't teach a wrong count.
- **L3** — All 51 captured screenshots are the dark theme; the light theme has never been *looked at* by anything. Its contrast is computed in `components.md` §Contrast and measured live by e2e TC-023, and `voice.listening` at 4.6:1 clears 4.5 by a hair — numerically fine, visually unexamined. One light-theme capture pass would close it.
- **L4** — iOS and Android mockups are maintained at full fidelity (17 states each, 98 tokens matching) for a platform this feature explicitly defers. That is real carrying cost with no consumer until F-002+; fine if deliberate.
- **L5** — `MANIFEST ## Knowledge` has `market_context: ""`. Lens 2 below rests on public search only, as that field's own comment anticipates.

## AC quality assessment

Phase 2 depth — only ACs where the built artifact changed my Phase 1 rating.

| AC | Platform tags | Current level | Target | Action needed |
|---|---|---|---|---|
| AC-4 | api, web | **User outcome** | user outcome | None. The applied-diff screen shows old→new in the bubble *and* in the row, with `EDITED`/`NEW` text labels alongside colour. Strongest AC in the set. |
| AC-7 | api, web | **User outcome** | user outcome | None. "Skipped: Review Q3 budget draft — it changed after that turn, so I left it alone" is the AC's intent rendered as a sentence a person can act on. |
| AC-11 | web | **User outcome** | user outcome | None for confirm. See M4 for clarify — the AC is met, the teaching is not. |
| AC-14 | api, web | **User outcome** | user outcome | None. Quotes the transcript, states zero change, names both recovery paths. |
| AC-19 | web | **Behavior verification, incomplete enumeration** | user outcome | **H2.** Naming four SC by number made the AC look exhaustive; the one criterion this feature's architecture most needs is absent, and the TC set inherited the gap. Add 4.1.3. |
| AC-21 / AC-22 | web | **User outcome** | user outcome | None. The two dimmed causes are genuinely distinguishable in copy and in the icon, and "Show me where" is a real affordance rather than an apology. |
| AC-24 / AC-25 | api, web | **User outcome** | user outcome | None, modulo M1's wording. Both keep the user's words on screen and both state the manual fallback. |

## Market intelligence

- **The confirm-vs-undo split matches current guidance, and the split point is right.** Undo is recommended for quick low-risk actions, confirmation reserved for consequential ones; confirmation dialogs "lose their power the more often they are displayed". F-001 reserves confirmation for multi-task delete alone and gives everything else undo — the exact shape the guidance argues for. ([NN/G](https://www.nngroup.com/articles/confirmation-dialog/), [SaaSUI](https://www.saasui.design/blog/saas-destructive-actions-confirmation-ux-patterns))
- **Bulk destructive actions should state the count explicitly, because selection scope multiplies the blast radius** — F-001 states count *and* names every title, which exceeds the baseline. ([Eleken](https://www.eleken.co/blog-posts/bulk-actions-ux))
- **Action verbs on confirmation buttons, not "OK"/"Yes"** — "Delete 3 tasks" / "Keep them" is compliant and unusually clear. The remaining concern is placement, not labelling. ([NN/G proximity](https://www.nngroup.com/articles/proximity-consequential-options/))
- **Voice interfaces should offer confirmation for sensitive actions, simple undo paths, and constrained vocabularies for critical commands** — all three present. ([TheFinch VUI 2026](https://thefinch.design/voice-user-interface-design-best-practices-2026/))
- **4.1.3 must be tested with a real screen reader**, not inferred from markup — relevant to how H2's follow-up TC should be written. ([W3C F103](https://www.w3.org/WAI/WCAG21/Techniques/failures/F103), [Silktide](https://silktide.com/accessibility-guide/the-wcag-standard/4-1/compatible/wcag-4-1-3-status-messages/))
- **Vietnamese-market app localisation starts with the UI and written copy, with region-aware vocabulary review** — an app that recognises Vietnamese speech but answers in English is the inverse of the recommended order. ([AsiaLocalize](https://asialocalize.com/blog/languages-spoken-in-vietnam/))

## Next step

**CHANGES REQUESTED.** Neither HIGH requires re-opening the spec's direction, and no Gate 1 or
Gate 2 conclusion is disturbed.

1. **H1 is a product-owner decision before it is an engineering task** — localise, or amend
   `components.md` and open the localisation feature. Orchestrator should surface it rather than
   route it.
2. **H2 routes to web-agent** (live regions in `ConversationPane.tsx`, `role="alert"` on the error
   bubble) and **spec-agent** (add 4.1.3 to AC-19), then **qa-web-agent** for the announcement TC.
3. **M1–M4 route to web-agent (M1) and design-agent (M2, M3, M4)** — all four are small and can
   ride the same revision.
4. Re-run this gate after H1/H2 land. The two items on the reviewer's human checklist (mockup
   1.4.3 target ratio; the `X-User-Id` trust model) are unchanged by anything above and remain the
   human's to close.
