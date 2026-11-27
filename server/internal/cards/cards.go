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

// Sacrifice XP follows the sacrificed card's overall rating (as shown on the
// card, level bonus included) on a steep curve, then how well its role suits
// the player being trained:
//
//	xp = SacrificeBase x SacrificeGrowth^(overall - SacrificeFrom) x affinity
//
// A 55 gives about 22, a 70 about 54, an 80 about 96 and a 90 about 172 before
// affinity. A batter feeds a batter best (x1.5), a keeper or all-rounder
// reasonably (x1.1), a specialist bowler poorly (x0.7). A copy of the player
// being trained gives SacrificeSameMult x the base instead of the affinity.
const (
	SacrificeBase     = 30.0 // XP for a card rated SacrificeFrom, before affinity
	SacrificeFrom     = 60
	SacrificeGrowth   = 1.06 // each overall point is worth 6% more XP
	SacrificeMinXP    = 10
	SacrificeSameMult = 3.0
)

// Affinity levels between the sacrificed card's role and the target's role.
const (
	AffinitySame    = 1.5
	AffinityRelated = 1.1
	AffinityOff     = 0.7
)

// RoleAffinity is the XP multiplier for feeding a card of role `from` to a
// player of role `to`. Batters and keepers share batting skills; all-rounders
// share with both batters and bowlers.
func RoleAffinity(from, to engine.Role) float64 {
	if from == to {
		return AffinitySame
	}
	related := func(a, b engine.Role) bool {
		return (a == engine.RoleBAT && b == engine.RoleWK) || (a == engine.RoleAR && (b == engine.RoleBAT || b == engine.RoleBOWL))
	}
	if related(from, to) || related(to, from) {
		return AffinityRelated
	}
	return AffinityOff
}

func XPForSacrifice(overall int, from, to engine.Role, samePlayer bool) int {
	mult := RoleAffinity(from, to)
	if samePlayer {
		mult = SacrificeSameMult
	}
	xp := int(math.Round(SacrificeBase * math.Pow(SacrificeGrowth, float64(overall-SacrificeFrom)) * mult))
	if xp < SacrificeMinXP {
		return SacrificeMinXP
	}
	return xp
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
	case "Titan":
		return RewardOdds{12, 36, 36, 16}
	case "Mythic":
		return RewardOdds{8, 32, 40, 20}
	case "Hall of Fame":
		return RewardOdds{5, 27, 43, 25}
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

// MilestoneFloor is the lowest rarity of the one-time card for reaching an arena.
func MilestoneFloor(arena string) engine.Rarity {
	switch arena {
	case "Silver":
		return engine.RaritySilver
	case "Gold", "Crystal":
		return engine.RarityGold
	case "Champion", "Legend", "Titan", "Mythic", "Hall of Fame":
		return engine.RarityLegend
	}
	return engine.RarityBronze
}

var rarityOrder = map[engine.Rarity]int{engine.RarityBronze: 0, engine.RaritySilver: 1, engine.RarityGold: 2, engine.RarityLegend: 3}

// MilestoneRarity rolls the arena's normal odds and lifts the result to the
// milestone floor.
func MilestoneRarity(rng *rand.Rand, arena string) engine.Rarity {
	r := RollRarity(rng, arena)
	if f := MilestoneFloor(arena); rarityOrder[r] < rarityOrder[f] {
		return f
	}
	return r
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
