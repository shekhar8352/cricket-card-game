import { Crown, Shuffle } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { BreakCallDef } from '../../types/engine'

const STEP = {
  [-1]: { label: 'D', name: 'defend', cls: 'bg-accent/20 text-accent' },
  0: { label: 'B', name: 'balanced', cls: 'bg-black/10 dark:bg-white/15 text-muted' },
  1: { label: 'A', name: 'attack', cls: 'bg-cta text-cta-fg' },
} as const

const ADAPTIVE: Record<string, string> = {
  read: 'Captain reads them over by over',
  target_weak: 'Attacks their weakest bowler',
  match_ups: 'Attacks when the match-up suits',
}

/** Five chips, one per over: attack, balanced or defend. */
export function PlanOvers({ def, className }: { def: BreakCallDef; className?: string }) {
  if (def.mode !== 'fixed') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold text-muted', className)}>
        <Shuffle size={12} aria-hidden /> {ADAPTIVE[def.mode] ?? 'Adapts each over'}
      </span>
    )
  }
  const words = def.seq.map((v, i) => `over ${i + 1} ${STEP[v as -1 | 0 | 1].name}`).join(', ')
  return (
    <span className={cn('inline-flex gap-0.5', className)} role="img" aria-label={words}>
      {def.seq.map((v, i) => {
        const st = STEP[v as -1 | 0 | 1]
        return <span key={i} className={cn('grid place-items-center w-5 h-5 rounded text-[10px] font-bold', st.cls)}>{st.label}</span>
      })}
    </span>
  )
}

export const CAPTAIN_PLAN = 'captain'

/**
 * Pick a game plan for one innings. Fixed plans set the call for every over
 * (A attack, B balanced, D defend); "Captain decides" leaves it to the AI.
 */
export function GamePlanPicker({
  options, value, onChange, label, suggested, current, compact,
}: {
  options: BreakCallDef[]
  value: string
  onChange: (code: string) => void
  label: string
  suggested?: string
  /** The plan already in place (shown with a tag). */
  current?: string
  compact?: boolean
}) {
  const v = value || CAPTAIN_PLAN
  const all: (BreakCallDef | null)[] = [...options, null]
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')}>
      {all.map((o) => {
        const code = o?.code ?? CAPTAIN_PLAN
        const on = v === code
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(code === CAPTAIN_PLAN ? '' : code)}
            className={cn(
              'text-left rounded-xl border-2 px-3 py-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              on ? 'border-cta bg-cta/10' : 'border-border hover:border-muted',
            )}
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-display text-lg font-bold leading-tight">{o ? o.name : 'Captain decides'}</span>
              {suggested === code && <span className="shrink-0 rounded bg-success/15 text-success px-1.5 text-[10px] font-bold uppercase tracking-wide"><Crown size={10} className="inline -mt-0.5 mr-0.5" aria-hidden />Captain’s pick</span>}
              {current === code && suggested !== code && <span className="shrink-0 rounded bg-black/10 dark:bg-white/15 px-1.5 text-[10px] font-bold uppercase tracking-wide">Your plan</span>}
              {o?.mode === 'fixed' && <PlanOvers def={o} className="ml-auto shrink-0" />}
            </span>
            {o && o.mode !== 'fixed' && <PlanOvers def={o} className="mt-0.5" />}
            <span className={cn('block text-sm text-muted mt-0.5', compact && 'line-clamp-2')}>
              {o ? o.description : 'Your captain makes each call from their personality and what they read in the opposition.'}
            </span>
            {o?.weakness && <span className="block text-xs mt-1"><span className="text-muted">Struggles against:</span> <span className="font-semibold">{o.weakness}</span></span>}
          </button>
        )
      })}
    </div>
  )
}
