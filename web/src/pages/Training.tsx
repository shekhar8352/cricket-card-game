import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { Button } from '../components/ui/button'
import { EmptyState, PageHeader, Panel, ProgressBar } from '../components/ui/chrome'

export function TrainingPage() {
  const [sp] = useSearchParams()
  const qc = useQueryClient()
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const [target, setTarget] = useState(sp.get('target') ?? '')
  const [sac, setSac] = useState<string[]>([])
  const [ask, setAsk] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const all = cards.data ?? []
  const t = all.find((c) => c.id === target)
  const preview = useMemo(() => {
    if (!t) return 0
    return sac.reduce((sum, id) => {
      const c = all.find((x) => x.id === id)
      if (!c) return sum
      let base = 40
      if (c.rarity === 'Silver') base = 55
      if (c.rarity === 'Gold') base = 80
      if (c.rarity === 'Legend') base = 120
      return sum + (c.playerId === t.playerId ? base * 3 : base)
    }, 0)
  }, [sac, t, all])

  async function confirm() {
    if (!t) return
    setBusy(true)
    setErr('')
    try {
      const r = await api.train(t.id, sac)
      setMsg(`${t.name} gained ${r.xpGained} XP and is now level ${r.card.level}.`)
      setSac([])
      setAsk(false)
      setTarget(r.card.id)
      qc.invalidateQueries({ queryKey: ['cards'] })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const capped = t && t.level >= (t.levelCap ?? 5)
  const xpNow = t ? Math.min(100, ((t.xp + preview) / (t.xpToNext || 80)) * 100) : 0

  return (
    <div>
      <PageHeader
        title="Training"
        lede="Step 1: choose who levels up. Step 2: sacrifice other cards for XP. A copy of the same player is worth 3×."
      />
      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Panel>
          <h2 className="font-display text-2xl font-semibold">1. Player to train</h2>
          {t ? <div className="mt-3"><PlayerCard card={t} size="lg" /></div> : <p className="text-muted mt-3">Tap a card on the right.</p>}
          {t && (
            <div className="mt-4">
              <ProgressBar value={xpNow} label="Experience after this training" />
              <p className="text-muted mt-2">About +{preview} XP from {sac.length} card{sac.length === 1 ? '' : 's'}.</p>
              {capped && <p className="text-wicket mt-2">This card is already at the level cap.</p>}
              <Button variant="ghost" className="mt-2 px-0" onClick={() => { setTarget(''); setSac([]); setAsk(false); setMsg('') }}>Choose a different player</Button>
            </div>
          )}
          {t && !ask && (
            <Button className="mt-4 w-full" disabled={!sac.length || !!capped} onClick={() => setAsk(true)}>Review sacrifice</Button>
          )}
          {ask && t && (
            <div className="mt-4 rounded-xl border border-border p-4" role="alertdialog" aria-labelledby="train-title">
              <h3 id="train-title" className="font-display text-2xl font-semibold">Sacrifice these cards?</h3>
              <p className="text-muted mt-1">This permanently removes {sac.length} card{sac.length === 1 ? '' : 's'} and adds about {preview} XP to {t.name}.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button variant="danger" disabled={busy} onClick={confirm}>{busy ? 'Training…' : 'Sacrifice'}</Button>
                <Button variant="outline" onClick={() => setAsk(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {msg && <p className="text-success mt-3" role="status">{msg}</p>}
          {err && <p className="text-wicket mt-3" role="alert">{err}</p>}
        </Panel>
        <div>
          <h2 className="font-display text-2xl font-semibold mb-1">2. Cards to give up</h2>
          <p className="text-muted mb-3">{t ? 'Tap cards to mark them. Tap again to keep them.' : 'Pick the player to train first. Their card will be marked.'}</p>
          {all.length === 0 && !cards.isPending ? (
            <EmptyState title="No cards to train" body="Earn cards from matches, then come back to level them up." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {all.map((c) => {
                const selected = c.id === target || sac.includes(c.id)
                return (
                  <div key={c.id} className="relative">
                    <PlayerCard
                      card={c}
                      className="w-full max-w-none"
                      selected={selected}
                      status={c.id === target ? 'Training' : sac.includes(c.id) ? 'Will be removed' : undefined}
                      onClick={() => {
                        setMsg('')
                        setAsk(false)
                        if (!target || c.id === target) {
                          setTarget(c.id === target ? '' : c.id)
                          setSac([])
                          return
                        }
                        setSac((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])
                      }}
                    />
                    {t && c.playerId === t.playerId && c.id !== t.id && (
                      <span className="absolute top-2 right-2 text-xs font-semibold bg-cta text-cta-fg rounded-full px-2 py-0.5">3× XP</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
