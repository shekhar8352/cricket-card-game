import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setToken } from '../api/client'
import { Button } from '../components/ui/button'
import { Brand, controlClass } from '../components/ui/chrome'
import { Gift, Trophy, Zap } from 'lucide-react'
import { useUI } from '../store/ui'
import { cn } from '../lib/cn'

const perks = [
  { Icon: Gift, text: 'Free starter pack of 10 player cards' },
  { Icon: Zap, text: '5-over matches. Done in about two minutes.' },
  { Icon: Trophy, text: 'Climb from Bronze to Legend arenas' },
]

const glow = { Bronze: '#e8c99b', Gold: '#f6c445', Legend: '#c4b5fd' }

export function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const setStarter = useUI((s) => s.setStarter)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (tab === 'register') {
        const r = await api.register(username, password)
        setToken(r.token)
        setStarter(r.starterPack)
        nav('/')
      } else {
        const r = await api.login(username, password)
        setToken(r.token)
        nav('/')
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-svh grid lg:grid-cols-2 text-fg">
      <aside className="hero-stadium hidden lg:flex flex-col justify-between p-10">
        <div className="relative z-10"><Brand size="lg" tagline /></div>
        <div className="relative z-10">
          <p className="inline-flex rounded-full bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#ffd166]">Free to play</p>
          <h1 className="font-display text-7xl font-bold uppercase leading-[0.9] mt-4">
            Build your seven.<br /><span className="text-[#ffd166] text-glow">Own the final over.</span>
          </h1>
          <ul className="mt-8 space-y-4 text-lg max-w-md">
            {perks.map(({ Icon, text }) => (
              <li key={text} className="flex gap-3 items-center">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/15 shrink-0"><Icon size={20} aria-hidden /></span>
                <span className="text-white/90">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 flex items-end h-48" aria-hidden>
          {(['Bronze', 'Gold', 'Legend'] as const).map((r, i) => (
            <div key={r} className="w-32 fade-up" style={{ transform: `rotate(${(i - 1) * 12}deg) translateY(${i === 1 ? -18 : 0}px)`, marginLeft: i === 0 ? 0 : -40, animationDelay: `${i * 120}ms` }}>
              <div className="game-card-lift" style={{ boxShadow: `0 18px 40px rgba(0,0,0,0.45), 0 0 26px ${glow[r]}` }}>
                <span className={`game-card-face game-card-front rarity-${r} items-center justify-center gap-2`} style={{ boxShadow: `inset 0 0 0 3px ${glow[r]}` }}>
                  <span className="game-card-mark">7</span>
                  <span className="text-xs font-bold uppercase tracking-widest">{r}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]">
        <form onSubmit={submit} className="w-full max-w-sm glass border border-border rounded-3xl p-6 sm:p-8 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
          <div className="lg:hidden mb-4"><Brand size="lg" tagline /></div>
          <h2 className="font-display text-4xl font-bold uppercase mt-2">{tab === 'login' ? 'Welcome back' : 'Create your club'}</h2>
          <p className="text-muted mt-1 mb-5">{tab === 'login' ? 'Sign in to pick up your squad.' : 'A free starter pack of 10 players is waiting for you.'}</p>
          <div className="grid grid-cols-2 gap-2 mb-5" role="tablist" aria-label="Account">
            {([['login', 'Sign in'], ['register', 'Create account']] as const).map(([t, label]) => (
              <button
                type="button"
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'min-h-11 rounded-xl text-base font-semibold cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  tab === t ? 'btn-pitch' : 'bg-card border border-border text-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block font-medium" htmlFor="username">Username</label>
          <input id="username" name="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className={cn(controlClass, 'w-full mt-1')} />
          <label className="block font-medium mt-4" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} className={cn(controlClass, 'w-full mt-1')} />
          {err && <p className="text-wicket mt-3" role="alert">{err}</p>}
          <Button className="w-full mt-6 min-h-13 text-xl" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : tab === 'login' ? 'Sign in & play' : 'Claim my starter pack'}
          </Button>
          <p className="text-sm text-muted text-center mt-4">Curious how matches are decided? <Link to="/how-it-works" className="underline font-semibold text-fg">See exactly how the engine works</Link></p>
        </form>
      </main>
    </div>
  )
}
