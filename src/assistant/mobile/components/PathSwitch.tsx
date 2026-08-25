// Shell bar and Talk close button.
//
// T-334: PathSwitch (the reciprocal navigation control between Talk and Tasks)
// is retired. The task list is home; Talk is summoned over it by the mic and
// dismissed by the close button or system back. ShellBar is kept — both
// surfaces share it.
//
// **Visible and enabled in EVERY Talk state, failures included** (F-001
// AC-24's reachability bound). Nothing in this file can disable it: there is
// no `disabled` prop, which is a cheaper guarantee than remembering not to
// pass one.

import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { X } from 'lucide-react-native'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

/** Close button on the Talk surface — dismisses Talk to the task list. */
export function TalkCloseButton({
  platform,
  onPress,
}: {
  platform: MobilePlatform
  onPress: () => void
}) {
  const { styles, colors } = useStyles()
  const id = SHELL_A11Y_IDS.talkCloseButton
  const { hitSlop } = touchProps(id, platform)
  return (
    <Pressable
      {...a11yProps(id, { label: 'Close', role: 'button' })}
      hitSlop={hitSlop}
      style={styles.talkCloseButton}
      onPress={onPress}
    >
      <X size={tokens.icon.size.md} color={colors.text.primary} strokeWidth={tokens.icon.stroke} />
    </Pressable>
  )
}

/** The top bar shared by both surfaces.
 *
 * `title` sits between the left slot and the spacer — on the Tasks surface
 * it carries the collection name at body/semibold (matching `bar-surface-title`
 * in app-shell-ios.html). The hero heading in the content column is removed;
 * on a phone the bar IS the heading. */
export function ShellBar({ left, title, children }: { left?: ReactNode; title?: ReactNode; children: ReactNode }) {
  const { styles } = useStyles()
  return (
    <View style={styles.topBar}>
      {left}
      {title}
      <View style={styles.barSpacer} />
      {children}
    </View>
  )
}
