package bot

import (
	"fmt"
	"math/rand"
	"sort"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/trophy"
)

type Profile struct {
	Name     string `json:"name"`
	Trophies int    `json:"trophies"`
	Arena    string `json:"arena"`
}

type Deck struct {
	Profile Profile
	Lineup  engine.Lineup
}

func Generate(seed int64, userTrophies int, catalog []engine.Card) Deck {
	rng := rand.New(rand.NewSource(seed))
	arena := trophy.ArenaFor(userTrophies)
	offset := userTrophies + rng.Intn(61) - 30
	if offset < 0 {
		offset = 0
	}
	p := Profile{
		Name:     botName(rng),
		Trophies: offset,
		Arena:    arena.Name,
	}

	byRole := map[engine.Role][]engine.Card{}
	for _, c := range catalog {
		if rarityOK(c.Rarity, arena.Name) {
			byRole[c.Role] = append(byRole[c.Role], c)
		}
	}
	need := []engine.Role{engine.RoleBAT, engine.RoleBAT, engine.RoleBAT, engine.RoleWK, engine.RoleAR, engine.RoleBOWL, engine.RoleBOWL}
	var picked []engine.Card
	used := map[string]bool{}
	for _, role := range need {
		pool := byRole[role]
		if len(pool) == 0 {
			for _, c := range catalog {
				if c.Role == role && !used[c.PlayerID] {
					pool = append(pool, c)
				}
			}
		}
		if len(pool) == 0 {
			continue
		}
		c := pool[rng.Intn(len(pool))]
		for used[c.PlayerID] && len(pool) > 1 {
			c = pool[rng.Intn(len(pool))]
		}
		used[c.PlayerID] = true
		c.ID = uuid.NewString()
		c.Level = levelForArena(arena.Name, rng)
		// ±5% strength jitter via level clamp already; nudge attrs
		jitter := 1 + (rng.Float64()*0.10 - 0.05)
		c.Attrs = scaleAttrs(c.Attrs, jitter)
		picked = append(picked, c)
	}

	lu := engine.Lineup{
		UserID:       "bot",
		Cards:        picked,
		BattingOrder: engine.DefaultBattingOrder(picked),
		BowlingPlan:  bowlingPlan(picked, rng),
		TossPref:     "chase",
	}
	return Deck{Profile: p, Lineup: lu}
}

func bowlingPlan(cards []engine.Card, rng *rand.Rand) []string {
	var bowls []engine.Card
	var ar *engine.Card
	var wk *engine.Card
	for i := range cards {
		c := cards[i]
		switch c.Role {
		case engine.RoleBOWL:
			bowls = append(bowls, c)
		case engine.RoleAR:
			cc := c
			ar = &cc
		case engine.RoleWK:
			cc := c
			wk = &cc
		}
	}
	if len(bowls) < 2 || ar == nil {
		return engine.DefaultBowlingPlan(cards)
	}
	sort.Slice(bowls, func(i, j int) bool {
		return engine.BowlerSkill(bowls[i]) > engine.BowlerSkill(bowls[j])
	})
	death := bowls[0]
	other := bowls[1]
	if engine.Effective(bowls[1]).DeathBowling > engine.Effective(bowls[0]).DeathBowling || engine.HasTrait(bowls[1], "Death Specialist") {
		death, other = bowls[1], bowls[0]
	}
	// prefer spin in middle if keeper can stump
	spinMiddle := wk != nil && engine.Effective(*wk).Stumping >= 78 &&
		(other.BowlType == engine.BowlSpin || death.BowlType == engine.BowlSpin)
	if spinMiddle && other.BowlType == engine.BowlSpin {
		return []string{death.ID, other.ID, death.ID, ar.ID, other.ID}
	}
	if rng.Intn(2) == 0 {
		return []string{death.ID, other.ID, death.ID, ar.ID, other.ID}
	}
	return []string{other.ID, death.ID, other.ID, ar.ID, death.ID}
}

func rarityOK(r engine.Rarity, arena string) bool {
	switch arena {
	case "Bronze":
		return r == engine.RarityBronze || r == engine.RaritySilver
	case "Silver":
		return r != engine.RarityLegend
	case "Gold":
		return true
	default:
		return r == engine.RaritySilver || r == engine.RarityGold || r == engine.RarityLegend
	}
}

func levelForArena(arena string, rng *rand.Rand) int {
	switch arena {
	case "Bronze":
		return 1 + rng.Intn(2)
	case "Silver":
		return 2 + rng.Intn(3)
	case "Gold":
		return 3 + rng.Intn(3)
	case "Crystal":
		return 4 + rng.Intn(4)
	case "Champion":
		return 5 + rng.Intn(4)
	default:
		return 6 + rng.Intn(5)
	}
}

func scaleAttrs(a engine.Attributes, j float64) engine.Attributes {
	scale := func(v int) int {
		n := int(float64(v) * j)
		if n < 1 {
			return 1
		}
		if n > 99 {
			return 99
		}
		return n
	}
	a.Technique = scale(a.Technique)
	a.Power = scale(a.Power)
	a.Timing = scale(a.Timing)
	a.Accuracy = scale(a.Accuracy)
	a.Variation = scale(a.Variation)
	a.WicketTaking = scale(a.WicketTaking)
	return a
}

func botName(rng *rand.Rand) string {
	first := []string{"Ravi", "Alex", "Sam", "Imran", "Chris", "Dev", "Kai", "Omar", "Ben", "Arjun"}
	last := []string{"XI", "Strikers", "Knights", "Stars", "Wolves", "Titans", "Riders", "Kings"}
	return fmt.Sprintf("%s %s", first[rng.Intn(len(first))], last[rng.Intn(len(last))])
}
