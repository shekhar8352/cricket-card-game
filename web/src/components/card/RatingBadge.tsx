import { cn } from '../../lib/cn'
import { ratingBand } from '../../lib/ratings'

/** A match rating pill, e.g. 7.4 in green. */
export function RatingBadge({ value, className, title }: { value: number; className?: string; title?: string }) {
  const band = ratingBand(value)
  return (
    <span
      className={cn('inline-grid place-items-center rounded-md px-1.5 font-display font-bold tabular text-white leading-none', className)}
      style={{ background: band.bg }}
      title={title ?? `${band.label} rating`}
    >
      {value.toFixed(1)}
    </span>
  )
}

/** Last few ratings as small coloured bars, oldest first. */
export function FormBars({ recent, className }: { recent: number[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-end gap-[2px]', className)} aria-label={`Recent ratings ${recent.map((r) => r.toFixed(1)).join(', ')}`}>
      {recent.map((r, i) => (
        <span key={i} className="w-[5px] rounded-sm" style={{ height: `${Math.max(20, ((r - 3) / 7) * 100)}%`, background: ratingBand(r).bg }} />
      ))}
    </span>
  )
}
