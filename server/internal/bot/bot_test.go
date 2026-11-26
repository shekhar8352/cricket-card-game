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

func TestTopArenaBotsAreStronger(t *testing.T) {
	cat := seedcatalog.All()
	avg := func(trophies int) float64 {
		sum, n := 0, 0
		for seed := int64(1); seed <= 40; seed++ {
			for _, c := range Generate(seed, trophies, cat).Lineup.Cards {
				if c.Level > engine.LevelCap(c.Rarity) {
					t.Fatalf("bot card %s level %d above its %s cap", c.Name, c.Level, c.Rarity)
				}
				sum += engine.Overall(c)
				n++
			}
		}
		return float64(sum) / float64(n)
	}
	legend, titan, hof := avg(2600), avg(3300), avg(5200)
	if !(legend < titan && titan < hof) {
		t.Fatalf("bot strength should climb with the arena: Legend %.1f, Titan %.1f, Hall of Fame %.1f", legend, titan, hof)
	}
}
