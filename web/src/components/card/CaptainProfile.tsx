import { Crown, Sparkles } from 'lucide-react'
import { cn } from '../../lib/cn'
import { CAPTAINCY_ATTRS, captainStyle } from '../../lib/captaincy'
import type { Captaincy, MasterstrokeDef } from '../../types/engine'

/** Four small bars for a captain's aggression, tactics, calm and flair. */
export function CaptaincyBars({ cp, compact }: { cp: Captaincy; compact?: boolean }) {
  return (
    <div className={cn('grid gap-1', compact ? 'grid-cols-2 gap-x-3' : '')}>
      {CAPTAINCY_ATTRS.map((a) => (
        <div key={a.key} className="flex items-center gap-2 text-xs" title={a.help}>
          <span className="w-16 text-muted">{a.label}</span>
          <span className="flex-1 h-1.5 rounded-full meter-track overflow-hidden">
            <span className="block h-full rounded-full bg-gradient-to-r from-accent-bright to-cta" style={{ width: `${cp[a.key]}%` }} />
          </span>
          <span className="w-6 text-right tabular font-semibold">{cp[a.key]}</span>
        </div>
      ))}
    </div>
  )
}

export function MasterstrokeLine({ def }: { def?: MasterstrokeDef }) {
  if (!def) return null
  return (
    <p className="text-xs mt-2 flex gap-1.5">
      <Sparkles size={13} className="text-cta shrink-0 mt-0.5" aria-hidden />
      <span><b>Masterstroke: {def.name}.</b> <span className="text-muted">{def.description}</span></span>
    </p>
  )
}

/** Full captain summary: style tag, bars, reputation and signature move. */
export function CaptainProfile({ name, cp, rep, def, className }: { name?: string; cp: Captaincy; rep?: number; def?: MasterstrokeDef; className?: string }) {
  return (
    <div className={className}>
      {name && (
        <p className="font-display text-xl font-bold leading-tight flex items-center gap-1.5">
          <Crown size={16} className="text-cta" aria-hidden /> {name}
        </p>
      )}
      <p className="text-sm text-cta font-semibold">{captainStyle(cp)}</p>
      <div className="mt-2"><CaptaincyBars cp={cp} /></div>
      {rep != null && rep > 0 && <p className="text-xs text-muted mt-1.5">Reputation {rep}/100 · Tactics +{Math.min(10, Math.floor(rep / 10))}</p>}
      <MasterstrokeLine def={def} />
    </div>
  )
}
