package trophy

import "testing"

func TestArenaFor(t *testing.T) {
	if ArenaFor(0).Name != "Bronze" {
		t.Fatal()
	}
	if ArenaFor(1200).Name != "Crystal" {
		t.Fatal()
	}
	if ArenaFor(2500).Name != "Legend" {
		t.Fatal()
	}
}

func TestDeltaClamp(t *testing.T) {
	d := Delta(0, 0, true)
	if d < 20 || d > 40 {
		t.Fatalf("%d", d)
	}
	if Delta(100, 100, false) >= 0 {
		t.Fatal("loss should be negative")
	}
	if Apply(5, -30) != 0 {
		t.Fatal("floor at 0")
	}
}

func TestStreakBonus(t *testing.T) {
	for n, want := range map[int]int{0: 0, 1: 0, 2: 2, 3: 4, 4: 6, 5: 8, 9: 8} {
		if got := StreakBonus(n); got != want {
			t.Errorf("StreakBonus(%d) = %d, want %d", n, got, want)
		}
	}
}

func TestBufferKeepsArena(t *testing.T) {
	// Reach Gold at 800, lose: still Gold until below 700.
	if a := Resolve("Silver", 800); a.Name != "Gold" {
		t.Fatalf("promotion is immediate, got %s", a.Name)
	}
	for _, tr := range []int{790, 750, 700} {
		if a := Resolve("Gold", tr); a.Name != "Gold" {
			t.Fatalf("%d trophies should stay Gold, got %s", tr, a.Name)
		}
	}
	if a := Resolve("Gold", 699); a.Name != "Silver" {
		t.Fatalf("699 should drop to Silver, got %s", a.Name)
	}
	// Climbing back to Silver's floor doesn't re-promote until 800.
	if a := Resolve("Silver", 780); a.Name != "Silver" {
		t.Fatalf("got %s", a.Name)
	}
	// Unknown or stale arena names fall back to the trophy count.
	if a := Resolve("Nowhere", 1300); a.Name != "Crystal" {
		t.Fatalf("got %s", a.Name)
	}
}

func TestRankDivisions(t *testing.T) {
	cases := []struct {
		arena    string
		trophies int
		label    string
		next     string
		prot     bool
	}{
		{"Bronze", 0, "Bronze III", "Bronze II", false},
		{"Bronze", 399, "Bronze I", "Silver III", false},
		{"Gold", 800, "Gold III", "Gold II", false},
		{"Gold", 940, "Gold II", "Gold I", false},
		{"Gold", 1100, "Gold I", "Crystal III", false},
		{"Gold", 720, "Gold III", "Gold II", true}, // within the buffer
		{"Gold", 690, "Silver I", "Gold III", false},
		{"Titan", 3497, "Titan II", "Titan I", false},
		{"Hall of Fame", 6200, "Hall of Fame", "", false},
	}
	for _, c := range cases {
		r := RankOf(c.arena, c.trophies)
		next := ""
		if r.Next != nil {
			next = r.Next.Label
		}
		if r.Label != c.label || next != c.next || r.Protected != c.prot {
			t.Errorf("%s %d: got %s -> %s protected=%v, want %s -> %s protected=%v", c.arena, c.trophies, r.Label, next, r.Protected, c.label, c.next, c.prot)
		}
	}
	if r := RankOf("Gold", 720); r.DemoteBelow != 700 {
		t.Fatalf("demote line %d", r.DemoteBelow)
	}
}

func TestRoadIsAscending(t *testing.T) {
	road := Road()
	if len(road) != (len(Arenas)-1)*Divisions+1 {
		t.Fatalf("%d steps", len(road))
	}
	for i := 1; i < len(road); i++ {
		if road[i].MinTrophy <= road[i-1].MinTrophy {
			t.Fatalf("%s (%d) not above %s (%d)", road[i].Label, road[i].MinTrophy, road[i-1].Label, road[i-1].MinTrophy)
		}
		if Compare(RankOf(road[i].Arena, road[i].MinTrophy), RankOf(road[i-1].Arena, road[i-1].MinTrophy)) != 1 {
			t.Fatalf("%s should rank above %s", road[i].Label, road[i-1].Label)
		}
	}
	// The division floors of every arena split it into roughly equal thirds.
	for _, s := range road {
		if s.MinTrophy%10 != 0 {
			t.Fatalf("%s floor %d not a round number", s.Label, s.MinTrophy)
		}
	}
}

func TestNewArenasReached(t *testing.T) {
	got := NewArenasReached(780, 1210)
	if len(got) != 2 || got[0].Name != "Gold" || got[1].Name != "Crystal" {
		t.Fatalf("%v", got)
	}
	if len(NewArenasReached(900, 850)) != 0 {
		t.Fatal("re-reaching an arena isn't new")
	}
}

func TestNextAfterRespectsBuffer(t *testing.T) {
	if n := NextAfter("Gold"); n == nil || n.Name != "Crystal" {
		t.Fatalf("held Gold -> %v", n)
	}
	if NextAfter("Hall of Fame") != nil {
		t.Fatal("nothing above the top arena")
	}
}
