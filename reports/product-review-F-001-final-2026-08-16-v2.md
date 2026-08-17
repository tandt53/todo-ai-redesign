# Product Review: F-001 voice-assistant-view (re-verification, pass 2)

**Date**: 2026-08-16 **Agent**: product-agent **Phase**: review-final
**Feature**: specs/assistant/F-001-voice-assistant-view.md **Result**: APPROVED
**Supersedes**: `reports/product-review-F-001-final-2026-08-16.md` (pass 1, CHANGES REQUESTED)

## Summary

Both HIGH findings are addressed and all four MEDIUMs are fixed — verified by looking at 51
freshly-rendered screenshots and by re-running the suite myself (`npm run test:all` → 217/217,
exit 0), not by reading the fix reports. H1 is fully closed: every one of the 17 web states now
renders in Vietnamese, and the strings match `components.md` verbatim rather than approximately.
H2's mechanism is closed and mutation-proven; its last clause — a human screen-reader pass —
remains open, and **my judgment is that it does not block this gate but must block the human
signature.** Reasoning in "The screen-reader call" below; it is a routing decision, not a waiver.

One new MEDIUM, and it is a sharper thing than the briefing's framing of it. The
`xóa`/`xoá` split is not two layers coin-flipping on an unowned string: the design system chose
one spelling consistently, the api layer followed it, and the web layer consistently chose the
other — and the two collide inside a single bubble on the bulk-delete confirm screen. It does not
block sign-off.

## HIGH severity — blocks sign-off

None. Both pass-1 HIGHs are cleared.

## MEDIUM severity

| ID | Issue | Location | Suggested action |
|---|---|---|---|
| **M5** | **The confirm bubble spells the same word two ways, ~40px apart, on the delete-confirmation screen.** The question head renders `Xóa 3 việc?` (`web/model/messages.ts:148`, with `Sẽ xóa: …` beneath it at `:149`); the affirmative chip directly below renders `Xoá 3 việc` (`api/engine/turns.ts:73`), reaching the DOM verbatim because `ConversationPane` passes the server's strings straight through (`messages.ts:150` `options: [...q.options]` → `ConversationPane.tsx:135`). The briefing described this as "one screen apart" — it is one *bubble* apart, on the single screen in this feature where the product asks the user to authorise destroying data. That is the worst available place for the copy to look like two systems talking. **The split is not arbitrary, which is the part worth recording:** all three mockups use `Xoá` 10/10 times with zero `Xóa`, and the api layer matches them; the web layer uses `Xóa`/`xóa` 12/12 times with zero `Xoá`. The same clean split runs through two more words — `Huỷ` (design, ×3 mockups) vs `Hủy` (`VoiceSurface.tsx:45,48`), and `Đang nghĩ…` (design) vs `Đang xử lý…` (`VoiceSurface.tsx:41`). So this is the web layer diverging from the design artifact on three words, not an unowned choice. No AC is violated: the spec's `## Naming convention` disclaims literal copy, and both spellings are correct Vietnamese. | `src/assistant/web/model/messages.ts:148–149`, `src/assistant/api/engine/turns.ts:73`, `src/assistant/web/components/VoiceSurface.tsx:41,45,48` vs all three mockups | **Pick a house spelling in `components.md` and state it as a rule, then align one side.** Do not assume the design artifact wins by default — see Market intelligence: `xóa`/`hủy` (the web layer's) is the *new-style* tone placement that dominates modern Vietnamese digital UIs, and `xoá`/`huỷ` (the mockups') is the older aesthetic-centering style. The likely correct move is design changing to match web, which is the opposite of the usual direction. Owner's call either way; what is not acceptable is leaving it unstated, because there is currently nothing for the next implementer to read. |
| **M6** | **Structural root cause of M5: user-visible copy is generated in two layers.** The confirm chips are built server-side (`bulkDeleteOptions`) while every other string in the product is built client-side. That is defensible today — the chip text is deliberately opaque because a tap replays it verbatim as the user's own utterance (`data-model.md:105`, and the api suite depends on it being positional) — but it means "the app's copy" has no single home, which is precisely how M5 arose and stayed invisible. | `src/assistant/api/engine/turns.ts:73` | An architect note recording the split and the rule for a second locale. Not a code change now; a decision recorded before it becomes an i18n migration. Matches D4 in the qa-web run record. |

## LOW — observations

- **L6** — **Bonus fix, recorded so it is not re-found.** Pass 1's L2 (`"4 open today"` hardcoded against a visibly different count) is gone: the header now reads `Còn 3 việc hôm nay` against a Today group holding exactly 3 open + 1 completed. Correct in all three mockups.
- **L7** — Pass 1's L1 (destructive and safe confirm options adjacent at identical weight) is materially improved without having been raised as a required fix: `Xoá 3 việc` now renders with the danger treatment and `Giữ lại` with the primary outline, so the two are distinguishable at a glance rather than by reading. Placement is unchanged (destructive still first). Still recorded, still not pressed — AC-11's full Undo on the executed outcome keeps the mistake recoverable.
- **L8** — Pass 1's L3 stands unchanged: all 51 captures are dark theme. The light theme's contrast is computed in `components.md §Contrast` and measured live by TC-023, and `voice.listening` at 4.6:1 clears 4.5 by a hair — numerically fine, still never *looked at*. One light-theme capture pass would close it. Not a blocker; the numbers are real.
- **L9** — Pass 1's L4 stands: iOS and Android mockups remain at full fidelity (17 states, 98 tokens each) for a platform this feature defers. Carrying cost with no consumer until F-002+. Fine if deliberate — and it did pay off once this cycle, since the M4 caption fix had to land in three places.

## The screen-reader call

The briefing asks me to be explicit rather than ambiguous, so: **the outstanding NVDA/VoiceOver
pass does not justify a CHANGES REQUESTED verdict, and it does justify a named blocking item on
the human sign-off checklist.** Those are different things and I mean both.

Why it does not block this gate:

1. **The specific failure AC-19 cites is closed.** AC-19 invokes W3C F103, and F103's named failure
   is a live region created together with its first content, which therefore never announces it.
   TC-033 tests exactly that — region present *before* the first message — plus containment via
   in-page `Node.closest()`, the four facts the AC demands in the announced text, and focus
   stability. TC-034 proves the error bubble's *nearest* live ancestor resolves to `alert` rather
   than the enclosing polite `log`, which is what actually decides "announced immediately rather
   than queued". The implementation matches (`ConversationPane.tsx:333–339` — always-mounted
   `role="log"` + `aria-live="polite"` + `aria-relevant="additions"` + an accessible name; `:249`
   nested `role="alert"`). All of it is mutation-proven: removing either role turns the suite red.
   This is more than markup inspection, and it is exactly the L-002 lesson applied — the claim was
   checked against an execution observable, not a grep.
2. **What remains is quality-of-announcement, not presence-of-mechanism** — verbosity, ordering
   under rapid successive messages, whether the sentence a screen reader speaks is actually
   comprehensible. Real, worth catching, and a polish risk rather than a correctness one.
3. **No agent in this pipeline can run a screen reader.** Returning CHANGES REQUESTED routes this
   to nobody and deadlocks the gate on an action that is already the human's, at the exact step
   where the human is already present. That converts a checklist item into a stall and buys no
   additional assurance.
4. **Ethos §1.** The human owns the sign-off. My job is to hand them the evidence and the
   recommendation, not to hold the pipeline hostage to a task only they can perform.

This is a routing decision, not a waiver. AC-19's last clause is unmet until someone runs
NVDA or VoiceOver against the applied, reverted, error and confirm paths, and the human must not
sign off without doing it. It belongs on the sign-off checklist beside the two items the reviewer
already left there (mockup 1.4.3 target ratio; the `X-User-Id` trust model).

## AC quality assessment

Only ACs whose rating moved since pass 1.

| AC | Platform tags | Pass 1 | Now | Note |
|---|---|---|---|---|
| AC-19 | web | Behavior verification, incomplete enumeration | **User outcome** (one clause pending human execution) | 4.1.3 is named in the AC, the live region exists on the conversation surface itself, and the AC's own anti-pattern — announcing the state word alone — is explicitly tested against. The AC also grew the right *teeth* in revision: it now enumerates every message kind that must announce and states what the announced text must carry. Rating moves on the strength of TC-033/034's mutation evidence; the real-screen-reader clause is tracked above rather than folded into this rating. |
| AC-11 | web | User outcome (teaching gap, M4) | **User outcome** | M4 closed. `question-clarify` now carries the same caption as `question-confirm` — "trả lời bằng cách chạm, nói hoặc gõ — danh sách vẫn dùng được" — so AC-11's non-blocking promise is now taught on both question surfaces, in all three mockups. |
| AC-24 / AC-25 | api, web | User outcome, modulo M1 wording | **User outcome** | M1 closed. The error bubble reads "Chưa gửi được / Trợ lý chưa xử lý được câu đó. Không có gì thay đổi — lời bạn vẫn nằm ở ô nhập bên dưới." and the offline banner's queue count reads "1 câu chờ gửi". The internal word "turn" is gone from shipped copy; nothing replaced it with a different piece of jargon. |
| AC-8 | web, api | User outcome (mockup depicted a forbidden rule, M2) | **User outcome** | M2 closed, and closed wider than filed: the Undo affordance is present in `listening` *and* in `mic-hidden`, the second of which I did not find. The design artifact and the implementation now agree that surface state never ends the undo window. |
| AC-4 | api, web | User outcome | **User outcome** (unchanged, strongest in the set) | Re-verified in Vietnamese: "Đã sửa 1 việc · thêm 1", per-field 14:00 → 16:00 with the old value struck through, `ĐÃ SỬA`/`MỚI` as text labels beside the colour, and the same attribution mirrored into the task row. Localisation cost this AC nothing. |

## Market intelligence

Two queries, both aimed at the one new finding rather than at re-deriving pass 1.

- **The `xóa`/`xoá` choice has no single official answer, and the direction of the fix is not the
  obvious one.** Vietnamese tone-mark placement on vowel clusters has two live conventions: the
  "old style", which centres the mark for visual balance (`xoá`, `huỷ`, `thuỷ`), and the "new
  style", which places it by consistent rule (`xóa`, `hủy`, `thủy`). Neither is incorrect and both
  remain in use. The web layer is on the new style, the design artifacts on the old. Since the new
  style is the one that dominates contemporary digital typography, the cheapest correct resolution
  is likely **design moving to match the implementation** — worth saying explicitly, because the
  pipeline's default instinct is that the design artifact wins, and here that instinct probably
  picks the less conventional spelling. ([Quora — tone marker placement](https://www.quora.com/What-are-the-rules-for-placement-of-tone-markers-in-Vietnamese-i-e-kh%E1%BB%8Fe-vs-kho%E1%BA%BB-h%C3%B2a-vs-ho%C3%A0), [I Can Read Vietnamese — rules of tone mark placement](https://icanreadvietnamese.com/blog/14-rule-of-tone-mark-placement))
- Pass 1's market points are unchanged and were not re-derived: the confirm-vs-undo split, the
  count-and-titles bulk-delete disclosure, action verbs on confirm buttons, and the F103
  real-screen-reader requirement all still read as they did, and the localisation point that
  motivated H1 is now satisfied rather than merely acknowledged.

## Next step

**APPROVED**, with one condition that is the human's to discharge.

1. **Sign-off is blocked on the manual NVDA/VoiceOver pass** over the applied, reverted, error and
   confirm paths (AC-19's final clause). Not re-openable by any agent; it goes on the human
   checklist beside the mockup 1.4.3 target ratio and the `X-User-Id` trust model.
2. **M5 routes to design-agent first** — pick the house spelling and write it into `components.md`
   as a rule — **then to web-agent or design-agent** depending on which way it goes. Read the
   Market intelligence note before choosing; the likely answer is that the mockups change.
3. **M6 routes to architect-agent** as a recorded note on the two-layer copy split. No code change.
4. Nothing here re-opens the spec's direction, and no Gate 1, Gate 2 or Gate 3 conclusion is
   disturbed. M5 and M6 are both safe to land after sign-off if the owner prefers.
