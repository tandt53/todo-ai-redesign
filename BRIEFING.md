# BRIEFING — T-363 · mobile-agent · retire the inline add row

**Module:** assistant · **Feature:** F-003 · **Date:** 2026-08-25

## What changes for someone using it

The `+ Add a task` row at the end of the list disappears from the phone. The bar at the bottom of
the screen, which is already there, becomes the only way to type a task. Web made the same change
today.

## Why, and how it was found

**Owner decision 2026-08-25**, applied to the design already: the mockups no longer draw the inline
row. Mobile still renders it, so the two disagree.

**A test found it, not a person.** `src/assistant/mobile/__tests__/a11y.test.ts` asserts that every
id in the shell catalogue is drawn in a mockup or published in `components.md`. `tasks-inline-add`
is now neither, and the full suite reads 1535/1536 with this message:

```
neither drawn nor published nor ahead of design:
expected [ 'tasks-inline-add' ] to deeply equal []
```

**That red is the task.** It goes green when the id leaves the mobile catalogue.

## Measured 2026-08-25

```
TaskList.tsx:427        function InlineAdd({ ... })
TaskList.tsx:460        a11yProps(SHELL_A11Y_IDS.tasksInlineAdd, { label: 'New task name' })
TasksSurface.tsx:186-199 adding / draft / setDraft / onCommit / onCancel / onActivate / onAdd
styles.ts:967-982       inlineAdd, inlineAddEditing, inlineAddLabel, inlineAddInput
```

## Read these files first

- `src/assistant/mobile/components/TaskList.tsx` — the component and its a11y id
- `src/assistant/mobile/components/TasksSurface.tsx` — the seven props that feed it
- `src/assistant/mobile/components/styles.ts` — the four styles
- `src/assistant/mobile/model/a11y.ts` — the shell catalogue the failing test reads
- `src/assistant/mobile/__tests__/a11y.test.ts` — the assertion that is red

## Scope

**Remove the component, its props, its styles and its catalogue entry. Nothing else.**

`tasks-inline-add` is **retired, not unbuilt** — the design no longer draws it, so it must not move
into any not-built map. It leaves the catalogue entirely.

**Check the empty state.** A comment beside the empty state says it includes InlineAdd directly,
so removing it may leave a list with no tasks showing nothing but a heading. The bottom bar is still
there and still adds tasks. **Render the empty state and say what it looks like** — if it reads as
broken rather than empty, say so and stop rather than inventing a replacement.

**Do not touch `emptyAddInput`** unless it turns out to be part of this component; it is a separate
style and was left at `radius.sm` deliberately in T-355.

## Success criteria

- No `InlineAdd`, no `tasksInlineAdd`, no `inlineAdd*` styles anywhere in mobile
- `npx vitest run` — the whole suite, not only mobile — comes back green. **Quote the number.** It
  is 1535/1536 today and the one red is this task.
- `npx tsc --noEmit` exit 0
- Adding a task through the bottom bar still works
- Re-capture with `bash .mobile-app/shoot-mobile.sh ios` and **look at the empty-state frame and the
  list frame before reporting.**

Simulator `613D300D-1C17-4A38-8D5C-6A94315B1C01`, Metro on 8081.
