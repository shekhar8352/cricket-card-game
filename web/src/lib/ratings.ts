import type { CardForm, PlayerCard } from '../types/engine'

/** Colour bands for 3.0–10.0 match ratings. */
export function ratingBand(r: number): { label: string; bg: string } {
  if (r >= 8) return { label: 'Elite', bg: '#2563eb' }
  if (r >= 7) return { label: 'Good', bg: '#16a34a' }
  if (r >= 6) return { label: 'Average', bg: '#ca8a04' }
  return { label: 'Poor', bg: '#dc2626' }
}

export function formText(f: CardForm) {
  return `Average rating ${f.avg.toFixed(1)} over ${f.matches} match${f.matches === 1 ? '' : 'es'} (best ${f.best.toFixed(1)})`
}

/**
 * Ranking used by "pick in-form players": rated cards by average rating
 * (ties broken by overall); cards that have never played come after, by overall.
 */
export function compareForm(a: PlayerCard, b: PlayerCard) {
  const fa = a.form, fb = b.form
  if (fa && !fb) return -1
  if (!fa && fb) return 1
  if (fa && fb && fa.avg !== fb.avg) return fb.avg - fa.avg
  return b.overall - a.overall
}
