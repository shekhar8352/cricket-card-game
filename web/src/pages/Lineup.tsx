import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, RotateCcw, Save, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { Button } from '../components/ui/button'
import { PageHeader, Panel } from '../components/ui/chrome'
import { ScoutingPanel } from '../components/match/MatchPlan'
import { PlanEditor } from '../components/match/PlanEditor'
import { compareForm } from '../lib/ratings'
import { bestTeam, emptyPlan, placeInSlots, planErrors, planFromDefault, samePlan, toRequest, withTeam, type MatchPlan } from '../lib/plan'

/** Past the lineup stage: the match is being played, paused for a call, or finished. */
const isUnderway = (status: string) => ['SIMULATING', 'INNINGS_BREAK', 'SUPER_OVER', 'COMPLETE'].includes(status)

function useCountdown(deadline?: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline])
  if (!deadline) return null
  return Math.max(0, Math.round((new Date(deadline).getTime() - now) / 1000))
}

export function LineupPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const match = useQuery({ queryKey: ['match', id], queryFn: () => api.match(id!), refetchInterval: 3000 })
  const cardsQ = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const savedQ = useQuery({ queryKey: ['squad'], queryFn: api.squad })
  const [plan, setPlan] = useState<MatchPlan | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<'lock' | 'save' | null>(null)

  const all = useMemo(() => cardsQ.data ?? [], [cardsQ.data])
  const byId = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all])
  const saved = useMemo(() => (cardsQ.isSuccess && savedQ.isSuccess ? planFromDefault(savedQ.data, byId) : null), [cardsQ.isSuccess, savedQ.isSuccess, savedQ.data, byId])
  const opp = match.data?.youAreHome ? match.data?.awayLineup : match.data?.homeLineup
  const secondsLeft = useCountdown(match.data?.lineupDeadline)
  const status = match.data?.status

  useEffect(() => {
    if (status && isUnderway(status)) nav(`/match/${id}/live`)
  }, [status, id, nav])

  // Start from the saved default so locking in only needs tweaks; edits replace it.
  const ready = cardsQ.isSuccess && savedQ.isSuccess
  const current = plan ?? saved ?? emptyPlan()
  const { squadErr, bowlErr, ok } = planErrors(current, byId)
  const changedFromDefault = !!saved && !samePlan(current, saved)

  function fill(by: 'overall' | 'form') {
    const rank = by === 'form' ? compareForm : (a: (typeof all)[number], b: (typeof all)[number]) => b.overall - a.overall
    setPlan(withTeam(current, placeInSlots(bestTeam(all, rank)), byId))
    setNote('')
  }

  async function lock() {
    setErr('')
    setBusy('lock')
    try {
      const m = await api.lockLineup(id!, toRequest(current))
      if (isUnderway(m.status)) nav(`/match/${id}/live`)
      else setNote('Locked in. Waiting for your opponent.')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function saveDefault() {
    setErr('')
    setBusy('save')
    try {
      await api.saveSquad(toRequest(current))
      await qc.invalidateQueries({ queryKey: ['squad'] })
      setNote('Saved as your default team and strategy.')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (match.data?.status === 'MATCHING') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="font-display text-4xl font-semibold">Finding an opponent</h1>
        <p className="text-muted mt-2">Stay on this page. You will set your lineup as soon as someone joins.</p>
      </div>
    )
  }

  const youLocked = (match.data?.youAreHome ? match.data?.homeLineup : match.data?.awayLineup)?.locked

  return (
    <div className="space-y-6 pb-28">
      <PageHeader
        title="Set your lineup"
        lede={`vs ${match.data?.opponent.name ?? 'opponent'}${match.data?.opponent.trophies != null ? ` · ${match.data.opponent.trophies} trophies` : ''}. Check the pitch and their captain, pick your captain and orders, then lock in.`}
        action={
          <div className="flex flex-wrap gap-2">
            {saved && <Button variant="outline" disabled={!changedFromDefault} onClick={() => { setPlan(null); setNote('Back to your default.') }}><RotateCcw size={16} aria-hidden /> Load my default</Button>}
            <Button variant="outline" onClick={() => fill('overall')}>Fill best rated</Button>
            <Button variant="outline" onClick={() => fill('form')} title="Picks by average match rating. Cards that haven't played yet come after, by overall.">Fill in-form XI</Button>
          </div>
        }
      />

      {secondsLeft != null && !youLocked && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-cta/60 bg-cta/10 px-4 py-3" role="status">
          <Clock size={22} className="text-cta shrink-0" aria-hidden />
          <p><b>Your opponent has locked in.</b> Lock in within <b className="tabular">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</b> or your default team and strategy will be used.</p>
        </div>
      )}

      {ready && saved && !changedFromDefault && (
        <div className="flex items-center gap-3 rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3">
          <Sparkles size={20} className="text-accent shrink-0" aria-hidden />
          <p>Your default team, captain and orders are loaded. Adjust for this pitch and opponent, or lock in as is.</p>
        </div>
      )}
      {ready && !saved && (
        <p className="text-sm text-muted">Tip: save a default in <Link className="underline" to="/squad">Squad &amp; strategy</Link> and every match will start from it.</p>
      )}

      <ScoutingPanel pitch={match.data?.pitch} captain={match.data?.opponentCaptain} oppCards={opp?.cards ?? []} myCards={all} rivalries={match.data?.rivalries} />

      {ready ? (
        <PlanEditor
          cards={all}
          plan={current}
          onChange={(p) => { setPlan(p); setNote('') }}
          pitch={match.data?.pitch}
          aside={
            <Panel>
              <h2 className="font-display text-2xl font-semibold">Opponent</h2>
              <p className="text-muted text-sm mb-3">Their cards show after they lock in. Batting and bowling orders stay hidden.</p>
              <div className="flex flex-wrap gap-2">
                {(opp?.cards ?? []).map((c) => <PlayerCard key={c.id} card={c} size="sm" />)}
                {!opp?.cards?.length && <p className="text-muted">Waiting for their lineup.</p>}
              </div>
            </Panel>
          }
        />
      ) : (
        <p className="text-muted">Loading your cards…</p>
      )}

      <div className="fixed bottom-16 md:bottom-0 inset-x-0 md:left-60 z-30 glass border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3 px-4 py-3">
          <Button disabled={!ok || !!busy || youLocked} onClick={lock}>{busy === 'lock' ? 'Locking in…' : youLocked ? 'Locked in' : 'Lock in lineup'}</Button>
          <Button variant="outline" disabled={!ok || !!busy || (!!saved && !changedFromDefault)} onClick={saveDefault}>
            <Save size={16} aria-hidden /> {busy === 'save' ? 'Saving…' : 'Save as my default'}
          </Button>
          <p className="text-sm text-muted">
            {squadErr ?? bowlErr ?? (changedFromDefault ? 'Changed from your default.' : saved ? 'Using your default.' : 'Ready to lock in.')}
          </p>
          {note && <p className="text-sm text-success" role="status">{note}</p>}
          {err && <p className="text-sm text-wicket" role="alert">{err}</p>}
        </div>
      </div>
    </div>
  )
}
