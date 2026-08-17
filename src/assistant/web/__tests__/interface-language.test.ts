// F-002 AC-23 — the interface language has exactly ONE declared source.
//
// The AC's own guard sentence is the point of this file: correcting a port's
// literal does not satisfy it, because the defect is the second source, not the
// value in it. So these tests check the *mechanism* three ways — the value the
// recognizer actually hands the browser, the absence of any second source in the
// port's text, and agreement with the value declared upstream in data-model.md.
//
// The third one is the L-008 arrangement: the assertion reads the owning
// artifact at run time instead of retyping it, so it fails when the UPSTREAM
// declaration moves (the direction drift travels), not only when this file does.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { INTERFACE_LANGUAGE } from '../../_shared/model/client-stores.ts'
import { WebSpeechTranscriptSource } from '../ports/web-speech-source.ts'

const ROOT = process.cwd()
const PORT_SRC = resolve(ROOT, 'src/assistant/web/ports/web-speech-source.ts')
const DATA_MODEL = resolve(ROOT, 'specs/assistant/data-model.md')

/** A minimal SpeechRecognition stand-in that records what it was configured with. */
class FakeRecognition {
  static last: FakeRecognition | null = null
  lang = ''
  interimResults = false
  continuous = false
  onresult: unknown = null
  onerror: unknown = null
  onend: unknown = null
  constructor() {
    FakeRecognition.last = this
  }
  start(): void {}
  abort(): void {}
  stop(): void {}
}

const g = globalThis as Record<string, unknown>

afterEach(() => {
  delete g['SpeechRecognition']
  FakeRecognition.last = null
})

describe('AC-23 — one declared interface language, read by the recognizer', () => {
  it('the recognizer declares the language from client.interface_language', () => {
    g['SpeechRecognition'] = FakeRecognition
    const source = new WebSpeechTranscriptSource()
    source.start({ onTranscript: () => {}, onEnd: () => {} })
    expect(FakeRecognition.last).not.toBeNull()
    expect(FakeRecognition.last?.lang).toBe(INTERFACE_LANGUAGE)
  })

  it('the port carries no second source — no navigator.language, no language literal', () => {
    // Read as TEXT: a port that resolved to the right value through a mechanism
    // of its own would pass the assertion above and still violate the AC.
    const src = readFileSync(PORT_SRC, 'utf8')
    const code = src
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
      .join('\n')
    expect(code).not.toContain('navigator.language')
    expect(code).not.toMatch(/['"][a-z]{2}-[A-Z]{2}['"]/)
    // and it really does read the declared source
    expect(code).toContain('INTERFACE_LANGUAGE')
  })

  it('the constant is the value data-model.md declares (parsed, not retyped)', () => {
    const md = readFileSync(DATA_MODEL, 'utf8')
    const row = md.split('\n').find((l) => l.includes('`client.interface_language`'))
    expect(row, 'data-model.md declares no client.interface_language row').toBeDefined()
    // The row names the current tag first and the superseded one ("was `vi-VN`")
    // afterwards, so the first BCP-47 tag on the row is the declared value.
    const declared = /`([a-z]{2}-[A-Z]{2})`/.exec(row as string)?.[1]
    expect(declared, 'no BCP-47 tag found on the row — the parser matched nothing').toBeDefined()
    expect(INTERFACE_LANGUAGE).toBe(declared)
  })
})
