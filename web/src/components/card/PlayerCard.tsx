import { useState } from 'react'
import { Check } from 'lucide-react'
import { ROLE_LABEL } from '../../lib/labels'
import { cn } from '../../lib/cn'
import { cardStats, ROLE_SHORT } from '../../lib/cardStats'
import { Flag } from './Flag'
import { countryName } from '../../lib/countries'
import { formText, ratingBand } from '../../lib/ratings'
import { PlayerFigure } from './PlayerFigure'
import type { PlayerCard as Card } from '../../types/engine'

const widths = {
  sm: 'w-[5.5rem]',
  md: 'w-44',
  lg: 'w-full max-w-[17rem]',
}

/*
 * The card is laid out on a 16em x 22.4em grid and the face's font size is
 * set from the card's own width (container query units), so every size is the
 * same design scaled. The small size drops the stat block to stay legible.
 */
function Front({ card, size, status }: { card: Card; size: keyof typeof widths; status?: string }) {
  const compact = size === 'sm'
  const stats = cardStats(card)
  const surname = card.name.split(' ').slice(-1)[0]
  const hand = card.batHand === 'left' ? 'LHB' : 'RHB'
  const xpPct = Math.min(100, ((card.xp ?? 0) / (card.xpToNext || 80)) * 100)
  const label = `${card.name}, ${countryName(card.country)}, ${ROLE_LABEL[card.role]}, overall ${card.overall}, ${card.rarity}, level ${card.level}. ` +
    (card.form ? `${formText(card.form)}. ` : '') +
    stats.map((st) => `${st.label} ${st.value}`).join(', ')

  return (
    <span className={cn('game-card-face game-card-front pc', `rarity-${card.rarity}`)} aria-label={label} role="img">
      <span className="pc-rays" aria-hidden />

      {/* left rail: rating, role, flag */}
      <span className="absolute left-[1.05em] top-[1.1em] z-10 flex flex-col items-center gap-[0.25em]" aria-hidden>
        <span className="font-display font-bold tabular leading-[0.85] text-[3.7em]">{card.overall}</span>
        <span className="font-display font-bold tracking-wide text-[1.35em] leading-none">{ROLE_SHORT[card.role]}</span>
        <span className="pc-rule w-[2.6em] my-[0.2em]" />
        <Flag code={card.country} className="w-[2.6em] h-[1.73em] rounded-[0.2em] shadow-[0_0.1em_0.3em_rgba(0,0,0,0.35)]" />
        {compact && card.form && (
          <span
            className="mt-[0.3em] rounded-[0.35em] px-[0.35em] py-[0.25em] text-center font-display font-bold tabular leading-none text-white text-[1.9em] shadow-[0_0.1em_0.3em_rgba(0,0,0,0.3)]"
            style={{ background: ratingBand(card.form.avg).bg }}
            title={formText(card.form)}
          >
            {card.form.avg.toFixed(1)}
          </span>
        )}
        {!compact && (
          <>
            <span className="pc-rule w-[2.6em] my-[0.2em]" />
            <span className="font-bold text-[0.95em] leading-none">{hand}</span>
            <span className="font-bold text-[0.95em] leading-none uppercase">{card.bowlType}</span>
          </>
        )}
      </span>

      {/* figure */}
      <PlayerFigure
        card={card}
        className={cn('absolute z-[1] drop-shadow-[0_0.3em_0.4em_rgba(0,0,0,0.35)]', compact ? 'right-[0.2em] top-[1.4em] w-[12.2em] h-[14.6em]' : 'right-[0.4em] top-[0.6em] w-[10.4em] h-[12.4em]')}
      />

      {/* average match rating, bottom-right of the figure */}
      {!compact && card.form && (
        <span
          className="absolute right-[0.9em] top-[10.3em] z-10 flex flex-col items-center rounded-[0.4em] px-[0.45em] py-[0.25em] text-white shadow-[0_0.1em_0.4em_rgba(0,0,0,0.35)]"
          style={{ background: ratingBand(card.form.avg).bg }}
          title={formText(card.form)}
          aria-hidden
        >
          <span className="font-display font-bold tabular leading-none text-[1.45em]">{card.form.avg.toFixed(1)}</span>
          <span className="text-[0.6em] font-bold uppercase tracking-wider leading-none mt-[0.15em] opacity-90">avg rtg</span>
        </span>
      )}

      {/* name */}
      <span className={cn('absolute inset-x-[0.8em] z-10 text-center', compact ? 'bottom-[1.4em]' : 'top-[12.9em]')} aria-hidden>
        <span className={cn('pc-name block font-display font-bold uppercase leading-none truncate', compact ? 'text-[2.5em]' : 'text-[1.75em]')}>
          {compact ? surname : card.name}
        </span>
        {!compact && <span className="pc-rule block mx-auto mt-[0.35em] w-[70%]" />}
      </span>

      {/* stats */}
      {!compact && (
        <span className="absolute left-[1.3em] right-[1.3em] top-[15.2em] z-10 grid grid-cols-2" aria-hidden>
          {[stats.slice(0, 3), stats.slice(3)].map((col, i) => (
            <span key={i} className={cn('flex flex-col gap-[0.2em]', i === 0 ? 'pr-[0.7em] border-r pc-divider' : 'pl-[0.9em]')}>
              {col.map((st) => (
                <span key={st.key} className="flex items-baseline gap-[0.35em]" title={st.label}>
                  <span className={cn('font-display font-bold tabular text-[1.45em] leading-none w-[1.4em] text-right', st.value >= 85 && 'pc-hot')}>{st.value}</span>
                  <span className="font-bold text-[1.0em] leading-none tracking-wide opacity-80">{st.key}</span>
                </span>
              ))}
            </span>
          ))}
        </span>
      )}

      {/* footer */}
      {!compact && (
        <span className="absolute left-[0.9em] right-[0.9em] bottom-[0.7em] z-10 flex items-center justify-between gap-[0.4em] text-[0.85em] font-bold" aria-hidden>
          <span className="pc-chip">LV {card.level}</span>
          {card.traits?.length > 0 ? (
            <span className="pc-chip truncate" title={card.traits.join(', ')}>★ {card.traits[0]}{card.traits.length > 1 ? ` +${card.traits.length - 1}` : ''}</span>
          ) : (
            <span className="opacity-75 uppercase tracking-wider">{card.rarity}</span>
          )}
        </span>
      )}
      {size === 'lg' && (
        <span className="absolute left-0 right-0 bottom-0 h-[0.35em] z-10 bg-black/20" role="progressbar" aria-label="Experience toward next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xpPct)}>
          <span className="block h-full bg-cta" style={{ width: `${xpPct}%` }} />
        </span>
      )}
      {status && (
        <span className={cn(
          'absolute z-20 truncate rounded-[0.4em] bg-cta px-[0.6em] py-[0.15em] text-center font-bold text-cta-fg shadow-[0_0.1em_0.3em_rgba(0,0,0,0.35)]',
          compact ? 'right-[0.6em] top-[0.6em] text-[1.9em]' : 'right-[0.8em] top-[0.8em] text-[1.1em]',
        )}>{status}</span>
      )}
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
      {card ? <span className="game-card-mark" aria-hidden>7</span> : <span className="font-display text-2xl leading-none" aria-hidden>+</span>}
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
    card && !hidden && card.rarity === 'Legend' && 'is-legend',
    card && !hidden && card.rarity === 'Gold' && 'is-gold',
    className,
  )
  const inner = (
    <span className="game-card-lift">
      {body}
      {selected && !status && (
        <span className="absolute z-30 top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-cta text-cta-fg shadow" aria-hidden>
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
