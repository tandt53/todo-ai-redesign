# Design System — todo-ai redesign (voice-first)

Serves F-001 (voice-assistant view): four surface states (idle · listening · thinking · error), everything else a message. Tokens: `tokens.json`. Inventory: `components.md`.

## Identity

- **Anchor:** Aurora — disciplined to product-UI restraint. The aurora gradient is the *voice signature*, not the page surface: flat deep-indigo ground everywhere, the gradient ignites only where speech lives.
- **Why over the safe pairing:** the safe answer for "AI assistant" is near-black + one acid accent, or a ChatGPT-grey clone. Both were rejected on this brief's history: the owner already refused muted banking-clean ("not modern or creative enough"). Aurora is the only territory whose token set (saturated gradient, committed glow) can make the mic moment feel like an event while the task list stays quiet.
- **Rejected directions:** (1) nostalgic/skeuomorphic costume — owner verdict "hideous"; (2) muted banking-clean / the existing v3 "Calm list, ink orb" single-cobalt neutrality — competent but not the "đẹp hơn hẳn" bar.
- **Differentiator (the one bold place):** the **cyan→violet handoff**. Colour carries the conversation's physics: **cyan = the user's voice** (listening state, live transcript accent), **violet = the assistant** (thinking state, applied changes, Undo). The listening surface blooms a live cyan→violet aurora band behind the waveform; at end-of-speech it contracts and slides violet-ward into the thinking breath — the gradient literally hands the words over. Nowhere else in the app does a gradient exist.
- **Reference bar (audience's daily apps):** **Momo, Zalo, ChatGPT voice mode.** Messages read like Zalo chat (user right, assistant left, familiar bubbles); the voice moment matches ChatGPT voice-mode's dark, glowing, full-attention feel; colour confidence sits at Momo's saturation level — but semantic, never decorative.
- **Dark-mode-first**, light theme fully tokened. Justification: the signature is glow, and glow reads on dark; ChatGPT voice mode — the audience's mental model for "talking to AI" — is dark; Momo proves this audience accepts saturated colour on dark chrome. Light theme ships with equal contrast rigor (see components.md §Contrast) because todo lists get read in sunlight.
- **Interaction stays boring on purpose:** chat bubbles, a labelled Undo button, questions as tappable option chips, an offline banner. New identity, familiar behaviour.

## Colour rules (earned colour)

**Minimum contrast ratio 4.5:1** for normal text (AC-19 / WCAG 1.4.3) — stated here as a number, not only as prose, because `.claude/tools/design-check` reads the threshold from this file and skips the check when it finds none. Verified pairs: components.md §Contrast.

1. One signal per meaning: cyan=listening, violet=assistant/thinking, green=added, red=removed/danger, amber=open question. No colour appears without its meaning.
2. Accent text only on `bg.base`, `bg.raised`, or its own tint token — all pairs verified ≥ 4.5:1 (AC-19 / WCAG 1.4.3); pair list in components.md.
3. Diff and state are never colour-only: `NEW` / `EDITED` text labels ride every marker (colour-blind safe, carried from v3).
4. The aurora gradient (`gradient.voice`) is legal **only** on the voice surface (mic orb, listening band, thinking breath). Anywhere else = review failure.
5. **The accent set is closed at five, and a sixth arrives only with its own meaning** (decided T-152, F-005). Rule 1 lists five accents and every one is spent; "pick an unspent accent" therefore names an empty set, and the instruction that was written three times into F-005 was true as an edit and unexecutable as an outcome (design D14). So a new marked meaning has exactly two legal answers: **carry it without colour** — shape, weight, accessible name — or **add an accent to this file with its meaning first, then use it**. F-005 asked for two (AC-9 urgency, AC-39 repeating series) and **both are carried without colour**, because (a) they land on `§ TaskRow`, which the live store renders under a `danger` Overdue heading on every row of Today and which may also carry a `NEW`/`EDITED` marker in green or red — a sixth hue there is the collision that removing amber was meant to prevent; (b) urgency has **three** levels, so colour would need three tints, which is Todoist's three coloured flags, already compared and rejected; and (c) the novelty ledger below spends boldness on the voice surface only, and rule 3 means colour could never carry either mark alone regardless. Both marks are drawn in `components.md § TaskRow`.

## Component Library

- **Web (React):** Radix UI primitives + custom styling from `tokens.json`. Chosen because AC-19 names 4.1.2 (name/role/value) and 2.1.1 (keyboard) — Radix ships correct roles/focus behaviour headless, so the visual layer stays 100% token-driven. No prebuilt theme kit (would fight the identity).
- **Mobile (React Native):** RN primitives + `react-native-reanimated` + `react-native-gesture-handler` + `expo-haptics` — carried from the existing app's motion stack (06-uiux §6); the motion tokens below are shared JSON so web CSS and RN worklets read one source.
- **Icons:** Lucide (web + RN) — SVG stroke 1.8, round caps, carries v3's "no emoji as UI icons" law.
- **Fonts:** **Space Grotesk** (display: large title, state words, big counts) + **Be Vietnam Pro** (body/UI — drawn for Vietnamese stacked diacritics; body line-height 1.5 so ề/ệ/ỗ never clip). Deliberate pair: one characterful techy display voice, one native-Vietnamese workhorse. Numerals tabular via `font-variant-numeric`. No third family.

## Motion

Carried from the existing app (06-uiux §1) and extended for the four states — durations/easings live in `tokens.json > motion`. State transitions crossfade at `standard` (200ms); the aurora breath loops at 2400ms; row diff-flash holds 1.6s then fades 400ms. `prefers-reduced-motion`: every animation collapses to an 80ms opacity change, end states (strikethrough, collapse, markers) fully kept.

**Phase boundary — this section is live on web only.** The mobile motion stack named above (`reanimated`, `gesture-handler`, `expo-haptics`) is *declared, not installed*: none of the three is in `package.json` or `src/`, so mobile currently ships zero animation and zero haptics. That is a safe state, not a gap — with nothing animating, a reduced-motion user is already fully served. It stops being safe the moment the first animated transition lands. **Precondition on that change:** whoever adds the first mobile animation owes the reduced-motion collapse and the haptic behaviour *in the same change*, not as a follow-up — the tokens below describe the target, and until then they describe nothing that runs on mobile.

## User journey (happy path)

Entry: app opens on the assistant view — idle state, task list visible, mic orb in the composer.
1. **Tap mic** → listening: aurora band + live transcript as words land (AC-2).
2. **Speak** ("mai họp team lúc 2 giờ") → end-of-speech auto-sends → thinking breath.
3. Applied message appears (diff + Undo) and the changed row flashes+marks in the list (AC-1, AC-4). → idle.

**Happy path = 2 user actions** (1 tap + 1 utterance) — matches the existing app's "≤ 2 chạm" law. Undo = 1 more tap (or say "hoàn tác"). Typing path: identical minus the mic (tap composer, type, send = same interpretation path, AC-17).

## Novelty budget ledger

Spent entirely on **the voice surface**: the cyan→violet aurora (listening band, thinking breath, orb glow). Everything else — task rows, message bubbles, buttons, banners, drawer — is quiet, flat, and instantly recognisable to a Momo/Zalo user. Interaction patterns spend zero novelty.

**F-005 (T-152) spent nothing from this ledger**, and the entry exists so that is checkable rather than assumed: no new accent, no new gradient, no new radius, shadow or motion token — three row marks carried by glyph, count and weight, one strip family assembled from `bg.raised` + `bg.hairline` + the two accents already assigned to failure (`danger`) and offline (`question`), and one new `§ Buttons` variant built from neutrals. The one place a reader might expect boldness — the hand-action undo, the only reversal of the one irreversible thing in the feature — is deliberately quiet, because `§ UndoAffordance` owns violet as *the assistant's own act* and a hand action is not one.
