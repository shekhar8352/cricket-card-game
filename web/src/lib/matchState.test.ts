import { computeLive, situation } from './matchState'
import type { BallEvent } from '../types/engine'

let seq = 0
function ball(innings: number, over: number, b: number, outcome: BallEvent['outcome'], runs: number, score: number, wickets = 0, extra: Partial<BallEvent> = {}): BallEvent {
  return {
    innings, over, ball: b, seq: seq++, bowlerId: innings === 0 ? 'bowlA' : 'bowlB', strikerId: innings === 0 ? 's1' : 't1', nonStrikerId: innings === 0 ? 's2' : 't2',
    outcome, runs, legal: outcome !== 'wide' && outcome !== 'noball', extras: {}, shot: { zone: 'cover', angle: 0, aerial: false, distance: 0.5 },
    commentary: '', score, wickets, ...extra,
  }
}

function eq(actual: unknown, expected: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

// Tallies batter, bowler and innings figures
{
  const balls = [
    ball(0, 0, 0, 'four', 4, 4),
    ball(0, 0, 1, 'wide', 1, 5),
    ball(0, 0, 1, 'bye', 2, 7),
    ball(0, 0, 2, 'wicket', 0, 7, 1, { dismissal: { type: 'bowled', bowlerId: 'bowlA', text: 'b A' } }),
  ]
  const st = computeLive(balls)
  eq([st.now.runs, st.now.wickets, st.now.legalBalls, st.now.extras], [7, 1, 3, 3], 'innings totals')
  const s1 = st.now.batters.get('s1')!
  eq([s1.runs, s1.balls, s1.fours, s1.out], [4, 3, 1, true], 'striker line')
  const bw = st.now.bowlers.get('bowlA')!
  eq([bw.balls, bw.runs, bw.wickets], [3, 5, 1], 'bowler line (byes not charged)')
  eq(st.now.partnership, { runs: 0, balls: 0 }, 'partnership resets on wicket')
  eq(st.second, undefined, 'still first innings')
}

// Chase equation in the second innings
{
  const balls = [ball(0, 0, 0, 'six', 6, 6), ball(1, 0, 0, 'one', 1, 1)]
  const st = computeLive(balls)
  eq([st.target, st.needed, st.ballsLeft], [7, 6, 29], 'chase equation')
  eq(situation(st, balls, (id) => id, 'Chasers', 'Setters').headline, 'Chasers need 6 from 29 balls', 'chase headline')
}

// Completed chase
{
  const balls = [ball(0, 0, 0, 'one', 1, 1), ball(1, 0, 0, 'four', 4, 4)]
  const st = computeLive(balls)
  eq([st.needed, st.battingWinProb], [0, 1], 'chase complete')
  eq(situation(st, balls, (id) => id, 'Chasers', 'Setters').headline, 'Chasers have done it!', 'win headline')
}

console.log('matchState ok')
