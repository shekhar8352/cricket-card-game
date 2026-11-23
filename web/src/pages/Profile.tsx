import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Crown, Link2, Medal, Shield, Target, Trophy } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { EmptyState, Panel } from '../components/ui/chrome'
import { PlayerCard } from '../components/card/PlayerCard'
import { PlayerAvatar } from '../components/card/PlayerAvatar'
import { CardDetail } from '../components/card/CardDetail'
import { CaptainProfile } from '../components/card/CaptainProfile'
import { link, teamChemistry } from '../lib/captaincy'
import { ROLE_LABEL } from '../lib/labels'
import type { PlayerCard as Card, PublicProfile } from '../types/engine'
import { CareerSections, CollectionSummary, HeroStat, SectionTitle } from './Account'

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Another player's public profile: record, default seven and career stats. */
export function ProfilePage() {
  const { id = '' } = useParams()
  const q = useQuery({ queryKey: ['profile', id], queryFn: () => api.profile(id), enabled: !!id })

  if (q.isPending) return <p className="text-muted">Loading player…</p>
  if (q.isError || !q.data) {
    return (
      <EmptyState
        title="Couldn’t load this player"
        body={(q.error as Error)?.message ?? 'Please try again.'}
        action={<Button onClick={() => q.refetch()}>Retry</Button>}
      />
    )
  }

  const p = q.data
  const a = p.account
  const s = p.stats.summary

  return (
    <div className="space-y-6">
      <Link to="/leaderboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} aria-hidden /> Leaderboard
      </Link>

      <section className="hero-stadium rounded-3xl px-5 py-7 sm:px-8">
        <div className="relative z-10 flex flex-col xl:flex-row gap-6 xl:items-center justify-between">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <span className="grid place-items-center w-20 h-20 shrink-0 rounded-2xl bg-gradient-to-br from-[#5ff0a8] to-[#1b8a5a] font-display text-4xl font-bold text-[#04170d] shadow-[0_10px_30px_rgba(40,200,120,0.35)]" aria-hidden>
              {a.username.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">{p.me ? 'Your public profile' : 'Club captain'}</p>
              <h1 className="font-display text-3xl sm:text-5xl font-bold uppercase leading-none break-all">{a.username}</h1>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-white/75 text-sm">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} aria-hidden /> Joined {date(a.createdAt)}</span>
                <span className="inline-flex items-center gap-1.5"><Shield size={15} aria-hidden /> {a.arena} arena</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 xl:w-[30rem] xl:shrink-0">
            <HeroStat label="Trophies" value={String(a.trophies)} icon={<Trophy size={18} aria-hidden />} gold />
            <HeroStat label="Global rank" value={`#${a.rank}`} sub={`of ${a.totalPlayers} players`} icon={<Medal size={18} aria-hidden />} />
            <HeroStat
              label="Win rate"
              value={s.played ? `${Math.round(s.winRate * 100)}%` : '—'}
              sub={`${s.won}W · ${s.lost}L${s.tied ? ` · ${s.tied}T` : ''}`}
              icon={<Target size={18} aria-hidden />}
            />
          </div>
        </div>
      </section>

      <DefaultSeven profile={p} />

      <CareerSections
        data={p}
        empty={<EmptyState title={`${a.username} hasn’t finished a match yet`} body="Their record, top run scorers and leading wicket takers show up here after their first match." />}
      />

      <CollectionSummary collection={p.collection} />
    </div>
  )
}

function DefaultSeven({ profile }: { profile: PublicProfile }) {
  const model = useQuery({ queryKey: ['engine-model'], queryFn: api.engineModel, staleTime: Infinity })
  const [open, setOpen] = useState<Card | null>(null)
  const sq = profile.squad
  const byId = useMemo(() => Object.fromEntries((sq?.cards ?? []).map((c) => [c.id, c])), [sq])
  const strokes = useMemo(() => Object.fromEntries((model.data?.masterstrokes ?? []).map((m) => [m.code, m])), [model.data])

  if (!sq || sq.cards.length === 0) {
    return (
      <section aria-labelledby="xi-h">
        <SectionTitle id="xi-h">Default playing 7</SectionTitle>
        <EmptyState
          title="No default team saved"
          body={profile.me ? 'Save a default team on the Squad & strategy page and it shows here.' : `${profile.account.username} picks their seven match by match.`}
        />
      </section>
    )
  }

  const captain = sq.captainId ? byId[sq.captainId] : undefined
  const chem = teamChemistry(sq.battingOrder, byId, model.data?.chemistry)
  const overall = Math.round(sq.cards.reduce((t, c) => t + c.overall, 0) / sq.cards.length)

  return (
    <section aria-labelledby="xi-h">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <SectionTitle id="xi-h">Default playing 7</SectionTitle>
        <p className="text-sm text-muted mb-3">
          Team overall <b className="text-fg tabular">{overall}</b> · Chemistry <b className="text-fg tabular">{chem}</b>/100
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {sq.cards.map((c, i) => (
          <div key={c.id} className="flex flex-col items-center gap-1.5">
            <PlayerCard
              card={c}
              size="lg"
              status={c.id === sq.captainId ? 'C' : undefined}
              onClick={() => setOpen(c)}
            />
            <p className="text-xs text-muted">Bats #{i + 1}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mt-4">
        <Panel>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cta mb-2"><Crown size={14} aria-hidden /> Captain</p>
          {captain?.captaincy ? (
            <CaptainProfile name={captain.name} cp={captain.captaincy} rep={captain.captainRep} def={strokes[captain.captaincy.masterstroke]} />
          ) : (
            <p className="text-muted">No captain set.</p>
          )}
        </Panel>

        <Panel>
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Batting order</p>
          <ol className="space-y-1.5">
            {sq.battingOrder.map((cid, i) => {
              const c = byId[cid]
              const next = byId[sq.battingOrder[i + 1]]
              const l = link(c, next, model.data?.chemistry)
              return (
                <li key={cid} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right tabular text-muted">{i + 1}</span>
                  <PlayerAvatar name={c?.name} rarity={c?.rarity} />
                  <span className="font-semibold truncate">{c?.name}</span>
                  <span className="text-xs text-muted">{c && ROLE_LABEL[c.role]}</span>
                  {l > 0 && (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-xs text-success" title={`Link ${l} with the next batter`}>
                      <Link2 size={12} aria-hidden />{l}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </Panel>

        <Panel>
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Bowling order</p>
          {sq.bowlingPlan.length === 0 ? (
            <p className="text-muted text-sm">No bowling plan saved.</p>
          ) : (
            <ol className="space-y-1.5">
              {sq.bowlingPlan.map((cid, i) => {
                const c = byId[cid]
                return (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-12 text-muted">Over {i + 1}</span>
                    <PlayerAvatar name={c?.name} rarity={c?.rarity} />
                    <span className="font-semibold truncate">{c?.name}</span>
                    <span className="text-xs text-muted ml-auto">{c?.bowlType}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </Panel>
      </div>

      <CardDetail card={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} readOnly={!profile.me} />
    </section>
  )
}
