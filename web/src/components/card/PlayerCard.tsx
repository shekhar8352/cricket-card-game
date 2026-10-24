import { useState } from 'react'
import { Check, Zap } from 'lucide-react'
import { initials } from '../../lib/rules'
import { ROLE_LABEL } from '../../lib/labels'
import { cn } from '../../lib/cn'
import type { PlayerCard as Card, Rarity } from '../../types/engine'

const widths = {
  sm: 'w-[5.5rem]',
  md: 'w-44',
  lg: 'w-full max-w-[17rem]',
}

const frames: Record<Rarity, string> = {
  Bronze: '#e8c99b',
  Silver: '#e5e7eb',
  Gold: '#f6c445',
  Legend: '#c4b5fd',
}

const shields: Record<Rarity, string> = {
  Bronze: '#8a6a32',
  Silver: '#4b5563',
  Gold: '#92650a',
  Legend: '#6d28d9',
}

function BowlMark({ type }: { type: Card['bowlType'] }) {
  if (type === 'pace') return <Zap aria-hidden size={14} />
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Front({ card, size, status }: { card: Card; size: keyof typeof widths; status?: string }) {
  const bowl = card.bowlType === 'spin' ? 'Spin' : 'Pace'
  return (
    <span className="game-card-face game-card-front" style={{ boxShadow: `inset 0 0 0 3px ${frames[card.rarity]}` }}>
      <span className="flex items-start justify-between gap-1 p-2">
        <span
          className="grid place-items-center min-w-9 h-9 px-1 rounded-lg font-display text-xl font-bold leading-none tabular text-white"
          style={{ background: shields[card.rarity] }}
        >
          {card.overall}
          <span className="sr-only">overall</span>
        </span>
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide" title={ROLE_LABEL[card.role]}>
          {size === 'sm' ? card.role : ROLE_LABEL[card.role]}
        </span>
      </span>
      <span className={cn(
        'mx-auto grid place-items-center rounded-full border border-white/25 bg-white/10 font-display font-bold',
        size === 'lg' ? 'w-24 h-24 text-4xl' : size === 'md' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-sm',
      )}>
        <span aria-hidden>{initials(card.name)}</span>
      </span>
      <span className="mt-auto p-2">
        <span className={cn('block font-display font-semibold leading-tight', size === 'sm' ? 'text-sm truncate' : 'text-lg break-words')}>
          {size === 'sm' ? card.name.split(' ').slice(-1) : card.name}
        </span>
        {size !== 'sm' && (
          <span className="mt-0.5 flex items-center gap-1 text-sm text-slate-200">
            <span>{card.country}</span>
            <BowlMark type={card.bowlType} />
            <span>{bowl}</span>
          </span>
        )}
        {size !== 'sm' && (
          <span className="mt-1 flex items-center justify-between text-sm text-slate-200">
            <span>Level {card.level}</span>
            <span>{card.rarity}</span>
          </span>
        )}
        {size === 'lg' && (
          <span className="mt-2 block h-1.5 rounded-full bg-white/15 overflow-hidden" role="progressbar" aria-label="Experience toward next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, ((card.xp ?? 0) / (card.xpToNext || 80)) * 100))}>
            <span className="block h-full bg-cta" style={{ width: `${Math.min(100, ((card.xp ?? 0) / (card.xpToNext || 80)) * 100)}%` }} />
          </span>
        )}
        {size !== 'sm' && card.traits?.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {card.traits.slice(0, 2).map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-1.5 py-0.5 text-xs">{t}</span>
            ))}
          </span>
        )}
        {size === 'sm' && <span className="block text-[11px] text-slate-200">{card.rarity}</span>}
        {status && <span className="mt-1 block truncate rounded-md bg-cta px-1.5 py-0.5 text-[11px] font-semibold text-cta-fg">{status}</span>}
      </span>
    </span>
  )
}

export function PlayerCard({
  card, size = 'md', selected, disabled, hidden, placeholder = 'Empty', status, onClick, className,
}: {
  card?: Card
  size?: keyof typeof widths
  selected?: boolean
  disabled?: boolean
  hidden?: boolean
  placeholder?: string
  status?: string
  onClick?: () => void
  className?: string
}) {
  const [flip] = useState(Boolean(hidden && card))
  const back = (
    <span className={cn('game-card-face', card ? 'game-card-back' : 'game-card-slot')}>
      {card ? <span className="game-card-mark" aria-hidden>XI</span> : <span className="font-display text-2xl leading-none" aria-hidden>+</span>}
      <span className="px-1 text-xs font-semibold">{placeholder}</span>
    </span>
  )

  const body = card && flip ? (
    <span className={cn('game-card-flip', !hidden && 'is-revealed')}>
      {back}
      <Front card={card} size={size} status={status} />
    </span>
  ) : card ? (
    <Front card={card} size={size} status={status} />
  ) : (
    back
  )

  const cls = cn(
    'game-card disabled:cursor-not-allowed disabled:opacity-50',
    onClick && 'cursor-pointer',
    widths[size],
    selected && 'is-selected',
    className,
  )
  const inner = (
    <span className="game-card-lift">
      {body}
      {selected && (
        <span className="absolute bottom-2 right-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-cta text-cta-fg" aria-hidden>
          <Check size={12} />
        </span>
      )}
    </span>
  )

  if (!onClick) return <div className={cls}>{inner}</div>
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected || undefined} className={cls}>
      {inner}
    </button>
  )
}
