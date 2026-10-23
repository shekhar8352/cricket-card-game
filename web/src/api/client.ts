import type { LeaderRow, MatchDTO, PlayerCard, User } from '../types/engine'

const TOKEN_KEY = 'ccg_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const tok = getToken()
  if (tok) headers.set('Authorization', `Bearer ${tok}`)
  const res = await fetch(`/api${path}`, { ...init, headers })
  if (res.status === 401) {
    setToken(null)
    if (!path.startsWith('/auth')) window.location.href = '/auth'
  }
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || res.statusText)
  }
  return res.json()
}

export const api = {
  register: (username: string, password: string) =>
    req<{ token: string; user: User; starterPack: PlayerCard[] }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    req<{ token: string; user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  me: () => req<{ user: User }>('/me'),
  cards: () => req<PlayerCard[]>('/cards'),
  train: (id: string, sacrificeIds: string[]) =>
    req<{ card: PlayerCard; xpGained: number }>(`/cards/${id}/train`, {
      method: 'POST', body: JSON.stringify({ sacrificeIds }),
    }),
  squad: () => req<{ cardIds: string[]; battingOrder: string[]; bowlingPlan: string[] }>('/squad'),
  saveSquad: (body: { cardIds: string[]; battingOrder: string[]; bowlingPlan: string[] }) =>
    req('/squad', { method: 'PUT', body: JSON.stringify(body) }),
  createMatch: (mode: 'bot' | 'pvp') =>
    req<MatchDTO>('/matches', { method: 'POST', body: JSON.stringify({ mode }) }),
  match: (id: string) => req<MatchDTO>(`/matches/${id}`),
  matches: () => req<MatchDTO[]>('/matches'),
  lockLineup: (id: string, body: { cardIds: string[]; battingOrder: string[]; bowlingPlan: string[]; tossPref: string }) =>
    req<MatchDTO>(`/matches/${id}/lineup`, { method: 'POST', body: JSON.stringify(body) }),
  leaderboard: (arena?: string) => req<LeaderRow[]>(`/leaderboard${arena ? `?arena=${arena}` : ''}`),
  traits: () => req<{ code: string; name: string; description: string }[]>('/traits'),
}

export function liveUrl(matchId: string) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/matches/${matchId}/live`
}
