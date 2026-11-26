// Package trophy holds the trophy and arena rules: how many trophies a match is
// worth, which arena and division a trophy count puts you in, and the buffer
// that keeps you in an arena after a loss.
package trophy

import (
	"fmt"
	"math"
)

type Arena struct {
	Name      string `json:"name"`
	MinTrophy int    `json:"minTrophy"`
}

// Arenas in climbing order. Every arena but the last has three divisions
// (III, II, I, as in Clash of Clans: III is the entry division, I the top).
var Arenas = []Arena{
	{Name: "Bronze", MinTrophy: 0},
	{Name: "Silver", MinTrophy: 400},
	{Name: "Gold", MinTrophy: 800},
	{Name: "Crystal", MinTrophy: 1200},
	{Name: "Champion", MinTrophy: 1800},
	{Name: "Legend", MinTrophy: 2500},
	{Name: "Titan", MinTrophy: 3200},
	{Name: "Mythic", MinTrophy: 4000},
	{Name: "Hall of Fame", MinTrophy: 5000},
}

const (
	// Buffer is how far below an arena's floor you can drop and still keep that
	// arena (its rank, reward odds and leaderboard). Reach Gold at 800 and you
	// stay in Gold until you fall below 700.
	Buffer = 100
	// Divisions per arena. The top arena has none.
	Divisions = 3
)

func arenaIndex(name string) int {
	for i, a := range Arenas {
		if a.Name == name {
			return i
		}
	}
	return -1
}

// ArenaFor is the arena a trophy count reaches on its own, without the buffer.
// Matchmaking and bots use it.
func ArenaFor(trophies int) Arena {
	cur := Arenas[0]
	for _, a := range Arenas {
		if trophies >= a.MinTrophy {
			cur = a
		}
	}
	return cur
}

// NextArena is the first arena above this trophy count, or nil at the top.
func NextArena(trophies int) *Arena {
	for _, a := range Arenas {
		if trophies < a.MinTrophy {
			aa := a
			return &aa
		}
	}
	return nil
}

// NextAfter is the arena above the one held (nil at the top). Unlike
// NextArena it respects the buffer: a player held in Gold at 720 trophies
// gets Crystal, not Gold.
func NextAfter(held string) *Arena {
	i := max(0, arenaIndex(held)) // an unknown name counts as the first arena
	if i+1 >= len(Arenas) {
		return nil
	}
	a := Arenas[i+1]
	return &a
}

// Resolve is the arena a player holds after their trophies change, given the
// arena they held before. Promotion is immediate; demotion waits until the
// player is more than Buffer trophies below their arena's floor.
func Resolve(current string, trophies int) Arena {
	natural := ArenaFor(trophies)
	ci := arenaIndex(current)
	if ci < 0 || arenaIndex(natural.Name) >= ci {
		return natural
	}
	if trophies >= Arenas[ci].MinTrophy-Buffer {
		return Arenas[ci] // protected by the buffer
	}
	return natural
}

// divisionFloors are the trophy floors of divisions III, II and I of arena i
// (rounded to tens), or just the arena floor for the top arena.
func divisionFloors(i int) []int {
	a := Arenas[i]
	if i == len(Arenas)-1 {
		return []int{a.MinTrophy}
	}
	width := Arenas[i+1].MinTrophy - a.MinTrophy
	out := make([]int, Divisions)
	for d := 0; d < Divisions; d++ {
		out[d] = a.MinTrophy + int(math.Round(float64(width*d)/float64(Divisions)/10))*10
	}
	return out
}

var roman = []string{"", "I", "II", "III"}

// Step is one rung of the trophy road: a division of an arena.
type Step struct {
	Arena     string `json:"arena"`
	Division  int    `json:"division"` // 3 = III (entry) .. 1 = I; 0 for the top arena
	Label     string `json:"label"`    // "Gold II", "Hall of Fame"
	MinTrophy int    `json:"minTrophy"`
}

func step(i, d int) Step {
	floors := divisionFloors(i)
	s := Step{Arena: Arenas[i].Name, Label: Arenas[i].Name, MinTrophy: floors[0]}
	if len(floors) > 1 {
		s.Division = Divisions - d
		s.Label = fmt.Sprintf("%s %s", Arenas[i].Name, roman[s.Division])
		s.MinTrophy = floors[d]
	}
	return s
}

// Road lists every division from Bronze III to the top arena.
func Road() []Step {
	var out []Step
	for i := range Arenas {
		for d := range divisionFloors(i) {
			out = append(out, step(i, d))
		}
	}
	return out
}

// Rank is where a player stands: their arena and division, how far to the next
// step, and whether the buffer is holding them in their arena.
type Rank struct {
	Step
	ArenaIndex int `json:"arenaIndex"`
	Trophies   int `json:"trophies"`
	// Next is the next step up (nil at the top).
	Next *Step `json:"next,omitempty"`
	// Protected is set while trophies are below the arena floor but within the
	// buffer; DemoteBelow is the count under which the arena is lost.
	Protected   bool `json:"protected"`
	DemoteBelow int  `json:"demoteBelow"`
}

// RankOf places a player holding arena `arena` with this many trophies.
func RankOf(arena string, trophies int) Rank {
	held := Resolve(arena, trophies)
	i := arenaIndex(held.Name)
	floors := divisionFloors(i)
	d := 0
	for k, f := range floors {
		if trophies >= f {
			d = k
		}
	}
	r := Rank{Step: step(i, d), ArenaIndex: i, Trophies: trophies}
	if i > 0 {
		r.DemoteBelow = held.MinTrophy - Buffer
		r.Protected = trophies < held.MinTrophy
	}
	switch {
	case d+1 < len(floors):
		n := step(i, d+1)
		r.Next = &n
	case i+1 < len(Arenas):
		n := step(i+1, 0)
		r.Next = &n
	}
	return r
}

// Compare orders two ranks: -1 if a is below b, 0 if equal, 1 if above.
func Compare(a, b Rank) int {
	switch {
	case a.ArenaIndex != b.ArenaIndex:
		return sign(a.ArenaIndex - b.ArenaIndex)
	case a.Division != b.Division:
		return sign(b.Division - a.Division) // III < II < I
	}
	return 0
}

func sign(n int) int {
	switch {
	case n > 0:
		return 1
	case n < 0:
		return -1
	}
	return 0
}

// NewArenasReached lists arenas whose floor a player reaches for the first
// time: above their previous best and at or below their new count.
func NewArenasReached(prevBest, trophies int) []Arena {
	var out []Arena
	for _, a := range Arenas[1:] {
		if a.MinTrophy > prevBest && a.MinTrophy <= trophies {
			out = append(out, a)
		}
	}
	return out
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

// Band is the matchmaking group: the arena trophies alone reach.
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
