
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

## Two keyboard heights on Android, and the obvious one is wrong

**2026-08-23, T-240, found by getting it wrong first.** `keyboardDidShow`'s
`endCoordinates.height` reports **only the key area** — 312dp on this device. Gboard also draws a
toolbar strip above the keys (grid, sticker, GIF, clipboard, settings, palette, mic), about 76dp,
and that strip is part of the keyboard the user sees. Padding by `height` leaves the composer
sliced in half by the strip, which looks almost right and is not.

**`endCoordinates.screenY` is the value to use** — it comes from `getWindowVisibleDisplayFrame` and
is the keyboard's true visual top, toolbar included.

**iOS does not have this split**, so a fix verified only on iOS says nothing about Android.

**See also [[the no-hardcoded-pixels entry]]:** the tempting repair here was to add the 76dp, which
is correct on this emulator and wrong on every keyboard with a different strip.

**And the reporting rule this produced:** when claiming one element sits above another, state both
edges — this one's bottom, that one's top — and confirm the first is the smaller number. A
screenshot that reads fine at thumbnail size hid a 26px overlap through two rounds.
