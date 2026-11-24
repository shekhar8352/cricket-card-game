import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, DoorClosed, Handshake, Share2 } from 'lucide-react'
import { api } from '../../api/client'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/chrome'
import type { MatchDTO } from '../../types/engine'

/** The host's view of a friendly room until a friend joins with the code. */
export function WaitingRoom({ match }: { match: MatchDTO }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (match.status === 'CANCELLED' || !match.roomCode) {
    return (
      <EmptyState
        title="This room is closed"
        body="It was closed by the host or nobody joined within 30 minutes. Open a new room to play a friend."
        action={<Button onClick={() => nav('/play')}>Back to play</Button>}
      />
    )
  }

  const code = match.roomCode
  const link = `${window.location.origin}/join/${code}`
  const left = match.roomExpiresAt ? Math.max(0, Math.round((new Date(match.roomExpiresAt).getTime() - now) / 1000)) : null
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function copy(what: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : link)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setErr('Couldn’t copy. Select the code and copy it yourself.')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Pitch 7 friendly', text: `Play me in Pitch 7! Room code ${code}`, url: link })
    } catch {
      // Closing the share sheet isn't an error worth showing.
    }
  }

  async function close() {
    setBusy(true)
    setErr('')
    try {
      await api.cancelRoom(match.id)
      await qc.invalidateQueries({ queryKey: ['matches'] })
      nav('/play')
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
      await qc.invalidateQueries({ queryKey: ['match', match.id] })
    }
  }

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-10">
      <section className="rounded-3xl p-6 sm:p-8 text-center text-white bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.3),transparent_60%),linear-gradient(160deg,#0b3a5c,#06141f)] shadow-[0_24px_48px_-20px_rgba(8,60,100,0.6)]">
        <span className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-white/15"><Handshake size={30} aria-hidden /></span>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">Friendly room · No trophies</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase mt-1">Invite a friend</h1>
        <p className="text-white/80 mt-1">Send them this code. They enter it on the Play page, or just open the link.</p>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-white/60" id="room-code-label">Room code</p>
        <p
          aria-labelledby="room-code-label"
          className="font-display text-5xl sm:text-6xl font-bold tracking-[0.25em] tabular select-all text-[#ffd166] text-glow mt-1 pl-[0.25em]"
        >
          {code}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mt-6">
          <Button onClick={() => copy('code')}>
            {copied === 'code' ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copied === 'code' ? 'Copied' : 'Copy code'}
          </Button>
          {canShare ? (
            <Button variant="pitch" onClick={share}><Share2 size={18} aria-hidden /> Share invite</Button>
          ) : (
            <Button variant="pitch" onClick={() => copy('link')}>
              {copied === 'link' ? <Check size={18} aria-hidden /> : <Share2 size={18} aria-hidden />} {copied === 'link' ? 'Link copied' : 'Copy invite link'}
            </Button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-white/80" role="status">
          <span className="relative flex w-2.5 h-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dd3fc] opacity-75" />
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-[#7dd3fc]" />
          </span>
          Waiting for your friend to join…
        </div>
        {left != null && (
          <p className="text-sm text-white/55 mt-1 tabular">Room closes in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
        )}
      </section>

      <p className="text-sm text-muted text-center mt-4">
        Your lineup opens here as soon as they join, starting from your <Link className="underline" to="/squad">default team</Link>. You can leave and come back from Home.
      </p>
      <div className="text-center mt-3">
        <Button variant="ghost" disabled={busy} onClick={close}><DoorClosed size={16} aria-hidden /> {busy ? 'Closing…' : 'Close room'}</Button>
      </div>
      {err && <p className="text-wicket text-center mt-2" role="alert">{err}</p>}
    </div>
  )
}
