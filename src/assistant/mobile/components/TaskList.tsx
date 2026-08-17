// The task list — the source of truth the user verifies with their eyes
// (F-001 Purpose). Flat rows (design system: tasks are rows, not cards), AI
// change markers from `state.marks` (F-001 AC-4), and the whole manual path
// works by touch with zero AI calls (F-001 AC-18).
//
// Every touchable declares its hit area through `touchProps` — the checkbox
// paints 22pt and must still be a 44/48 target (F-003 AC-9).

import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Check, Plus } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { formatDue } from '../../_shared/model/format.ts'
import type { DiffLine, TaskView } from '../../_shared/types.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

function TaskRow({
  task,
  mark,
  controller,
  platform,
}: {
  task: TaskView
  mark: DiffLine | null
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles, colors } = useStyles()
  const done = task.status === 'done'
  const meta =
    task.due_at !== null
      ? formatDue(task.due_at)
      : task.local === true
        ? 'saved on the device'
        : null
  const rowTouch = touchProps(A11Y_IDS.taskRow, platform)
  const boxTouch = touchProps(A11Y_IDS.taskCheckbox, platform)

  return (
    <View {...a11yProps(A11Y_IDS.taskRow)} style={styles.taskRow} hitSlop={rowTouch.hitSlop}>
      <Pressable
        {...a11yProps(A11Y_IDS.taskCheckbox, {
          label: `Mark “${task.title}” as ${done ? 'not done' : 'done'}`,
          role: 'checkbox',
          state: { checked: done },
        })}
        hitSlop={boxTouch.hitSlop}
        style={[styles.checkbox, done ? styles.checkboxDone : null]}
        onPress={() => void controller.toggleTask(task.id)}
      >
        {done ? (
          <Check size={tokens.icon.size.sm} color={colors.success} strokeWidth={tokens.icon.stroke} />
        ) : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskTitle, done ? styles.taskTitleDone : null]}>{task.title}</Text>
        {mark !== null && (
          // AC-4: the marker carries a TEXT label, never colour alone.
          <Text
            {...a11yProps(A11Y_IDS.rowBadge)}
            style={[styles.badge, mark.label === 'new' ? styles.badgeNew : styles.badgeEdited]}
          >
            {mark.label === 'new' ? 'NEW' : 'EDITED'}
          </Text>
        )}
        {meta !== null && <Text style={styles.taskMeta}>{meta}</Text>}
      </View>
    </View>
  )
}

export function TaskList({
  state,
  controller,
  platform,
}: {
  state: AppState
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles, colors } = useStyles()
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const open = state.tasks.filter((t) => t.status !== 'done').length
  const addTouch = touchProps(A11Y_IDS.addTaskButton, platform)

  const commit = () => {
    if (draft.trim() !== '') void controller.addTask(draft)
    setDraft('')
    setAdding(false)
  }

  return (
    <View style={styles.listPane}>
      <View style={styles.listHead}>
        <Text style={styles.listTitle}>Your list</Text>
        {state.tasks.length > 0 && (
          <Text style={styles.listCount}>
            {open} {open === 1 ? 'task' : 'tasks'} left
          </Text>
        )}
        <Pressable
          {...a11yProps(A11Y_IDS.addTaskButton, { label: 'Add task', role: 'button' })}
          hitSlop={addTouch.hitSlop}
          style={styles.addButton}
          onPress={() => setAdding(true)}
        >
          <Plus size={tokens.icon.size.sm} color={colors.primary} strokeWidth={tokens.icon.stroke} />
        </Pressable>
      </View>
      {adding && (
        <TextInput
          accessibilityLabel="New task name"
          placeholder="Task name…"
          placeholderTextColor={colors.text.muted}
          style={[styles.composerInput, { marginHorizontal: tokens.spacing.gutter_mobile }]}
          value={draft}
          autoFocus
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
        />
      )}
      <ScrollView keyboardShouldPersistTaps="handled">
        {state.tasks.length === 0 ? (
          <Text style={[styles.taskMeta, { paddingHorizontal: tokens.spacing.gutter_mobile }]}>
            No tasks yet — say one. Say a sentence and it lands here.
          </Text>
        ) : (
          state.tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              mark={state.marks?.byTask[t.id] ?? null}
              controller={controller}
              platform={platform}
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}
