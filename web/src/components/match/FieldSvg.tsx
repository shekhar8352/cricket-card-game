import type { BallEvent } from '../../types/engine'

const zones: Record<string, { x: number; y: number; label: string }> = {
  fine_leg: { x: 118, y: 42, label: 'fine leg' },
  square_leg: { x: 155, y: 70, label: 'square leg' },
  midwicket: { x: 155, y: 110, label: 'midwicket' },
  long_on: { x: 130, y: 150, label: 'long on' },
  long_off: { x: 70, y: 150, label: 'long off' },
  cover: { x: 45, y: 110, label: 'cover' },
  point: { x: 45, y: 70, label: 'point' },
  third_man: { x: 82, y: 42, label: 'third man' },
  keeper: { x: 100, y: 48, label: 'the keeper' },
  pitch: { x: 100, y: 92, label: 'the pitch' },
}

function caption(event?: BallEvent) {
  if (!event) return 'The field, waiting for the next ball'
  const zone = zones[event.shot?.zone]?.label ?? 'the field'
  if (event.outcome === 'wicket') return `Wicket. The ball went to ${zone}`
  if (event.outcome === 'four') return `Four. The ball went to ${zone}`
  if (event.outcome === 'six') return `Six. The ball went to ${zone}`
  if (event.chance && !event.chance.converted) return `Chance dropped at ${zone}`
  if (event.fieldingSave) return `Runs saved at ${zone}`
  return `${event.runs} run${event.runs === 1 ? '' : 's'} to ${zone}`
}

export function FieldSvg({ event }: { event?: BallEvent }) {
  const dest = event ? zones[event.shot?.zone] ?? zones.pitch : zones.pitch
  const start = { x: 100, y: 92 }
  const four = event?.outcome === 'four'
  const six = event?.outcome === 'six'
  const wicket = event?.outcome === 'wicket'
  const drop = event?.chance && !event.chance.converted
  const label = caption(event)

  return (
    <svg viewBox="0 0 200 190" className="w-full max-w-md mx-auto" role="img" aria-label={label}>
      <title>{label}</title>
      <ellipse cx="100" cy="95" rx="88" ry="80" fill="#166534" stroke={four || six ? '#fde68a' : '#14532d'} strokeWidth={four || six ? 4 : 2} />
      <ellipse cx="100" cy="95" rx="48" ry="42" fill="none" stroke="#86efac" strokeWidth="1" opacity="0.5" />
      <rect x="94" y="78" width="12" height="32" rx="1" fill="#ca8a04" />
      <circle cx="100" cy="52" r="3.5" fill="#fff" />
      {Object.entries(zones).filter(([k]) => !['pitch', 'keeper'].includes(k)).map(([k, p]) => (
        <circle key={k} cx={p.x} cy={p.y} r="2.5" fill="#bbf7d0" opacity="0.7" />
      ))}
      {event && (
        <path
          d={`M ${start.x} ${start.y} Q ${(start.x + dest.x) / 2} ${event.shot?.aerial ? start.y - 30 : (start.y + dest.y) / 2} ${dest.x} ${dest.y}`}
          fill="none"
          stroke={wicket ? 'var(--wicket)' : six ? 'var(--six)' : four ? 'var(--boundary)' : '#fff'}
          strokeWidth="2"
        />
      )}
      {event && <circle cx={dest.x} cy={dest.y} r={six ? 5 : 3} fill={wicket ? 'var(--wicket)' : '#fff'} />}
      {drop && <text x={dest.x} y={dest.y - 8} textAnchor="middle" fontSize="8" fill="#fde68a">Dropped</text>}
      {event?.fieldingSave && <text x={dest.x} y={dest.y - 8} textAnchor="middle" fontSize="8" fill="#fff">Saved</text>}
    </svg>
  )
}
