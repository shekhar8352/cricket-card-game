package seedcatalog

import (
	"testing"

	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
)

func TestCuratedIDsExist(t *testing.T) {
	ids := map[string]bool{}
	for _, c := range All() {
		ids[c.ID] = true
	}
	for id, cp := range captains {
		if !ids[id] {
			t.Errorf("captain %q is not in the catalog", id)
		}
		if _, ok := engine.MasterstrokeByCode(cp.Masterstroke); !ok {
			t.Errorf("captain %q has unknown masterstroke %q", id, cp.Masterstroke)
		}
	}
	for _, p := range partnerships {
		for _, id := range p {
			if !ids[id] {
				t.Errorf("partnership player %q is not in the catalog", id)
			}
		}
	}
}

func TestEnrich(t *testing.T) {
	var kohli, rohit, other engine.Card
	for _, c := range All() {
		switch c.ID {
		case "virat-kohli":
			kohli = c
		case "rohit-sharma":
			rohit = c
		case "jason-roy":
			other = c
		}
	}
	Enrich(&kohli)
	Enrich(&rohit)
	Enrich(&other)
	if kohli.Captaincy == nil || kohli.Captaincy.Aggression < 85 {
		t.Errorf("Kohli should be an aggressive captain: %+v", kohli.Captaincy)
	}
	if other.Captaincy == nil {
		t.Error("everyone gets a derived captaincy")
	}
	if engine.Link(&kohli, &rohit) != 3 {
		t.Errorf("Kohli and Rohit: same country + known partnership should be link 3, got %d", engine.Link(&kohli, &rohit))
	}
}
