# Audit — where the project still does not understand voice-first

**Date**: 2026-08-21 · **Agent**: product-agent · **Task**: T-192 · **Module**: assistant
**Scope**: F-001, F-002, F-003, F-005, F-006; `docs/design/_shared/`; the inherited
`docs/specs/_source/todo-ai/` premises. Specs only — no code was audited, per briefing.
**Result**: 6 findings · 1 owner decision · 3 places the answer is *this is fine*

## Summary

**The gap is not on any of the surfaces the word count pointed at.** F-003's three mentions are
delegation, not neglect, and F-005's hand-first shape is the owner's own values-versus-structure
line, specified better than most of the repo. The real gap is one sentence long: **the app only
ever speaks when spoken to.** Every spoken sentence in the product is a reply to a turn the user
just issued, and the two things the app has to say *unprompted* — what your day holds when you
open it, and that a reminder you set has passed — are both specified as pixels. One of those was
asked for by the owner in the word "spoken".

The inherited premises were checked, which nobody had done. The v3 visual system was dropped on
the record by owner verdict; the two voice-specific findings inside it survived. **What did not
survive is UC-20's original content** — hear today's list without looking — and it was lost the
same way the source itself records it being lost once before: by a rewrite, not by a decision.

---

## Findings, ranked by what it costs to ignore them

Every finding is labelled **deliberate** (a decision on record — reporting it as a gap wastes the
audit), **not considered** (nobody asked what this looks like spoken), or **cannot tell**.

### F1 — The app never speaks first, and the owner asked it to · **not considered (in part)**

**Highest cost, and the cheapest to fix now.**

`F-002 AC-4(a)` restricts speech to *"a turn the user issued in this foreground session"*. Its
`## What speaks, and from what` table is declared **exhaustive and closed**; every one of its
fourteen speaking rows is a turn reply. There is no unprompted utterance anywhere in the product,
and no AC in any spec asks for one.

Two things the app is already specified to say unprompted, both silent:

| | What it is | Where the silence was decided |
|---|---|---|
| **LandingSummary** | one assistant message on every open, reporting what the list holds | `components.md § LandingSummary`: *"It renders; it does not speak."* Cites F-002 AC-4, routes a spoken version to **F-004** |
| **Passed reminder** (`F-005 AC-38`) | a reminder whose moment has passed, surfaced at app open | **nowhere.** No AC, no lens finding, no decision mentions the ear. `AC-38` routes its *form* to design, and design's LandingSummary family is silent by default |

**The LandingSummary half is deliberate but the reasoning is circular.** The owner's own words,
`owner-decision-2026-08-18-landing-and-collections.md §1`: *"This is a **spoken-by-the-app
summary** on every open."* Design answered it with a render, on the grounds that speaking it
*"would be shipping the spoken day summary, which F-002 reserves as F-004 and explicitly records
as having no owner decision behind it."* But F-002 excluded it as F-004's, and F-004 exists only
because F-002 excluded it — so **the requirement is deferred by citing its own deferral**, and
the rule that decided it (AC-4's turn-only restriction) was written before the requirement it
decided existed.

**And this is the second time this exact requirement has been lost.** `02-use-cases.md` UC-20
AC-20.6 carries its own note: *"Khôi phục 15/08: đây chính là nội dung GỐC của UC-20 — 'nghe tóm
tắt danh sách hôm nay khi bận tay' — bị rơi mất trong lần viết lại thành 'app đọc câu trả lời'."*
The original content of the talk-back use case was hearing today's list with your hands busy. It
was lost once to a rewrite, restored, and has now been deferred twice here.

**The reminder half is not deliberate at all.** A reminder is settable **by voice** (`F-005
AC-36`) and deliverable **only as pixels**, acknowledged only by a deliberate hand gesture, one
per reminder, with no bulk dismissal (`AC-38`, cost accepted knowingly on a different axis). Ten
passed reminders are ten taps. Nobody has asked what any of that sounds like.

**Cost of ignoring:** the phone opens on Talk by owner decision. A user who opens it hands-free
gets silence from a product whose identity is voice. AC-20.6 needs no model and works offline —
it is the offline leg of `todo-ai ADR-11`'s market claim, which F-002 already flags as *"a
finding, not a decision"*. The facts LandingSummary speaks from are **already computed locally**
(`open_today`, `overdue`, `upcoming`, `undated`), so the distance from what is drawn to what
UC-20.6 asks is one frame family. After F-007 lands it is a bigger change, not a smaller one.

→ **Owner decision D1 below.**

### F2 — The session boundary is visible and never audible · **not considered**

`11-uc-conversation.md` AC-52.4 — the user knows whether the session is open or closed, so they
know whether the next sentence edits or creates — carries this line: ***"Ở mặt chính rảnh tay,
đây là AC nặng nhất của cả use case."*** The heaviest AC of the whole use case, *because* the
user is hands-free. §1 gap 1 states the failure: after a silence the session closes and the next
sentence changes meaning from *"fix what I just said"* to *"make a new task"*.

This redesign answers it with `F-001 AC-28` — a **visible** marker message. `F-002`'s table:

> `session-closed boundary marker` · speaks: **no** · reason: *history — AC-4*

**That reason is true of its delivery channel and false of its meaning.** The marker arrives
through a session read, so AC-4(a) excludes it mechanically. But it is not history: `ADR-004`
makes idle-close **lazy**, evaluated on the next request — so the boundary is produced by the
very request carrying the user's next sentence. The user learns the session ended *after* having
spoken into the closed one, and if they are not looking, never.

Screen-reader users are covered (`F-001 AC-19`'s live region). The eyes-free sighted user — the
one UC-52 wrote the AC for — is the only one who is not.

**Cannot tell whether an audible boundary is wanted**; what would settle it is the same owner
question as F1, since both are the app speaking outside a turn.

### F3 — Nothing says how an utterance ends, and the two design files disagree · **not considered**

`F-001`'s User Flow has exactly one edge out of Listening into Thinking:

```
B -->|end of speech| C
B -->|nothing recognized / cancel / audio interruption| A
```

`AC-29` declares those edges the complete transition list. **No acceptance criterion constrains
that first edge** — not who decides speech ended, not what the user does to end it deliberately.
AC-2 covers what listening renders; AC-3 covers cancel. The gap is between them.

The two design files fill it differently:

- `DESIGN.md § User journey`: *"end-of-speech **auto-sends** → thinking breath."*
- `components.md § MicControl` a11y name while listening: *"**Listening — tap to stop**."*

Under AC-3 a stop while listening is a **cancel**: text to the composer, nothing sent. So the one
control a user has mid-utterance either sends or discards depending on which file you read, and
the reading the specs support is the one a user who has just finished a sentence will not expect.
There is no deliberate *"I'm done, send it"*.

**Cost of ignoring:** in a noisy room the recognizer may never endpoint. The user's only move
then is the control that discards the turn. This is the most-used interaction in the product and
it is the only one with no AC.

### F4 — On the phone the mic lives on exactly one surface, and no spec says so · **mixed**

`information-architecture.md §3` puts *"Say / type a turn"* on **S1 Talk** and nowhere else.
Below the split one surface is on screen at a time, so from Tasks, Lists, Settings or the task
detail there is no mic — the user taps back first.

**The deliberate half, which should not be reported as a gap:**
- The phone landing on Talk is decided (`owner-decision-2026-08-18-landing-and-collections §1`),
  on exactly this reasoning: landing on Tasks makes capture 3 actions instead of 2.
- A mic on the task detail (UC-18's flow) was **considered and rejected** in `F-005 § Out of
  Scope`, with the argument written out: a second home for the mic is `L-005`'s shape applied to
  the interface, and binding a turn to one task is new turn semantics.
- `IA §12` names the consequence of the opposite answer and deliberately did not draw it.

**The half that is not written down anywhere:** *the mic has one home* is a consequence, not a
requirement. Nothing in F-001 or F-003 states it, so nothing forbids the next surface from
growing a second one — which is the failure IA §12 itself names. **F-003 is the mobile spec and
contains none of this**: not the landing, not the mic's single home, not the second tap.

### F5 — Nothing tells a voice user what voice can do · **not considered**

The complete inventory of voice affordance in the product:

| Where | What it says | Lives how long |
|---|---|---|
| `components.md § Message bubbles` | *"Say it. I'll write it down."* + **one `text.muted` hint line** | empty conversation only — a first-ever open |
| `components.md § TaskRow` | *"No tasks yet — say one."* | empty list only |

**The hint line's content is not written.** Neither string is required by any AC. There is no
first-run anywhere (UC-22 is MISSING in the coverage map), and nothing ever tells the user that
voice can now set a note, a priority, a deadline and a reminder (`F-005 AC-36`) or that it
refuses steps, ordering and repeat.

The refusal side is the sharper half. AC-36 requires structure attempts to be **refused with a
visible outcome** rather than silently ignored — correct, and it means the user learns the
boundary by hitting it, once per field, with the refusal as the only teacher the spec provides.

**Cost of ignoring:** a voice-first product whose voice affordances are undiscoverable is
hand-first with a microphone on it. Also the cheapest of the six to fix, and the one most likely
to be answered by F-007 rather than by a spec — the model can say what it can do.

### F6 — Two smaller ones · **cannot tell**

- **`F-003 AC-7` makes an output-route change cancel listening.** Connecting AirPods mid-sentence
  discards the turn. The reasoning on record is about releasing the audio session, not about the
  headset as an **input** route — and nothing anywhere says whether a Bluetooth headset can be
  the capture route at all. Settled by: does the product intend headset capture this phase?
- **No non-visual cue that capture started or stopped on the phone.** `DESIGN.md § Motion`
  records that mobile *"ships zero animation and zero haptics"* and `expo-haptics` is declared,
  not installed. `F-002 § Out of Scope` rejects an audio cue — but that decision is scoped to
  **speech output**, not to capture. Weak while capture starts with a tap on a visible orb;
  it becomes load-bearing the moment anything starts capture without a look.

---

## Where the answer is: this is fine

An audit that finds problems everywhere is as useless as one that finds none. Three places the
count or the reputation suggests a problem and there is not one.

1. **F-003 is not the defect the count implies.** Its 12 ACs are the platform boundary and cover
   it: two permission models with the iOS sequencing rule and Android's permanently-denied path
   (AC-2, AC-3), on-device recognition offline (AC-4), kill-surviving stores with replay under
   the same `client_turn_id` (AC-5, AC-6), audio interruption (AC-7), foreground session re-read
   (AC-8), touch targets, keyboard, system back, native screen-reader announcement with the
   `testID` / `accessibilityLabel` split spelled out (AC-9…AC-12). Everything else is delegated
   through a **parity table that enumerates all 29 F-001 ACs by disposition** and is made binding
   by AC-1. Voice appears three times because the conversation is F-001's, correctly. The four
   unticked ACs are honestly marked *specified and modelled, not verified*.

2. **F-005's hand-first shape is the owner's line, and its voice half is well specified.**
   AC-36 is not a permission list — it requires **one interpreter fixture row per voice-settable
   field, on the create path as well as the edit path**, precisely because *"an implementation
   that allowlists four fields and leaves every one unreachable passes an AC that only grants
   permission."* It also caught that `applyCreate` hardcodes `reminder_at: null`, so *"add a task
   to call the dentist and remind me at nine"* silently drops the reminder. The values-versus-
   structure line is the owner's decision. **Do not reopen it.**

3. **F-006 already found this audit's finding shape, unaided.** AC-14 grants the assistant a
   **read** of the trash and no write; its sub-bullets name the *"put it back"* dead end, forbid
   `no_match` on a task the assistant just named one turn earlier, route the two missing spoken
   frames, and record that the dead end is 180 seconds wide rather than absolute. Nine lenses
   judged it acceptable. It is the most voice-aware document in the repo.

---

## Did this redesign keep the inherited voice-first premises?

Nobody had checked. Answer: **the visual system was dropped on the record; the voice premises
were kept except one, and that one is F1.**

### `07-ui-research-mobile.md` — the v3 "Calm list, ink orb" system

| Premise | Kept? |
|---|---|
| §3 rules 1–6, 8 — row-not-card, monochrome + one cobalt accent, ink orb, assistant is *one line* not a bubble | **DROPPED, on the record.** `DESIGN.md § Identity` names *"the existing v3 'Calm list, ink orb' single-cobalt neutrality"* as a **rejected direction**, owner verdict. Aurora + Zalo-familiar bubbles replace it. Not a silent drift |
| §5.3 — orb **plus live transcript**; ChatGPT shipped the orb without one and had to add it | **KEPT.** `F-001 AC-2`; `components.md § MicControl` listening state |
| §5.3 — voice does not replace touch; multimodal, speak to create, tap to confirm | **KEPT.** `F-001 AC-17` (typed parity), `AC-18` (every list op by hand, zero AI calls) |
| §3 rule 7 — the bottom edge belongs to the input bar; navigation goes elsewhere | **KEPT, and re-derived independently.** `IA §1`: *"The bottom of the Talk surface belongs to the composer and the mic orb… a tab bar underneath it would put two competing primary controls in the same thumb zone."* Same conclusion, reached without citing the source |
| §5.3 — *"khớp kiến trúc draft + nút Save"* | dropped with drafts themselves (`ADR-002`, coverage map **D3**) — recorded |

### `11-uc-conversation.md` — UC-52

| Premise | Kept? |
|---|---|
| AC-52.1 — open the app and the first thing is a place to speak, zero navigation | **KEPT**, and now decided rather than inherited (phone lands on Talk) |
| AC-52.7 — ADR-7 applies to the main surface: offline it says so and hands over to the list | **KEPT.** `F-001 AC-24`, `AC-25` |
| AC-52.10 — the user's words and real task names; never an internal ref | **KEPT.** `F-001 AC-4`, and `F-002 AC-21`'s no-uuid fallback |
| AC-52.18 — undo reachable **by the channel that issued the command** | **KEPT.** `F-001 AC-5`, `ADR-006`; the source measured this as *not existing* on 15/08 |
| §4 — *"hoàn tác thay cho xác nhận"*, with bulk delete as a named exception | **KEPT.** `F-001 AC-9`…`AC-12` |
| §4 — the drawer is the exit; no second navigation model | **KEPT.** `IA §1`'s reciprocal switch + `S3` |
| **AC-52.4 — the user knows the session boundary, *"nặng nhất"* because hands-free** | **KEPT AS PIXELS ONLY.** → **F2** |
| **UC-20 AC-20.6 — hear today's list without looking, no model, works offline** | **NOT KEPT.** Excluded by F-002 → F-004 → uncommitted. → **F1** |

---

## D1 — the one decision this audit hands the owner

**Question.** When you open the app on your phone without looking at it, should it say anything
out loud — what today holds, and that a reminder you set has passed?

**Why now.** F-007 re-opens 518 exact-string assertions across five features and changes who
authors every reply. Whether the app has a *speaks-without-being-asked* channel at all is a
contract question, and it is much cheaper to answer before F-007's spec than after. It also
decides `F-005 AC-38`'s form, which design is currently free to answer either way.

**Measurement, from this codebase.** Speaking rows in `F-002 § What speaks`: **14**, all replies
to a turn. Unprompted sentences specified: **2** (LandingSummary, passed reminder), both silent.
Facts LandingSummary already computes locally: **6**. Model calls it would need: **0** —
`AC-20.6` is assembled from data already on the device.

| | Option | Gains | Costs |
|---|---|---|---|
| **A** | **Speak the landing summary and the reminder.** One new frame family beside `SPK-*`, spoken on open, subject to F-002's existing off switch, DND, screen-reader suppression and stop control | Restores UC-20's original content; makes the phone's first moment voice-first; carries ADR-11's offline market leg; answers the owner's own word *"spoken"*; F-002's mute/stop machinery already exists | F-002 AC-4(a) needs a carve-out for non-turn speech; the reminder needs a spoken acknowledgement or it stays a hand-only dismissal; unsolicited audio on open is the thing users most often disable |
| **B** | **Keep it silent; commit F-004 and schedule it.** Today's answer, but with an owner behind it | Nothing changes now; the deferral stops being circular | The app stays silent on open for however long F-004 waits, on the surface the identity is spent on |
| **C** | **Keep it silent permanently.** Talk-back is replies only, by design | One rule, no carve-out, no unsolicited audio ever | Gives up UC-20's original content and the offline leg; `AC-38`'s reminder is hand-only forever |

**Common practice.** Google Maps speaks unprompted and is the owner's own cited precedent for
`F-002 AC-7` (*"vẫn nói — như Google Maps chỉ đường"*). Alexa and Google Assistant both speak
unprompted for reminders and neither speaks a daily summary unless asked. ChatGPT voice mode —
named in `DESIGN.md § Identity` as the audience's reference — **never** speaks first.

**Recommendation: A for the reminder, B for the landing summary.** They are two different
promises wearing one question. A reminder the user *asked for*, set *by voice*, delivered only as
pixels and dismissible only by hand is the clearer defect, and every product cited above speaks
it. The landing summary is unsolicited audio on every open — the thing the reference product the
identity is built on deliberately does not do — so it deserves F-004's own scoping rather than a
carve-out taken here.

**Reversibility:** cheap either way while it is a frame family and an eligibility rule. Expensive
after F-007, which changes who authors the sentence and re-opens the assertions that pin it.

## Not owner decisions — route these as tasks

- **F3** → revision task to spec-agent on `F-001`: no AC constrains the `end of speech` edge, and
  `DESIGN.md` and `components.md` disagree about what a tap during listening does.
- **F5** → hint-line copy has no owner and no AC. Route to design with F-007's scope in view.
- **F4** → one line in `F-003` or `F-001` making *the mic has one home* a requirement rather than
  a consequence of the IA.
- **F6** → two questions for architect: headset as a capture route; whether the first mobile
  animation's `expo-haptics` obligation should carry a capture-start cue.

## Out of scope, as briefed

The model-authors-the-reply decision was not re-opened. No code was audited. No redesign is
proposed — F1's option A describes a mechanism only because the decision is unanswerable without
knowing what it would cost.
