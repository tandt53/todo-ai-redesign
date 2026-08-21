# Owner decision — 2026-08-21 — the model authors the reply

**Raised by the owner, against a claim of mine that was half wrong.** I told them the app
*"does not let the assistant compose sentences — it has a fixed list of templates."* They
answered that the app uses AI to respond and that a fixed list is stupid.

**What I got wrong:** I cited `§ Spoken frames` — the **text-to-speech** vocabulary, F-002's
— as the reason. That is the narrower channel. **What I got right, and only verified after
being challenged:** the on-screen text is templated too.
`src/assistant/_shared/model/messages.ts` is 531 lines and opens
*"Outcome → message mapping … wording follows the design mockup."*

**The distinction the owner was owed and did not get from me:** the app **does** use AI — for
**understanding**. `ports/interpreter.ts` already calls `claude-opus-5`. It does not use AI
for **wording**.

---

## 1. Short term — F-006 gets its two frames

**Chosen.** Add the two frames the trash needs so the read permission of
`owner-decision-2026-08-19… §8` is implementable. A few lines; touches nothing else.

Both fit the existing closed five-slot vocabulary — *"it is the frames that are missing, not
the slots"* (design lens, round 2). A task-is-in-the-trash answer takes `title`; a
what-is-in-the-trash answer takes `count` and `title_list`.

## 2. Long term — **the model authors the reply**

**Chosen: yes.**

### The measurement, taken 2026-08-21

| | |
|---|---|
| files that compose reply text | **3** — `messages.ts` (531), `format.ts` (128), `notice-copy.ts` (215) |
| hardcoded strings in them | **158** |
| exact-string assertions in tests | **518**, across **36** test files |
| spoken frame rows | **22** |
| features whose copy this touches | **5** — F-001, F-002, F-003, F-005, F-006 |
| model calls that already exist | **1** — the interpreter, `claude-opus-5` |

**The last row is the one that changes the shape of the work.** The model is **already in the
loop**; this is not adding a dependency, it is **widening what an existing call returns.**

**The 518 assertions are the real cost, and they are not waste.** They are what makes the
current copy verifiable at all. A model-authored reply cannot be asserted by equality, so
each becomes either a property assertion (*does the sentence name the task? does it state
the count?*) or a deleted test. **Deciding which, 518 times, is the work.**

### Nothing stays fixed — but some facts get checked

*(This subsection replaces a recommendation I made and then withdrew when the owner asked
why anything needed fixing. **The withdrawal is the useful part, so the original claim is
stated rather than deleted.**)*

**What I first wrote:** *"a hallucinated task name there deletes the wrong thing."*
**That is false.** The deletion is driven by task **ids**, not by the words in the sentence.
A model that writes the wrong name still deletes the right row.

**What actually breaks is consent.** The user says yes to a sentence that does not match the
action. For a confirmation, that is not a side effect — **it is the whole purpose of the
sentence.** The owner's 2026-08-17 decision rejected the count-only form precisely so the
user could see *which* tasks.

**And once it is stated correctly, the fix is not a template.** The thing that must hold is
**not "this sentence is fixed" but "the facts in this sentence are true"** — and there are
two ways to get that:

| | how | cost |
|---|---|---|
| freeze the sentence | compose it in code, as today | safe, and it is the thing the owner just called stupid |
| **let the model write it and CHECK** | model composes freely; code then verifies that **every task name in the sentence is in the set about to be destroyed, and the count matches.** Mismatch → regenerate or fall back | **the model stays free.** One short verifier |

**The second is right.** It does not constrain the model — it declines to trust the model
about **the names and the numbers**, in the one place where trusting wrongly is expensive.

**Scope of the check, recommended:** the sentences where a proper noun or a count carries the
user's decision — the destructive confirmation, and probably the applied-summary that reports
what was just done. **Everything else the model writes and nobody checks.**

### Scope

**This is a new feature (F-007) with its own spec and its own Gate 1, not an amendment.** It
changes the contract between the server and both clients, it re-opens 518 assertions, and it
touches five shipped features. **Folding it into F-006 would put it in front of no lens at
all** — which is the exact mechanism that produced F-006's round-2 findings.

---

## Provenance

*"Câu nhỏ … ok cho short term"* · *"Câu lớn … có, model phải trả lời"*, 2026-08-21.

---

## 3. The shape: an agentic loop, not a pipeline

*(Added 2026-08-21 after the owner corrected me twice — I first drew it as three fixed AI
calls, which is wrong.)*

```
user speaks
  ↓
AI ⇄ backend      loop — the AI calls tools to search and read; the backend answers;
                  the AI decides what it needs next. HOW MANY ROUNDS DEPENDS ON THE
                  QUESTION, and on how well the model does. It is not a fixed count.
  ↓
AI returns        actions + targets + THE SPOKEN LINE, together
  ↓
client confirms
  ↓
backend executes  and tells the AI what it did
  ↓
AI ⇄ backend      loops again if it needs to
  ↓
final line → client
```

**Three things this settles that the current architecture does not have:**

1. **The backend exposes tools and the AI drives.** Today the engine resolves the utterance
   itself in one pass. Here the AI asks, reads the answer, and decides whether to ask again.
2. **The line is authored in the same response as the actions and the targets.** *This
   removes the objection §2 was withdrawn over on its own:* the AI is not guessing a task
   name, **it is naming the very rows it is targeting.** A check that the names in the line
   are in the target set stays cheap and stays worth having, but it is now a consistency
   check on one response rather than a guard against invention.
3. **Reads during the loop, writes only after the confirm.** The owner's own diagram places
   `client confirm` **before** `backend take action`, so the AI **proposes** and the backend
   **executes**. *If the AI could write during the loop, the confirm step would be
   decorative.* Recorded as the reading; F-007's spec states it.

**The one thing an agentic loop needs that a pipeline does not: a bound.** Not to predict the
round count — the owner is explicit that it varies with the question and with the model — but
so a bad question cannot spin. **Default taken, both adjustable: a maximum number of rounds
and a wall-clock limit, and the spec must say what the user sees when either is hit.**
Silence at the ceiling is the failure mode.
