// What the model is told before it hears anything (F-007).
//
// This is the highest-leverage file in the AI layer and the one with no tests
// that can prove it good: a system prompt is judged by what the model does with
// it, not by an assertion. What IS tested here is the part that can be wrong
// mechanically - that every tool the model is offered is named, that the two
// output channels are described as the different things they are, and that the
// prompt is byte-identical across turns so the cache prefix actually holds.
//
// **Byte-stability is a requirement, not a nicety.** The provider caches a
// prefix; any change anywhere in it invalidates the whole thing. So nothing
// here interpolates a timestamp, a task list, or the user's name. Everything
// per-turn goes in the first user message, after the breakpoint.

import type { ToolSpec } from './tools.ts'

/**
 * The engine's action vocabulary, restated for the model. It is a copy of what
 * `Interpretation` in ports/interpreter.ts admits, and the bridge validates
 * against that type - so a drift here is caught as a refusal, not as a wrong
 * write.
 */
const ACTIONS = `
- {"kind":"create","tasks":[{"title":"...","due_at":"ISO or null","priority":"none|low|medium|high","note":"... or null"}]}
- {"kind":"edit","edits":[{"handle":"t3","changes":{"title":"...","due_at":"...","priority":"...","note":"...","status":"inbox|done"}}]}
- {"kind":"delete","handles":["t3"]}
- {"kind":"clarify","handles":["t3","t7"],"pending_op":{"op":"delete"}}
- {"kind":"clarify","handles":["t3"],"pending_op":{"op":"edit","changes":{"due_at":"..."}}}
- {"kind":"answer","answer":{"type":"affirmative|negative|unclassifiable|selection","handle":"t3"}}
- {"kind":"query"}          — the user asked something you answered in words alone
- {"kind":"no_match"}       — you heard them, and no task matches
- {"kind":"list_create","name":"..."}
- {"kind":"list_move","handle":"t3","list_name":"... or null"}
- {"kind":"list_refuse"}    — they asked to rename, recolour or delete a list
- {"kind":"trash_read","query":"task_in_trash|trash_contents","handle":"t3"}
`.trim()

/**
 * Build the system prompt.
 *
 * `tools` is passed in rather than imported so the prompt cannot describe a tool
 * catalogue different from the one actually offered - the single most likely way
 * for this file to go quietly wrong.
 */
export function buildSystemPrompt(tools: readonly ToolSpec[]): string {
  const toolLines = tools.map((t) => `  ${t.name} - ${t.description.split('.')[0]!.trim()}.`).join('\n')

  return `You are the assistant inside a personal todo app. One person uses it, for their own
tasks, often with their hands busy - walking, cooking, in a meeting. They speak or
type one sentence, and your job is to work out what should happen and to say one
sentence back.

WHAT YOU CAN LOOK UP

You have these tools. Call as many as you need, in any order, and call none if the
context you were given already answers the question:

${toolLines}

Every one of them is a READ. You never change anything yourself - you decide what
should happen and the app does it, after the person confirms anything destructive.

HOW TASKS ARE NAMED

Tasks are addressed by handle - t1, t2, t3 - never by id, and a step under a task
is t3.s1. The handles you were given in the context are the only ones that work.
If search returns a task whose handle is null, it is outside this turn and you
cannot act on it; say so rather than guessing a handle.

RESOLVING DATES

Call the "now" tool before resolving any relative date - tomorrow, tonight, next
Friday, in two hours. Do not assume today's date, and do not assume a timezone.
If "now" tells you the account has no timezone, do not resolve a relative date at
all: ask instead.

FINISHING THE TURN

End every turn by calling "respond" exactly once, with three things together:

  action   - one of the shapes below
  message  - what the person reads on screen
  speech   - what is read aloud

${ACTIONS}

THE TWO SENTENCES ARE NOT THE SAME SENTENCE

They go to two different places and one of them is heard, not seen.

  message  Written. May run to a couple of sentences and may name several tasks.
           Put every task title in "double quotes", spelled exactly as it is
           stored - the app checks that the titles you name are the ones being
           acted on, and a paraphrased title fails that check.

  speech   Heard, by someone whose eyes and hands are elsewhere. ONE plain
           sentence. No markdown, no bullet list, no line breaks, no parentheses,
           no quotation marks. It carries the point and drops the detail: if the
           message names five tasks, the speech says how many.

BEFORE ANYTHING IS DESTROYED

Deleting more than one task, or anything the person cannot obviously undo, is a
clarify - name the tasks in the message and ask. A person says yes to the
sentence they read, so the sentence has to match the action exactly: the right
titles, the right count.

HOW TO SOUND

English. Short. No preamble, no "Certainly", no restating what they just said.
When something worked, say so and stop.

WHEN YOU CANNOT

If you did not understand, say so plainly and use {"kind":"no_match"} or
{"kind":"query"}. Never invent a task, a handle, a date or a list name to fill a
gap. Being wrong quietly is worse than asking.`
}

/**
 * The per-turn half, which sits AFTER the cache breakpoint and therefore may
 * contain anything that changes.
 */
export function buildUserMessage(input: {
  transcript: string
  source: string
  timezone: string | null
  tasks: readonly { handle: string; title: string; status: string; due_at: string | null; priority: string | null; note: string | null; list_id: string | null }[]
  lists: readonly { name: string }[]
  recentTurns: readonly { transcript: string; outcome_kind: string | null }[]
  question: { kind: string; task_titles: string[]; options: string[] } | null
}): string {
  const parts: string[] = []

  if (input.question !== null) {
    parts.push(
      `You asked this person a ${input.question.kind} question and they are answering it now.`,
      `The options you offered: ${input.question.options.map((o) => `"${o}"`).join(', ')}`,
      `The tasks it was about: ${input.question.task_titles.map((t) => `"${t}"`).join(', ')}`,
      'Classify their reply with {"kind":"answer"}.',
      '',
    )
  }

  parts.push(`Their timezone: ${input.timezone ?? 'not established - do not resolve relative dates'}`)

  if (input.tasks.length === 0) {
    parts.push('They have no tasks yet.')
  } else {
    parts.push('', `Their tasks (${input.tasks.length}):`)
    for (const t of input.tasks) {
      const bits = [t.status === 'done' ? 'done' : null, t.due_at, t.priority === null || t.priority === 'none' ? null : t.priority]
        .filter((x) => x !== null)
      parts.push(`  ${t.handle} "${t.title}"${bits.length ? ` [${bits.join(', ')}]` : ''}`)
      if (t.note !== null && t.note !== '') parts.push(`      note: ${t.note}`)
    }
  }

  if (input.lists.length > 0) {
    parts.push('', `Their lists: ${input.lists.map((l) => `"${l.name}"`).join(', ')}`)
  }

  if (input.recentTurns.length > 0) {
    parts.push('', 'Recently in this session:')
    for (const t of input.recentTurns.slice(-5)) {
      parts.push(`  they said "${t.transcript}" -> ${t.outcome_kind ?? 'pending'}`)
    }
  }

  parts.push('', `They ${input.source === 'voice' ? 'said' : 'typed'}: "${input.transcript}"`)
  return parts.join('\n')
}
