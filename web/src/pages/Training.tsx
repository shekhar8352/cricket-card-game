import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Copy, Sparkles, TrendingUp } from 'lucide-react'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { RatingBadge } from '../components/card/RatingBadge'
import { Button } from '../components/ui/button'
import { EmptyState, PageHeader, Panel, ProgressBar, controlClass } from '../components/ui/chrome'
import { cn } from '../lib/cn'
import { compareForm } from '../lib/ratings'
import type { PlayerCard as Card } from '../types/engine'

type SortKey = 'xp' | 'overall' | 'form'

export function TrainingPage() {
  const [sp] = useSearchParams()
  const qc = useQueryClient()
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const squad = useQuery({ queryKey: ['squad'], queryFn: api.squad })
  const model = useQuery({ queryKey: ['engine-model'], queryFn: api.engineModel, staleTime: Infinity })
  const [target, setTarget] = useState(sp.get('target') ?? '')
  const [sac, setSac] = useState<string[]>([])
  const [sort, setSort] = useState<SortKey>('xp')
  const [ask, setAsk] = useState(false)
  const [done, setDone] = useState<{ name: string; from: number; to: number; ovFrom: number; ovTo: number; xp: number } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const all = useMemo(() => cards.data ?? [], [cards.data])
  const inSquad = useMemo(() => new Set(squad.data?.cardIds ?? []), [squad.data])
  const t = all.find((c) => c.id === target)
  const prog = model.data?.progression
  const maxSac = prog?.maxSacrifices ?? 20
  const xpFor = (c: Card) => {
    const x = prog?.sacrificeXP[c.rarity]
    if (!x || !t) return 0
    return c.playerId === t.playerId ? x.samePlayer : x.other
  }
  const atCap = (c: Card) => c.level >= (c.levelCap ?? 5)

  const preview = useQuery({
    queryKey: ['train-preview', target, sac],
    queryFn: () => api.previewTraining(target, sac),
    enabled: !!t && sac.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const plan = sac.length > 0 ? preview.data?.result : undefined

  const candidates = useMemo(() => {
    if (!t) return []
    const list = all.filter((c) => c.id !== t.id)
    const xp = (c: Card) => (prog?.sacrificeXP[c.rarity] ? (c.playerId === t.playerId ? prog.sacrificeXP[c.rarity].samePlayer : prog.sacrificeXP[c.rarity].other) : 0)
    return list.sort((a, b) => {
      const sq = Number(inSquad.has(a.id)) - Number(inSquad.has(b.id))
      if (sq) return sq // squad cards last
      if (sort === 'xp') return xp(b) - xp(a) || a.overall - b.overall
      if (sort === 'form') return -compareForm(a, b) // weakest form first
      return a.overall - b.overall
    })
  }, [all, t, sort, inSquad, prog])
  const copies = candidates.filter((c) => t && c.playerId === t.playerId && !inSquad.has(c.id))
  const precious = sac.map((id) => all.find((c) => c.id === id)).filter((c): c is Card => !!c && (c.rarity === 'Gold' || c.rarity === 'Legend' || c.level > 1 || (c.form?.avg ?? 0) >= 7))

  function pickTarget(id: string) {
    setTarget(id)
    setSac([])
    setAsk(false)
    setErr('')
  }

  function toggle(c: Card) {
    setErr('')
    setAsk(false)
    setDone(null)
    if (inSquad.has(c.id)) return
    setSac((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : s.length >= maxSac ? s : [...s, c.id]))
  }

  async function confirm() {
    if (!t) return
    setBusy(true)
    setErr('')
    try {
      const r = await api.train(t.id, sac)
      setDone({ name: t.name, from: r.result.levelBefore, to: r.result.levelAfter, ovFrom: r.result.overallBefore, ovTo: r.result.overallAfter, xp: r.result.xpGained })
      setSac([])
      setAsk(false)
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['me', 'stats'] })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Training"
        lede="Level up a player by sacrificing other cards. Each level adds +2 to the attributes that matter for that player’s role. Copies of the same player give 3× XP. Cards also earn a little XP from every match they play."
      />

      {!t ? (
        <section>
          <h2 className="font-display text-2xl font-bold uppercase mb-1">1. Choose who to train</h2>
          <p className="text-muted mb-3">Cards at their level cap can’t train further.</p>
          {all.length === 0 && !cards.isPending ? (
            <EmptyState title="No cards to train" body="Earn cards from matches, then come back to level them up." />
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {all.slice().sort((a, b) => b.overall - a.overall).map((c) => (
                <PlayerCard key={c.id} card={c} className="w-full max-w-none" disabled={atCap(c)} status={atCap(c) ? 'Max level' : undefined} onClick={() => pickTarget(c.id)} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
          <Panel className="lg:sticky lg:top-24">
            <h2 className="font-display text-2xl font-bold uppercase">Training</h2>
            <div className="mt-3"><PlayerCard card={t} size="lg" /></div>
            <p className="text-sm text-muted mt-3">Level {t.level} of {t.levelCap ?? 5} · {t.xp}/{t.xpToNext} XP</p>

            {atCap(t) ? (
              <p className="text-wicket mt-3">{t.name} is at the level cap for a {t.rarity} card.</p>
            ) : plan ? (
              <div className="mt-4 rounded-xl border border-border p-3 space-y-2" aria-live="polite">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">After training · +{plan.xpGained} XP</p>
                <div className="flex items-center gap-3 font-display font-bold">
                  <span className="text-2xl">Lv {plan.levelBefore}</span><ArrowRight size={18} aria-hidden /><span className={cn('text-3xl', plan.levelAfter > plan.levelBefore && 'text-success')}>Lv {plan.levelAfter}</span>
                  <span className="ml-auto text-lg text-muted">OVR {plan.overallBefore} → <b className={cn(plan.overallAfter > plan.overallBefore && 'text-success')}>{plan.overallAfter}</b></span>
                </div>
                {plan.levelAfter < plan.levelCap ? (
                  <>
                    <ProgressBar value={(plan.xpAfter / plan.xpToNext) * 100} label="Experience toward the next level after training" />
                    <p className="text-sm text-muted">{plan.xpAfter}/{plan.xpToNext} XP toward level {plan.levelAfter + 1}</p>
                  </>
                ) : (
                  <p className="text-sm text-success font-semibold">Reaches the level cap ({plan.levelCap}).</p>
                )}
                {plan.wasted > 0 && (
                  <p className="text-sm text-wicket flex gap-1.5"><AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden /> {plan.wasted} XP will be wasted past the cap. Remove a card to avoid losing it.</p>
                )}
              </div>
            ) : (
              <p className="text-muted mt-3">Pick cards on the right to see the result.</p>
            )}
            {preview.isError && sac.length > 0 && <p className="text-wicket text-sm mt-2" role="alert">{(preview.error as Error).message}</p>}

            {!ask && !atCap(t) && (
              <Button className="mt-4 w-full" disabled={!sac.length || !plan} onClick={() => setAsk(true)}>Review {sac.length || ''} sacrifice{sac.length === 1 ? '' : 's'}</Button>
            )}
            {ask && plan && (
              <div className="mt-4 rounded-xl border-2 border-wicket/50 p-4" role="alertdialog" aria-labelledby="train-title" aria-describedby="train-desc">
                <h3 id="train-title" className="font-display text-2xl font-bold">Sacrifice {sac.length} card{sac.length === 1 ? '' : 's'}?</h3>
                <p id="train-desc" className="text-sm text-muted mt-1">These are removed for good: {sac.map((id) => all.find((c) => c.id === id)?.name).join(', ')}.</p>
                {precious.length > 0 && (
                  <p className="text-sm text-wicket mt-2 flex gap-1.5"><AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden />Includes valuable cards: {precious.map((c) => `${c.name} (${c.rarity}, Lv ${c.level}${c.form ? `, avg ${c.form.avg.toFixed(1)}` : ''})`).join('; ')}.</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="danger" disabled={busy} onClick={confirm}>{busy ? 'Training…' : `Sacrifice for +${plan.xpGained} XP`}</Button>
                  <Button variant="outline" onClick={() => setAsk(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {done && (
              <p className="mt-3 rounded-xl bg-success/10 border border-success/40 p-3 text-success" role="status">
                <Sparkles size={16} className="inline mr-1 -mt-0.5" aria-hidden />
                {done.name} gained {done.xp} XP{done.to > done.from ? `: level ${done.from} → ${done.to}, overall ${done.ovFrom} → ${done.ovTo}` : ''}.
              </p>
            )}
            {err && <p className="text-wicket mt-3" role="alert">{err}</p>}
            <Button variant="ghost" className="mt-2 px-0" onClick={() => { pickTarget(''); setDone(null) }}>Train a different player</Button>
          </Panel>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase">2. Cards to give up</h2>
                <p className="text-muted text-sm">{sac.length}/{maxSac} selected. Cards in your saved squad are locked.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {copies.length > 0 && (
                  <Button variant="outline" onClick={() => setSac((s) => [...new Set([...s, ...copies.map((c) => c.id)])].slice(0, maxSac))}>
                    <Copy size={16} aria-hidden /> Add all {copies.length} cop{copies.length === 1 ? 'y' : 'ies'} (3× XP)
                  </Button>
                )}
                {sac.length > 0 && <Button variant="ghost" onClick={() => setSac([])}>Clear</Button>}
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={cn(controlClass, 'cursor-pointer')}>
                    <option value="xp">Most XP first</option>
                    <option value="overall">Lowest overall first</option>
                    <option value="form">Weakest form first</option>
                  </select>
                </label>
              </div>
            </div>
            {candidates.length === 0 ? (
              <EmptyState title="Nothing to sacrifice" body="Win matches to earn more cards." />
            ) : (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {candidates.map((c) => {
                  const locked = inSquad.has(c.id)
                  const chosen = sac.includes(c.id)
                  const same = c.playerId === t.playerId
                  return (
                    <div key={c.id} className="relative">
                      <PlayerCard
                        card={c}
                        className="w-full max-w-none"
                        selected={chosen}
                        disabled={locked || (!chosen && sac.length >= maxSac)}
                        status={locked ? 'In squad' : chosen ? 'Will be removed' : undefined}
                        onClick={() => toggle(c)}
                      />
                      {!locked && (
                        <span className={cn('absolute -top-2 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold shadow', same ? 'bg-cta text-cta-fg' : 'bg-card border border-border')}>
                          +{xpFor(c)} XP{same ? ' · same player' : ''}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {t.form && (
              <p className="text-sm text-muted mt-4 flex items-center gap-2"><TrendingUp size={16} aria-hidden /> {t.name}’s match form: <RatingBadge value={t.form.avg} className="text-sm px-1.5 py-0.5" /> over {t.form.matches} matches.</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
