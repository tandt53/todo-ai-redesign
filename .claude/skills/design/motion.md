# Motion

Read when a screen has anything that appears, disappears, moves or changes
state — which is nearly every screen. Motion is not decoration you add at the
end; it is how a user is told what just happened.

## Motion has one job: explain a change

Something appeared, something left, something moved, something is working. If
none of those is true, nothing moves. Animation with no state change behind it is
noise, and it costs battery on a phone.

A useful test: describe the animation in words. "The panel slides in from the
right" says where it came from and is worth having. "The card gently pulses" says
nothing about state and is not.

## Duration

| What | Duration |
|---|---|
| A state change on something already on screen — hover, press, toggle, selection | **100–200ms** |
| Something entering or leaving the screen — a sheet, a dialog, a row | **200–300ms** |
| A large surface changing — a full-screen transition | **300–400ms** |

Over 400ms reads as slow no matter how pretty the curve. Under 100ms is not
perceived as motion at all, which is sometimes exactly right.

**Distance changes duration, not the other way round.** A thing crossing the
whole screen at the same speed as a thing moving 8px feels wrong; the long one
needs longer. This is why one global "animation duration" token is not enough on
its own.

## Easing

- **Entering** decelerates — fast at the start, settling at the end (`ease-out`).
  It arrives and stays.
- **Leaving** accelerates — slow start, fast exit (`ease-in`). Nobody needs to
  watch something go.
- **Moving from A to B on screen** eases both ends (`ease-in-out`).
- **Linear** is for things that genuinely have no start or end: a spinner, a
  progress bar.

Never bounce or overshoot on anything a person uses often. It is charming twice
and irritating on the twentieth repetition.

## Never animate what the user is reading

A line of text that moves while it is being read is the most expensive mistake
in this list, because the reader loses their place and blames themselves. New
content arriving below the fold does not push the current view. New content
arriving above the current scroll position does not shift it.

If something must be inserted where the user is looking, hold the position and
tell them instead: a control that says what arrived and takes them there.

## Reduced motion is a different animation, not a missing one

When `prefers-reduced-motion` is set, replace movement with an instant change or
a short fade. **Do not remove the feedback.** A user who has reduced motion on
still needs to know their tap registered, and a state change with no transition
at all is indistinguishable from a broken control.

- Slide → fade, or instant.
- Bounce, parallax, auto-playing loops → gone entirely.
- A spinner that indicates work in progress → keep it. It is information.

## Performance

Animate `transform` and `opacity`. Both are composited and cost almost nothing.

Animating `width`, `height`, `top`, `left`, `margin` or `padding` forces the
browser to lay the page out again on every frame, which is what makes an
animation stutter on a mid-range phone while looking fine on a laptop.

If a layout property must change, animate a `transform` that looks like the same
thing.

## Loading

A spinner in an empty space says "something is happening" and nothing else. A
skeleton that mirrors the real content's shape says what is coming and how much
of it — and when the content lands, nothing jumps, because the space was already
the right size.

Reserve the spinner for work with no shape to predict.

## What to return

For every animated element: what state change it explains, its duration, its
easing, and what it becomes under reduced motion. An animation whose state change
you cannot name is one to delete rather than to tune.
