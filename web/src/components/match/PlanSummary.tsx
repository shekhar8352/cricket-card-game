import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronRight, Crown, Eye, Link2 } from 'lucide-react'
import { api } from '../../api/client'
import { captainStyle, captainTendency, teamChemistry } from '../../lib/captaincy'
import { cn } from '../../lib/cn'
import { pitchFit } from '../../lib/strategy'
import type { MatchPlan } from '../../lib/plan'
import type { OpponentCaptain, PitchDef, PlayerCard as Card } from '../../types/engine'
import { PlayerAvatar } from '../card/PlayerAvatar'
import { PitchCard } from './MatchPlan'
import type { PlanSection } from './PlanEditor'

const last = (name?: string) => name?.split(' ').slice(-1)[0] ?? '—'

/**
 * The whole lineup on one phone screen: pitch, your seven, captain, both
 * orders and the opponent's captain, each with a link to the tab that edits it.
 * Most players lock in their default from here without scrolling.
 */
export function PlanSummary({
  plan,
  byId,
  pitch,
  oppCaptain,
  problem,
  onEdit,
}: {
  plan: MatchPlan
  byId: Record<string, Card>
  pitch?: PitchDef
  oppCaptain?: OpponentCaptain | null
  problem?: string | null
  onEdit: (to: PlanSection | 'scout') => void
}) {
  const model = useQuery({ queryKey: ['engine-model'], queryFn: api.engineModel, staleTime: Infinity })
  const order = plan.order.map((id) => byId[id]).filter(Boolean)
  const captain = byId[plan.captainId]
  const chem = teamChemistry(plan.order, byId, model.data?.chemistry)
  const filled = plan.picked.filter(Boolean).length

  return (
    <div className="space-y-3">
      {pitch && (
        <button type="button" onClick={() => onEdit('scout')} className="block w-full text-left cursor-pointer rounded-2xl glass border border-border p-3">
          <PitchCard pitch={pitch} compact />
        </button>
      )}

      <section className="glass rounded-2xl border border-border p-3">
        <Row
          title={`Your seven · ${filled}/7`}
          ok={filled === 7 && !problem}
          note={problem ?? `Chemistry ${chem}`}
          onEdit={() => onEdit('team')}
        />
        <div className="chip-scroll flex gap-2 overflow-x-auto mt-2 pb-1">
          {order.length > 0
            ? order.map((c, i) => (
                <span key={c.id} className="flex flex-col items-center w-14">
                  <span className="relative">
                    <PlayerAvatar name={c.name} rarity={c.rarity} />
                    {c.id === plan.captainId && <span className="absolute -top-1 -right-1 rounded bg-cta px-1 text-[10px] font-bold text-cta-fg">C</span>}
                  </span>
                  <span className="text-[11px] font-semibold mt-0.5 w-full text-center truncate">{i + 1}. {last(c.name)}</span>
                </span>
              ))
            : <p className="text-sm text-muted">Pick your seven to get started.</p>}
        </div>
      </section>

      <section className="glass rounded-2xl border border-border p-3">
        <Row title="Captain" icon={<Crown size={16} className="text-cta" aria-hidden />} ok={!!captain} onEdit={() => onEdit('captain')} />
        {captain ? (
          <div className="flex items-center gap-2.5 mt-2">
            <PlayerAvatar name={captain.name} rarity={captain.rarity} />
            <div className="min-w-0">
              <p className="font-semibold truncate">{captain.name}</p>
              <p className="text-xs text-cta font-semibold truncate">{captainStyle(captain.captaincy)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted mt-1">Choose who makes the calls.</p>
        )}
      </section>

      <section className="glass rounded-2xl border border-border p-3">
        <Row title="Bowling" ok={plan.bowling.every(Boolean)} onEdit={() => onEdit('bowling')} />
        <ol className="grid grid-cols-5 gap-1.5 mt-2">
          {plan.bowling.map((id, i) => {
            const c = byId[id]
            const fit = c ? pitchFit(pitch, c.bowlType) : null
            return (
              <li key={i} className={cn('rounded-lg border px-1 py-1.5 text-center', fit === 'suits' ? 'border-success/50 bg-success/10' : fit === 'against' ? 'border-wicket/50 bg-wicket/10' : 'border-border')}>
                <span className="block text-[10px] font-bold uppercase text-muted">Ov {i + 1}</span>
                <span className="block text-xs font-semibold truncate">{c ? last(c.name) : '—'}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <button type="button" onClick={() => onEdit('scout')} className="w-full text-left cursor-pointer glass rounded-2xl border border-border p-3">
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted"><Eye size={14} aria-hidden /> Their captain</span>
          <span className="flex items-center text-sm font-semibold text-accent">Scouting <ChevronRight size={16} aria-hidden /></span>
        </span>
        {oppCaptain ? (
          <span className="block mt-1">
            <span className="font-semibold">{oppCaptain.name}</span>
            <span className="block text-sm text-muted truncate">{captainTendency(oppCaptain.captaincy)}</span>
          </span>
        ) : (
          <span className="block text-sm text-muted mt-1">Revealed when they lock in.</span>
        )}
      </button>

      {order.length > 1 && (
        <p className="flex items-center gap-1.5 text-xs text-muted px-1">
          <Link2 size={12} aria-hidden /> Neighbours in the batting order bat together: chemistry {chem}/100.
          <button type="button" className="underline cursor-pointer" onClick={() => onEdit('batting')}>Change order</button>
        </p>
      )}
    </div>
  )
}

function Row({ title, ok, note, icon, onEdit }: { title: string; ok: boolean; note?: string | null; icon?: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="font-display text-lg font-bold uppercase leading-none">{title}</h3>
      {ok ? <CheckCircle2 size={16} className="text-success" aria-label="Ready" /> : <AlertTriangle size={16} className="text-cta" aria-label="Needs attention" />}
      {note && <span className={cn('text-xs truncate', ok ? 'text-muted' : 'text-cta font-semibold')}>{note}</span>}
      <button type="button" onClick={onEdit} className="ml-auto shrink-0 inline-flex items-center min-h-9 px-2 rounded-lg text-sm font-semibold text-accent cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">
        Edit <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  )
}
