// Inline Lucide-style icons (design system: SVG stroke 1.8, round caps, no
// emoji as UI icons). Paths carried from the design mockup.

import type { ReactNode } from 'react'

interface IconProps {
  className?: string
}

function Ic({ children, className }: IconProps & { children: ReactNode }) {
  return (
    <svg className={`ic ${className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

export function MicIcon() {
  return (
    <Ic>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </Ic>
  )
}

export function SendIcon() {
  return (
    <Ic>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </Ic>
  )
}

export function ArrowDownIcon() {
  return (
    <Ic>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Ic>
  )
}

export function UndoIcon() {
  return (
    <Ic>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" />
    </Ic>
  )
}

export function CheckIcon() {
  return (
    <Ic>
      <path d="M20 6 9 17l-5-5" />
    </Ic>
  )
}

export function PlusIcon() {
  return (
    <Ic>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Ic>
  )
}

export function MenuIcon() {
  return (
    <Ic>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </Ic>
  )
}

export function WifiOffIcon() {
  return (
    <Ic>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
      <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
      <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
      <path d="M5 13a10 10 0 0 1 5.24-2.76" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </Ic>
  )
}

export function PencilIcon() {
  return (
    <Ic>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </Ic>
  )
}

export function TrashIcon() {
  return (
    <Ic>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </Ic>
  )
}

// --- app shell (docs/design/assistant/screens/app-shell.html) ---------------------

/** PS-TASKS' list glyph. */
export function ListIcon() {
  return (
    <Ic>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </Ic>
  )
}

export function CloseIcon() {
  return (
    <Ic>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </Ic>
  )
}

export function BackIcon() {
  return (
    <Ic>
      <path d="M15 18l-6-6 6-6" />
    </Ic>
  )
}

export function ClockIcon() {
  return (
    <Ic>
      <path d="M12 8v4l3 2" />
      <circle cx="12" cy="12" r="9" />
    </Ic>
  )
}

/** Lucide `calendar-days` — the Upcoming collection (components.md
 * § ListsMenu). Today carries `ClockIcon`; clock-versus-calendar reads as
 * now-versus-ahead without a label. */
export function CalendarDaysIcon() {
  return (
    <Ic>
      <path d="M8 3v4M16 3v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 11h18" />
      <path d="M8 15h.01M12 15h.01M16 15h.01" />
    </Ic>
  )
}

export function InboxIcon() {
  return (
    <Ic>
      <path d="M4 5h16v9l-4 5H4z" />
      <path d="M4 12h16" />
    </Ic>
  )
}

export function SettingsIcon() {
  return (
    <Ic>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </Ic>
  )
}

export function AlertIcon() {
  return (
    <Ic className="ic-sm">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </Ic>
  )
}

/** Lucide `history` — § CarriedNotice's CN-SUPERSEDED glyph, `text.muted`:
 * nothing is wrong and there is no action, so it takes no accent. */
export function HistoryIcon() {
  return (
    <Ic className="ic-sm">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </Ic>
  )
}

/** Lucide `repeat` — § TaskRow's TR-REPEAT mark (F-005 AC-39), `text.muted`.
 * **Carried without colour**: `DESIGN.md § Colour rules` closes the accent set at
 * five and every one already carries an assigned meaning, so the mark is shape,
 * weight and its accessible name. A mark carried by colour alone fails AC-33's
 * 1.4.3 regardless. */
export function RepeatIcon() {
  return (
    <Ic className="ic-sm">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </Ic>
  )
}

/** Lucide `list-checks` — § TaskRow's TR-STEPS mark (F-005 AC-17), web only. */
export function ListChecksIcon() {
  return (
    <Ic className="ic-sm">
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </Ic>
  )
}

/** Lucide `grip-vertical` — the step's move handle (F-005 AC-15/AC-16). It is a
 * BUTTON, not a drag-only affordance: AC-16 makes the keyboard-operable
 * single-pointer path a requirement, not a nicety. */
export function GripIcon() {
  return (
    <Ic className="ic-sm">
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </Ic>
  )
}

/** Lucide `bell` — AC-38's passed-reminder surfacing and the detail's reminder
 * field. Not the same object as the deadline (AC-11: *"they are two moments, and
 * the surface says which one makes a sound"*). */
export function BellIcon() {
  return (
    <Ic className="ic-sm">
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </Ic>
  )
}

export function MicSlash() {
  return (
    <span className="mic-slash" aria-hidden="true">
      <svg viewBox="0 0 52 52">
        <line x1="14" y1="14" x2="38" y2="38" />
      </svg>
    </span>
  )
}
