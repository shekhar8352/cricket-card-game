import type { PlayerCard } from '../../types/engine'

/**
 * A faceless "dummy" cricketer in the team's kit, posed by role so the card
 * reads at a glance: batting stance, keeper's crouch, pace bowler's delivery
 * stride, spinner's release, or an all-rounder mid-pull. Left-handed batters
 * are mirrored. Drawn on a 100x120 grid.
 */

type P = [number, number]
type Limb = [P, P, P] // shoulder/hip, elbow/knee, hand/foot

interface Pose {
  head: P
  neck: P
  hip: P
  backArm: Limb
  frontArm: Limb
  backLeg: Limb
  frontLeg: Limb
  gear: 'helmet' | 'cap'
  bat?: [P, P] // handle end, toe end
  gloves?: 'batting' | 'keeping'
  pads?: boolean
  ball?: P
}

const POSES: Record<'bat' | 'keeper' | 'pace' | 'spin' | 'allround', Pose> = {
  bat: {
    head: [56, 20], neck: [52, 30], hip: [47, 62],
    backArm: [[46, 33], [41, 48], [54, 60]],
    frontArm: [[56, 34], [63, 47], [57, 61]],
    backLeg: [[45, 62], [40, 84], [36, 108]],
    frontLeg: [[50, 62], [60, 84], [63, 108]],
    gear: 'helmet', bat: [[55, 59], [71, 104]], gloves: 'batting', pads: true,
  },
  allround: {
    head: [54, 19], neck: [51, 29], hip: [48, 61],
    backArm: [[46, 32], [37, 28], [33, 19]],
    frontArm: [[56, 33], [47, 25], [35, 18]],
    backLeg: [[45, 61], [36, 83], [28, 107]],
    frontLeg: [[51, 61], [63, 81], [71, 107]],
    gear: 'helmet', bat: [[34, 18], [15, 2]], gloves: 'batting', pads: true,
  },
  keeper: {
    head: [62, 46], neck: [57, 55], hip: [44, 75],
    backArm: [[55, 58], [65, 69], [75, 75]],
    frontArm: [[59, 58], [69, 66], [80, 70]],
    backLeg: [[42, 75], [55, 89], [45, 108]],
    frontLeg: [[47, 75], [63, 92], [59, 108]],
    gear: 'helmet', gloves: 'keeping', pads: true,
  },
  pace: {
    head: [56, 22], neck: [52, 32], hip: [47, 62],
    backArm: [[48, 34], [46, 20], [50, 6]],
    frontArm: [[56, 35], [68, 40], [76, 51]],
    backLeg: [[45, 62], [34, 78], [22, 92]],
    frontLeg: [[50, 62], [62, 83], [70, 107]],
    gear: 'cap', ball: [51, 4],
  },
  spin: {
    head: [55, 22], neck: [52, 32], hip: [48, 63],
    backArm: [[49, 35], [56, 23], [64, 15]],
    frontArm: [[56, 36], [64, 46], [69, 58]],
    backLeg: [[46, 63], [41, 85], [33, 107]],
    frontLeg: [[50, 63], [58, 85], [62, 107]],
    gear: 'cap', ball: [66, 13],
  },
}

interface Kit { shirt: string; trim: string; helmet: string; trousers: string }

const KITS: Record<string, Kit> = {
  IND: { shirt: '#1f4fbf', trim: '#ff9933', helmet: '#0b2a6b', trousers: '#16388a' },
  AUS: { shirt: '#f5c518', trim: '#0b5d3b', helmet: '#0b5d3b', trousers: '#d9a90b' },
  ENG: { shirt: '#1c3f94', trim: '#d4202f', helmet: '#0b1f4d', trousers: '#142e6e' },
  SA: { shirt: '#0b7a3b', trim: '#f2c200', helmet: '#064d25', trousers: '#085c2c' },
  NZ: { shirt: '#1a1a1a', trim: '#b8bec6', helmet: '#000000', trousers: '#0d0d0d' },
  SL: { shirt: '#1747a6', trim: '#f2c200', helmet: '#0d2b6b', trousers: '#103680' },
  WI: { shirt: '#7b1630', trim: '#f2c200', helmet: '#4a0d1d', trousers: '#5c1024' },
  BAN: { shirt: '#0a6b3d', trim: '#d6262c', helmet: '#063f24', trousers: '#07522f' },
  AFG: { shirt: '#1956c6', trim: '#d6262c', helmet: '#0d2b6b', trousers: '#12419a' },
  PAK: { shirt: '#0f7a3a', trim: '#ffffff', helmet: '#064d25', trousers: '#0b5c2c' },
}
const DEFAULT_KIT: Kit = { shirt: '#475569', trim: '#e2e8f0', helmet: '#1e293b', trousers: '#334155' }

const MANNEQUIN = '#d9d4cc'
const PAD = '#f8fafc'
const WOOD = '#e3bd7d'

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))))
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function poseFor(card: Pick<PlayerCard, 'role' | 'bowlType'>): keyof typeof POSES {
  if (card.role === 'WK') return 'keeper'
  if (card.role === 'AR') return 'allround'
  if (card.role === 'BOWL') return card.bowlType === 'spin' ? 'spin' : 'pace'
  return 'bat'
}

export function PlayerFigure({ card, className }: { card: Pick<PlayerCard, 'role' | 'bowlType' | 'batHand' | 'country'>; className?: string }) {
  const kind = poseFor(card)
  const p = POSES[kind]
  const kit = KITS[card.country] ?? DEFAULT_KIT
  const mirror = card.batHand === 'left' && (kind === 'bat' || kind === 'allround')
  const line = (pts: P[]) => pts.map(([x, y]) => `${x},${y}`).join(' ')
  const limb = (l: Limb, color: string, w: number, lower?: string, lowerW?: number) => (
    <>
      <polyline points={line([l[0], l[1]])} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <polyline points={line([l[1], l[2]])} fill="none" stroke={lower ?? color} strokeWidth={lowerW ?? w} strokeLinecap="round" />
    </>
  )
  const foot = (l: Limb, back?: boolean) => (
    <ellipse cx={l[2][0] + 2} cy={l[2][1] + 1.5} rx="5" ry="2.6" fill={back ? '#1f2937' : '#111827'} />
  )
  const [hx, hy] = p.head
  const bat = p.bat
  const batAngle = bat ? Math.atan2(bat[1][1] - bat[0][1], bat[1][0] - bat[0][0]) * (180 / Math.PI) - 90 : 0
  const batLen = bat ? Math.hypot(bat[1][0] - bat[0][0], bat[1][1] - bat[0][1]) : 0

  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden>
      <defs>
        <radialGradient id="fig-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="111" rx="34" ry="5" fill="url(#fig-ground)" />
      <g transform={mirror ? 'translate(100 0) scale(-1 1)' : undefined}>
        {/* far side */}
        {limb(p.backLeg, shade(kit.trousers, -0.25), 8, p.pads ? shade(PAD, -0.12) : shade(kit.trousers, -0.25), p.pads ? 9 : 7)}
        {foot(p.backLeg, true)}
        {limb(p.backArm, shade(kit.shirt, -0.25), 6, shade(kit.shirt, -0.25), 5.5)}
        {p.gloves === 'batting' && <circle cx={p.backArm[2][0]} cy={p.backArm[2][1]} r="3.4" fill={shade(PAD, -0.12)} />}
        {p.gloves === 'keeping' && <circle cx={p.backArm[2][0]} cy={p.backArm[2][1]} r="5.5" fill={shade(PAD, -0.15)} />}

        {/* bat sits between the hands */}
        {bat && (
          <g transform={`translate(${bat[0][0]} ${bat[0][1]}) rotate(${batAngle})`}>
            <rect x="-1.3" y="0" width="2.6" height={batLen * 0.32} rx="1.2" fill="#1f2937" />
            <rect x="-3.4" y={batLen * 0.3} width="6.8" height={batLen * 0.7} rx="2" fill={WOOD} />
            <rect x="-3.4" y={batLen * 0.3} width="2" height={batLen * 0.7} rx="1" fill={shade(WOOD, -0.18)} />
          </g>
        )}

        {/* torso */}
        <polyline points={line([p.neck, p.hip])} fill="none" stroke={kit.shirt} strokeWidth="15" strokeLinecap="round" />
        <polyline points={line([p.backArm[0], p.frontArm[0]])} fill="none" stroke={kit.shirt} strokeWidth="9" strokeLinecap="round" />
        <polyline points={line([[p.neck[0] - 1, p.neck[1] + 7], [p.hip[0] - 1, p.hip[1] - 4]])} fill="none" stroke={kit.trim} strokeWidth="2" strokeLinecap="round" opacity="0.9" />

        {/* near side */}
        {limb(p.frontLeg, kit.trousers, 8.5, p.pads ? PAD : kit.trousers, p.pads ? 9.5 : 7.5)}
        {p.pads && <polyline points={line([p.frontLeg[1], p.frontLeg[2]])} fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2.5" />}
        {foot(p.frontLeg)}
        {limb(p.frontArm, kit.shirt, 6.5, kit.shirt, 6)}
        {p.gloves === 'batting' && <circle cx={p.frontArm[2][0]} cy={p.frontArm[2][1]} r="3.6" fill={PAD} />}
        {p.gloves === 'keeping' && <circle cx={p.frontArm[2][0]} cy={p.frontArm[2][1]} r="6" fill={PAD} stroke="#cbd5e1" strokeWidth="0.8" />}
        {!p.gloves && <circle cx={p.frontArm[2][0]} cy={p.frontArm[2][1]} r="3" fill={MANNEQUIN} />}
        {!p.gloves && <circle cx={p.backArm[2][0]} cy={p.backArm[2][1]} r="2.8" fill={shade(MANNEQUIN, -0.15)} />}

        {/* head and headgear */}
        <circle cx={hx} cy={hy} r="7.6" fill={MANNEQUIN} />
        {p.gear === 'helmet' ? (
          <g>
            <path d={`M${hx - 8.4} ${hy + 1} A8.4 8.4 0 0 1 ${hx + 8.4} ${hy - 1} L${hx + 9.5} ${hy + 0.5} L${hx - 8.4} ${hy + 2.5} Z`} fill={kit.helmet} />
            <path d={`M${hx + 2} ${hy + 1.5} q5 0.5 6.5 4 M${hx + 1.5} ${hy + 4} q4 0.5 5.5 3.5 M${hx + 4.5} ${hy + 1} v7`} stroke="#cbd5e1" strokeWidth="1" fill="none" strokeLinecap="round" />
            <circle cx={hx - 1.5} cy={hy - 4} r="1.6" fill={kit.trim} />
          </g>
        ) : (
          <g>
            <path d={`M${hx - 7.8} ${hy - 1} A7.8 7.8 0 0 1 ${hx + 7.8} ${hy - 1} Z`} fill={kit.helmet} />
            <path d={`M${hx + 4} ${hy - 1.5} h7 a1.6 1.6 0 0 1 0 2.6 h-7 z`} fill={kit.helmet} />
            <circle cx={hx} cy={hy - 8.2} r="1" fill={kit.trim} />
          </g>
        )}
        {p.ball && (
          <g>
            <circle cx={p.ball[0]} cy={p.ball[1]} r="2.8" fill="#dc2626" />
            <path d={`M${p.ball[0] - 2.4} ${p.ball[1]} q2.4 -1.2 4.8 0`} stroke="#fff" strokeWidth="0.6" fill="none" />
          </g>
        )}
      </g>
    </svg>
  )
}
