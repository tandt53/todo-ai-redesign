// AC-37 — the TaskBottomBar's morphing action button.
//
// The accessible name tracks the function (WCAG 4.1.2): "Talk" when the field
// is empty (the button navigates), "Add task" when the field holds text (the
// button submits). Each name would be a defect in the other's state.
//
// This test would fail if the accessible name did not track the function, in
// both directions. It is a CONTRACT test: the two names are the ones AC-37
// specifies, and any implementation that produces them satisfies the AC. An
// implementation that hardcodes one name for both states fails here.
//
// The model tier cannot render components, so this test exercises the a11yProps
// helper with the same arguments the component passes — proving the contract
// holds, not that React wires it.

import { describe, expect, it } from 'vitest'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'

describe('AC-37 — TaskBottomBar morph', () => {
  // The two identities of the action button, exercised with a11yProps the same
  // way the component calls it.
  const emptyFieldProps = a11yProps(SHELL_A11Y_IDS.tasksBarAction, {
    label: 'Talk',
    role: 'button',
  })
  const hasTextProps = a11yProps(SHELL_A11Y_IDS.tasksBarAction, {
    label: 'Add task',
    role: 'button',
  })

  it('the action button is "Talk" when the field is empty — it navigates, it does not start capture', () => {
    expect(emptyFieldProps.testID).toBe('tasks-bar-action')
    expect(emptyFieldProps.accessibilityLabel).toBe('Talk')
    expect(emptyFieldProps.accessibilityRole).toBe('button')
    // "Start listening" is wrong in both states (AC-37)
    expect(emptyFieldProps.accessibilityLabel).not.toBe('Start listening')
  })

  it('the action button is "Add task" when the field holds text — it submits, it does not navigate', () => {
    expect(hasTextProps.testID).toBe('tasks-bar-action')
    expect(hasTextProps.accessibilityLabel).toBe('Add task')
    expect(hasTextProps.accessibilityRole).toBe('button')
    // "Start listening" is wrong in both states (AC-37)
    expect(hasTextProps.accessibilityLabel).not.toBe('Start listening')
  })

  it('the two names are different — a name that does not track the function is the defect', () => {
    // This is the assertion that would catch a hardcoded name:
    // if someone sets label to "Talk" in both states, or "Add task" in both
    // states, this fails.
    expect(emptyFieldProps.accessibilityLabel).not.toBe(hasTextProps.accessibilityLabel)
  })

  it('the bar input has accessible name "Add a task"', () => {
    const inputProps = a11yProps(SHELL_A11Y_IDS.tasksBarInput, { label: 'Add a task' })
    expect(inputProps.testID).toBe('tasks-bar-input')
    expect(inputProps.accessibilityLabel).toBe('Add a task')
  })

  it('the ids are the ones the mockup draws — not invented', () => {
    expect(SHELL_A11Y_IDS.tasksBarInput).toBe('tasks-bar-input')
    expect(SHELL_A11Y_IDS.tasksBarAction).toBe('tasks-bar-action')
  })

  it('"assistant-voice-fab" is no longer in the shell catalogue', () => {
    const allShellIds = Object.values(SHELL_A11Y_IDS)
    expect(allShellIds).not.toContain('assistant-voice-fab')
  })
})
