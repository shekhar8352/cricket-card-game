import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { PageHeader } from '../components/ui/chrome'
import { useState } from 'react'
import { Bot, Users } from 'lucide-react'

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
        title="Play"
        lede="Choose an opponent. Next you will fill seven slots, set the orders, and watch a 5-over match."
      />
      <ol className="grid sm:grid-cols-3 gap-3 mb-6">
        {['Fill the seven role slots', 'Set batting and bowling', 'Lock in and watch'].map((step, i) => (
          <li key={step} className="rounded-xl border border-border bg-card px-4 py-3">
            <span className="font-display text-2xl text-accent">{i + 1}</span>
            <p className="font-medium">{step}</p>
          </li>
        ))}
      </ol>
      <div className="grid md:grid-cols-2 gap-4">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => start('bot')}
          className="game-tile text-left rounded-xl border border-border bg-card p-5 min-h-11 cursor-pointer hover:border-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          <Bot aria-hidden />
          <h2 className="font-display text-3xl font-semibold mt-3">Practice vs bot</h2>
          <p className="text-muted mt-2">An opponent is ready straight away. Use this while you learn the squad rules.</p>
          <span className="inline-block mt-4 font-semibold text-cta-fg bg-cta rounded-xl px-4 py-2">{busy === 'bot' ? 'Starting…' : 'Start practice'}</span>
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => start('pvp')}
          className="game-tile text-left rounded-xl border border-border bg-card p-5 min-h-11 cursor-pointer hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          <Users aria-hidden />
          <h2 className="font-display text-3xl font-semibold mt-3">Find a player</h2>
          <p className="text-muted mt-2">Wait for someone else to join, then both of you lock a lineup.</p>
          <span className="inline-block mt-4 font-semibold rounded-xl border border-border px-4 py-2">{busy === 'pvp' ? 'Searching…' : 'Find a player'}</span>
        </button>
      </div>
      {err && <p className="text-wicket mt-4" role="alert">{err}</p>}
    </div>
  )
}
