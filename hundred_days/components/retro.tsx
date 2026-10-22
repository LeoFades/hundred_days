import Link from 'next/link'
import type { ReactNode } from 'react'

// ---------- Window ----------
type WindowProps = {
  title: string
  children: ReactNode
  className?: string
  bodyClassName?: string
  closeHref?: string // × goes to a page
  onClose?: () => void // × runs a function
}

export function Window({
  title,
  children,
  className = '',
  bodyClassName = 'p-4',
  closeHref,
  onClose,
}: WindowProps) {
  return (
    <section className={`window ${className}`}>
      <div className="titlebar">
        <span className="truncate">{title}</span>
        {closeHref && (
          <Link href={closeHref} className="tbtn" aria-label="Close">
            ×
          </Link>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="tbtn" aria-label="Close">
            ×
          </button>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

// ---------- Progress bar (25 blocks) ----------
export function ProgressBar({ value, small = false }: { value: number; small?: boolean }) {
  const clamped = Math.max(0, Math.min(100, value))
  const filled = Math.round(clamped / 4)
  return (
    <div
      className={`progress ${small ? 'small' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      {Array.from({ length: 25 }, (_, i) => (
        <span key={i} className={i < filled ? 'seg on' : 'seg'} />
      ))}
    </div>
  )
}

// ---------- Status bar ----------
export function StatusBar({ items }: { items: string[] }) {
  return (
    <div className="statusbar">
      {items.map((text, i) => (
        <span key={i}>{text}</span>
      ))}
    </div>
  )
}

// ---------- Alert dialog ----------
type AlertKind = 'warning' | 'info' | 'success'

export function Alert({
  kind,
  title,
  children,
}: {
  kind: AlertKind
  title: string
  children: ReactNode
}) {
  return (
    <Window title={title} className="max-w-xl" bodyClassName="flex items-start gap-3 p-4">
      <AlertIcon kind={kind} />
      <div className="flex flex-col gap-3">{children}</div>
    </Window>
  )
}

function AlertIcon({ kind }: { kind: AlertKind }) {
  if (kind === 'warning') {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <path d="M16 3 L30 28 L2 28 Z" fill="#ffff00" stroke="#000" strokeWidth="2" />
        <rect x="14.5" y="11" width="3" height="10" fill="#000" />
        <rect x="14.5" y="23" width="3" height="3" fill="#000" />
      </svg>
    )
  }
  if (kind === 'success') {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <circle cx="16" cy="16" r="13" fill="#008000" stroke="#000" strokeWidth="2" />
        <path d="M9 16 L14 21 L23 11" fill="none" stroke="#fff" strokeWidth="3" />
      </svg>
    )
  }
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="13" fill="#000080" stroke="#000" strokeWidth="2" />
      <rect x="14.5" y="13" width="3" height="10" fill="#fff" />
      <rect x="14.5" y="8" width="3" height="3" fill="#fff" />
    </svg>
  )
}
