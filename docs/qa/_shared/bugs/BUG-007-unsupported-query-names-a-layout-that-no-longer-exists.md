# BUG-007 — the unsupported-query reply names a layout the redesign removed

- **Severity:** MEDIUM · **Filed:** 2026-08-18 by orchestrator, from a screenshot
- **Status:** OPEN · **Layer:** api (`src/assistant/api/engine/turns.ts:62`)
- **AC:** F-001 **AC-15**, revision 4

## What the user sees

Ask *"what's on sunday"* and the assistant replies:

> I can't answer questions about the list yet — nothing changed.
> **Use the on-screen list and its filters instead.**

On a phone after the redesign there **is** no on-screen list — Talk and Tasks are
peer surfaces and only one is on screen. The sentence sends the user to look at
something that is not there.

## Why it survived

AC-15's guarantee never changed: *an honest not-yet answer that names a real
working alternative.* Only the alternative's **name** changed, because the surface
it named changed. Rev 4 requires it to name **"the task list, browsable by hand
with its collections"** — and, in the AC's own words, **without reference to
layout**, precisely so a future layout change cannot falsify it again.

`UNSUPPORTED_QUERY_ALTERNATIVE` still holds rev 3's string. The spec moved; the
literal did not. Nothing failed, because:

- the api test asserts the constant **matches itself** — it imports the same
  symbol it is checking;
- `api-contracts.md` and `data-model.md` pin the string, and both were updated to
  the *code's* value in T-064 rather than to the spec's, so the contract agrees
  with the wrong side;
- no test compares the emitted string against **AC-15's text**.

This is `L-004` with three homes instead of two, and the tie-break went to the
implementation because it is the one everything else was synced to.

## Fix

One literal, plus the two contract docs. But the useful fix is the assertion:
**something must compare the shipped string to the AC**, or the next surface
rename silently falsifies it a third time. The catalogue is the natural owner —
this is user-visible copy authored in `src/`, which ADR-008's third review
condition already names as the thing that expires the no-i18n decision.

## Found by

Reading a screenshot, not by a test. Every tier was green.
