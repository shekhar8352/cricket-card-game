import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Lock, Sparkles, Wand2, X, Zap } from 'lucide-react'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { PlayerAvatar } from '../components/card/PlayerAvatar'
import { Button } from '../components/ui/button'
import { EmptyState, PageHeader, Panel } from '../components/ui/chrome'
import { cn } from '../lib/cn'
import { ROLE_LABEL } from '../lib/labels'
import { applyXP, byFodderValue, roleFit, capOf, isPrecious, LEVEL_ATTRS, sacXP, smartPick, xpNeeded, type Progression } from '../lib/training'
import type { PlayerCard as Card } from '../types/engine'

type Done = { name: string; from: number; to: number; ovFrom: number; ovTo: number; xp: number; maxed: boolean }

export function TrainingPage() {
  const [sp, setSp] = useSearchParams()
  const cards = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const squad = useQuery({ queryKey: ['squad'], queryFn: api.squad })
  const model = useQuery({ queryKey: ['engine-model'], queryFn: api.engineModel, staleTime: Infinity })
  const target = sp.get('target') ?? ''
  const setTarget = (id: string) => {
    setSp(id ? { target: id } : {}, { replace: false })
    window.scrollTo({ top: 0 })
  }

  const all = useMemo(() => cards.data ?? [], [cards.data])
  const inSquad = useMemo(() => new Set(squad.data?.cardIds ?? []), [squad.data])
  const prog = model.data?.progression
  const t = all.find((c) => c.id === target)

  if (t) return <Workbench key={t.id} target={t} all={all} inSquad={inSquad} prog={prog} onBack={() => setTarget('')} />
  return <TargetPicker all={all} loading={cards.isPending} inSquad={inSquad} prog={prog} onPick={setTarget} />
}

/** Spare cards a target could use: not itself, not in the squad, not precious. */
function sparePool(all: Card[], target: Card, inSquad: Set<string>) {
  return all.filter((c) => c.id !== target.id && !inSquad.has(c.id) && !isPrecious(c))
}

// ─── Step 1: who to train ──────────────────────────────────────────────────

function TargetPicker({ all, loading, inSquad, prog, onPick }: { all: Card[]; loading: boolean; inSquad: Set<string>; prog?: Progression; onPick: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false)
  const rows = useMemo(() => {
    return all.map((c) => {
      const maxed = c.level >= capOf(c, prog)
      const pool = maxed ? [] : sparePool(all, c, inSquad)
      const spare = pool.reduce((s, x) => s + sacXP(x, c, prog), 0)
      const ready = !maxed && spare > 0 && spare >= xpNeeded(c, c.level + 1, prog)
      const copies = pool.filter((x) => x.playerId === c.playerId).length
      return { c, maxed, ready, copies, squad: inSquad.has(c.id) }
    })
  }, [all, inSquad, prog])
  const rank = (r: (typeof rows)[number]) => (r.maxed ? 2 : r.ready ? 0 : 1)
  const sortRows = (list: typeof rows) => list.sort((a, b) => rank(a) - rank(b) || b.c.overall - a.c.overall)
  const squadRows = sortRows(rows.filter((r) => r.squad))
  const otherRows = sortRows(rows.filter((r) => !r.squad))
  const readyCount = rows.filter((r) => r.ready && r.squad).length
  const shownOthers = showAll || squadRows.length === 0 ? otherRows : otherRows.filter((r) => !r.maxed).slice(0, 6)

  const grid = (list: typeof rows) => (
    <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-x-2 gap-y-3 sm:gap-3">
      {list.map(({ c, maxed, ready, copies }) => (
        <div key={c.id} className="relative">
          <PlayerCard card={c} size="sm" className="w-full max-w-none" disabled={maxed} status={maxed ? 'Max level' : undefined} onClick={() => onPick(c.id)} />
          <span className="mt-1 flex flex-wrap justify-center gap-1 min-h-5">
            {ready && <Chip tone="good"><Zap size={11} aria-hidden /> Ready</Chip>}
            {copies > 0 && <Chip tone="cta">{copies}× copy</Chip>}
            {!maxed && !ready && !copies && <Chip>Lv {c.level}/{capOf(c, prog)}</Chip>}
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Training"
        lede={
          <>
            Pick a player, then feed them spare cards to level up.{' '}
            <span className="hidden sm:inline">Each level adds +{prog?.levelBonus ?? 2} to the stats that matter for their role, higher-rated cards and cards of the same role give more XP, and copies of the same player give the most.</span>
          </>
        }
      />
      {all.length === 0 && !loading ? (
        <EmptyState title="No cards to train" body="Earn cards from matches, then come back to level them up." />
      ) : (
        <div className="space-y-6">
          {squadRows.length > 0 && (
            <section>
              <h2 className="font-display text-xl sm:text-2xl font-bold uppercase">Your squad</h2>
              <p className="text-sm text-muted mb-3">{readyCount > 0 ? `${readyCount} marked Ready can level up now with your spare cards.` : 'The players you actually field. Train these first.'}</p>
              {grid(squadRows)}
            </section>
          )}
          {otherRows.length > 0 && (
            <section>
              <h2 className="font-display text-xl sm:text-2xl font-bold uppercase mb-3">{squadRows.length ? 'Rest of your collection' : 'Choose who to train'}</h2>
              {grid(shownOthers)}
              {shownOthers.length < otherRows.length && (
                <Button variant="outline" className="mt-3 w-full sm:w-auto" onClick={() => setShowAll(true)}>
                  Show all {otherRows.length} cards <ChevronDown size={16} aria-hidden />
                </Button>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ tone, children }: { tone?: 'good' | 'cta' | 'warn'; children: React.ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none',
      tone === 'good' ? 'bg-success/15 text-success' : tone === 'cta' ? 'bg-cta text-cta-fg' : tone === 'warn' ? 'bg-wicket/15 text-wicket' : 'bg-black/5 dark:bg-white/10 text-muted',
    )}>{children}</span>
  )
}

// ─── Step 2: the workbench ────────────────────────────────────────────────

function Workbench({ target: t, all, inSquad, prog, onBack }: { target: Card; all: Card[]; inSquad: Set<string>; prog?: Progression; onBack: () => void }) {
  const qc = useQueryClient()
  const [sac, setSac] = useState<string[]>([])
  const [showValuable, setShowValuable] = useState(false)
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<Done | null>(null)

  const cap = capOf(t, prog)
  const maxSac = prog?.maxSacrifices ?? 20
  const maxed = t.level >= cap
  const byId = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all])

  const others = useMemo(() => all.filter((c) => c.id !== t.id).sort(byFodderValue(t)), [all, t])
  const spare = others.filter((c) => !inSquad.has(c.id) && !isPrecious(c))
  const valuable = others.filter((c) => !inSquad.has(c.id) && isPrecious(c))
  const lockedCount = others.length - spare.length - valuable.length
  const spareXP = spare.reduce((s, c) => s + sacXP(c, t, prog), 0)

  const chosen = sac.map((id) => byId[id]).filter(Boolean)
  const gain = chosen.reduce((s, c) => s + sacXP(c, t, prog), 0)
  const after = applyXP(t, gain, prog)
  const precious = chosen.filter(isPrecious)

  // Quick picks, worked out from spare cards only.
  const nextPick = useMemo(() => (maxed ? [] : smartPick(t, spare, t.level + 1, prog)), [t, spare, prog, maxed])
  const maxPick = useMemo(() => (maxed ? [] : smartPick(t, spare, cap, prog)), [t, spare, prog, cap, maxed])
  const levelWith = (ids: string[]) => applyXP(t, ids.reduce((s, id) => s + sacXP(byId[id], t, prog), 0), prog).level
  const nextOK = nextPick.length > 0 && levelWith(nextPick) > t.level

  // The server confirms the overall rating (and any rule we don't mirror).
  const preview = useQuery({
    queryKey: ['train-preview', t.id, sac],
    queryFn: () => api.previewTraining(t.id, sac),
    enabled: sac.length > 0 && !maxed,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const ovrAfter = sac.length && preview.data && !preview.isPlaceholderData ? preview.data.result.overallAfter : null

  useEffect(() => {
    if (!ask) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAsk(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ask])

  function select(ids: string[]) {
    setErr('')
    setDone(null)
    setSac(ids.slice(0, maxSac))
  }
  function toggle(c: Card) {
    if (inSquad.has(c.id)) return
    select(sac.includes(c.id) ? sac.filter((x) => x !== c.id) : sac.length >= maxSac ? sac : [...sac, c.id])
  }

  async function confirm() {
    setBusy(true)
    setErr('')
    try {
      const r = await api.train(t.id, sac)
      setDone({ name: t.name, from: r.result.levelBefore, to: r.result.levelAfter, ovFrom: r.result.overallBefore, ovTo: r.result.overallAfter, xp: r.result.xpGained, maxed: r.result.levelAfter >= r.result.levelCap })
      setSac([])
      setAsk(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      await qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['me', 'stats'] })
    } catch (e) {
      setErr((e as Error).message)
      setAsk(false)
    } finally {
      setBusy(false)
    }
  }

  const levelsGained = after.level - t.level
  const attrs = LEVEL_ATTRS[t.role]
  const bonus = prog?.levelBonus ?? 2

  return (
    <div className="pb-28 md:pb-24">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 min-h-10 -ml-1 px-1 text-sm font-semibold text-accent cursor-pointer">
        <ArrowLeft size={16} aria-hidden /> All players
      </button>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 lg:gap-6 items-start mt-1">
        {/* Who's training and what they get */}
        <Panel className="lg:sticky lg:top-24 !p-3 sm:!p-4">
          {done ? (
            <div className="fade-up text-center py-1" role="status">
              <Sparkles className="mx-auto text-cta" size={28} aria-hidden />
              <p className="font-display text-3xl font-bold uppercase mt-1">{done.to > done.from ? 'Level up!' : `+${done.xp} XP`}</p>
              <p className="text-sm text-muted">{done.name}</p>
              {done.to > done.from && (
                <p className="font-display text-xl font-bold mt-1">Lv {done.from} <ArrowRight size={16} className="inline -mt-1" aria-hidden /> <span className="text-success">Lv {done.to}</span> · OVR {done.ovFrom} → <span className="text-success">{done.ovTo}</span></p>
              )}
              {done.maxed && <p className="text-sm text-success font-semibold mt-1">Max level reached.</p>}
            </div>
          ) : null}
          <div className={cn('flex gap-3', done && 'mt-3 pt-3 border-t border-border')}>
            <PlayerCard card={t} size="sm" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-bold uppercase leading-tight truncate">{t.name}</p>
              <p className="text-xs text-muted">{t.rarity} {ROLE_LABEL[t.role]}{inSquad.has(t.id) ? ' · in your squad' : ''}</p>
              <LevelTrack cap={cap} level={t.level} to={after.level} />
              {maxed ? (
                <p className="text-sm text-success font-semibold mt-2">At the {t.rarity} level cap ({cap}).</p>
              ) : (
                <>
                  <XPBar t={t} gain={gain} after={after} />
                  <p className="text-xs text-muted mt-1 tabular">
                    {after.level >= cap
                      ? 'Reaches max level'
                      : `${after.xp}/${after.toNext} XP to Lv ${after.level + 1}`}
                    {gain > 0 && <b className="text-success"> · +{gain} XP</b>}
                  </p>
                </>
              )}
            </div>
          </div>

          {!maxed && (
            <div className="mt-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2">
              <div className="flex items-center gap-2 font-display font-bold">
                <span className="text-xs uppercase tracking-wider text-muted font-sans">Overall</span>
                <span className="text-xl">{t.overall}</span>
                {levelsGained > 0 && (
                  <>
                    <ArrowRight size={16} aria-hidden />
                    <span className="text-2xl text-success">{ovrAfter ?? '…'}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {levelsGained > 0 ? <b className="text-success">+{bonus * levelsGained}</b> : `+${bonus} per level`} to {attrs.slice(0, 3).join(', ')}
                {attrs.length > 3 && <span> and {attrs.length - 3} more</span>}
              </p>
            </div>
          )}
          {after.wasted > 0 && (
            <p className="text-sm text-wicket flex gap-1.5 mt-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden /> {after.wasted} XP goes past the cap and is lost. Remove a card.</p>
          )}
          {err && <p className="text-sm text-wicket mt-2" role="alert">{err}</p>}
        </Panel>

        <section className="min-w-0">
          {maxed ? (
            <EmptyState
              title={`${t.name} is maxed out`}
              body={`${t.rarity} cards stop at level ${cap}. Pick someone else to train.`}
              action={<Button onClick={onBack}>Choose another player</Button>}
            />
          ) : (
            <>
              {/* One tap picks for you */}
              <div className="chip-row flex gap-2 overflow-x-auto pb-1">
                {nextPick.length > 0 && (
                  <QuickPick
                    active={same(sac, nextPick)}
                    onClick={() => select(nextPick)}
                    title={nextOK ? `Level up → Lv ${levelWith(nextPick)}` : `Use all spare · +${spareXP} XP`}
                    sub={`${nextPick.length} spare card${nextPick.length === 1 ? '' : 's'}`}
                  />
                )}
                {maxPick.length > 0 && levelWith(maxPick) > levelWith(nextPick) && (
                  <QuickPick
                    active={same(sac, maxPick)}
                    onClick={() => select(maxPick)}
                    title={levelWith(maxPick) >= cap ? `Max out → Lv ${cap}` : `Best possible → Lv ${levelWith(maxPick)}`}
                    sub={`${maxPick.length} spare cards`}
                  />
                )}
                {sac.length > 0 && (
                  <Button variant="ghost" onClick={() => select([])}><X size={16} aria-hidden /> Clear</Button>
                )}
              </div>
              <p className="text-xs text-muted mt-1 mb-3">
                {spare.length === 0
                  ? 'No spare cards yet. Win matches to earn more, or use a valuable card below.'
                  : !nextOK
                    ? `Your ${spare.length} spare cards give ${spareXP} XP: not enough for the next level yet, but you can still bank it.`
                    : `Quick picks use spare cards only: copies first, then other ${ROLE_LABEL[t.role].toLowerCase()}s, then the cheapest to lose. Your squad and valuable cards are never picked.`}
              </p>

              <FodderGrid title="Spare cards" note={`${spare.length}`} cards={spare} t={t} prog={prog} sac={sac} full={sac.length >= maxSac} onToggle={toggle} />

              {valuable.length > 0 && (
                <div className="mt-5">
                  <button
                    type="button"
                    aria-expanded={showValuable}
                    onClick={() => setShowValuable((v) => !v)}
                    className="flex w-full items-center gap-2 min-h-11 rounded-xl border border-border px-3 text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <AlertTriangle size={16} className="text-cta shrink-0" aria-hidden />
                    <span className="font-semibold">Valuable cards</span>
                    <span className="text-xs text-muted truncate">Gold, Legend, levelled or in form · {valuable.length}</span>
                    <ChevronDown size={18} className={cn('ml-auto shrink-0 transition-transform', showValuable && 'rotate-180')} aria-hidden />
                  </button>
                  {showValuable && <div className="mt-3"><FodderGrid cards={valuable} t={t} prog={prog} sac={sac} full={sac.length >= maxSac} onToggle={toggle} /></div>}
                </div>
              )}
              {lockedCount > 0 && (
                <p className="text-xs text-muted mt-4 flex items-center gap-1.5"><Lock size={12} aria-hidden /> {lockedCount} card{lockedCount === 1 ? ' is' : 's are'} in your saved squad and can’t be used. Change your squad to free them.</p>
              )}
            </>
          )}
        </section>
      </div>

      {/* Always-visible action bar: no scrolling back up to train */}
      {!maxed && (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 inset-x-0 md:left-60 z-30 glass border-t border-border">
          <div className="max-w-6xl mx-auto flex items-center gap-3 px-3 sm:px-4 py-2 sm:py-3">
            <div className="min-w-0 flex-1 leading-tight">
              {sac.length ? (
                <>
                  <p className="font-display text-lg font-bold truncate">
                    {levelsGained > 0 ? <>Lv {t.level} → <span className="text-success">Lv {after.level}</span></> : `+${gain} XP`}
                  </p>
                  <p className="text-xs text-muted truncate">{sac.length}/{maxSac} cards · +{gain} XP{after.wasted ? ` · ${after.wasted} wasted` : ''}</p>
                </>
              ) : (
                <p className="text-sm text-muted">Tap cards to use them, or pick a quick option.</p>
              )}
            </div>
            <Button className="shrink-0" disabled={!sac.length || busy} onClick={() => setAsk(true)}>
              Train{sac.length ? ` · ${sac.length}` : ''}
            </Button>
          </div>
        </div>
      )}

      {ask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => !busy && setAsk(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="train-title"
            className="fade-up w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[var(--card-bg)] border border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="train-title" className="font-display text-2xl font-bold uppercase">
              {levelsGained > 0 ? `Train ${t.name.split(' ').slice(-1)[0]} to Lv ${after.level}?` : `Give ${t.name.split(' ').slice(-1)[0]} +${gain} XP?`}
            </h3>
            <p className="text-sm text-muted mt-1">These {sac.length} card{sac.length === 1 ? '' : 's'} will be used up for good:</p>
            <div className="chip-scroll flex gap-2 overflow-x-auto mt-2 pb-1">
              {chosen.map((c) => (
                <span key={c.id} className="flex flex-col items-center w-14">
                  <span className="relative">
                    <PlayerAvatar name={c.name} rarity={c.rarity} />
                    {isPrecious(c) && <AlertTriangle size={14} className="absolute -top-1 -right-1 text-cta fill-[var(--card-bg)]" aria-label="Valuable" />}
                  </span>
                  <span className="text-[11px] font-semibold mt-0.5 w-full text-center truncate">{c.name.split(' ').slice(-1)[0]}</span>
                </span>
              ))}
            </div>
            {precious.length > 0 && (
              <p className="text-sm text-wicket mt-2 flex gap-1.5"><AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden />Includes {precious.length} valuable card{precious.length === 1 ? '' : 's'}: {precious.map((c) => `${c.name} (${c.rarity}, Lv ${c.level})`).join(', ')}.</p>
            )}
            {after.wasted > 0 && <p className="text-sm text-wicket mt-2">{after.wasted} XP will be wasted past the cap.</p>}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" disabled={busy} onClick={() => setAsk(false)}>Back</Button>
              <Button variant={precious.length ? 'danger' : 'primary'} disabled={busy} onClick={confirm} autoFocus>{busy ? 'Training…' : 'Train now'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

function QuickPick({ title, sub, active, onClick }: { title: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 min-h-12 rounded-xl border px-3 py-1.5 text-left cursor-pointer transition-colors',
        active ? 'border-cta bg-cta/15' : 'border-border bg-card/70 hover:bg-black/5 dark:hover:bg-white/10',
      )}
    >
      <Wand2 size={18} className="text-cta shrink-0" aria-hidden />
      <span className="leading-tight">
        <span className="block font-semibold text-sm whitespace-nowrap">{title}</span>
        <span className="block text-xs text-muted whitespace-nowrap">{sub}</span>
      </span>
    </button>
  )
}

/** Levels 1..cap as pips: held (solid), gained by this session (green), still to come. */
function LevelTrack({ cap, level, to }: { cap: number; level: number; to: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-2" aria-label={`Level ${level} of ${cap}${to > level ? `, rising to ${to}` : ''}`} role="img">
      {Array.from({ length: cap }, (_, i) => i + 1).map((l) => (
        <span
          key={l}
          className={cn(
            'h-2 flex-1 rounded-full transition-colors duration-300',
            l <= level ? 'bg-cta' : l <= to ? 'bg-success' : 'bg-black/10 dark:bg-white/10',
          )}
        />
      ))}
      <span className="ml-1.5 text-xs font-bold tabular whitespace-nowrap">Lv {to > level ? <span className="text-success">{to}</span> : level}/{cap}</span>
    </div>
  )
}

/** XP inside the current level: what's held and, if this session stays in the level, what it adds. */
function XPBar({ t, gain, after }: { t: Card; gain: number; after: ReturnType<typeof applyXP> }) {
  const toNext = t.xpToNext ?? after.toNext
  const sameLevel = after.level === t.level
  const held = sameLevel ? (t.xp / toNext) * 100 : 0
  const added = sameLevel ? (gain / toNext) * 100 : after.level >= after.cap ? 100 : (after.xp / after.toNext) * 100
  return (
    <div className="mt-2 h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex" role="progressbar" aria-label="Experience toward the next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(held + added)}>
      <span className="h-full bg-cta transition-[width] duration-300" style={{ width: `${Math.min(100, held)}%` }} />
      <span className="h-full bg-success transition-[width] duration-300" style={{ width: `${Math.min(100 - held, added)}%` }} />
    </div>
  )
}

function FodderGrid({ title, note, cards, t, prog, sac, full, onToggle }: {
  title?: string; note?: string; cards: Card[]; t: Card; prog?: Progression; sac: string[]; full: boolean; onToggle: (c: Card) => void
}) {
  if (!cards.length) {
    return title ? <EmptyState title="No spare cards" body="Win matches to earn more cards to train with." /> : null
  }
  return (
    <div>
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-2">
          <h2 className="font-display text-lg font-bold uppercase">{title} <span className="text-muted text-sm">{note}</span></h2>
          {prog && (
            <p className="text-xs text-muted">
              <span className="text-success font-semibold"><ArrowUp size={11} className="inline -mt-0.5" aria-hidden />{ROLE_LABEL[t.role]}s ×{prog.sacrificeXP.affinity[t.role][t.role]}</span>
              {' · '}<span className="text-wicket/80 font-semibold"><ArrowDown size={11} className="inline -mt-0.5" aria-hidden />other skills ×{prog.sacrificeXP.affinity[t.role][t.role === 'BAT' ? 'BOWL' : 'BAT']}</span>
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-3">
        {cards.map((c) => {
          const on = sac.includes(c.id)
          const copy = c.playerId === t.playerId
          const fit = roleFit(c, t)
          return (
            <div key={c.id} className="flex flex-col items-center">
              <PlayerCard card={c} size="sm" className="w-full max-w-none" selected={on} disabled={!on && full} onClick={() => onToggle(c)} />
              <span
                title={copy ? 'Copy of the same player' : fit === 'same' ? 'Same role: bonus XP' : fit === 'off' ? 'Different skills: reduced XP' : 'Related role'}
                className={cn(
                  'mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none tabular whitespace-nowrap',
                  copy ? 'bg-cta text-cta-fg' : on ? 'bg-success/15 text-success' : fit === 'same' ? 'text-success' : fit === 'off' ? 'text-wicket/80' : 'text-muted',
                )}
              >
                {!copy && fit === 'same' && <ArrowUp size={11} aria-hidden />}
                {!copy && fit === 'off' && <ArrowDown size={11} aria-hidden />}
                +{sacXP(c, t, prog)}{copy ? ' · copy' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
