// F-002 AC-23, mobile half — the interface language has exactly ONE declared
// source, and this port is a consumer of it rather than a second declaration.
//
// The AC's guard sentence is why this file exists: correcting the port's old
// `'vi-VN'` literal to `'en-US'` would leave the AC just as violated, because
// the defect is the second source, not the value in it. So nothing here asserts
// a language VALUE — the web half already pins the constant against
// `data-model.md` (`src/assistant/web/__tests__/interface-language.test.ts`).
// What is checked here is the mechanism: that no second source exists on the
// mobile path at all.
//
// WHY THESE ARE TEXT ASSERTIONS. `ports/native/rn-transcript-source.ts` imports
// `react-native`, so it cannot be loaded in this tier (platform mobile.md keeps
// the mobile unit tier simulator-free precisely by never importing RN). That is
// not a hole: "is there a second source?" is a property of the source text, and
// a behavioural test of the resolved value is exactly the test that would stay
// green if the port re-derived the right answer through a mechanism of its own.
//
// L-002 / L-007 apply: a text scan that matches nothing is green exactly like
// one that works, so every assertion below is paired with a non-vacuity guard
// that fails loudly if the file moved, was renamed, or stopped being read.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { INTERFACE_LANGUAGE } from '../../_shared/model/client-stores.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT_SRC = resolve(HERE, '../ports/native/rn-transcript-source.ts')
const BOOT_SRC = resolve(HERE, '../boot.ts')

/** A BCP-47 tag written as a string literal — the shape of a per-port constant. */
const BCP47_LITERAL = /['"][a-z]{2}-[A-Z]{2}['"]/

/** Source with comment lines stripped: the prose in these files quotes the old
 * `'vi-VN'` on purpose (it is the defect being described), and a scan that
 * counted prose would fail on the explanation rather than on the code. */
function codeOf(path: string): string {
  const src = readFileSync(path, 'utf8')
  expect(src.length, `${path} is empty — the scan would be vacuous`).toBeGreaterThan(500)
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

describe('AC-23 (mobile) — the recognizer reads the one declared language', () => {
  it('the scan is not vacuous: the regex matches a per-port constant when one is present', () => {
    // The guard L-007 asks for. If this ever stops matching, every "no literal
    // here" assertion below becomes green for the wrong reason.
    expect(BCP47_LITERAL.test("this.locale = opts.locale ?? 'vi-VN'")).toBe(true)
    expect(BCP47_LITERAL.test("const l = 'en-US'")).toBe(true)
    expect(BCP47_LITERAL.test('this.locale = opts.locale ?? INTERFACE_LANGUAGE')).toBe(false)
  })

  it('the port declares no language of its own and imports the declared source', () => {
    const code = codeOf(PORT_SRC)
    // Non-vacuity: this really is the transcript source.
    expect(code, 'rn-transcript-source.ts no longer defines RNTranscriptSource').toContain(
      'class RNTranscriptSource',
    )
    expect(code, 'the port still hardcodes a BCP-47 tag').not.toMatch(BCP47_LITERAL)
    expect(code).not.toContain('navigator.language')
    expect(code, 'the port does not read client.interface_language').toContain(
      'INTERFACE_LANGUAGE',
    )
    // …and it is the fallback for the test seam, not merely mentioned somewhere.
    expect(code).toContain('opts.locale ?? INTERFACE_LANGUAGE')
  })

  it('the app shell supplies no locale — a third source is a second source moved out one layer', () => {
    const code = codeOf(BOOT_SRC)
    // Non-vacuity: this really is boot.
    expect(code, 'boot.ts no longer exports boot()').toContain('export async function boot')
    expect(code, 'boot.ts still constructs the transcript source').toContain(
      'new RNTranscriptSource(',
    )
    // BootOptions used to carry `locale?: string`, and boot passed it through.
    expect(code, 'BootOptions still declares a locale option').not.toMatch(/\blocale\s*\??\s*:/)
    expect(code, 'boot still passes a locale to the transcript source').not.toContain('locale:')
  })

  it('the declared source is a single exported symbol, not a per-client copy', () => {
    // Imported for real (not read as text): if `_shared` ever grew a second
    // mobile-only language constant, this import is the one that would have to
    // change, and the assertion names the file that owns it.
    expect(typeof INTERFACE_LANGUAGE).toBe('string')
    expect(INTERFACE_LANGUAGE).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
  })
})
