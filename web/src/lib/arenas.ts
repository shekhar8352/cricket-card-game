import { Crown, Flame, Gem, Mountain, Shield, ShieldCheck, Sparkles, Swords, Trophy, type LucideIcon } from 'lucide-react'

/**
 * Each arena's look. Arenas share names with card rarities (Bronze, Silver,
 * Gold, Legend), so arenas always appear as a shield badge with the word
 * "arena" or a division numeral, never as a plain coloured word like a rarity.
 */
export interface ArenaTheme {
  /** Solid colour for marks (badge fill, road segment). */
  color: string
  /** Two-stop gradient for the badge. */
  from: string
  to: string
  /** Ink for text set on the badge fill. */
  ink: string
  Icon: LucideIcon
}

const THEMES: Record<string, ArenaTheme> = {
  Bronze: { color: '#b4743c', from: '#d79a62', to: '#8a5326', ink: '#1d0f04', Icon: Shield },
  Silver: { color: '#9aa8b8', from: '#d8e0ea', to: '#7d8a9b', ink: '#111827', Icon: ShieldCheck },
  Gold: { color: '#e5b13a', from: '#ffd978', to: '#c08a16', ink: '#1f1503', Icon: Trophy },
  Crystal: { color: '#38bdf8', from: '#a5e6ff', to: '#1f8fd1', ink: '#03192a', Icon: Gem },
  Champion: { color: '#8b5cf6', from: '#c4b5fd', to: '#6d3fe0', ink: '#ffffff', Icon: Swords },
  Legend: { color: '#f97316', from: '#ffb36b', to: '#d9560b', ink: '#1f0b00', Icon: Flame },
  Titan: { color: '#e11d48', from: '#fb7185', to: '#a3102f', ink: '#ffffff', Icon: Mountain },
  Mythic: { color: '#d946ef', from: '#f0abfc', to: '#a21caf', ink: '#ffffff', Icon: Sparkles },
  'Hall of Fame': { color: '#facc15', from: '#fff3b0', to: '#d4a106', ink: '#1a1300', Icon: Crown },
}

export function arenaTheme(arena?: string): ArenaTheme {
  return THEMES[arena ?? ''] ?? THEMES.Bronze
}

export const ROMAN = ['', 'I', 'II', 'III']
