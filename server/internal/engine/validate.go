package engine

import "fmt"

func ValidateLineup(l Lineup) error {
	if len(l.Cards) != 7 {
		return fmt.Errorf("squad must have 7 cards")
	}
	seen := map[string]bool{}
	roles := map[Role]int{}
	for _, c := range l.Cards {
		if seen[c.ID] {
			return fmt.Errorf("duplicate card %s", c.ID)
		}
		seen[c.ID] = true
		roles[c.Role]++
	}
	if roles[RoleBAT] != 3 {
		return fmt.Errorf("need 3 batsmen, got %d", roles[RoleBAT])
	}
	if roles[RoleWK] != 1 {
		return fmt.Errorf("need 1 wicketkeeper, got %d", roles[RoleWK])
	}
	if roles[RoleAR] != 1 {
		return fmt.Errorf("need 1 all-rounder, got %d", roles[RoleAR])
	}
	if roles[RoleBOWL] != 2 {
		return fmt.Errorf("need 2 bowlers, got %d", roles[RoleBOWL])
	}
	if len(l.BattingOrder) != 7 {
		return fmt.Errorf("batting order must list all 7 cards")
	}
	orderSeen := map[string]bool{}
	for _, id := range l.BattingOrder {
		if !seen[id] {
			return fmt.Errorf("batting order includes unknown card %s", id)
		}
		if orderSeen[id] {
			return fmt.Errorf("batting order has duplicate %s", id)
		}
		orderSeen[id] = true
	}
	if l.CaptainID != "" && !seen[l.CaptainID] {
		return fmt.Errorf("the captain must be one of your seven")
	}
	if err := ValidateTactics(l.Tactics); err != nil {
		return err
	}
	return ValidateBowlingPlan(l)
}

func ValidateBowlingPlan(l Lineup) error {
	if len(l.BowlingPlan) != 5 {
		return fmt.Errorf("bowling plan must have 5 overs")
	}
	var bowls []Card
	var ar *Card
	ids := map[string]Card{}
	for _, c := range l.Cards {
		ids[c.ID] = c
		if c.Role == RoleBOWL {
			bowls = append(bowls, c)
		}
		if c.Role == RoleAR {
			cc := c
			ar = &cc
		}
	}
	eligible := map[string]bool{}
	for _, b := range bowls {
		eligible[b.ID] = true
	}
	if ar != nil {
		eligible[ar.ID] = true
	}
	counts := map[string]int{}
	for i, id := range l.BowlingPlan {
		if !eligible[id] {
			return fmt.Errorf("over %d: %s is not an eligible bowler", i+1, id)
		}
		counts[id]++
		if i > 0 && l.BowlingPlan[i] == l.BowlingPlan[i-1] {
			c := ids[id]
			return fmt.Errorf("%s can't bowl consecutive overs", c.Name)
		}
	}
	for _, b := range bowls {
		if counts[b.ID] != 2 {
			return fmt.Errorf("%s must bowl exactly 2 overs", b.Name)
		}
	}
	if ar != nil && counts[ar.ID] != 1 {
		return fmt.Errorf("AR must bowl exactly 1 over")
	}
	return nil
}

func DefaultBowlingPlan(cards []Card) []string {
	var b1, b2, ar *Card
	for i := range cards {
		c := &cards[i]
		switch c.Role {
		case RoleBOWL:
			if b1 == nil {
				b1 = c
			} else {
				b2 = c
			}
		case RoleAR:
			ar = c
		}
	}
	if b1 == nil || b2 == nil || ar == nil {
		return nil
	}
	if Effective(*b2).DeathBowling > Effective(*b1).DeathBowling {
		b1, b2 = b2, b1
	}
	// B1, B2, B1, AR, B2 — valid consecutive-overs shape
	return []string{b1.ID, b2.ID, b1.ID, ar.ID, b2.ID}
}

func DefaultBattingOrder(cards []Card) []string {
	var bats, rest []Card
	var wk, ar *Card
	var bowls []Card
	for i := range cards {
		c := cards[i]
		switch c.Role {
		case RoleBAT:
			bats = append(bats, c)
		case RoleWK:
			cc := c
			wk = &cc
		case RoleAR:
			cc := c
			ar = &cc
		case RoleBOWL:
			bowls = append(bowls, c)
		}
	}
	// Openers: highest technique, then power at 3
	sortBy := func(cs []Card, key func(Card) int) {
		for i := 0; i < len(cs); i++ {
			for j := i + 1; j < len(cs); j++ {
				if key(cs[j]) > key(cs[i]) {
					cs[i], cs[j] = cs[j], cs[i]
				}
			}
		}
	}
	sortBy(bats, func(c Card) int { return Effective(c).Technique })
	order := []string{}
	if len(bats) > 0 {
		order = append(order, bats[0].ID)
	}
	if len(bats) > 1 {
		// second opener: next technique
		order = append(order, bats[1].ID)
	}
	if len(bats) > 2 {
		// #3 power hitter — pick remaining BAT with highest power
		rest = bats[2:]
		sortBy(rest, func(c Card) int { return Effective(c).Power })
		order = append(order, rest[0].ID)
	}
	if wk != nil {
		order = append(order, wk.ID)
	}
	if ar != nil {
		order = append(order, ar.ID)
	}
	sortBy(bowls, func(c Card) int { return Effective(c).Technique })
	for _, b := range bowls {
		order = append(order, b.ID)
	}
	return order
}
