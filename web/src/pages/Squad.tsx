import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { PageHeader } from '../components/ui/chrome'
import { PlanEditor, type PlanSection } from '../components/match/PlanEditor'
import { MobileTabs } from '../components/ui/MobileTabs'
import { compareForm } from '../lib/ratings'
import { bestTeam, emptyPlan, placeInSlots, planErrors, planFromDefault, samePlan, toRequest, withTeam, type MatchPlan } from '../lib/plan'
import type { PlayerCard } from '../types/engine'

export function SquadPage() {
  const qc = useQueryClient()
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const savedQ = useQuery({ queryKey: ['squad'], queryFn: api.squad })
  const [plan, setPlan] = useState<MatchPlan | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<PlanSection>('team')

  const all = useMemo(() => cards.data ?? [], [cards.data])
  const byId = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all])
  const saved = useMemo(() => (cards.isSuccess && savedQ.isSuccess ? planFromDefault(savedQ.data, byId) : null), [cards.isSuccess, savedQ.isSuccess, savedQ.data, byId])
  const lostCards = savedQ.isSuccess && (savedQ.data?.cardIds?.length ?? 0) > 0 && cards.isSuccess && !saved

  // Until the user edits, the plan is simply the saved default.
  const ready = cards.isSuccess && savedQ.isSuccess
  const current = plan ?? saved ?? emptyPlan()
  const { squadErr, bowlErr, ok } = planErrors(current, byId)
  const unsaved = !saved || !samePlan(current, saved)

  function fill(by: 'overall' | 'form') {
    const rank = by === 'form' ? compareForm : (a: PlayerCard, b: PlayerCard) => b.overall - a.overall
    setPlan(withTeam(current, placeInSlots(bestTeam(all, rank)), byId))
    setMsg('')
  }

  async function save() {
    setBusy(true)
    setErr('')
    try {
      await api.saveSquad(toRequest(current))
      await qc.invalidateQueries({ queryKey: ['squad'] })
      setMsg('Saved. Every new match starts from this team and strategy.')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const fillTools = (
    <div className="chip-row">
      <Button variant="outline" onClick={() => fill('overall')}>Fill best rated</Button>
      <Button variant="outline" onClick={() => fill('form')}>Fill in-form 7</Button>
    </div>
  )
  return (
    <div className="space-y-4 lg:space-y-6 pb-24 lg:pb-28">
      <PageHeader
        title="Squad & strategy"
        lede="Your default team and match plan. Every new match starts from it, so before a match you only tweak for the pitch and opponent."
        action={<div className="hidden lg:block">{fillTools}</div>}
      />
      <MobileTabs
        label="Squad"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'team', label: 'Team', badge: squadErr ? '!' : null, warn: !!squadErr },
          { key: 'batting', label: 'Batting' },
          { key: 'bowling', label: 'Bowling', badge: bowlErr ? '!' : null, warn: !!bowlErr },
          { key: 'captain', label: 'Captain' },
          { key: 'plan', label: 'Plan' },
        ]}
      />
      {lostCards && (
        <p className="rounded-xl border border-wicket/50 bg-wicket/10 px-4 py-3 text-sm">Some players in your saved default are no longer in your collection. Pick replacements and save again.</p>
      )}
      {ready ? (
        <PlanEditor cards={all} plan={current} onChange={(p) => { setPlan(p); setMsg('') }} section={tab} teamTools={fillTools} />
      ) : (
        <p className="text-muted">Loading your cards…</p>
      )}

      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 inset-x-0 md:left-60 z-30 glass border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3">
          <Button disabled={!ok || busy || !unsaved} onClick={save}><Save size={16} aria-hidden /> {busy ? 'Saving…' : 'Save as default'}</Button>
          <p className="text-sm text-muted">{squadErr ?? bowlErr ?? (unsaved ? 'You have unsaved changes.' : 'This is your saved default.')}</p>
          {msg && <p className="text-sm text-success" role="status">{msg}</p>}
          {err && <p className="text-sm text-wicket" role="alert">{err}</p>}
        </div>
      </div>
    </div>
  )
}
