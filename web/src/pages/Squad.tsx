import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { Button } from '../components/ui/button'
import { Choice, PageHeader, Panel } from '../components/ui/chrome'
import { ROLE_LABEL, ROLE_NEED, SQUAD_SLOTS, roleCounts } from '../lib/labels'
import { defaultBattingOrder, defaultBowlingPlan, validateBowlingPlan, validateSquad } from '../lib/rules'
import type { PlayerCard as Card, Role } from '../types/engine'

function place(cards: Card[]) {
  const next = Array(7).fill('')
  for (const card of cards) {
    const idx = SQUAD_SLOTS.findIndex((slot, i) => slot.role === card.role && !next[i])
    if (idx >= 0) next[idx] = card.id
  }
  return next
}

export function SquadPage() {
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const saved = useQuery({ queryKey: ['squad'], queryFn: api.squad })
  const qc = useQueryClient()
  const [slots, setSlots] = useState<string[]>(Array(7).fill(''))
  const [ready, setReady] = useState(false)
  const [filter, setFilter] = useState<Role | ''>('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const all = cards.data ?? []

  useEffect(() => {
    if (ready || !cards.isSuccess || !saved.isSuccess) return
    const owned = (saved.data?.cardIds ?? []).map((id) => all.find((c) => c.id === String(id))).filter(Boolean) as Card[]
    if (owned.length) setSlots(place(owned))
    setReady(true)
  }, [ready, cards.isSuccess, saved.isSuccess, saved.data, all])

  const squad = slots.map((id) => all.find((c) => c.id === id)).filter(Boolean) as Card[]
  const counts = roleCounts(squad.map((c) => c.role))
  const filled = squad.length
  const squadErr = filled === 7 ? validateSquad(squad) : `Add ${7 - filled} more player${7 - filled === 1 ? '' : 's'}`
  const plan = filled === 7 && !squadErr ? defaultBowlingPlan(squad) : []
  const bowlErr = plan.length ? validateBowlingPlan(squad, plan) : null
  const visible = all.filter((c) => !filter || c.role === filter)

  function toggle(card: Card) {
    setMsg('')
    const at = slots.indexOf(card.id)
    if (at >= 0) {
      setSlots((s) => s.map((id, i) => i === at ? '' : id))
      return
    }
    const idx = SQUAD_SLOTS.findIndex((slot, i) => slot.role === card.role && !slots[i])
    if (idx < 0) return
    setSlots((s) => s.map((id, i) => i === idx ? card.id : id))
  }

  function autoPick() {
    const take = (role: Role, n: number) =>
      all.filter((c) => c.role === role).sort((a, b) => b.overall - a.overall).slice(0, n)
    setSlots(place([...take('BAT', 3), ...take('WK', 1), ...take('AR', 1), ...take('BOWL', 2)]))
    setMsg('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Squad"
        lede="This seven is saved for the next match. Tap a player to fill their role, and tap them again to remove them."
        action={<Button variant="outline" onClick={autoPick}>Fill best available</Button>}
      />

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h2 className="font-display text-2xl font-semibold">Slots · {filled}/7</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {(Object.keys(ROLE_NEED) as Role[]).map((role) => {
              const ok = counts[role] === ROLE_NEED[role]
              return (
                <li key={role} className={ok ? 'text-success font-medium' : 'text-muted'}>
                  {ROLE_LABEL[role]} {counts[role]}/{ROLE_NEED[role]}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="felt-tray flex flex-wrap gap-3">
          {SQUAD_SLOTS.map((slot, i) => {
            const card = all.find((c) => c.id === slots[i])
            return (
              <div key={slot.label} className="text-center">
                <PlayerCard
                  card={card}
                  hidden={!card}
                  size="sm"
                  placeholder="Empty"
                  onClick={() => {
                    if (card) setSlots((s) => s.map((id, n) => n === i ? '' : id))
                    else setFilter(slot.role)
                  }}
                />
                <div className="text-xs text-white mt-1 w-[5.5rem]">{slot.label}</div>
              </div>
            )
          })}
        </div>
      </Panel>

      <div>
        <h2 className="font-display text-2xl font-semibold mb-2">Your cards</h2>
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by role">
          <Choice pressed={filter === ''} onClick={() => setFilter('')}>All</Choice>
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <Choice key={role} pressed={filter === role} onClick={() => setFilter(role)}>{ROLE_LABEL[role]}</Choice>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visible.map((c) => {
            const selected = slots.includes(c.id)
            const full = counts[c.role] >= ROLE_NEED[c.role] && !selected
            return (
              <PlayerCard
                key={c.id}
                card={c}
                className="w-full max-w-none"
                selected={selected}
                disabled={full}
                status={selected ? 'Tap to remove' : full ? 'Role full' : undefined}
                onClick={() => toggle(c)}
              />
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!!squadErr || !!bowlErr || busy}
          onClick={async () => {
            setBusy(true)
            setErr('')
            try {
              await api.saveSquad({ cardIds: slots, battingOrder: defaultBattingOrder(squad), bowlingPlan: plan })
              setMsg('Squad saved. New matches start from this seven.')
              qc.invalidateQueries({ queryKey: ['squad'] })
            } catch (e) {
              setErr((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >{busy ? 'Saving…' : 'Save squad'}</Button>
        {squadErr && <p className="text-muted">{squadErr}</p>}
        {bowlErr && <p className="text-wicket">{bowlErr}</p>}
        {msg && <p className="text-success" role="status">{msg}</p>}
        {err && <p className="text-wicket" role="alert">{err}</p>}
      </div>
    </div>
  )
}
