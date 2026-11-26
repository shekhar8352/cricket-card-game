import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { EmptyState, Panel } from '../components/ui/chrome'
import { RankPanel } from '../components/trophy/RankPanel'
import { PlayerCard } from '../components/card/PlayerCard'
import { matchPath, statusLabel } from '../lib/labels'
import { useUI } from '../store/ui'
import { useState } from 'react'
import { Flame, Handshake, ListOrdered, Play, Swords, Trophy, Users } from 'lucide-react'

export function HomePage() {
  const nav = useNavigate()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const hist = useQuery({ queryKey: ['matches'], queryFn: api.matches })
  const tours = useQuery({ queryKey: ['tournaments'], queryFn: api.tournaments })
  const tourToPlay = (tours.data ?? []).filter((t) => t.yourOpenMatches > 0 || t.status === 'LOBBY')
  const starter = useUI((s) => s.starter)
  const setStarter = useUI((s) => s.setStarter)
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState<'bot' | 'pvp' | null>(null)
  const [err, setErr] = useState('')
  const user = me.data?.user
  const best = (cards.data ?? []).slice().sort((a, b) => b.overall - a.overall).slice(0, 5)
  const recent = (hist.data ?? []).slice(0, 5)
  // Friendlies stay out of the record, like they do for trophies and streaks.
  const done = (hist.data ?? []).filter((m) => m.status === 'COMPLETE' && (!m.mode || m.mode === 'ranked'))
  const played = done.length
  const wins = done.filter((m) => m.winnerUserId === user?.id).length
  const streak = me.data?.streak
  const paused = (hist.data ?? []).filter((m) => m.status === 'INNINGS_BREAK' || m.status === 'SUPER_OVER')

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
          <h2 className="font-display text-3xl font-bold uppercase">Your starter pack <span className="text-cta">has arrived!</span></h2>
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

      <section className="hero-stadium rounded-3xl px-5 py-7 sm:px-8 sm:py-9">
        <div className="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#ffd166]">
              <Trophy size={14} aria-hidden /> {user?.arenaRank?.label ?? user?.arena ?? 'Bronze'} · {user?.arena ?? 'Bronze'} arena
            </p>
            <h1 className="font-display text-5xl sm:text-6xl font-bold uppercase leading-[0.95] mt-3">
              {user ? <>Your seven is <span className="text-[#ffd166] text-glow">ready</span></> : 'Loading your club…'}
            </h1>
            <p className="text-white/80 mt-3 max-w-md text-lg">Seven cards. Five overs. Every ball can swing it. Win to climb the arenas and earn new players.</p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Button className="min-h-14 px-7 text-2xl" disabled={!!busy} onClick={() => start('bot')}>
                <Play size={22} fill="currentColor" aria-hidden />
                {busy === 'bot' ? 'Starting…' : 'Quick match'}
              </Button>
              <Button variant="pitch" className="min-h-14 px-6 text-xl" disabled={!!busy} onClick={() => start('pvp')}>
                <Swords size={20} aria-hidden />
                {busy === 'pvp' ? 'Searching…' : 'Versus player'}
              </Button>
              <Button variant="outline" className="min-h-14 px-5 text-lg !bg-white/10 !border-white/25 text-white" disabled={!!busy} onClick={() => nav('/play#friendly')}>
                <Handshake size={20} aria-hidden /> Play friends
              </Button>
            </div>
            {err && <p className="text-[#ffb4b4] mt-3" role="alert">{err}</p>}
          </div>
          <div className="rounded-2xl bg-black/30 p-5 backdrop-blur-sm border border-white/10">
            {user?.arenaRank ? (
              <RankPanel rank={user.arenaRank} best={user.bestTrophies} compact />
            ) : (
              <p className="font-display text-6xl font-bold tabular leading-none text-[#ffd166]">{user?.trophies ?? '—'}</p>
            )}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              {[
                ['Played', String(played)],
                ['Won', String(wins)],
                ['Win %', played ? `${Math.round((wins / played) * 100)}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/10 py-2">
                  <div className="font-display text-2xl font-bold tabular">{v}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {paused.length > 0 && (
        <button type="button" onClick={() => nav(matchPath(paused[0]))} className="w-full text-left rounded-2xl border-2 border-cta/60 bg-cta/10 px-4 py-3 cursor-pointer game-tile">
          <p className="font-display text-xl font-bold">Your match vs {paused[0].opponent.name} is waiting for your call</p>
          <p className="text-sm text-muted">{statusLabel(paused[0].status)}. Tap to continue.</p>
        </button>
      )}

      {tourToPlay.map((t) => (
        <button key={t.id} type="button" onClick={() => nav(`/tournaments/${t.id}`)} className="w-full text-left rounded-2xl border-2 border-[#ffd166]/70 bg-[#ffd166]/10 px-4 py-3 cursor-pointer game-tile flex items-center gap-3">
          <Trophy size={24} className="text-[#b7791f] dark:text-[#ffd166] shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block font-display text-xl font-bold truncate">{t.name}</span>
            <span className="block text-sm text-muted">
              {t.status === 'LOBBY' ? `Waiting for players (${t.players} in). Tap to open the lobby.` : `${t.yourOpenMatches} match${t.yourOpenMatches === 1 ? '' : 'es'} for you to play. Tap to open.`}
            </span>
          </span>
        </button>
      ))}

      {streak && streak.current > 0 && (
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-cta/50 bg-gradient-to-r from-cta/15 to-transparent px-4 py-3">
          <Flame size={32} className="text-cta" aria-hidden />
          <div className="flex-1 min-w-[12rem]">
            <p className="font-display text-2xl font-bold">{streak.current}-win streak</p>
            <p className="text-sm text-muted">
              Next win: <b className="text-fg">+{streak.nextWinBonus} bonus trophies</b>{streak.nextWinBoosted ? ' and a boosted reward card' : ''}.
            </p>
          </div>
          <Button onClick={() => start('bot')} disabled={!!busy}>Keep it going</Button>
        </section>
      )}

      <section className="grid sm:grid-cols-3 gap-3">
        {[
          { Icon: Users, title: 'Pick your seven', body: '3 batters, a keeper, an all-rounder and 2 bowlers.' },
          { Icon: ListOrdered, title: 'Pick a captain', body: 'Your captain makes the calls. You set the batting and bowling order.' },
          { Icon: Flame, title: 'Call it at the break', body: 'Watch live, then make the call that wins the chase.' },
        ].map(({ Icon, title, body }, i) => (
          <Panel key={title} className="flex gap-3 items-start">
            <span className="grid place-items-center w-11 h-11 shrink-0 rounded-xl bg-accent/15 text-accent">
              <Icon size={22} aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold uppercase tracking-wide"><span className="text-cta mr-1">{i + 1}.</span>{title}</h2>
              <p className="text-muted text-sm mt-0.5">{body}</p>
            </div>
          </Panel>
        ))}
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="font-display text-3xl font-bold uppercase">Your best cards</h2>
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
          <h2 className="font-display text-3xl font-bold uppercase">Recent results</h2>
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
                  onClick={() => nav(matchPath(m))}
                  className="game-tile w-full text-left border border-border rounded-xl px-4 py-3 min-h-11 glass cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex justify-between gap-3 items-center">
                    <span className="font-semibold flex items-center gap-2">
                      {m.status === 'COMPLETE' && (
                        <span className={'grid place-items-center w-7 h-7 rounded-lg font-display font-bold text-white ' + (outcome === 'win' ? 'bg-[#12b76a]' : outcome === 'loss' ? 'bg-[#dc2626]' : 'bg-slate-500')} aria-hidden>
                          {outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'T'}
                        </span>
                      )}
                      vs {m.opponent.name}
                      {m.mode === 'friendly' && <span className="rounded bg-[#38bdf8]/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0284c7] dark:text-[#7dd3fc] align-middle">Friendly</span>}
                      {m.mode === 'tournament' && <span className="rounded bg-[#ffd166]/20 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#b7791f] dark:text-[#ffd166] align-middle">{m.tournamentName ?? 'Tournament'}</span>}
                    </span>
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
