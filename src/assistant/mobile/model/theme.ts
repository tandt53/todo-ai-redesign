// The design tokens, as React Native style values.
//
// `docs/design/_shared/tokens.json` is imported DIRECTLY rather than transcribed:
// tokens.json says "Every value an implementer uses comes from this file", and
// a hand-kept second copy is the exact failure LEARNINGS L-004 records — a
// canonical artifact living in two files drifts, and the drift shows up as a
// workaround rather than a red test. Reviewer C4 fails hardcoded design values;
// there are none here to fail.
//
// The only translation this file performs is unit-level: CSS strings → RN
// numbers (px → density-independent units), CSS shadows → RN shadow props.
// No value is chosen here.

import tokensJson from '../../../../docs/design/_shared/tokens.json' with { type: 'json' }

export const tokens = tokensJson

export type ThemeName = 'dark' | 'light'

// tokens.json v2 keys only — the T-207 translation layer that kept retired
// names alive (success, voice, diff, primary, question) is deleted as of T-232.
// Every call site now references the v2 key directly and cites the design rule
// that decided the replacement.
export function palette(theme: ThemeName = tokens.$meta.default_theme as ThemeName) {
  return theme === 'light' ? tokens.color.light : tokens.color.dark
}

// tokens.json renamed `spacing` → `space` with numeric indices (0–9, 4-based).
// This object preserves the named keys the mobile code already uses so the
// translation is in one place rather than 50.
export const spacing = {
  xs:  tokens.space['1'],          // 4
  sm:  tokens.space['2'],          // 8
  md:  tokens.space['4'],          // 16
  lg:  tokens.space['5'],          // 24
  xxl: tokens.space['7'],          // 48
  gutter_mobile: tokens.space['4'], // 16 — per space_note
}
// tokens.json v2 simplified the radius scale. `bubble` and `taskRow` are both
// grounds → `md`.  `sheet` → `xl` (per radius.assign: "THE TOP TWO CORNERS of
// a bottom sheet"). Named keys preserved for the same reason as `spacing`.
export const radius = {
  sm: tokens.radius.sm,
  md: tokens.radius.md,
  bubble: tokens.radius.md,    // retired — "a message bubble is a ground and takes md"
  sheet: tokens.radius.xl,     // bottom-sheet top corners
  pill: tokens.radius.pill,
  /** tokens.radius.orb is the CSS "50%"; in RN a circle is half the side, so
   * the caller passes its own size — see `orbRadius`. */
  taskRow: tokens.radius.md,   // task row ground
}

/** RN has no percentage border radius: a circle is side / 2. */
export function orbRadius(side: number): number {
  return side / 2
}

// CSS generics (`ui-monospace`, `system-ui`, `monospace`, …) are valid in a
// browser but not as RN family names. Skip them when extracting the first
// entry from a CSS font stack.
const CSS_GENERICS = new Set([
  'ui-monospace', 'monospace', 'system-ui', 'sans-serif', 'serif', 'cursive', 'fantasy',
])

function firstNamedFace(cssStack: string, fallback: string): string {
  for (const raw of cssStack.split(',')) {
    const name = raw.replace(/'/g, '').trim()
    if (name && !CSS_GENERICS.has(name)) return name
  }
  return fallback
}

export const font = {
  family: {
    // tokens.json collapsed display+body into ONE `ui` family (Inter) —
    // hierarchy is size/weight/case, not a second voice.  `numeric` is the
    // tabular face, legal only on times, dates, counts, durations and ids.
    ui: firstNamedFace(tokens.font.family.ui, 'Inter'),
    numeric: firstNamedFace(tokens.font.family.numeric, 'monospace'),
  },
  size: {
    ...tokens.font.size,
    // `stateLabel` — section heading / voice indicator — mapped to `lead` (20).
    stateLabel: tokens.font.size.lead,
  },
  weight: {
    ...tokens.font.weight,
    // v2 uses standard CSS names; the old semantic aliases are preserved here
    // so styles.ts reads without a full rename. The `as '600'` casts in
    // styles.ts already document the intended value.
    display: tokens.font.weight.bold,     // 700
    title: tokens.font.weight.semibold,   // 600
    emphasis: tokens.font.weight.semibold, // 600
    label: tokens.font.weight.bold,       // 700
  },
  lineHeight: {
    ...tokens.font.lineHeight,
    // `display` was a separate lineHeight key; v2 merged it into the
    // tight/title/body/meta set. Display headings use `title` (1.25).
    display: tokens.font.lineHeight.title,
  },
}

/** Body line-height 1.5 is a hard floor declared by `tokens.json` font.note —
 * design's number, not a local choice, and unchanged by ADR-008 (the note still
 * states its original stacked-diacritic rationale; that is design's to revisit,
 * not this file's to restate). RN takes line height in absolute units, so it is
 * computed from the size rather than declared. */
export function lineHeightFor(size: number, kind: keyof typeof font.lineHeight = 'body'): number {
  return Math.round(size * font.lineHeight[kind])
}

export const motion = tokens.motion

// The aurora gradient and its glow shadows are RETIRED — tokens.json's motion
// rule: "the 2400ms aurora loop and a spring curve; both are retired with the
// gradient." `tokens.gradient` no longer exists, and `color.*.voice` was removed
// alongside it. The voice surface now uses the accent colour directly.
//
// `voiceGradient` and `shadow` used to be exported here. Consumers
// (VoiceSurface.tsx) are updated to not depend on them.

export const haptics = tokens.haptic
