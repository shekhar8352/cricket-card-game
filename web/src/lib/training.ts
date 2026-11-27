import type { EngineModel, PlayerCard as Card, Rarity, Role } from '../types/engine'

/**
 * Client-side mirror of the server's training rules (cards.ApplyXP,
 * cards.XPForSacrifice): lets the page preview a session instantly and pick
 * sacrifices for the player. The server still validates and applies.
 */
export type Progression = EngineModel['progression']

const RARITY_RANK: Record<Rarity, number> = { Bronze: 0, Silver: 1, Gold: 2, Legend: 3 }

/** Attributes that rise with each level, per role (engine.applyLevel). */
export const LEVEL_ATTRS: Record<Role, string[]> = {
  BAT: ['Technique', 'Power', 'Timing', 'vs Pace', 'vs Spin', 'Temperament', 'Running'],
  WK: ['Technique', 'Power', 'Timing', 'Temperament', 'Keeping', 'Stumping', 'Reflexes'],
  AR: ['Technique', 'Power', 'Accuracy', 'Variation', 'Wicket-taking'],
  BOWL: ['Accuracy', 'Variation', 'Wicket-taking', 'Movement', 'Death bowling'],
}

export const capOf = (c: Card, p?: Progression) => c.levelCap ?? p?.levelCaps[c.rarity] ?? 5
const perLevel = (p?: Progression) => p?.xpPerLevel ?? 80
export const xpToNext = (level: number, p?: Progression) => level * perLevel(p)

/** XP a card gives when sacrificed: its overall rating on a steep curve, times how well its role suits the target. */
export function sacrificeXP(overall: number, from: Role, to: Role, samePlayer: boolean, p?: Progression) {
  const r = p?.sacrificeXP
  if (!r) return 0
  const mult = samePlayer ? r.sameMult : (r.affinity[from]?.[to] ?? 1)
  return Math.max(r.min, Math.round(r.base * Math.pow(r.growth, overall - r.from) * mult))
}

export const sacXP = (c: Card, target: Card, p?: Progression) => sacrificeXP(c.overall, c.role, target.role, c.playerId === target.playerId, p)

/** Role fit between a sacrificed card and the target: 'same' | 'related' | 'off'. */
export function roleFit(c: Card, target: Card): 'same' | 'related' | 'off' {
  if (c.role === target.role) return 'same'
  const rel = (a: Role, b: Role) => (a === 'BAT' && b === 'WK') || (a === 'AR' && (b === 'BAT' || b === 'BOWL'))
  return rel(c.role, target.role) || rel(target.role, c.role) ? 'related' : 'off'
}

/** XP still needed for `target` to reach level `goal` (capped). */
export function xpNeeded(target: Card, goal: number, p?: Progression) {
  const to = Math.min(goal, capOf(target, p))
  let need = -target.xp
  for (let l = target.level; l < to; l++) need += xpToNext(l, p)
  return Math.max(0, need)
}

export function applyXP(target: Card, gain: number, p?: Progression) {
  const cap = capOf(target, p)
  let level = target.level
  let xp = target.xp + gain
  while (level < cap && xp >= xpToNext(level, p)) {
    xp -= xpToNext(level, p)
    level++
  }
  let wasted = 0
  if (level >= cap) {
    wasted = xp
    xp = 0
  }
  return { level, xp, wasted, toNext: xpToNext(level, p), cap }
}

/** Cards worth keeping: never picked automatically, and flagged on confirm. */
export const isPrecious = (c: Card) => c.rarity === 'Gold' || c.rarity === 'Legend' || c.level > 1 || (c.form?.avg ?? 0) >= 7

const FIT_RANK = { same: 0, related: 1, off: 2 }

/** Best fuel first: copies of the target, then cards of a matching role, then the cheapest to lose (low rarity, level, overall). */
export function byFodderValue(target: Card) {
  return (a: Card, b: Card) =>
    Number(b.playerId === target.playerId) - Number(a.playerId === target.playerId) ||
    FIT_RANK[roleFit(a, target)] - FIT_RANK[roleFit(b, target)] ||
    RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] ||
    a.level - b.level ||
    a.overall - b.overall
}

/**
 * Picks spare cards to reach `goal` level with as few cards and as little
 * wasted XP as it can. `pool` should already exclude squad and precious cards.
 */
export function smartPick(target: Card, pool: Card[], goal: number, p?: Progression) {
  const need = xpNeeded(target, goal, p)
  const max = p?.maxSacrifices ?? 20
  if (need <= 0) return []
  const sorted = pool.slice().sort(byFodderValue(target))
  const picked: Card[] = []
  let sum = 0
  for (const c of sorted) {
    if (sum >= need || picked.length >= max) break
    picked.push(c)
    sum += sacXP(c, target, p)
  }
  // Hit the card limit first? Spend the slots on the biggest XP instead.
  if (sum < need && picked.length >= max) {
    picked.splice(0, picked.length, ...sorted.slice().sort((a, b) => sacXP(b, target, p) - sacXP(a, target, p) || byFodderValue(target)(a, b)).slice(0, max))
    sum = picked.reduce((s, c) => s + sacXP(c, target, p), 0)
  }
  // Drop any card the goal can do without, biggest first, to cut waste.
  for (const c of picked.slice().sort((a, b) => sacXP(b, target, p) - sacXP(a, target, p))) {
    const x = sacXP(c, target, p)
    if (sum - x >= need) {
      picked.splice(picked.indexOf(c), 1)
      sum -= x
    }
  }
  return picked.map((c) => c.id)
}
