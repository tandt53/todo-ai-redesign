# TC-033: WCAG 4.1.3 — conversation outcomes are announced as status messages

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-033 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
AC-19 names WCAG 4.1.3 (Status Messages): **every message the conversation adds** — applied, reverted / nothing-reverted, undo-refused, clarify question, confirm question, resolution outcome, no-match, session-closed boundary marker, queued-turn notice — must be announced to assistive technology through a live region **on the conversation surface itself, without moving focus**. The AC is explicit about what does *not* count: announcing the state word alone (idle / listening / thinking / error) fails it, because a screen-reader user must receive the same information a sighted user reads — what changed, how many, which tasks by title, and that undo is available. This TC verifies the mechanism that makes that announcement possible and the content that must ride it.

## Preconditions
- Open session, fresh account `qaweb-tc033-*@qa.example.com` (empty conversation — the pre-message state is part of what is being verified).
- Injectable transcript source not required; the typed path exercises the same message pipeline (AC-17).

## Test steps
1. On a fresh page with **zero** messages, locate the conversation live region by role (`getByRole('log')`) and read its `aria-live` value.
2. Submit an applying utterance **with Enter** (not by clicking Send), so the test itself does not move focus. Record `document.activeElement` immediately after submitting.
3. When the applied outcome renders, assert the outcome bubble's nearest live-region ancestor — via `Node.closest('[role="log"], [role="alert"], [role="status"], [aria-live]')` in the page, not by layout.
4. Read the live region's own text and check it carries: the stated count, the affected task titles, and the undo affordance's label.
5. Re-read `document.activeElement` and compare against step 2.
6. Activate Undo and repeat step 3 for the reverted message — a second, different message kind.

## Expected behaviour
- **Region exists before the first message.** The live region is present and `aria-live="polite"` while the conversation is still empty. A region created together with its first message never announces that message (W3C **F103**) — this is the failure mode the step-1 assertion exists to catch, and it is invisible to any check that only inspects the DOM after messages exist.
- **AC-19 (containment)**: the outcome message renders **inside** the live region, not as a sibling of it. A visible-but-outside message is silent to a screen reader.
- **AC-19 (content, not just mechanism)**: the announced text carries all four required facts — what changed, how many ("Đã thêm 4 việc"), which tasks by title ("Plan Monday" … "Plan Thursday"), and that undo is available ("Hoàn tác"). The state word alone is explicitly insufficient.
- **AC-19 (no focus change)**: the active element is unchanged across the announcement. The conversation never steals focus to make itself heard.
- **Every message kind, not just the first**: the reverted message ("Đã hoàn tác") lands in the same region under the same rules.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc033-*@qa.example.com |
| utterance | `plan the week` (canonical row — 4 creates, so "how many" and "by title" are both non-trivial) |

## Notes
**Scope limit, stated honestly.** AC-19 requires verification "against a real screen reader, not inferred from markup (W3C F103)". This automated TC verifies the *preconditions* a real announcement depends on — region present before content, correct politeness, message inside the region, required content present, focus unmoved — which is strictly more than the markup-only check F103 warns about, but it is still not a screen-reader observation. A manual NVDA/VoiceOver pass remains outstanding for full AC-19 sign-off; it is recorded as an open item in the run record rather than being quietly claimed here.

Falsifiability was checked, not assumed: with `role="log"` removed from the conversation surface this TC fails (step 1 / step 3), and with the applied-head copy changed it fails at step 4. See the run record's mutation-check section.
