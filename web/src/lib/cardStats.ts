import type { Attributes, PlayerCard } from '../types/engine'

export interface CardStat {
  key: string // 3-letter label shown on the card
  label: string // full name for tooltips and screen readers
  value: number
}

type Def = [string, string, (a: Attributes) => number]

const avg = (...n: number[]) => Math.round(n.reduce((a, b) => a + b, 0) / n.length)

/** Six headline stats per role, FIFA-style. Values are effective (level-adjusted). */
const DEFS: Record<PlayerCard['role'], Def[]> = {
  BAT: [
    ['TEC', 'Technique', (a) => a.technique],
    ['POW', 'Power', (a) => a.power],
    ['TIM', 'Timing', (a) => a.timing],
    ['VPA', 'vs Pace', (a) => a.vs_pace],
    ['VSP', 'vs Spin', (a) => a.vs_spin],
    ['RUN', 'Running', (a) => a.running],
  ],
  WK: [
    ['KEE', 'Keeping', (a) => a.keeping],
    ['STU', 'Stumping', (a) => a.stumping],
    ['REF', 'Reflexes', (a) => a.reflexes],
    ['TEC', 'Technique', (a) => a.technique],
    ['POW', 'Power', (a) => a.power],
    ['TIM', 'Timing', (a) => a.timing],
  ],
  AR: [
    ['BAT', 'Batting (technique, power, timing)', (a) => avg(a.technique, a.power, a.timing)],
    ['POW', 'Power', (a) => a.power],
    ['ACC', 'Accuracy', (a) => a.accuracy],
    ['VAR', 'Variation', (a) => a.variation],
    ['WKT', 'Wicket-taking', (a) => a.wicket_taking],
    ['FLD', 'Fielding (catching, ground, throwing)', (a) => avg(a.catching, a.ground_fielding, a.throwing)],
  ],
  BOWL: [
    ['ACC', 'Accuracy', (a) => a.accuracy],
    ['VAR', 'Variation', (a) => a.variation],
    ['WKT', 'Wicket-taking', (a) => a.wicket_taking],
    ['MOV', 'Movement', (a) => a.movement],
    ['DTH', 'Death bowling', (a) => a.death_bowling],
    ['FLD', 'Fielding (catching, ground, throwing)', (a) => avg(a.catching, a.ground_fielding, a.throwing)],
  ],
}

export function cardStats(card: PlayerCard): CardStat[] {
  const a = card.effective ?? card.attrs
  return DEFS[card.role].map(([key, label, fn]) => ({ key, label, value: fn(a) }))
}

export const ROLE_SHORT: Record<PlayerCard['role'], string> = { BAT: 'BAT', WK: 'WK', AR: 'AR', BOWL: 'BWL' }
