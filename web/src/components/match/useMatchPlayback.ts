import { useEffect, useMemo, useState } from 'react'
import type { BallEvent } from '../../types/engine'
import { liveUrl } from '../../api/client'
import { useUI } from '../../store/ui'

export function useMatchPlayback(matchId: string, log: BallEvent[] | undefined, complete: boolean) {
  const speed = useUI((s) => s.speed)
  const [idx, setIdx] = useState(0)
  const [skip, setSkip] = useState(false)
  const [wsLog, setWsLog] = useState<BallEvent[] | null>(null)

  useEffect(() => {
    if (complete || !matchId) return
    const ws = new WebSocket(liveUrl(matchId))
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.ballLog) setWsLog(msg.ballLog)
        if (msg.type === 'complete' && msg.ballLog) setWsLog(msg.ballLog)
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [matchId, complete])

  const balls = wsLog ?? log ?? []
  const delay = speed === 2 ? 750 : 1500

  useEffect(() => {
    if (skip) {
      setIdx(balls.length)
      return
    }
    if (idx >= balls.length) return
    const t = setTimeout(() => setIdx((i) => i + 1), delay)
    return () => clearTimeout(t)
  }, [idx, balls.length, delay, skip])

  const shown = useMemo(() => balls.slice(0, idx), [balls, idx])
  const current = shown[shown.length - 1]
  return { shown, current, total: balls.length, done: idx >= balls.length && balls.length > 0, skipToEnd: () => setSkip(true) }
}
