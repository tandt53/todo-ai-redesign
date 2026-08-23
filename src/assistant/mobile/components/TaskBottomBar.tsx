// § TaskBottomBar — the fixed bottom bar on the Tasks surface below
// `breakpoints.split` (T-321, AC-37). A text field and one action button that
// morphs between two identities:
//
//   field empty  → mic icon, accessible name "Talk", navigates to Talk
//   field has text → arrow-up icon, accessible name "Add task", commits title
//
// The morph fires on the FIRST CHARACTER entering or the LAST CHARACTER leaving
// the field — not on focus or blur (AC-37). The accessible name tracks the
// current function (WCAG 4.1.2).
//
// The bar replaces both InlineAdd and the floating voice FAB below split.
// Typing commits through the existing literal path — `controller.addTask`,
// title verbatim — not `send()`.

import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { ArrowUp, Mic } from 'lucide-react-native'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useKeyboardInset } from './useKeyboardInset.ts'
import { useStyles } from './styles.ts'

export function TaskBottomBar({
  platform,
  onGoTalk,
  onAddTask,
}: {
  platform: MobilePlatform
  onGoTalk: () => void
  onAddTask: (title: string) => void
}) {
  const { styles, colors } = useStyles()
  const [text, setText] = useState('')
  const keyboardInset = useKeyboardInset()

  // The morph: hasText tracks whether the field holds text, and determines
  // which identity the action button takes. The morph fires on the first
  // character entering or the last character leaving — which is exactly when
  // `text` transitions between empty and non-empty.
  const hasText = text.length > 0

  const actionTouch = touchProps(SHELL_A11Y_IDS.tasksBarAction, platform)

  const handleAction = () => {
    if (hasText) {
      // Submit the typed title through the literal add path
      const title = text.trim()
      if (title !== '') {
        onAddTask(title)
      }
      setText('')
    } else {
      // Navigate to Talk
      onGoTalk()
    }
  }

  const handleSubmitEditing = () => {
    const title = text.trim()
    if (title !== '') {
      onAddTask(title)
    }
    setText('')
  }

  return (
    <View style={[styles.taskBottomBar, keyboardInset > 0 && { marginBottom: keyboardInset }]}>
      <TextInput
        {...a11yProps(SHELL_A11Y_IDS.tasksBarInput, { label: 'Add a task' })}
        style={styles.taskBottomBarInput}
        placeholder="Add a task"
        placeholderTextColor={colors.text.muted}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmitEditing}
        returnKeyType="done"
      />
      <Pressable
        {...a11yProps(SHELL_A11Y_IDS.tasksBarAction, {
          label: hasText ? 'Add task' : 'Talk',
          role: 'button',
        })}
        hitSlop={actionTouch.hitSlop}
        style={[
          styles.taskBottomBarAction,
          hasText ? styles.taskBottomBarActionSend : styles.taskBottomBarActionTalk,
        ]}
        onPress={handleAction}
      >
        {hasText ? (
          <ArrowUp
            size={tokens.icon.size.md}
            color={colors.text.onAccent}
            strokeWidth={tokens.icon.stroke}
          />
        ) : (
          <Mic
            size={tokens.icon.size.md}
            color={colors.text.secondary}
            strokeWidth={tokens.icon.stroke}
          />
        )}
      </Pressable>
    </View>
  )
}
