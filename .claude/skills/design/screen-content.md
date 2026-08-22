# Screen content

Read whenever a mockup will contain a string, a number or a label — which is
every mockup. Palette and type are one half of a design; the words on screen are
the other, and they are authored to their own rules.

A screen can be tokenised perfectly and still be slop. Token fidelity is not a
defence against invented content.

## The rule

Every string on screen either names real information from the product, or is
authored content that knows what it is: a headline, a button label, a legal
paragraph, a form field name, sample data that reads as sample.

What is forbidden is content pretending to be something it is not.

## Fabrication posing as real data

Invented personas (`a.chen@grid.co`), invented telemetry (`GRID.FREQ 59.998 Hz`,
`BUILD 8.2.0-rc3`), invented counts that no part of the product produces.

If a slot has no real content, **leave it empty and show the empty state**. A
screen made to look alive with fabricated rows hides exactly the case the
implementer most needs to see.

## Filler labels

A mono-caps subtitle nobody asked for (`SECURE OPERATOR AUTHENTICATION` under a
login title). A `//`-prefixed kicker pretending to be a code comment
(`// INTELLIGENCE LAYER`).

The test: remove the string. If nothing was lost, it was filler.

## Themed replacement of standard copy

`Authenticate Session` instead of `Next`. `Remember this operator` instead of
`Remember me`. Standard copy for standard actions — the user has learned those
words in every other app they use, and renaming them charges a tax that the
theme does not pay back.

## Unicode glyphs standing in for icons

`▣ Dashboard`, `◊ Market Navigator`. Either a real icon set, or nothing.

## The AI register

Twee subcopy on a serious surface (`Ask the grid.`). A synth sci-fi status strip
across a mundane business screen. Ornamental "seam" and "joinery" flourishes
that describe structure the layout does not have.

You can recognise this in your own output. Cut it before the reviewer does.

## Voice

- Name things by what the person controls, not by how the system is built. They
  manage **notifications**, not `webhook config`.
- Active voice. A control says what happens: `Save changes`, not `Submit`.
- One action keeps one name through the whole flow. The button that says
  `Publish` produces a toast that says `Published`.
- An error says what went wrong and what to do about it. It does not apologise
  and it is never vague.
- An empty screen is an invitation to act, not a mood.
- Each element does one job. A label labels, an example demonstrates, and
  nothing quietly does both.
