import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { PageHeader } from '../components/ui/chrome'
import { useEffect, useState } from 'react'
import { Bot, DoorOpen, Handshake, LogIn, Play, Swords, Users } from 'lucide-react'

export function PlayPage() {
  const nav = useNavigate()
  const [busy, setBusy] = useState<'bot' | 'pvp' | 'room' | 'join' | null>(null)
  const [err, setErr] = useState('')
  const [code, setCode] = useState('')
  const { hash } = useLocation()

  useEffect(() => {
    if (hash !== '#friendly') return
    // After the shell's scroll-to-top on navigation.
    const t = setTimeout(() => document.getElementById('friendly')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    return () => clearTimeout(t)
  }, [hash])

  async function run(kind: NonNullable<typeof busy>, make: () => ReturnType<typeof api.createRoom>) {
    setBusy(kind)
    setErr('')
    try {
      const m = await make()
      nav(`/match/${m.id}/lineup`)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(null)
    }
  }

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
          onClick={() => run('bot', () => api.createMatch('bot'))}
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
          onClick={() => run('pvp', () => api.createMatch('pvp'))}
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
        className="game-tile mt-4 rounded-3xl p-6 text-white bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.3),transparent_55%),linear-gradient(160deg,#0b3a5c,#06141f)] shadow-[0_24px_48px_-20px_rgba(8,60,100,0.6)]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 lg:items-center">
          <div>
            <span className="grid place-items-center w-14 h-14 rounded-2xl bg-white/15"><Handshake size={30} aria-hidden /></span>
            <span className="block mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">Play a friend · Just for fun</span>
            <h2 id="friendly-h" className="font-display text-4xl font-bold uppercase mt-1">Friendly room</h2>
            <p className="text-white/80 mt-1 max-w-md">
              Create a room and send your friend the code, or join theirs. The match is saved to both your histories, but no trophies, cards or XP are won or lost.
            </p>
          </div>
          <div className="grid gap-3">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('room', api.createRoom)}
              className="btn-cta inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 min-h-13 font-display text-xl font-bold uppercase disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
            >
              <DoorOpen size={20} aria-hidden /> {busy === 'room' ? 'Opening…' : 'Create a room'}
            </button>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (cleanCode.length === 6) run('join', () => api.joinRoom(cleanCode))
              }}
            >
              <label htmlFor="room-code" className="sr-only">Room code</label>
              <input
                id="room-code"
                value={cleanCode}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ROOM CODE"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
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
            </form>
          </div>
        </div>
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
