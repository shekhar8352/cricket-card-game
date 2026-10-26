package engine

func LevelCap(r Rarity) int {
	switch r {
	case RarityBronze:
		return 5
	case RaritySilver:
		return 7
	case RarityGold:
		return 9
	case RarityLegend:
		return 10
	default:
		return 5
	}
}

func LevelBonus(level int) int {
	if level < 1 {
		return 0
	}
	return (level - 1) * 2
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func applyLevel(base Attributes, role Role, level int) Attributes {
	b := LevelBonus(level)
	a := base
	switch role {
	case RoleBAT:
		a.Technique = clamp(a.Technique+b, 1, 99)
		a.Power = clamp(a.Power+b, 1, 99)
		a.Timing = clamp(a.Timing+b, 1, 99)
		a.VsPace = clamp(a.VsPace+b, 1, 99)
		a.VsSpin = clamp(a.VsSpin+b, 1, 99)
		a.Temperament = clamp(a.Temperament+b, 1, 99)
		a.Running = clamp(a.Running+b, 1, 99)
	case RoleWK:
		a.Technique = clamp(a.Technique+b, 1, 99)
		a.Power = clamp(a.Power+b, 1, 99)
		a.Timing = clamp(a.Timing+b, 1, 99)
		a.Temperament = clamp(a.Temperament+b, 1, 99)
		a.Keeping = clamp(a.Keeping+b, 1, 99)
		a.Stumping = clamp(a.Stumping+b, 1, 99)
		a.Reflexes = clamp(a.Reflexes+b, 1, 99)
	case RoleAR:
		a.Technique = clamp(a.Technique+b, 1, 99)
		a.Power = clamp(a.Power+b, 1, 99)
		a.Accuracy = clamp(a.Accuracy+b, 1, 99)
		a.Variation = clamp(a.Variation+b, 1, 99)
		a.WicketTaking = clamp(a.WicketTaking+b, 1, 99)
	case RoleBOWL:
		a.Accuracy = clamp(a.Accuracy+b, 1, 99)
		a.Variation = clamp(a.Variation+b, 1, 99)
		a.WicketTaking = clamp(a.WicketTaking+b, 1, 99)
		a.Movement = clamp(a.Movement+b, 1, 99)
		a.DeathBowling = clamp(a.DeathBowling+b, 1, 99)
	}
	return a
}

func Effective(c Card) Attributes {
	return applyLevel(c.Attrs, c.Role, c.Level)
}

func Overall(c Card) int {
	a := Effective(c)
	switch c.Role {
	case RoleBAT:
		return clamp((a.Technique*25+a.Power*20+a.Timing*15+a.VsPace*10+a.VsSpin*10+a.Temperament*10+a.Running*10)/100, 1, 99)
	case RoleWK:
		bat := (a.Technique*30 + a.Power*20 + a.Timing*20 + a.Temperament*15 + a.Running*15) / 100
		keep := (a.Keeping*50 + a.Stumping*30 + a.Reflexes*20) / 100
		return clamp((bat*55+keep*45)/100, 1, 99)
	case RoleAR:
		bat := (a.Technique*35 + a.Power*25 + a.Timing*20 + a.VsPace*10 + a.VsSpin*10) / 100
		bowl := (a.Accuracy*30 + a.Variation*25 + a.WicketTaking*30 + a.Movement*15) / 100
		return clamp((bat+bowl)/2, 1, 99)
	case RoleBOWL:
		return clamp((a.Accuracy*25+a.Variation*20+a.WicketTaking*25+a.Movement*15+a.DeathBowling*15)/100, 1, 99)
	default:
		return 50
	}
}

func BatterSkill(c Card, bt BowlType) float64 {
	a := Effective(c)
	vs := a.VsPace
	if bt == BowlSpin {
		vs = a.VsSpin
	}
	return float64(a.Technique)*0.5 + float64(a.Power)*0.3 + float64(vs)*0.2
}

func BowlerSkill(c Card) float64 {
	a := Effective(c)
	return float64(a.Accuracy)*0.4 + float64(a.Variation)*0.3 + float64(a.WicketTaking)*0.3
}

func HasTrait(c Card, code string) bool {
	for _, t := range c.Traits {
		if t == code {
			return true
		}
	}
	return false
}

func CardByID(cards []Card, id string) *Card {
	for i := range cards {
		if cards[i].ID == id {
			return &cards[i]
		}
	}
	return nil
}

func Keeper(cards []Card) *Card {
	for i := range cards {
		if cards[i].Role == RoleWK {
			return &cards[i]
		}
	}
	return nil
}

func ZoneFielder(fielding []Card, bowlerID string, zone Zone) *Card {
	// Fixed template: remaining 5 fielders (non-bowler, non-WK) cover 8 zones.
	// WK always covers keeper. Bowler covers pitch (caught-and-bowled).
	wk := Keeper(fielding)
	var others []Card
	for _, c := range fielding {
		if c.ID == bowlerID {
			continue
		}
		if wk != nil && c.ID == wk.ID {
			continue
		}
		others = append(others, c)
	}
	if len(others) == 0 {
		if wk != nil {
			return wk
		}
		return nil
	}
	idx := zoneIndex(zone) % len(others)
	return &others[idx]
}

func zoneIndex(z Zone) int {
	for i, z2 := range FieldZones {
		if z2 == z {
			return i
		}
	}
	return 0
}
