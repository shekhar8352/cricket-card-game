import { useEffect, useRef } from 'react'
import { Gift, Lock } from 'lucide-react'
import type { TrophyStep } from '../../types/engine'
import { arenaTheme, ROMAN } from '../../lib/arenas'
import { cn } from '../../lib/cn'
import { ArenaBadge } from './ArenaBadge'

const fmt = (n: number) => n.toLocaleString()

/**
 * The trophy road: every arena left to right with its divisions, where you are
 * now and your best. One equal-width stop per arena (the trophy ranges differ,
 * so marker positions are interpolated within each stop). Scrolls sideways on
 * phones, starting at your arena.
 */
export function TrophyRoad({
  road,
  trophies,
  arena,
  best,
  milestoneFloor,
}: {
  road: TrophyStep[]
  trophies: number
  arena: string
  best: number
  milestoneFloor?: Record<string, string>
}) {
  const arenas = road.reduce<{ name: string; min: number; steps: TrophyStep[] }[]>((acc, s) => {
    const last = acc[acc.length - 1]
    if (last && last.name === s.arena) last.steps.push(s)
    else acc.push({ name: s.arena, min: s.minTrophy, steps: [s] })
    return acc
  }, [])
  const scroller = useRef<HTMLDivElement>(null)
  const current = useRef<HTMLLIElement>(null)

  useEffect(() => {
    const el = current.current
    const box = scroller.current
    if (el && box) box.scrollLeft = Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2)
  }, [arena])

  // Where a trophy count sits inside arena i's stop, 0..1.
  const at = (i: number, t: number) => {
    const lo = arenas[i].min
    const hi = arenas[i + 1]?.min ?? lo + 1000
    return Math.min(1, Math.max(0, (t - lo) / (hi - lo)))
  }
  const inArena = (i: number, t: number) => t >= arenas[i].min && (i + 1 >= arenas.length || t < arenas[i + 1].min)

  return (
    <div>
    <div ref={scroller} className="overflow-x-auto pb-2 -mx-1 px-1" tabIndex={0} aria-label="Trophy road">
      <ol className="flex min-w-max">
        {arenas.map((a, i) => {
          const t = arenaTheme(a.name)
          const reached = best >= a.min
          const here = a.name === arena
          // Markers sit at the real trophy count, even when the buffer is
          // holding the player in the arena above.
          const youHere = inArena(i, trophies)
          const bestHere = inArena(i, best) && best > trophies
          return (
            <li key={a.name} ref={here ? current : undefined} className="w-[150px] sm:w-[170px] shrink-0">
              <div className={cn('flex flex-col items-center text-center px-2', !reached && 'opacity-55')}>
                <ArenaBadge arena={a.name} size="md" title={`${a.name} arena`} />
                <p className={cn('mt-1.5 font-display text-lg font-bold uppercase leading-tight', here && 'underline decoration-2 underline-offset-4')} style={here ? { textDecorationColor: t.color } : undefined}>
                  {a.name}
                </p>
                <p className="text-xs text-muted tabular">{fmt(a.min)}+</p>
              </div>

              {/* track */}
              <div className="relative mt-3 h-8">
                <div className="absolute inset-x-0 top-3 h-2" style={{ background: reached ? t.color : 'var(--border)' }} />
                {i === 0 && <div className="absolute left-0 top-3 h-2 w-2 rounded-l-full" style={{ background: t.color }} />}
                {a.steps.map((s) => (
                  <span
                    key={s.label}
                    className="absolute top-1.5 -translate-x-1/2 grid place-items-center"
                    style={{ left: `${at(i, s.minTrophy) * 100}%` }}
                    title={`${s.label}: ${fmt(s.minTrophy)}`}
                  >
                    <span className="block w-[3px] h-5 rounded-full bg-[var(--card-bg)]" aria-hidden />
                  </span>
                ))}
                {youHere && (
                  <span className="absolute -top-0.5 -translate-x-1/2 z-10" style={{ left: `${trophies < a.min ? 0 : at(i, trophies) * 100}%` }}>
                    <span className="block w-4 h-4 rounded-full bg-[var(--fg)] ring-[3px] ring-[var(--card-bg)]" aria-hidden />
                  </span>
                )}
                {bestHere && (
                  <span className="absolute top-0 -translate-x-1/2" style={{ left: `${at(i, best) * 100}%` }} title={`Personal best ${fmt(best)}`}>
                    <span className="block w-3 h-3 rotate-45 border-2 border-[var(--fg)] bg-[var(--card-bg)]" aria-hidden />
                  </span>
                )}
              </div>

              <ul className="mx-3 space-y-0.5 border-l border-border pl-2">
                {a.steps.map((s) => (
                  <li key={s.label} className="flex justify-between text-xs">
                    <span className="text-muted">{s.division ? ROMAN[s.division] : 'Top'}</span>
                    <span className="tabular">{fmt(s.minTrophy)}</span>
                  </li>
                ))}
              </ul>
              {!reached && milestoneFloor?.[a.name] && (
                <p className="mx-3 mt-2 flex items-center gap-1 text-[11px] text-muted">
                  <Gift size={12} aria-hidden /> First time: {milestoneFloor[a.name]}+ card
                </p>
              )}
              {!reached && !milestoneFloor?.[a.name] && (
                <p className="mx-3 mt-2 flex items-center gap-1 text-[11px] text-muted"><Lock size={12} aria-hidden /> Locked</p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[var(--fg)]" aria-hidden /> You ({fmt(trophies)})</span>
        {best > trophies && <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 border-2 border-[var(--fg)]" aria-hidden /> Personal best ({fmt(best)})</span>}
        <span>Ticks mark divisions III, II and I.</span>
      </p>
    </div>
  )
}
