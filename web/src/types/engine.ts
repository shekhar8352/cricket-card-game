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
  homeLineup?: { cards: PlayerCard[]; locked: boolean; battingOrder?: string[]; bowlingPlan?: string[]; tossPref?: string }
  awayLineup?: { cards: PlayerCard[]; locked: boolean; battingOrder?: string[]; bowlingPlan?: string[]; tossPref?: string }
  toss?: { winnerSide: string; decision: string }
  result?: {
    innings: InningsResult[]
    balls: BallEvent[]
    winner: string
    margin: string
    playerOfMatch: string
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
}

export interface LeaderRow {
  rank: number
  id: string
  username: string
  trophies: number
  arena: string
  me: boolean
}
