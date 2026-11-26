import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Brain, FastForward, Flame, Gauge, Link2, ShieldAlert, SkipForward, Sparkles, Swords, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { BreakPanel, ConditionsCard, SuperOverPanel } from '../components/match/PausePanels'
import { bestApproachVs, bestFieldVs } from '../lib/captaincy'
import { api } from '../api/client'
import { useMatchPlayback } from '../components/match/useMatchPlayback'
import { FieldSvg } from '../components/match/FieldSvg'
import { PlayerAvatar } from '../components/card/PlayerAvatar'
import { PlanBadge } from '../components/match/MatchPlan'
import { Panel } from '../components/ui/chrome'
import { useUI } from '../store/ui'
import type { BallEvent, PlayerCard as Card } from '../types/engine'
import { cn } from '../lib/cn'
import {
  BALLS_PER_OVER, MAX_WICKETS, OVERS, ballChip, cleanCommentary, computeLive, oversText, rate, situation, strikeRate,
  type BatLine, type BowlLine, type InningsState, type Situation,
} from '../lib/matchState'

type Moment = { key: string; text: string; cls: string }

function momentFor(b?: BallEvent, prev?: BallEvent): Moment | null {
  if (!b) return null
  const key = `${b.innings}-${b.seq}`
  const newOver = !prev || prev.over !== b.over || prev.innings !== b.innings
  if (b.masterstroke && newOver) return { key: key + 'm', text: 'MASTERSTROKE', cls: 'moment-drop' }
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
  const model = useQuery({ queryKey: ['engine-model'], queryFn: api.engineModel, staleTime: Infinity })
  const m = match.data
  const balls = (m?.ballLog?.length ?? 0) >= (m?.result?.balls?.length ?? 0) ? m?.ballLog ?? [] : m?.result?.balls ?? []
  const { shown, current, inningsBreak, done, skipToEnd } = useMatchPlayback(id!, balls, m?.status === 'COMPLETE')
  const { speed, setSpeed } = useUI()
  const [tab, setTab] = useState<'crease' | 'balls' | 'overs'>('crease')

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

  const par = m?.pitch?.par
  // Super Over balls are innings 2 and 3; the main match is innings 0 and 1.
  const mainShown = useMemo(() => shown.filter((b) => b.innings < 2), [shown])
  const soShown = useMemo(() => shown.filter((b) => b.innings >= 2).map((b) => ({ ...b, innings: b.innings - 2 })), [shown])
  const state = useMemo(() => computeLive(mainShown, par), [mainShown, par])
  const soState = useMemo(() => (soShown.length ? computeLive(soShown) : null), [soShown])
  const inSuperOver = (current?.innings ?? 0) >= 2

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
  const sit = situation(state, mainShown, name, team(battingSide), team(bowlingSide))

  const youWinProb = battingSide === yourSide ? state.battingWinProb : 1 - state.battingWinProb

  // When play pauses for a call, bring the panel into view: on a phone the
  // player is usually watching the field further down.
  const pauseRef = useRef<HTMLDivElement>(null)
  const isPaused = !!(done && m?.pause && (m.status === 'INNINGS_BREAK' || m.status === 'SUPER_OVER'))
  useEffect(() => {
    if (isPaused) pauseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isPaused])

  // Big-moment overlay that clears itself.
  const [moment, setMoment] = useState<Moment | null>(null)
  const lastKey = useRef<string>('')
  const prevBall = shown.length > 1 ? shown[shown.length - 2] : undefined
  useEffect(() => {
    const mo = momentFor(current, prevBall)
    if (!mo || mo.key === lastKey.current) return
    lastKey.current = mo.key
    setMoment(mo)
    const t = setTimeout(() => setMoment(null), 1300)
    return () => clearTimeout(t)
  }, [current, prevBall])

  if (!m) return <p className="text-muted">Walking out to the middle…</p>

  const myLineup = m.youAreHome ? m.homeLineup : m.awayLineup
  const paused = done && m.pause && (m.status === 'INNINGS_BREAK' || m.status === 'SUPER_OVER')
  // Conditions are revealed at the break: from the pause while paused, from the result after.
  const condDef = m.pause?.conditions ?? model.data?.conditions.find((c) => c.code === m.result?.conditions && c.code !== 'clear')

  const overBalls = current ? shown.filter((b) => b.innings === current.innings && b.over === current.over) : []
  const dotStreak = (() => {
    let n = 0
    for (let i = shown.length - 1; i >= 0 && shown[i].innings === current?.innings; i--) {
      const b = shown[i]
      if (!b.legal) break
      if (b.runs !== 0 || b.dismissal) break
      n++
    }
    return n
  })()
  const legalInOver = overBalls.filter((b) => b.legal).length
  const live = inSuperOver && soState ? soState : state
  const striker = current ? live.now.batters.get(current.strikerId) : undefined
  const nonStriker = current?.nonStrikerId ? live.now.batters.get(current.nonStrikerId) : undefined
  const bowler = current ? live.now.bowlers.get(current.bowlerId) : undefined

  const crease = (
    <>
      {!current && <p className="text-muted">Openers are padding up.</p>}
      {striker && <BatterRow line={striker} card={cards.get(striker.id)} onStrike matchup={current?.strikerId === striker.id ? current?.matchup : undefined} />}
      {nonStriker && !nonStriker.out && <BatterRow line={nonStriker} card={cards.get(nonStriker.id)} />}
      {current && current.chemistry != null && current.chemistry > 0 && nonStriker && !nonStriker.out && (
        <p className={cn('flex items-center gap-1.5 text-xs font-semibold pb-1', current.chemistry >= 2 ? 'text-success' : 'text-muted')}>
          <Link2 size={12} aria-hidden /> Chemistry {current.chemistry}/3: {current.chemistry >= 2 ? 'known partners, running hard' : 'compatriots, quick singles'}
        </p>
      )}
      {bowler && <BowlerRow line={bowler} card={cards.get(bowler.id)} />}
      {current?.rivalry && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-cta">
          <ShieldAlert size={12} aria-hidden /> {fullName(current.bowlerId)} has {fullName(current.strikerId)}’s number
        </p>
      )}
      {state.now.lastWicket && (
        <p className="text-sm text-muted mt-3 pt-3 border-t border-border">
          <span className="font-semibold text-wicket">Last wicket:</span> {fullName(state.now.lastWicket.batterId)} {state.now.lastWicket.runs} ({state.now.lastWicket.balls}) · {state.now.lastWicket.text} · {state.now.lastWicket.score}
        </p>
      )}
    </>
  )
  const commentary = (
    <ol aria-live="polite" className="space-y-1">
      {shown.length === 0 && <li className="text-muted">Commentary starts with the first ball.</li>}
      {[...shown].reverse().slice(0, 24).map((b) => <CommentaryRow key={`${b.innings}-${b.seq}`} b={b} />)}
    </ol>
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Scorebug */}
      <section className="scorebug rounded-2xl overflow-hidden" aria-label="Scoreboard">
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 pt-2.5 sm:pt-3 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] sm:tracking-[0.16em] text-white/60">
          <span className="flex items-center gap-2 min-w-0 whitespace-nowrap">
            {done && m.status === 'COMPLETE' ? <span>Full time</span> : paused ? <span>{m.status === 'SUPER_OVER' ? 'Tied' : 'Innings break'}</span> : <><span className="live-dot" aria-hidden /> Live</>}
            <span className="text-white/30">·</span>
            {inSuperOver ? 'Super Over' : inn === 0 ? '1st innings' : 'Chase'}
            {current?.powerplay && <span className="ml-1 rounded bg-cta px-1.5 py-0.5 text-[10px] font-bold text-cta-fg tracking-wide">POWERPLAY<span className="hidden sm:inline"> · 2 OUT</span></span>}
            {!paused && condDef && state.second && <span className="sm:hidden ml-1 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide normal-case">{condDef.name}</span>}
          </span>
          <span className="hidden sm:inline">{m?.pitch ? `${m.pitch.name} pitch · par ${m.pitch.par}` : `${OVERS} overs · ${MAX_WICKETS} wickets`}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-4 py-2 sm:py-3">
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
            pending={inningsBreak || paused ? `Target ${state.first.runs + 1}` : 'Yet to bat'}
          />
        </div>
        {/* Phones: one line instead of the four-stat grid. */}
        <p className="sm:hidden border-t border-white/10 px-3 py-1.5 text-center text-[13px] font-semibold tabular text-white/85 truncate">
          {state.second
            ? `Need ${state.needed} off ${state.ballsLeft} · Req ${state.rrr != null ? state.rrr.toFixed(2) : '—'} · RR ${state.crr.toFixed(2)}`
            : `RR ${state.crr.toFixed(2)} · Projected ${shown.length ? state.projected : '—'} · P'ship ${state.now.partnership.runs} (${state.now.partnership.balls})`}
        </p>
        <div className="hidden sm:grid grid-cols-4 border-t border-white/10 text-center">
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
        <div className="px-3 sm:px-4 pb-2.5 sm:pb-4 pt-2 sm:pt-3 border-t border-white/10">
          <div className="flex justify-between text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white/60 mb-1 sm:mb-1.5">
            <span>{team(yourSide)} {Math.round(youWinProb * 100)}%</span>
            <span className="hidden sm:inline">Win predictor</span>
            <span>{Math.round((1 - youWinProb) * 100)}% {m.opponent.name}</span>
          </div>
          <div className="h-2 sm:h-2.5 rounded-full overflow-hidden flex bg-white/10" role="meter" aria-label="Your chance to win" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(youWinProb * 100)}>
            <div className="h-full bg-gradient-to-r from-[#1fc77a] to-[#5ff0a8] transition-[width] duration-700" style={{ width: `${youWinProb * 100}%` }} />
            <div className="h-full flex-1 bg-gradient-to-r from-[#ff7a7a] to-[#e04848]" />
          </div>
        </div>
      </section>

      {soState && (
        <section className="rounded-2xl border-2 border-six/60 bg-six/10 px-4 py-3" aria-label="Super Over">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-six">Super Over</p>
          <div className="flex flex-wrap gap-6 mt-1 font-display font-bold tabular">
            <span className="text-2xl">{team(secondBatSide)} {soState.first.runs}/{soState.first.wickets} <span className="text-base text-muted">({oversText(soState.first.legalBalls)})</span></span>
            {soState.second && <span className="text-2xl">{team(firstBatSide)} {soState.second.runs}/{soState.second.wickets} <span className="text-base text-muted">({oversText(soState.second.legalBalls)})</span></span>}
            {soState.second && soState.needed != null && soState.needed > 0 && <span className="text-lg text-cta self-center">Need {soState.needed} off {soState.ballsLeft - 24}</span>}
          </div>
        </section>
      )}

      {paused && (
        <div ref={pauseRef} className="scroll-mt-20">
          {m.pause?.kind === 'break' && <BreakPanel m={m} pause={m.pause} mine={myLineup} teamName={team(yourSide)} />}
          {m.pause?.kind === 'super_over' && <SuperOverPanel m={m} pause={m.pause} mine={myLineup} />}
        </div>
      )}
      {!paused && condDef && state.second && <div className="hidden sm:block"><ConditionsCard c={condDef} /></div>}

      {/* Situation */}
      <SituationBanner sit={inningsBreak ? {
        tone: 'hot',
        headline: `Innings break: ${team(secondBatSide)} need ${state.first.runs + 1} to win`,
        detail: `${team(firstBatSide)} made ${state.first.runs}/${state.first.wickets}. That’s ${rate(state.first.runs + 1, OVERS * BALLS_PER_OVER).toFixed(2)} an over required.`,
      } : sit} />

      <div className="grid lg:grid-cols-[1fr_340px] gap-3 sm:gap-4">
        <div className="space-y-4 min-w-0">
          <Panel className="relative overflow-hidden !p-3 sm:!p-5">
            {/* Header: over and bowler on the left, playback on the right, one line. */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="min-w-0 font-display text-lg sm:text-xl font-bold uppercase tracking-wide truncate">
                Over {current ? current.over + 1 : 1}
                <span className="text-muted font-sans text-sm normal-case tracking-normal ml-2">
                  {current ? `${name(current.bowlerId)} · ${oversText(live.now.legalBalls)} ov` : 'First ball coming up'}
                </span>
              </h2>
              <div className="flex shrink-0 gap-1" role="group" aria-label="Playback">
                <SpeedBtn on={speed === 1} onClick={() => setSpeed(1)} label="1×" />
                <SpeedBtn on={speed === 2} onClick={() => setSpeed(2)} label="2×" icon={<FastForward size={14} aria-hidden />} />
                <button type="button" onClick={skipToEnd} aria-label="Skip to the end" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 sm:px-3 min-h-9 text-sm font-semibold cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <SkipForward size={14} aria-hidden /> <span className="hidden sm:inline">Skip</span>
                </button>
              </div>
            </div>
            {/* Tactics: one fixed-height row that swipes sideways, so nothing below moves. */}
            <div className="chip-scroll flex flex-nowrap items-center gap-2 h-7 mb-2 overflow-x-auto text-sm" aria-label="This over's calls">
              {current && (
                <>
                  <PlanBadge kind="bat" value={current.approach} />
                  <PlanBadge kind="field" value={current.field} />
                  {current.counter && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-cta/15 border border-cta/40 px-2 py-0.5 text-xs font-bold text-cta whitespace-nowrap">
                      <Swords size={12} aria-hidden /> {current.counter}
                    </span>
                  )}
                  {current.approach && current.field && current.approach === bestApproachVs(current.field) && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-bold text-success whitespace-nowrap" title="The batting captain's call was the best reply to the field">
                      <Brain size={12} aria-hidden /> {team(battingSide)} read it
                    </span>
                  )}
                  {current.approach && current.field && current.field === bestFieldVs(current.approach) && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-bold text-success whitespace-nowrap" title="The fielding captain's field was the best reply to the batting approach">
                      <Brain size={12} aria-hidden /> {team(bowlingSide)} read it
                    </span>
                  )}
                  {current.masterstroke && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-cta px-2 py-0.5 text-xs font-bold text-cta-fg whitespace-nowrap">
                      <Sparkles size={12} aria-hidden /> {current.masterstroke}
                    </span>
                  )}
                  {current.freeHit && <span className="shrink-0 rounded-md bg-six px-2 py-0.5 text-xs font-bold text-white">FREE HIT</span>}
                  <PressureMeter dots={dotStreak} />
                </>
              )}
            </div>
            <div className="flex flex-nowrap gap-1.5 h-9 sm:h-10 mb-2 overflow-hidden" aria-label="This over">
              {overBalls.map((b, i) => {
                const c = ballChip(b)
                return <span key={`${b.seq}-${i}`} className={cn('ball-chip shrink-0', c.cls)} aria-label={c.label}>{c.t}</span>
              })}
              {Array.from({ length: Math.max(0, BALLS_PER_OVER - legalInOver) }).map((_, i) => (
                <span key={`e${i}`} className="ball-chip ball-empty shrink-0" aria-hidden>·</span>
              ))}
            </div>
            {/* The field fits the screen height on phones; pop-ups float over it. */}
            <div className="relative mx-auto w-full max-w-[min(100%,48svh)] sm:max-w-md">
              <FieldSvg event={current} powerplay={current?.powerplay} />
              {moment && (
                <div className="moment" key={moment.key} aria-hidden>
                  <span className={cn('moment-text', moment.cls)}>{moment.text}</span>
                </div>
              )}
              {current?.traitsTriggered && current.traitsTriggered.length > 0 && (
                <div className="absolute inset-x-0 top-1 flex flex-wrap gap-1.5 justify-center pointer-events-none" key={`traits-${current.innings}-${current.seq}`}>
                  {current.traitsTriggered.map((t) => (
                    <span key={t} className="fade-up inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur border border-cta/50 px-2.5 py-0.5 text-xs font-semibold text-[#ffd166]">
                      <Sparkles size={12} aria-hidden /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <div className="hidden lg:block"><OverStrip st={state.now} name={name} /></div>
        </div>

        <div className="hidden lg:block space-y-4">
          <Panel>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide mb-2">At the crease</h2>
            {crease}
          </Panel>
          <Panel className="max-h-[26rem] overflow-y-auto">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide mb-2">Ball by ball</h2>
            {commentary}
          </Panel>
        </div>

        {/* Phones: the rest sits in tabs under the field instead of a long page. */}
        <Panel className="lg:hidden !p-3">
          <div role="tablist" aria-label="Match details" className="grid grid-cols-3 gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-1 mb-3">
            {([['crease', 'At the crease'], ['balls', 'Commentary'], ['overs', 'Overs']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn('min-h-10 rounded-lg text-sm font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', tab === k ? 'bg-[var(--card-bg)] shadow text-fg' : 'text-muted')}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'crease' && crease}
            {tab === 'balls' && <div className="max-h-[22rem] overflow-y-auto">{commentary}</div>}
            {tab === 'overs' && <OverStrip st={state.now} name={name} bare />}
          </div>
        </Panel>
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
          <span className="text-3xl sm:text-5xl">{st.runs}/{st.wickets}</span>
          <span className="text-base sm:text-lg text-white/60 ml-1 sm:ml-1.5">({oversText(st.legalBalls)})</span>
        </p>
      ) : (
        <p className="font-display text-xl sm:text-2xl font-bold text-white/70 mt-1">{pending}</p>
      )}
    </div>
  )
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="px-1 sm:px-3 py-2 border-white/10 [&:not(:first-child)]:border-l min-w-0">
      <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide sm:tracking-wider text-white/50 truncate">{label}</div>
      <div className={cn('font-display text-base sm:text-xl font-bold tabular', hot && 'text-cta')}>{value}</div>
    </div>
  )
}

function SituationBanner({ sit }: { sit: Situation }) {
  const { cls, Icon } = toneStyles[sit.tone]
  return (
    // Fixed height: one line each for the headline and the detail, so the field
    // below never moves when the wording changes.
    <div className={cn('glass flex items-center gap-3 rounded-2xl border-2 px-3 sm:px-4 h-[60px] sm:h-[72px] transition-colors duration-300', cls)} role="status">
      <Icon className="shrink-0" size={22} aria-hidden />
      <div className="min-w-0">
        <p className="font-display text-lg sm:text-2xl font-bold leading-tight truncate">{sit.headline}</p>
        <p className="text-[13px] sm:text-base text-muted truncate">{sit.detail ?? '\u00a0'}</p>
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

function BatterRow({ line, card, onStrike, matchup }: { line: BatLine; card?: Card; onStrike?: boolean; matchup?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <PlayerAvatar name={card?.name} rarity={card?.rarity} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">
          {card?.name ?? 'Batter'}{onStrike && <span className="text-cta ml-1" aria-label="on strike">*</span>}
          {matchup && (
            <span className={cn('ml-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase', matchup.startsWith('weak') ? 'bg-wicket/15 text-wicket' : 'bg-success/15 text-success')}>{matchup}</span>
          )}
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
      <PlayerAvatar name={card?.name} rarity={card?.rarity} />
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

function OverStrip({ st, name, bare }: { st: InningsState; name: (id: string) => string; bare?: boolean }) {
  const max = Math.max(12, ...st.overs.filter(Boolean).map((o) => o.runs))
  const Wrap = bare ? 'div' : Panel
  return (
    <Wrap>
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
    </Wrap>
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


function PressureMeter({ dots }: { dots: number }) {
  const max = 5
  const level = Math.min(dots, max)
  const on = dots >= 2
  return (
    <span className="inline-flex items-center gap-1.5" role="meter" aria-label={`Pressure: ${dots} dot balls in a row`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={level}>
      <span className={cn('text-xs font-bold uppercase tracking-wide', on ? 'text-wicket' : 'text-muted')}>Pressure</span>
      <span className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} className={cn('w-2.5 h-3 rounded-sm', i < level ? (on ? 'bg-wicket' : 'bg-muted/60') : 'bg-black/10 dark:bg-white/10')} />
        ))}
      </span>
    </span>
  )
}
