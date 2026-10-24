import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useMatchPlayback } from '../components/match/useMatchPlayback'
import { FieldSvg } from '../components/match/FieldSvg'
import { PlayerCard } from '../components/card/PlayerCard'
import { Button } from '../components/ui/button'
import { Panel } from '../components/ui/chrome'
import { useUI } from '../store/ui'
import { useEffect, useMemo } from 'react'
import type { PlayerCard as Card } from '../types/engine'
import { cn } from '../lib/cn'

function pill(outcome: string, runs: number) {
  if (outcome === 'wicket') return { t: 'W', label: 'wicket', c: 'text-wicket' }
  if (outcome === 'four') return { t: '4', label: 'four', c: 'text-boundary' }
  if (outcome === 'six') return { t: '6', label: 'six', c: 'text-six' }
  if (outcome === 'wide' || outcome === 'noball' || outcome === 'bye') return { t: outcome[0].toUpperCase(), label: outcome, c: 'text-extras' }
  if (runs === 0) return { t: '0', label: 'dot ball', c: 'text-muted' }
  return { t: String(runs), label: `${runs} runs`, c: 'text-runs' }
}

export function LiveMatchPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const match = useQuery({ queryKey: ['match', id], queryFn: () => api.match(id!), refetchInterval: 4000 })
  const m = match.data
  const balls = m?.ballLog ?? m?.result?.balls ?? []
  const { shown, current, done, skipToEnd } = useMatchPlayback(id!, balls, m?.status === 'COMPLETE')
  const { speed, setSpeed } = useUI()

  useEffect(() => {
    if (done && m?.status === 'COMPLETE') {
      const t = setTimeout(() => nav(`/match/${id}/result`), 1200)
      return () => clearTimeout(t)
    }
  }, [done, m?.status, id, nav])

  const cards = useMemo(() => {
    const map = new Map<string, Card>()
    for (const c of [...(m?.homeLineup?.cards ?? []), ...(m?.awayLineup?.cards ?? [])]) map.set(c.id, c)
    return map
  }, [m])

  const inn = current?.innings ?? 0
  const innRes = m?.result?.innings?.[inn]
  const overBalls = shown.filter((b) => b.innings === inn && b.over === (current?.over ?? 0) && b.legal)
  const first = m?.result?.innings?.[0]
  const ballsBowled = current ? current.over * 6 + current.ball + (current.legal ? 1 : 0) : 0
  const score = innRes ? `${innRes.runs}/${innRes.wickets}` : current ? `${current.score}/${current.wickets}` : '0/0'
  const overs = current ? `${current.over}.${current.ball + (current.legal ? 1 : 0)}` : '0.0'

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">{inn === 0 ? 'First innings' : 'Chase'}</p>
          <p className="font-display text-5xl font-semibold tabular leading-none mt-1">
            {score}
            <span className="text-2xl text-muted font-medium ml-2">({overs})</span>
          </p>
          {inn === 1 && first && current && (
            <p className="text-muted mt-2">Need {Math.max(0, first.runs + 1 - current.score)} from {Math.max(0, 30 - ballsBowled)} balls</p>
          )}
          {!current && <p className="text-muted mt-2">The first ball is on the way.</p>}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Playback speed">
          <Button variant={speed === 1 ? 'primary' : 'outline'} aria-pressed={speed === 1} onClick={() => setSpeed(1)}>Normal speed</Button>
          <Button variant={speed === 2 ? 'primary' : 'outline'} aria-pressed={speed === 2} onClick={() => setSpeed(2)}>Fast</Button>
          <Button variant="outline" onClick={skipToEnd}>Skip to result</Button>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <Panel>
          <h2 className="sr-only">Field</h2>
          <FieldSvg event={current} />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-2">
            <li className="text-wicket">W wicket</li>
            <li className="text-boundary">4 boundary</li>
            <li className="text-six">6 six</li>
            <li className="text-extras">W wide, N no-ball, B bye</li>
          </ul>
        </Panel>
        <div className="space-y-3">
          <Panel>
            <h2 className="text-sm font-semibold text-muted">This over</h2>
            <div className="flex gap-3 text-2xl font-display font-semibold tabular mt-1 min-h-8">
              {overBalls.length === 0 && <span className="text-base text-muted font-sans font-normal">No balls yet</span>}
              {overBalls.map((b, i) => {
                const p = pill(b.outcome, b.runs)
                return <span key={`${b.over}-${i}-${p.t}`} className={cn('ball-pop', p.c)} aria-label={p.label}>{p.t}</span>
              })}
            </div>
          </Panel>
          <Panel className="h-64 overflow-y-auto" aria-live="polite">
            <h2 className="text-sm font-semibold text-muted mb-2">Commentary</h2>
            {shown.length === 0 && <p className="text-muted">Commentary starts with the first ball.</p>}
            {[...shown].reverse().slice(0, 12).map((b, i) => (
              <p key={i} className="text-base py-2 border-b border-border">{b.commentary}</p>
            ))}
          </Panel>
        </div>
      </div>

      {current && (
        <div className="felt-tray flex flex-wrap items-end gap-4">
          <div>
            <div className="text-sm text-white mb-1">Striker</div>
            <PlayerCard card={cards.get(current.strikerId)} size="sm" />
          </div>
          {current.nonStrikerId && (
            <div>
              <div className="text-sm text-white mb-1">Non-striker</div>
              <PlayerCard card={cards.get(current.nonStrikerId)} size="sm" />
            </div>
          )}
          <div>
            <div className="text-sm text-white mb-1">Bowler</div>
            <PlayerCard card={cards.get(current.bowlerId)} size="sm" />
          </div>
          {current.traitsTriggered?.map((t) => (
            <span key={t} className="self-center rounded-full bg-black/30 px-3 py-1 text-sm text-white">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}
