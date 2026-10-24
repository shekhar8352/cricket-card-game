import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const controlClass =
  'min-h-11 rounded-xl border border-border bg-card px-3 text-base text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

export function PageHeader({ title, lede, action }: { title: string; lede?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
        {lede && <p className="mt-1 text-base text-muted leading-relaxed">{lede}</p>}
      </div>
      {action}
    </div>
  )
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('bg-card border border-border rounded-xl p-4 sm:p-5', className)}>{children}</section>
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
      <div className="h-full rounded-full bg-accent-bright" style={{ width: `${width}%` }} />
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
        'min-h-11 rounded-xl border px-3 py-2 text-base font-medium cursor-pointer transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        pressed ? 'bg-accent text-white border-accent dark:text-accent-fg' : 'bg-card border-border text-fg hover:bg-black/5 dark:hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}
