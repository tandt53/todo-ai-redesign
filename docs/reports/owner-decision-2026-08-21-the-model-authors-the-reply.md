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

### What I recommend stays fixed, and why — for F-007's spec to state or overturn

**Destructive confirmations.** The owner's own decision of 2026-08-17 requires a spoken
delete confirmation to **name the tasks**: *"Xoá 3 việc: Gọi nha sĩ, Mua sữa, Họp nhóm?"* —
count-only was rejected by name.

**If the model words that sentence, a hallucinated task name deletes the wrong thing.** For a
confirmation of an irreversible act, *approximately right* is not a lower grade of correct;
it is a different outcome. **L-008 records the general form:** derived copy passes every test
and hides the combinations nobody enumerated.

*Recommended carve-out: the model authors everything except the sentence a user says yes to
before something is destroyed. That is a handful of frames out of 22.* **Not decided here —
F-007's spec states it and Gate 1's lenses press on it.**

### Scope

**This is a new feature (F-007) with its own spec and its own Gate 1, not an amendment.** It
changes the contract between the server and both clients, it re-opens 518 assertions, and it
touches five shipped features. **Folding it into F-006 would put it in front of no lens at
all** — which is the exact mechanism that produced F-006's round-2 findings.

---

## Provenance

*"Câu nhỏ … ok cho short term"* · *"Câu lớn … có, model phải trả lời"*, 2026-08-21.
