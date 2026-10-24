import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { EmptyState, Panel, ProgressBar } from '../components/ui/chrome'
import { PlayerCard } from '../components/card/PlayerCard'
import { statusLabel } from '../lib/labels'
import { useUI } from '../store/ui'
import { useState } from 'react'

export function HomePage() {
  const nav = useNavigate()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const hist = useQuery({ queryKey: ['matches'], queryFn: api.matches })
  const starter = useUI((s) => s.starter)
  const setStarter = useUI((s) => s.setStarter)
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState<'bot' | 'pvp' | null>(null)
  const [err, setErr] = useState('')
  const user = me.data?.user
  const nextMin = user?.nextArenaMin ?? 400
  const prevMin = user?.arena === 'Bronze' ? 0 : nextMin > 0 ? Math.max(0, nextMin - 400) : 0
  const progress = user ? Math.min(100, ((user.trophies - prevMin) / Math.max(1, nextMin - prevMin)) * 100) : 0
  const best = (cards.data ?? []).slice().sort((a, b) => b.overall - a.overall).slice(0, 5)
  const recent = (hist.data ?? []).slice(0, 5)
  const toNext = user?.nextArenaMin != null ? Math.max(0, user.nextArenaMin - user.trophies) : null

  async function start(mode: 'bot' | 'pvp') {
    setBusy(mode)
    setErr('')
    try {
      const m = await api.createMatch(mode)
      nav(`/match/${m.id}/lineup`)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(null)
    }
  }

  return (
    <div className="space-y-8">
      {starter && (
        <Panel>
          <h2 className="font-display text-3xl font-semibold">Your starter pack</h2>
          <p className="text-muted mt-1 mb-4">Tap each card to turn it over. These players are yours to keep.</p>
          <div className="felt-tray flex flex-wrap gap-3">
            {starter.map((c, i) => (
              <PlayerCard key={c.id} card={c} hidden={!flipped[i]} placeholder="Tap to reveal" onClick={() => setFlipped((f) => ({ ...f, [i]: true }))} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" onClick={() => setFlipped(Object.fromEntries(starter.map((_, i) => [i, true])))}>Reveal all</Button>
            <Button onClick={() => setStarter(null)}>Continue</Button>
          </div>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">{user?.arena ?? 'Arena'} arena</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mt-1">
          {user ? `${user.trophies} trophies` : 'Loading your club…'}
        </h1>
        <p className="text-muted mt-2 max-w-xl">Win matches to move up. A match is seven cards and five overs.</p>
        <div className="mt-5 max-w-lg">
          <ProgressBar value={progress} label={user?.nextArena ? `Progress toward ${user.nextArena}` : 'Arena progress'} />
          <p className="text-sm text-muted mt-2">
            {user?.nextArena && toNext != null ? `${toNext} trophies to ${user.nextArena}` : 'You are in the top arena.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Button disabled={!!busy} onClick={() => start('bot')}>{busy === 'bot' ? 'Starting…' : 'Practice vs bot'}</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => start('pvp')}>{busy === 'pvp' ? 'Searching…' : 'Find a player'}</Button>
        </div>
        {err && <p className="text-wicket mt-3" role="alert">{err}</p>}
      </Panel>

      <section className="grid sm:grid-cols-3 gap-3">
        {[
          ['1. Squad', 'Three batters, one keeper, one all-rounder, two bowlers.'],
          ['2. Orders', 'Drag the batting order and assign every over.'],
          ['3. Match', 'Watch five overs, then train the cards you earn.'],
        ].map(([title, body]) => (
          <Panel key={title}>
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
            <p className="text-muted mt-1">{body}</p>
          </Panel>
        ))}
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="font-display text-3xl font-semibold">Best cards</h2>
          <Button variant="ghost" onClick={() => nav('/collection')}>View collection</Button>
        </div>
        {cards.isPending ? (
          <p className="text-muted">Loading cards…</p>
        ) : best.length === 0 ? (
          <EmptyState title="No cards yet" body="Create an account reward or open your collection after a match." />
        ) : (
          <div className="felt-tray flex gap-3 overflow-x-auto pb-2">
            {best.map((c) => <PlayerCard key={c.id} card={c} onClick={() => nav('/collection')} />)}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="font-display text-3xl font-semibold">Recent results</h2>
          <Button variant="ghost" onClick={() => nav('/history')}>All matches</Button>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No matches yet" body="Practice against a bot to learn the flow. Your results will show up here." action={<Button onClick={() => start('bot')}>Play your first match</Button>} />
        ) : (
          <div className="space-y-2">
            {recent.map((m) => {
              const outcome = m.result?.winner === 'tie' ? 'tie' : m.winnerUserId === user?.id ? 'win' : 'loss'
              const label = statusLabel(m.status, m.status === 'COMPLETE' ? outcome : undefined)
              const score = m.result ? `${m.result.innings[0]?.runs}/${m.result.innings[0]?.wickets} vs ${m.result.innings[1]?.runs}/${m.result.innings[1]?.wickets}` : ''
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => nav(m.status === 'COMPLETE' ? `/match/${m.id}/result` : `/match/${m.id}/lineup`)}
                  className="w-full text-left border border-border rounded-xl px-4 py-3 min-h-11 bg-card cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">vs {m.opponent.name}</span>
                    <span className={outcome === 'win' && m.status === 'COMPLETE' ? 'text-success font-semibold' : outcome === 'loss' && m.status === 'COMPLETE' ? 'text-wicket font-semibold' : 'text-muted'}>{label}</span>
                  </div>
                  {score && <div className="text-sm text-muted mt-1">{score}</div>}
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
