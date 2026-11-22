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
