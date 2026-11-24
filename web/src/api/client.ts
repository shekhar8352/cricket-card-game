import type { SavedDefault } from '../lib/plan'
import type { AccountStats, PublicProfile, EngineModel, LeaderRow, MatchDTO, OddsRequest, OddsResult, PlayerCard, Streak, SuperOverPicks, TrainResult, User } from '../types/engine'

/** Before a match the player picks only the seven, the captain and the orders. */
export interface LineupBody {
  cardIds: string[]
  battingOrder: string[]
  bowlingPlan: string[]
  captainId: string
}

const TOKEN_KEY = 'ccg_token'

/** Backend origin. The browser calls the Go API directly (no Vite proxy). */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

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
  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (res.status === 401) {
    setToken(null)
    if (!path.startsWith('/auth')) window.location.href = '/auth'
  }
  if (!res.ok) {
    const t = (await res.text()).trim()
    throw new Error(t || res.statusText)
  }
  if (res.status === 204) return undefined as T
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
  me: () => req<{ user: User; streak?: Streak }>('/me'),
  submitBreak: (id: string, body: { call: string; battingOrder?: string[]; bowlingPlan?: string[] }) =>
    req<MatchDTO>(`/matches/${id}/break`, { method: 'POST', body: JSON.stringify(body) }),
  submitSuperOver: (id: string, body: SuperOverPicks | Record<string, never>) =>
    req<MatchDTO>(`/matches/${id}/superover`, { method: 'POST', body: JSON.stringify(body) }),
  myStats: () => req<AccountStats>('/me/stats'),
  profile: (userId: string) => req<PublicProfile>(`/users/${userId}`),
  engineModel: () => req<EngineModel>('/engine/model'),
  engineOdds: (body: OddsRequest) => req<OddsResult>('/engine/odds', { method: 'POST', body: JSON.stringify(body) }),
  cards: () => req<PlayerCard[]>('/cards'),
  train: (id: string, sacrificeIds: string[]) =>
    req<{ card: PlayerCard; result: TrainResult; xpGained: number }>(`/cards/${id}/train`, {
      method: 'POST', body: JSON.stringify({ sacrificeIds }),
    }),
  previewTraining: (id: string, sacrificeIds: string[]) =>
    req<{ result: TrainResult; xpGained: number }>(`/cards/${id}/train`, {
      method: 'POST', body: JSON.stringify({ sacrificeIds, dryRun: true }),
    }),
  squad: () => req<SavedDefault>('/squad'),
  saveSquad: (body: LineupBody) =>
    req<{ ok: string }>('/squad', { method: 'PUT', body: JSON.stringify(body) }),
  createMatch: (mode: 'bot' | 'pvp') =>
    req<MatchDTO>('/matches', { method: 'POST', body: JSON.stringify({ mode }) }),
  match: (id: string) => req<MatchDTO>(`/matches/${id}`),
  createRoom: () => req<MatchDTO>('/rooms', { method: 'POST' }),
  joinRoom: (code: string) => req<MatchDTO>('/rooms/join', { method: 'POST', body: JSON.stringify({ code }) }),
  cancelRoom: (id: string) => req<void>(`/rooms/${id}/cancel`, { method: 'POST' }),
  matches: () => req<MatchDTO[]>('/matches'),
  lockLineup: (id: string, body: LineupBody) =>
    req<MatchDTO>(`/matches/${id}/lineup`, { method: 'POST', body: JSON.stringify(body) }),
  leaderboard: (arena?: string) => req<LeaderRow[]>(`/leaderboard${arena ? `?arena=${arena}` : ''}`),
  traits: () => req<{ code: string; name: string; description: string }[]>('/traits'),
}

export function liveUrl(matchId: string) {
  return `${API_URL.replace(/^http/, 'ws')}/matches/${matchId}/live`
}
