export type Role = 'BAT' | 'WK' | 'AR' | 'BOWL'
export type BowlType = 'pace' | 'spin'
export type BatHand = 'right' | 'left'
export type Rarity = 'Bronze' | 'Silver' | 'Gold' | 'Legend'
export type Outcome =
  | 'dot' | 'one' | 'two' | 'three' | 'four' | 'six'
  | 'wicket' | 'wide' | 'noball' | 'bye'

export interface Attributes {
  technique: number
  power: number
  timing: number
  vs_pace: number
  vs_spin: number
  temperament: number
  running: number
  accuracy: number
  variation: number
  wicket_taking: number
  movement: number
  death_bowling: number
  catching: number
  ground_fielding: number
  throwing: number
  keeping: number
  stumping: number
  reflexes: number
}

export interface PlayerCard {
  id: string
  playerId: string
  name: string
  country: string
  role: Role
  batHand: BatHand
  bowlType: BowlType
  rarity: Rarity
  level: number
  xp: number
  xpToNext?: number
  levelCap?: number
  attrs: Attributes
  effective?: Attributes
  overall: number
  traits: string[]
  createdAt?: string
  /** Match-rating history; absent until the card has played. */
  form?: CardForm
  captaincy?: Captaincy
  captainRep?: number
  partners?: string[] | null
}

export interface Captaincy {
  aggression: number
  tactics: number
  calm: number
  flair: number
  masterstroke: string
}

export interface MasterstrokeDef {
  code: string
  name: string
  description: string
  side: 'bat' | 'bowl'
  trigger: string
  effect: WeightDelta
  noPressure?: boolean
  earlyPress?: boolean
  tempBoost?: number
}

export interface ConditionsDef {
  code: string
  name: string
  description: string
  chance: number
  paceBonus: number
  spinBonus: number
  batterBonus: number
  catchDrop: number
  seamEdges: number
}

export interface BreakCallDef {
  code: string
  side: 'chase' | 'defend'
  name: string
  description: string
  bias: number[]
}

export interface SuperOverPicks {
  batters: string[]
  bowler: string
}

export interface MatchPause {
  kind: 'break' | 'super_over'
  deadline?: string | null
  role: 'chase' | 'defend'
  target: number
  conditions: ConditionsDef
  options?: BreakCallDef[]
  suggested?: string
  decided: boolean
  yourCall?: string
  opponentDecided: boolean
  suggestedPicks?: SuperOverPicks
}

export interface OpponentCaptain {
  cardId: string
  name: string
  rarity: Rarity
  country: string
  role: Role
  captaincy: Captaincy
  captainRep: number
  masterstroke: MasterstrokeDef
}

export interface Rivalry {
  bowler: string
  batter: string
  balls: number
  runs: number
  dismissals: number
}

export interface OverCall {
  over: number
  approach: Approach
  field: FieldPlan
  batRead: boolean
  fieldRead: boolean
  masterstroke?: string
  masterstrokeBy?: 'bat' | 'bowl'
}

export interface ResultExtras {
  streak?: Record<string, number>
  streakBonus?: Record<string, number>
  reads?: Record<string, number>
  repGained?: Record<string, number>
  boosted?: Record<string, boolean>
}

export interface CardForm {
  avg: number
  matches: number
  best: number
  recent: number[] // last 5, oldest first
}

export interface Shot {
  zone: string
  angle: number
  aerial: boolean
  distance: number
  leave?: boolean
}

export interface BallEvent {
  innings: number
  over: number
  ball: number
  seq: number
  bowlerId: string
  strikerId: string
  nonStrikerId?: string
  outcome: Outcome
  runs: number
  legal: boolean
  extras: { type?: string; runs?: number }
  shot: Shot
  chance?: { type: string; fielderId: string; converted: boolean }
  dismissal?: { type: string; bowlerId: string; fielderId?: string; text: string }
  fieldingSave?: boolean
  traitsTriggered?: string[]
  commentary: string
  approach?: Approach
  field?: FieldPlan
  pressure?: number
  matchup?: string
  counter?: string
  powerplay?: boolean
  freeHit?: boolean
  masterstroke?: string
  masterstrokeBy?: 'bat' | 'bowl'
  chemistry?: number
  rivalry?: boolean
  score: number
  wickets: number
}

export interface User {
  id: string
  username: string
  trophies: number
  arena: string
  nextArena?: string
  nextArenaMin?: number
}

export interface MatchDTO {
  id: string
  status: string
  isBot: boolean
  opponent: { name: string; trophies: number }
  homeLineup?: LineupDTO
  awayLineup?: LineupDTO
  pitch?: PitchDef
  opponentCaptain?: OpponentCaptain | null
  pause?: MatchPause | null
  rivalries?: Rivalry[] | null
  /** Match rating (3.0–10.0) for every card in a finished match. */
  ratings?: Record<string, number> | null
  /** XP each of your cards earned from this match. */
  xpEarned?: Record<string, number> | null
  /** In a player-vs-player match: when your lineup will be auto-locked with your default. */
  lineupDeadline?: string | null
  toss?: { winnerSide: string; decision: string }
  result?: {
    innings: InningsResult[]
    balls: BallEvent[]
    winner: string
    margin: string
    playerOfMatch: string
    pitch?: Pitch
    conditions?: string
    breakCalls?: Record<string, string>
    superOver?: {
      innings: InningsResult[]
      picks: Record<string, SuperOverPicks>
      winner: string
      decider: string
    }
    extras?: ResultExtras
  }
  ballLog?: BallEvent[]
  trophyDeltaHome?: number
  trophyDeltaAway?: number
  rewards?: PlayerCard[]
  youAreHome: boolean
  homeUserId: string
  awayUserId?: string
  winnerUserId?: string
  createdAt: string
}

export interface InningsResult {
  battingSide: string
  bowlingSide: string
  runs: number
  wickets: number
  balls: number
  byes: number
  wides: number
  noBalls: number
  batters: { cardId: string; runs: number; balls: number; fours: number; sixes: number; dismissal?: { text: string }; notOut: boolean }[]
  bowlers: { cardId: string; overs: number; balls: number; runs: number; wickets: number }[]
  fielders: { cardId: string; catches: number; stumpings: number; runOuts: number; drops: number; runsSaved: number; isKeeper: boolean }[]
  calls?: OverCall[]
}

export interface LeaderRow {
  rank: number
  id: string
  username: string
  trophies: number
  arena: string
  me: boolean
}

export interface StatPlayer {
  playerId: string
  name: string
  country: string
  role: Role
  rarity: Rarity
  matches: number
  avgRating: number
}

export interface TeamScore {
  matchId: string
  runs: number
  wickets: number
  balls: number
  opponent: string
  playedAt: string
}

export interface AccountStats {
  account: User & { createdAt: string; rank: number; totalPlayers: number }
  collection: {
    total: number
    byRarity: Record<Rarity, number>
    byRole: Record<Role, number>
    best?: PlayerCard
  }
  stats: {
    summary: {
      played: number
      won: number
      lost: number
      tied: number
      winRate: number
      currentStreak: number
      bestWinStreak: number
      vsBots: number
      vsPlayers: number
      trophiesWon: number
      trophiesLost: number
      teamRuns: number
      wicketsTaken: number
      fours: number
      sixes: number
      highestTotal?: TeamScore
      lowestTotal?: TeamScore
      bestBowlingEffort?: TeamScore
      form: ('W' | 'L' | 'T')[]
    }
    batting: (StatPlayer & { innings: number; runs: number; balls: number; fours: number; sixes: number; outs: number; highScore: number; highNotOut: boolean; average: number; strikeRate: number })[]
    bowling: (StatPlayer & { innings: number; balls: number; runs: number; wickets: number; bestWickets: number; bestRuns: number; economy: number; average: number })[]
    fielding: (StatPlayer & { catches: number; stumpings: number; runOuts: number; total: number })[]
    playerOfMatch: (StatPlayer & { awards: number })[]
    rated: (StatPlayer & { bestRating: number })[]
  }
}

export type Approach = 'defend' | 'balanced' | 'attack'
export type FieldPlan = 'defend' | 'balanced' | 'attack'
export type Pitch = 'balanced' | 'green' | 'dusty' | 'flat'

export interface Tactics {
  batApproach: Approach[] // one per phase: powerplay (overs 1-2), middle (3-4), death (5)
  fieldPlan: FieldPlan[] // one per over
}

export interface LineupDTO {
  cards: PlayerCard[]
  locked: boolean
  battingOrder?: string[]
  bowlingPlan?: string[]
  tossPref?: string
  captainId?: string
}

export interface PitchDef {
  code: Pitch
  name: string
  description: string
  tip: string
  paceBonus: number
  spinBonus: number
  spinWearBonus: number
  batterBonus: number
  extraSeamEdges: number
  par: number
}


export interface WeightDelta {
  dot: number
  one: number
  two: number
  four: number
  six: number
  wicket: number
}

export interface EngineModel {
  format: { overs: number; ballsPerOver: number; maxWickets: number }
  baseWeights: Record<Outcome, number>
  skillCurve: { scale: number; width: number }
  phases: string[]
  approachEffects: Partial<Record<Approach, WeightDelta>>
  fieldEffects: Partial<Record<FieldPlan, WeightDelta>>
  counters: { approach: Approach; field: FieldPlan; name: string; effect: WeightDelta; why: string }[]
  matrix: { approach: Approach; field: FieldPlan; runs: number; wickets: number }[]
  pitches: PitchDef[]
  pressure: { startsAt: number; max: number }
  matchup: { weakBelow: number; strongAtLeast: number; weakEffect: WeightDelta; strongEffect: WeightDelta }
  traits: { code: string; name: string; description: string }[]
  arenas: { Name: string; MinTrophy: number }[]
  progression: {
    rewardCardsPerWin: number
    rewardOdds: Record<string, { Bronze: number; Silver: number; Gold: number; Legend: number }>
    lossXP: number
    xpPerLevel: number
    levelBonus: number
    levelCaps: Record<Rarity, number>
    performanceXP: { min: number; perPoint: number; fromRating: number }
    sacrificeXP: Record<Rarity, { other: number; samePlayer: number }>
    maxSacrifices: number
  }
  ratings: RatingRules
  captain: CaptainRules
  masterstrokes: MasterstrokeDef[]
  breakCalls: BreakCallDef[]
  conditions: ConditionsDef[]
  chemistry: ChemistryRules
  powerplay: { overs: number; effect: WeightDelta; defendFieldScale: number; boundarySaves: boolean }
  freeHit: WeightDelta
  rival: { dismissals: number; effect: WeightDelta }
  superOver: { batters: number; wickets: number; graceSeconds: number }
  pause: { breakGraceSeconds: number; lineupGraceSeconds: number }
  streak: { bonus: Record<string, number>; boostAt: number }
  reputation: { perMatch: number; perWin: number; readsPerPoint: number; max: number; perTactics: number; maxTactics: number }
}

export interface CaptainRules {
  aggressionDivisor: number
  readBonus: number
  tempBase: number
  tempFlairDivisor: number
  tempTacticsDivisor: number
  tempMin: number
  judgementBase: number
  judgementScale: number
  repPerTactics: number
  repMaxBonus: number
  calmDivisor: number
  armbandTemperament: number
  readTheBattersBonus: number
}

export interface ChemistryRules {
  sameCountry: number
  knownPartnership: number
  maxLink: number
  singlesPerLink: number
  dotsPerLink: number
  runUpgradePerLink: number
  runOutCutPerLink: number
}

export interface Streak {
  current: number
  nextWinBonus: number
  boostAt: number
  nextWinBoosted: boolean
}

export interface RatingRules {
  base: number
  min: number
  max: number
  parRunsPerBall: number
  batPerRunAbovePar: number
  batPerRun: number
  duck: number
  cheapDismissal: number
  cheapBelow: number
  notOutBonus: number
  notOutMinRuns: number
  bowlPerWicket: number
  bowlPerRunBelowPar: number
  catch: number
  stumping: number
  runOut: number
  drop: number
  save: number
  win: number
  playerOfMatch: number
}

export interface TrainResult {
  xpGained: number
  levelBefore: number
  levelAfter: number
  xpAfter: number
  xpToNext: number
  wasted: number
  overallBefore: number
  overallAfter: number
  levelCap: number
}

export interface OddsRequest {
  batterRating: number
  batterVs?: number
  bowlerRating: number
  bowlType: BowlType
  approach: Approach
  field: FieldPlan
  pitch: Pitch
  over: number
  innings: 1 | 2
  pressure: number
  wickets: number
  need?: number
}

export interface OddsResult {
  odds: Record<Outcome, number>
  weights: Record<Outcome, number>
  factors: { name: string; effect: WeightDelta }[]
  skillGap: number
  skillShift: number
  runsPerBall: number
  wicketChance: number
  matchup?: string
}
