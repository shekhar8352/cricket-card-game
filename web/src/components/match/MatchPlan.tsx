import { Link } from 'react-router-dom'
import { CloudSun, Eye, Info, Leaf, Mountain, Sun, Target } from 'lucide-react'
import { cn } from '../../lib/cn'
import { APPROACH, FIELD, attackMix, scoutBatters } from '../../lib/strategy'
import { PlayerAvatar } from '../card/PlayerAvatar'
import type { Approach, BotStyle, FieldPlan, PitchDef, PlayerCard, Tactics } from '../../types/engine'

const PITCH_ICON = { balanced: CloudSun, green: Leaf, dusty: Mountain, flat: Sun } as const

const TONE: Record<string, string> = {
  defend: 'bg-[#2563eb] text-white border-[#2563eb]',
  balanced: 'bg-slate-500 text-white border-slate-500',
  attack: 'bg-[#dc2626] text-white border-[#dc2626]',
}

/** Three-way segmented control for a batting approach or a field setting. */
export function PlanSegment<T extends Approach | FieldPlan>({
  value, onChange, kind, label,
}: { value: T; onChange: (v: T) => void; kind: 'bat' | 'field'; label: string }) {
  const meta = kind === 'bat' ? APPROACH : FIELD
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 rounded-xl border border-border p-1 bg-black/5 dark:bg-white/5">
      {(['defend', 'balanced', 'attack'] as T[]).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          title={meta[v].help}
          onClick={() => onChange(v)}
          className={cn(
            'min-h-9 rounded-lg px-2 text-sm font-semibold cursor-pointer border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            value === v ? TONE[v] : 'border-transparent text-muted hover:text-fg hover:bg-black/5 dark:hover:bg-white/10',
          )}
        >
          {meta[v].label}
        </button>
      ))}
    </div>
  )
}

export function PlanBadge({ kind, value }: { kind: 'bat' | 'field'; value?: string }) {
  if (!value) return null
  const meta = kind === 'bat' ? APPROACH : FIELD
  const v = value as Approach
  return (
    <span className={cn('inline-flex items-center rounded-md border px-1.5 text-[11px] font-bold uppercase tracking-wide', TONE[v])}>
      {kind === 'bat' ? 'Bat' : 'Field'} {meta[v]?.short ?? value}
    </span>
  )
}

export function PitchCard({ pitch, compact }: { pitch: PitchDef; compact?: boolean }) {
  const Icon = PITCH_ICON[pitch.code] ?? CloudSun
  const fx: string[] = []
  if (pitch.paceBonus) fx.push(`Pace ${pitch.paceBonus > 0 ? '+' : ''}${pitch.paceBonus}`)
  if (pitch.spinBonus) fx.push(`Spin ${pitch.spinBonus > 0 ? '+' : ''}${pitch.spinBonus}${pitch.spinWearBonus ? ` (+${pitch.spinBonus + pitch.spinWearBonus} in 2nd inns)` : ''}`)
  if (pitch.batterBonus) fx.push(`Batters +${pitch.batterBonus}`)
  if (pitch.extraSeamEdges) fx.push('More edges to the keeper')
  return (
    <div className="flex gap-3">
      <span className="grid place-items-center w-12 h-12 shrink-0 rounded-xl bg-accent/15 text-accent"><Icon size={24} aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Pitch report</p>
        <p className="font-display text-2xl font-bold leading-tight">{pitch.name} <span className="text-base text-muted font-sans font-normal">· par {pitch.par}</span></p>
        {!compact && <p className="text-sm text-muted mt-0.5">{pitch.description}</p>}
        {fx.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {fx.map((f) => <span key={f} className="rounded-md bg-black/5 dark:bg-white/10 px-2 py-0.5 text-xs font-semibold">{f}</span>)}
          </div>
        )}
        {!compact && <p className="text-sm mt-2"><span className="font-semibold text-cta">Tip:</span> {pitch.tip}</p>}
      </div>
    </div>
  )
}

function StylePlan({ tactics }: { tactics: Tactics }) {
  return (
    <div className="grid gap-2 mt-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-14 text-muted">Batting</span>
        {tactics.batApproach.map((a, i) => (
          <span key={i} className="inline-flex items-center gap-1"><span className="text-xs text-muted">{['PP', 'Mid', 'Death'][i]}</span><PlanBadge kind="bat" value={a} /></span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-14 text-muted">Field</span>
        {tactics.fieldPlan.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-1"><span className="text-xs text-muted">Ov{i + 1}</span><PlanBadge kind="field" value={f} /></span>
        ))}
      </div>
    </div>
  )
}

/** Pitch + opposition scouting shown before a lineup is locked. */
export function ScoutingPanel({ pitch, style, oppCards }: { pitch?: PitchDef; style?: BotStyle | null; oppCards: PlayerCard[] }) {
  const scout = scoutBatters(oppCards)
  const mix = attackMix(oppCards)
  const flagged = scout.filter((s) => s.notes.length > 0)
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="glass rounded-2xl border border-border p-4 sm:p-5 space-y-4">
        {pitch ? <PitchCard pitch={pitch} /> : <p className="text-muted">Pitch report loading…</p>}
        <p className="text-xs text-muted flex items-start gap-1.5">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          Pitch bonuses add to a bowler’s skill rating on every ball. <Link to="/engine" className="underline">How it works</Link>
        </p>
      </div>
      <div className="glass rounded-2xl border border-border p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted"><Eye size={14} aria-hidden /> Scouting report</p>
        {style ? (
          <div className="mt-2">
            <p className="font-display text-2xl font-bold leading-tight">Captain style: <span className="text-cta">{style.name}</span></p>
            <p className="text-sm text-muted">{style.description}</p>
            <StylePlan tactics={style.tactics} />
          </div>
        ) : (
          <p className="text-sm text-muted mt-2">A real opponent’s plan stays secret until the match starts. Balanced plans are the safe bet.</p>
        )}
        {oppCards.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-sm"><Target size={14} className="inline mr-1 -mt-0.5" aria-hidden />Their attack: <b>{mix.pace}</b> pace, <b>{mix.spin}</b> spin</p>
            {flagged.length === 0 ? (
              <p className="text-sm text-muted mt-1">No obvious weaknesses against pace or spin in their batting.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {flagged.map((s) => (
                  <li key={s.card.id} className="flex items-center gap-2 text-sm">
                    <PlayerAvatar name={s.card.name} rarity={s.card.rarity} />
                    <span className="font-semibold truncate">{s.card.name}</span>
                    <span className="ml-auto flex flex-wrap justify-end gap-1">
                      {s.notes.map((n) => (
                        <span key={n.text} className={cn('rounded-md px-1.5 py-0.5 text-xs font-bold', n.tone === 'weak' ? 'bg-success/15 text-success' : 'bg-wicket/15 text-wicket')}>{n.text}</span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
