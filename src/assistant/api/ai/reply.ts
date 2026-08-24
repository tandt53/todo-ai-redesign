// What the assistant says, and the one thing about it that is checked (F-007).
//
// Owner decision 2026-08-21 § "the model authors the reply": nothing here is a
// template. The model writes both strings freely. What the code declines to
// trust is **the names and the numbers**, in the places where trusting wrongly
// is expensive — a destructive confirmation, and the summary of what was just
// done. Everything else the model writes and nobody checks.
//
// **Two strings, not one, because they are two channels.** F-002's
// `## What speaks, and from what` makes the spoken channel narrower than the
// screen: the screen can carry a list of five task names and a count; a
// sentence read aloud while the user is walking cannot. Deriving one from the
// other — stripping markdown out of the chat text, say — produces a sentence
// nobody wrote and nobody would have approved.

/**
 * The tool a model calls to finish a turn, in provider-neutral form.
 *
 * The turn ends with a tool call rather than with prose we then parse, for two
 * reasons. The provider validates the call against this schema, so a malformed
 * answer is retried by the model instead of by us. And it puts the action, the
 * targets and BOTH sentences in one structure — which is the whole point of the
 * shape the owner chose on 2026-08-21.
 */
export const RESPOND_TOOL = {
  name: 'respond',
  description:
    'Finish the turn. Call this exactly once, when you know what should happen and what to say. Everything you decided goes in one call: the action, the tasks it targets, and both sentences.',
  schema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'object',
        description:
          'What should happen, in the engine\'s vocabulary: {kind: "create"|"edit"|"delete"|"clarify"|"query"|"no_match"|"answer"|"list_create"|"list_move"|"list_refuse"|"trash_read", ...}. Address tasks by handle, never by id.',
      },
      message: {
        type: 'string',
        description:
          'What the user reads in the chat. Your own words. Name the tasks you are acting on, in quotes, exactly as their titles read.',
      },
      speech: {
        type: 'string',
        description:
          'What is read aloud. ONE plain sentence — no markdown, no bullet list, no line breaks, no parentheses. It is heard by someone whose eyes and hands are elsewhere, so it carries the point and drops the detail.',
      },
    },
    required: ['action', 'message', 'speech'],
  },
}

/** The model's own words for one turn. */
export interface ReplyText {
  /** For the chat bubble. May name several tasks and may run to a few sentences. */
  message: string
  /**
   * For text-to-speech. One sentence, plain — no markdown, no bullet list, no
   * parenthetical. It is read to someone whose hands and eyes are elsewhere.
   */
  speech: string
}

export const SPEECH_MAX = 240
export const MESSAGE_MAX = 2000

export type ReplyProblem =
  | { kind: 'empty'; field: 'message' | 'speech' }
  | { kind: 'too_long'; field: 'message' | 'speech'; length: number; limit: number }
  | { kind: 'markup_in_speech'; found: string }
  | { kind: 'unknown_task_named'; name: string }
  | { kind: 'count_mismatch'; said: number; actual: number }

/**
 * Shape only. Applies to every reply, whatever the outcome — a sentence that is
 * empty, or that carries a bullet list into the speech channel, is broken
 * regardless of what it claims.
 */
export function checkReplyShape(reply: ReplyText): ReplyProblem[] {
  const problems: ReplyProblem[] = []
  if (reply.message.trim() === '') problems.push({ kind: 'empty', field: 'message' })
  if (reply.speech.trim() === '') problems.push({ kind: 'empty', field: 'speech' })
  if (reply.message.length > MESSAGE_MAX) {
    problems.push({ kind: 'too_long', field: 'message', length: reply.message.length, limit: MESSAGE_MAX })
  }
  if (reply.speech.length > SPEECH_MAX) {
    problems.push({ kind: 'too_long', field: 'speech', length: reply.speech.length, limit: SPEECH_MAX })
  }
  // Markup reaching a speech synthesiser is read out as punctuation or swallowed
  // mid-word; either way the user hears something nobody wrote.
  const markup = /[*_`#]|^\s*[-•]\s|\n/m.exec(reply.speech)
  if (markup !== null) problems.push({ kind: 'markup_in_speech', found: markup[0].trim() || 'newline' })
  return problems
}

/**
 * The consistency check the owner's decision asks for, and only where it asks:
 * **every task name the reply states must be one of the rows being acted on,
 * and a stated count must match how many there are.**
 *
 * This is not a guard against invention — since F-007 the model names the very
 * rows it is targeting, in the same response. It is a consistency check on one
 * response, which is cheaper and still worth having: what breaks when it fails
 * is *consent*, because the user says yes to a sentence that does not match the
 * action.
 *
 * `targets` are the titles of the rows about to change. Matching is deliberately
 * loose — a reply may quote a title, shorten it, or fold its case — so this only
 * fires on a title that appears **in quotes** and is not among the targets.
 * A looser rule would fire on ordinary prose that happens to contain a word.
 */
export function checkReplyFacts(reply: ReplyText, targets: readonly string[]): ReplyProblem[] {
  const problems: ReplyProblem[] = []
  const known = new Set(targets.map((t) => t.trim().toLowerCase()))

  for (const text of [reply.message, reply.speech]) {
    for (const m of text.matchAll(/[“"']([^“”"']{2,120})[”"']/g)) {
      const quoted = m[1]!.trim().toLowerCase()
      if (quoted === '') continue
      if (!known.has(quoted)) problems.push({ kind: 'unknown_task_named', name: m[1]!.trim() })
    }
  }

  // A stated number that disagrees with the target count is the other half of
  // consent: "delete 3 tasks?" over a set of five is a question about a
  // different action than the one that will run.
  if (targets.length > 0) {
    for (const m of reply.message.matchAll(/\b(\d{1,3})\b/g)) {
      const said = Number(m[1])
      // Only a count that plausibly refers to the batch. A year, a clock time or
      // a quantity inside a task's own title is not a claim about this set.
      // English only: the product language is English and no other is planned
      // (`CLAUDE.md ## Project`). A Vietnamese alternation here was a leak from
      // the language this repo's conversation happens in.
      if (said > 0 && said <= 200 && said !== targets.length && /\b\d{1,3}\s+(tasks?|items?)\b/i.test(reply.message)) {
        problems.push({ kind: 'count_mismatch', said, actual: targets.length })
        break
      }
    }
  }
  return problems
}

export function describeProblem(p: ReplyProblem): string {
  switch (p.kind) {
    case 'empty': return `${p.field} is empty`
    case 'too_long': return `${p.field} is ${p.length} characters, over the ${p.limit} limit`
    case 'markup_in_speech': return `speech contains markup (${p.found}) — it is read aloud`
    case 'unknown_task_named': return `names a task that is not being acted on: "${p.name}"`
    case 'count_mismatch': return `says ${p.said} tasks, but ${p.actual} are being acted on`
  }
}
