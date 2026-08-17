# BRIEFING — T-017

- **Task:** T-017 — Gate 5, final product review re-verify for F-001 voice-assistant-view
- **Module:** assistant · **Feature:** F-001 · **Agent:** product-agent · **Date:** 2026-08-16

## Context

This is your second `review-final` pass. Your first (`reports/product-review-F-001-final-2026-08-16.md`) found CHANGES REQUESTED: 2 HIGH (H1 locale mismatch — Vietnamese design system vs English shipped UI; H2 WCAG 4.1.3 missing) and 4 MEDIUM. All of it is now addressed:

- **H1:** the entire product — server confirm-chip labels, all web UI copy, all 3 mockups — is now Vietnamese. `npm run test:all` is 217/217 real, `npm run test:e2e` is 36/36 real (both independently re-run by the orchestrator).
- **H2:** `ConversationPane.tsx` now has `role="log"` + `aria-live="polite"` (outcome messages) and `role="alert"` (errors). Two new TCs (TC-033/034) prove this via mutation-testing (removing the roles makes the tests fail). **Not yet done:** a manual screen-reader pass (NVDA/VoiceOver) — the automation proves the plumbing, not the lived experience; AC-19 explicitly asks for the latter ("verified against a real screen reader, not inferred from markup"). Judge whether this open item blocks sign-off or is acceptable as a documented follow-up.
- **M1 (leaked "turn" word):** fixed.
- **M2 (listening-state Undo affordance):** fixed — and design-agent found + fixed the identical gap in the `mic-hidden` state too (same underlying rule, not in your original finding).
- **M3 (boundary hairline):** fixed.
- **M4 (clarify caption):** fixed, and design-agent found the same caption was truncated on iOS/Android too, fixed there as well.

**One new, small, non-blocking item surfaced during the fix work — your call on whether it matters:** qa-web-agent found spelling/wording drift between layers — the web-generated question headline says "Xóa {n} việc?" while the server-generated confirm chip says "Xoá {n} việc" (both valid Vietnamese, different orthography for the same word, one screen apart); the mockups say "Đang nghĩ" where the app says "Đang xử lý" for the thinking state. No AC is violated either way. Structural root cause: confirm-chip copy is server-generated while everything else is client-generated, so localization is split across two layers — worth an architect note for when a second locale exists, not necessarily a blocker now.

## Read these files first

1. `reports/product-review-F-001-final-2026-08-16.md` — your own first pass, the checklist you're re-verifying
2. `specs/assistant/F-001-voice-assistant-view.md` — `## Acceptance Criteria` AC-19 (now names 4.1.3) and the new `## Naming convention` paragraph (clarifies concept-names-vs-shipped-copy)
3. `design/_shared/components.md` — the Vietnamese strings you'll compare screenshots against
4. `qa/assistant/runs/2026-08-16-web-execute-v2.md` + `2026-08-16-api-execute-v2.md` — the re-execution run records

## Look at the screens again

```bash
bash .claude/tools/design-check/run-design-check.sh --screenshots .claude/eval/design-shots
```

The mockups are now Vietnamese — re-screenshot rather than reusing your first pass's images. If you want to see the real running app (not just mockups), `npm run dev:web` + `npm run dev:assistant` are both real and working.

## Write to

- `{reports}/product-review-F-001-final-{date}-v2.md` (new file — keep the first as history)

## Success criteria

Re-verify all four lenses at Phase 2 depth against what's actually shipped now. Rate `Result: APPROVED | CHANGES REQUESTED`. If you find the screen-reader gap alone should not block sign-off (your judgment call, with reasoning), say so explicitly rather than leaving it ambiguous. Return ends with `---METRICS---`.
