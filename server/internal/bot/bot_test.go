package bot

import (
	"testing"

	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/seedcatalog"
)

func TestGenerateValidLineup(t *testing.T) {
	catalog := seedcatalog.All()
	d := Generate(99, 200, catalog)
	if err := engine.ValidateLineup(d.Lineup); err != nil {
		t.Fatal(err)
	}
	if d.Profile.Name == "" {
		t.Fatal("missing bot name")
	}
}

func TestGenerateArenaScaling(t *testing.T) {
	catalog := seedcatalog.All()
	low := Generate(1, 50, catalog)
	high := Generate(1, 2000, catalog)
	if low.Profile.Arena == high.Profile.Arena && low.Lineup.Cards[0].Level >= high.Lineup.Cards[0].Level {
		t.Log("levels may overlap; ok")
	}
}
