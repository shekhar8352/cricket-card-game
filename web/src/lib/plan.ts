import { SQUAD_SLOTS } from './labels'
import { defaultBattingOrder, defaultBowlingPlan, validateBowlingPlan, validateSquad } from './rules'
import { bestCaptain } from './captaincy'
import type { PlayerCard, Role } from '../types/engine'

/** What a player sets before a match. The captain makes the tactical calls. */
export interface MatchPlan {
  picked: string[] // 7 slots in SQUAD_SLOTS order, '' when empty
  order: string[] // batting order (all 7 once the team is full)
  bowling: string[] // bowler per over ('' when unset)
  captainId: string // '' until the team is full
  batPlan: string // game plan if we bat first ('' = captain decides)
  bowlPlan: string // game plan if we bowl first
}

export interface SavedDefault {
  cardIds: string[] | null
  battingOrder: string[] | null
  bowlingPlan: string[] | null
  captainId?: string | null
  batPlan?: string | null
  bowlPlan?: string | null
}

export function emptyPlan(): MatchPlan {
  return { picked: Array(7).fill(''), order: [], bowling: ['', '', '', '', ''], captainId: '', batPlan: '', bowlPlan: '' }
}

/** Puts cards into the role slots (3 batters, keeper, all-rounder, 2 bowlers). */
export function placeInSlots(cards: PlayerCard[]): string[] {
  const next = Array(7).fill('')
  for (const card of cards) {
    const idx = SQUAD_SLOTS.findIndex((slot, i) => slot.role === card.role && !next[i])
    if (idx >= 0) next[idx] = card.id
  }
  return next
}

/** Changes the team; orders reset to sensible defaults, and the captain stays if still picked. */
export function withTeam(plan: MatchPlan, picked: string[], byId: Record<string, PlayerCard>): MatchPlan {
  const cards = picked.map((x) => byId[x]).filter(Boolean)
  const full = cards.length === 7
  const keepCaptain = plan.captainId && picked.includes(plan.captainId)
  return {
    ...plan,
    picked,
    order: full ? defaultBattingOrder(cards) : [],
    bowling: full ? defaultBowlingPlan(cards) : ['', '', '', '', ''],
    captainId: keepCaptain ? plan.captainId : full ? bestCaptain(cards)?.id ?? '' : '',
  }
}

export function bestTeam(all: PlayerCard[], rank: (a: PlayerCard, b: PlayerCard) => number): PlayerCard[] {
  const take = (role: Role, n: number) => all.filter((c) => c.role === role).sort(rank).slice(0, n)
  return [...take('BAT', 3), ...take('WK', 1), ...take('AR', 1), ...take('BOWL', 2)]
}

/**
 * Rebuilds a plan from the saved default. Returns null if nothing is saved or
 * any saved card is no longer owned. Orders that don't match the team fall
 * back to defaults.
 */
export function planFromDefault(saved: SavedDefault | undefined, byId: Record<string, PlayerCard>): MatchPlan | null {
  const ids = (saved?.cardIds ?? []).map(String)
  if (ids.length !== 7 || ids.some((x) => !byId[x])) return null
  const cards = ids.map((x) => byId[x])
  const base = withTeam(emptyPlan(), placeInSlots(cards), byId)
  const order = (saved?.battingOrder ?? []).map(String)
  const bowling = (saved?.bowlingPlan ?? []).map(String)
  const sameSet = (xs: string[]) => xs.length === 7 && xs.every((x) => ids.includes(x))
  const captain = saved?.captainId ? String(saved.captainId) : ''
  return {
    ...base,
    order: sameSet(order) ? order : base.order,
    bowling: bowling.length === 5 && !validateBowlingPlan(cards, bowling) ? bowling : base.bowling,
    captainId: ids.includes(captain) ? captain : base.captainId,
    batPlan: saved?.batPlan ?? '',
    bowlPlan: saved?.bowlPlan ?? '',
  }
}

export function planErrors(plan: MatchPlan, byId: Record<string, PlayerCard>) {
  const squad = plan.picked.map((x) => byId[x]).filter(Boolean)
  const filled = squad.length
  const squadErr = filled === 7 ? validateSquad(squad) : `Add ${7 - filled} more player${7 - filled === 1 ? '' : 's'}`
  const bowlErr = filled === 7 ? validateBowlingPlan(squad, plan.bowling.filter(Boolean)) : null
  const capErr = filled === 7 && !plan.picked.includes(plan.captainId) ? 'Choose a captain' : null
  return { squad, squadErr, bowlErr: bowlErr ?? capErr, ok: !squadErr && !bowlErr && !capErr }
}

export function toRequest(plan: MatchPlan) {
  return {
    cardIds: plan.picked,
    battingOrder: plan.order,
    bowlingPlan: plan.bowling,
    captainId: plan.captainId,
    batPlan: plan.batPlan,
    bowlPlan: plan.bowlPlan,
  }
}

/** True when two plans would produce the same lineup request. */
export function samePlan(a: MatchPlan | null, b: MatchPlan | null) {
  return !!a && !!b && JSON.stringify(toRequest(a)) === JSON.stringify(toRequest(b))
}
