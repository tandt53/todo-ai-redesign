# TC-023: WCAG 1.4.3 — contrast on transcript, diff and outcome messages

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-023 |
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
AC-19 names WCAG 1.4.3 (Contrast Minimum) for exactly: the live transcript, diff content, and outcome messages. Computed foreground/background pairs must meet ≥ 4.5:1 for normal text (≥ 3:1 for large text per the criterion), in BOTH themes (the design ships dark and light palettes).

## Preconditions
- Open session. User `qaweb-tc023@qa.example.com`; staged: listening (transcript in composer), applied-diff (chip-old/chip-new/diff-arrow, badges), outcome messages (reverted, nothing-reverted, no-match quote, error, boundary marker, superseded).
- Contrast measured from computed styles resolving the token values (dark: e.g. transcript `#3EE6D2` on `#0C0E16`; light equivalents), including tinted chip backgrounds (add/remove tints).

## Test steps
1. In dark theme: for each target — live transcript text in the composer, chip-old text on remove-tint, chip-new text on add-tint, mini-labels, outcome message body + heads, msg-meta captions where they carry required info, boundary marker text — compute the contrast ratio of rendered fg over effective bg.
2. Switch to light theme; repeat the full sweep.
3. Record every pair with its ratio.

## Expected behaviour
- Every measured pair ≥ 4.5:1 (normal-size text; 3:1 only where text qualifies as large per WCAG). Notably risky pairs to pin: listening-tint transcript on bg-base; `--remove` on `--remove-tint`; `--add` on `--add-tint`; question text on question-tint; muted meta text carrying outcome-relevant info (e.g. "answer by tap, voice…" caption); undone-bubble muted text.
- Failures are reported per-pair with computed hexes and ratio — falsifiable evidence for a design-token bug (layer: design/web).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc023@qa.example.com |
| themes | dark, light (mockup `data-theme`) |

## Notes
Automation computes ratios from `getComputedStyle` with an alpha-composite helper in the Page Object — no screenshot heuristics. Decorative/dev-chrome text is out of scope (not part of the design contract).
