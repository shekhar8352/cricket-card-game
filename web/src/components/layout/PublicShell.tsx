import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../ui/chrome'

/** Minimal frame for pages readable without an account. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh text-fg">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 min-h-16">
          <Link to="/auth" aria-label="Pitch XI home"><Brand /></Link>
          <Link to="/auth" className="btn-cta rounded-xl px-4 py-2 font-display text-lg font-bold uppercase">Play free</Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
