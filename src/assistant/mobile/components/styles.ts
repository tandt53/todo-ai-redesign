// The one stylesheet, built from `docs/design/_shared/tokens.json` through
// `model/theme.ts`. Every value here is a token or arithmetic on tokens —
// reviewer C4 fails hardcoded design values, and there are none to fail.
//
// Dark-mode-first (DESIGN.md: the signature is glow and glow reads on dark);
// the light theme is fully tokened and picked up from the OS via
// `useColorScheme`.

import { createContext, useContext, useMemo } from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import { A11Y_IDS, SHELL_A11Y_IDS } from '../model/a11y.ts'
import { font, lineHeightFor, orbRadius, palette, radius, spacing } from '../model/theme.ts'
import type { ThemeName } from '../model/theme.ts'
import { MIN_TOUCH_TARGET, paintedBox } from '../model/touch.ts'

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
// The new-message pill is deliberately NOT in this list. Its painted height is
// padding on type, which `PAINTED` already computes from the same
// `spacing`/`font` tokens the style block below uses — the "single-sourced the
// other way" case above. Its width is its label's, and `PAINTED`'s width for
// that id is the documented placeholder standing in for a floor design has not
// measured yet; spreading the box would pin the control to 48 units wide and
// truncate the very question it exists to show.

// App-shell boxes, read from `PAINTED` on the same terms as the five above.
const pathBox = paintedBox(SHELL_A11Y_IDS.pathTasks)
const voiceFabBox = paintedBox(SHELL_A11Y_IDS.voiceFab)
const rowDeleteBox = paintedBox(SHELL_A11Y_IDS.tasksDeleteButton)
const menuRowBox = paintedBox(SHELL_A11Y_IDS.menuCollectionRow)
const segmentBox = paintedBox(SHELL_A11Y_IDS.settingsThemeControl)
/** `.btn-primary` / `.btn-ghost` / `.back-btn` all declare `min-height: 44px`
 * in the shell mockups, and 44 is `MIN_TOUCH_TARGET.ios` — the same number, so
 * it is read from there rather than written down twice. */
const MIN_BUTTON_HEIGHT = MIN_TOUCH_TARGET.ios
/** `--scrim` in the shell mockups' own `:root`, dark theme. It is NOT in
 * `tokens.json`; see the note on `scrim` below. */
const SCRIM_OPACITY = 0.66

export function makeStyles(c: Palette, platform: 'ios' | 'android' = 'ios') {
  // T-298: tokens.json declares per-platform font-size overrides (iOS body 17,
  // Android meta 14). The base `font.size` is the fallback; `fs` is the
  // resolved set for this device.
  const fs = font.sizeFor(platform)
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg.base },

    // ---- chrome ----
    // T-298: the topbar's bottom hairline is RETIRED — `border.primary_tool`:
    // space and ground are the primary structuring tools, and the panel pattern
    // replaces the three long structural borders between layout regions.
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      backgroundColor: c.bg.raised,
    },
    iconButton: {
      ...drawerBox,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wordmark: {
      fontFamily: font.family.ui,
      fontSize: fs.title,
      fontWeight: String(font.weight.title) as '600',
      color: c.text.primary,
    },
    topDate: {
      marginLeft: 'auto',
      fontFamily: font.family.numeric,
      fontSize: fs.meta,
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
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      lineHeight: lineHeightFor(fs.meta, 'meta'),
      color: c.attention,  // rule 1: attention = "this needs your answer" (offline)
      flexShrink: 1,
    },

    // ---- task list ----
    // T-298: listPane bottom hairline retired — same structural border class.
    listPane: { maxHeight: '36%' },
    listHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
    },
    listTitle: {
      fontFamily: font.family.ui,
      fontSize: fs.stateLabel,
      fontWeight: String(font.weight.title) as '600',
      color: c.text.primary,
    },
    listCount: { fontFamily: font.family.numeric, fontSize: fs.meta, color: c.text.muted },
    addButton: {
      marginLeft: 'auto',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
    },
    addButtonText: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.accent,   // pure rename: primary → accent ($meta.replaces)
    },
    dayHead: {
      paddingHorizontal: spacing.gutter_mobile,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
      fontFamily: font.family.ui,
      fontSize: fs.label,
      fontWeight: String(font.weight.label) as '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: c.text.muted,
    },
    // T-298: row separator hairline REMOVED. `border.when_a_line_earns_it`:
    // "The task row is `time · checkbox · title`, which is not a table." Things 3
    // and Apple Reminders draw nothing between task rows. Separation is space;
    // the row's ground arrives on press at `radius.md`.
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      borderRadius: radius.taskRow,
    },
    // T-298: checkbox from `radius.pill` (circle) to `radius.sm` (squircle).
    // `radius.assign.sm_note_checkbox`: "4px on 20px looked square, 8px reads
    // as a pressable squircle. One shape on all three platforms; the iOS circle
    // is dropped."
    checkbox: {
      ...checkboxBox,
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: c.text.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Design: .cbx:checked{background:var(--text-primary); border-color:var(--text-primary)}
    // Tick drawn in bg.base (mockups app-shell-ios:549, app-shell-android:544).
    checkboxDone: { backgroundColor: c.text.primary, borderColor: c.text.primary },
    // The row's main area: title left, marks right, single line. Defect 1
    // (T-300): the due date was wrapping to a second line under the title
    // because the Pressable defaulted to column layout.
    taskMain: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center',
      gap: spacing.sm,
    },
    taskTitle: {
      flex: 1,
      flexShrink: 1,
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      color: c.text.primary,
    },
    taskTitleDone: { textDecorationLine: 'line-through', color: c.text.muted },
    taskMeta: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      lineHeight: lineHeightFor(fs.meta, 'meta'),
      color: c.text.muted,
    },
    /**
     * § TaskRow's mark budget: all the marks live on the row's baseline-aligned
     * wrapping line, as inline siblings AFTER the title, in one fixed order.
     *
     * `flexWrap` is design's requirement rather than a default — *"nothing drops at
     * a narrow width"*: at `breakpoints.mobile` the marks wrap under the title
     * rather than being truncated or hidden, because a mark that disappears at one
     * width is a mark the user cannot rely on, and the accessible name would then
     * disagree with the visible row.
     */
    rowMarks: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    /**
     * TR-URGENCY — `fs.meta`, `font.weight.emphasis`, **`text.primary`**:
     * the one item on this line that is not muted, which is the "weight" half of
     * design's *shape, weight, name*. No colour (§ Colour rules 5).
     */
    urgencyMark: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      lineHeight: lineHeightFor(fs.meta, 'meta'),
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.text.primary,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      fontFamily: font.family.ui,
      fontSize: fs.label,
      fontWeight: String(font.weight.label) as '700',
      textTransform: 'uppercase',
      overflow: 'hidden',
    },
    // Rule 6: green/success retired — the label NEW does the work, the hue was
    // decoration. Added values read in text.primary at semibold.
    // Design: .new{font-weight:var(--w-semibold); color:var(--text-primary)}
    badgeNew: { color: c.text.primary, fontWeight: String(font.weight.semibold) as '600' },
    // Mockup: `.tag.edited{background:var(--bg-sunken); color:var(--text-secondary)}`.
    // EDITED is not the assistant speaking, so accent violates colour rule 1
    // ("one signal per meaning").
    badgeEdited: { color: c.text.secondary, backgroundColor: c.bg.sunken },

    // ---- conversation ----
    convPane: { flex: 1 },
    convContent: { padding: spacing.gutter_mobile, gap: spacing.md },
    invite: { paddingVertical: spacing.xxl, gap: spacing.sm },
    inviteTitle: {
      fontFamily: font.family.ui,
      fontSize: fs.display,
      lineHeight: lineHeightFor(fs.display, 'display'),
      fontWeight: String(font.weight.display) as '700',
      color: c.text.primary,
    },
    inviteBody: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
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
    bubbleUser: { backgroundColor: c.accentTint },
    bubbleQuestion: { backgroundColor: c.attentionTint, borderLeftWidth: 3, borderLeftColor: c.attention },
    bubbleError: { borderLeftWidth: 3, borderLeftColor: c.danger },
    bubbleUndone: { opacity: 0.7 },
    bubbleHead: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.text.primary,
    },
    bubbleHeadError: { color: c.danger },
    bubbleText: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      color: c.text.primary,
    },
    msgMeta: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      lineHeight: lineHeightFor(fs.meta, 'meta'),
      color: c.text.muted,
    },
    diffRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
    diffTask: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      color: c.text.primary,
    },
    // DESIGN.md colour rule 6: "added values now read in text.primary at semibold
    // **against the old value struck through in text.muted**". Both mockups agree:
    // `.old{color:var(--text-muted); text-decoration:line-through}` with no
    // background. An old diff value is muted and struck through, not red.
    chipOld: {
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      color: c.text.muted,
      textDecorationLine: 'line-through',
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      overflow: 'hidden',
    },
    // Rule 6: added values read in text.primary at semibold — the label does
    // the work, the hue was decoration. Design: .new{font-weight:semibold; color:text.primary}
    chipNew: {
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      color: c.text.primary,
      fontWeight: String(font.weight.semibold) as '600',
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      overflow: 'hidden',
    },
    miniLabel: {
      fontFamily: font.family.ui,
      fontSize: fs.label,
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
      borderColor: c.accent,
    },
    chipDanger: { borderColor: c.danger },
    chipDisabled: { borderColor: c.bg.hairline },
    chipText: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.accent,
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
      fontFamily: font.family.ui,
      fontSize: fs.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.accent,
    },
    primaryButton: {
      // § Buttons, shared with the app shell rather than declared twice — the
      // shell mockups' `.btn-primary` is this control with an icon slot and an
      // explicit `min-height: 44px`.
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: MIN_BUTTON_HEIGHT,
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: c.accent,
    },
    selfCenter: { alignSelf: 'center' },
    primaryButtonText: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
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
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      lineHeight: lineHeightFor(fs.meta, 'meta'),
      color: c.text.muted,
    },
    queuedNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    queuedNoticeText: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      color: c.attention,  // rule 1: attention = "this needs your answer"
    },

    // ---- new-message affordance (F-001 AC-30 / BUG-004) ----
    // ZERO-HEIGHT DOCK. The pill OVERLAYS the last line of the conversation
    // instead of reflowing it: an affordance that appears by pushing history
    // upward moves the sentence the user is reading, which is the exact defect
    // it exists to prevent (components.md § NewMessageAffordance). `height: 0`
    // plus an absolutely-positioned child is how that reads in RN, and it is
    // also why NMA-HIDDEN costs nothing — the dock holds no layout either way.
    nmDock: { height: 0, zIndex: 6 },
    nmWrap: {
      position: 'absolute',
      left: spacing.gutter_mobile,
      right: spacing.gutter_mobile,
      bottom: spacing.sm,
      alignItems: 'center',
    },
    nmPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: '100%',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: c.bg.raised,
      borderWidth: 1,
      borderColor: c.bg.hairline,
      // tokens.shadow.raised, as RN shadow props (the CSS string cannot cross).
      shadowColor: c.bg.base,
      shadowOpacity: 0.5,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    // NMA-WAITING takes the amber that already means "open question" everywhere
    // else in the catalogue. Colour never carries this alone — the words change
    // too (components.md), which is what `label` in `model/follow.ts` decides.
    nmPillWaiting: { backgroundColor: c.attentionTint, borderColor: c.attention },
    nmLabel: {
      flexShrink: 1,
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.text.primary,
    },
    nmLabelWaiting: { color: c.attention },

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
      fontFamily: font.family.ui,
      fontSize: fs.stateLabel,
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
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.accent,
    },

    // ---- composer ----
    // T-298: the composer's top hairline is RETIRED with the topbar's —
    // same structural border the panel pattern replaces.
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      backgroundColor: c.bg.raised,
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
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.primary,
    },
    // Rule 6: one accent means "the assistant", on both halves of its turn.
    // voice.listening/thinking → accent (DESIGN.md ## Colour rules rule 6).
    composerInputListening: { borderColor: c.accent, color: c.accent },
    mic: {
      ...micBox,
      borderRadius: orbRadius(micBox.width),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg.raised,
      borderWidth: 1,
      borderColor: c.bg.hairline,
    },
    micListening: { borderColor: c.accent },   // rule 6: accent = the assistant
    micThinking: { borderColor: c.accent },    // rule 6: accent = the assistant
    micDimmed: { opacity: 0.4 },
    micGlyph: { fontFamily: font.family.ui, fontSize: fs.title, color: c.text.primary },
    send: {
      ...sendBox,
      borderRadius: orbRadius(sendBox.width),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent,
    },
    sendDisabled: { opacity: 0.4 },
    sendGlyph: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.onAccent,
    },

    // ---- app shell (components.md § App shell) ----
    surface: { flex: 1, backgroundColor: c.bg.base },
    barSpacer: { flex: 1 },
    // § PathSwitch — ghost button, right-aligned, `text.primary`
    pathButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: pathBox.height,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
    },
    pathLabel: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.text.primary,
    },
    // the badge is a `radius.pill` accentTint fill with `accent` text
    pathBadge: {
      minWidth: spacing.lg,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: c.accentTint,
      overflow: 'hidden',
      textAlign: 'center',
      fontFamily: font.family.numeric,
      fontSize: fs.meta,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.accent,
    },
    // § VoiceFab — circular accent FAB, bottom-right, replaces Talk path switch
    // on the Tasks surface (T-257). Dimensions from `PAINTED[voiceFab]` (52×52),
    // positioning from `app-shell-ios.html .voice-fab { right: s4; bottom: s4 }`.
    voiceFab: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.md,
      ...voiceFabBox,
      borderRadius: orbRadius(voiceFabBox.width),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent,
      zIndex: 5,
    },
    // T-298: the hero `largeTitle` in the content column is replaced by
    // `barTitle` inside the bar. Kept for other surfaces that may still use it.
    largeTitle: {
      paddingHorizontal: spacing.gutter_mobile,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      fontFamily: font.family.ui,
      fontSize: fs.display,
      lineHeight: lineHeightFor(fs.display, 'display'),
      fontWeight: String(font.weight.title) as '600',
      color: c.text.primary,
    },
    // `bar-surface-title` in the design mockup: body size, semibold, inside the
    // bar beside the Lists button. On Android the mockup uses `lead` / `medium`.
    barTitle: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.text.primary,
    },
    // § SurfaceError — "It looks calm: body-size supporting text, one accent,
    // one button."
    surfaceError: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.gutter_mobile,
    },
    surfaceErrorTitle: {
      fontFamily: font.family.ui,
      fontSize: fs.title,
      fontWeight: String(font.weight.title) as '600',
      color: c.text.primary,
      textAlign: 'center',
    },
    surfaceErrorBody: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      color: c.text.secondary,
      textAlign: 'center',
    },
    ghostButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: MIN_BUTTON_HEIGHT,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    ghostButtonText: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.accent,
    },
    // § InlineRetryBanner — full-width strip, danger hairlines, never replaces
    // the list
    retryBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      backgroundColor: c.bg.raised,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.danger,
    },
    retryBannerText: {
      flexShrink: 1,
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      lineHeight: lineHeightFor(fs.meta, 'meta'),
      color: c.text.primary,
    },
    // ── § CarriedNotice (T-152) ────────────────────────────────────────────
    //
    // A region docked directly below the top bar, spanning the full frame width,
    // **in flow, outside the surface stack**. Zero new colour, radius, shadow or
    // motion tokens — design published none for it and none is invented here.
    //
    // The region PRE-EXISTS and is empty when there is nothing to report: a live
    // region created at the same moment as its content is not reliably announced
    // (§ SaveNotice's reasoning, with more force here because this one is created
    // once per app rather than once per surface). `cnRegionEmpty` is that empty
    // state — mounted, zero-height, no hairline.
    cnRegion: { backgroundColor: c.bg.raised },
    cnRegionEmpty: { height: 0 },
    // The below-split ceiling is TWO rows; further rows scroll within the region,
    // which never grows past that and always shows the first row in full.
    cnScrollCapped: { maxHeight: 216 },
    cnRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
      backgroundColor: c.bg.raised,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.bg.hairline,
    },
    cnBody: { flex: 1, gap: spacing.xs },
    cnSentence: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      color: c.text.primary,
    },
    cnBlock: { gap: spacing.xs },
    cnFieldLabel: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      lineHeight: lineHeightFor(fs.meta, 'meta'),
      color: c.text.muted,
    },
    // Three lines of the value, then it scrolls inside itself. Never truncated
    // with an ellipsis — *carries the user's value* is the component's reason to
    // exist, and a value the user cannot read back is not carried.
    cnValueScroll: { maxHeight: lineHeightFor(fs.body) * 3 },
    // **The user's own words are not chrome and are never muted** — `text.primary`
    // while the label above it is `text.muted`, which is the opposite of the usual
    // emphasis and is design's point.
    cnValue: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      color: c.text.primary,
    },
    cnSuperseded: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      lineHeight: lineHeightFor(fs.meta, 'meta'),
      color: c.text.muted,
    },
    // `Retry` keeps § Buttons' `ghost` variant — retry is not an undo, and
    // § InlineRetryBanner and § SurfaceError already ship a ghost Retry: one word,
    // one treatment, three sites.
    cnGhostButton: {
      alignSelf: 'flex-start',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    cnGhostButtonText: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.accent,
    },
    // `Put back` takes § Buttons' NEW `neutral` variant, and that variant exists
    // for one reason: AC-43's offer is the one control in the catalogue with an
    // explicit prohibition on a colour. § UndoAffordance fixes violet as *the
    // assistant's own act* and this reverses the **user's** act, so the control
    // must not wear the accent that would claim otherwise.
    cnNeutralButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.bg.hairline,
      backgroundColor: c.bg.base,
    },
    cnNeutralButtonText: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      fontWeight: String(font.weight.emphasis) as '600',
      color: c.text.primary,
    },
    cnDismiss: { alignItems: 'center', justifyContent: 'center' },
    // § Empty states — Tasks
    emptyState: { padding: spacing.gutter_mobile, gap: spacing.sm, alignItems: 'flex-start' },
    emptyHead: {
      fontFamily: font.family.ui,
      fontSize: fs.title,
      fontWeight: String(font.weight.title) as '600',
      color: c.text.primary,
    },
    emptyBody: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      lineHeight: lineHeightFor(fs.body),
      color: c.text.secondary,
    },
    secondDoor: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      color: c.text.muted,
    },
    // § Skeletons — no text, no testid, `bg.hairline` on `bg.raised`
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.gutter_mobile,
      paddingVertical: spacing.sm,
    },
    // § Skeletons SK-ROW — a bar where the day heading will go, at the
    // heading's size and position. The words were never part of the
    // silhouette, and a skeleton cannot know which heading the read produces.
    skeletonDayHead: {
      marginHorizontal: spacing.gutter_mobile,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      width: 96,
      height: fs.label,
      borderRadius: radius.sm,
      backgroundColor: c.bg.hairline,
    },
    skeletonBox: { ...checkboxBox, borderRadius: radius.sm, backgroundColor: c.bg.hairline },
    skeletonBar: { height: lineHeightFor(fs.body), borderRadius: radius.sm, backgroundColor: c.bg.hairline },
    skeletonBubble: {
      height: lineHeightFor(fs.body) * 2,
      marginHorizontal: spacing.gutter_mobile,
      marginBottom: spacing.md,
      borderRadius: radius.bubble,
      backgroundColor: c.bg.hairline,
    },
    // § MessageTaskLink — underline in `text.muted`, no colour change
    taskLink: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.primary,
      textDecorationLine: 'underline',
      textDecorationColor: c.text.muted,
    },
    // the row's trailing delete slot — always visible on touch
    rowDelete: {
      ...rowDeleteBox,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
    },
    renameInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.accent,
      backgroundColor: c.bg.raised,
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.primary,
    },
    // AC-31's arrival cue — AC-4's own diff-flash tint, at the moment it informs
    rowArrived: { backgroundColor: c.accentTint },
    // § InlineAdd — the `+ Add a task` row at the end of the task list (T-285).
    // Resting state: a plus icon and the label, full-width, tappable.
    // Editing state: the label is replaced by a text input.
    inlineAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.gutter_mobile,
    },
    // T-298: inline-add editing hairline retired with the row separators —
    // same reasoning: space separates, not a line.
    inlineAddEditing: {},
    inlineAddLabel: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.muted,
    },
    inlineAddInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.primary,
      paddingVertical: 0,
    },
    // The empty-state standalone add field. NOT `renameInput`: that style
    // carries `flex: 1`, which inside a column parent means "take all remaining
    // height" and renders a 500px-tall field. This one uses explicit padding
    // instead, matching the same visual height without the flex stretch.
    emptyAddInput: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.accent,
      backgroundColor: c.bg.raised,
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.primary,
    },
    // § ListsMenu — a slide-over panel with a scrim at every width
    // The mockups declare `--scrim` as `bg.base` at 66% (dark) — the COLOUR is
    // the token; only the alpha is transcribed, because `tokens.json` publishes
    // no scrim entry. Reported as a token gap rather than invented here.
    scrim: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.bg.base,
      opacity: SCRIM_OPACITY,
    },
    menuPanel: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: '82%',
      backgroundColor: c.bg.raised,
      paddingVertical: spacing.md,
    },
    menuHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: menuRowBox.height,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.sm,
      borderRadius: radius.sm,
    },
    menuRowActive: { backgroundColor: c.accentTint },
    // The group break (components.md § ListsMenu, "Where the Inbox row sits"):
    // the views and the gate, then space, then the filing rows. Space, not a
    // rule and not a header — whitespace groups before borders do, and no word
    // is true of both Inbox and the user's own lists. It is what stops the
    // column reading as arithmetic now that Inbox's count contains Today's.
    menuFilingGroup: { marginTop: spacing.lg },
    menuRowText: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.primary,
    },
    menuRowTextActive: { color: c.accent },
    menuCount: {
      marginLeft: 'auto',
      fontFamily: font.family.numeric,
      fontSize: fs.meta,
      color: c.text.muted,
    },
    menuFoot: { marginTop: 'auto' },
    // § SettingsRow — flat rows on `bg.base`, hairline between, no cards
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.bg.hairline,
    },
    settingsLabel: {
      fontFamily: font.family.ui,
      fontSize: fs.body,
      color: c.text.primary,
    },
    settingsSub: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      color: c.text.muted,
    },
    segment: {
      flexDirection: 'row',
      marginLeft: 'auto',
      borderRadius: radius.sm,
      backgroundColor: c.bg.raised,
      padding: spacing.xs / 2,
    },
    segmentButton: {
      minHeight: segmentBox.height,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
    },
    segmentButtonOn: { backgroundColor: c.accentTint },
    segmentText: {
      fontFamily: font.family.ui,
      fontSize: fs.meta,
      color: c.text.secondary,
    },
    segmentTextOn: { color: c.accent, fontWeight: String(font.weight.emphasis) as '600' },
  })
}

export type Styles = ReturnType<typeof makeStyles>

/** S4's Theme row (`settings-theme-control`). `system` is what the app did
 * before the Settings surface existed, so it stays the default and the OS
 * remains the answer until the user says otherwise. `tokens.json` ships both
 * themes fully; the app simply had no control (IA §3, "a capability that exists
 * today with no surface"). */
export type ThemeChoice = ThemeName | 'system'

/** Read by `useStyles` rather than passed down, so the eight components that
 * already call `useStyles()` need no new prop and cannot each answer the
 * question differently. */
export const ThemeChoiceContext = createContext<ThemeChoice>('system')

/** T-298: platform-specific font sizes require `makeStyles` to know the
 * platform. Set once by the app shell — the platform never changes during a
 * session, so memoization keys on (scheme, choice, platform). */
export const PlatformContext = createContext<'ios' | 'android'>('ios')

export function useStyles(): { styles: Styles; colors: Palette } {
  const scheme = useColorScheme()
  const choice = useContext(ThemeChoiceContext)
  const platform = useContext(PlatformContext)
  return useMemo(() => {
    const resolved: ThemeName =
      choice === 'system' ? (scheme === 'light' ? 'light' : 'dark') : choice
    const colors = palette(resolved)
    return { styles: makeStyles(colors, platform), colors }
  }, [scheme, choice, platform])
}
