import { initials } from '../../lib/rules'
import { cn } from '../../lib/cn'
import { RARITY_RING } from '../../lib/labels'
import type { Rarity } from '../../types/engine'

/** Round initials badge with a rarity-coloured ring, for compact player rows. */
export function PlayerAvatar({ name, rarity, size = 'md' }: { name?: string; rarity?: Rarity; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'grid place-items-center shrink-0 rounded-full border-2 bg-gradient-to-br from-[#1a2b42] to-[#0d1828] font-display font-bold text-white',
        size === 'lg' ? 'w-16 h-16 text-2xl border-[3px]' : 'w-11 h-11 text-base',
      )}
      style={{ borderColor: rarity ? RARITY_RING[rarity] : 'var(--border)' }}
      aria-hidden
    >
      {name ? initials(name) : '?'}
    </span>
  )
}
