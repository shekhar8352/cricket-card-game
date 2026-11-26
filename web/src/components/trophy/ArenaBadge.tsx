import { useId } from 'react'
import { arenaTheme, ROMAN } from '../../lib/arenas'
import { cn } from '../../lib/cn'

const SIZES = { xs: 22, sm: 30, md: 44, lg: 64, xl: 88 }

/**
 * An arena shield: the arena's colours and icon, with the division numeral
 * (III, II, I) on a ribbon. Always paired with a text label somewhere nearby, so
 * the arena never depends on colour alone.
 */
export function ArenaBadge({
  arena,
  division = 0,
  size = 'md',
  className,
  title,
}: {
  arena?: string
  division?: number
  size?: keyof typeof SIZES
  className?: string
  title?: string
}) {
  const t = arenaTheme(arena)
  const id = useId()
  const px = SIZES[size]
  const label = title ?? `${arena ?? 'Bronze'}${division ? ` ${ROMAN[division]}` : ''} arena`
  return (
    <span className={cn('relative inline-grid place-items-center shrink-0', className)} style={{ width: px, height: px * 1.12 }} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 40 45" className="absolute inset-0 w-full h-full drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]" aria-hidden>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={t.from} />
            <stop offset="1" stopColor={t.to} />
          </linearGradient>
        </defs>
        <path d="M20 1.5 L37 7.5 V21 C37 32 29.5 39.5 20 43.5 C10.5 39.5 3 32 3 21 V7.5 Z" fill={`url(#${id}-g)`} stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
        <path d="M20 5 L33.5 9.8 V21 C33.5 30 27.5 36.3 20 39.8 C12.5 36.3 6.5 30 6.5 21 V9.8 Z" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      </svg>
      <t.Icon aria-hidden className="relative" style={{ color: t.ink, width: px * 0.42, height: px * 0.42, marginTop: division ? -px * 0.16 : 0 }} strokeWidth={2.4} />
      {division > 0 && (
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-[3px] font-display font-extrabold leading-none tracking-wide"
          style={{
            bottom: px * 0.2,
            fontSize: Math.max(9, px * 0.26),
            padding: `${Math.max(1, px * 0.03)}px ${Math.max(3, px * 0.08)}px`,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
          }}
        >
          {ROMAN[division]}
        </span>
      )}
    </span>
  )
}
