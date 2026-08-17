// Transcript normalization + the closed undo phrase list (ADR-006).
// Match on the normalized FULL utterance: trim, lowercase, Unicode NFC,
// strip terminal punctuation. Anything longer ("undo the last thing") is a
// normal turn for the model. Growing the list is a design/product decision.

export const UNDO_PHRASES: readonly string[] = ['undo', 'hoàn tác'.normalize('NFC')]

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
