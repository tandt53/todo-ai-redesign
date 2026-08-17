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

// --- app shell (design/assistant/screens/app-shell.html) ---------------------

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

export function MicSlash() {
  return (
    <span className="mic-slash" aria-hidden="true">
      <svg viewBox="0 0 52 52">
        <line x1="14" y1="14" x2="38" y2="38" />
      </svg>
    </span>
  )
}
