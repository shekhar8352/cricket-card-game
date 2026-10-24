import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { Button } from '../components/ui/button'
import { Panel } from '../components/ui/chrome'
import { useState } from 'react'
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
  if (!m || !res) return <p className="text-muted">Loading the scorecard…</p>
  const youWon = m.winnerUserId === me.data?.user.id || (m.isBot && res.winner === (m.youAreHome ? 'home' : 'away'))
  const tie = res.winner === 'tie'
  const delta = m.youAreHome ? m.trophyDeltaHome : m.trophyDeltaAway
  const cards = [...(m.homeLineup?.cards ?? []), ...(m.awayLineup?.cards ?? [])]
  const name = (cardId: string) => cards.find((c) => c.id === cardId)?.name ?? 'Player'
  const headline = tie ? 'Match tied' : youWon ? 'You won' : 'You lost'
  const trophy = (delta ?? 0) > 0 ? `Gained ${delta} trophies` : (delta ?? 0) < 0 ? `Lost ${Math.abs(delta ?? 0)} trophies` : 'Trophies unchanged'

  const worm = (res.balls ?? []).reduce<{ ball: number; First: number; Second: number }[]>((acc, b) => {
    const last = acc[acc.length - 1] ?? { ball: 0, First: 0, Second: 0 }
    const next = { ball: acc.length + 1, First: last.First, Second: last.Second }
    if (b.innings === 0) next.First = b.score
    else next.Second = b.score
    acc.push(next)
    return acc
  }, [])

  async function again() {
    setBusy(true)
    try {
      const next = await api.createMatch('bot')
      nav(`/match/${next.id}/lineup`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="text-center">
        <p className={`text-sm font-semibold uppercase tracking-wide ${tie ? 'text-muted' : youWon ? 'text-success' : 'text-wicket'}`}>{headline}</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold mt-1">{res.margin}</h1>
        <p className={`text-xl mt-2 ${ (delta ?? 0) > 0 ? 'text-success' : (delta ?? 0) < 0 ? 'text-wicket' : 'text-muted' }`}>{trophy}</p>
        {res.playerOfMatch && <p className="text-muted mt-2">Player of the match: {name(res.playerOfMatch)}</p>}
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          <Button disabled={busy} onClick={again}>{busy ? 'Starting…' : 'Play again'}</Button>
          <Button variant="outline" onClick={() => nav(`/match/${id}/live`)}>Replay</Button>
          <Button variant="ghost" onClick={() => nav('/')}>Home</Button>
        </div>
      </Panel>

      <div className="grid sm:grid-cols-2 gap-3">
        {res.innings.map((inn, i) => (
          <Panel key={i}>
            <p className="text-sm text-muted">{i === 0 ? 'First innings' : 'Second innings'}</p>
            <p className="font-display text-4xl font-semibold tabular">{inn.runs}/{inn.wickets}</p>
            <p className="text-muted">{Math.floor(inn.balls / 6)}.{inn.balls % 6} overs</p>
          </Panel>
        ))}
      </div>

      {m.rewards && m.rewards.length > 0 && (
        <section>
          <h2 className="font-display text-3xl font-semibold mb-1">Rewards</h2>
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
            {i === 0 ? 'First' : 'Second'} innings scorecard · {inn.runs}/{inn.wickets} ({Math.floor(inn.balls / 6)}.{inn.balls % 6})
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
          <p className="text-sm text-muted mb-2">First innings in blue, second innings in orange.</p>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={worm}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="ball" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line dataKey="First" name="First innings" stroke="var(--accent-bright)" dot={false} />
                <Line dataKey="Second" name="Second innings" stroke="var(--cta)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl font-semibold mb-2">Innings totals</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={res.innings.map((inn, i) => ({ name: i === 0 ? 'First' : 'Second', Runs: inn.runs }))}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="Runs" fill="var(--accent-bright)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  )
}
