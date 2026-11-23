import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { PageHeader } from '../components/ui/chrome'
import { useState } from 'react'
import { Bot, Play, Swords, Users } from 'lucide-react'

export function PlayPage() {
  const nav = useNavigate()
  const [busy, setBusy] = useState<'bot' | 'pvp' | null>(null)
  const [err, setErr] = useState('')

  async function start(mode: 'bot' | 'pvp') {
    setBusy(mode)
    setErr('')
    try {
      const m = await api.createMatch(mode)
      nav(`/match/${m.id}/lineup`)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(null)
    }
  }

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
          onClick={() => start('bot')}
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
          onClick={() => start('pvp')}
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
