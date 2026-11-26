import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { Button } from '../components/ui/button'
import { Panel } from '../components/ui/chrome'
import { useState } from 'react'
import { Award, Brain, Crown, Flame, Handshake, Sparkles, Target, Trophy } from 'lucide-react'
import { cn } from '../lib/cn'
import { ratingBand } from '../lib/ratings'
import { STAGE_LABEL } from '../lib/labels'
import { RatingBadge } from '../components/card/RatingBadge'
import { PlayerAvatar } from '../components/card/PlayerAvatar'
import type { PlayerCard as Card, ResultExtras } from '../types/engine'
import { ArenaBadge } from '../components/trophy/ArenaBadge'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function ResultPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const match = useQuery({ queryKey: ['match', id], queryFn: () => api.match(id!) })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const [flip, setFlip] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState(false)
  const m = match.data
  const res = m?.result
  const model = useQuery({ queryKey: ['engine-model'], queryFn: api.engineModel, staleTime: Infinity })
  if (!m || !res) return <p className="text-muted">Loading the scorecard…</p>
  const inTournament = m.mode === 'tournament' && !!m.tournamentId
  const tournamentLink = `/tournaments/${m.tournamentId}`
  const tournamentName = m.tournamentName
  const friendly = m.mode === 'friendly' || inTournament
  const youWon = m.winnerUserId === me.data?.user.id || (m.isBot && res.winner === (m.youAreHome ? 'home' : 'away'))
  const tie = res.winner === 'tie'
  const delta = m.youAreHome ? m.trophyDeltaHome : m.trophyDeltaAway
  const cards = [...(m.homeLineup?.cards ?? []), ...(m.awayLineup?.cards ?? [])]
  const name = (cardId: string) => cards.find((c) => c.id === cardId)?.name ?? 'Player'
  const yourSide = m.youAreHome ? 'home' : 'away'
  const sideName = (side: string) => (side === yourSide ? me.data?.user.username ?? 'You' : m.opponent.name)
  const winnerName = tie ? '' : sideName(res.winner)
  const cardOf = (cardId: string) => cards.find((c) => c.id === cardId)
  const allBat = res.innings.flatMap((inn) => inn.batters)
  const allBowl = res.innings.flatMap((inn) => inn.bowlers)
  const topBat = allBat.slice().sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0]
  const topBowl = allBowl.slice().sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0]
  const potm = res.playerOfMatch ? cardOf(res.playerOfMatch) : undefined
  const potmBat = allBat.find((b) => b.cardId === res.playerOfMatch && b.balls > 0)
  const potmBowl = allBowl.find((b) => b.cardId === res.playerOfMatch && b.balls > 0)
  const potmLine = [potmBat && `${potmBat.runs} (${potmBat.balls})`, potmBowl && `${potmBowl.wickets}/${potmBowl.runs}`].filter(Boolean).join(' & ') || 'Match-winning impact'
  const trophy = (delta ?? 0) > 0 ? `Gained ${delta} trophies` : (delta ?? 0) < 0 ? `Lost ${Math.abs(delta ?? 0)} trophies` : 'Trophies unchanged'

  const worm = (res.balls ?? []).reduce<{ ball: number; First: number; Second: number }[]>((acc, b) => {
    const last = acc[acc.length - 1] ?? { ball: 0, First: 0, Second: 0 }
    const next = { ball: acc.length + 1, First: last.First, Second: last.Second }
    if (b.innings === 0) next.First = b.score
    else next.Second = b.score
    acc.push(next)
    return acc
  }, [])

  const ex = res.extras
  const myLineup = m.youAreHome ? m.homeLineup : m.awayLineup
  const captain = cards.find((c) => c.id === myLineup?.captainId)
  const myCall = res.breakCalls?.[yourSide]
  const callDef = model.data?.breakCalls.find((c) => c.code === myCall)
  const strokesUsed = res.innings.flatMap((inn) => (inn.calls ?? []).filter((c) => c.masterstroke && ((c.masterstrokeBy === 'bat' && inn.battingSide === yourSide) || (c.masterstrokeBy === 'bowl' && inn.bowlingSide === yourSide))).map((c) => ({ ...c, innings: inn })))
  const theirStrokes = res.innings.flatMap((inn) => (inn.calls ?? []).filter((c) => c.masterstroke && !((c.masterstrokeBy === 'bat' && inn.battingSide === yourSide) || (c.masterstrokeBy === 'bowl' && inn.bowlingSide === yourSide))))
  const cond = model.data?.conditions.find((c) => c.code === res.conditions)
  const streakBonus = ex?.streakBonus?.[yourSide] ?? 0

  function captaincyReport() {
    return (
      <section className="grid md:grid-cols-2 gap-3">
        <Panel>
          <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2"><Crown size={20} className="text-cta" aria-hidden /> Captain’s report</h2>
          {captain && <p className="text-muted">{captain.name} led {sideName(yourSide)}.</p>}
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-2"><Brain size={16} className="text-success shrink-0 mt-0.5" aria-hidden /><span><b>{ex?.reads?.[yourSide] ?? 0} good reads</b> <span className="text-muted">(overs where your captain’s call beat theirs; they managed {ex?.reads?.[yourSide === 'home' ? 'away' : 'home'] ?? 0})</span></span></li>
            {callDef && <li className="flex gap-2"><Target size={16} className="text-cta shrink-0 mt-0.5" aria-hidden /><span>Break call: <b>{callDef.name}</b> <span className="text-muted">{callDef.description}</span></span></li>}
            {strokesUsed.map((c, i) => (
              <li key={i} className="flex gap-2"><Sparkles size={16} className="text-cta shrink-0 mt-0.5" aria-hidden /><span>Masterstroke <b>{c.masterstroke}</b> in over {c.over + 1} of the {c.innings.battingSide === yourSide ? 'innings you batted' : 'innings you bowled'}.</span></li>
            ))}
            {strokesUsed.length === 0 && <li className="flex gap-2 text-muted"><Sparkles size={16} className="shrink-0 mt-0.5" aria-hidden />Your captain kept the masterstroke in reserve.</li>}
            {theirStrokes.length > 0 && <li className="flex gap-2 text-muted"><Sparkles size={16} className="shrink-0 mt-0.5" aria-hidden />They played {theirStrokes.map((c) => c.masterstroke).join(', ')}.</li>}
            {cond && <li className="flex gap-2 text-muted"><Flame size={16} className="shrink-0 mt-0.5" aria-hidden />Second-innings twist: {cond.name}.</li>}
          </ul>
          {(ex?.repGained?.[yourSide] ?? 0) > 0 && captain && (
            <p className="mt-3 rounded-xl bg-cta/10 border border-cta/40 px-3 py-2 text-sm"><b>+{ex?.repGained?.[yourSide]} reputation</b> for {captain.name} as captain. Every 10 points adds +1 to their Tactics.</p>
          )}
        </Panel>
        {friendly ? (
        <Panel>
          <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2"><Handshake size={20} className="text-[#38bdf8]" aria-hidden /> Friendly</h2>
          <p className="text-muted mt-1">
            {inTournament ? <>This result counts in <Link to={tournamentLink} className="underline font-semibold">{tournamentName}</Link>. </> : 'Played for bragging rights. '}
            The result is saved to both histories; trophies, cards, XP, captain reputation and streaks are unchanged.
          </p>
        </Panel>
        ) : (
        <Panel>
          <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2"><Flame size={20} className="text-cta" aria-hidden /> Streak</h2>
          {youWon && ex?.streak?.[yourSide] ? (
            <>
              <p className="font-display text-5xl font-bold tabular mt-1">{ex.streak[yourSide]}<span className="text-xl text-muted ml-2">win{ex.streak[yourSide] === 1 ? '' : 's'} in a row</span></p>
              {streakBonus > 0 && <p className="mt-1 text-success font-semibold">+{streakBonus} bonus trophies included above.</p>}
              {ex.boosted?.[yourSide] && <p className="text-sm mt-1">Streak reward: one of your new cards was rolled with the next arena’s odds.</p>}
              <p className="text-sm text-muted mt-2">Win the next one for +{model.data?.streak.bonus[String(Math.min(5, ex.streak[yourSide] + 1))] ?? 0} bonus trophies.</p>
            </>
          ) : (
            <p className="text-muted mt-1">{tie ? 'A tie keeps nothing going.' : 'Streak reset.'} Win 2 in a row for bonus trophies; 3 in a row also boosts your reward cards.</p>
          )}
        </Panel>
        )}
      </section>
    )
  }

  async function again() {
    setBusy(true)
    try {
      if (inTournament) {
        nav(tournamentLink)
        return
      }
      const next = friendly ? await api.createRoom() : await api.createMatch('bot')
      nav(`/match/${next.id}/lineup`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className={cn('relative overflow-hidden rounded-3xl px-5 py-8 sm:py-10 text-center text-white fade-up', tie ? 'bg-[linear-gradient(160deg,#334155,#0f172a)]' : youWon ? 'hero-stadium' : 'bg-[radial-gradient(ellipse_at_top,rgba(255,107,107,0.35),transparent_60%),linear-gradient(160deg,#3b0d12,#12060a)]')}>
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">{inTournament ? `${m.tournamentName} · ${STAGE_LABEL[m.stage ?? ''] ?? 'Tournament'}` : friendly ? 'Friendly' : m.isBot ? 'Quick match' : 'Versus player'} · vs {m.opponent.name}</p>
          <h1 className={cn('font-display text-6xl sm:text-8xl font-bold uppercase leading-none mt-2', youWon && 'text-[#ffd166] text-glow')}>
            {tie ? 'Tied!' : youWon ? 'Victory!' : 'Defeat'}
          </h1>
          <p className="font-display text-2xl sm:text-3xl font-semibold mt-2">{tie ? 'Scores level after 5 overs' : `${winnerName} ${res.margin}`}</p>
          {friendly ? (
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mt-4 font-display text-xl font-bold bg-white/10">
              {inTournament ? <Trophy size={20} aria-hidden /> : <Handshake size={20} aria-hidden />} {inTournament ? 'Tournament' : 'Friendly'} · no trophies
            </div>
          ) : (
          <div className={cn('inline-flex items-center gap-2 rounded-full px-4 py-1.5 mt-4 font-display text-2xl font-bold', (delta ?? 0) > 0 ? 'bg-[#ffd166] text-[#1a1205]' : (delta ?? 0) < 0 ? 'bg-white/15' : 'bg-white/10')}>
            <Trophy size={20} aria-hidden /> {(delta ?? 0) > 0 ? `+${delta}` : (delta ?? 0) < 0 ? `${delta}` : '±0'}
            <span className="sr-only">{trophy}</span>
          </div>
          )}
          {!friendly && <RankChange ex={ex} side={yourSide} />}
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mt-6">
            {res.innings.map((inn, i) => (
              <div key={i} className="rounded-2xl bg-black/25 border border-white/10 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60 truncate">{sideName(inn.battingSide)}</p>
                <p className="font-display text-4xl font-bold tabular leading-none mt-1">{inn.runs}/{inn.wickets}</p>
                <p className="text-sm text-white/60 tabular">{Math.floor(inn.balls / 6)}.{inn.balls % 6} overs</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Button className="min-h-13 px-7 text-xl" disabled={busy} onClick={again}>{busy ? 'Starting…' : inTournament ? 'Back to tournament' : friendly ? 'New room' : youWon ? 'Keep the streak going' : 'Rematch'}</Button>
            <Button variant="outline" className="!bg-white/10 !border-white/25 text-white" onClick={() => nav(`/match/${id}/live`)}>Watch replay</Button>
            <Button variant="ghost" className="text-white hover:!bg-white/10" onClick={() => nav('/')}>Home</Button>
          </div>
        </div>
      </section>

      {captaincyReport()}

      {res.superOver && (
        <Panel className="border-six/60">
          <h2 className="font-display text-2xl font-bold uppercase text-six">Super Over</h2>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {res.superOver.innings.map((inn, i) => (
              <div key={i}>
                <p className="text-sm text-muted">{sideName(inn.battingSide)}</p>
                <p className="font-display text-3xl font-bold tabular">{inn.runs}/{inn.wickets}</p>
                <p className="text-xs text-muted">{inn.batters.filter((b) => b.balls > 0).map((b) => `${name(b.cardId)} ${b.runs} (${b.balls})`).join(', ')}</p>
              </div>
            ))}
          </div>
          <p className="text-sm mt-2">{res.superOver.winner === 'tie' ? 'Still tied after the Super Over.' : `${sideName(res.superOver.winner)} won on ${res.superOver.decider}.`}</p>
        </Panel>
      )}

      <section className="grid sm:grid-cols-3 gap-3">
        {potm && <Performer label="Player of the match" Icon={Award} card={potm} line={potmLine} highlight />}
        {topBat && <Performer label="Top scorer" Icon={Flame} card={cardOf(topBat.cardId)} line={`${topBat.runs} (${topBat.balls}) · ${topBat.fours}×4 ${topBat.sixes}×6`} />}
        {topBowl && <Performer label="Best bowling" Icon={Target} card={cardOf(topBowl.cardId)} line={`${topBowl.wickets}/${topBowl.runs} (${Math.floor(topBowl.balls / 6)}.${topBowl.balls % 6})`} />}
      </section>

      {m.ratings && (
        <section>
          <h2 className="font-display text-3xl font-bold uppercase mb-1">Player ratings</h2>
          <p className="text-muted mb-3">Every player is rated from 3.0 to 10.0 on this match. {friendly ? 'Friendlies don’t award XP.' : <>Your cards also earned XP: a little for playing, more for a strong rating{m.xpEarned && !youWon ? ', plus the consolation XP for a loss or tie' : ''}.</>} <Link to="/engine#ratings" className="underline">How ratings work</Link></p>
          <div className="grid md:grid-cols-2 gap-4">
            {([['home', m.homeLineup?.cards ?? []], ['away', m.awayLineup?.cards ?? []]] as const).map(([side, teamCards]) => {
              const mine = (side === 'home') === m.youAreHome
              const rows = teamCards.map((c) => ({ c, r: m.ratings?.[c.id] ?? 0 })).sort((a, b) => b.r - a.r)
              return (
                <Panel key={side}>
                  <h3 className="font-display text-xl font-bold uppercase mb-2">{sideName(side)}{mine && <span className="ml-2 rounded bg-cta px-1.5 text-[11px] font-bold text-cta-fg align-middle">YOU</span>}</h3>
                  <ol className="divide-y divide-border">
                    {rows.map(({ c, r }) => (
                      <li key={c.id} className="flex items-center gap-3 py-2">
                        <PlayerAvatar name={c.name} rarity={c.rarity} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{c.name}{c.id === res.playerOfMatch && <Award size={14} className="inline ml-1 text-cta" aria-label="player of the match" />}</p>
                          <p className="text-xs text-muted">{ratingBand(r).label}</p>
                        </div>
                        {mine && m.xpEarned?.[c.id] != null && <span className="text-sm font-bold text-success tabular">+{m.xpEarned[c.id]} XP</span>}
                        <RatingBadge value={r} className="text-lg px-2 py-1 min-w-12" />
                      </li>
                    ))}
                  </ol>
                </Panel>
              )
            })}
          </div>
        </section>
      )}

      {m.rewards && m.rewards.length > 0 && (
        <section>
          <h2 className="font-display text-3xl font-bold uppercase mb-1">New cards <span className="text-cta">unlocked!</span></h2>
          <p className="text-muted mb-3">Tap a card to reveal it, then train it if you want it to level up.</p>
          <div className="felt-tray flex flex-wrap gap-4">
            {m.rewards.map((c, i) => (
              <PlayerCard key={c.id} card={c} hidden={!flip[i]} placeholder="Tap to reveal" onClick={() => setFlip((f) => ({ ...f, [i]: true }))} />
            ))}
          </div>
          <Button className="mt-4" variant="outline" onClick={() => nav('/training')}>Train a player</Button>
        </section>
      )}

      {res.innings.map((inn, i) => (
        <Panel key={i} className="overflow-x-auto">
          <h2 className="font-display text-2xl font-semibold mb-3">
            {sideName(inn.battingSide)} · {inn.runs}/{inn.wickets} <span className="text-muted text-lg">({Math.floor(inn.balls / 6)}.{inn.balls % 6} ov)</span>
          </h2>
          <table className="w-full text-base">
            <caption className="sr-only">Batting</caption>
            <thead><tr className="text-muted text-left"><th scope="col" className="py-2">Batter</th><th scope="col">Runs</th><th scope="col">Balls</th><th scope="col">Fours</th><th scope="col">Sixes</th><th scope="col">How out</th></tr></thead>
            <tbody>
              {inn.batters.map((b) => (
                <tr key={b.cardId} className="border-t border-border">
                  <th scope="row" className="py-2 text-left font-medium">{name(b.cardId)}</th>
                  <td className="tabular">{b.runs}</td>
                  <td className="tabular">{b.balls}</td>
                  <td className="tabular">{b.fours}</td>
                  <td className="tabular">{b.sixes}</td>
                  <td className="text-muted text-sm">{b.dismissal?.text ?? (b.notOut ? 'not out' : '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-muted mt-2">Extras: {inn.byes} byes, {inn.wides} wides, {inn.noBalls} no-balls</p>
          <table className="w-full text-base mt-4">
            <caption className="sr-only">Bowling</caption>
            <thead><tr className="text-muted text-left"><th scope="col" className="py-2">Bowler</th><th scope="col">Overs</th><th scope="col">Runs</th><th scope="col">Wickets</th></tr></thead>
            <tbody>
              {inn.bowlers.map((b) => (
                <tr key={b.cardId} className="border-t border-border">
                  <th scope="row" className="py-2 text-left font-medium">{name(b.cardId)}</th>
                  <td className="tabular">{b.overs}</td>
                  <td className="tabular">{b.runs}</td>
                  <td className="tabular">{b.wickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-base mt-4">
            <caption className="sr-only">Fielding</caption>
            <thead><tr className="text-muted text-left"><th scope="col" className="py-2">Fielder</th><th scope="col">Catches</th><th scope="col">Stumpings</th><th scope="col">Run outs</th><th scope="col">Drops</th><th scope="col">Runs saved</th></tr></thead>
            <tbody>
              {inn.fielders.filter((f) => f.catches + f.stumpings + f.runOuts + f.drops + f.runsSaved > 0).map((f) => (
                <tr key={f.cardId} className="border-t border-border">
                  <th scope="row" className="py-2 text-left font-medium">{name(f.cardId)}{f.isKeeper ? ' (keeper)' : ''}</th>
                  <td>{f.catches}</td><td>{f.stumpings}</td><td>{f.runOuts}</td><td>{f.drops}</td><td>{f.runsSaved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <h2 className="font-display text-2xl font-semibold mb-2">Run comparison</h2>
          <p className="text-sm text-muted mb-2">{sideName(res.innings[0].battingSide)} in green, {sideName(res.innings[1].battingSide)} in orange.</p>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={worm}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="ball" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line dataKey="First" name={sideName(res.innings[0].battingSide)} stroke="var(--accent-bright)" dot={false} />
                <Line dataKey="Second" name={sideName(res.innings[1].battingSide)} stroke="var(--cta)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl font-semibold mb-2">Innings totals</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={res.innings.map((inn) => ({ name: sideName(inn.battingSide), Runs: inn.runs }))}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="Runs" fill="var(--accent-bright)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Performer({ label, Icon, card, line, highlight }: { label: string; Icon: typeof Award; card?: Card; line: string; highlight?: boolean }) {
  if (!card) return null
  return (
    <Panel className={cn('flex items-center gap-4', highlight && 'border-cta/60 bg-cta/10')}>
      <PlayerCard card={card} size="sm" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cta"><Icon size={14} aria-hidden /> {label}</p>
        <p className="font-display text-2xl font-bold leading-tight mt-1">{card.name}</p>
        <p className="text-muted tabular">{line}</p>
      </div>
    </Panel>
  )
}

/** Rank change after a ranked match: promotion, demotion, buffer protection, new best, milestone cards. */
function RankChange({ ex, side }: { ex?: ResultExtras; side: string }) {
  const after = ex?.rankAfter?.[side]
  const before = ex?.rankBefore?.[side]
  if (!after || !before) return null
  const move = ex?.rankMove?.[side] ?? ''
  const arenaUp = after.arenaIndex > before.arenaIndex
  const arenas = ex?.newArenas?.[side] ?? []
  const line =
    move === 'up'
      ? arenaUp ? `Promoted to ${after.arena} arena · ${after.label}` : `Up to ${after.label}`
      : move === 'down'
        ? after.arenaIndex < before.arenaIndex ? `Dropped to ${after.arena} arena · ${after.label}` : `Down to ${after.label}`
        : move === 'protected'
          ? `${after.arena} arena protected until you drop below ${after.demoteBelow.toLocaleString()}`
          : after.label
  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <p className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold', move === 'up' ? 'bg-white/20' : 'bg-black/25')}>
        <ArenaBadge arena={after.arena} division={after.division} size="xs" />
        {line}
      </p>
      {(ex?.newBest?.[side] || arenas.length > 0) && (
        <p className="text-sm text-white/85">
          {ex?.newBest?.[side] && <b className="text-[#ffd166]">New personal best!</b>}
          {arenas.length > 0 && <> First time in {arenas.join(' and ')}: milestone card{arenas.length > 1 ? 's' : ''} added to your rewards below.</>}
        </p>
      )}
    </div>
  )
}
