import * as Dialog from '@radix-ui/react-dialog'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { X } from 'lucide-react'
import type { PlayerCard } from '../../types/engine'
import { PlayerCard as Face } from './PlayerCard'
import { Button } from '../ui/button'
import { ROLE_LABEL } from '../../lib/labels'
import { useNavigate } from 'react-router-dom'

function bars(card: PlayerCard, keys: { k: keyof PlayerCard['attrs']; label: string }[]) {
  const a = card.effective ?? card.attrs
  return keys.map(({ k, label }) => ({ label, v: a[k] }))
}

export function CardDetail({ card, open, onOpenChange }: { card: PlayerCard | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  if (!card) return null
  const batting = bars(card, [
    { k: 'technique', label: 'Technique' }, { k: 'power', label: 'Power' }, { k: 'timing', label: 'Timing' },
    { k: 'vs_pace', label: 'vs Pace' }, { k: 'vs_spin', label: 'vs Spin' }, { k: 'temperament', label: 'Temperament' }, { k: 'running', label: 'Running' },
  ])
  const bowling = bars(card, [
    { k: 'accuracy', label: 'Accuracy' }, { k: 'variation', label: 'Variation' }, { k: 'wicket_taking', label: 'Wickets' },
    { k: 'movement', label: 'Movement' }, { k: 'death_bowling', label: 'Death bowling' },
  ])
  const fielding = bars(card, [
    { k: 'catching', label: 'Catching' }, { k: 'ground_fielding', label: 'Ground fielding' }, { k: 'throwing', label: 'Throwing' },
  ])
  const keeping = bars(card, [
    { k: 'keeping', label: 'Keeping' }, { k: 'stumping', label: 'Stumping' }, { k: 'reflexes', label: 'Reflexes' },
  ])
  const radar = (card.role === 'BOWL' ? bowling : card.role === 'WK' ? keeping : batting).map((x) => ({ subject: x.label, A: x.v }))
  const groups = [
    { title: 'Batting', rows: batting },
    { title: 'Bowling', rows: bowling },
    { title: 'Fielding', rows: fielding },
    ...(card.role === 'WK' ? [{ title: 'Keeping', rows: keeping }] : []),
  ]

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 overflow-y-auto p-6 focus:outline-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-3xl font-semibold leading-none">{card.name}</Dialog.Title>
              <Dialog.Description className="mt-2 text-base text-muted">
                {ROLE_LABEL[card.role]} · {card.country} · {card.rarity} · Level {card.level}
              </Dialog.Description>
            </div>
            <Dialog.Close className="inline-flex items-center justify-center w-11 h-11 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Close player details">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="flex justify-center my-5"><Face card={card} size="lg" /></div>
          <h2 className="font-display text-xl font-semibold">Strengths</h2>
          <p className="text-sm text-muted mb-2">The chart matches the bars below. Scores run from 0 to 100.</p>
          <div className="h-52">
            <ResponsiveContainer>
              <RadarChart data={radar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                <Radar dataKey="A" name="Rating" stroke="var(--accent)" fill="var(--accent-bright)" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {groups.map((group) => (
            <div key={group.title} className="mt-5">
              <h3 className="font-semibold mb-2">{group.title}</h3>
              <div className="space-y-2">
                {group.rows.map((g) => (
                  <div key={g.label} className="flex items-center gap-2 text-sm">
                    <span className="w-28 text-muted">{g.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden" role="progressbar" aria-label={g.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.v}>
                      <div className="h-full bg-accent-bright" style={{ width: `${g.v}%` }} />
                    </div>
                    <span className="tabular w-8 text-right">{g.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {card.traits?.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold mb-1">Traits</h3>
              <ul className="text-muted">
                {card.traits.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
          <Button className="mt-6 w-full" onClick={() => { onOpenChange(false); nav(`/training?target=${card.id}`) }}>Train this player</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
