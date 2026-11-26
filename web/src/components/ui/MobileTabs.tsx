import { cn } from '../../lib/cn'

/**
 * A segmented tab bar for phones (hidden from lg up, where everything shows at
 * once). Sticks under the app header and swipes sideways if the labels don't fit.
 */
export function MobileTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: readonly { key: T; label: string; badge?: string | number | null; warn?: boolean }[]
  value: T
  onChange: (key: T) => void
  label: string
  className?: string
}) {
  return (
    <div className={cn('lg:hidden sticky top-14 sm:top-16 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 glass border-b border-border', className)}>
      <div role="tablist" aria-label={label} className="chip-scroll flex gap-1 overflow-x-auto rounded-xl bg-black/5 dark:bg-white/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={value === t.key}
            onClick={() => {
              onChange(t.key)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-lg text-sm font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              value === t.key ? 'bg-[var(--card-bg)] shadow text-fg' : 'text-muted',
            )}
          >
            {t.label}
            {t.badge != null && t.badge !== '' && (
              <span className={cn('rounded-full px-1.5 text-[11px] font-bold tabular', t.warn ? 'bg-wicket/20 text-wicket' : 'bg-black/10 dark:bg-white/15')}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
