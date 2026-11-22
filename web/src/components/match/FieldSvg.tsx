import type { BallEvent } from '../../types/engine'

const zones: Record<string, { x: number; y: number; label: string }> = {
  fine_leg: { x: 150, y: 40, label: 'fine leg' },
  square_leg: { x: 178, y: 92, label: 'square leg' },
  midwicket: { x: 164, y: 140, label: 'midwicket' },
  long_on: { x: 128, y: 172, label: 'long on' },
  long_off: { x: 72, y: 172, label: 'long off' },
  cover: { x: 36, y: 140, label: 'cover' },
  point: { x: 22, y: 92, label: 'point' },
  third_man: { x: 50, y: 40, label: 'third man' },
  keeper: { x: 100, y: 62, label: 'the keeper' },
  pitch: { x: 100, y: 100, label: 'the pitch' },
}

const boundaryPoint: Record<string, { x: number; y: number }> = {
  fine_leg: { x: 162, y: 22 },
  square_leg: { x: 194, y: 92 },
  midwicket: { x: 178, y: 156 },
  long_on: { x: 134, y: 190 },
  long_off: { x: 66, y: 190 },
  cover: { x: 22, y: 156 },
  point: { x: 6, y: 92 },
  third_man: { x: 38, y: 22 },
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

// During the powerplay only these two zones have a fielder on the boundary.
const POWERPLAY_OUT = new Set(['long_on', 'third_man'])

export function FieldSvg({ event, powerplay }: { event?: BallEvent; powerplay?: boolean }) {
  const four = event?.outcome === 'four'
  const six = event?.outcome === 'six'
  const wicket = event?.outcome === 'wicket'
  const drop = event?.chance && !event.chance.converted
  const zoneKey = event?.shot?.zone
  const dest = event
    ? (four || six) && zoneKey && boundaryPoint[zoneKey]
      ? boundaryPoint[zoneKey]
      : zones[zoneKey ?? ''] ?? zones.pitch
    : zones.pitch
  const start = { x: 100, y: 108 }
  const lift = event?.shot?.aerial || six ? 46 : 8
  const path = `M ${start.x} ${start.y} Q ${(start.x + dest.x) / 2} ${(start.y + dest.y) / 2 - lift} ${dest.x} ${dest.y}`
  const color = wicket ? '#ff5a5a' : six ? '#c4a5ff' : four ? '#5ff0a8' : drop ? '#ffc23d' : '#ffffff'
  const label = caption(event)

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-md mx-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.35)]" role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <radialGradient id="grass" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#23a35f" />
          <stop offset="1" stopColor="#0d5c33" />
        </radialGradient>
        <pattern id="mow" width="20" height="200" patternUnits="userSpaceOnUse">
          <rect width="10" height="200" fill="rgba(255,255,255,0.045)" />
        </pattern>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#grass)" />
      <circle cx="100" cy="100" r="96" fill="url(#mow)" />
      <circle
        cx="100" cy="100" r="94" fill="none"
        stroke={four || six ? color : 'rgba(255,255,255,0.75)'}
        strokeWidth={four || six ? 3.5 : 1.5}
        className={four || six ? 'animate-pulse' : undefined}
      />
      <circle cx="100" cy="100" r="52" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3 4" />
      <rect x="93" y="70" width="14" height="44" rx="2" fill="#c8a978" />
      <rect x="93" y="70" width="14" height="44" rx="2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
      <line x1="92" y1="76" x2="108" y2="76" stroke="#fff" strokeWidth="0.8" />
      <line x1="92" y1="108" x2="108" y2="108" stroke="#fff" strokeWidth="0.8" />
      {Object.entries(zones).filter(([k]) => !['pitch', 'keeper'].includes(k)).map(([k, p]) => {
        // Powerplay: fielders not allowed out are drawn inside the ring.
        const inRing = powerplay && !POWERPLAY_OUT.has(k)
        const fx = inRing ? 100 + (p.x - 100) * 0.55 : p.x
        const fy = inRing ? 100 + (p.y - 100) * 0.55 : p.y
        return (
        <g key={k}>
          <circle cx={fx} cy={fy} r={zoneKey === k ? 4.5 : 3} fill={zoneKey === k ? color : inRing ? '#ffd166' : '#eaffef'} opacity={zoneKey === k ? 1 : 0.9} />
          <text x={p.x} y={p.y + 10} textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.55)">{p.label}</text>
        </g>
        )
      })}
      {powerplay && <text x="100" y="196" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ffd166">POWERPLAY: 2 FIELDERS OUT</text>}
      <circle cx="100" cy="62" r="3" fill="#eaffef" />
      {event && (
        <g key={event.seq + '-' + event.innings}>
          <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeDasharray={event.shot?.aerial ? '4 3' : undefined} opacity="0.9" />
          <circle r={six ? 4.5 : 3.5} fill={color} className="field-ball" style={{ offsetPath: `path('${path}')` }} />
          {wicket && (
            <g transform={`translate(${start.x} ${start.y - 40})`}>
              <rect x="-6" y="-2" width="2" height="12" fill="#ffd166" transform="rotate(-18)" />
              <rect x="-1" y="-2" width="2" height="12" fill="#ffd166" />
              <rect x="4" y="-2" width="2" height="12" fill="#ffd166" transform="rotate(18)" />
            </g>
          )}
        </g>
      )}
      {drop && <text x={dest.x} y={dest.y - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffc23d">DROPPED</text>}
      {event?.fieldingSave && <text x={dest.x} y={dest.y - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">SAVED</text>}
    </svg>
  )
}
