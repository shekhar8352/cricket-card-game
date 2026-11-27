import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Clock, CloudRain, CloudSun, Crown, Droplets, Mountain, Sparkles, Swords } from 'lucide-react'
import { api } from '../../api/client'
import { Button } from '../ui/button'
import { PlayerAvatar } from '../card/PlayerAvatar'
import { cn } from '../../lib/cn'
import { ROLE_LABEL } from '../../lib/labels'
import { validateBowlingPlan } from '../../lib/rules'
import { GamePlanPicker } from './GamePlanPicker'
import type { ConditionsDef, LineupDTO, MatchDTO, MatchPause, PlayerCard } from '../../types/engine'

const COND_ICON: Record<string, typeof CloudSun> = { clear: CloudSun, dew: Droplets, crumbling: Mountain, overcast: CloudRain }

function useSecondsLeft(deadline?: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline])
  return deadline ? Math.max(0, Math.round((new Date(deadline).getTime() - now) / 1000)) : null
}

function Countdown({ deadline }: { deadline?: string | null }) {
  const s = useSecondsLeft(deadline)
  if (s == null) return null
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-cta" role="status">
      <Clock size={16} aria-hidden /> {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')} left, then your captain decides
    </p>
  )
}

export function ConditionsCard({ c }: { c: ConditionsDef }) {
  const Icon = COND_ICON[c.code] ?? CloudSun
  const fx: string[] = []
  if (c.paceBonus) fx.push(`Pace ${c.paceBonus > 0 ? '+' : ''}${c.paceBonus}`)
  if (c.spinBonus) fx.push(`Spin ${c.spinBonus > 0 ? '+' : ''}${c.spinBonus}`)
  if (c.batterBonus) fx.push(`Batters +${c.batterBonus}`)
  if (c.catchDrop) fx.push(`Catches −${c.catchDrop}%`)
  if (c.seamEdges) fx.push('More edges')
  return (
    <div className="flex gap-3 rounded-2xl border border-border p-3">
      <span className="grid place-items-center w-11 h-11 shrink-0 rounded-xl bg-accent/15 text-accent"><Icon size={22} aria-hidden /></span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Conditions for the 2nd innings</p>
        <p className="font-display text-xl font-bold leading-tight">{c.name}</p>
        <p className="text-sm text-muted">{c.description}</p>
        {fx.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1.5">{fx.map((f) => <span key={f} className="rounded-md bg-black/5 dark:bg-white/10 px-2 py-0.5 text-xs font-semibold">{f}</span>)}</div>}
      </div>
    </div>
  )
}

function OrderList({ ids, byId, onChange }: { ids: string[]; byId: Record<string, PlayerCard>; onChange: (ids: string[]) => void }) {
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= ids.length) return
    const next = ids.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <ol className="space-y-1.5">
      {ids.map((id, i) => (
        <li key={id} className="flex items-center gap-2 rounded-xl border border-border px-2 py-1">
          <span className="w-5 text-center font-display font-bold tabular text-muted">{i + 1}</span>
          <PlayerAvatar name={byId[id]?.name} rarity={byId[id]?.rarity} />
          <span className="flex-1 truncate font-medium">{byId[id]?.name}</span>
          <button type="button" className="grid place-items-center w-9 h-9 rounded-lg cursor-pointer disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${byId[id]?.name} up`}><ChevronUp size={16} /></button>
          <button type="button" className="grid place-items-center w-9 h-9 rounded-lg cursor-pointer disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10" disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${byId[id]?.name} down`}><ChevronDown size={16} /></button>
        </li>
      ))}
    </ol>
  )
}

/** The innings-break decision: a plan card plus an optional order change. */
export function BreakPanel({ m, pause, mine, teamName }: { m: MatchDTO; pause: MatchPause; mine?: LineupDTO; teamName: string }) {
  const qc = useQueryClient()
  const byId = useMemo(() => Object.fromEntries((mine?.cards ?? []).map((c) => [c.id, c])), [mine])
  const [call, setCall] = useState(pause.currentPlan ?? pause.suggested ?? '')
  const [order, setOrder] = useState<string[]>(mine?.battingOrder ?? [])
  const [bowling, setBowling] = useState<string[]>(mine?.bowlingPlan ?? [])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const chasing = pause.role === 'chase'
  const bowlers = (mine?.cards ?? []).filter((c) => c.role === 'BOWL' || c.role === 'AR')
  const bowlErr = !chasing && bowling.length === 5 ? validateBowlingPlan(mine?.cards ?? [], bowling) : null

  async function submit(letCaptain: boolean) {
    setBusy(true)
    setErr('')
    try {
      const changedBat = chasing && JSON.stringify(order) !== JSON.stringify(mine?.battingOrder ?? [])
      const changedBowl = !chasing && JSON.stringify(bowling) !== JSON.stringify(mine?.bowlingPlan ?? [])
      const next = await api.submitBreak(m.id, letCaptain ? { call: 'captain' } : {
        call: call || 'captain',
        ...(changedBat ? { battingOrder: order } : {}),
        ...(changedBowl ? { bowlingPlan: bowling } : {}),
      })
      qc.setQueryData(['match', m.id], next)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (pause.decided) {
    return (
      <section className="glass rounded-2xl border-2 border-cta/60 p-5 text-center" aria-live="polite">
        <p className="font-display text-2xl font-bold">Call made{pause.yourCall ? `: ${pause.options?.find((o) => o.code === pause.yourCall)?.name ?? pause.yourCall}` : ''}</p>
        <p className="text-muted">{pause.opponentDecided ? 'Starting the second innings…' : 'Waiting for the other captain’s call…'}</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl border-2 border-cta/60 p-4 sm:p-5 space-y-4" aria-labelledby="break-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cta">Innings break</p>
          <h2 id="break-h" className="font-display text-3xl sm:text-4xl font-bold uppercase leading-none mt-1">
            {chasing ? `${teamName} need ${pause.target} to win` : `${teamName} defend ${pause.target - 1}`}
          </h2>
          <p className="text-muted mt-1">{chasing ? `${pause.target} off 30 balls: ${((pause.target / 30) * 6).toFixed(2)} an over.` : `They need ${pause.target} off 30 balls.`} Set the plan for every over, or leave it to your captain.</p>
        </div>
        <Countdown deadline={pause.deadline} />
      </div>

      <ConditionsCard c={pause.conditions} />

      <div>
        <h3 className="font-bold flex items-center gap-1.5 mb-2"><Swords size={16} aria-hidden /> Your plan for the {chasing ? 'chase' : 'defence'}</h3>
        <GamePlanPicker
          options={pause.options ?? []}
          value={call}
          onChange={setCall}
          label="Plan for the second innings"
          suggested={pause.suggested}
          current={pause.currentPlan}
        />
        {chasing && <p className="text-xs text-muted mt-2">Any plan switches to attack once the asking rate passes 13 an over.</p>}
      </div>

      <details className="rounded-2xl border border-border p-3">
        <summary className="cursor-pointer font-bold">{chasing ? 'Change the batting order (optional)' : 'Change the bowling order (optional)'}</summary>
        <div className="mt-3">
          {chasing ? (
            <OrderList ids={order} byId={byId} onChange={setOrder} />
          ) : (
            <div className="space-y-2">
              {bowling.map((pid, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-14 font-semibold">Over {i + 1}</span>
                  <select value={pid} onChange={(e) => setBowling(bowling.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1 min-h-10 rounded-lg border border-border bg-card px-2 cursor-pointer">
                    {bowlers.map((c) => <option key={c.id} value={c.id}>{c.name} ({ROLE_LABEL[c.role]}, {c.bowlType})</option>)}
                  </select>
                </label>
              ))}
              {bowlErr && <p className="text-wicket text-sm" role="alert">{bowlErr}</p>}
              {pause.conditions.spinBonus !== 0 && <p className="text-xs text-muted">Conditions changed for spin ({pause.conditions.spinBonus > 0 ? '+' : ''}{pause.conditions.spinBonus}). Worth moving your spinner?</p>}
            </div>
          )}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy || !!bowlErr} onClick={() => submit(false)}><Sparkles size={16} aria-hidden /> {busy ? 'Sending…' : 'Lock in plan'}</Button>
        <Button variant="outline" disabled={busy} onClick={() => submit(true)}><Crown size={16} aria-hidden /> Captain decides</Button>
        {err && <p className="text-wicket text-sm" role="alert">{err}</p>}
      </div>
    </section>
  )
}

/** Super Over picks: three batters in order and one bowler. */
export function SuperOverPanel({ m, pause, mine }: { m: MatchDTO; pause: MatchPause; mine?: LineupDTO }) {
  const qc = useQueryClient()
  const cards = useMemo(() => mine?.cards ?? [], [mine])
  const byId = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards])
  const [batters, setBatters] = useState<string[]>(pause.suggestedPicks?.batters ?? [])
  const [bowler, setBowler] = useState(pause.suggestedPicks?.bowler ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(letCaptain: boolean) {
    setBusy(true)
    setErr('')
    try {
      const next = await api.submitSuperOver(m.id, letCaptain ? {} : { batters, bowler })
      qc.setQueryData(['match', m.id], next)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (pause.decided) {
    return (
      <section className="glass rounded-2xl border-2 border-six/60 p-5 text-center" aria-live="polite">
        <p className="font-display text-2xl font-bold">Super Over picks locked</p>
        <p className="text-muted">{pause.opponentDecided ? 'Here we go…' : 'Waiting for the other side…'}</p>
      </section>
    )
  }

  const toggle = (id: string) => setBatters((b) => (b.includes(id) ? b.filter((x) => x !== id) : b.length >= 3 ? b : [...b, id]))
  return (
    <section className="glass rounded-2xl border-2 border-six/60 p-4 sm:p-5 space-y-4" aria-labelledby="so-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-six">It’s a tie!</p>
          <h2 id="so-h" className="font-display text-4xl font-bold uppercase leading-none mt-1">Super Over</h2>
          <p className="text-muted mt-1">One over each, 2 wickets and you’re out. Pick 3 batters in order and 1 bowler.</p>
        </div>
        <Countdown deadline={pause.deadline} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-bold mb-2">Batters ({batters.length}/3, in order)</h3>
          <div className="flex flex-wrap gap-2">
            {cards.map((c) => {
              const at = batters.indexOf(c.id)
              return (
                <button key={c.id} type="button" aria-pressed={at >= 0} onClick={() => toggle(c.id)} className={cn('flex items-center gap-2 rounded-xl border-2 px-2 py-1 cursor-pointer', at >= 0 ? 'border-six bg-six/10' : 'border-border')}>
                  {at >= 0 && <span className="grid place-items-center w-5 h-5 rounded-full bg-six text-white text-xs font-bold">{at + 1}</span>}
                  <span className="text-sm font-medium">{c.name}</span>
                </button>
              )
            })}
          </div>
          {batters.length === 3 && <div className="mt-3"><OrderList ids={batters} byId={byId} onChange={setBatters} /></div>}
        </div>
        <div>
          <h3 className="font-bold mb-2">Bowler</h3>
          <div className="flex flex-wrap gap-2">
            {cards.filter((c) => c.role === 'BOWL' || c.role === 'AR').map((c) => (
              <button key={c.id} type="button" aria-pressed={bowler === c.id} onClick={() => setBowler(c.id)} className={cn('rounded-xl border-2 px-3 py-1.5 text-sm font-medium cursor-pointer', bowler === c.id ? 'border-six bg-six/10' : 'border-border')}>
                {c.name} <span className="text-muted">({c.bowlType})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy || batters.length !== 3 || !bowler} onClick={() => submit(false)}>{busy ? 'Sending…' : 'Lock Super Over picks'}</Button>
        <Button variant="outline" disabled={busy} onClick={() => submit(true)}><Crown size={16} aria-hidden /> Let my captain pick</Button>
        {err && <p className="text-wicket text-sm" role="alert">{err}</p>}
      </div>
    </section>
  )
}
