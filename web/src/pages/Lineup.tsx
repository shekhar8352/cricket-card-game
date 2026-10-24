import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { Button } from '../components/ui/button'
import { PageHeader, Panel, controlClass } from '../components/ui/chrome'
import { ROLE_LABEL, SQUAD_SLOTS } from '../lib/labels'
import { defaultBattingOrder, defaultBowlingPlan, teamFielding, validateBowlingPlan, validateSquad } from '../lib/rules'
import { cn } from '../lib/cn'
import type { PlayerCard as Card, Role } from '../types/engine'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

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

export function LineupPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const match = useQuery({ queryKey: ['match', id], queryFn: () => api.match(id!), refetchInterval: 3000 })
  const cardsQ = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const [picked, setPicked] = useState<string[]>(Array(7).fill(''))
  const [order, setOrder] = useState<string[]>([])
  const [plan, setPlan] = useState<(string | '')[]>(['', '', '', '', ''])
  const [toss, setToss] = useState<'bat' | 'chase'>('chase')
  const [filter, setFilter] = useState<Role | ''>('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const all = cardsQ.data ?? []
  const byId = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all])
  const squad = picked.map((x) => byId[x]).filter(Boolean)
  const opp = match.data?.youAreHome ? match.data?.awayLineup : match.data?.homeLineup

  useEffect(() => {
    if (match.data?.status === 'COMPLETE') nav(`/match/${id}/live`)
    if (match.data?.status === 'SIMULATING') nav(`/match/${id}/live`)
  }, [match.data?.status, id, nav])

  function setSlot(index: number, cardId: string) {
    const next = Array.from({ length: 7 }, (_, i) => (i === index ? cardId : picked[i] ?? ''))
    setPicked(next)
    const cards = next.map((x) => byId[x]).filter(Boolean)
    if (cards.length === 7) {
      setOrder(defaultBattingOrder(cards))
      setPlan(defaultBowlingPlan(cards))
    } else {
      setOrder([])
      setPlan(['', '', '', '', ''])
    }
  }

  function addCard(card: Card) {
    if (picked.includes(card.id)) {
      const idx = picked.indexOf(card.id)
      setSlot(idx, '')
      return
    }
    const idx = SQUAD_SLOTS.findIndex((s, i) => s.role === card.role && !picked[i])
    if (idx < 0) return
    setSlot(idx, card.id)
  }

  function autoPick() {
    const take = (role: Role, n: number) =>
      all.filter((c) => c.role === role).sort((a, b) => b.overall - a.overall).slice(0, n)
    const next = [...take('BAT', 3), ...take('WK', 1), ...take('AR', 1), ...take('BOWL', 2)]
    const ids = Array.from({ length: 7 }, (_, i) => next[i]?.id ?? '')
    setPicked(ids)
    const cards = ids.map((x) => byId[x] ?? next.find((c) => c.id === x)).filter(Boolean) as Card[]
    if (cards.length === 7) {
      setOrder(defaultBattingOrder(cards))
      setPlan(defaultBowlingPlan(cards))
    }
  }

  const filled = squad.length
  const squadErr = filled === 7 ? validateSquad(squad) : `Add ${7 - filled} more player${7 - filled === 1 ? '' : 's'}`
  const bowlErr = filled === 7 ? validateBowlingPlan(squad, plan.filter(Boolean) as string[]) : null
  const team = teamFielding(squad)
  const visible = all.filter((c) => !filter || c.role === filter)

  async function lock() {
    setErr('')
    setBusy(true)
    try {
      const m = await api.lockLineup(id!, { cardIds: picked, battingOrder: order, bowlingPlan: plan as string[], tossPref: toss })
      if (m.status === 'COMPLETE' || m.status === 'SIMULATING') nav(`/match/${id}/live`)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const old = order.indexOf(String(active.id))
    const neu = order.indexOf(String(over.id))
    setOrder(arrayMove(order, old, neu))
  }

  function onMove(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= order.length) return
    setOrder(arrayMove(order, index, next))
  }

  if (match.data?.status === 'MATCHING') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="font-display text-4xl font-semibold">Finding an opponent</h1>
        <p className="text-muted mt-2">Stay on this page. You will set your lineup as soon as someone joins.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Set your lineup"
        lede={`vs ${match.data?.opponent.name ?? 'opponent'}${match.data?.opponent.trophies != null ? ` · ${match.data.opponent.trophies} trophies` : ''}. Fill every slot, then lock in.`}
        action={<Button variant="outline" onClick={autoPick}>Fill best available</Button>}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <h2 className="font-display text-2xl font-semibold">Your seven · {filled}/7</h2>
          <p className="text-muted text-sm mb-3">Tap an empty slot to filter that role. Tap a filled slot to remove that player.</p>
          <div className="felt-tray flex flex-wrap gap-3">
            {SQUAD_SLOTS.map((s, i) => (
              <div key={s.label} className="text-center">
                <PlayerCard
                  card={byId[picked[i]]}
                  size="sm"
                  hidden={!picked[i]}
                  placeholder="Empty"
                  onClick={() => picked[i] ? setSlot(i, '') : setFilter(s.role)}
                />
                <div className="text-xs text-white mt-1 w-[5.5rem]">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted mt-3">
            Fielding {team.fielding} · Keeping {team.keeping} · Stumping {team.stumping}
            {team.stumping >= 80 ? '. A strong keeper helps spin overs.' : ''}
          </p>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl font-semibold">Opponent</h2>
          <p className="text-muted text-sm mb-3">Their cards show after they lock in. Batting and bowling orders stay hidden.</p>
          <div className="flex flex-wrap gap-2">
            {(opp?.cards ?? []).map((c) => <PlayerCard key={c.id} card={c} size="sm" />)}
            {!opp?.cards?.length && <p className="text-muted">Waiting for their lineup.</p>}
          </div>
        </Panel>
      </div>

      <section>
        <h2 className="font-display text-2xl font-semibold mb-2">Pick from your collection</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => setFilter('')} className={cn(controlClass, 'cursor-pointer', filter === '' && 'bg-accent text-white dark:text-accent-fg border-accent')}>All</button>
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <button key={role} type="button" onClick={() => setFilter(role)} className={cn(controlClass, 'cursor-pointer', filter === role && 'bg-accent text-white dark:text-accent-fg border-accent')}>{ROLE_LABEL[role]}</button>
          ))}
        </div>
        <div className="felt-tray flex gap-2 overflow-x-auto pb-2">
          {visible.map((c) => (
            <PlayerCard
              key={c.id}
              card={c}
              size="sm"
              selected={picked.includes(c.id)}
              status={picked.includes(c.id) ? 'In' : undefined}
              onClick={() => addCard(c)}
            />
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <h2 className="font-display text-2xl font-semibold">Batting order</h2>
          <p className="text-muted text-sm mb-3">Top of the list bats first. Drag the handle, or use the arrows.</p>
          {order.length === 0 ? (
            <p className="text-muted">This appears when all seven slots are filled.</p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {order.map((oid, i) => (
                    <SortableRow key={oid} id={oid} name={byId[oid]?.name ?? 'Player'} index={i} total={order.length} onMove={onMove} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl font-semibold">Bowling plan</h2>
          <p className="text-muted text-sm mb-3">Each bowler bowls exactly 2 overs. The all-rounder bowls 1. Nobody bowls back-to-back overs.</p>
          {filled < 7 ? (
            <p className="text-muted">Choose all seven players and the overs fill in. You can change them after that.</p>
          ) : (
            <div className="space-y-2">
              {plan.map((pid, i) => (
                <div key={i}>
                  <label className="text-sm text-muted" htmlFor={`over-${i}`}>Over {i + 1}</label>
                  <select id={`over-${i}`} value={pid} onChange={(e) => setPlan((p) => p.map((x, j) => j === i ? e.target.value : x))} className={cn(controlClass, 'w-full mt-1 cursor-pointer')}>
                    <option value="">Choose a bowler</option>
                    {squad.filter((c) => c.role === 'BOWL' || c.role === 'AR').map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({ROLE_LABEL[c.role]})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
          {bowlErr && <p className="text-wicket text-sm mt-2" role="alert">{bowlErr}</p>}
        </Panel>
      </div>

      <Panel>
        <fieldset>
          <legend className="font-display text-2xl font-semibold">If you win the toss</legend>
          <p className="text-muted text-sm mb-3">This is only used when the toss goes your way.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {([
              ['bat', 'Bat first', 'Set a total for them to chase'],
              ['chase', 'Chase', 'Know the target before you bat'],
            ] as const).map(([value, title, body]) => (
              <label key={value} className={cn('rounded-xl border p-4 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent', toss === value ? 'border-accent bg-accent/10' : 'border-border')}>
                <input className="sr-only" type="radio" name="toss" value={value} checked={toss === value} onChange={() => setToss(value)} />
                <span className="font-semibold block">{title}</span>
                <span className="text-muted text-sm">{body}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Button disabled={!!squadErr || !!bowlErr || busy} onClick={lock}>{busy ? 'Locking in…' : 'Lock in lineup'}</Button>
          {squadErr && <p className="text-muted">{squadErr}</p>}
          {err && <p className="text-wicket" role="alert">{err}</p>}
        </div>
      </Panel>
    </div>
  )
}
