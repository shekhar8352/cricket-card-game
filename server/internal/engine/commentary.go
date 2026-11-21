package engine

import "fmt"

// Commentary lines are picked deterministically from the ball's sequence key,
// so adding variety never consumes the simulation RNG and never changes results.

func pick(key int, opts ...string) string {
	if key < 0 {
		key = -key
	}
	// Spread consecutive keys so neighbouring balls rarely repeat a line.
	return opts[(key*7+3)%len(opts)]
}

func surname(c *Card) string {
	if c == nil {
		return "the fielder"
	}
	for i := len(c.Name) - 1; i >= 0; i-- {
		if c.Name[i] == ' ' {
			return c.Name[i+1:]
		}
	}
	return c.Name
}

func offSide(z Zone) bool {
	return z == ZoneCover || z == ZonePoint || z == ZoneThirdMan || z == ZoneLongOff
}

func commentRuns(striker, bowler *Card, ev BallEvent) string {
	zone := prettyZone(ev.Shot.Zone)
	s, b := surname(striker), surname(bowler)
	k := ev.Seq
	switch ev.Outcome {
	case OutcomeDot:
		if ev.Shot.Leave {
			return pick(k,
				fmt.Sprintf("%s shapes it away outside off, %s shoulders arms.", b, s),
				fmt.Sprintf("Good leave from %s. %s keeps probing that channel.", s, b),
				fmt.Sprintf("%s lets it go. Judged well, just over the stumps.", s),
			)
		}
		return pick(k,
			fmt.Sprintf("%s on a good length, %s defends solidly. Dot ball.", b, s),
			fmt.Sprintf("Beaten! %s finds a beauty and %s plays and misses.", b, s),
			fmt.Sprintf("%s pushes it straight to the fielder. No run.", s),
			fmt.Sprintf("Tight from %s. %s can't get it away.", b, s),
			fmt.Sprintf("Full and straight, %s digs it out. Dot.", s),
		)
	case OutcomeOne:
		return pick(k,
			fmt.Sprintf("%s works it to %s and rotates the strike.", s, zone),
			fmt.Sprintf("Soft hands from %s, dropped into %s for a quick single.", s, zone),
			fmt.Sprintf("Nudged to %s. Easy single.", zone),
			fmt.Sprintf("%s tucks %s away to %s, one run.", s, b, zone),
		)
	case OutcomeTwo:
		return pick(k,
			fmt.Sprintf("%s finds the gap at %s and they hustle back for two.", s, zone),
			fmt.Sprintf("Placed into %s, good running. Two more.", zone),
			fmt.Sprintf("%s pushes hard for the second and makes it. Two to %s.", s, zone),
		)
	case OutcomeThree:
		return pick(k,
			fmt.Sprintf("Chased down just short of the rope at %s. Three runs.", zone),
			fmt.Sprintf("%s times it into %s, they run three.", s, zone),
		)
	case OutcomeFour:
		verb := "pulled"
		if offSide(ev.Shot.Zone) {
			verb = "driven"
		}
		if ev.Shot.Zone == ZoneFineLeg || ev.Shot.Zone == ZoneThirdMan {
			verb = "glanced"
		}
		return pick(k,
			fmt.Sprintf("FOUR! %s %s through %s. Nobody moves.", s, verb, zone),
			fmt.Sprintf("FOUR! Too short from %s and %s puts it away to %s.", b, s, zone),
			fmt.Sprintf("FOUR! Beautifully %s by %s, races away to %s.", verb, s, zone),
			fmt.Sprintf("FOUR! %s finds the gap at %s. Pressure back on %s.", s, zone, b),
		)
	case OutcomeSix:
		return pick(k,
			fmt.Sprintf("SIX! %s launches %s over %s. Into the stands!", s, b, zone),
			fmt.Sprintf("SIX! Massive hit from %s, clears %s with ease.", s, zone),
			fmt.Sprintf("SIX! %s gets under it and sends it sailing over %s.", s, zone),
			fmt.Sprintf("SIX! Out of the ground! %s has no answer to %s.", b, s),
		)
	}
	return fmt.Sprintf("%s to %s.", b, s)
}

func commentWicket(striker, bowler *Card, d *Dismissal, key int) string {
	s, b := surname(striker), surname(bowler)
	switch d.Type {
	case DismissBowled:
		return pick(key,
			fmt.Sprintf("WICKET! Bowled him! %s crashes through %s's defence.", b, s),
			fmt.Sprintf("WICKET! Timber! %s misses and %s hits the stumps.", s, b),
		)
	case DismissLBW:
		return pick(key,
			fmt.Sprintf("WICKET! Plumb in front! %s traps %s lbw.", b, s),
			fmt.Sprintf("WICKET! Finger goes up. %s is lbw to %s.", s, b),
		)
	case DismissCaughtWK:
		return fmt.Sprintf("WICKET! Caught behind! %s finds the edge of %s. %s", b, s, d.Text)
	case DismissCaught:
		return pick(key,
			fmt.Sprintf("WICKET! %s goes big and holes out. %s", s, d.Text),
			fmt.Sprintf("WICKET! Straight down the fielder's throat. %s has to go. %s", s, d.Text),
		)
	case DismissCaughtBowl:
		return fmt.Sprintf("WICKET! Caught and bowled! %s chips it back to %s.", s, b)
	case DismissStumped:
		return fmt.Sprintf("WICKET! Stumped! %s dances down and misses it. %s", s, d.Text)
	case DismissRunOut:
		return fmt.Sprintf("WICKET! %s is run out. %s", s, d.Text)
	}
	return "WICKET! " + d.Text
}

func commentDrop(striker, bowler, fielder *Card, kind ChanceType) string {
	fn := surname(fielder)
	s := surname(striker)
	if kind == ChanceCaughtBehind {
		return fmt.Sprintf("DROPPED behind! %s puts down a sharp chance. %s survives.", fn, s)
	}
	if kind == ChanceStumped {
		return fmt.Sprintf("Missed stumping! %s fumbles as %s scrambles back.", fn, s)
	}
	return fmt.Sprintf("DROPPED! %s spills a regulation chance. %s gets a life.", fn, s)
}

func commentRunOut(striker *Card, d *Dismissal, key int) string {
	return pick(key,
		fmt.Sprintf("WICKET! Direct hit! %s is short of the crease. %s", surname(striker), d.Text),
		fmt.Sprintf("WICKET! Mix-up in the middle and %s is run out. %s", surname(striker), d.Text),
	)
}

func commentSave(striker, bowler, fielder *Card, runs int) string {
	return fmt.Sprintf("Brilliant stop by %s! Saves a boundary, %s settles for %d.", surname(fielder), surname(striker), runs)
}

func commentWide(striker, bowler *Card, key int) string {
	b := surname(bowler)
	return pick(key,
		fmt.Sprintf("Wide. %s strays down the leg side.", b),
		fmt.Sprintf("Wide called. %s loses the line under pressure.", b),
		fmt.Sprintf("%s sprays it wide. Free run.", b),
	)
}

func commentNoBall(striker, bowler *Card) string {
	return fmt.Sprintf("No-ball! %s oversteps. Extra run and the ball must be bowled again.", surname(bowler))
}

func commentByes(striker, bowler *Card, wk *Card, n int) string {
	return fmt.Sprintf("Byes! It beats bat and %s, %d run%s added.", surname(wk), n, plural(n))
}

func prettyZone(z Zone) string {
	switch z {
	case ZoneFineLeg:
		return "fine leg"
	case ZoneSquareLeg:
		return "square leg"
	case ZoneMidwicket:
		return "midwicket"
	case ZoneLongOn:
		return "long on"
	case ZoneLongOff:
		return "long off"
	case ZoneCover:
		return "cover"
	case ZonePoint:
		return "point"
	case ZoneThirdMan:
		return "third man"
	case ZoneWicketKeep:
		return "the keeper"
	}
	return "the field"
}
