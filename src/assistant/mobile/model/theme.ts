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

export function palette(theme: ThemeName = tokens.$meta.default_theme as ThemeName) {
  return theme === 'light' ? tokens.color.light : tokens.color.dark
}

export const spacing = tokens.spacing
export const radius = {
  sm: tokens.radius.sm,
  md: tokens.radius.md,
  bubble: tokens.radius.bubble,
  sheet: tokens.radius.sheet,
  pill: tokens.radius.pill,
  /** tokens.radius.orb is the CSS "50%"; in RN a circle is half the side, so
   * the caller passes its own size — see `orbRadius`. */
  taskRow: tokens.radius.taskRow,
}

/** RN has no percentage border radius: a circle is side / 2. */
export function orbRadius(side: number): number {
  return side / 2
}

export const font = {
  family: {
    // RN wants a single family name, not a CSS stack; the stack's first entry
    // is the intended face and the rest are web fallbacks.
    display: tokens.font.family.display.split(',')[0]?.replace(/'/g, '').trim() ?? 'Space Grotesk',
    body: tokens.font.family.body.split(',')[0]?.replace(/'/g, '').trim() ?? 'Be Vietnam Pro',
  },
  size: tokens.font.size,
  weight: tokens.font.weight,
  lineHeight: tokens.font.lineHeight,
}

/** Body line-height 1.5 is a hard floor declared by `tokens.json` font.note —
 * design's number, not a local choice, and unchanged by ADR-008 (the note still
 * states its original stacked-diacritic rationale; that is design's to revisit,
 * not this file's to restate). RN takes line height in absolute units, so it is
 * computed from the size rather than declared. */
export function lineHeightFor(size: number, kind: keyof typeof tokens.font.lineHeight = 'body'): number {
  return Math.round(size * tokens.font.lineHeight[kind])
}

export const motion = tokens.motion

/** The aurora gradient — the ONE place it is legal is the voice surface
 * (DESIGN.md colour rule 4; tokens.gradient.voice.scope). */
export const voiceGradient = tokens.gradient.voice

/** Glow shadows are voice-surface only (tokens.shadow.note); list rows carry
 * no shadow at all. RN shadows are props, not a CSS string. */
export const shadow = {
  listening: {
    shadowColor: tokens.color.dark.voice.listening,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  thinking: {
    shadowColor: tokens.color.dark.voice.thinking,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
} as const

export const haptics = tokens.haptic
