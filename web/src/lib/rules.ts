import type { PlayerCard, Role } from '../types/engine'

export function validateSquad(cards: PlayerCard[]): string | null {
  if (cards.length !== 7) return 'Squad must have 7 cards'
  const roles: Record<Role, number> = { BAT: 0, WK: 0, AR: 0, BOWL: 0 }
  const seen = new Set<string>()
  for (const c of cards) {
    if (seen.has(c.id)) return `Duplicate card ${c.name}`
    seen.add(c.id)
    roles[c.role]++
  }
  if (roles.BAT !== 3) return `Need 3 batsmen, got ${roles.BAT}`
  if (roles.WK !== 1) return `Need 1 wicketkeeper, got ${roles.WK}`
  if (roles.AR !== 1) return `Need 1 all-rounder, got ${roles.AR}`
  if (roles.BOWL !== 2) return `Need 2 bowlers, got ${roles.BOWL}`
  return null
}

export function validateBowlingPlan(cards: PlayerCard[], plan: string[]): string | null {
  if (plan.length !== 5) return 'Bowling plan must have 5 overs'
  const bowls = cards.filter((c) => c.role === 'BOWL')
  const ar = cards.find((c) => c.role === 'AR')
  const eligible = new Set([...bowls.map((b) => b.id), ...(ar ? [ar.id] : [])])
  const counts: Record<string, number> = {}
  for (let i = 0; i < plan.length; i++) {
    const id = plan[i]
    if (!id) return `Over ${i + 1} is empty`
    if (!eligible.has(id)) return `Over ${i + 1}: not an eligible bowler`
    counts[id] = (counts[id] ?? 0) + 1
    if (i > 0 && plan[i] === plan[i - 1]) {
      const n = cards.find((c) => c.id === id)?.name ?? 'Bowler'
      return `${n} can't bowl consecutive overs`
    }
  }
  for (const b of bowls) {
    if ((counts[b.id] ?? 0) !== 2) return `${b.name} must bowl exactly 2 overs`
  }
  if (ar && (counts[ar.id] ?? 0) !== 1) return 'AR must bowl exactly 1 over'
  return null
}

export function defaultBattingOrder(cards: PlayerCard[]): string[] {
  const bats = cards.filter((c) => c.role === 'BAT').sort((a, b) => (b.effective?.technique ?? 0) - (a.effective?.technique ?? 0))
  const wk = cards.find((c) => c.role === 'WK')
  const ar = cards.find((c) => c.role === 'AR')
  const bowls = cards.filter((c) => c.role === 'BOWL').sort((a, b) => (b.effective?.technique ?? 0) - (a.effective?.technique ?? 0))
  const rest = [...bats].sort((a, b) => (b.effective?.power ?? 0) - (a.effective?.power ?? 0))
  const order: string[] = []
  if (bats[0]) order.push(bats[0].id)
  if (bats[1]) order.push(bats[1].id)
  const third = rest.find((c) => !order.includes(c.id))
  if (third) order.push(third.id)
  if (wk) order.push(wk.id)
  if (ar) order.push(ar.id)
  for (const b of bowls) order.push(b.id)
  return order
}

export function defaultBowlingPlan(cards: PlayerCard[]): string[] {
  const bowls = cards.filter((c) => c.role === 'BOWL')
  const ar = cards.find((c) => c.role === 'AR')
  if (bowls.length < 2 || !ar) return []
  const sorted = [...bowls].sort((a, b) => (b.effective?.death_bowling ?? 0) - (a.effective?.death_bowling ?? 0))
  const [b1, b2] = sorted
  return [b1.id, b2.id, b1.id, ar.id, b2.id]
}

export function rarityColor(r: string) {
  return ({ Bronze: 'var(--bronze)', Silver: 'var(--silver)', Gold: 'var(--gold)', Legend: 'var(--legend)' } as Record<string, string>)[r] ?? 'var(--border)'
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export function teamFielding(cards: PlayerCard[]) {
  if (!cards.length) return { fielding: 0, keeping: 0, stumping: 0 }
  const avg = (k: 'catching' | 'ground_fielding') =>
    Math.round(cards.reduce((s, c) => s + (c.effective?.[k] ?? c.attrs[k] ?? 0), 0) / cards.length)
  const wk = cards.find((c) => c.role === 'WK')
  return {
    fielding: Math.round((avg('catching') + avg('ground_fielding')) / 2),
    keeping: wk?.effective?.keeping ?? wk?.attrs.keeping ?? 0,
    stumping: wk?.effective?.stumping ?? wk?.attrs.stumping ?? 0,
  }
}
