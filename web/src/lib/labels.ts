import type { Role } from '../types/engine'

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
  if (status === 'LINEUP_PENDING') return 'Lineup needed'
  if (status === 'SIMULATING') return 'Live now'
  return 'In progress'
}
