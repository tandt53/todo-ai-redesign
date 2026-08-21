# BRIEFING — T-192

- **Task ID:** T-192 · **Agent:** product-agent · **Module:** assistant · **Date:** 2026-08-21
- **Description:** Audit — where does the project still not understand voice-first

## What the owner asked for

> *"audit lại project để xem những chỗ nào còn chưa hiểu hoặc hiểu sai về tính năng AI voice first"*

**You report. You do not edit specs.** Everything you find becomes a task or an owner
question. No user to interview.

## The measurement that makes this a real question

Words for **voice** (`voice|spoken|nói`) against words for **hand** (`typed|by hand|keyboard`),
per spec, counted 2026-08-21:

| spec | voice | hand |
|---|---|---|
| F-002 talk-back | **39** | 4 |
| F-001 voice-assistant-view | **21** | 13 |
| F-006 recently-deleted | 16 | 14 |
| **F-005 task-detail** | 31 | **36** |
| **F-003 mobile-surface** | **3** | **8** |

**Those last two rows are the question.** A product that calls itself voice-first has **its
phone-surface spec mentioning voice three times**, and **its largest feature written
hand-first**.

**A word count is not a finding.** It is where to start looking. *(L-027: the enumeration is
the contract, the number is not — treat these as a pointer, not as evidence.)*

## The distinction that decides whether each site is a defect

**Separate these two, and say which every finding is:**

- **Deliberately hand-only.** F-005 decided on purpose that *structure* — steps, ordering,
  the pickers — is hand-only, and the owner answered a question to that effect: *"the four
  value fields reachable by voice, structure hand-only."* **That is a decision, not an
  oversight, and reporting it as a gap wastes the audit.**
- **Voice was simply not considered.** Nobody asked what this looks like when spoken. **This
  is what you are hunting.**

**If you cannot tell which a site is, say so and name what would settle it.** An audit that
labels every hand-shaped sentence a defect will be ignored, and it should be.

## Read these

1. **The five specs** — `docs/specs/assistant/F-00{1,2,3,5,6}-*.md`. F-003 and F-005 first;
   the counts say that is where the answer is.
2. **`docs/specs/_source/todo-ai/07-ui-research-mobile.md`** and
   **`11-uc-conversation.md`** — the inherited product's voice-first UI research and its
   conversation use-cases. **This redesign inherited their premises; whether it kept them is
   checkable, and nobody has checked.** `03-ui-design.md` and `06-uiux.md` if they bear.
3. `docs/design/_shared/DESIGN.md` — it uses the phrase; see whether the drawing follows it.
4. `docs/reports/owner-decision-2026-08-21-the-model-authors-the-reply.md` — **the owner has
   just decided the AI authors every reply, in an agentic loop.** Read §2 and §3: some of
   what looks like a voice-first gap today is about to be answered by F-007, and reporting it
   as open would waste the owner's time.

## Aim at these four, and anything else you find

1. **F-003 is the mobile surface spec and mentions voice three times.** The phone is where
   voice-first lives or dies. What is missing?
2. **F-005 is the biggest feature and is hand-first by count.** How much of that is the
   owner's deliberate structure-is-hand-only decision, and how much is not?
3. **What can a user NOT do by voice that they would expect to?** Name the actions. This is
   the finding shape most likely to change what gets built.
4. **Does the app tell a voice user what voice can do?** A voice-first product where the
   voice affordances are undiscoverable is hand-first with a microphone on it.

## What is out of scope

- **Do not re-open the model-authors-the-reply decision.** It is settled and F-007 specs it.
- **Do not audit code.** This is about what the specs understand, not what is built.
- **Do not propose a redesign.** Findings and questions; the owner decides.

## Write to

`/Users/tandt/projects/todo-ai-redesign/docs/reports/audit-voice-first-2026-08-21.md`

## Success criteria

- Every finding says **which of the two kinds it is** — deliberate, or not considered — or
  says it cannot tell and what would settle it.
- Findings are **ranked by the cost of ignoring them**, not by the order you found them.
- **The inherited source docs are read**, and the report says whether this redesign kept
  their voice-first premises or quietly dropped them. *This half is the one nobody has ever
  done.*
- Anything that needs an owner answer is stated as **one question with options and a
  recommendation**, not as an open musing.
- If the honest answer to any of the four aims is *"this is fine"*, **say so with what you
  checked.** An audit that finds problems everywhere is as useless as one that finds none.
