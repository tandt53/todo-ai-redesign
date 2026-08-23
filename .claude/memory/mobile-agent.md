
## Never hardcode a pixel number, and a measured one is still hardcoded

**Owner instruction, 2026-08-23, given while T-240's Android half was being fixed.** Screens differ
in size and density, so a number that clears the obstacle on the device in front of you is a number
that fails somewhere else.

**The case that produced it.** The Android composer was landing ~26px inside Gboard's toolbar strip.
26 is a real, measured, correct number — **on this emulator, with this keyboard, with the strip
switched on.** Samsung's keyboard is a different height, a keyboard with a clipboard row is
different again, and a user who turns the strip off changes it once more. **Adding 26 would have
made the screenshot look right and shipped a bug to every other device.**

**The general shape:** a constant that fixes the symptom is the most convincing wrong answer
available, because it is verifiable on the machine you are standing at.

**How to apply.** Take the number from the system, not from the ruler: `WindowInsetsCompat.Type.ime()`
for the keyboard, `useSafeAreaInsets()` for the notch and home indicator, `tokens.json` for anything
the design owns. **If no API supplies the value, say so and stop** — a stated gap is worth more than
a constant that hides one.

**Current state, measured 2026-08-23:** `src/assistant/mobile/components/styles.ts` reads 112 values
from tokens and holds 8 bare numbers, most of them `0`. The mobile side is close to clean; the web
side is not (167 `px` literals in `styles.css`).
