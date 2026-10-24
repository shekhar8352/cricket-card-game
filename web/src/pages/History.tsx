import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { EmptyState, PageHeader } from '../components/ui/chrome'
import { statusLabel } from '../lib/labels'

export function HistoryPage() {
  const q = useQuery({ queryKey: ['matches'], queryFn: api.matches })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const nav = useNavigate()
  const rows = q.data ?? []

  return (
    <div>
      <PageHeader title="Match history" lede="Open a finished match for the scorecard, or jump back into one that still needs a lineup." />
      {q.isPending ? (
        <p className="text-muted">Loading matches…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No matches yet" body="Your wins, losses, and trophy changes will be listed here." action={<Button onClick={() => nav('/play')}>Play a match</Button>} />
      ) : (
        <div className="space-y-2">
          {rows.map((m) => {
            const outcome = m.result?.winner === 'tie' ? 'tie' as const : m.winnerUserId === me.data?.user.id ? 'win' as const : 'loss' as const
            const label = statusLabel(m.status, m.status === 'COMPLETE' ? outcome : undefined)
            const score = m.result ? `${m.result.innings[0]?.runs}/${m.result.innings[0]?.wickets} vs ${m.result.innings[1]?.runs}/${m.result.innings[1]?.wickets}` : 'Lineup still open'
            const delta = m.youAreHome ? m.trophyDeltaHome : m.trophyDeltaAway
            const trophy = delta == null ? '' : delta > 0 ? `Gained ${delta} trophies` : delta < 0 ? `Lost ${Math.abs(delta)} trophies` : 'Trophies unchanged'
            const when = m.createdAt ? new Date(m.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => nav(m.status === 'COMPLETE' ? `/match/${m.id}/result` : m.status === 'SIMULATING' ? `/match/${m.id}/live` : `/match/${m.id}/lineup`)}
                className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 min-h-11 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">vs {m.opponent.name}</span>
                  <span className={outcome === 'win' && m.status === 'COMPLETE' ? 'text-success font-semibold' : outcome === 'loss' && m.status === 'COMPLETE' ? 'text-wicket font-semibold' : 'text-muted'}>{label}</span>
                </div>
                <p className="text-muted mt-1">{score}{trophy ? ` · ${trophy}` : ''}</p>
                {when && <p className="text-sm text-muted mt-1">{when}</p>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
