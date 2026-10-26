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
