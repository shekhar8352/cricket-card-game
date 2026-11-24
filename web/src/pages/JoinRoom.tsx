import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/chrome'

/** Landing page for an invite link (/join/CODE): joins the room or tournament and opens it. */
export function JoinRoomPage() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const [err, setErr] = useState('')
  const tried = useRef(false)

  useEffect(() => {
    if (tried.current) return
    tried.current = true
    api
      .joinCode(code)
      .then((r) => nav(r.type === 'room' ? `/match/${r.id}/lineup` : `/tournaments/${r.id}`, { replace: true }))
      .catch((e: Error) => setErr(e.message))
  }, [code, nav])

  if (!err) return <p className="text-muted text-center py-16">Joining {code.toUpperCase()}…</p>
  return (
    <EmptyState
      title="Couldn’t join with that code"
      body={err}
      action={<Button onClick={() => nav('/play')}>Enter a code</Button>}
    />
  )
}
