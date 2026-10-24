import { defaultBowlingPlan, validateBowlingPlan, validateSquad } from './rules'
import type { PlayerCard } from '../types/engine'

function card(id: string, role: PlayerCard['role'], name = id): PlayerCard {
  return {
    id, playerId: id, name, country: 'IND', role, batHand: 'right', bowlType: 'pace',
    rarity: 'Bronze', level: 1, xp: 0, attrs: {} as PlayerCard['attrs'], overall: 70, traits: [],
  }
}

const squad = [
  card('b1', 'BAT'), card('b2', 'BAT'), card('b3', 'BAT'),
  card('wk', 'WK'), card('ar', 'AR'), card('p1', 'BOWL'), card('p2', 'BOWL'),
]

if (validateSquad(squad)) throw new Error('valid squad rejected')
const plan = defaultBowlingPlan(squad)
if (validateBowlingPlan(squad, plan)) throw new Error(validateBowlingPlan(squad, plan)!)
if (!validateBowlingPlan(squad, [plan[0], plan[0], plan[2], plan[3], plan[4]])) {
  throw new Error('consecutive overs should fail')
}
console.log('rules ok')
