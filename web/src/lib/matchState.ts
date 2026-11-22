import type { BallEvent } from '../types/engine'

export const OVERS = 5
export const BALLS_PER_OVER = 6
export const MAX_BALLS = OVERS * BALLS_PER_OVER
export const MAX_WICKETS = 6
/** Rough runs-per-ball for an average lineup in this engine, used for projections. */
const RUNS_PER_BALL = 1.4
/** Typical first-innings total for two average sides on a balanced pitch (engine-measured). */
export const PAR_SCORE = 47

export interface BatLine {
  id: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  outText?: string
}

export interface BowlLine {
  id: string
  balls: number
  runs: number
  wickets: number
  dots: number
}

export interface OverSummary {
  over: number
  runs: number
  wickets: number
  bowlerId: string
  complete: boolean
}

export interface InningsState {
  innings: number
  runs: number
  wickets: number
  legalBalls: number
  batters: Map<string, BatLine>
  battingOrder: string[]
  bowlers: Map<string, BowlLine>
  overs: OverSummary[]
  partnership: { runs: number; balls: number }
  lastWicket?: { batterId: string; runs: number; balls: number; text: string; score: string }
  fours: number
  sixes: number
  extras: number
}

export interface LiveState {
  current?: BallEvent
  first: InningsState
  second?: InningsState
  now: InningsState
  target?: number
  ballsLeft: number
  crr: number
  rrr?: number
  needed?: number
  projected?: number
  /** Probability (0–1) that the side currently batting wins. */
  battingWinProb: number
  /** Par first-innings score for this pitch. */
  par: number
}

export function oversText(legalBalls: number) {
  return `${Math.floor(legalBalls / BALLS_PER_OVER)}.${legalBalls % BALLS_PER_OVER}`
}

export function rate(runs: number, balls: number) {
  return balls === 0 ? 0 : (runs / balls) * BALLS_PER_OVER
}

export function strikeRate(runs: number, balls: number) {
  return balls === 0 ? 0 : (runs / balls) * 100
}

function emptyInnings(innings: number): InningsState {
  return {
    innings,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    batters: new Map(),
    battingOrder: [],
    bowlers: new Map(),
    overs: [],
    partnership: { runs: 0, balls: 0 },
    fours: 0,
    sixes: 0,
    extras: 0,
  }
}

function bat(st: InningsState, id: string | undefined) {
  if (!id) return undefined
  let line = st.batters.get(id)
  if (!line) {
    line = { id, runs: 0, balls: 0, fours: 0, sixes: 0, out: false }
    st.batters.set(id, line)
    st.battingOrder.push(id)
  }
  return line
}

function bowl(st: InningsState, id: string) {
  let line = st.bowlers.get(id)
  if (!line) {
    line = { id, balls: 0, runs: 0, wickets: 0, dots: 0 }
    st.bowlers.set(id, line)
  }
  return line
}

export function isExtra(b: BallEvent) {
  return b.outcome === 'wide' || b.outcome === 'noball' || b.outcome === 'bye'
}

function apply(st: InningsState, b: BallEvent) {
  const striker = bat(st, b.strikerId)!
  bat(st, b.nonStrikerId)
  const bowler = bowl(st, b.bowlerId)
  let over = st.overs[b.over]
  if (!over) {
    over = { over: b.over, runs: 0, wickets: 0, bowlerId: b.bowlerId, complete: false }
    st.overs[b.over] = over
  }

  const batterRuns = isExtra(b) ? 0 : b.runs
  striker.runs += batterRuns
  if (b.outcome === 'four') { striker.fours++; st.fours++ }
  if (b.outcome === 'six') { striker.sixes++; st.sixes++ }
  if (isExtra(b)) st.extras += b.runs
  if (b.legal) {
    striker.balls++
    bowler.balls++
    st.legalBalls++
    st.partnership.balls++
    if (b.runs === 0 && !isExtra(b)) bowler.dots++
  }
  if (b.outcome !== 'bye') bowler.runs += b.runs

  st.runs = b.score
  st.partnership.runs += b.runs
  over.runs += b.runs
  if (b.legal && b.ball === BALLS_PER_OVER - 1) over.complete = true

  if (b.dismissal) {
    striker.out = true
    striker.outText = b.dismissal.text
    if (b.dismissal.type !== 'run_out') bowler.wickets++
    over.wickets++
    st.wickets = b.wickets
    st.lastWicket = {
      batterId: striker.id,
      runs: striker.runs,
      balls: striker.balls,
      text: b.dismissal.text,
      score: `${b.score}/${b.wickets}`,
    }
    st.partnership = { runs: 0, balls: 0 }
  }
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x))
}

/** Expected runs still to come given balls and wickets in hand. */
function resources(ballsLeft: number, wicketsLeft: number) {
  const wicketFactor = Math.min(1, 0.35 + wicketsLeft * 0.13)
  return ballsLeft * RUNS_PER_BALL * wicketFactor
}

export function computeLive(shown: BallEvent[], par: number = PAR_SCORE): LiveState {
  const first = emptyInnings(0)
  let second: InningsState | undefined
  for (const b of shown) {
    if (b.innings === 0) apply(first, b)
    else {
      second ??= emptyInnings(1)
      apply(second, b)
    }
  }
  const current = shown[shown.length - 1]
  const now = second ?? first
  const ballsLeft = MAX_BALLS - now.legalBalls
  const wicketsLeft = MAX_WICKETS - now.wickets
  const crr = rate(now.runs, now.legalBalls)

  if (!second) {
    const projected = Math.round(first.runs + (ballsLeft > 0 && wicketsLeft > 0 ? resources(ballsLeft, wicketsLeft) : 0))
    const spread = 6 + Math.sqrt(ballsLeft) * 1.4
    return {
      current, first, now, ballsLeft, crr, projected, par,
      battingWinProb: shown.length === 0 ? 0.5 : sigmoid((projected - par) / spread),
    }
  }

  const target = first.runs + 1
  const needed = Math.max(0, target - second.runs)
  const rrr = ballsLeft > 0 ? (needed / ballsLeft) * BALLS_PER_OVER : undefined
  let prob: number
  if (needed === 0) prob = 1
  else if (ballsLeft === 0 || wicketsLeft === 0) prob = 0
  else {
    const expected = resources(ballsLeft, wicketsLeft)
    prob = sigmoid((expected - needed) / (2 + Math.sqrt(ballsLeft) * 1.5))
  }
  return { current, first, second, now, target, needed, rrr, ballsLeft, crr, par, battingWinProb: prob }
}

export interface Situation {
  tone: 'neutral' | 'good' | 'bad' | 'hot'
  headline: string
  detail?: string
}

/**
 * Turns the raw state into the one line a TV graphic would show: what just
 * happened that matters, and what the batting side needs next.
 */
export function situation(state: LiveState, shown: BallEvent[], name: (id: string) => string, battingTeam: string, bowlingTeam: string): Situation {
  const b = state.current
  if (!b) return { tone: 'neutral', headline: `${battingTeam} to bat first`, detail: `${OVERS} overs, ${MAX_WICKETS} wickets. Every ball counts.` }
  const inn = state.now
  const recent = shown.filter((x) => x.innings === b.innings)
  const striker = inn.batters.get(b.strikerId)
  const bowler = inn.bowlers.get(b.bowlerId)

  // Match over
  if (state.second && state.needed === 0) return { tone: 'hot', headline: `${battingTeam} have done it!`, detail: `Target chased with ${state.ballsLeft} ball${state.ballsLeft === 1 ? '' : 's'} to spare.` }
  if (state.second && (state.ballsLeft === 0 || inn.wickets >= MAX_WICKETS)) {
    const short = (state.needed ?? 1) - 1
    return short === 0
      ? { tone: 'hot', headline: 'Scores level. It’s a tie!' }
      : { tone: 'hot', headline: `${bowlingTeam} defend it!`, detail: `${battingTeam} fall ${short} run${short === 1 ? '' : 's'} short.` }
  }
  if (!state.second && (state.ballsLeft === 0 || inn.wickets >= MAX_WICKETS)) {
    return { tone: 'neutral', headline: `Innings over: ${inn.runs}/${inn.wickets}`, detail: `${bowlingTeam} need ${inn.runs + 1} from ${MAX_BALLS} balls.` }
  }

  // Momentum moments, most dramatic first
  const bowlerBalls = recent.filter((x) => x.bowlerId === b.bowlerId && x.legal)
  const lastTwo = bowlerBalls.slice(-2)
  if (lastTwo.length === 2 && lastTwo.every((x) => x.dismissal && x.dismissal.type !== 'run_out')) {
    return { tone: 'hot', headline: `${name(b.bowlerId)} is on a hat-trick!`, detail: 'Two in two. The field closes in.' }
  }
  if (b.dismissal) {
    const lw = inn.lastWicket!
    const left = MAX_WICKETS - inn.wickets
    const spell = bowler && bowler.wickets >= 2 ? ` ${name(bowler.id)} now has ${bowler.wickets}.` : ''
    return {
      tone: 'bad',
      headline: `${name(lw.batterId)} departs for ${lw.runs} (${lw.balls})`,
      detail: `${lw.text}. ${left} wicket${left === 1 ? '' : 's'} left.${spell}`,
    }
  }
  if (b.chance && !b.chance.converted) return { tone: 'good', headline: `Dropped! ${name(b.strikerId)} gets a second life`, detail: 'That could prove costly.' }

  const lastLegal = recent.filter((x) => x.legal).slice(-3)
  const boundaries = (xs: BallEvent[]) => xs.filter((x) => x.outcome === 'four' || x.outcome === 'six')
  if (lastLegal.length >= 2 && boundaries(lastLegal.slice(-2)).length === 2) {
    const n = boundaries(lastLegal).length === 3 ? 'Three' : 'Back-to-back'
    return { tone: 'good', headline: `${n} boundaries from ${name(b.strikerId)}!`, detail: `${name(b.bowlerId)} is under fire.` }
  }
  if (striker && [20, 30, 50].some((m) => striker.runs >= m && striker.runs - (isExtra(b) ? 0 : b.runs) < m)) {
    const m = [50, 30, 20].find((x) => striker.runs >= x)!
    return { tone: 'good', headline: `${m} up for ${name(striker.id)}!`, detail: `${striker.runs} off ${striker.balls} balls, ${striker.fours} fours and ${striker.sixes} sixes.` }
  }
  const dots = (() => {
    let n = 0
    for (let i = recent.length - 1; i >= 0 && recent[i].legal && recent[i].runs === 0 && !recent[i].dismissal; i--) n++
    return n
  })()
  if (dots >= 3) return { tone: 'bad', headline: `${dots} dot balls in a row`, detail: `Pressure is building: every extra dot raises the chance of a wicket.` }

  // Default: the equation
  if (state.second) {
    const need = state.needed!
    const left = state.ballsLeft
    if (left <= 6) return { tone: 'hot', headline: `Final over: ${need} needed off ${left}`, detail: need <= 6 ? 'One big hit could finish it.' : 'They need boundaries now.' }
    const rrr = state.rrr ?? 0
    const detail = rrr > state.crr + 2 ? 'The rate is climbing. Time to attack.' : rrr < state.crr - 2 ? 'Cruising. Just keep the scoreboard ticking.' : 'Evenly poised.'
    return { tone: 'neutral', headline: `${battingTeam} need ${need} from ${left} balls`, detail: `Required rate ${rrr.toFixed(2)}. ${detail}` }
  }
  const proj = state.projected ?? inn.runs
  const par = state.par
  const vsPar = proj - par
  return {
    tone: vsPar > 5 ? 'good' : vsPar < -5 ? 'bad' : 'neutral',
    headline: `${battingTeam} heading for about ${proj}`,
    detail: vsPar > 5 ? `That’s above par (${par}) for this pitch. ${bowlingTeam} need to hit back.` : vsPar < -5 ? `Below par (${par}) for this pitch. ${battingTeam} need a big over.` : `Right around par (${par}) for this pitch.`,
  }
}

/** Strip the legacy "0.3 " ball prefix older commentary carried. */
export function cleanCommentary(text: string) {
  return text.replace(/^\d+\.\d+\s+/, '')
}

export function ballChip(b: BallEvent): { t: string; label: string; cls: string } {
  if (b.outcome === 'wicket') return { t: 'W', label: 'wicket', cls: 'ball-wicket' }
  if (b.outcome === 'four') return { t: '4', label: 'four', cls: 'ball-four' }
  if (b.outcome === 'six') return { t: '6', label: 'six', cls: 'ball-six' }
  if (b.outcome === 'wide') return { t: 'Wd', label: 'wide', cls: 'ball-extra' }
  if (b.outcome === 'noball') return { t: 'Nb', label: 'no-ball', cls: 'ball-extra' }
  if (b.outcome === 'bye') return { t: `${b.runs}b`, label: `${b.runs} byes`, cls: 'ball-extra' }
  if (b.runs === 0) return { t: '•', label: 'dot ball', cls: 'ball-dot' }
  return { t: String(b.runs), label: `${b.runs} run${b.runs === 1 ? '' : 's'}`, cls: 'ball-run' }
}
