package trophy

import "math"

type Arena struct {
	Name      string
	MinTrophy int
}

var Arenas = []Arena{
	{Name: "Bronze", MinTrophy: 0},
	{Name: "Silver", MinTrophy: 400},
	{Name: "Gold", MinTrophy: 800},
	{Name: "Crystal", MinTrophy: 1200},
	{Name: "Champion", MinTrophy: 1800},
	{Name: "Legend", MinTrophy: 2500},
}

func ArenaFor(trophies int) Arena {
	cur := Arenas[0]
	for _, a := range Arenas {
		if trophies >= a.MinTrophy {
			cur = a
		}
	}
	return cur
}

func NextArena(trophies int) *Arena {
	for _, a := range Arenas {
		if trophies < a.MinTrophy {
			aa := a
			return &aa
		}
	}
	return nil
}

func Delta(myTrophies, oppTrophies int, won bool) int {
	adj := int(math.Round(float64(oppTrophies-myTrophies) / 20.0))
	d := 30 + adj
	if d < 20 {
		d = 20
	}
	if d > 40 {
		d = 40
	}
	if !won {
		d = -d
	}
	return d
}

func Apply(trophies, delta int) int {
	n := trophies + delta
	if n < 0 {
		return 0
	}
	return n
}

func Band(trophies int) string {
	return ArenaFor(trophies).Name
}

// StreakBonus is the extra trophies for a win that extends a streak to n wins.
func StreakBonus(n int) int {
	switch {
	case n >= 5:
		return 8
	case n == 4:
		return 6
	case n == 3:
		return 4
	case n == 2:
		return 2
	}
	return 0
}

// StreakBoostAt is the streak length from which one reward card uses the next arena's odds.
const StreakBoostAt = 3
