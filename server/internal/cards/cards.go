package cards

import (
	"math"
	"math/rand"

	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/trophy"
)

func XPToNext(level int) int {
	return level * 80
}

func XPForSacrifice(rarity engine.Rarity, samePlayer bool) int {
	base := 40
	switch rarity {
	case engine.RaritySilver:
		base = 55
	case engine.RarityGold:
		base = 80
	case engine.RarityLegend:
		base = 120
	}
	if samePlayer {
		return base * 3
	}
	return base
}

type RewardOdds struct {
	Bronze, Silver, Gold, Legend int
}

func OddsForArena(arena string) RewardOdds {
	switch arena {
	case "Silver":
		return RewardOdds{70, 24, 5, 1}
	case "Gold":
		return RewardOdds{55, 32, 11, 2}
	case "Crystal":
		return RewardOdds{40, 38, 18, 4}
	case "Champion":
		return RewardOdds{28, 40, 25, 7}
	case "Legend":
		return RewardOdds{18, 38, 32, 12}
	default:
		return RewardOdds{82, 16, 2, 0}
	}
}

func RollRarity(rng *rand.Rand, arena string) engine.Rarity {
	o := OddsForArena(arena)
	r := rng.Intn(100)
	if r < o.Legend {
		return engine.RarityLegend
	}
	r -= o.Legend
	if r < o.Gold {
		return engine.RarityGold
	}
	r -= o.Gold
	if r < o.Silver {
		return engine.RaritySilver
	}
	return engine.RarityBronze
}

func LossXP() int { return 18 }

func ArenaOf(trophies int) string { return trophy.ArenaFor(trophies).Name }

// Performance XP: every card that plays earns a little XP from its match
// rating, win or lose. Kept small next to training (level 2 needs 80 XP).
const (
	PerfXPMin        = 2 // floor for any appearance
	PerfXPPerPoint   = 3 // per rating point above PerfXPFromRating
	PerfXPFromRating = 5.0
)

func PerformanceXP(rating float64) int {
	xp := PerfXPMin + int(math.Round((rating-PerfXPFromRating)*PerfXPPerPoint))
	if xp < PerfXPMin {
		return PerfXPMin
	}
	return xp
}

// ApplyXP adds gain to a card, levelling up until the rarity's cap. XP that
// would go past the cap is returned as wasted instead of silently vanishing.
func ApplyXP(level, xp int, rarity engine.Rarity, gain int) (newLevel, newXP, wasted int) {
	cap := engine.LevelCap(rarity)
	newLevel, newXP = level, xp+gain
	for newLevel < cap && newXP >= XPToNext(newLevel) {
		newXP -= XPToNext(newLevel)
		newLevel++
	}
	if newLevel >= cap {
		wasted = newXP
		newXP = 0
	}
	return newLevel, newXP, wasted
}
