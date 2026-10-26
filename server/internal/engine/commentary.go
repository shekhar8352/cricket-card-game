package engine

import "fmt"

func commentRuns(striker, bowler *Card, ev BallEvent) string {
	zone := prettyZone(ev.Shot.Zone)
	switch ev.Outcome {
	case OutcomeDot:
		if ev.Shot.Leave {
			return fmt.Sprintf("%d.%d %s to %s, left alone.", ev.Over, ev.Ball+1, bowler.Name, striker.Name)
		}
		return fmt.Sprintf("%d.%d %s to %s, defended back to the bowler.", ev.Over, ev.Ball+1, bowler.Name, striker.Name)
	case OutcomeOne:
		return fmt.Sprintf("%d.%d %s to %s, worked to %s for a single.", ev.Over, ev.Ball+1, bowler.Name, striker.Name, zone)
	case OutcomeTwo:
		return fmt.Sprintf("%d.%d %s to %s, pushed to %s, they come back for two.", ev.Over, ev.Ball+1, bowler.Name, striker.Name, zone)
	case OutcomeThree:
		return fmt.Sprintf("%d.%d %s to %s, placed into %s, three runs.", ev.Over, ev.Ball+1, bowler.Name, striker.Name, zone)
	case OutcomeFour:
		return fmt.Sprintf("%d.%d %s to %s, FOUR! Driven through %s.", ev.Over, ev.Ball+1, bowler.Name, striker.Name, zone)
	case OutcomeSix:
		return fmt.Sprintf("%d.%d %s to %s, SIX! Launched over %s.", ev.Over, ev.Ball+1, bowler.Name, striker.Name, zone)
	}
	return fmt.Sprintf("%d.%d %s to %s.", ev.Over, ev.Ball+1, bowler.Name, striker.Name)
}

func commentWicket(striker, bowler *Card, d *Dismissal) string {
	switch d.Type {
	case DismissBowled:
		return fmt.Sprintf("WICKET! %s is bowled by %s. %s", striker.Name, bowler.Name, d.Text)
	case DismissLBW:
		return fmt.Sprintf("WICKET! %s lbw %s. %s", striker.Name, bowler.Name, d.Text)
	case DismissCaughtWK:
		return fmt.Sprintf("WICKET! Caught behind! %s nicks %s. %s", striker.Name, bowler.Name, d.Text)
	case DismissCaught:
		return fmt.Sprintf("WICKET! %s holes out. %s", striker.Name, d.Text)
	case DismissCaughtBowl:
		return fmt.Sprintf("WICKET! %s chips it back. %s", striker.Name, d.Text)
	case DismissStumped:
		return fmt.Sprintf("WICKET! Stumped! %s is out of the crease. %s", striker.Name, d.Text)
	case DismissRunOut:
		return fmt.Sprintf("WICKET! %s is run out. %s", striker.Name, d.Text)
	}
	return "WICKET! " + d.Text
}

func commentDrop(striker, bowler, fielder *Card, kind ChanceType) string {
	fn := "the fielder"
	if fielder != nil {
		fn = fielder.Name
	}
	if kind == ChanceCaughtBehind {
		return fmt.Sprintf("Dropped behind! %s puts down a sharp chance off %s.", fn, striker.Name)
	}
	if kind == ChanceStumped {
		return fmt.Sprintf("Missed stumping! %s can't gather as %s leaves the crease.", fn, striker.Name)
	}
	return fmt.Sprintf("Dropped! %s spills the chance, %s survives.", fn, striker.Name)
}

func commentRunOut(striker *Card, d *Dismissal) string {
	return fmt.Sprintf("WICKET! Direct hit? %s is run out. %s", striker.Name, d.Text)
}

func commentSave(striker, bowler, fielder *Card, runs int) string {
	return fmt.Sprintf("Superb stop by %s! Saves runs as %s finds the gap, %d instead.", fielder.Name, striker.Name, runs)
}

func commentWide(striker, bowler *Card) string {
	return fmt.Sprintf("%s sprays it down the leg side, wide. %s watches it go.", bowler.Name, striker.Name)
}

func commentNoBall(striker, bowler *Card) string {
	return fmt.Sprintf("No-ball! %s oversteps, free hit incoming for %s.", bowler.Name, striker.Name)
}

func commentByes(striker, bowler *Card, wk *Card, n int) string {
	kn := "the keeper"
	if wk != nil {
		kn = wk.Name
	}
	return fmt.Sprintf("Beats everyone! %d bye%s past %s.", n, plural(n), kn)
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
