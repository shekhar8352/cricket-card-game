import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { Award, CalendarDays, Crown, Flame, Hand, LogOut, Medal, Shield, Target, Trophy, Zap } from 'lucide-react'
import { api, setToken } from '../api/client'
import { Button } from '../components/ui/button'
import { Choice, EmptyState, Panel, ProgressBar } from '../components/ui/chrome'
import { PlayerCard } from '../components/card/PlayerCard'
import { PlayerAvatar } from '../components/card/PlayerAvatar'
import { RatingBadge } from '../components/card/RatingBadge'
import { RARITY_RING, ROLE_LABEL } from '../lib/labels'
import { cn } from '../lib/cn'
import type { AccountStats, Rarity, StatPlayer, TeamScore } from '../types/engine'

type Tab = 'rated' | 'batting' | 'bowling' | 'fielding' | 'awards'

const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function AccountPage() {
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['me', 'stats'], queryFn: api.myStats })
  const [tab, setTab] = useState<Tab>('rated')

  function logout() {
    setToken(null)
    nav('/auth')
  }

  if (q.isPending) return <p className="text-muted">Loading your career…</p>
  if (q.isError || !q.data) return <EmptyState title="Couldn’t load your account" body={(q.error as Error)?.message ?? 'Please try again.'} action={<Button onClick={() => q.refetch()}>Retry</Button>} />

  const { account: a, collection, stats } = q.data
  const s = stats.summary
  const topBat = stats.batting[0]
  const topBowl = stats.bowling[0]
  const topField = stats.fielding[0]
  const topAward = stats.playerOfMatch[0]
  const prevMin = a.arena === 'Bronze' ? 0 : a.nextArenaMin ? Math.max(0, a.nextArenaMin - 400) : 0
  const progress = a.nextArenaMin ? ((a.trophies - prevMin) / Math.max(1, a.nextArenaMin - prevMin)) * 100 : 100

  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="hero-stadium rounded-3xl px-5 py-7 sm:px-8">
        <div className="relative z-10 flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <span className="grid place-items-center w-20 h-20 shrink-0 rounded-2xl bg-gradient-to-br from-[#ffc23d] to-[#ff7a1a] font-display text-4xl font-bold text-[#1a1205] shadow-[0_10px_30px_rgba(255,138,42,0.4)]" aria-hidden>
              {a.username.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Club captain</p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase leading-none truncate">{a.username}</h1>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-white/75 text-sm">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} aria-hidden /> Joined {date(a.createdAt)}</span>
                <span className="inline-flex items-center gap-1.5"><Shield size={15} aria-hidden /> {a.arena} arena</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-[26rem]">
            <HeroStat label="Trophies" value={String(a.trophies)} icon={<Trophy size={18} aria-hidden />} gold />
            <HeroStat label="Global rank" value={`#${a.rank}`} sub={`of ${a.totalPlayers} players`} icon={<Medal size={18} aria-hidden />} />
            <div className="col-span-2">
              <ProgressBar value={progress} label={a.nextArena ? `Progress toward ${a.nextArena}` : 'Arena progress'} />
              <p className="text-sm text-white/75 mt-1.5">
                {a.nextArena && a.nextArenaMin ? <><b className="text-white">{Math.max(0, a.nextArenaMin - a.trophies)}</b> trophies to {a.nextArena}</> : 'Top arena reached'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {s.played === 0 ? (
        <EmptyState
          title="Your career starts with one match"
          body="Play a match and this page fills up with your record, top run scorers, leading wicket takers and more."
          action={<Button onClick={() => nav('/play')}>Play your first match</Button>}
        />
      ) : (
        <>
          {/* Record */}
          <section aria-labelledby="record-h">
            <SectionTitle id="record-h">Career record</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Tile label="Played" value={s.played} sub={`${s.vsBots} quick · ${s.vsPlayers} vs players`} />
              <Tile label="Won" value={s.won} tone="good" />
              <Tile label="Lost" value={s.lost} tone="bad" sub={s.tied ? `${s.tied} tied` : undefined} />
              <Tile label="Win rate" value={`${Math.round(s.winRate * 100)}%`} />
              <Tile
                label="Current streak"
                value={s.currentStreak === 0 ? '—' : `${Math.abs(s.currentStreak)}${s.currentStreak > 0 ? 'W' : 'L'}`}
                tone={s.currentStreak > 0 ? 'good' : s.currentStreak < 0 ? 'bad' : undefined}
                sub={`Best: ${s.bestWinStreak} win${s.bestWinStreak === 1 ? '' : 's'} in a row`}
              />
              <Panel className="!p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Last {s.form.length}</p>
                <div className="flex gap-1 mt-2" aria-label={`Recent form: ${s.form.join(' ')}`}>
                  {s.form.map((f, i) => (
                    <span key={i} className={cn('grid place-items-center w-7 h-7 rounded-md font-display font-bold text-white', f === 'W' ? 'bg-[#12b76a]' : f === 'L' ? 'bg-[#dc2626]' : 'bg-slate-500')}>{f}</span>
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          {/* Leaders spotlight */}
          <section aria-labelledby="leaders-h">
            <SectionTitle id="leaders-h">Team leaders</SectionTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Spotlight label="Top run scorer" Icon={Flame} p={topBat} big={topBat && `${topBat.runs}`} unit="runs" line={topBat && `HS ${topBat.highScore}${topBat.highNotOut ? '*' : ''} · SR ${topBat.strikeRate.toFixed(0)} · ${topBat.sixes} sixes`} />
              <Spotlight label="Leading wicket taker" Icon={Target} p={topBowl} big={topBowl && `${topBowl.wickets}`} unit="wickets" line={topBowl && `Best ${topBowl.bestWickets}/${topBowl.bestRuns} · Econ ${topBowl.economy.toFixed(2)}`} />
              <Spotlight label="Safest hands" Icon={Hand} p={topField} big={topField && `${topField.total}`} unit="dismissals" line={topField && `${topField.catches} ct · ${topField.stumpings} st · ${topField.runOuts} ro`} />
              <Spotlight label="Most player of the match" Icon={Award} p={topAward} big={topAward && `${topAward.awards}`} unit="awards" line={topAward && `${topAward.matches} matches played`} />
            </div>
          </section>

          {/* Team records */}
          <section aria-labelledby="team-h">
            <SectionTitle id="team-h">Team records</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-3">
              <RecordCard label="Highest total" score={s.highestTotal} onOpen={(id) => nav(`/match/${id}/result`)} />
              <RecordCard label="Lowest total" score={s.lowestTotal} onOpen={(id) => nav(`/match/${id}/result`)} />
              <RecordCard label="Best bowling effort" note="fewest runs conceded" score={s.bestBowlingEffort} onOpen={(id) => nav(`/match/${id}/result`)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <Tile label="Team runs" value={s.teamRuns} />
              <Tile label="Wickets taken" value={s.wicketsTaken} />
              <Tile label="Fours" value={s.fours} />
              <Tile label="Sixes" value={s.sixes} />
            </div>
          </section>

          {/* Full tables */}
          <section aria-labelledby="tables-h">
            <SectionTitle id="tables-h">Player stats</SectionTitle>
            <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Stat category">
              <Choice pressed={tab === 'rated'} onClick={() => setTab('rated')}>Match ratings</Choice>
              <Choice pressed={tab === 'batting'} onClick={() => setTab('batting')}>Batting</Choice>
              <Choice pressed={tab === 'bowling'} onClick={() => setTab('bowling')}>Bowling</Choice>
              <Choice pressed={tab === 'fielding'} onClick={() => setTab('fielding')}>Fielding</Choice>
              <Choice pressed={tab === 'awards'} onClick={() => setTab('awards')}>Player of the match</Choice>
            </div>
            <StatTable data={q.data} tab={tab} />
          </section>
        </>
      )}

      {/* Collection */}
      <section aria-labelledby="coll-h">
        <SectionTitle id="coll-h">Collection</SectionTitle>
        <div className="grid lg:grid-cols-[1fr_auto] gap-3">
          <Panel>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Cards owned</p>
                <p className="font-display text-5xl font-bold tabular leading-none mt-1">{collection.total}</p>
              </div>
              <Button variant="outline" onClick={() => nav('/collection')}>View collection</Button>
            </div>
            <div className="mt-5 space-y-2.5">
              {(['Legend', 'Gold', 'Silver', 'Bronze'] as Rarity[]).map((r) => {
                const n = collection.byRarity[r] ?? 0
                return (
                  <div key={r} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="font-semibold">{r}</span>
                    <span className="h-2.5 rounded-full meter-track overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${collection.total ? (n / collection.total) * 100 : 0}%`, background: RARITY_RING[r] }} />
                    </span>
                    <span className="tabular text-right">{n}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-sm text-muted mt-4">
              {(['BAT', 'WK', 'AR', 'BOWL'] as const).map((r) => `${collection.byRole[r] ?? 0} ${ROLE_LABEL[r].toLowerCase()}${(collection.byRole[r] ?? 0) === 1 ? '' : 's'}`).join(' · ')}
            </p>
          </Panel>
          {collection.best && (
            <Panel className="flex flex-col items-center">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cta mb-3"><Crown size={14} aria-hidden /> Best card</p>
              <PlayerCard card={collection.best} />
            </Panel>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button variant="outline" onClick={logout}><LogOut size={16} aria-hidden /> Log out</Button>
      </div>
    </div>
  )
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="font-display text-2xl sm:text-3xl font-bold uppercase mb-3">{children}</h2>
}

function HeroStat({ label, value, sub, icon, gold }: { label: string; value: string; sub?: string; icon: ReactNode; gold?: boolean }) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/60">{icon}{label}</p>
      <p className={cn('font-display text-4xl font-bold tabular leading-none mt-1', gold && 'text-[#ffd166]')}>{value}</p>
      {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
    </div>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <Panel className="!p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn('font-display text-4xl font-bold tabular leading-none mt-1', tone === 'good' && 'text-success', tone === 'bad' && 'text-wicket')}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </Panel>
  )
}

function Spotlight({ label, Icon, p, big, unit, line }: { label: string; Icon: typeof Flame; p?: StatPlayer; big?: string; unit: string; line?: string }) {
  return (
    <Panel className="relative overflow-hidden">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cta"><Icon size={14} aria-hidden /> {label}</p>
      {p ? (
        <>
          <div className="flex items-center gap-3 mt-3">
            <PlayerAvatar name={p.name} rarity={p.rarity} size="lg" />
            <div className="min-w-0">
              <p className="font-display text-xl font-bold leading-tight truncate">{p.name}</p>
              <p className="text-sm text-muted">{p.country} · {ROLE_LABEL[p.role]}</p>
            </div>
          </div>
          <p className="mt-3 font-display tabular leading-none">
            <span className="text-5xl font-bold">{big}</span>
            <span className="text-lg text-muted ml-1.5">{unit}</span>
          </p>
          {line && <p className="text-sm text-muted mt-1">{line}</p>}
        </>
      ) : (
        <p className="text-muted mt-3">Nobody yet. Keep playing!</p>
      )}
    </Panel>
  )
}

function RecordCard({ label, note, score, onOpen }: { label: string; note?: string; score?: TeamScore; onOpen: (id: string) => void }) {
  if (!score) return <Tile label={label} value="—" />
  return (
    <button
      type="button"
      onClick={() => onOpen(score.matchId)}
      className="game-tile glass text-left rounded-2xl border border-border p-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}{note && <span className="normal-case tracking-normal font-normal"> · {note}</span>}</p>
      <p className="font-display text-4xl font-bold tabular leading-none mt-1">
        {score.runs}/{score.wickets}<span className="text-lg text-muted ml-1.5">({overs(score.balls)})</span>
      </p>
      <p className="text-sm text-muted mt-1 flex items-center gap-1.5"><Zap size={13} aria-hidden /> vs {score.opponent} · {date(score.playedAt)}</p>
    </button>
  )
}

function NameCell({ p, rank }: { p: StatPlayer; rank: number }) {
  return (
    <th scope="row" className="px-3 py-2.5 text-left font-medium">
      <span className="flex items-center gap-3">
        <span className={cn('w-6 text-center font-display font-bold tabular', rank === 1 ? 'text-cta' : 'text-muted')}>{rank}</span>
        <PlayerAvatar name={p.name} rarity={p.rarity} />
        <span className="min-w-0">
          <span className="block font-semibold truncate">{p.name}</span>
          <span className="block text-xs text-muted">{p.country} · {ROLE_LABEL[p.role]}</span>
        </span>
      </span>
    </th>
  )
}

function StatTable({ data, tab }: { data: AccountStats; tab: Tab }) {
  const { batting, bowling, fielding, playerOfMatch, rated } = data.stats
  const empty = { rated, batting, bowling, fielding, awards: playerOfMatch }[tab].length === 0
  if (empty) return <EmptyState title="No numbers yet" body="Play a few more matches to fill this table." />

  const th = 'px-3 py-2.5 font-semibold text-right whitespace-nowrap'
  const td = 'px-3 py-2.5 tabular text-right'
  return (
    <div className="overflow-x-auto rounded-2xl border border-border glass">
      <table className="w-full text-base min-w-[36rem]">
        <caption className="sr-only">{tab} stats</caption>
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted">
            <th scope="col" className="px-3 py-2.5 text-left font-semibold">Player</th>
            {tab === 'rated' && ['M', 'Avg rating', 'Best'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
            {tab === 'batting' && ['M', 'Inns', 'Runs', 'HS', 'Avg', 'SR', '4s', '6s', 'Rating'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
            {tab === 'bowling' && ['M', 'Overs', 'Wkts', 'Runs', 'Best', 'Econ', 'Avg', 'Rating'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
            {tab === 'fielding' && ['M', 'Catches', 'Stumpings', 'Run outs', 'Total'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
            {tab === 'awards' && ['M', 'Awards'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {tab === 'rated' && rated.map((p, i) => (
            <tr key={p.playerId} className="border-t border-border">
              <NameCell p={p} rank={i + 1} />
              <td className={td}>{p.matches}</td>
              <td className={td}><RatingBadge value={p.avgRating} className="text-lg px-2 py-1" /></td>
              <td className={td}>{p.bestRating.toFixed(1)}</td>
            </tr>
          ))}
          {tab === 'batting' && batting.map((b, i) => (
            <tr key={b.playerId} className="border-t border-border">
              <NameCell p={b} rank={i + 1} />
              <td className={td}>{b.matches}</td>
              <td className={td}>{b.innings}</td>
              <td className={cn(td, 'font-display text-xl font-bold')}>{b.runs}</td>
              <td className={td}>{b.highScore}{b.highNotOut ? '*' : ''}</td>
              <td className={td}>{b.outs ? b.average.toFixed(1) : '—'}</td>
              <td className={td}>{b.strikeRate.toFixed(1)}</td>
              <td className={td}>{b.fours}</td>
              <td className={td}>{b.sixes}</td>
              <td className={td}><RatingBadge value={b.avgRating} className="text-sm px-1.5 py-0.5" /></td>
            </tr>
          ))}
          {tab === 'bowling' && bowling.map((b, i) => (
            <tr key={b.playerId} className="border-t border-border">
              <NameCell p={b} rank={i + 1} />
              <td className={td}>{b.matches}</td>
              <td className={td}>{overs(b.balls)}</td>
              <td className={cn(td, 'font-display text-xl font-bold')}>{b.wickets}</td>
              <td className={td}>{b.runs}</td>
              <td className={td}>{b.bestWickets}/{b.bestRuns}</td>
              <td className={td}>{b.economy.toFixed(2)}</td>
              <td className={td}>{b.wickets ? b.average.toFixed(1) : '—'}</td>
              <td className={td}><RatingBadge value={b.avgRating} className="text-sm px-1.5 py-0.5" /></td>
            </tr>
          ))}
          {tab === 'fielding' && fielding.map((f, i) => (
            <tr key={f.playerId} className="border-t border-border">
              <NameCell p={f} rank={i + 1} />
              <td className={td}>{f.matches}</td>
              <td className={td}>{f.catches}</td>
              <td className={td}>{f.stumpings}</td>
              <td className={td}>{f.runOuts}</td>
              <td className={cn(td, 'font-display text-xl font-bold')}>{f.total}</td>
            </tr>
          ))}
          {tab === 'awards' && playerOfMatch.map((p, i) => (
            <tr key={p.playerId} className="border-t border-border">
              <NameCell p={p} rank={i + 1} />
              <td className={td}>{p.matches}</td>
              <td className={cn(td, 'font-display text-xl font-bold')}>{p.awards}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
