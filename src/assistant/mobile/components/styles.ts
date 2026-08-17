// The one stylesheet, built from `design/_shared/tokens.json` through
// `model/theme.ts`. Every value here is a token or arithmetic on tokens —
// reviewer C4 fails hardcoded design values, and there are none to fail.
//
// Dark-mode-first (DESIGN.md: the signature is glow and glow reads on dark);
// the light theme is fully tokened and picked up from the OS via
// `useColorScheme`.

import { useMemo } from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import { A11Y_IDS } from '../model/a11y.ts'
import { font, lineHeightFor, orbRadius, palette, radius, spacing } from '../model/theme.ts'
import { paintedBox } from '../model/touch.ts'

export type Palette = ReturnType<typeof palette>

// AC-9's painted dimensions are declared ONCE, in `model/touch.ts` `PAINTED`,
// and read from there — this file restates none of them. `PAINTED` is what the
// hit-area maths and the unit tier already measure, so a box that changes there
// moves the rendered control with it instead of leaving these two in silent
// agreement until one is edited.
//
// Controls whose painted height comes from padding on type (add button, task
// row, undo, retry, chips, cancel) are already single-sourced the other way:
// `PAINTED` computes them from the same `spacing`/`font` tokens this stylesheet
// uses as padding, so neither side holds a number.
const drawerBox = paintedBox(A11Y_IDS.drawerButton)
const checkboxBox = paintedBox(A11Y_IDS.taskCheckbox)
const composerInputBox = paintedBox(A11Y_IDS.composerInput)
const micBox = paintedBox(A11Y_IDS.micButton)
const sendBox = paintedBox(A11Y_IDS.composerSend)

export function makeStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg.base },

    // ---- chrome ----
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      backgroundColor: c.bg.raised,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.bg.hairline,
    },
    iconButton: {
      ...drawerBox,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wordmark: {
      fontFamily: font.family.display,
      fontSize: font.size.title,
      fontWeight: String(font.weight.title) as '600',
      color: c.text.primary,
    },
    topDate: {
      marginLeft: 'auto',
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      color: c.text.muted,
    },
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      backgroundColor: c.bg.raised,
    },
    offlineText: {
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      lineHeight: lineHeightFor(font.size.meta, 'meta'),
      color: c.question,
      flexShrink: 1,
    },

    // ---- task list ----
    listPane: { maxHeight: '36%', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.bg.hairline },
    listHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
    },
    listTitle: {
      fontFamily: font.family.display,
      fontSize: font.size.stateLabel,
      fontWeight: String(font.weight.title) as '600',
      color: c.text.primary,
    },
    listCount: { fontFamily: font.family.body, fontSize: font.size.meta, color: c.text.muted },
    addButton: {
      marginLeft: 'auto',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
    },
    addButtonText: {
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.primary,
    },
    dayHead: {
      paddingHorizontal: spacing.gutter_mobile,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
      fontFamily: font.family.body,
      fontSize: font.size.label,
      fontWeight: String(font.weight.label) as '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: c.text.muted,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      borderRadius: radius.taskRow,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.bg.hairline,
    },
    checkbox: {
      ...checkboxBox,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: c.text.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxDone: { borderColor: c.success },
    taskTitle: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      lineHeight: lineHeightFor(font.size.body),
      color: c.text.primary,
    },
    taskTitleDone: { textDecorationLine: 'line-through', color: c.text.muted },
    taskMeta: {
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      lineHeight: lineHeightFor(font.size.meta, 'meta'),
      color: c.text.muted,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      fontFamily: font.family.body,
      fontSize: font.size.label,
      fontWeight: String(font.weight.label) as '700',
      textTransform: 'uppercase',
      overflow: 'hidden',
    },
    badgeNew: { color: c.diff.add, backgroundColor: c.diff.addTint },
    badgeEdited: { color: c.primary, backgroundColor: c.primaryTint },

    // ---- conversation ----
    convPane: { flex: 1 },
    convContent: { padding: spacing.gutter_mobile, gap: spacing.md },
    invite: { paddingVertical: spacing.xxl, gap: spacing.sm },
    inviteTitle: {
      fontFamily: font.family.display,
      fontSize: font.size.display,
      lineHeight: lineHeightFor(font.size.display, 'display'),
      fontWeight: String(font.weight.display) as '700',
      color: c.text.primary,
    },
    inviteBody: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      lineHeight: lineHeightFor(font.size.body),
      color: c.text.secondary,
    },
    msgUser: { alignSelf: 'flex-end', maxWidth: '86%', gap: spacing.xs },
    msgAi: { alignSelf: 'flex-start', maxWidth: '92%', gap: spacing.xs },
    bubble: {
      backgroundColor: c.bg.raised,
      borderRadius: radius.bubble,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    bubbleUser: { backgroundColor: c.primaryTint },
    bubbleQuestion: { backgroundColor: c.questionTint, borderLeftWidth: 3, borderLeftColor: c.question },
    bubbleError: { borderLeftWidth: 3, borderLeftColor: c.danger },
    bubbleUndone: { opacity: 0.7 },
    bubbleHead: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      lineHeight: lineHeightFor(font.size.body),
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.text.primary,
    },
    bubbleHeadError: { color: c.danger },
    bubbleText: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      lineHeight: lineHeightFor(font.size.body),
      color: c.text.primary,
    },
    msgMeta: {
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      lineHeight: lineHeightFor(font.size.meta, 'meta'),
      color: c.text.muted,
    },
    diffRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
    diffTask: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      lineHeight: lineHeightFor(font.size.body),
      color: c.text.primary,
    },
    chipOld: {
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: c.diff.removeTint,
      color: c.diff.remove,
      textDecorationLine: 'line-through',
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      overflow: 'hidden',
    },
    chipNew: {
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: c.diff.addTint,
      color: c.diff.add,
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      overflow: 'hidden',
    },
    miniLabel: {
      fontFamily: font.family.body,
      fontSize: font.size.label,
      fontWeight: String(font.weight.label) as '700',
      textTransform: 'uppercase',
      color: c.text.muted,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    chip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.primary,
    },
    chipDanger: { borderColor: c.danger },
    chipDisabled: { borderColor: c.bg.hairline },
    chipText: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.primary,
    },
    chipTextDanger: { color: c.danger },
    chipTextDisabled: { color: c.text.muted },
    undoButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    undoButtonText: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.primary,
    },
    primaryButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: c.primary,
    },
    primaryButtonText: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.text.onAccent,
    },
    boundary: {
      paddingVertical: spacing.md,
      gap: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.bg.hairline,
    },
    boundaryText: {
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      lineHeight: lineHeightFor(font.size.meta, 'meta'),
      color: c.text.muted,
    },
    queuedNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    queuedNoticeText: {
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      color: c.question,
    },

    // ---- voice surface (the ONE place the gradient is legal) ----
    voiceSurface: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
    stateIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      // Deliberately NOT derived from MIN_TOUCH_TARGET: this row is not
      // interactive (the cancel button inside it carries its own hit slop), so
      // this is a layout reservation that keeps the surface from jumping
      // between states. Tying it to a platform minimum would make one
      // platform's guideline govern a platform-neutral layout.
      minHeight: 44,
    },
    stateWord: {
      fontFamily: font.family.display,
      fontSize: font.size.stateLabel,
      fontWeight: String(font.weight.title) as '600',
      color: c.text.primary,
    },
    cancelButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: c.bg.raised,
      borderWidth: 1,
      borderColor: c.bg.hairline,
    },
    cancelButtonText: {
      fontFamily: font.family.body,
      fontSize: font.size.meta,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.primary,
    },

    // ---- composer ----
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      backgroundColor: c.bg.raised,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.bg.hairline,
    },
    composerInput: {
      flex: 1,
      // Width is `flex: 1`, not a painted number: PAINTED's 200 is the minimum
      // content width the hit-area maths assumes, and a wider field only ever
      // grows the target. The height is the painted dimension, so it comes
      // from the one declaration.
      height: composerInputBox.height,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.bg.hairline,
      backgroundColor: c.bg.base,
      paddingHorizontal: spacing.lg,
      fontFamily: font.family.body,
      fontSize: font.size.body,
      color: c.text.primary,
    },
    composerInputListening: { borderColor: c.voice.listening, color: c.voice.listening },
    mic: {
      ...micBox,
      borderRadius: orbRadius(micBox.width),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg.raised,
      borderWidth: 1,
      borderColor: c.bg.hairline,
    },
    micListening: { borderColor: c.voice.listening },
    micThinking: { borderColor: c.voice.thinking },
    micDimmed: { opacity: 0.4 },
    micGlyph: { fontFamily: font.family.body, fontSize: font.size.title, color: c.text.primary },
    send: {
      ...sendBox,
      borderRadius: orbRadius(sendBox.width),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    sendDisabled: { opacity: 0.4 },
    sendGlyph: {
      fontFamily: font.family.body,
      fontSize: font.size.body,
      color: c.text.onAccent,
    },
  })
}

export type Styles = ReturnType<typeof makeStyles>

export function useStyles(): { styles: Styles; colors: Palette } {
  const scheme = useColorScheme()
  return useMemo(() => {
    const colors = palette(scheme === 'light' ? 'light' : 'dark')
    return { styles: makeStyles(colors), colors }
  }, [scheme])
}
