import { ShieldAlert, TrendingUp, Trophy } from 'lucide-react'
import type { ArenaRank } from '../../types/engine'
import { ArenaBadge } from './ArenaBadge'

const fmt = (n: number) => n.toLocaleString()

/**
 * The player's arena rank: badge and division, trophies, progress to the next
 * goal, the buffer notice while protected, and the personal best.
 * Designed for the dark hero panels on Home and Account.
 */
export function RankPanel({ rank, best, compact }: { rank: ArenaRank; best?: number; compact?: boolean }) {
  // Normally the goal is the next division. While the buffer is holding the
  // player in their arena, the goal is getting back above the arena floor
  // (rank.minTrophy), measured from the line where the arena would be lost.
  const goal = rank.protected ? { label: `back above ${rank.arena}’s line`, minTrophy: rank.minTrophy } : rank.next
  const from = rank.protected ? rank.demoteBelow : rank.minTrophy
  const pct = goal ? Math.min(100, Math.max(0, ((rank.trophies - from) / Math.max(1, goal.minTrophy - from)) * 100)) : 100
  const toGoal = goal ? Math.max(0, goal.minTrophy - rank.trophies) : 0

  return (
    <div>
      <div className="flex items-center gap-4">
        <ArenaBadge arena={rank.arena} division={rank.division} size={compact ? 'lg' : 'xl'} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">{rank.arena} arena</p>
          <p className="font-display text-3xl sm:text-4xl font-bold uppercase leading-none mt-0.5">{rank.label}</p>
          <p className="flex items-center gap-1.5 mt-1.5 font-display text-2xl font-bold tabular text-[#ffd166]">
            <Trophy size={20} aria-hidden /> {fmt(rank.trophies)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div
          className="h-2.5 rounded-full bg-white/12 overflow-hidden"
          role="progressbar"
          aria-label={goal ? `Progress to ${goal.label}` : 'Top arena'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-accent-bright to-cta transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-white/75 mt-2">
          {goal ? (
            <>
              <b className="text-white tabular">{fmt(toGoal)}</b> trophies to <b className="text-white">{goal.label}</b>
              <span className="text-white/50"> at {fmt(goal.minTrophy)}</span>
            </>
          ) : (
            'You’re in the top arena. Defend your place on the leaderboard.'
          )}
        </p>
      </div>

      {rank.protected && (
        <p className="mt-3 flex gap-2 rounded-xl border border-[#ffd166]/50 bg-[#ffd166]/10 px-3 py-2 text-sm" role="status">
          <ShieldAlert size={18} className="shrink-0 text-[#ffd166] mt-0.5" aria-hidden />
          <span>
            <b>Arena protected.</b> You’re below {rank.arena}’s {fmt(rank.minTrophy)} line but keep the arena, its rewards and its leaderboard until you drop below{' '}
            <b className="tabular">{fmt(rank.demoteBelow)}</b> ({fmt(rank.trophies - rank.demoteBelow)} to spare).
          </span>
        </p>
      )}

      {best != null && best > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-white/70">
          <TrendingUp size={16} aria-hidden /> Personal best <b className="text-white tabular">{fmt(best)}</b>
          {best > rank.trophies && <span className="text-white/50">({fmt(best - rank.trophies)} above now)</span>}
        </p>
      )}
    </div>
  )
}
