// Theme — the one Settings row that needs nothing that does not exist.
//
// `tokens.json` has shipped a complete light theme since the first design pass
// and the app has never had a control for it: a capability that exists today
// with no surface (information-architecture.md §3). This is that surface's
// backing, and it is entirely local — no endpoint, no field, no server round
// trip, which is why § SettingsRow's `saving` / `failed` states have nothing to
// attach to here (IA §6 S4: "nothing on the drawn screen does today — Theme is
// local").

import { LocalStorageDurableStore } from './ports/durable-store.ts'
import type { DurableStore } from '../_shared/ports/durable-store.ts'

/** The house word is **theme** (components.md § Buttons: never "appearance
 * mode", "dark mode toggle" or "colour scheme"). */
export type ThemeChoice = 'dark' | 'light' | 'system'

export const THEME_CHOICES: ThemeChoice[] = ['dark', 'light', 'system']

export function themeLabel(c: ThemeChoice): string {
  switch (c) {
    case 'dark':
      return 'Dark'
    case 'light':
      return 'Light'
    case 'system':
      return 'System'
  }
}

const KEY = 'assistant.theme'

function isChoice(v: string | null): v is ThemeChoice {
  return v === 'dark' || v === 'light' || v === 'system'
}

export function readTheme(store: DurableStore): ThemeChoice {
  const stored = store.get(KEY)
  // Dark is the default (DESIGN.md Identity, dark-mode-first) — and an
  // unreadable store degrades to it rather than to a third behaviour.
  return isChoice(stored) ? stored : 'dark'
}

export function writeTheme(store: DurableStore, choice: ThemeChoice): void {
  store.set(KEY, choice)
}

/** What `data-theme` the document should carry for a choice. `system` resolves
 * through the OS preference; the two explicit choices never consult it. */
export function resolvedTheme(choice: ThemeChoice): 'dark' | 'light' {
  if (choice !== 'system') return choice
  const mm = (globalThis as { matchMedia?: (q: string) => MediaQueryList }).matchMedia
  if (typeof mm !== 'function') return 'dark'
  try {
    return mm.call(globalThis, '(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(choice: ThemeChoice, root?: HTMLElement): void {
  const el = root ?? globalThis.document?.documentElement
  if (el === undefined || el === null) return
  el.setAttribute('data-theme', resolvedTheme(choice))
}

/** The store the app uses. Exported so a test can drive the same seam the app
 * does rather than a parallel one. */
export function defaultThemeStore(): DurableStore {
  return new LocalStorageDurableStore()
}
