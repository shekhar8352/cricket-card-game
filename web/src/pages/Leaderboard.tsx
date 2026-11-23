import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Choice, EmptyState, PageHeader, Panel } from '../components/ui/chrome'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function LeaderboardPage() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const [tab, setTab] = useState<'global' | 'arena'>('global')
  const q = useQuery({
    queryKey: ['lb', tab, me.data?.user.arena],
    queryFn: () => api.leaderboard(tab === 'arena' ? me.data?.user.arena : undefined),
    enabled: tab === 'global' || !!me.data,
  })
  const you = (q.data ?? []).find((r) => r.me)

  return (
    <div>
      <PageHeader title="Leaderboard" lede="Trophies decide the order. Arenas group players at a similar level. Tap a player to see their stats and default seven." />
      <div className="chip-row mb-4" role="group" aria-label="Leaderboard scope">
        <Choice pressed={tab === 'global'} onClick={() => setTab('global')}>Global</Choice>
        <Choice pressed={tab === 'arena'} onClick={() => setTab('arena')}>My arena{me.data?.user.arena ? ` · ${me.data.user.arena}` : ''}</Choice>
      </div>
      {you && (
        <Panel className="mb-4">
          <p className="text-muted">Your place</p>
          <p className="font-display text-3xl font-semibold">#{you.rank} · {you.trophies} trophies</p>
        </Panel>
      )}
      {q.isPending ? (
        <p className="text-muted">Loading standings…</p>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState title="No one ranked yet" body="Play a match and your name will land on this list." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm sm:text-base">
            <caption className="sr-only">{tab === 'global' ? 'Global' : 'Arena'} leaderboard</caption>
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="px-3 sm:px-4 py-3 font-medium w-14">Rank</th>
                <th scope="col" className="px-2 sm:px-4 py-3 font-medium">Player</th>
                <th scope="col" className="hidden sm:table-cell px-4 py-3 font-medium">Arena</th>
                <th scope="col" className="px-3 sm:px-4 py-3 font-medium text-right sm:text-left">Trophies</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((r) => (
                <tr key={r.id} className={`border-t border-border ${r.me ? 'bg-accent/10' : ''}`}>
                  <td className="px-3 sm:px-4 py-3 tabular font-semibold">{r.rank}</td>
                  <td className="px-2 sm:px-4 py-3 min-w-0">
                    <Link
                      to={`/players/${r.id}`}
                      className="group inline-flex items-center gap-1 font-semibold break-all hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    >
                      {r.username}{r.me ? ' (you)' : ''}
                      <ChevronRight size={15} className="shrink-0 text-muted group-hover:text-accent" aria-hidden />
                    </Link>
                    <span className="sm:hidden block text-xs text-muted">{r.arena} arena</span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3">{r.arena}</td>
                  <td className="px-3 sm:px-4 py-3 tabular font-semibold text-right sm:text-left">{r.trophies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
