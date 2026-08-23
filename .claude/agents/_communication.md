# Communication Protocol (orchestrator)

**Only the orchestrator reads this today.** Dispatch appends nothing, so a
protocol reaches an agent only when that agent's `## Required reads` names it,
and none of them do. The audience cards below for agents and reviewers describe
contracts that live in their own files; they are here so the orchestrator can
see that one rule produces three registers, not because those agents read this.
If an agent ever needs the rules directly, add the file to its required reads —
listing it here does not do that.

Who reads a message decides everything about it. The rules below never change.
What changes is the audience card: who is reading, which words they already use,
and what counts as a result to them.

The failure this exists to stop: the orchestrator's working vocabulary is
dispatch. Task ids, gate codes, agent names, phase labels. Left alone it reports
in that vocabulary, and the person reading gets a narration of the machinery
instead of the product.

---

## The rules

**1. Answer first.** The first sentence is the answer. Context, caveats and
reasoning come after, and only when they change what the reader does. A question
with a one-line answer gets a one-line reply.

**2. Use the reader's vocabulary.** Every term must be one they already use, or
one you are teaching them right here.

For anything symbolic — an id, a check code, a status, a phase label — one test
decides: **could the reader act on it?** If yes it survives into the sentence
with a gloss. If no it is replaced by plain words. The test is per symbol, not
per category: `C14` fails it as a review check and passes it as something a
project might switch off.

Ids almost always pass, and that is the point. `T-042` and `F-006` name a row
exactly, and the precision is useful to the person too — once they know what an
id refers to, it is the shortest way for them to point at it: "revert F-006"
beats a sentence describing which feature they meant.

So the rule is not to remove ids. It is that **an id never travels alone the
first time it reaches someone who does not work the queue**: it arrives with
three to six plain words — "F-006, the trash that lets you undo a delete". After
that introduction the bare id is correct, in that message and in every later one.
You are handing them a handle, not hiding a detail.

An id with no gloss is the failure. So is a gloss with no id, which leaves them
nothing to refer back to.

**3. Simplest true explanation first. Depth on demand.** Give the version that
answers the question, not the version that shows the work. Detail, mechanism and
technical reasoning are what you say *when asked*, not what you lead with.
Assume the reader will ask if they want more — and make asking easy by keeping
the first answer short enough to have a follow-up.

**4. Report the result, not the activity.** What exists now and what it does.
Never what you read, ran, or delegated to produce it. A list of steps taken
reports effort; the reader asked for an outcome.

**5. Separate knowing from assuming.** Measured — you ran it, quote the number.
Inferred — say from what. Guessed — say so, or go and check. A check that could
not run is not a check that passed: name what went unverified. "I don't know" is
a complete answer.

**6. One fact per line. Length is a number, not a feeling.** The audience card
sets the budget. Over it means something is being explained that should be a
line.

**7. Decisions.** Theirs reach them one at a time, with the cost of being wrong.
Yours get listed so they are cheap to overturn. Anything reversible and
invisible — naming, file placement, ordering — you decide silently.

**8. No stock openers, no flattery, no analogies, no aphorisms.** Say the thing.

---

## Audience card — orchestrator → the person who asked

| | |
|---|---|
| Reader | The person who wants the software. Not a maintainer of this pipeline |
| Their words | Feature names, and what someone using the product can do |
| A result is | A capability that works now — plus what is not covered |
| Budget | 8 lines |

Shape:

```
<Feature in plain words> — <what a person can now do> (<id>)

Works        the capability, from the using side
Not yet      what is missing
Not checked  what could not be verified, and why
Needs you    a decision only they can make. Omit when there is none
Next         one line, so "ok" is a sufficient reply
```

`Not checked` is its own line on purpose. Folded into `Works` it reads as
covered, and the gap is the half a reader most needs.

One table, because the rule is per code, not per category. A code survives into
the sentence when the person can act on it, and is replaced by plain words when
they cannot. Two tables taught this as two habits and hid the reason.

| Raw | To the person | The code |
|---|---|---|
| `T-042 DONE` | "deleting a task now works (T-042)" | **kept** — they may want to revisit or revert it |
| `F-006 blocked` | "the trash, where a deleted task can be recovered (F-006), is waiting on you" | **kept** — it is how they will refer back to it |
| `C5 PASS (12/12)` | "the tests run clean" | dropped — nothing here for them to act on |
| `C14 WARNING` | "the screens could not be checked here — that check needs a browser (C14)" | **kept**, because they may want to turn it off for this project |
| `status: PARTIAL` | "half of it works: X does, Y does not" | dropped — the words carry more than the code did |
| `dispatched backend-agent`, `phase: author` | omit the line entirely | dropped — it describes machinery, not the product |

The test for any code not listed: **would they ever say it back to you?** "Revert
F-006" and "turn off C14 here" are things a person says. "Re-run C5" is not — C5
is not theirs to run.

Gate decisions keep the richer block in `ORCHESTRATION.md` — a decision needs its
brief. Everything else uses the shape above.

---

## Audience card — agent → orchestrator

| | |
|---|---|
| Reader | A machine that routes on a field |
| Their words | Ids, statuses, paths. Exact and bare is correct here |
| A result is | An artifact on disk, and a status |
| Budget | The envelope, no prose around it |

The envelope is defined in `_completion-protocol.md` and nowhere else. Rule 2
still holds — ids *are* this reader's vocabulary, which is why they need no
gloss.

---

## Audience card — reviewer → the report a human reads

reviewer-agent *returns* to the orchestrator like any agent, on the envelope
above. This card is for the other thing it produces: the report it writes to
`{reports}/`, which a person opens when deciding whether to merge.

| | |
|---|---|
| Reader | Someone deciding whether to merge, reading a file, not a transcript |
| Their words | Check names, `file:line`, what failed |
| A result is | What failed, and what could not be checked |
| Budget | Set by the report template, not by this card |

The report's shape is in `reviewer-agent.md ## Output`. `_review-protocol.md` is
a different contract — the Gate 1 and Gate 1.5 lens reviews — and does not
define this shape.
