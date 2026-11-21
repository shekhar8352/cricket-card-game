import type { Approach, BowlType, FieldPlan, PitchDef, PlayerCard, Tactics } from '../types/engine'

export const PHASES = [
  { label: 'Powerplay', overs: 'Overs 1–2' },
  { label: 'Middle', overs: 'Overs 3–4' },
  { label: 'Death', overs: 'Over 5' },
] as const

export const APPROACH: Record<Approach, { label: string; short: string; help: string }> = {
  defend: { label: 'Defend', short: 'DEF', help: 'Protect wickets, work singles. Feasts on a defensive field, gets strangled by an attacking one.' },
  balanced: { label: 'Balanced', short: 'BAL', help: 'The safe choice. Never great, never terrible.' },
  attack: { label: 'Attack', short: 'ATT', help: 'Swing for boundaries. Big runs against an attacking field, but holes out to a defensive one.' },
}

export const FIELD: Record<FieldPlan, { label: string; short: string; help: string }> = {
  defend: { label: 'Defensive', short: 'DEF', help: 'Sweepers on the rope. Stops attacking batters but gives away free singles.' },
  balanced: { label: 'Balanced', short: 'BAL', help: 'A standard field. No big weakness.' },
  attack: { label: 'Attacking', short: 'ATT', help: 'Catchers in. Strangles a defensive batter, but gets hit over the top.' },
}

export const BALANCED_TACTICS: Tactics = {
  batApproach: ['balanced', 'balanced', 'balanced'],
  fieldPlan: ['balanced', 'balanced', 'balanced', 'balanced', 'balanced'],
}

export function phaseOf(over: number) {
  return over <= 1 ? 0 : over <= 3 ? 1 : 2
}

/** Thresholds mirror engine.MatchupWeakBelow / MatchupStrongAtLeast. */
export const MATCHUP_WEAK_BELOW = 60
export const MATCHUP_STRONG_AT_LEAST = 85

export interface ScoutLine {
  card: PlayerCard
  vsPace: number
  vsSpin: number
  notes: { text: string; tone: 'weak' | 'strong' }[]
}

/** Who among the opposition can be targeted (or should be avoided) by bowling type. */
export function scoutBatters(cards: PlayerCard[]): ScoutLine[] {
  return cards
    .filter((c) => c.role !== 'BOWL')
    .map((c) => {
      const a = c.effective ?? c.attrs
      const notes: ScoutLine['notes'] = []
      if (a.vs_pace < MATCHUP_WEAK_BELOW) notes.push({ text: 'Weak vs pace', tone: 'weak' })
      if (a.vs_spin < MATCHUP_WEAK_BELOW) notes.push({ text: 'Weak vs spin', tone: 'weak' })
      if (a.vs_pace >= MATCHUP_STRONG_AT_LEAST) notes.push({ text: 'Strong vs pace', tone: 'strong' })
      if (a.vs_spin >= MATCHUP_STRONG_AT_LEAST) notes.push({ text: 'Strong vs spin', tone: 'strong' })
      return { card: c, vsPace: a.vs_pace, vsSpin: a.vs_spin, notes }
    })
}

export function attackMix(cards: PlayerCard[]) {
  const bowlers = cards.filter((c) => c.role === 'BOWL' || c.role === 'AR')
  return {
    pace: bowlers.filter((c) => c.bowlType === 'pace').length,
    spin: bowlers.filter((c) => c.bowlType === 'spin').length,
  }
}

/** How a pitch treats a bowling type, in bowler-skill points (1st innings, then 2nd). */
export function pitchBonus(p: PitchDef, type: BowlType): { first: number; second: number } {
  if (type === 'pace') return { first: p.paceBonus, second: p.paceBonus }
  return { first: p.spinBonus, second: p.spinBonus + p.spinWearBonus }
}

export function pitchFit(p: PitchDef | undefined, type: BowlType): 'suits' | 'against' | null {
  if (!p) return null
  const b = pitchBonus(p, type)
  if (b.first >= 4 || b.second >= 4) return 'suits'
  if (b.first <= -3) return 'against'
  return null
}

export function tossHint(p: PitchDef | undefined): string | null {
  if (!p) return null
  if (p.spinWearBonus > 0) return `This pitch wears: spinners get +${p.spinWearBonus} more in the 2nd innings, so batting first avoids the worst of it.`
  if (p.batterBonus > 0) return 'Big totals are likely here. Chasing lets you pace the innings to the target.'
  return null
}
