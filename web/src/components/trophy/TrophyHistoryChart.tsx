import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrophyProgress } from '../../types/engine'

const fmt = (n: number) => n.toLocaleString()

interface Point {
  n: number
  trophies: number
  delta?: number
  at?: string
}

function Tip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const p = payload?.[0]?.payload as Point | undefined
  if (!active || !p) return null
  return (
    <div className="rounded-lg border border-border bg-[var(--card-bg)] px-3 py-2 text-sm shadow-lg">
      <p className="text-xs text-muted">{p.n === 0 ? 'Before your first ranked match' : `Match ${p.n}${p.at ? ` · ${new Date(p.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}`}</p>
      <p className="font-display text-xl font-bold tabular">{fmt(p.trophies)} trophies</p>
      {p.delta != null && <p className="text-xs text-muted tabular">{p.delta > 0 ? `+${p.delta}` : p.delta} this match</p>}
    </div>
  )
}

/**
 * Trophies after each ranked match: one series (named by the heading), arena
 * floors as hairline reference lines with their names, and a table view.
 */
export function TrophyHistoryChart({ data, arenas }: { data: TrophyProgress; arenas: { name: string; minTrophy: number }[] }) {
  const points: Point[] = [{ n: 0, trophies: data.start }, ...data.history.map((h, i) => ({ n: i + 1, trophies: h.trophies, delta: h.delta, at: h.at }))]
  if (points.length < 2) return <p className="text-muted">Play a ranked match to start your trophy history.</p>
  const lo = Math.min(...points.map((p) => p.trophies))
  const hi = Math.max(...points.map((p) => p.trophies))
  const pad = Math.max(40, (hi - lo) * 0.12)
  const yMin = Math.max(0, Math.floor((lo - pad) / 50) * 50)
  const yMax = Math.ceil((hi + pad) / 50) * 50
  const floors = arenas.filter((a) => a.minTrophy > yMin && a.minTrophy < yMax)
  const last = points[points.length - 1]

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 64, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
            <XAxis dataKey="n" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} allowDecimals={false} label={{ value: 'Ranked matches', position: 'insideBottomRight', offset: -2, fill: 'var(--muted)', fontSize: 11 }} />
            <YAxis domain={[yMin, yMax]} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => fmt(v)} />
            {floors.map((a) => (
              <ReferenceLine key={a.name} y={a.minTrophy} stroke="var(--muted)" strokeOpacity={0.6} strokeWidth={1} label={{ value: a.name, position: 'right', fill: 'var(--muted)', fontSize: 11 }} />
            ))}
            <Tooltip content={<Tip />} cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="trophies"
              stroke="var(--accent-bright)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 5, stroke: 'var(--card-bg)', strokeWidth: 2, fill: 'var(--accent-bright)' }}
              isAnimationActive={false}
            />
            <ReferenceLine y={last.trophies} stroke="transparent" label={{ value: fmt(last.trophies), position: 'right', fill: 'var(--fg)', fontSize: 12, fontWeight: 700 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Show as a table</summary>
        <div className="max-h-56 overflow-y-auto mt-2">
          <table className="w-full tabular">
            <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-1">Match</th><th className="py-1">Date</th><th className="py-1 text-right">Change</th><th className="py-1 text-right">Trophies</th></tr></thead>
            <tbody>
              {points.slice(1).reverse().map((p) => (
                <tr key={p.n} className="border-t border-border">
                  <td className="py-1">{p.n}</td>
                  <td className="py-1">{p.at ? new Date(p.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</td>
                  <td className="py-1 text-right">{p.delta != null && p.delta > 0 ? `+${p.delta}` : p.delta}</td>
                  <td className="py-1 text-right">{fmt(p.trophies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
