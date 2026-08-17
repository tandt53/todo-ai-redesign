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

export function MicSlash() {
  return (
    <span className="mic-slash" aria-hidden="true">
      <svg viewBox="0 0 52 52">
        <line x1="14" y1="14" x2="38" y2="38" />
      </svg>
    </span>
  )
}
