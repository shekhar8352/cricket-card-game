import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { PageHeader } from '../components/ui/chrome'
import { useEffect, useState } from 'react'
import { Bot, ChevronRight, DoorOpen, Handshake, LogIn, Play, Swords, Trophy, Users } from 'lucide-react'
import { tournamentStatusLabel } from '../lib/labels'

export function PlayPage() {
  const nav = useNavigate()
  const [busy, setBusy] = useState<'bot' | 'pvp' | 'room' | 'join' | 'tournament' | null>(null)
  const [err, setErr] = useState('')
  const [code, setCode] = useState('')
  const [cupName, setCupName] = useState('')
  const { hash } = useLocation()
  const mine = useQuery({ queryKey: ['tournaments'], queryFn: api.tournaments })
  const active = (mine.data ?? []).filter((t) => t.status !== 'COMPLETE').slice(0, 4)

  useEffect(() => {
    if (hash !== '#friendly') return
    // After the shell's scroll-to-top on navigation.
    const t = setTimeout(() => document.getElementById('friendly')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    return () => clearTimeout(t)
  }, [hash])

  async function run(kind: NonNullable<typeof busy>, go: () => Promise<string>) {
    setBusy(kind)
    setErr('')
    try {
      nav(await go())
    } catch (e) {
      setErr((e as Error).message)
      setBusy(null)
    }
  }
  const toLineup = (make: () => ReturnType<typeof api.createRoom>) => async () => `/match/${(await make()).id}/lineup`

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

  return (
    <div>
      <PageHeader
        title="Choose your match"
        lede="Pick an opponent, set your seven, and watch five overs of live action."
      />
      <div className="grid md:grid-cols-2 gap-4">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run('bot', toLineup(() => api.createMatch('bot')))}
          className="game-tile hero-stadium text-left rounded-3xl p-6 min-h-64 cursor-pointer flex flex-col focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cta disabled:opacity-60"
        >
          <span className="relative z-10 grid place-items-center w-14 h-14 rounded-2xl bg-white/15"><Bot size={30} aria-hidden /></span>
          <span className="relative z-10 mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#ffd166]">Instant · Trophies on the line</span>
          <h2 className="relative z-10 font-display text-4xl font-bold uppercase mt-1">Quick match</h2>
          <p className="relative z-10 text-white/80 mt-1 max-w-sm">Jump straight in against a bot. Perfect for testing a new lineup.</p>
          <span className="relative z-10 btn-cta mt-auto self-start inline-flex items-center gap-2 rounded-xl px-6 py-3 font-display text-xl font-bold uppercase">
            <Play size={18} fill="currentColor" aria-hidden /> {busy === 'bot' ? 'Starting…' : 'Play now'}
          </span>
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run('pvp', toLineup(() => api.createMatch('pvp')))}
          className="game-tile text-left rounded-3xl p-6 min-h-64 cursor-pointer flex flex-col text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cta disabled:opacity-60 bg-[radial-gradient(ellipse_at_top_right,rgba(196,165,255,0.35),transparent_55%),linear-gradient(160deg,#2a1660,#0f0a24)] shadow-[0_24px_48px_-20px_rgba(60,20,120,0.6)]"
        >
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-white/15"><Swords size={30} aria-hidden /></span>
          <span className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#c4a5ff]">Real opponents · Trophies on the line</span>
          <h2 className="font-display text-4xl font-bold uppercase mt-1">Versus player</h2>
          <p className="text-white/80 mt-1 max-w-sm">Face a real opponent. If nobody shows up in 20 seconds, you'll get a bot.</p>
          <span className="btn-pitch mt-auto self-start inline-flex items-center gap-2 rounded-xl px-6 py-3 font-display text-xl font-bold uppercase">
            <Users size={18} aria-hidden /> {busy === 'pvp' ? 'Searching…' : 'Find opponent'}
          </span>
        </button>
      </div>

      <section
        id="friendly"
        aria-labelledby="friendly-h"
        className="game-tile mt-4 scroll-mt-20 rounded-3xl p-5 sm:p-6 text-white bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.3),transparent_55%),linear-gradient(160deg,#0b3a5c,#06141f)] shadow-[0_24px_48px_-20px_rgba(8,60,100,0.6)]"
      >
        <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">Play friends · No trophies or cards at stake</span>
        <h2 id="friendly-h" className="font-display text-4xl font-bold uppercase mt-1">Play with friends</h2>
        <p className="text-white/80 mt-1 max-w-2xl">Create a room or a tournament and share the code. Every match is saved to your history, but no trophies, cards or XP are won or lost.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-black/25 border border-white/10 p-4 flex flex-col">
            <p className="flex items-center gap-2 font-display text-2xl font-bold uppercase"><Handshake size={22} className="text-[#7dd3fc]" aria-hidden /> Friendly room</p>
            <p className="text-sm text-white/70 mt-1 mb-4">One match against one friend.</p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('room', toLineup(api.createRoom))}
              className="btn-cta mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 min-h-12 font-display text-xl font-bold uppercase disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
            >
              <DoorOpen size={20} aria-hidden /> {busy === 'room' ? 'Opening…' : 'Create a room'}
            </button>
          </div>
          <form
            className="rounded-2xl bg-black/25 border border-white/10 p-4 flex flex-col"
            onSubmit={(e) => {
              e.preventDefault()
              run('tournament', async () => `/tournaments/${(await api.createTournament(cupName)).id}`)
            }}
          >
            <p className="flex items-center gap-2 font-display text-2xl font-bold uppercase"><Trophy size={22} className="text-[#ffd166]" aria-hidden /> Tournament</p>
            <p className="text-sm text-white/70 mt-1 mb-3">3 to 10 players. Everyone plays everyone, then a final (up to 5 players) or IPL-style playoffs (6 or more). Awards at the end.</p>
            <label htmlFor="cup-name" className="sr-only">Tournament name</label>
            <input
              id="cup-name"
              value={cupName}
              onChange={(e) => setCupName(e.target.value)}
              placeholder="Name it (optional)"
              maxLength={40}
              className="w-full rounded-xl border-2 border-white/20 bg-black/30 px-3 py-2.5 text-white placeholder:text-white/40 focus:border-[#ffd166] focus:outline-none mb-3"
            />
            <button
              type="submit"
              disabled={!!busy}
              className="btn-pitch mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 min-h-12 font-display text-xl font-bold uppercase disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
            >
              <Trophy size={18} aria-hidden /> {busy === 'tournament' ? 'Creating…' : 'Create a tournament'}
            </button>
          </form>
        </div>

        <form
          className="mt-3 rounded-2xl bg-black/25 border border-white/10 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (cleanCode.length !== 6) return
            run('join', async () => {
              const r = await api.joinCode(cleanCode)
              return r.type === 'room' ? `/match/${r.id}/lineup` : `/tournaments/${r.id}`
            })
          }}
        >
          <label htmlFor="room-code" className="block font-display text-xl font-bold uppercase">Have a code?</label>
          <p className="text-sm text-white/70 mb-3">Works for both rooms and tournaments.</p>
          <div className="flex gap-2">
            <input
              id="room-code"
              value={cleanCode}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CODE"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              className="w-0 min-w-0 flex-1 rounded-xl border-2 border-white/25 bg-black/30 px-4 py-3 font-display text-2xl font-bold uppercase tracking-[0.3em] text-white placeholder:text-white/35 placeholder:tracking-[0.15em] focus:border-[#7dd3fc] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!!busy || cleanCode.length !== 6}
              className="btn-pitch shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-display text-xl font-bold uppercase disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
            >
              <LogIn size={18} aria-hidden /> {busy === 'join' ? 'Joining…' : 'Join'}
            </button>
          </div>
        </form>

        {active.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60 mb-2">Your tournaments</p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {active.map((t) => (
                <li key={t.id}>
                  <Link to={`/tournaments/${t.id}`} className="flex items-center gap-3 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                    <Trophy size={20} className="text-[#ffd166] shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold truncate">{t.name}</span>
                      <span className="block text-sm text-white/65">
                        {tournamentStatusLabel(t.status)} · {t.players} players{t.yourOpenMatches > 0 ? ` · ${t.yourOpenMatches} to play` : ''}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-white/60" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <ol className="grid sm:grid-cols-3 gap-3 mt-6">
        {['Fill the seven role slots', 'Set batting order and overs', 'Lock in and watch it live'].map((step, i) => (
          <li key={step} className="glass flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-cta text-cta-fg font-display text-xl font-bold">{i + 1}</span>
            <p className="font-semibold">{step}</p>
          </li>
        ))}
      </ol>
      {err && <p className="text-wicket mt-4" role="alert">{err}</p>}
    </div>
  )
}
