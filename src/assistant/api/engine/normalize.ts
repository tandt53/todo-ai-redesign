// Transcript normalization + the closed undo phrase list (ADR-006).
// Match on the normalized FULL utterance: trim, lowercase, Unicode NFC,
// strip terminal punctuation. Anything longer ("undo the last thing") is a
// normal turn for the model. Growing the list is a docs/design/product decision.

// English only this phase (ADR-008 / owner decision 2026-08-17): AC-5's undo
// vocabulary is 'undo'. `normalizeTranscript` below stays NFC-normalizing —
// that is language-neutral input hygiene, not Vietnamese handling.
export const UNDO_PHRASES: readonly string[] = ['undo']

export function normalizeTranscript(s: string): string {
  return s
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[\s.!?…,;:]+$/u, '')
    .trim()
}

export const isUndoPhrase = (transcript: string): boolean =>
  UNDO_PHRASES.includes(normalizeTranscript(transcript))
