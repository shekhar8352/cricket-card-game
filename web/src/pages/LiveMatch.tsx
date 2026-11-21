import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FastForward, Flame, Gauge, SkipForward, Sparkles, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { api } from '../api/client'
import { useMatchPlayback } from '../components/match/useMatchPlayback'
import { FieldSvg } from '../components/match/FieldSvg'
import { initials } from '../lib/rules'
import { Panel } from '../components/ui/chrome'
import { useUI } from '../store/ui'
import type { BallEvent, PlayerCard as Card } from '../types/engine'
import { cn } from '../lib/cn'
import {
  BALLS_PER_OVER, MAX_WICKETS, OVERS, ballChip, cleanCommentary, computeLive, oversText, rate, situation, strikeRate,
  type BatLine, type BowlLine, type InningsState, type Situation,
} from '../lib/matchState'

type Moment = { key: string; text: string; cls: string }

function momentFor(b?: BallEvent): Moment | null {
  if (!b) return null
  const key = `${b.innings}-${b.seq}`
  if (b.outcome === 'six') return { key, text: 'SIX!', cls: 'moment-six' }
  if (b.outcome === 'four') return { key, text: 'FOUR!', cls: 'moment-four' }
  if (b.outcome === 'wicket') return { key, text: 'WICKET!', cls: 'moment-wicket' }
  if (b.chance && !b.chance.converted) return { key, text: 'DROPPED!', cls: 'moment-drop' }
  return null
}

const toneStyles: Record<Situation['tone'], { cls: string; Icon: typeof Flame }> = {
  neutral: { cls: 'border-border', Icon: Gauge },
  good: { cls: 'border-boundary/60 bg-boundary/10', Icon: TrendingUp },
  bad: { cls: 'border-wicket/60 bg-wicket/10', Icon: TrendingDown },
  hot: { cls: 'border-cta/70 bg-cta/10', Icon: Flame },
}

export function LiveMatchPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const match = useQuery({ queryKey: ['match', id], queryFn: () => api.match(id!), refetchInterval: (q) => (q.state.data?.status === 'COMPLETE' ? false : 4000) })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const m = match.data
  const balls = m?.ballLog ?? m?.result?.balls ?? []
  const { shown, current, inningsBreak, done, skipToEnd } = useMatchPlayback(id!, balls, m?.status === 'COMPLETE')
  const { speed, setSpeed } = useUI()

  useEffect(() => {
    if (done && m?.status === 'COMPLETE') {
      const t = setTimeout(() => nav(`/match/${id}/result`), 2600)
      return () => clearTimeout(t)
    }
  }, [done, m?.status, id, nav])

  const cards = useMemo(() => {
    const map = new Map<string, Card>()
    for (const c of [...(m?.homeLineup?.cards ?? []), ...(m?.awayLineup?.cards ?? [])]) map.set(c.id, c)
    return map
  }, [m])
  const name = (cid: string) => cards.get(cid)?.name.split(' ').slice(-1)[0] ?? 'Player'
  const fullName = (cid: string) => cards.get(cid)?.name ?? 'Player'

  const state = useMemo(() => computeLive(shown), [shown])

  // Who is batting in which innings.
  const yourSide = m?.youAreHome ? 'home' : 'away'
  const firstBatSide = (() => {
    const fromResult = m?.result?.innings?.[0]?.battingSide
    if (fromResult) return fromResult
    if (m?.toss) {
      const winnerBats = m.toss.decision === 'bat'
      return winnerBats ? m.toss.winnerSide : m.toss.winnerSide === 'home' ? 'away' : 'home'
    }
    return 'home'
  })()
  const secondBatSide = firstBatSide === 'home' ? 'away' : 'home'
  const team = (side: string) => (side === yourSide ? me.data?.user.username ?? 'You' : m?.opponent.name ?? 'Opponent')
  const youBatFirst = firstBatSide === yourSide
  const inn = state.second ? 1 : 0
  const battingSide = inn === 0 ? firstBatSide : secondBatSide
  const bowlingSide = inn === 0 ? secondBatSide : firstBatSide
  const sit = situation(state, shown, name, team(battingSide), team(bowlingSide))

  const youWinProb = battingSide === yourSide ? state.battingWinProb : 1 - state.battingWinProb

  // Big-moment overlay that clears itself.
  const [moment, setMoment] = useState<Moment | null>(null)
  const lastKey = useRef<string>('')
  useEffect(() => {
    const mo = momentFor(current)
    if (!mo || mo.key === lastKey.current) return
    lastKey.current = mo.key
    setMoment(mo)
    const t = setTimeout(() => setMoment(null), 1300)
    return () => clearTimeout(t)
  }, [current])

  if (!m) return <p className="text-muted">Walking out to the middle…</p>

  const overBalls = current ? shown.filter((b) => b.innings === current.innings && b.over === current.over) : []
  const legalInOver = overBalls.filter((b) => b.legal).length
  const striker = current ? state.now.batters.get(current.strikerId) : undefined
  const nonStriker = current?.nonStrikerId ? state.now.batters.get(current.nonStrikerId) : undefined
  const bowler = current ? state.now.bowlers.get(current.bowlerId) : undefined

  return (
    <div className="space-y-4">
      {/* Scorebug */}
      <section className="scorebug rounded-2xl overflow-hidden" aria-label="Scoreboard">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
          <span className="flex items-center gap-2">
            {done ? <span>Full time</span> : <><span className="live-dot" aria-hidden /> Live</>}
            <span className="text-white/30">·</span>
            {inn === 0 ? '1st innings' : 'Chase'}
          </span>
          <span>{OVERS} overs · {MAX_WICKETS} wickets</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
          <TeamScore
            name={team(firstBatSide)}
            you={youBatFirst}
            st={state.first}
            active={inn === 0}
            started={shown.length > 0}
          />
          <span className="font-display text-xl font-bold text-white/40">VS</span>
          <TeamScore
            name={team(secondBatSide)}
            you={!youBatFirst}
            st={state.second}
            active={inn === 1}
            started={!!state.second}
            align="right"
            pending={inningsBreak ? `Target ${state.first.runs + 1}` : 'Yet to bat'}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/10 text-center">
          <Stat label="Run rate" value={state.crr.toFixed(2)} />
          {state.second ? (
            <>
              <Stat label="Target" value={String(state.target)} />
              <Stat label="Need" value={`${state.needed} off ${state.ballsLeft}`} hot={(state.ballsLeft ?? 99) <= 6} />
              <Stat label="Req. rate" value={state.rrr != null ? state.rrr.toFixed(2) : '—'} />
            </>
          ) : (
            <>
              <Stat label="Projected" value={shown.length ? String(state.projected) : '—'} />
              <Stat label="Partnership" value={`${state.now.partnership.runs} (${state.now.partnership.balls})`} />
              <Stat label="Boundaries" value={`${state.now.fours}×4  ${state.now.sixes}×6`} />
            </>
          )}
        </div>
        {/* Win predictor */}
        <div className="px-4 pb-4 pt-3 border-t border-white/10">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-white/60 mb-1.5">
            <span>{team(yourSide)} {Math.round(youWinProb * 100)}%</span>
            <span className="hidden sm:inline">Win predictor</span>
            <span>{Math.round((1 - youWinProb) * 100)}% {m.opponent.name}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-white/10" role="meter" aria-label="Your chance to win" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(youWinProb * 100)}>
            <div className="h-full bg-gradient-to-r from-[#1fc77a] to-[#5ff0a8] transition-[width] duration-700" style={{ width: `${youWinProb * 100}%` }} />
            <div className="h-full flex-1 bg-gradient-to-r from-[#ff7a7a] to-[#e04848]" />
          </div>
        </div>
      </section>

      {/* Situation */}
      <SituationBanner sit={inningsBreak ? {
        tone: 'hot',
        headline: `Innings break: ${team(secondBatSide)} need ${state.first.runs + 1} to win`,
        detail: `${team(firstBatSide)} made ${state.first.runs}/${state.first.wickets}. That’s ${rate(state.first.runs + 1, OVERS * BALLS_PER_OVER).toFixed(2)} an over required.`,
      } : sit} />

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <div className="space-y-4">
          <Panel className="relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                Over {current ? current.over + 1 : 1}
                <span className="text-muted font-sans text-sm normal-case tracking-normal ml-2">
                  {current ? `${name(current.bowlerId)} bowling · ${oversText(state.now.legalBalls)} overs` : 'Waiting for the first ball'}
                </span>
              </h2>
              <div className="flex gap-1.5" role="group" aria-label="Playback">
                <SpeedBtn on={speed === 1} onClick={() => setSpeed(1)} label="1×" />
                <SpeedBtn on={speed === 2} onClick={() => setSpeed(2)} label="2×" icon={<FastForward size={14} aria-hidden />} />
                <button type="button" onClick={skipToEnd} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 min-h-9 text-sm font-semibold cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <SkipForward size={14} aria-hidden /> Skip
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3" aria-label="This over">
              {overBalls.map((b, i) => {
                const c = ballChip(b)
                return <span key={`${b.seq}-${i}`} className={cn('ball-chip', c.cls)} aria-label={c.label}>{c.t}</span>
              })}
              {Array.from({ length: Math.max(0, BALLS_PER_OVER - legalInOver) }).map((_, i) => (
                <span key={`e${i}`} className="ball-chip ball-empty" aria-hidden>·</span>
              ))}
            </div>
            <div className="relative">
              <FieldSvg event={current} />
              {moment && (
                <div className="moment" key={moment.key} aria-hidden>
                  <span className={cn('moment-text', moment.cls)}>{moment.text}</span>
                </div>
              )}
            </div>
            {current?.traitsTriggered && current.traitsTriggered.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {current.traitsTriggered.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-cta/15 border border-cta/40 px-3 py-1 text-sm font-semibold text-cta">
                    <Sparkles size={14} aria-hidden /> {t} activated
                  </span>
                ))}
              </div>
            )}
          </Panel>

          <OverStrip st={state.now} name={name} />
        </div>

        <div className="space-y-4">
          <Panel>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide mb-2">At the crease</h2>
            {!current && <p className="text-muted">Openers are padding up.</p>}
            {striker && <BatterRow line={striker} card={cards.get(striker.id)} onStrike />}
            {nonStriker && !nonStriker.out && <BatterRow line={nonStriker} card={cards.get(nonStriker.id)} />}
            {bowler && <BowlerRow line={bowler} card={cards.get(bowler.id)} />}
            {state.now.lastWicket && (
              <p className="text-sm text-muted mt-3 pt-3 border-t border-border">
                <span className="font-semibold text-wicket">Last wicket:</span> {fullName(state.now.lastWicket.batterId)} {state.now.lastWicket.runs} ({state.now.lastWicket.balls}) · {state.now.lastWicket.text} · {state.now.lastWicket.score}
              </p>
            )}
          </Panel>

          <Panel className="max-h-[26rem] overflow-y-auto">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide mb-2">Ball by ball</h2>
            <ol aria-live="polite" className="space-y-1">
              {shown.length === 0 && <li className="text-muted">Commentary starts with the first ball.</li>}
              {[...shown].reverse().slice(0, 24).map((b) => <CommentaryRow key={`${b.innings}-${b.seq}`} b={b} />)}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function TeamScore({ name, you, st, active, started, align = 'left', pending }: {
  name: string; you: boolean; st?: InningsState; active: boolean; started: boolean; align?: 'left' | 'right'; pending?: string
}) {
  return (
    <div className={cn('min-w-0', align === 'right' && 'text-right', !active && 'opacity-60')}>
      <div className={cn('flex items-center gap-2 text-sm font-semibold uppercase tracking-wide', align === 'right' && 'justify-end')}>
        <span className="truncate">{name}</span>
        {you && <span className="rounded bg-cta px-1.5 text-[10px] font-bold text-cta-fg">YOU</span>}
        {active && <Zap size={14} className="text-cta shrink-0" aria-label="batting" />}
      </div>
      {st && started ? (
        <p className="font-display font-bold tabular leading-none mt-1">
          <span className="text-4xl sm:text-5xl">{st.runs}/{st.wickets}</span>
          <span className="text-lg text-white/60 ml-1.5">({oversText(st.legalBalls)})</span>
        </p>
      ) : (
        <p className="font-display text-2xl font-bold text-white/70 mt-1">{pending}</p>
      )}
    </div>
  )
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="px-3 py-2 border-white/10 [&:not(:first-child)]:border-l">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</div>
      <div className={cn('font-display text-xl font-bold tabular', hot && 'text-cta')}>{value}</div>
    </div>
  )
}

function SituationBanner({ sit }: { sit: Situation }) {
  const { cls, Icon } = toneStyles[sit.tone]
  return (
    <div className={cn('glass flex items-start gap-3 rounded-2xl border-2 px-4 py-3 fade-up', cls)} key={sit.headline} role="status">
      <Icon className="mt-1 shrink-0" size={22} aria-hidden />
      <div>
        <p className="font-display text-2xl font-bold leading-tight">{sit.headline}</p>
        {sit.detail && <p className="text-muted">{sit.detail}</p>}
      </div>
    </div>
  )
}

function SpeedBtn({ on, onClick, label, icon }: { on: boolean; onClick: () => void; label: string; icon?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-3 min-h-9 text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        on ? 'bg-accent text-accent-fg' : 'border border-border hover:bg-black/5 dark:hover:bg-white/10',
      )}
    >
      {icon}{label}
    </button>
  )
}

function BatterRow({ line, card, onStrike }: { line: BatLine; card?: Card; onStrike?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar card={card} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">
          {card?.name ?? 'Batter'}{onStrike && <span className="text-cta ml-1" aria-label="on strike">*</span>}
        </p>
        <p className="text-sm text-muted tabular">
          {line.fours}×4 · {line.sixes}×6 · SR {strikeRate(line.runs, line.balls).toFixed(0)}
        </p>
      </div>
      <p className="font-display text-2xl font-bold tabular">
        {line.runs}<span className="text-base text-muted ml-1">({line.balls})</span>
      </p>
    </div>
  )
}

function BowlerRow({ line, card }: { line: BowlLine; card?: Card }) {
  return (
    <div className="flex items-center gap-3 py-2 mt-1 border-t border-border">
      <Avatar card={card} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{card?.name ?? 'Bowler'} <span className="text-sm text-muted font-normal">bowling</span></p>
        <p className="text-sm text-muted tabular">Econ {rate(line.runs, line.balls).toFixed(2)} · {line.dots} dots</p>
      </div>
      <p className="font-display text-2xl font-bold tabular">
        {line.wickets}-{line.runs}<span className="text-base text-muted ml-1">({oversText(line.balls)})</span>
      </p>
    </div>
  )
}

function OverStrip({ st, name }: { st: InningsState; name: (id: string) => string }) {
  const max = Math.max(12, ...st.overs.filter(Boolean).map((o) => o.runs))
  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide flex items-center gap-2">
          <Target size={18} aria-hidden /> Over by over
        </h2>
        <span className="text-sm text-muted">Extras {st.extras}</span>
      </div>
      <ol className="grid grid-cols-5 gap-2 items-end h-36">
        {Array.from({ length: OVERS }).map((_, i) => {
          const o = st.overs[i]
          return (
            <li key={i} className="flex flex-col items-center justify-end h-full gap-1">
              {o && <span className="font-display text-lg font-bold tabular">{o.runs}</span>}
              <div
                className={cn('w-full rounded-t-lg transition-[height] duration-500', o ? (o.runs >= 12 ? 'bg-gradient-to-t from-cta-2 to-cta' : 'bg-gradient-to-t from-accent-bright/70 to-accent-bright') : 'bg-border/50')}
                style={{ height: o ? `${Math.max(8, (o.runs / max) * 72)}%` : '6%' }}
              />
              <div className="flex gap-0.5 h-2" aria-label={o ? `${o.wickets} wickets` : undefined}>
                {o && Array.from({ length: o.wickets }).map((_, w) => <span key={w} className="w-2 h-2 rounded-full bg-wicket" />)}
              </div>
              <span className="text-xs text-muted text-center leading-tight">
                Ov {i + 1}
                {o && <span className="block truncate max-w-16">{name(o.bowlerId)}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function CommentaryRow({ b }: { b: BallEvent }) {
  const c = ballChip(b)
  const big = b.outcome === 'four' || b.outcome === 'six' || b.outcome === 'wicket'
  const endOfOver = b.legal && b.ball === BALLS_PER_OVER - 1
  return (
    <li className="fade-up">
      {endOfOver && (
        <div className="my-2 rounded-lg bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          End of over {b.over + 1} · {b.score}/{b.wickets}
        </div>
      )}
      <div className={cn('flex gap-3 rounded-lg px-2 py-2', big && 'bg-black/5 dark:bg-white/5')}>
        <div className="flex flex-col items-center gap-1 shrink-0 w-10">
          <span className="text-xs text-muted tabular">{b.over}.{b.ball + 1}</span>
          <span className={cn('ball-chip !min-w-8 !h-8 !text-sm', c.cls)} aria-label={c.label}>{c.t}</span>
        </div>
        <p className={cn('text-[15px] leading-snug pt-0.5', big && 'font-semibold')}>{cleanCommentary(b.commentary)}</p>
      </div>
    </li>
  )
}

const rarityRing: Record<string, string> = { Bronze: '#e8c99b', Silver: '#e5e7eb', Gold: '#f6c445', Legend: '#c4b5fd' }

function Avatar({ card }: { card?: Card }) {
  return (
    <span
      className="grid place-items-center w-11 h-11 shrink-0 rounded-full border-2 bg-gradient-to-br from-[#1a2b42] to-[#0d1828] font-display text-base font-bold text-white"
      style={{ borderColor: card ? rarityRing[card.rarity] : 'var(--border)' }}
      aria-hidden
    >
      {card ? initials(card.name) : '?'}
      {card && <span className="sr-only">{card.overall}</span>}
    </span>
  )
}
