import type { Rarity, Role } from '../types/engine'

export const RARITY_RING: Record<Rarity, string> = { Bronze: '#e8c99b', Silver: '#e5e7eb', Gold: '#f6c445', Legend: '#c4b5fd' }

export const SQUAD_SLOTS: { role: Role; label: string }[] = [
  { role: 'BAT', label: 'Batter 1' },
  { role: 'BAT', label: 'Batter 2' },
  { role: 'BAT', label: 'Batter 3' },
  { role: 'WK', label: 'Keeper' },
  { role: 'AR', label: 'All-rounder' },
  { role: 'BOWL', label: 'Bowler 1' },
  { role: 'BOWL', label: 'Bowler 2' },
]

export const ROLE_LABEL: Record<Role, string> = {
  BAT: 'Batter',
  WK: 'Keeper',
  AR: 'All-rounder',
  BOWL: 'Bowler',
}

export const ROLE_NEED: Record<Role, number> = { BAT: 3, WK: 1, AR: 1, BOWL: 2 }

export function roleCounts(roles: Role[]) {
  const counts: Record<Role, number> = { BAT: 0, WK: 0, AR: 0, BOWL: 0 }
  for (const role of roles) counts[role]++
  return counts
}

export function statusLabel(status: string, outcome?: 'win' | 'loss' | 'tie') {
  if (status === 'COMPLETE') {
    if (outcome === 'tie') return 'Tie'
    if (outcome === 'win') return 'Win'
    if (outcome === 'loss') return 'Loss'
  }
  if (status === 'MATCHING') return 'Finding opponent'
  if (status === 'WAITING_ROOM') return 'Waiting for a friend'
  if (status === 'LINEUP_PENDING') return 'Lineup needed'
  if (status === 'SIMULATING') return 'Live now'
  if (status === 'INNINGS_BREAK') return 'Innings break: your call'
  if (status === 'SUPER_OVER') return 'Super Over: pick your team'
  return 'In progress'
}

/** Where to open a match from a list. */
export function matchPath(m: { id: string; status: string }) {
  if (m.status === 'COMPLETE') return `/match/${m.id}/result`
  if (m.status === 'LINEUP_PENDING' || m.status === 'MATCHING' || m.status === 'WAITING_ROOM') return `/match/${m.id}/lineup`
  return `/match/${m.id}/live`
}

export function tournamentStatusLabel(status: string) {
  if (status === 'LOBBY') return 'Waiting for players'
  if (status === 'LEAGUE') return 'League stage'
  if (status === 'PLAYOFFS') return 'Knockouts'
  if (status === 'COMPLETE') return 'Finished'
  return 'Closed'
}

export const STAGE_LABEL: Record<string, string> = {
  league: 'League',
  qualifier1: 'Qualifier 1',
  eliminator: 'Eliminator',
  qualifier2: 'Qualifier 2',
  final: 'Final',
}
