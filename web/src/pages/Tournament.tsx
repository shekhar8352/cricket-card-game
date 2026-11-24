import { useState, type ComponentType } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Award, Brain, Check, CircleDot, Copy, Crown, Flame, Gauge, Hand, LogOut, Medal, Mountain,
  Play, Rocket, Share2, Shield, Star, Target, Trophy, Users, Zap,
} from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { EmptyState, Panel } from '../components/ui/chrome'
import { PlayerAvatar } from '../components/card/PlayerAvatar'
import { cn } from '../lib/cn'
import { matchPath, tournamentStatusLabel } from '../lib/labels'
import type { Rarity, Tournament, TournamentAward, TournamentFixture, TournamentRow } from '../types/engine'

type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>

const AWARD_STYLE: Record<string, { Icon: Icon; tone: string }> = {
  orange_cap: { Icon: Crown, tone: 'text-[#f97316]' },
  purple_cap: { Icon: Crown, tone: 'text-[#a855f7]' },
  mvp: { Icon: Star, tone: 'text-[#facc15]' },
  player_of_tournament: { Icon: Award, tone: 'text-[#22c55e]' },
  highest_score: { Icon: Flame, tone: 'text-[#ef4444]' },
  best_bowling: { Icon: Target, tone: 'text-[#0ea5e9]' },
  most_sixes: { Icon: Rocket, tone: 'text-[#ec4899]' },
  most_fours: { Icon: Zap, tone: 'text-[#f59e0b]' },
  super_striker: { Icon: Gauge, tone: 'text-[#f43f5e]' },
  best_economy: { Icon: Shield, tone: 'text-[#14b8a6]' },
  most_dots: { Icon: CircleDot, tone: 'text-[#6366f1]' },
  best_fielder: { Icon: Hand, tone: 'text-[#84cc16]' },
  most_potm: { Icon: Medal, tone: 'text-[#eab308]' },
  best_captain: { Icon: Brain, tone: 'text-[#06b6d4]' },
  highest_total: { Icon: Mountain, tone: 'text-[#8b5cf6]' },
}

const POLL_MS = 4000

/** A tournament: lobby while players join, then the league, the knockouts and the awards. */
export function TournamentPage() {
  const { id = '' } = useParams()
  const q = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.tournament(id),
    refetchInterval: (query) => (['COMPLETE', 'CANCELLED'].includes(query.state.data?.status ?? '') ? false : POLL_MS),
  })

  if (q.isPending) return <p className="text-muted">Loading tournament…</p>
  if (q.isError || !q.data) {
    return <EmptyState title="Couldn’t load this tournament" body={(q.error as Error)?.message ?? 'Please try again.'} action={<Button onClick={() => q.refetch()}>Retry</Button>} />
  }
  const t = q.data
  if (t.status === 'CANCELLED') {
    return <EmptyState title="This tournament was cancelled" body="The host closed it before it started." action={<Link to="/play"><Button>Back to play</Button></Link>} />
  }

  return (
    <div className="space-y-6">
      <Link to="/play#friendly" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} aria-hidden /> Play
      </Link>
      <Hero t={t} />
      {t.status === 'LOBBY' ? (
        <Lobby t={t} />
      ) : (
        <>
          {t.honours && <Ceremony t={t} />}
          {t.status !== 'COMPLETE' && <YourMatches t={t} />}
          <div className="grid xl:grid-cols-[1.2fr_1fr] gap-4 items-start">
            <PointsTable t={t} />
            <Knockouts t={t} />
          </div>
          <LeagueFixtures t={t} />
        </>
      )}
    </div>
  )
}

function formatLine(n: number, t: Tournament) {
  const matches = (n * (n - 1)) / 2
  const ko = n >= t.playoffsFrom ? 'then the top 4 go into IPL-style playoffs' : 'then the top 2 meet in the final'
  return `${n} players: everyone plays everyone once (${matches} matches), ${ko}.`
}

function Hero({ t }: { t: Tournament }) {
  return (
    <section className="hero-stadium rounded-3xl px-5 py-7 sm:px-8">
      <div className="relative z-10">
        <p className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#ffd166]">
          <Trophy size={14} aria-hidden /> {tournamentStatusLabel(t.status)}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase leading-none mt-3 break-words">{t.name}</h1>
        <p className="text-white/80 mt-2">
          {t.status === 'LOBBY'
            ? formatLine(t.players.length, t)
            : t.format === 'playoffs'
              ? `${t.players.length} players · League, then playoffs: Qualifier 1, Eliminator, Qualifier 2 and the final.`
              : `${t.players.length} players · League, then a final between the top two.`}
        </p>
        <p className="text-sm text-white/60 mt-1">Friendly: no trophies, cards or XP. Win {t.pointsWin} points, tie {t.pointsTie}; level on points goes to net run rate.</p>
      </div>
    </section>
  )
}

function Lobby({ t }: { t: Tournament }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [busy, setBusy] = useState<'start' | 'leave' | null>(null)
  const [err, setErr] = useState('')
  const link = `${window.location.origin}/join/${t.code}`
  const canShare = typeof navigator.share === 'function'
  const short = t.minPlayers - t.players.length

  async function copy(what: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(what === 'code' ? t.code : link)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setErr('Couldn’t copy. Select the code and copy it yourself.')
    }
  }
  async function act(kind: 'start' | 'leave') {
    setBusy(kind)
    setErr('')
    try {
      if (kind === 'start') {
        qc.setQueryData(['tournament', t.id], await api.startTournament(t.id))
      } else {
        await api.leaveTournament(t.id)
        await qc.invalidateQueries({ queryKey: ['tournaments'] })
        nav('/play#friendly')
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
      <section className="rounded-3xl p-6 text-center text-white bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.3),transparent_60%),linear-gradient(160deg,#0b3a5c,#06141f)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60" id="t-code">Tournament code</p>
        <p aria-labelledby="t-code" className="font-display text-5xl sm:text-6xl font-bold tracking-[0.25em] pl-[0.25em] tabular select-all text-[#ffd166] text-glow mt-1">{t.code}</p>
        <p className="text-white/75 mt-2">Friends enter it on the Play page, or open the invite link.</p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Button onClick={() => copy('code')}>{copied === 'code' ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copied === 'code' ? 'Copied' : 'Copy code'}</Button>
          {canShare ? (
            <Button variant="pitch" onClick={() => navigator.share({ title: t.name, text: `Join my Pitch 7 tournament "${t.name}" with code ${t.code}`, url: link }).catch(() => {})}>
              <Share2 size={18} aria-hidden /> Share invite
            </Button>
          ) : (
            <Button variant="pitch" onClick={() => copy('link')}>{copied === 'link' ? <Check size={18} aria-hidden /> : <Share2 size={18} aria-hidden />} {copied === 'link' ? 'Link copied' : 'Copy invite link'}</Button>
          )}
        </div>
      </section>

      <Panel>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2"><Users size={20} aria-hidden /> Players</h2>
          <span className="text-sm text-muted tabular">{t.players.length}/{t.maxPlayers}</span>
        </div>
        <ul className="mt-3 grid sm:grid-cols-2 gap-2">
          {t.players.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
              <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#5ff0a8] to-[#1b8a5a] font-display font-bold text-[#04170d]" aria-hidden>{p.username.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold truncate">{p.username}</span>
                <span className="block text-xs text-muted">
                  {p.userId === t.hostUserId && <span className="font-bold uppercase text-cta"><Crown size={11} className="inline -mt-0.5" aria-hidden /> Host · </span>}
                  {p.trophies} trophies
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted mt-3" role="status">
          {short > 0 ? `Waiting for ${short} more player${short === 1 ? '' : 's'} (at least ${t.minPlayers}).` : t.youAreHost ? 'Start whenever everyone is in.' : 'Waiting for the host to start.'}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {t.youAreHost && (
            <Button disabled={short > 0 || !!busy} onClick={() => act('start')}>
              <Play size={18} fill="currentColor" aria-hidden /> {busy === 'start' ? 'Starting…' : 'Start tournament'}
            </Button>
          )}
          {t.youAreIn && (
            <Button variant="ghost" disabled={!!busy} onClick={() => act('leave')}>
              <LogOut size={16} aria-hidden /> {t.youAreHost ? 'Cancel tournament' : 'Leave'}
            </Button>
          )}
        </div>
        {err && <p className="text-wicket mt-2" role="alert">{err}</p>}
      </Panel>
    </div>
  )
}

function actionFor(f: TournamentFixture) {
  if (f.status === 'COMPLETE') return 'Result'
  if (f.status === 'LINEUP_PENDING') return 'Set lineup'
  if (f.status === 'INNINGS_BREAK' || f.status === 'SUPER_OVER') return 'Your call'
  return 'Watch live'
}

function YourMatches({ t }: { t: Tournament }) {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const mine = t.matches.filter((f) => f.yourSide && f.status !== 'COMPLETE')
  const open = t.matches.filter((f) => f.status !== 'COMPLETE').length
  const opp = (f: TournamentFixture) => (f.yourSide === 'home' ? f.away : f.home)

  async function autoplay() {
    setBusy(true)
    setErr('')
    try {
      qc.setQueryData(['tournament', t.id], await api.autoplayTournament(t.id))
      setConfirm(false)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="border-cta/50">
      <h2 className="font-display text-2xl font-bold uppercase">Your matches</h2>
      {mine.length === 0 ? (
        <p className="text-muted mt-1">{t.youAreIn ? 'Nothing to play right now. Waiting on other results.' : 'You’re watching this tournament.'}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {mine.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-muted">{f.label}</span>
                <span className="block font-semibold truncate">vs {opp(f)?.username}</span>
              </span>
              <Link to={matchPath(f)}>
                <Button variant={f.status === 'LINEUP_PENDING' ? 'primary' : 'outline'} className="shrink-0">{actionFor(f)}</Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {t.youAreHost && open > 0 && (
        <div className="mt-3 rounded-xl bg-black/5 dark:bg-white/5 p-3">
          <p className="text-sm text-muted">Someone holding things up? Play every open match now: anyone who hasn’t locked in uses their default team, and captains make the calls.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {confirm ? (
              <>
                <Button variant="danger" disabled={busy} onClick={autoplay}>{busy ? 'Playing…' : `Yes, play ${open} match${open === 1 ? '' : 'es'}`}</Button>
                <Button variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setConfirm(true)}>Auto-play open matches</Button>
            )}
          </div>
          {err && <p className="text-wicket mt-2" role="alert">{err}</p>}
        </div>
      )}
    </Panel>
  )
}

function PointsTable({ t }: { t: Tournament }) {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const myId = me.data?.user.id
  const nrr = (r: TournamentRow) => (r.nrr > 0 ? '+' : '') + r.nrr.toFixed(3)
  return (
    <Panel className="min-w-0 !p-0 overflow-hidden">
      <div className="px-4 pt-4 sm:px-5">
        <h2 className="font-display text-2xl font-bold uppercase">Points table</h2>
        <p className="text-sm text-muted">Top {t.qualifiers} {t.format === 'playoffs' ? 'go to the playoffs' : 'play the final'}.</p>
      </div>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-sm sm:text-base tabular">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
              <th scope="col" className="sticky left-0 z-10 bg-[var(--card-bg)] py-2 pl-4 pr-2 sm:pl-5">Team</th>
              {['P', 'W', 'L', 'T'].map((h) => <th key={h} scope="col" className="py-2 px-2 text-center">{h}</th>)}
              <th scope="col" className="py-2 px-2 text-center">Pts</th>
              <th scope="col" className="py-2 pl-2 pr-4 sm:pr-5 text-right">NRR</th>
            </tr>
          </thead>
          <tbody>
            {t.table.map((r) => {
              const q = r.position <= t.qualifiers
              return (
                <tr key={r.userId} className={cn('border-b border-border last:border-0', r.userId === myId && 'font-semibold')}>
                  <th scope="row" className={cn('sticky left-0 z-10 bg-[var(--card-bg)] py-2.5 pl-4 pr-2 sm:pl-5 text-left font-normal max-w-[10rem] sm:max-w-none', q && 'shadow-[inset_3px_0_0_var(--color-success,#12b76a)]')}>
                    <span className="flex items-center gap-2">
                      <span className="w-5 text-muted text-right shrink-0">{r.position}</span>
                      <Link to={`/players/${r.userId}`} className={cn('truncate hover:underline', r.userId === myId && 'font-semibold')}>{r.username}</Link>
                      {q && t.leagueDone && <span className="shrink-0 rounded bg-success/15 px-1 text-[10px] font-bold text-success" title="Qualified">Q</span>}
                    </span>
                  </th>
                  <td className="py-2.5 px-2 text-center">{r.played}</td>
                  <td className="py-2.5 px-2 text-center">{r.won}</td>
                  <td className="py-2.5 px-2 text-center">{r.lost}</td>
                  <td className="py-2.5 px-2 text-center">{r.tied}</td>
                  <td className="py-2.5 px-2 text-center font-bold">{r.points}</td>
                  <td className={cn('py-2.5 pl-2 pr-4 sm:pr-5 text-right', r.nrr > 0 ? 'text-success' : r.nrr < 0 ? 'text-wicket' : 'text-muted')}>{nrr(r)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/** The knockout fixtures in bracket order, with placeholders until the teams are known. */
function Knockouts({ t }: { t: Tournament }) {
  const ko = Object.fromEntries(t.matches.filter((f) => f.stage !== 'league').map((f) => [f.stage, f]))
  const slots: { stage: string; title: string; pending: string; note?: string }[] =
    t.format === 'playoffs'
      ? [
          { stage: 'qualifier1', title: 'Qualifier 1', pending: '1st v 2nd', note: 'Winner to the final, loser gets another go in Qualifier 2.' },
          { stage: 'eliminator', title: 'Eliminator', pending: '3rd v 4th', note: 'Loser is out.' },
          { stage: 'qualifier2', title: 'Qualifier 2', pending: 'Q1 loser v Eliminator winner', note: 'Winner to the final.' },
          { stage: 'final', title: 'Final', pending: 'Q1 winner v Q2 winner' },
        ]
      : [{ stage: 'final', title: 'Final', pending: '1st v 2nd' }]
  return (
    <Panel className="min-w-0">
      <h2 className="font-display text-2xl font-bold uppercase">{t.format === 'playoffs' ? 'Playoffs' : 'Final'}</h2>
      <div className={cn('grid gap-3 mt-3', t.format === 'playoffs' && 'sm:grid-cols-2')}>
        {slots.map((s) => (
          <KnockoutCard key={s.stage} title={s.title} f={ko[s.stage]} pending={s.pending} note={s.note} final={s.stage === 'final'} />
        ))}
      </div>
    </Panel>
  )
}

function KnockoutCard({ title, f, pending, note, final }: { title: string; f?: TournamentFixture; pending: string; note?: string; final?: boolean }) {
  const side = (s: 'home' | 'away') => {
    const u = s === 'home' ? f?.home : f?.away
    const won = !!f?.winnerUserId && f.winnerUserId === u?.userId
    return (
      <div className={cn('flex items-center justify-between gap-2', won && 'font-bold')}>
        <span className="truncate">{won && <Check size={14} className="inline -mt-0.5 mr-1 text-success" aria-label="Winner" />}{u?.username}</span>
        <span className="tabular text-sm text-muted shrink-0">{f?.score?.[s] ?? ''}</span>
      </div>
    )
  }
  return (
    <div className={cn('rounded-xl border px-3 py-3', final ? 'border-[#ffd166]/70 bg-[#ffd166]/10 sm:col-span-2' : 'border-border')}>
      <p className={cn('text-xs font-bold uppercase tracking-wider', final ? 'text-[#b7791f] dark:text-[#ffd166]' : 'text-muted')}>{final && <Trophy size={12} className="inline -mt-0.5 mr-1" aria-hidden />}{title}</p>
      {f ? (
        <div className="mt-1.5 space-y-1">
          {side('home')}
          {side('away')}
          {f.status === 'COMPLETE' ? (
            <p className="text-xs text-muted">{f.wonOnTable ? 'Still tied after the Super Over: the higher league finisher goes through.' : f.margin}</p>
          ) : (
            <p className="text-xs text-cta font-semibold">{f.status === 'LINEUP_PENDING' ? 'Waiting for lineups' : 'In progress'}</p>
          )}
          {f.yourSide && <Link to={matchPath(f)} className="inline-block text-sm font-semibold underline mt-1">{actionFor(f)}</Link>}
        </div>
      ) : (
        <p className="mt-1.5 text-muted">{pending}</p>
      )}
      {note && <p className="text-[11px] text-muted mt-1.5">{note}</p>}
    </div>
  )
}

function LeagueFixtures({ t }: { t: Tournament }) {
  const league = t.matches.filter((f) => f.stage === 'league')
  const done = league.filter((f) => f.status === 'COMPLETE').length
  return (
    <details className="group rounded-2xl border border-border bg-card/70" open={!t.leagueDone}>
      <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 flex items-center justify-between gap-2">
        <span className="font-display text-2xl font-bold uppercase">League fixtures</span>
        <span className="text-sm text-muted tabular">{done}/{league.length} played</span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {league.map((f) => {
          const winner = f.winnerUserId
          const name = (u?: { userId: string; username: string }) => (
            <span className={cn('truncate', winner && winner === u?.userId && 'font-bold')}>{u?.username}</span>
          )
          return (
            <li key={f.id} className={cn('px-4 py-2.5 sm:px-5 grid grid-cols-[4.5rem_1fr] sm:grid-cols-[5rem_1fr_auto] gap-x-3 gap-y-0.5 items-center', f.yourSide && 'bg-cta/5')}>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">{f.label}</span>
              <span className="min-w-0 flex items-center gap-1.5">{name(f.home)}<span className="text-muted text-sm shrink-0">v</span>{name(f.away)}</span>
              <span className="col-start-2 sm:col-start-3 text-sm text-muted sm:text-right">
                {f.status === 'COMPLETE' ? (
                  <span className="tabular">{f.score?.home} · {f.score?.away}</span>
                ) : f.yourSide ? (
                  <Link to={matchPath(f)} className="font-semibold text-cta underline">{actionFor(f)}</Link>
                ) : (
                  'To play'
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function Ceremony({ t }: { t: Tournament }) {
  const h = t.honours!
  return (
    <>
      <section className="relative overflow-hidden rounded-3xl px-5 py-8 text-center text-white bg-[radial-gradient(ellipse_at_top,rgba(255,209,102,0.4),transparent_60%),linear-gradient(160deg,#3b2a06,#120c02)] fade-up">
        <Trophy size={56} className="mx-auto text-[#ffd166] drop-shadow-[0_0_22px_rgba(255,209,102,0.6)]" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70 mt-3">Champions</p>
        <h2 className="font-display text-5xl sm:text-6xl font-bold uppercase leading-none mt-1 text-[#ffd166] text-glow break-words">{h.champion.username}</h2>
        <p className="text-white/80 mt-2">Runner-up: <b>{h.runnerUp.username}</b></p>
        <ol className="flex flex-wrap justify-center gap-2 mt-5">
          {h.placings.map((p, i) => (
            <li key={p.userId} className="rounded-full bg-white/10 px-3 py-1 text-sm"><span className="tabular text-white/60 mr-1">{i + 1}.</span>{p.username}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="awards-h">
        <h2 id="awards-h" className="font-display text-3xl font-bold uppercase mb-3">Awards</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {h.awards.map((a) => <AwardCard key={a.code} a={a} />)}
        </div>
      </section>
    </>
  )
}

function AwardCard({ a }: { a: TournamentAward }) {
  const { Icon, tone } = AWARD_STYLE[a.code] ?? { Icon: Award, tone: 'text-cta' }
  return (
    <Panel className="flex gap-3 items-start">
      <span className={cn('grid place-items-center w-11 h-11 shrink-0 rounded-xl bg-black/5 dark:bg-white/10', tone)}><Icon size={24} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-xs font-bold uppercase tracking-wider', tone)}>{a.title}</p>
        <div className="flex items-center gap-2 mt-1">
          {a.cardName && <PlayerAvatar name={a.cardName} rarity={a.rarity as Rarity} />}
          <div className="min-w-0">
            <p className="font-display text-xl font-bold leading-tight truncate">{a.cardName ?? a.username}</p>
            <p className="text-xs text-muted truncate">{a.cardName ? `${a.username}’s team` : a.blurb}</p>
          </div>
        </div>
        <p className="font-display text-2xl font-bold tabular mt-1">{a.value}</p>
        {a.detail && <p className="text-xs text-muted">{a.detail}</p>}
        {a.cardName && <p className="text-[11px] text-muted mt-0.5">{a.blurb}</p>}
      </div>
    </Panel>
  )
}
