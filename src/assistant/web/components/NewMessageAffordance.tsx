// components.md §NewMessageAffordance — BUG-004 / owner decision 2026-08-17.
//
// ONE control, however many messages arrived (AC-30(d)): the count lives in the
// label, so there is nothing to stack, duplicate or re-mount.
//
// The dock has ZERO HEIGHT and the pill is absolutely positioned inside it, so
// the pill OVERLAYS the last line of the conversation instead of reflowing the
// pane. An affordance that appears by pushing history upward moves the sentence
// the user is reading — the exact defect it exists to prevent.
//
// Tapping it ONLY scrolls (AC-30(f)). It never answers, dismisses or resolves
// anything, so the question's OptionChips stay the only way to answer (AC-10)
// and the pill cannot become a second, quieter answer path.
//
// Copy and both accessible-name forms are transcribed from the catalogue via
// `_shared/model/follow.ts` — never composed here.

import type { AffordanceView } from '../../_shared/model/follow.ts'
import { ArrowDownIcon } from './icons.tsx'

export function NewMessageAffordance({
  affordance,
  onActivate,
}: {
  affordance: AffordanceView | null
  onActivate: () => void
}) {
  const waiting = affordance !== null && affordance.row === 'NMA-WAITING'
  return (
    // The dock — not the pill — is the live region, and it is always mounted:
    // a live region only announces what changes AFTER it exists, so creating it
    // together with the control would lose the control's own arrival. This is
    // what lets a screen-reader user hear the pill arrive and hear it change
    // from NMA-NEW to NMA-WAITING.
    <div className="nm-dock" aria-live="polite">
      {affordance !== null && (
        <div className={`nm-wrap${waiting ? ' nm-waiting' : ''}`}>
          <button
            className="nm-pill"
            data-testid="assistant-new-message-affordance"
            aria-label={affordance.accessibleName}
            onClick={onActivate}
          >
            <ArrowDownIcon />
            {/* One line where it fits, two at most where it does not. The
                second line is not cosmetic: at 375px a single non-wrapping line
                ellipsises the question away and leaves "Waiting for your
                answer — Delete …", which announces that something is pending
                and withholds what. The accessible name carries the whole string
                either way. */}
            <span className="nm-label">{affordance.label}</span>
          </button>
        </div>
      )}
    </div>
  )
}
