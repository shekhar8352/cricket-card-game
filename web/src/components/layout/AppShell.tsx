import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, setToken } from '../../api/client'
import { useUI } from '../../store/ui'
import { Trophy, Home, Play, Layers, Dumbbell, Medal, History, Users, Moon, Sun, LogOut, Menu, UserRound, BookOpen } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Brand } from '../ui/chrome'

const groups = [
  {
    label: 'Play',
    links: [
      { to: '/', label: 'Home', icon: Home },
      { to: '/play', label: 'Play', icon: Play },
    ],
  },
  {
    label: 'Your cards',
    links: [
      { to: '/squad', label: 'Squad', icon: Users },
      { to: '/collection', label: 'Collection', icon: Layers },
      { to: '/training', label: 'Training', icon: Dumbbell },
    ],
  },
  {
    label: 'Progress',
    links: [
      { to: '/leaderboard', label: 'Leaderboard', icon: Medal },
      { to: '/history', label: 'History', icon: History },
      { to: '/account', label: 'Account', icon: UserRound },
    ],
  },
  {
    label: 'Learn',
    links: [{ to: '/engine', label: 'How it works', icon: BookOpen }],
  },
]

const mobile = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/play', label: 'Play', icon: Play },
  { to: '/collection', label: 'Cards', icon: Layers },
  { to: '/squad', label: 'Squad', icon: Users },
]

const moreLinks = [
  { to: '/account', label: 'Account', icon: UserRound },
  { to: '/engine', label: 'How it works', icon: BookOpen },
  { to: '/training', label: 'Training', icon: Dumbbell },
  { to: '/leaderboard', label: 'Leaderboard', icon: Medal },
  { to: '/history', label: 'History', icon: History },
]

function itemClass(active: boolean) {
  return cn(
    'flex items-center gap-3 rounded-xl min-h-11 px-3 text-base cursor-pointer transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    active ? 'bg-accent/15 text-accent font-semibold shadow-[inset_3px_0_0_var(--accent)]' : 'text-fg hover:bg-black/5 dark:hover:bg-white/10',
  )
}

export function AppShell() {
  const nav = useNavigate()
  const loc = useLocation()
  const { theme, toggleTheme } = useUI()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const user = me.data?.user
  const [more, setMore] = useState(false)
  const moreActive = moreLinks.some((l) => loc.pathname.startsWith(l.to))

  function logout() {
    setToken(null)
    nav('/auth')
  }

  return (
    <div className="min-h-svh bg-bg text-fg md:flex">
      <aside className="hidden md:flex flex-col w-60 border-r border-border glass sticky top-0 h-svh">
        <div className="px-5 py-5">
          <Brand tagline />
        </div>
        <div className="px-3 pb-4">
          <NavLink to="/play" className="btn-cta flex items-center justify-center gap-2 rounded-xl min-h-12 font-display text-xl font-bold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Play size={18} fill="currentColor" aria-hidden />
            Play now
          </NavLink>
        </div>
        <nav className="flex-1 px-3 overflow-y-auto" aria-label="Main">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="px-3 pb-1 text-sm font-semibold text-muted">{group.label}</div>
              <div className="space-y-1">
                {group.links.map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => itemClass(isActive)}>
                    <l.icon size={18} aria-hidden />
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          {user && (
            <NavLink to="/account" className={itemClass(false)} aria-label={`${user.username}, open your account`}>
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-cta to-cta-2 font-display text-sm font-bold text-cta-fg" aria-hidden>{user.username.slice(0, 2).toUpperCase()}</span>
              <span className="truncate">{user.username}</span>
            </NavLink>
          )}
          <button type="button" onClick={toggleTheme} className={itemClass(false) + ' w-full'}>
            {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" onClick={logout} className={itemClass(false) + ' w-full'}>
            <LogOut size={18} aria-hidden />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-16 border-b border-border glass flex items-center justify-between gap-3 px-4 sticky top-0 z-20">
          <div className="md:hidden"><Brand /></div>
          <div className="flex items-center gap-2 ml-auto">
            {user && (
              <NavLink to="/account" className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 min-h-10 hover:bg-gold/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`${user.trophies} trophies, ${user.arena} arena. Open your account`}>
                <Trophy size={18} className="text-gold" aria-hidden />
                <span className="tabular font-display text-xl font-bold">{user.trophies}</span>
                <span className="text-muted hidden sm:inline">{user.arena}</span>
              </NavLink>
            )}
            <button type="button" onClick={toggleTheme} className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 pb-28 md:pb-10">
          <Outlet />
        </main>

        {more && (
          <button type="button" className="md:hidden fixed inset-0 z-30 bg-black/40 cursor-pointer" aria-label="Close menu" onClick={() => setMore(false)} />
        )}
        {more && (
          <div className="md:hidden fixed inset-x-3 bottom-20 z-50 rounded-xl border border-border bg-card p-2 shadow-lg">
            {moreLinks.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setMore(false)} className={({ isActive }) => itemClass(isActive)}>
                <l.icon size={18} aria-hidden />
                {l.label}
              </NavLink>
            ))}
            <button type="button" onClick={logout} className={itemClass(false) + ' w-full'}>
              <LogOut size={18} aria-hidden />
              Log out
            </button>
          </div>
        )}
        <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border glass grid grid-cols-5 z-40" aria-label="Main">
          {mobile.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => cn('flex flex-col items-center justify-center gap-0.5 min-h-16 text-base cursor-pointer', isActive ? 'text-accent font-semibold' : 'text-muted')}
            >
              <l.icon size={20} aria-hidden />
              {l.label}
            </NavLink>
          ))}
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className={cn('flex flex-col items-center justify-center gap-0.5 min-h-16 text-base cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', more || moreActive ? 'text-accent font-semibold' : 'text-muted')}
          >
            <Menu size={20} aria-hidden />
            More
          </button>
        </nav>
      </div>
    </div>
  )
}
