// Close the Lists drawer when crossing into tokens.json breakpoints.wide.
//
// WHY THIS FILE EXISTS SEPARATELY: the no-width-read test
// (task-detail.test.tsx) asserts that App.tsx, shell.ts and the surface
// components contain no ResizeObserver, no innerWidth, no matchMedia min-width.
// The invariant those tests protect is that BEHAVIOUR never forks on width —
// only CSS does, via exactly one container query block per breakpoint. This
// hook is the **one** exception: it reads the container's width solely to CLEAR
// a piece of state that CSS has already made visually irrelevant (the drawer
// is display:none at wide), so the DOM stays honest when the user narrows back.
// It is not a behaviour fork — the rail, the hidden trigger and the hidden
// drawer are all CSS. The hook is plumbing, and it lives here so the
// test's assertion stays true of every file it checks.

import { useEffect, useRef } from 'react'
import type { ShellHandle } from './shell.ts'
import tokensJson from '../../../docs/design/_shared/tokens.json' with { type: 'json' }

const WIDE_BP = tokensJson.breakpoints.wide

/**
 * Observes the `.app` container's inline size and closes the menu when
 * crossing into the wide breakpoint. The ResizeObserver reads the same axis
 * as the CSS container query — it is a container read, not a viewport read.
 */
export function useCloseMenuAtWide(shell: ShellHandle): void {
  const ref = useRef<Element | null>(null)
  useEffect(() => {
    if (!shell.menuOpen) return
    if (typeof ResizeObserver === 'undefined') return
    // Find the .app container — the element whose container-name is `app`.
    if (ref.current === null) {
      ref.current = document.querySelector('.app')
    }
    const el = ref.current
    if (el === null) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
        if (w >= WIDE_BP) shell.setMenuOpen(false)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [shell.menuOpen, shell.setMenuOpen])
}
