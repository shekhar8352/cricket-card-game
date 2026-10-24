import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api/client'
import { Button } from '../components/ui/button'
import { controlClass } from '../components/ui/chrome'
import { useUI } from '../store/ui'
import { cn } from '../lib/cn'

const steps = [
  'Pick three batters, one keeper, one all-rounder, and two bowlers.',
  'Set the batting order and who bowls each over.',
  'Play five overs and climb the trophy arenas.',
]

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
    <div className="min-h-svh grid lg:grid-cols-2 bg-bg text-fg">
      <aside className="hidden lg:flex flex-col justify-between bg-[#1d4ed8] text-white p-10">
        <div className="font-display text-4xl font-semibold">Pitch XI</div>
        <div>
          <h1 className="font-display text-6xl font-semibold leading-none">Five overs. Seven cards.</h1>
          <ol className="mt-8 space-y-4 text-lg max-w-md">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="font-display text-2xl leading-none">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex items-end" aria-hidden>
          {[-10, 0, 10].map((deg) => (
            <div key={deg} className="w-28" style={{ transform: `rotate(${deg}deg)`, marginLeft: deg === -10 ? 0 : -36 }}>
              <div className="game-card-lift">
                <span className="game-card-face game-card-back">
                  <span className="game-card-mark">XI</span>
                  <span className="text-sm font-semibold">Pitch XI</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden font-display text-4xl font-semibold text-accent">Pitch XI</div>
          <h2 className="font-display text-3xl font-semibold mt-2">{tab === 'login' ? 'Welcome back' : 'Create your club'}</h2>
          <p className="text-muted mt-1 mb-5">{tab === 'login' ? 'Sign in to pick up your squad.' : 'A starter pack of seven players is waiting.'}</p>
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
                  tab === t ? 'bg-accent text-white dark:text-accent-fg' : 'bg-card border border-border text-fg',
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
          <Button className="w-full mt-5" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </main>
    </div>
  )
}
