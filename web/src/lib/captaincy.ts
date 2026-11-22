import type { Approach, Captaincy, ChemistryRules, FieldPlan, PlayerCard } from '../types/engine'

/** Mirrors engine.Chemistry defaults; the engine model endpoint is the source of truth. */
export const DEFAULT_CHEMISTRY: ChemistryRules = {
  sameCountry: 1, knownPartnership: 2, maxLink: 3, singlesPerLink: 1, dotsPerLink: 1, runUpgradePerLink: 5, runOutCutPerLink: 15,
}

export const CAPTAINCY_ATTRS: { key: keyof Omit<Captaincy, 'masterstroke'>; label: string; help: string }[] = [
  { key: 'aggression', label: 'Aggression', help: 'How often they attack with the bat and set attacking fields.' },
  { key: 'tactics', label: 'Tactics', help: 'How well they read the opponent and the match situation.' },
  { key: 'calm', label: 'Calm', help: 'How well their batters handle pressure.' },
  { key: 'flair', label: 'Flair', help: 'How unpredictable their calls are.' },
]

/** Mirrors engine.CaptainScore, used to suggest a captain. */
export function captainScore(c: PlayerCard) {
  const cp = c.captaincy
  if (!cp) return 0
  return cp.tactics * 2 + cp.calm + cp.aggression / 2 + (c.captainRep ?? 0) / 5
}

export function bestCaptain(cards: PlayerCard[]) {
  return cards.slice().sort((a, b) => captainScore(b) - captainScore(a))[0]
}

/** A short style tag, e.g. "Aggressive · Hard to read". */
export function captainStyle(cp?: Captaincy): string {
  if (!cp) return 'Unknown'
  const lean = cp.aggression >= 75 ? 'Aggressive' : cp.aggression <= 40 ? 'Patient' : 'Balanced'
  const mind = cp.tactics >= 85 ? 'Mastermind' : cp.tactics >= 70 ? 'Shrewd' : cp.tactics < 45 ? 'Instinctive' : null
  const read = cp.flair >= 75 ? 'Hard to read' : cp.flair <= 35 ? 'Predictable' : null
  return [lean, mind, read].filter(Boolean).join(' · ')
}

/** A deliberately fuzzy scouting line: tendencies, not the plan. */
export function captainTendency(cp?: Captaincy): string {
  if (!cp) return 'Unknown captain.'
  const parts: string[] = []
  if (cp.aggression >= 75) parts.push('likes to attack early')
  else if (cp.aggression <= 40) parts.push('prefers to build and squeeze')
  else parts.push('adapts to the situation')
  if (cp.flair >= 75) parts.push('often changes plans without warning')
  else if (cp.flair <= 35) parts.push('sticks to habits you can read')
  if (cp.tactics >= 85) parts.push('will read your plans quickly')
  else if (cp.tactics < 45) parts.push('rarely adjusts to your plans')
  const s = parts.join(', ')
  return s.charAt(0).toUpperCase() + s.slice(1) + '.'
}

/** Chemistry link between two batters (0..maxLink). Mirrors engine.Link. */
export function link(a?: PlayerCard, b?: PlayerCard, rules: ChemistryRules = DEFAULT_CHEMISTRY) {
  if (!a || !b) return 0
  let l = 0
  if (a.country && a.country === b.country) l += rules.sameCountry
  if (a.partners?.includes(b.playerId) || b.partners?.includes(a.playerId)) l += rules.knownPartnership
  return Math.min(l, rules.maxLink)
}

/** Team chemistry 0-100 from neighbouring batting pairs. Mirrors engine.TeamChemistry. */
export function teamChemistry(order: string[], byId: Record<string, PlayerCard>, rules: ChemistryRules = DEFAULT_CHEMISTRY) {
  if (order.length < 2) return 0
  let total = 0
  for (let i = 0; i + 1 < order.length; i++) total += link(byId[order[i]], byId[order[i + 1]], rules)
  return Math.floor((total * 100) / ((order.length - 1) * rules.maxLink))
}

/** Best replies in the approach/field cycle. Mirrors engine.BestApproachVs / BestFieldVs. */
export function bestApproachVs(f?: FieldPlan): Approach {
  return f === 'defend' ? 'defend' : 'attack'
}
export function bestFieldVs(a?: Approach): FieldPlan {
  return a === 'defend' ? 'attack' : 'defend'
}
