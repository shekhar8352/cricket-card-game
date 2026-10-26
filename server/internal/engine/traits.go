package engine

type TraitDef struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

var TraitCatalog = []TraitDef{
	{Code: "Finisher", Name: "Finisher", Description: "Power and temperament +8 in the last over or when chasing."},
	{Code: "Anchor", Name: "Anchor", Description: "Wicket chance -10% when 3 or more wickets are down."},
	{Code: "Powerplay Hitter", Name: "Powerplay Hitter", Description: "Boundary weight +10% in overs 1-2."},
	{Code: "Spin Basher", Name: "Spin Basher", Description: "Stronger against spin bowling."},
	{Code: "Pace Basher", Name: "Pace Basher", Description: "Stronger against pace bowling."},
	{Code: "Death Specialist", Name: "Death Specialist", Description: "Stronger in the 5th over."},
	{Code: "Strike Bowler", Name: "Strike Bowler", Description: "Higher wicket chance in a batter's first 2 balls."},
	{Code: "Yorker King", Name: "Yorker King", Description: "Fewer sixes conceded."},
	{Code: "Mystery Spinner", Name: "Mystery Spinner", Description: "Extra variation as a spinner."},
	{Code: "Safe Hands", Name: "Safe Hands", Description: "Catch conversion +15%."},
	{Code: "Rocket Arm", Name: "Rocket Arm", Description: "Run-out chance +15%."},
	{Code: "Lightning Gloves", Name: "Lightning Gloves", Description: "Stumping conversion +20%."},
	{Code: "Keeper-Captain", Name: "Keeper-Captain", Description: "Team bowling accuracy +3 while keeping."},
}

type traitMods struct {
	triggered []string
	power     int
	temp      int
	wicketMul float64
	boundMul  float64
	sixMul    float64
	vsSpin    int
	vsPace    int
	bowlAcc   int
	varExtra  int
	death     int
	catchMul  float64
	runoutMul float64
	stumpMul  float64
}

func applyBatterTraits(c Card, over, wickets int, chasing bool) traitMods {
	m := traitMods{wicketMul: 1, boundMul: 1, sixMul: 1, catchMul: 1, runoutMul: 1, stumpMul: 1}
	lastOrChase := over == 4 || chasing
	if HasTrait(c, "Finisher") && lastOrChase {
		m.power += 8
		m.temp += 8
		m.triggered = append(m.triggered, "Finisher")
	}
	if HasTrait(c, "Anchor") && wickets >= 3 {
		m.wicketMul *= 0.90
		m.triggered = append(m.triggered, "Anchor")
	}
	if HasTrait(c, "Powerplay Hitter") && over <= 1 {
		m.boundMul *= 1.10
		m.triggered = append(m.triggered, "Powerplay Hitter")
	}
	return m
}

func applyBowlerTraits(c Card, over, ballsFaced int, chasingTight bool) traitMods {
	m := traitMods{wicketMul: 1, boundMul: 1, sixMul: 1, catchMul: 1, runoutMul: 1, stumpMul: 1}
	if HasTrait(c, "Death Specialist") && (over == 4 || chasingTight) {
		m.death += 10
		m.wicketMul *= 1.08
		m.triggered = append(m.triggered, "Death Specialist")
	}
	if HasTrait(c, "Strike Bowler") && ballsFaced < 2 {
		m.wicketMul *= 1.12
		m.triggered = append(m.triggered, "Strike Bowler")
	}
	if HasTrait(c, "Yorker King") {
		m.sixMul *= 0.85
		m.triggered = append(m.triggered, "Yorker King")
	}
	if HasTrait(c, "Mystery Spinner") && c.BowlType == BowlSpin {
		m.varExtra += 8
		m.triggered = append(m.triggered, "Mystery Spinner")
	}
	return m
}

func applyFielderTraits(c Card, kind ChanceType) traitMods {
	m := traitMods{wicketMul: 1, boundMul: 1, sixMul: 1, catchMul: 1, runoutMul: 1, stumpMul: 1}
	if HasTrait(c, "Safe Hands") && (kind == ChanceCaught || kind == ChanceCaughtBehind || kind == ChanceCaughtBowled) {
		m.catchMul *= 1.15
		m.triggered = append(m.triggered, "Safe Hands")
	}
	if HasTrait(c, "Rocket Arm") {
		m.runoutMul *= 1.15
		m.triggered = append(m.triggered, "Rocket Arm")
	}
	if HasTrait(c, "Lightning Gloves") && kind == ChanceStumped {
		m.stumpMul *= 1.20
		m.triggered = append(m.triggered, "Lightning Gloves")
	}
	return m
}
