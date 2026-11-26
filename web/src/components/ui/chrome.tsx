import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const controlClass =
  'min-h-11 rounded-xl border border-border bg-card px-3 text-base text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

export function PageHeader({ title, lede, action }: { title: string; lede?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 mb-3 sm:mb-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-5xl font-bold uppercase tracking-tight">{title}</h1>
        {lede && <p className="mt-1 text-sm sm:text-base text-muted leading-relaxed">{lede}</p>}
      </div>
      {action}
    </div>
  )
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('min-w-0 glass border border-border rounded-2xl p-4 sm:p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]', className)}>{children}</section>
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-base text-muted max-w-md mx-auto leading-relaxed">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div
      className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
    >
      <div className="h-full rounded-full bg-gradient-to-r from-accent-bright to-cta transition-[width] duration-700" style={{ width: `${width}%` }} />
    </div>
  )
}

export function Choice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-11 shrink-0 whitespace-nowrap rounded-xl border px-3 py-2 text-base font-medium cursor-pointer transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        pressed ? 'bg-accent text-white border-accent dark:text-accent-fg' : 'bg-card border-border text-fg hover:bg-black/5 dark:hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}

export function Brand({ size = 'md', tagline }: { size?: 'md' | 'lg'; tagline?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className={size === 'lg' ? 'w-12 h-12' : 'w-9 h-9'} aria-hidden>
        <defs>
          <linearGradient id="brand-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffc23d" />
            <stop offset="1" stopColor="#ff7a1a" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="10" fill="#0b6a3e" />
        <rect x="2" y="2" width="36" height="36" rx="10" fill="none" stroke="url(#brand-g)" strokeWidth="2.5" />
        <rect x="13" y="10" width="3" height="20" rx="1" fill="#fff" />
        <rect x="18.5" y="10" width="3" height="20" rx="1" fill="#fff" />
        <rect x="24" y="10" width="3" height="20" rx="1" fill="#fff" />
        <rect x="12" y="8.5" width="16" height="2.5" rx="1.2" fill="url(#brand-g)" />
      </svg>
      <div className="leading-none">
        <div className={cn('font-display font-bold uppercase tracking-tight', size === 'lg' ? 'text-4xl' : 'text-2xl')}>
          Pitch <span className="text-cta">7</span>
        </div>
        {tagline && <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted mt-1">5-over card cricket</div>}
      </div>
    </div>
  )
}
