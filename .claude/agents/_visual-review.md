# Reading a render

Used by design-agent on its own mockups and by reviewer-agent at C16 on the
built screen. It is how you think in front of a picture. `visual-check` is a
measuring instrument, not a reviewer: it answers questions, and someone has to
ask them.

## The split, and why it falls here

**What is not in the picture is the tool's.** An accessible name, whether a
hidden control is still reachable by keyboard or screen reader, which element
receives the tap, an id the build never renders — none of that is visible, so no
amount of looking will find it. Those run as sweeps over everything, always.

**What is in the picture is yours.** Whether two things that should relate
actually do, whether a group reads as one group, whether the screen still works
once the keyboard is up — those are about intent, and intent is not in any
element tree. A script cannot know which elements were meant to line up. You can
see it.

**You do not read numbers off an image.** You are good at noticing that
something is off and bad at saying by how much; the instrument is the reverse.
So every finding of yours ends in a measurement you did not estimate.

## The instrument is per platform; this reasoning is not

Everything below works the same on a web page, an iOS screen and an Android one,
because none of it depends on how the screen is built. What changes is what
answers you when you ask for a number.

**Whatever the project's harness already drives is the instrument.** Resolve it
from `MANIFEST ## Stack` and the platform docs the same way anything else in
this pipeline resolves a stack — never assume one. In this template that is
typically a browser driver for web and for the HTML mockups, and the mobile
driver the QA harness is already running by the time a built screen is reviewed.
Both give the same two things, which is all a measurement needs: **a screenshot,
and a tree of elements with their boxes and identifiers.**

So the shape of a measurement never changes — *these elements, these boxes* —
even though the tool answering it does.

**Where no tree is available at all** — a screen you can only photograph — say
so. Your suspicions then stay suspicions: write them as questions for the owner,
with the render attached. Do not estimate the pixels and do not quietly promote
a suspicion to a finding because no instrument was there to refuse it. An
unmeasured guess presented as a defect costs more than saying you could not
check.

## 1 — Say what you see, before you know what it should be

Write two or three sentences describing the render as someone who has never seen
this product: what you notice first, what belongs with what, what you would tap.
**Do not open the spec or the mockup while doing this.**

This is the step most worth not skipping. An agent that knows what it drew sees
what it intended, and the intention paints over the defect. Nearly every finding
below comes out of the distance between this description and what was supposed
to be there — so the description has to be written before you know.

Then read the spec, or the mockup, and name every difference. A difference you
can explain is not a finding. One you cannot is.

## 2 — Ask what this image is claiming, then test the claims

Every render makes claims about itself. *These four things are one group. This
element repeats. These share a column. This is the most important thing here.
This is tappable and that is not.*

**Write the claims down.** They come from the render in front of you,
**not from a list.** That is deliberate: a fixed list of things to check is a
ceiling — it finds what its author had already seen, and is blind to whatever
this product does that they never met. Different products make different claims. Yours are
the ones this picture is making.

Then, for each claim: **does the image actually keep it?**

Two of these are worth naming as illustrations, and they are illustrations, not
the list:

*Repetition is the strongest claim and the cheapest to test.* Anything that
appears more than once is asserting its instances are identical. They usually
are not, and the odd one out is the defect people describe as "looks off but I
can't say why". Compare instances against each other — **not against page
coordinates.** Two cards in different containers have no reason to share an
absolute position; they have every reason to have the same internal spacing.

*A group is claimed by space, not by borders.* Space between groups has to be
clearly larger than space inside them, or the eye merges them: a list that reads
as a paragraph, a label that appears to belong to the field beneath it. There is
no correct number for this — it is a comparison — which is exactly why it stays
with you.

## 3 — Turn each suspicion into a measurement

A suspicion is not a finding, and a number you estimated from a picture is worse
than no number: it is wrong with authority.

For each claim you doubt: name the elements involved, measure them, then report
what came back. **Report the refuted ones too** — "the three titles looked
uneven; measured, all three at 40px" is evidence this pass actually ran, and it
is the only thing separating a real review from a list of impressions.

Where the instrument is this template's own, that request looks like:

```bash
bash .claude/tools/visual-check/run-visual-check.sh \
     --target <the screen> --measure '.card .title' --relative-to '.card'
```

It answers and judges nothing — no thresholds, no verdict, exit 0 whatever it
finds. **What the numbers mean is yours**, which is the entire point of the
split.

`--relative-to` is the one worth understanding. It reports where each element
sits **inside its own container** instead of on the page. Repeated components
live in different containers, so their absolute coordinates have no reason to
agree and comparing them answers a question nobody asked; their offsets inside
their own card, row or cell have every reason to agree, and the one that does
not is the defect. **Reach for absolute coordinates only for things that really
do share one container.**

A selector that matches nothing measures nothing. The tool says so; do not read
that as agreement.

If you cannot measure something, say so and leave it as a question for the
owner. Do not promote it to a finding to make the section look complete.

## 4 — Ask what the render is not showing you

The picture is one screen, one content length, one moment.

*What covers this at runtime that the mockup does not draw?* Work it out from the
platform this product actually ships on rather than from a list — the answer differs for
a phone, a desktop browser and a kiosk, and the list you would be handed is
whichever one its author was thinking of.

*What lengths will this really see?* The longest name a real user has, the empty
list, the number with four more digits, the error that runs to a paragraph, the
translation that is half again as long. Say which of these you can answer from
this render and which you cannot. One you cannot answer is a state that should
have been drawn — that is a finding about the state list, not about the pixels.

## What a finding looks like

The file, where in it, the claim that broke, and the number:

> `task-list-mobile-empty.png`, card block: the cards claim to be one repeated
> component, but the title in card 3 sits 19px from the card edge where the
> other three sit at 16px. Measured, not estimated.

> `task-form-mobile-typing.png`: the gap between the two field groups (8px) is
> the same as the gap between label and input inside a group, so the four fields
> read as one block rather than two pairs.

**"It feels cramped" is not a finding.** If you cannot name the claim that broke,
you are describing taste, not a defect. Put it under the quality questions
instead, or attach the render and let the human judge — that is what the
attachment is for.

## The honest zero

A pass that found nothing is worth something only if it could have found
something. Say which claims you tested and what you measured. **Nobody is graded
on finding zero**, and a report listing four passes and no findings, on a screen
the owner then rejects on sight, is the exact failure this file exists to
prevent.
