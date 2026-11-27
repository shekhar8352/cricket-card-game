import { sacrificeXP } from '../lib/training'
import { PlanOvers } from '../components/match/GamePlanPicker'
import { ArenaBadge } from '../components/trophy/ArenaBadge'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Calculator, Clock, Crown, Dice5, Eye, Gauge, Layers, Link2, ListChecks, Lock, Scale, Shield, ShieldAlert, Sparkles, Star, Swords, Trophy, Wind, Zap } from 'lucide-react'
import { CAPTAINCY_ATTRS } from '../lib/captaincy'
import { api } from '../api/client'
import { Panel } from '../components/ui/chrome'
import { PitchCard, PlanSegment } from '../components/match/MatchPlan'
import { cn } from '../lib/cn'
import { RatingBadge } from '../components/card/RatingBadge'
import { APPROACH, FIELD } from '../lib/strategy'
import type { Approach, BowlType, EngineModel, FieldPlan, Outcome, Pitch, WeightDelta } from '../types/engine'

const OUTCOMES: { key: Outcome; label: string; color: string }[] = [
  { key: 'dot', label: 'Dot', color: '#64748b' },
  { key: 'one', label: '1', color: '#60a5fa' },
  { key: 'two', label: '2', color: '#3b82f6' },
  { key: 'three', label: '3', color: '#1d4ed8' },
  { key: 'four', label: '4', color: '#12b76a' },
  { key: 'six', label: '6', color: '#8b5cf6' },
  { key: 'wicket', label: 'Wicket', color: '#dc2626' },
  { key: 'wide', label: 'Wide', color: '#f59e0b' },
  { key: 'noball', label: 'No-ball', color: '#fb923c' },
]

const TOC = [
  ['overview', 'The short version'],
  ['flow', 'How a match runs'],
  ['ball', 'One ball, step by step'],
  ['strategy', 'Strategy: approach & field'],
  ['conditions', 'Pitch, matchups, pressure'],
  ['traits', 'Player traits'],
  ['calculator', 'Odds calculator'],
  ['captains', 'Captains'],
  ['quirks', 'Powerplay, free hit, chemistry'],
  ['break', 'Innings break & Super Over'],
  ['ratings', 'Match ratings & XP'],
  ['after', 'After the match'],
  ['fairness', 'Fairness & bots'],
] as const

export function EnginePage() {
  const q = useQuery({ queryKey: ['engine-model'], queryFn: api.engineModel, staleTime: Infinity })
  const m = q.data

  return (
    <div className="lg:grid lg:grid-cols-[13rem_1fr] gap-8">
      <nav className="hidden lg:block" aria-label="On this page">
        <div className="sticky top-24 space-y-1 text-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">On this page</p>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-lg px-2 py-1.5 text-muted hover:text-fg hover:bg-black/5 dark:hover:bg-white/10">{label}</a>
          ))}
        </div>
      </nav>

      <article className="min-w-0 space-y-12 pb-16">
        <header className="hero-stadium rounded-3xl px-5 py-8 sm:px-8">
          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffd166]">Fully transparent</p>
            <h1 className="font-display text-5xl sm:text-6xl font-bold uppercase leading-[0.95] mt-2">How matches are simulated</h1>
            <p className="text-white/85 text-lg mt-3">
              Every ball is decided by the same published rules. The tables on this page are loaded live from the match engine, so what you read here is exactly what the game uses.
            </p>
          </div>
        </header>

        {q.isPending && <p className="text-muted">Loading the engine’s numbers…</p>}
        {q.isError && <p className="text-wicket">Couldn’t load the engine model: {(q.error as Error).message}</p>}
        {m && (
          <>
            <Overview m={m} />
            <Flow m={m} />
            <OneBall m={m} />
            <Strategy m={m} />
            <Conditions m={m} />
            <Traits m={m} />
            <OddsCalculator m={m} />
            <Captains m={m} />
            <Quirks m={m} />
            <BreakAndSuperOver m={m} />
            <Ratings m={m} />
            <After m={m} />
            <Fairness />
          </>
        )}
      </article>
    </div>
  )
}

/* ---------------------------------------------------------------- helpers */

function Section({ id, icon, title, lede, children }: { id: string; icon: ReactNode; title: string; lede?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <h2 id={`${id}-h`} className="flex items-center gap-2.5 font-display text-3xl sm:text-4xl font-bold uppercase">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent/15 text-accent">{icon}</span>
        {title}
      </h2>
      {lede && <p className="text-muted text-lg mt-2 max-w-3xl">{lede}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <code className="block rounded-xl bg-black/5 dark:bg-white/5 border border-border px-4 py-3 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre">{children}</code>
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-cta text-cta-fg font-display text-lg font-bold">{n}</span>
      <div className="min-w-0 flex-1 pt-1">
        <h3 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h3>
        <div className="mt-1.5 space-y-3 text-[15px] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

const DELTA_KEYS: (keyof WeightDelta)[] = ['dot', 'one', 'two', 'four', 'six', 'wicket']
const DELTA_LABEL: Record<keyof WeightDelta, string> = { dot: 'Dot', one: '1', two: '2', four: '4', six: '6', wicket: 'Wkt' }

function DeltaCells({ d }: { d?: WeightDelta }) {
  return (
    <>
      {DELTA_KEYS.map((k) => {
        const v = d?.[k] ?? 0
        return (
          <td key={k} className={cn('px-2 py-2 text-center tabular font-semibold', v > 0 && (k === 'wicket' || k === 'dot' ? 'text-wicket' : 'text-success'), v < 0 && (k === 'wicket' || k === 'dot' ? 'text-success' : 'text-wicket'), v === 0 && 'text-muted/60')}>
            {v > 0 ? `+${v}` : v === 0 ? '·' : v}
          </td>
        )
      })}
    </>
  )
}

/** Labeled, non-zero weight changes, e.g. "Wicket +4". Good for/bad for the batter is colour coded. */
function DeltaChips({ d }: { d: WeightDelta }) {
  const items = DELTA_KEYS.filter((k) => d[k])
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((k) => {
        const v = d[k]
        const goodForBatter = k === 'wicket' || k === 'dot' ? v < 0 : v > 0
        return (
          <span key={k} className={cn('rounded-md px-2 py-0.5 text-xs font-bold tabular', goodForBatter ? 'bg-success/15 text-success' : 'bg-wicket/15 text-wicket')}>
            {k === 'wicket' ? 'Wicket' : k === 'dot' ? 'Dot' : `${DELTA_LABEL[k]}s`} {v > 0 ? `+${v}` : v}
          </span>
        )
      })}
    </div>
  )
}

function DeltaHead({ first }: { first: string }) {
  return (
    <thead>
      <tr className="text-xs uppercase tracking-wider text-muted">
        <th scope="col" className="px-3 py-2 text-left">{first}</th>
        {DELTA_KEYS.map((k) => <th key={k} scope="col" className="px-2 py-2 text-center">{DELTA_LABEL[k]}</th>)}
      </tr>
    </thead>
  )
}

function Table({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border glass">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

function OddsBar({ odds }: { odds: Record<Outcome, number> }) {
  return (
    <div>
      <div className="flex h-8 rounded-lg overflow-hidden" role="img" aria-label={OUTCOMES.map((o) => `${o.label} ${(odds[o.key] * 100).toFixed(1)}%`).join(', ')}>
        {OUTCOMES.map((o) => odds[o.key] > 0 && (
          <div key={o.key} className="h-full grid place-items-center text-[11px] font-bold text-white transition-[width] duration-500" style={{ width: `${odds[o.key] * 100}%`, background: o.color }}>
            {odds[o.key] >= 0.06 ? o.label : ''}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
        {OUTCOMES.map((o) => (
          <span key={o.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: o.color }} />
            {o.label} <b className="tabular">{(odds[o.key] * 100).toFixed(1)}%</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- sections */

function Overview({ m }: { m: EngineModel }) {
  const items = [
    { Icon: Dice5, title: 'Ball by ball', body: `Each of up to ${m.format.overs * m.format.ballsPerOver * 2} legal deliveries is rolled from a weighted set of outcomes.` },
    { Icon: Scale, title: 'Skill sets the odds', body: 'Your cards’ attributes, your tactics, the pitch and the match situation move those weights.' },
    { Icon: Swords, title: 'Strategy can beat ratings', body: 'Plans counter each other, so a weaker side that reads the opponent can win.' },
    { Icon: Lock, title: 'No hidden hand', body: 'The engine never knows who is human, never adjusts for who is winning, and never looks at trophies.' },
  ]
  return (
    <Section id="overview" icon={<Eye size={20} />} title="The short version">
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(({ Icon, title, body }) => (
          <Panel key={title} className="flex gap-3">
            <Icon size={22} className="text-cta shrink-0 mt-0.5" aria-hidden />
            <div>
              <h3 className="font-display text-xl font-bold uppercase">{title}</h3>
              <p className="text-muted text-sm mt-0.5">{body}</p>
            </div>
          </Panel>
        ))}
      </div>
    </Section>
  )
}

function Flow({ m }: { m: EngineModel }) {
  const f = m.format
  return (
    <Section id="flow" icon={<ListChecks size={20} />} title="How a match runs">
      <ol className="space-y-3">
        {[
          ['Match created', 'A random seed is fixed for the match. It decides the pitch and every dice roll, before anyone picks a team.'],
          ['Pitch revealed', 'Both captains see the pitch report before choosing a lineup, so you can pick players who suit it.'],
          ['Lineups locked', 'Each side locks 7 players (3 batters, 1 keeper, 1 all-rounder, 2 bowlers), a captain, a batting order and who bowls each over.'],
          ['Toss', 'A 50/50 coin flip from the seed. The winning captain decides to bat or chase, reading the pitch if they are sharp enough.'],
          ['First innings', `${f.overs} overs of ${f.ballsPerOver} legal balls. It ends after ${f.maxWickets} wickets or ${f.overs} overs. Overs 1–2 are the powerplay. Captains make a call every over.`],
          ['Innings break', 'The match pauses. The second-innings conditions are revealed and each side makes a captain’s call, and may change its batting order (chasing) or bowling order (defending).'],
          ['Chase', 'The second innings ends the moment the target is passed. A tie goes to a Super Over.'],
          ['Result', 'Most runs wins. Equal scores is a tie. Then trophies, rewards and player of the match are worked out.'],
        ].map(([t, b], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full border-2 border-accent text-accent font-display font-bold">{i + 1}</span>
            <div className="pt-0.5"><b>{t}.</b> <span className="text-muted">{b}</span></div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function SkillCurve({ scale, width }: { scale: number; width: number }) {
  const W = 320, H = 150, max = 60
  const x = (g: number) => ((g + max) / (2 * max)) * W
  const y = (v: number) => H / 2 - (v / 22) * (H / 2 - 10)
  const pts = (fn: (g: number) => number) => Array.from({ length: 121 }, (_, i) => -max + i).map((g) => `${x(g).toFixed(1)},${y(fn(g)).toFixed(1)}`).join(' ')
  return (
    <figure className="glass rounded-2xl border border-border p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label="Skill gap to weight shift curve compared with a straight line">
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="currentColor" opacity="0.2" />
        <line x1={W / 2} x2={W / 2} y1={0} y2={H} stroke="currentColor" opacity="0.2" />
        <polyline points={pts((g) => g / 3)} fill="none" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="1.5" />
        <polyline points={pts((g) => Math.round(scale * Math.tanh(g / width)))} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <text x={4} y={12} fontSize="10" fill="currentColor" opacity="0.6">batter better →</text>
        <text x={W - 4} y={H - 4} fontSize="10" fill="currentColor" opacity="0.6" textAnchor="end">skill gap (−{max} to +{max})</text>
      </svg>
      <figcaption className="text-xs text-muted mt-2">
        <span className="inline-block w-3 h-0.5 bg-accent align-middle mr-1" /> Engine curve: shift = {scale} × tanh(gap ÷ {width}).
        <span className="inline-block w-3 border-t border-dashed border-slate-400 align-middle mx-1 ml-3" /> A straight line, for comparison. Small gaps count fully; huge gaps are capped, which leaves room for tactics.
      </figcaption>
    </figure>
  )
}

function OneBall({ m }: { m: EngineModel }) {
  const total = Object.values(m.baseWeights).reduce((a, b) => a + b, 0)
  const baseOdds = Object.fromEntries(Object.entries(m.baseWeights).map(([k, v]) => [k, v / total])) as Record<Outcome, number>
  return (
    <Section id="ball" icon={<Dice5 size={20} />} title="One ball, step by step" lede="The engine builds a set of weights for the nine possible outcomes, adjusts them in this exact order, then picks one at random in proportion to its weight.">
      <Step n={1} title="Start from the base weights">
        <p>Before anything else, an average ball looks like this (weights sum to {total}):</p>
        <OddsBar odds={baseOdds} />
      </Step>
      <Step n={2} title="Traits adjust attributes">
        <p>Traits that apply to this ball (see <a className="underline" href="#traits">Player traits</a>) change the batter’s or bowler’s attributes for this delivery only. Card levels have already added <b>+{m.progression.levelBonus}</b> per level above 1 to the attributes of that card’s role.</p>
      </Step>
      <Step n={3} title="Rate the batter and the bowler">
        <Formula>{`Batter skill = 0.5 × Technique + 0.3 × Power + 0.2 × (vs Pace or vs Spin)  + pitch batter bonus
Bowler skill = 0.4 × Accuracy + 0.3 × Variation + 0.3 × Wicket-taking  + pitch pace/spin bonus
              + 0.15 × Death bowling   (last over, or a chase needing more than 12 an over)
Skill gap    = Batter skill − Bowler skill`}</Formula>
      </Step>
      <Step n={4} title="Bowler accuracy">
        <Formula>{`a = (Accuracy − 70) ÷ 8      wides −a (1–8)   no-balls −a÷2 (0–4)   dots +a`}</Formula>
      </Step>
      <Step n={5} title="Turn the skill gap into weight shifts">
        <Formula>{`shift = round(${m.skillCurve.scale} × tanh(gap ÷ ${m.skillCurve.width}))
fours +shift (4–22)   sixes +shift÷2 (2–16)   singles +shift÷4 (18–38)
dots −shift (14–42)   wickets −shift÷2 (3–14)`}</Formula>
        <SkillCurve scale={m.skillCurve.scale} width={m.skillCurve.width} />
      </Step>
      <Step n={6} title="Batter attributes and the situation">
        <ul className="list-disc pl-5 space-y-1 text-muted">
          <li><b className="text-fg">Power above 75:</b> sixes +(Power−75)÷8, fours +(Power−75)÷12.</li>
          <li><b className="text-fg">Timing above 70:</b> singles +(Timing−70)÷6, dots −(Timing−70)÷8.</li>
          <li><b className="text-fg">Set batter</b> (4+ balls faced): wickets −2, singles +2. <b className="text-fg">Already dropped:</b> wickets −1.</li>
          <li><b className="text-fg">Last over, or chasing at more than 12 an over:</b> fours +3, sixes +3, wickets +2, dots −4.</li>
          <li><b className="text-fg">Chasing above 10 an over:</b> fours, sixes and wickets rise further with the required rate (up to +8).</li>
          <li><b className="text-fg">4+ wickets down:</b> wickets −1 (the tail digs in).</li>
          <li><b className="text-fg">Temperament under pressure</b> (last over, tight chase or 3+ down): wickets −(Temperament−70)÷8, singles by the same amount.</li>
          <li><b className="text-fg">Left-handed batter:</b> wides +1.</li>
        </ul>
      </Step>
      <Step n={7} title="Apply both captains’ plans">
        <p>The batting side’s approach for this phase and the fielding side’s field for this over add their effects, plus a counter bonus if the two meet. Full tables in <a className="underline" href="#strategy">Strategy</a>.</p>
      </Step>
      <Step n={8} title="Matchup and pressure">
        <p>A batter weak against this bowling type (below {m.matchup.weakBelow}) or strong against it ({m.matchup.strongAtLeast}+) gets a matchup effect, and consecutive dot balls add pressure. See <a className="underline" href="#conditions">Pitch, matchups, pressure</a>.</p>
      </Step>
      <Step n={9} title="Trait multipliers, then roll">
        <p>Boundary and wicket multipliers from traits apply last (for example Yorker King ×0.85 on sixes). Dot, single, four, six and wicket weights never drop below 1. Then one outcome is drawn: an outcome with weight 12 out of a total of 100 has a 12% chance.</p>
      </Step>
      <Step n={10} title="Resolve what happened">
        <div className="grid sm:grid-cols-2 gap-3">
          <Panel className="!p-4 text-sm">
            <h4 className="font-bold">Extras</h4>
            <p className="text-muted mt-1">Wide or no-ball: 1 run, the ball is bowled again. On a dot or single, a ball can beat the keeper for byes: (100 − Keeping) ÷ 5 % chance (+3 for a pace bowler with Movement above 75). 1 bye, or 2–4 one time in five.</p>
          </Panel>
          <Panel className="!p-4 text-sm">
            <h4 className="font-bold">Running and fielding</h4>
            <p className="text-muted mt-1">Running above 78 can turn a single into two ((Running−78)×2 %); above 82, two into three. A grounded four can be stopped by the fielder in that zone: (Ground fielding−60)÷5 % to make it 2 or 3. A two can be cut to one: (Ground fielding−65)÷6 %.</p>
          </Panel>
          <Panel className="!p-4 text-sm">
            <h4 className="font-bold">Run-outs</h4>
            <p className="text-muted mt-1">On 1–3 runs: 1 + (Throwing + Ground fielding)÷80 − Running÷40 % chance, +4 when going for a third, +2 in a tight chase, ×1.15 for Rocket Arm (minimum 1%).</p>
          </Panel>
          <Panel className="!p-4 text-sm">
            <h4 className="font-bold">Wickets and catches</h4>
            <p className="text-muted mt-1">The kind of dismissal is drawn by bowling type. Pace: bowled 18, lbw 14, caught behind 30, caught 32, caught &amp; bowled 6. Spin: bowled 16, lbw 10, stumped 20, caught behind 12, caught 36, caught &amp; bowled 6. Caught behind gets +8 for Movement above 75 and more on a green pitch; caught gets +8 when the batter is attacking or chasing hard. Bowled and lbw always stand. Catches and stumpings stick with probability 16 + 0.8 × fielder rating %. A drop means the batter survives (45% of the time they still take a single).</p>
          </Panel>
        </div>
      </Step>
    </Section>
  )
}

function Strategy({ m }: { m: EngineModel }) {
  const apps: Approach[] = ['defend', 'balanced', 'attack']
  const fields: FieldPlan[] = ['defend', 'balanced', 'attack']
  const cell = (a: Approach, f: FieldPlan) => m.matrix.find((c) => c.approach === a && c.field === f)
  const runs = m.matrix.map((c) => c.runs)
  const lo = Math.min(...runs), hi = Math.max(...runs)
  const bestBat = (f: FieldPlan) => apps.reduce((b, a) => ((cell(a, f)?.runs ?? 0) > (cell(b, f)?.runs ?? 0) ? a : b))
  return (
    <Section id="strategy" icon={<Swords size={20} />} title="Strategy: approach & field" lede="This is where a weaker team can win. Each plan beats one plan and loses to another, so there is no single best choice.">
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="font-bold mb-2">Batting approach <span className="text-muted font-normal">· set per phase: {m.phases.join(', ')}</span></h3>
          <Table caption="Batting approach effects">
            <DeltaHead first="Approach" />
            <tbody>
              {apps.map((a) => (
                <tr key={a} className="border-t border-border"><th scope="row" className="px-3 py-2 text-left">{APPROACH[a].label}</th><DeltaCells d={m.approachEffects[a]} /></tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div>
          <h3 className="font-bold mb-2">Field setting <span className="text-muted font-normal">· set for each over</span></h3>
          <Table caption="Field setting effects">
            <DeltaHead first="Field" />
            <tbody>
              {fields.map((f) => (
                <tr key={f} className="border-t border-border"><th scope="row" className="px-3 py-2 text-left">{FIELD[f].label}</th><DeltaCells d={m.fieldEffects[f]} /></tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      <h3 className="font-bold pt-2">Counters: when a batting approach meets a field</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {m.counters.map((c) => (
          <Panel key={c.name} className="!p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{APPROACH[c.approach].label} batting vs {FIELD[c.field].label.toLowerCase()} field</p>
            <p className="font-display text-2xl font-bold text-cta">{c.name}</p>
            <p className="text-sm text-muted">{c.why}</p>
            <DeltaChips d={c.effect} />
          </Panel>
        ))}
      </div>

      <h3 className="font-bold pt-2">What it adds up to</h3>
      <p className="text-sm text-muted">Green numbers help the batting side, red help the bowling side. Average first-innings total for two identical average sides when each plan is held for the whole innings. Measured live by running the engine 2,000 times per cell. Starred cells are the batting side’s best reply to that field.</p>
      <Table caption="Average runs by batting approach and field">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted">
            <th scope="col" className="px-3 py-2 text-left">Batting ↓ / Field →</th>
            {fields.map((f) => <th key={f} scope="col" className="px-3 py-2 text-center">{FIELD[f].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a} className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left">{APPROACH[a].label}</th>
              {fields.map((f) => {
                const c = cell(a, f)
                const t = c ? (c.runs - lo) / Math.max(1, hi - lo) : 0
                return (
                  <td key={f} className="px-3 py-2 text-center tabular" style={{ background: `color-mix(in srgb, #12b76a ${Math.round(t * 45)}%, transparent)` }}>
                    <span className="font-display text-xl font-bold">{c?.runs.toFixed(1)}{bestBat(f) === a ? '★' : ''}</span>
                    <span className="block text-xs text-muted">{c?.wickets.toFixed(2)} wkts</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Table>
      <Panel className="!p-4 text-sm">
        <b>Reading the table.</b> Against a defensive field, defensive batting scores most. Against an attacking field, attacking batting does. The fielding side wants the opposite, so each side guesses at the other. Balanced batting has the best worst case, which makes it the safe default.
      </Panel>

      <p className="text-sm text-muted">You never set these by hand: captains choose an approach and a field every over. See <a className="underline" href="#captains">Captains</a>.</p>
    </Section>
  )
}

function Conditions({ m }: { m: EngineModel }) {
  return (
    <Section id="conditions" icon={<Wind size={20} />} title="Pitch, matchups, pressure">
      <h3 className="font-bold">Pitches</h3>
      <p className="text-sm text-muted">The pitch comes from the match seed: balanced two times in five, each other pitch one time in five. Bonuses add to the bowler’s or batter’s skill rating in step 3. Par is the measured average first-innings total.</p>
      <div className="grid md:grid-cols-2 gap-3">
        {m.pitches.map((p) => <Panel key={p.code} className="!p-4"><PitchCard pitch={p} /></Panel>)}
      </div>

      <div className="grid md:grid-cols-2 gap-4 pt-2">
        <Panel>
          <h3 className="font-bold flex items-center gap-2"><Shield size={18} aria-hidden /> Matchups</h3>
          <p className="text-sm text-muted mt-1">Each batter has separate skills against pace and spin. On every ball the engine checks the one for this bowler’s type:</p>
          <div className="overflow-x-auto mt-2">
          <table className="text-sm">
            <tbody>
              <tr><th className="text-left pr-3 font-semibold">Below {m.matchup.weakBelow}</th><DeltaCells d={m.matchup.weakEffect} /></tr>
              <tr><th className="text-left pr-3 font-semibold">{m.matchup.strongAtLeast} or more</th><DeltaCells d={m.matchup.strongEffect} /></tr>
            </tbody>
          </table>
          </div>
          <p className="text-sm text-muted mt-2">The scouting report flags these before the match. Bowl spin at a batter who is weak against spin.</p>
        </Panel>
        <Panel>
          <h3 className="font-bold flex items-center gap-2"><Gauge size={18} aria-hidden /> Pressure</h3>
          <p className="text-sm text-muted mt-1">
            Consecutive dot balls build pressure. From {m.pressure.startsAt} dots in a row (counting up to {m.pressure.max}), the next ball gets wickets +(dots − {m.pressure.startsAt - 1}) and singles +1. Calm batters resist: subtract (Temperament − 60) ÷ 15. Any run, extra or wicket resets the count.
          </p>
          <Formula>{`extra wicket weight = min(dots, ${m.pressure.max}) − ${m.pressure.startsAt - 1} − (Temperament − 60) ÷ 15`}</Formula>
        </Panel>
      </div>
    </Section>
  )
}

function Traits({ m }: { m: EngineModel }) {
  return (
    <Section id="traits" icon={<Layers size={20} />} title="Player traits" lede="Some cards carry traits. They only apply in the situation described.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {m.traits.map((t) => (
          <Panel key={t.code} className="!p-4">
            <p className="font-bold">{t.name}</p>
            <p className="text-sm text-muted">{t.description}</p>
          </Panel>
        ))}
      </div>
    </Section>
  )
}

function Slider({ label, value, min, max, onChange, suffix }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm"><span className="font-semibold">{label}</span><b className="tabular">{value}{suffix}</b></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)] cursor-pointer" />
    </label>
  )
}

function OddsCalculator({ m }: { m: EngineModel }) {
  const [batter, setBatter] = useState(75)
  const [vs, setVs] = useState(75)
  const [bowler, setBowler] = useState(75)
  const [bowlType, setBowlType] = useState<BowlType>('pace')
  const [approach, setApproach] = useState<Approach>('balanced')
  const [field, setField] = useState<FieldPlan>('balanced')
  const [pitch, setPitch] = useState<Pitch>('balanced')
  const [over, setOver] = useState(2)
  const [pressure, setPressure] = useState(0)
  const [chase, setChase] = useState(false)
  const [need, setNeed] = useState(20)
  const body = { batterRating: batter, batterVs: vs, bowlerRating: bowler, bowlType, approach, field, pitch, over, innings: (chase ? 2 : 1) as 1 | 2, pressure, wickets: 1, need }
  const q = useQuery({ queryKey: ['odds', body], queryFn: () => api.engineOdds(body), placeholderData: (prev) => prev })
  const r = q.data
  const ballsLeft = (m.format.overs - over + 1) * m.format.ballsPerOver

  return (
    <Section id="calculator" icon={<Calculator size={20} />} title="Odds calculator" lede="Set up any delivery and see the exact odds the engine would use. This calls the same function the match simulation uses.">
      <div className="grid lg:grid-cols-[22rem_1fr] gap-4">
        <Panel className="space-y-4">
          <Slider label="Batter rating" value={batter} min={30} max={99} onChange={(n) => { setBatter(n); setVs(n) }} />
          <Slider label={`Batter vs ${bowlType}`} value={vs} min={30} max={99} onChange={setVs} />
          <Slider label="Bowler rating" value={bowler} min={30} max={99} onChange={setBowler} />
          <div className="grid grid-cols-2 gap-2">
            {(['pace', 'spin'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={bowlType === t} onClick={() => setBowlType(t)} className={cn('min-h-9 rounded-lg border text-sm font-semibold cursor-pointer capitalize', bowlType === t ? 'bg-accent text-accent-fg border-accent' : 'border-border')}>{t}</button>
            ))}
          </div>
          <div><p className="text-sm font-semibold mb-1">Batting approach</p><PlanSegment kind="bat" label="Batting approach" value={approach} onChange={setApproach} /></div>
          <div><p className="text-sm font-semibold mb-1">Field</p><PlanSegment kind="field" label="Field" value={field} onChange={setField} /></div>
          <label className="block text-sm">
            <span className="font-semibold">Pitch</span>
            <select value={pitch} onChange={(e) => setPitch(e.target.value as Pitch)} className="mt-1 w-full min-h-10 rounded-lg border border-border bg-card px-2 cursor-pointer">
              {m.pitches.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </label>
          <Slider label="Over" value={over} min={1} max={m.format.overs} onChange={setOver} />
          <Slider label="Dot balls in a row" value={pressure} min={0} max={m.pressure.max} onChange={setPressure} />
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <input type="checkbox" checked={chase} onChange={(e) => setChase(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" /> Second innings (chasing)
          </label>
          {chase && <Slider label={`Runs needed (from ${ballsLeft} balls)`} value={need} min={1} max={90} onChange={setNeed} />}
        </Panel>
        <div className="space-y-4">
          <Panel>
            {!r ? <p className="text-muted">Calculating…</p> : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Runs per ball</p><p className="font-display text-4xl font-bold tabular">{r.runsPerBall.toFixed(2)}</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Wicket chance</p><p className="font-display text-4xl font-bold tabular text-wicket">{(r.wicketChance * 100).toFixed(1)}%</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Skill gap</p><p className="font-display text-4xl font-bold tabular">{r.skillGap > 0 ? '+' : ''}{r.skillGap.toFixed(1)}</p><p className="text-xs text-muted">shift {r.skillShift > 0 ? '+' : ''}{r.skillShift}</p></div>
                </div>
                <OddsBar odds={r.odds} />
                <p className="text-xs text-muted mt-3">Runs per ball counts runs off the bat plus wides and no-balls, before fielding and running adjustments. The batter is assumed settled (2 balls faced) with one wicket down.</p>
              </>
            )}
          </Panel>
          {r && (r.factors?.length ?? 0) > 0 && (
            <Panel>
              <h3 className="font-bold mb-2">Strategy, matchup and pressure effects on this ball</h3>
              <table className="text-sm w-full">
                <DeltaHead first="Factor" />
                <tbody>
                  {r.factors.map((f) => <tr key={f.name} className="border-t border-border"><th scope="row" className="px-3 py-2 text-left">{f.name}</th><DeltaCells d={f.effect} /></tr>)}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      </div>
    </Section>
  )
}

function Captains({ m }: { m: EngineModel }) {
  const c = m.captain
  return (
    <Section id="captains" icon={<Crown size={20} />} title="Captains" lede="You pick a captain; the captain makes every tactical call. Each player has captaincy ratings, and every call involves some chance, so a captain’s style tells you their tendencies but not their next move.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CAPTAINCY_ATTRS.map((a) => (
          <Panel key={a.key} className="!p-4">
            <p className="font-bold">{a.label}</p>
            <p className="text-sm text-muted">{a.help}</p>
          </Panel>
        ))}
      </div>
      <p className="text-sm text-muted">Well-known captains have hand-set profiles based on their reputations (for example an aggressive chaser, a calm finisher, a patient tactician). Everyone else gets a profile from their attributes: power vs technique for aggression, temperament for calm, technique and temperament for tactics (keepers get a bonus), and traits for flair, plus a small fixed variation per player.</p>
      <h3 className="font-bold pt-2">How a captain decides each over</h3>
      <Formula>{`for each option (defend = −1, balanced = 0, attack = +1):
  score = (Aggression − 50) ÷ ${c.aggressionDivisor} × option
        + situation × option × judgement        judgement = ${c.judgementBase} + Tactics ÷ 100 × ${c.judgementScale}
        + innings-break plan bias × option
        + ${c.readBonus} on the counter to the opponent’s most common call so far,
          with probability Tactics%   (the captain "reads" them)

pick at random, weighted by exp(score ÷ temperature)
  temperature = ${c.tempBase} + Flair ÷ ${c.tempFlairDivisor} − (Tactics − 50) ÷ ${c.tempTacticsDivisor}   (at least ${c.tempMin})`}</Formula>
      <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
        <li><b className="text-fg">Batting situation:</b> lean to attack in the powerplay and the last over; attack harder the further behind the required rate; defend with 4+ wickets down.</li>
        <li><b className="text-fg">Fielding situation:</b> attack with the new ball and when 4+ wickets are down; defend the rope when the batters must score fast and in the last over.</li>
        <li><b className="text-fg">Calm:</b> each point above 50 reduces the dot-ball pressure on that team’s batters ({c.calmDivisor} calm = 1 weight).</li>
        <li><b className="text-fg">Armband:</b> the captain gets +{c.armbandTemperament} temperament when batting.</li>
        <li><b className="text-fg">Reputation:</b> captains earn reputation every match; each {c.repPerTactics} points adds +1 Tactics, up to +{c.repMaxBonus}.</li>
        <li><b className="text-fg">Reading pays most against predictable captains.</b> In testing, a sharp captain wins about 68% against a predictable one between equal teams, but only about 55% against a hard-to-read one.</li>
      </ul>
      <h3 className="font-bold pt-2">Masterstrokes</h3>
      <p className="text-sm text-muted">Each captain has one signature move per match, lasting one over. When its trigger condition is met, the captain plays it with a chance based on Tactics (always by the last over). High-flair captains may play it early.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {m.masterstrokes.map((ms) => (
          <Panel key={ms.code} className="!p-4">
            <p className="font-bold flex items-center gap-1.5"><Sparkles size={14} className="text-cta" aria-hidden />{ms.name} <span className="text-xs text-muted font-normal">· {ms.side === 'bat' ? 'batting' : 'bowling'}</span></p>
            <p className="text-sm text-muted">{ms.description}</p>
            <DeltaChips d={ms.effect} />
            {(ms.noPressure || ms.earlyPress || (ms.tempBoost ?? 0) > 0) && (
              <p className="text-xs text-muted mt-1">{[ms.noPressure && 'Ignores pressure', ms.earlyPress && 'Pressure from the first dot', ms.tempBoost && `Temperament +${ms.tempBoost}`].filter(Boolean).join(' · ')}</p>
            )}
          </Panel>
        ))}
      </div>
    </Section>
  )
}

function Quirks({ m }: { m: EngineModel }) {
  const ch = m.chemistry
  return (
    <Section id="quirks" icon={<Zap size={20} />} title="Powerplay, free hit, chemistry">
      <div className="grid md:grid-cols-2 gap-4">
        <Panel>
          <h3 className="font-bold">Powerplay (overs 1–{m.powerplay.overs})</h3>
          <p className="text-sm text-muted mt-1">Only 2 fielders are allowed outside the ring. Defensive fields work at half strength (so does the Holing out counter), fielders can’t save grounded boundaries, and every ball gets:</p>
          <DeltaChips d={m.powerplay.effect} />
        </Panel>
        <Panel>
          <h3 className="font-bold">Free hit</h3>
          <p className="text-sm text-muted mt-1">The ball after a no-ball can’t produce a wicket except a run-out (it carries over a wide). Batters swing freely:</p>
          <DeltaChips d={m.freeHit} />
        </Panel>
        <Panel>
          <h3 className="font-bold flex items-center gap-1.5"><Link2 size={16} aria-hidden /> Batting chemistry</h3>
          <p className="text-sm text-muted mt-1">The two batters at the crease have a link: +{ch.sameCountry} for the same country, +{ch.knownPartnership} for a known partnership (up to {ch.maxLink}). Each level adds +{ch.singlesPerLink} to singles and −{ch.dotsPerLink} to dots, gives a +{ch.runUpgradePerLink}% chance to turn a single into two, and cuts run-out risk by {ch.runOutCutPerLink}%. Team chemistry (0–100) on the lineup screen scores neighbouring pairs in your batting order.</p>
        </Panel>
        <Panel>
          <h3 className="font-bold flex items-center gap-1.5"><ShieldAlert size={16} aria-hidden /> Rivalries</h3>
          <p className="text-sm text-muted mt-1">Your matches remember every bowler-vs-batter head-to-head. Once one of your bowlers has dismissed an opposing batter {m.rival.dismissals} times, he “has his number”:</p>
          <DeltaChips d={m.rival.effect} />
        </Panel>
      </div>
    </Section>
  )
}

function BreakAndSuperOver({ m }: { m: EngineModel }) {
  return (
    <Section id="break" icon={<Clock size={20} />} title="Innings break & Super Over">
      <p className="text-muted">
        Before the match you pick two game plans: one for if you bat first and one for if you bowl first. At the break you pick the plan for the second innings (your first-innings plan for that discipline carries on unless you change it), and may change your order: the chasing side its batting order, the defending side its bowling order.
        A fixed plan sets the batting approach or field for every over (A attack, B balanced, D defend); adaptive plans decide each over from the match-up or by reading the opposition; “Captain decides” leaves every over to your captain’s personality.
        A batting plan in a chase always switches to attack once the asking rate reaches {m.plans?.chaseOverrideRRR ?? 13} an over.
        In matches against players, you have {m.pause.breakGraceSeconds} seconds at the break; after that your pre-match plan carries on. Bots decide instantly.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {(['bat', 'bowl'] as const).map((side) => (
          <Panel key={side}>
            <h3 className="font-bold">{side === 'bat' ? 'Batting' : 'Bowling'} plans</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {m.breakCalls.filter((b) => b.side === side).map((b) => (
                <li key={b.code}>
                  <span className="flex items-center gap-2"><b>{b.name}</b> <PlanOvers def={b} /></span>
                  <span className="text-muted">{b.description}</span>
                  {b.weakness && <span className="block text-xs text-muted">Struggles against: {b.weakness}</span>}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
      <h3 className="font-bold pt-2">Conditions twist</h3>
      <p className="text-sm text-muted">Revealed at the break and applied to the second innings (and any Super Over). Decided by the match seed. The effects are deliberately small, about half a pitch type's, so they nudge the chase rather than swing it.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {m.conditions.map((c) => (
          <Panel key={c.code} className="!p-4 text-sm">
            <p className="font-bold">{c.name} <span className="text-muted font-normal">· {c.chance}% of matches</span></p>
            <p className="text-muted">{c.description}</p>
          </Panel>
        ))}
      </div>
      <Panel>
        <h3 className="font-bold">Super Over</h3>
        <p className="text-sm text-muted mt-1">A tie pauses the match again. Each side picks {m.superOver.batters} batters and 1 bowler ({m.superOver.graceSeconds} seconds against players). The side that batted second bats first; an innings is one over and ends at {m.superOver.wickets} wickets. Still level? More boundaries in the Super Over wins, then more boundaries in the whole match.</p>
      </Panel>
      <Panel>
        <h3 className="font-bold">Win streaks and captain reputation</h3>
        <p className="text-sm text-muted mt-1">
          Win streaks add bonus trophies: {Object.entries(m.streak.bonus).map(([n, b]) => `${n} wins +${b}`).join(', ')} (5 or more stays at +{m.streak.bonus['5']}). From {m.streak.boostAt} wins in a row, one reward card is rolled with the next arena’s odds.
          Captains gain {m.reputation.perMatch} reputation per match, +{m.reputation.perWin} for a win and +1 for every {m.reputation.readsPerPoint} good reads (up to {m.reputation.max}); every {m.reputation.perTactics} points is +1 Tactics, up to +{m.reputation.maxTactics}.
        </p>
      </Panel>
    </Section>
  )
}

function Ratings({ m }: { m: EngineModel }) {
  const r = m.ratings
  const px = m.progression.performanceXP
  const examples = [5, 6, 7, 8, 9, 10]
  const xpAt = (v: number) => Math.max(px.min, px.min + Math.round((v - px.fromRating) * px.perPoint))
  const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, ''))
  return (
    <Section id="ratings" icon={<Star size={20} />} title="Match ratings & XP" lede={`After every match each player gets a rating from ${r.min.toFixed(1)} to ${r.max.toFixed(1)}. Your cards keep their average, so you can pick players who are in form.`}>
      <Formula>{`rating = ${r.base.toFixed(1)}  (everyone starts here)

batting   + (runs − balls × ${r.parRunsPerBall}) × ${f(r.batPerRunAbovePar)}     scoring faster than par
          + runs × ${f(r.batPerRun)}                          volume
          ${r.duck} for a duck, ${r.cheapDismissal} if out for under ${r.cheapBelow}, +${r.notOutBonus} if not out on ${r.notOutMinRuns}+
bowling   + wickets × ${r.bowlPerWicket}
          + (balls × ${r.parRunsPerBall} − runs conceded) × ${f(r.bowlPerRunBelowPar)}   conceding less than par
fielding  + ${r.catch} per catch, +${r.stumping} per stumping, +${r.runOut} per run-out,
          ${r.drop} per drop, +${r.save} per fielding save
result    + ${r.win} for the winning side, +${r.playerOfMatch} for player of the match

then kept between ${r.min} and ${r.max} and rounded to one decimal`}</Formula>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel>
          <h3 className="font-bold">Performance XP</h3>
          <p className="text-sm text-muted mt-1">Every card that plays earns a small amount of XP from its rating, win or lose: {px.min} XP, plus {px.perPoint} for each point above {px.fromRating.toFixed(1)}. Level 2 needs {m.progression.xpPerLevel} XP, so this adds up slowly next to training.</p>
          <table className="text-sm mt-3">
            <tbody>
              <tr><th className="text-left pr-3 text-muted font-semibold">Rating</th>{examples.map((v) => <td key={v} className="px-2 text-center tabular">{v.toFixed(1)}</td>)}</tr>
              <tr><th className="text-left pr-3 text-muted font-semibold">XP</th>{examples.map((v) => <td key={v} className="px-2 text-center tabular font-bold">{xpAt(v)}</td>)}</tr>
            </tbody>
          </table>
        </Panel>
        <Panel>
          <h3 className="font-bold">Reading the colours</h3>
          <ul className="text-sm mt-2 space-y-1.5">
            {[[8, 'Elite: 8.0 and up'], [7, 'Good: 7.0–7.9'], [6, 'Average: 6.0–6.9'], [5, 'Poor: below 6.0']].map(([v, t]) => (
              <li key={t} className="flex items-center gap-2"><RatingBadge value={v as number} className="text-sm px-1.5 py-0.5" /> {t}</li>
            ))}
          </ul>
          <p className="text-sm text-muted mt-2">A card’s badge shows its average across every match it has played. Sort by it in your collection or lineup, or use “Fill in-form 7”.</p>
        </Panel>
      </div>
    </Section>
  )
}

function After({ m }: { m: EngineModel }) {
  const p = m.progression
  const rarities = ['Bronze', 'Silver', 'Gold', 'Legend'] as const
  return (
    <Section id="after" icon={<Trophy size={20} />} title="After the match">
      <div className="grid md:grid-cols-2 gap-4">
        <Panel>
          <h3 className="font-bold">Player of the match</h3>
          <p className="text-sm text-muted mt-1">The player with the most points across both innings:</p>
          <Formula>{`batting  = runs + fours + 2 × sixes
bowling  = 22 × wickets − runs conceded ÷ 3
fielding = 12 × catches + 16 × stumpings + 14 × run-outs
         + 3 × fielding saves − 6 × drops`}</Formula>
        </Panel>
        <Panel>
          <h3 className="font-bold">Trophies</h3>
          <Formula>{`change = 30 + (opponent trophies − your trophies) ÷ 20
kept between 20 and 40, added on a win, taken on a loss, 0 on a tie`}</Formula>
          <p className="text-sm text-muted mt-2">Trophies never go below 0. A tie leaves them unchanged.</p>
        </Panel>
        <Panel>
          <h3 className="font-bold">Arenas and divisions</h3>
          <p className="text-sm text-muted mt-1">
            {m.arenas.length} arenas, each split into divisions III, II and I ({m.trophyRules.divisions} steps; III is the entry division). The top arena, {m.arenas[m.arenas.length - 1]?.name}, has no divisions.
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="text-sm w-full tabular">
              <thead><tr className="text-xs uppercase text-muted"><th className="text-left py-1">Arena</th><th className="text-right py-1 px-1">III</th><th className="text-right py-1 px-1">II</th><th className="text-right py-1 px-1">I</th><th className="text-right py-1 px-1">First reach</th></tr></thead>
              <tbody>
                {m.arenas.map((a) => {
                  const steps = m.trophyRules.road.filter((s) => s.arena === a.name)
                  const at = (d: number) => steps.find((s) => s.division === d)?.minTrophy
                  return (
                    <tr key={a.name} className="border-t border-border">
                      <th scope="row" className="text-left py-1 font-medium"><span className="inline-flex items-center gap-2"><ArenaBadge arena={a.name} size="xs" />{a.name}</span></th>
                      {steps.length === 1 ? <td colSpan={3} className="text-right px-1">{a.minTrophy.toLocaleString()}+</td> : [3, 2, 1].map((d) => <td key={d} className="text-right px-1">{at(d)?.toLocaleString()}</td>)}
                      <td className="text-right px-1">{m.trophyRules.milestoneFloor[a.name] ? `${m.trophyRules.milestoneFloor[a.name]}+ card` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted mt-2">
            <b className="text-fg">{m.trophyRules.buffer}-trophy buffer.</b> Promotion is instant, but once you reach an arena you keep it (its rank, reward odds and leaderboard) until you drop more than {m.trophyRules.buffer} trophies below its floor. Reach Gold at 800 and you stay in Gold until you fall below 700. Divisions within an arena follow your trophies.
          </p>
          <p className="text-sm text-muted mt-2">
            <b className="text-fg">Milestone cards.</b> The first time you reach an arena (above your personal best) you get one extra card, at least of the rarity shown. Your personal best is kept forever.
          </p>
          <p className="text-sm text-muted mt-2">Matchmaking and bot strength follow your trophy count, not the buffer, so a protected player still meets opponents at their level. Above Legend, bots field only Gold and Legend cards, at their level caps, with +3% (Titan), +5% (Mythic) or +7% (Hall of Fame) strength.</p>
        </Panel>
        <Panel>
          <h3 className="font-bold">Rewards</h3>
          <p className="text-sm text-muted mt-1">A win earns {p.rewardCardsPerWin} new cards. Each card’s rarity is rolled with your arena’s odds:</p>
          <div className="overflow-x-auto mt-2">
            <table className="text-sm w-full">
              <thead><tr className="text-xs uppercase text-muted"><th className="text-left py-1">Arena</th>{rarities.map((r) => <th key={r} className="text-right py-1 px-1">{r}</th>)}</tr></thead>
              <tbody>
                {m.arenas.map((a) => (
                  <tr key={a.name} className="border-t border-border">
                    <th scope="row" className="text-left py-1 font-medium">{a.name}</th>
                    {rarities.map((r) => <td key={r} className="text-right px-1 tabular">{p.rewardOdds[a.name]?.[r]}%</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel>
          <h3 className="font-bold">Experience and levels</h3>
          <p className="text-sm text-muted mt-1">
            Every card that plays earns performance XP from its match rating (see <a className="underline" href="#ratings">Match ratings &amp; XP</a>). A loss or tie adds +{p.lossXP} XP on top. Training gives XP by sacrificing cards. The amount follows the sacrificed card’s overall rating on a steep curve ({p.sacrificeXP.base} XP at {p.sacrificeXP.from}, +{Math.round((p.sacrificeXP.growth - 1) * 100)}% per point, at least {p.sacrificeXP.min}), then its role: a card of the same role gives {p.sacrificeXP.affinity.BAT.BAT}×, a related role (batter and keeper, or an all-rounder with either) {p.sacrificeXP.affinity.BAT.WK}×, an unrelated one {p.sacrificeXP.affinity.BAT.BOWL}×. So a batter rated 65 feeds a batter {sacrificeXP(65, 'BAT', 'BAT', false, p)} XP, a bowler rated 65 only {sacrificeXP(65, 'BOWL', 'BAT', false, p)}, and an 85-rated batter {sacrificeXP(85, 'BAT', 'BAT', false, p)}. A copy of the same player gives {p.sacrificeXP.sameMult}× instead. up to {p.maxSacrifices} cards at a time. Cards in your saved squad can’t be sacrificed.
            Reaching the next level takes level × {p.xpPerLevel} XP, and each level adds +{p.levelBonus} to the attributes that matter for that card’s role.
            Level caps: {rarities.map((r) => `${r} ${p.levelCaps[r]}`).join(', ')}. XP past the cap is not kept; training shows how much would be wasted before you confirm.
          </p>
        </Panel>
      </div>
    </Section>
  )
}

function Fairness() {
  return (
    <Section id="fairness" icon={<Lock size={20} />} title="Fairness & bots">
      <ul className="space-y-3">
        <li><b>Deterministic.</b> The seed is fixed when the match is created, before lineups are picked. The same seed, the same two lineups and the same break calls and Super Over picks always produce exactly the same match, which is why replays are identical. Captains’ choices are random only in the sense of being drawn from that seed.</li>
        <li><b>Blind to players.</b> The engine only sees cards, captains, orders, the calls made and the pitch. It does not know which side is a person or a bot, how many trophies anyone has, or who is ahead. Nothing changes the odds to keep a match close.</li>
        <li><b>Bots play by the same rules.</b> A bot’s cards are drawn from the rarities allowed in your arena, at levels typical for it, with up to ±5% random strength. Its trophy count is within 30 of yours. Its captain is one of its three best captains, chosen at random, and uses the same captain AI as yours.</li>
        <li><b>Estimates on screen.</b> The live win predictor and “heading for” projection are rough guides worked out on your device from the score and the pitch’s par. They are not part of the engine and never affect the result.</li>
      </ul>
    </Section>
  )
}
