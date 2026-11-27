import { useMemo, useState, type ReactNode } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, Crown, GripVertical, Link2, Swords } from 'lucide-react'
import { GamePlanPicker } from './GamePlanPicker'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { CaptaincyBars, MasterstrokeLine } from '../card/CaptainProfile'
import { PlayerAvatar } from '../card/PlayerAvatar'
import { bestCaptain, captainStyle, link, teamChemistry } from '../../lib/captaincy'
import { PlayerCard } from '../card/PlayerCard'
import { Panel, controlClass } from '../ui/chrome'
import { ROLE_LABEL, SQUAD_SLOTS } from '../../lib/labels'
import { teamFielding } from '../../lib/rules'
import { cn } from '../../lib/cn'
import { compareForm } from '../../lib/ratings'
import { pitchFit } from '../../lib/strategy'
import { planErrors, withTeam, type MatchPlan } from '../../lib/plan'
import type { PitchDef, PlayerCard as Card, Role } from '../../types/engine'

function SortableRow({ id, name, index, total, onMove }: { id: string; name: string; index: number; total: number; onMove: (index: number, dir: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-center gap-1 border border-border rounded-xl bg-card pr-1">
      <button type="button" className="inline-flex items-center justify-center w-11 h-11 cursor-grab rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Drag ${name}`} {...attributes} {...listeners}>
        <GripVertical size={18} aria-hidden />
      </button>
      <span className="flex-1 font-medium">{index + 1}. {name}</span>
      <button type="button" className="inline-flex items-center justify-center w-11 h-11 cursor-pointer rounded-xl disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index, -1)}>
        <ChevronUp size={18} />
      </button>
      <button type="button" className="inline-flex items-center justify-center w-11 h-11 cursor-pointer rounded-xl disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Move ${name} down`} disabled={index === total - 1} onClick={() => onMove(index, 1)}>
        <ChevronDown size={18} />
      </button>
    </div>
  )
}

/**
 * What a player sets before a match: seven players, the captain, and the
 * batting and bowling orders. The captain makes every tactical call in the
 * match (approach, field, toss, masterstroke). Used for the saved default
 * (Squad & strategy) and for each match's lineup.
 */
export type PlanSection = 'team' | 'batting' | 'bowling' | 'captain' | 'plan'

export function PlanEditor({
  cards, plan, onChange, pitch, aside, section, teamTools,
}: {
  cards: Card[]
  plan: MatchPlan
  onChange: (p: MatchPlan) => void
  pitch?: PitchDef
  aside?: ReactNode // shown beside the team (e.g. the opponent's cards)
  /** Phones show one section at a time (the parent's tabs pick it); `null`
   *  hides them all on phones. Undefined shows everything, as on desktop. */
  section?: PlanSection | null
  /** Extra controls at the top of the team section (e.g. "Fill best rated"). */
  teamTools?: ReactNode
}) {
  // On phones only the chosen section shows; from lg up everything does.
  const only = (k: PlanSection) => (section === undefined || section === k ? '' : 'hidden lg:block')
  const [filter, setFilter] = useState<Role | ''>('')
  const [traySort, setTraySort] = useState<'overall' | 'form'>('overall')
  const byId = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards])
  const model = useQuery({ queryKey: ['engine-model'], queryFn: api.engineModel, staleTime: Infinity })
  const strokes = useMemo(() => Object.fromEntries((model.data?.masterstrokes ?? []).map((m) => [m.code, m])), [model.data])
  const chemRules = model.data?.chemistry
  const planDefs = model.data?.breakCalls ?? []
  const { squad, bowlErr } = planErrors(plan, byId)
  const filled = squad.length
  const team = teamFielding(squad)
  const visible = cards.filter((c) => !filter || c.role === filter).sort(traySort === 'form' ? compareForm : (a, b) => b.overall - a.overall)
  const set = (patch: Partial<MatchPlan>) => onChange({ ...plan, ...patch })

  function setSlot(index: number, cardId: string) {
    onChange(withTeam(plan, plan.picked.map((x, i) => (i === index ? cardId : x)), byId))
  }

  function toggle(card: Card) {
    const at = plan.picked.indexOf(card.id)
    if (at >= 0) return setSlot(at, '')
    const idx = SQUAD_SLOTS.findIndex((s, i) => s.role === card.role && !plan.picked[i])
    if (idx >= 0) setSlot(idx, card.id)
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    set({ order: arrayMove(plan.order, plan.order.indexOf(String(active.id)), plan.order.indexOf(String(over.id))) })
  }

  function onMove(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= plan.order.length) return
    set({ order: arrayMove(plan.order, index, next) })
  }

  const suggested = filled === 7 ? bestCaptain(squad) : undefined
  const chem = teamChemistry(plan.order, byId, chemRules)

  return (
    <div className="space-y-4 lg:space-y-6">
      {teamTools && <div className={cn('lg:hidden', only('team'))}>{teamTools}</div>}
      <div className={cn('grid gap-4', aside && 'lg:grid-cols-2', section !== undefined && section !== 'team' && 'hidden lg:grid')}>
        <Panel>
          <h2 className="font-display text-2xl font-semibold">Your seven · {filled}/7</h2>
          <p className="text-muted text-sm mb-3">Tap an empty slot to filter that role. Tap a filled slot to remove that player.</p>
          <div className="felt-tray grid grid-cols-3 justify-items-center gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:gap-3">
            {SQUAD_SLOTS.map((s, i) => (
              <div key={s.label} className="text-center">
                <PlayerCard card={byId[plan.picked[i]]} size="sm" hidden={!plan.picked[i]} placeholder="Empty" onClick={() => (plan.picked[i] ? setSlot(i, '') : setFilter(s.role))} />
                <div className="text-xs text-white mt-1 w-[5.5rem]">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted mt-3">
            Fielding {team.fielding} · Keeping {team.keeping} · Stumping {team.stumping}
            {team.stumping >= 80 ? '. A strong keeper helps spin overs.' : ''}
          </p>
        </Panel>
        {aside && <div className={cn(section !== undefined && 'hidden lg:block')}>{aside}</div>}
      </div>

      <section className={only('team')}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="font-display text-2xl font-semibold mr-2 w-full sm:w-auto">Pick from your collection</h2>
          <div className="chip-row w-full sm:w-auto">
          <button type="button" onClick={() => setFilter('')} className={cn(controlClass, 'cursor-pointer', filter === '' && 'bg-accent text-white dark:text-accent-fg border-accent')}>All</button>
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <button key={role} type="button" onClick={() => setFilter(role)} className={cn(controlClass, 'cursor-pointer', filter === role && 'bg-accent text-white dark:text-accent-fg border-accent')}>{ROLE_LABEL[role]}</button>
          ))}
          </div>
          <label className="sm:ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted">Sort by</span>
            <select value={traySort} onChange={(e) => setTraySort(e.target.value as 'overall' | 'form')} className={cn(controlClass, 'cursor-pointer')}>
              <option value="overall">Overall</option>
              <option value="form">Average match rating</option>
            </select>
          </label>
        </div>
        <div className="felt-tray flex gap-2 overflow-x-auto pb-2">
          {visible.map((c) => (
            <PlayerCard key={c.id} card={c} size="sm" selected={plan.picked.includes(c.id)} status={plan.picked.includes(c.id) ? 'In' : undefined} onClick={() => toggle(c)} />
          ))}
        </div>
      </section>

      <div className={cn('grid lg:grid-cols-2 gap-4', section !== undefined && section !== 'batting' && section !== 'bowling' && 'hidden lg:grid')}>
        <Panel className={only('batting')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">Batting order</h2>
              <p className="text-muted text-sm mb-3">Top of the list bats first. Neighbours usually bat together, so pair players with chemistry: they rotate strike and run better.</p>
            </div>
            {plan.order.length > 0 && (
              <span className="shrink-0 text-center rounded-xl border border-border px-3 py-1.5" title="From neighbouring pairs: same country +1, known partnership +2, up to 3 per pair">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Chemistry</span>
                <span className={cn('font-display text-2xl font-bold tabular', chem >= 50 ? 'text-success' : chem >= 25 ? 'text-cta' : 'text-muted')}>{chem}</span>
              </span>
            )}
          </div>
          {plan.order.length === 0 ? (
            <p className="text-muted">This appears when all seven slots are filled.</p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={plan.order} strategy={verticalListSortingStrategy}>
                <div>
                  {plan.order.map((oid, i) => {
                    const l = i + 1 < plan.order.length ? link(byId[oid], byId[plan.order[i + 1]], chemRules) : -1
                    return (
                      <div key={oid}>
                        <SortableRow id={oid} name={`${byId[oid]?.name ?? 'Player'}${oid === plan.captainId ? ' (c)' : ''}`} index={i} total={plan.order.length} onMove={onMove} />
                        {l >= 0 && (
                          <div className={cn('flex items-center gap-1.5 pl-12 py-1 text-xs', l >= 2 ? 'text-success font-semibold' : l === 1 ? 'text-muted' : 'text-muted/60')}>
                            <Link2 size={12} aria-hidden /> {['No link', 'Same country', 'Known partners', 'Partners, same country'][l]}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Panel>
        <Panel className={only('bowling')}>
          <h2 className="font-display text-2xl font-semibold">Bowling order</h2>
          <p className="text-muted text-sm mb-3">Each bowler bowls exactly 2 overs. The all-rounder bowls 1. Nobody bowls back-to-back overs. Your captain sets the field each over.</p>
          {filled < 7 ? (
            <p className="text-muted">Choose all seven players and the overs fill in. You can change them after that.</p>
          ) : (
            <div className="space-y-2">
              {plan.bowling.map((pid, i) => {
                const fit = pid ? pitchFit(pitch, byId[pid]?.bowlType ?? 'pace') : null
                return (
                  <div key={i} className="rounded-xl border border-border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-semibold" htmlFor={`over-${i}`}>Over {i + 1}</label>
                      {fit === 'suits' && <span className="rounded-md bg-success/15 text-success px-1.5 text-xs font-bold">Pitch suits {byId[pid]?.bowlType}</span>}
                      {fit === 'against' && <span className="rounded-md bg-wicket/15 text-wicket px-1.5 text-xs font-bold">Pitch works against {byId[pid]?.bowlType}</span>}
                    </div>
                    <select id={`over-${i}`} value={pid} onChange={(e) => set({ bowling: plan.bowling.map((x, j) => (j === i ? e.target.value : x)) })} className={cn(controlClass, 'w-full mt-1 cursor-pointer')}>
                      <option value="">Choose a bowler</option>
                      {squad.filter((c) => c.role === 'BOWL' || c.role === 'AR').map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({ROLE_LABEL[c.role]}, {c.bowlType})</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}
          {bowlErr && <p className="text-wicket text-sm mt-2" role="alert">{bowlErr}</p>}
        </Panel>
      </div>

      <Panel className={only('captain')}>
        <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><Crown size={22} className="text-cta" aria-hidden /> Captain</h2>
        <p className="text-muted text-sm mb-3 hidden sm:block">
          Your captain makes the toss decision, plays their masterstroke, and makes every over’s call when you leave the game plan to them. Calm captains also steady the batters under pressure.
        </p>
        {filled < 7 ? (
          <p className="text-muted">Pick all seven players to choose a captain.</p>
        ) : (
          <div role="radiogroup" aria-label="Captain" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {squad.map((c) => {
              const cp = c.captaincy
              const on = plan.captainId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ captainId: c.id })}
                  className={cn('text-left rounded-2xl border-2 p-2.5 sm:p-3 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', on ? 'border-cta bg-cta/10' : 'border-border hover:border-muted')}
                >
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar name={c.name} rarity={c.rarity} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{c.name}{on && <span className="ml-1.5 rounded bg-cta px-1.5 text-[11px] font-bold text-cta-fg">C</span>}</p>
                      <p className="text-xs text-cta font-semibold truncate">{captainStyle(cp)}</p>
                    </div>
                    {suggested?.id === c.id && <span className="shrink-0 rounded-md bg-success/15 text-success px-1.5 py-0.5 text-[11px] font-bold">Best pick</span>}
                  </div>
                  {/* Phones: full detail only for the chosen captain, so the list stays short. */}
                  <div className={cn(!on && 'hidden sm:block')}>
                    {cp && <div className="mt-2.5"><CaptaincyBars cp={cp} /></div>}
                    {(c.captainRep ?? 0) > 0 && <p className="text-[11px] text-muted mt-1">Reputation {c.captainRep} · Tactics +{Math.min(10, Math.floor((c.captainRep ?? 0) / 10))}</p>}
                    {cp && <MasterstrokeLine def={strokes[cp.masterstroke]} />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel className={only('plan')}>
        <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><Swords size={22} className="text-cta" aria-hidden /> Game plan</h2>
        <p className="text-muted text-sm mb-3">
          How you play the first innings, over by over. The toss decides whether you bat or bowl first, so set both. You can change plan for the second innings at the break.
        </p>
        <div className="grid xl:grid-cols-2 gap-4">
          <div>
            <h3 className="font-bold mb-2">If you bat first</h3>
            <GamePlanPicker compact options={planDefs.filter((d) => d.side === 'bat')} value={plan.batPlan} onChange={(v) => set({ batPlan: v })} label="Batting plan" />
          </div>
          <div>
            <h3 className="font-bold mb-2">If you bowl first</h3>
            <GamePlanPicker compact options={planDefs.filter((d) => d.side === 'bowl')} value={plan.bowlPlan} onChange={(v) => set({ bowlPlan: v })} label="Bowling plan" />
          </div>
        </div>
      </Panel>
    </div>
  )
}
