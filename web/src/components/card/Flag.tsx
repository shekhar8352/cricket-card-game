import type { ReactNode } from 'react'

/**
 * Simplified team flags drawn as SVG (emoji flags don't render on Windows).
 * viewBox is 30x20. West Indies uses the cricket board's maroon colours, as
 * the team represents several nations.
 */
const FLAGS: Record<string, { name: string; art: ReactNode }> = {
  IND: {
    name: 'India',
    art: (
      <>
        <rect width="30" height="6.67" fill="#ff9933" />
        <rect y="6.67" width="30" height="6.67" fill="#fff" />
        <rect y="13.33" width="30" height="6.67" fill="#138808" />
        <circle cx="15" cy="10" r="2.4" fill="none" stroke="#000080" strokeWidth="0.6" />
        <circle cx="15" cy="10" r="0.5" fill="#000080" />
      </>
    ),
  },
  AUS: {
    name: 'Australia',
    art: (
      <>
        <rect width="30" height="20" fill="#012169" />
        <UnionCanton />
        <Star x={7.5} y={15} r={1.9} fill="#fff" />
        <Star x={22.5} y={4} r={1} fill="#fff" />
        <Star x={26} y={8.5} r={1} fill="#fff" />
        <Star x={19.5} y={9.5} r={1} fill="#fff" />
        <Star x={22.5} y={16} r={1.1} fill="#fff" />
      </>
    ),
  },
  NZ: {
    name: 'New Zealand',
    art: (
      <>
        <rect width="30" height="20" fill="#012169" />
        <UnionCanton />
        {[[22.5, 4.5], [26, 9], [19.5, 10], [22.5, 16]].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <Star x={x} y={y} r={1.4} fill="#fff" />
            <Star x={x} y={y} r={1} fill="#c8102e" />
          </g>
        ))}
      </>
    ),
  },
  ENG: {
    name: 'England',
    art: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <rect x="12.5" width="5" height="20" fill="#ce1124" />
        <rect y="7.5" width="30" height="5" fill="#ce1124" />
      </>
    ),
  },
  SA: {
    name: 'South Africa',
    art: (
      <>
        <rect width="30" height="10" fill="#e03c31" />
        <rect y="10" width="30" height="10" fill="#001489" />
        <path d="M0 0 L11 10 L0 20 Z" fill="#fff" />
        <path d="M0 0 H5 L15 8 H30 V12 H15 L5 20 H0 Z" fill="#fff" />
        <path d="M0 1.5 L12.5 10 L0 18.5 Z" fill="#ffb612" />
        <path d="M0 0 H3 L13.5 8.6 H30 V11.4 H13.5 L3 20 H0 Z" fill="#007749" />
        <path d="M0 3.5 L9 10 L0 16.5 Z" fill="#000" />
      </>
    ),
  },
  SL: {
    name: 'Sri Lanka',
    art: (
      <>
        <rect width="30" height="20" fill="#ffbe29" />
        <rect x="1" y="1" width="3.5" height="18" fill="#00534e" />
        <rect x="4.5" y="1" width="3.5" height="18" fill="#eb7400" />
        <rect x="9" y="1" width="20" height="18" fill="#8d153a" />
        <path d="M14 13 q2-6 5-4 q2 1 4-1 l1 2 q-2 2-4 1 l-1 3 z" fill="#ffbe29" />
      </>
    ),
  },
  BAN: {
    name: 'Bangladesh',
    art: (
      <>
        <rect width="30" height="20" fill="#006a4e" />
        <circle cx="13.5" cy="10" r="5.5" fill="#f42a41" />
      </>
    ),
  },
  AFG: {
    name: 'Afghanistan',
    art: (
      <>
        <rect width="10" height="20" fill="#000" />
        <rect x="10" width="10" height="20" fill="#be0000" />
        <rect x="20" width="10" height="20" fill="#007a36" />
        <circle cx="15" cy="10" r="3.2" fill="none" stroke="#fff" strokeWidth="0.8" />
        <rect x="13.8" y="8.6" width="2.4" height="2.4" fill="#fff" />
      </>
    ),
  },
  WI: {
    name: 'West Indies',
    art: (
      <>
        <rect width="30" height="20" fill="#7b1630" />
        <circle cx="15" cy="10" r="6" fill="#f2c200" />
        <path d="M15 5.5 q-1 3 0 6.5 M15 6.5 q-3 0-4.5 2 M15 6.5 q3 0 4.5 2 M15 6.5 q-2 1-3 3.5 M15 6.5 q2 1 3 3.5" stroke="#0b6b2f" strokeWidth="1" fill="none" strokeLinecap="round" />
        <rect x="12.5" y="12" width="5" height="2.6" rx="0.4" fill="#7b1630" />
      </>
    ),
  },
  PAK: {
    name: 'Pakistan',
    art: (
      <>
        <rect width="30" height="20" fill="#01411c" />
        <rect width="7.5" height="20" fill="#fff" />
        <circle cx="19" cy="10" r="5" fill="#fff" />
        <circle cx="20.4" cy="8.8" r="4.3" fill="#01411c" />
        <Star x={22} y={7} r={1.3} fill="#fff" />
      </>
    ),
  },
}

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    return `${(x + rr * Math.cos(a)).toFixed(2)},${(y + rr * Math.sin(a)).toFixed(2)}`
  }).join(' ')
  return <polygon points={pts} fill={fill} />
}

function UnionCanton() {
  return (
    <g>
      <rect width="15" height="10" fill="#012169" />
      <path d="M0 0 L15 10 M15 0 L0 10" stroke="#fff" strokeWidth="2" />
      <path d="M0 0 L15 10 M15 0 L0 10" stroke="#c8102e" strokeWidth="0.8" />
      <path d="M7.5 0 V10 M0 5 H15" stroke="#fff" strokeWidth="3" />
      <path d="M7.5 0 V10 M0 5 H15" stroke="#c8102e" strokeWidth="1.6" />
    </g>
  )
}

export function Flag({ code, className }: { code: string; className?: string }) {
  const f = FLAGS[code]
  return (
    <svg viewBox="0 0 30 20" className={className} role="img" aria-label={f?.name ?? code}>
      <title>{f?.name ?? code}</title>
      {f ? f.art : (
        <>
          <rect width="30" height="20" fill="#64748b" />
          <text x="15" y="13.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">{code}</text>
        </>
      )}
      <rect width="30" height="20" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
    </svg>
  )
}
