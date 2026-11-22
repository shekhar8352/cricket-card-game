package seedcatalog

import "github.com/sudhanshushekhar/cricket-card-game/internal/engine"

type Raw struct {
	ID       string
	Name     string
	Country  string
	Role     engine.Role
	Hand     engine.BatHand
	Bowl     engine.BowlType
	Rarity   engine.Rarity
	Traits   []string
	Tech     int
	Power    int
	Acc      int
	Wicket   int
	Keep     int
}

func Expand(r Raw) engine.Card {
	a := engine.Attributes{
		Technique: r.Tech, Power: r.Power, Timing: near(r.Tech, -2),
		VsPace: near(r.Tech, 0), VsSpin: near(r.Tech, -3),
		Temperament: near(r.Tech, -1), Running: near(r.Power, 4),
		Accuracy: r.Acc, Variation: near(r.Acc, 2), WicketTaking: r.Wicket,
		Movement: near(r.Acc, -1), DeathBowling: near(r.Wicket, 0),
		Catching: 62, GroundField: 64, Throwing: 60,
		Keeping: r.Keep, Stumping: near(r.Keep, -4), Reflexes: near(r.Keep, -2),
	}
	switch r.Role {
	case engine.RoleBAT:
		a.Catching, a.GroundField, a.Throwing = 68, 70, 62
		if a.Accuracy < 25 {
			a.Accuracy, a.Variation, a.WicketTaking, a.Movement, a.DeathBowling = 28, 24, 22, 22, 20
		}
	case engine.RoleWK:
		a.Catching = max(r.Keep, 70)
		a.GroundField, a.Throwing = 66, 58
		if a.Accuracy < 20 {
			a.Accuracy, a.Variation, a.WicketTaking = 22, 20, 18
		}
	case engine.RoleAR:
		a.Catching, a.GroundField, a.Throwing = 70, 72, 70
	case engine.RoleBOWL:
		a.Technique, a.Power, a.Timing = near(38, r.Tech-70), near(32, r.Power-70), 36
		if r.Tech > 50 {
			a.Technique = r.Tech
			a.Power = r.Power
			a.Timing = near(r.Tech, -4)
		}
		a.Catching, a.GroundField, a.Throwing = 60, 62, 72
		a.Keeping, a.Stumping, a.Reflexes = 8, 6, 8
	}
	traits := r.Traits
	if traits == nil {
		traits = []string{}
	}
	return engine.Card{
		ID: r.ID, PlayerID: r.ID, Name: r.Name, Country: r.Country,
		Role: r.Role, BatHand: r.Hand, BowlType: r.Bowl,
		Rarity: r.Rarity, Level: 1, Attrs: a, Traits: traits,
	}
}

func near(v, d int) int {
	n := v + d
	if n < 8 {
		return 8
	}
	if n > 96 {
		return 96
	}
	return n
}

func All() []engine.Card {
	var out []engine.Card
	for _, r := range rawPlayers {
		out = append(out, Expand(r))
	}
	return out
}

func ByID(id string) *engine.Card {
	for _, r := range rawPlayers {
		if r.ID == id {
			c := Expand(r)
			return &c
		}
	}
	return nil
}

var rawPlayers = []Raw{
	// India BAT
	{"virat-kohli", "Virat Kohli", "IND", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Anchor", "Pace Basher"}, 92, 84, 28, 18, 10},
	{"rohit-sharma", "Rohit Sharma", "IND", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Powerplay Hitter"}, 88, 90, 30, 20, 10},
	{"shubman-gill", "Shubman Gill", "IND", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Pace Basher"}, 86, 80, 26, 16, 8},
	{"suryakumar-yadav", "Suryakumar Yadav", "IND", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Finisher"}, 82, 90, 24, 14, 8},
	{"kl-rahul", "KL Rahul", "IND", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Anchor"}, 84, 78, 22, 14, 12},
	{"yashasvi-jaiswal", "Yashasvi Jaiswal", "IND", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityGold, []string{"Powerplay Hitter"}, 80, 86, 24, 16, 8},
	{"ruturaj-gaikwad", "Ruturaj Gaikwad", "IND", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 78, 76, 22, 14, 8},
	{"shreyas-iyer", "Shreyas Iyer", "IND", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Spin Basher"}, 80, 78, 28, 22, 8},
	{"tilak-varma", "Tilak Varma", "IND", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RaritySilver, nil, 76, 78, 26, 18, 8},
	{"ishaan-kishan", "Ishan Kishan", "IND", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RaritySilver, []string{"Powerplay Hitter"}, 74, 82, 20, 14, 14},
	// India WK
	{"rishabh-pant", "Rishabh Pant", "IND", engine.RoleWK, engine.HandLeft, engine.BowlPace, engine.RarityLegend, []string{"Lightning Gloves"}, 82, 86, 18, 12, 88},
	{"ms-dhoni", "MS Dhoni", "IND", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Finisher", "Lightning Gloves"}, 78, 80, 30, 22, 94},
	{"sanju-samson", "Sanju Samson", "IND", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 76, 84, 18, 12, 80},
	{"dhruv-jurel", "Dhruv Jurel", "IND", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 72, 70, 16, 10, 78},
	{"jitesh-sharma", "Jitesh Sharma", "IND", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 68, 74, 14, 10, 72},
	// India AR
	{"hardik-pandya", "Hardik Pandya", "IND", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Finisher"}, 78, 86, 74, 72, 10},
	{"ravindra-jadeja", "Ravindra Jadeja", "IND", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RarityLegend, []string{"Rocket Arm"}, 76, 72, 80, 74, 10},
	{"axar-patel", "Axar Patel", "IND", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RarityGold, nil, 70, 68, 76, 70, 8},
	{"washington-sundar", "Washington Sundar", "IND", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RaritySilver, nil, 68, 64, 74, 68, 8},
	{"shivam-dube", "Shivam Dube", "IND", engine.RoleAR, engine.HandLeft, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 66, 82, 62, 58, 8},
	{"venkatesh-iyer", "Venkatesh Iyer", "IND", engine.RoleAR, engine.HandLeft, engine.BowlPace, engine.RarityBronze, nil, 64, 72, 58, 52, 8},
	// India BOWL
	{"jasprit-bumrah", "Jasprit Bumrah", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Yorker King", "Death Specialist"}, 36, 28, 92, 90, 8},
	{"mohammed-shami", "Mohammed Shami", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Strike Bowler"}, 34, 28, 84, 86, 8},
	{"kuldeep-yadav", "Kuldeep Yadav", "IND", engine.RoleBOWL, engine.HandLeft, engine.BowlSpin, engine.RarityGold, []string{"Mystery Spinner"}, 32, 26, 80, 82, 8},
	{"yuzvendra-chahal", "Yuzvendra Chahal", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RarityGold, nil, 30, 24, 78, 80, 8},
	{"arshdeep-singh", "Arshdeep Singh", "IND", engine.RoleBOWL, engine.HandLeft, engine.BowlPace, engine.RaritySilver, []string{"Death Specialist"}, 32, 26, 76, 74, 8},
	{"mohammed-siraj", "Mohammed Siraj", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 30, 26, 78, 76, 8},
	{"varun-chakravarthy", "Varun Chakravarthy", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RaritySilver, []string{"Mystery Spinner"}, 28, 22, 80, 76, 8},
	{"ravi-bishnoi", "Ravi Bishnoi", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RarityBronze, nil, 28, 22, 74, 72, 8},
	{"mukesh-kumar", "Mukesh Kumar", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 26, 22, 70, 68, 8},
	{"avesh-khan", "Avesh Khan", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 26, 24, 68, 70, 8},

	// Australia
	{"steve-smith", "Steve Smith", "AUS", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Anchor"}, 90, 76, 40, 28, 10},
	{"david-warner", "David Warner", "AUS", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityGold, []string{"Powerplay Hitter"}, 82, 86, 24, 16, 8},
	{"marnus-labuschagne", "Marnus Labuschagne", "AUS", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Anchor"}, 86, 70, 36, 22, 8},
	{"travis-head", "Travis Head", "AUS", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityGold, []string{"Powerplay Hitter"}, 80, 88, 34, 24, 8},
	{"mitchell-marsh", "Mitchell Marsh", "AUS", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Finisher"}, 74, 84, 70, 66, 8},
	{"glenn-maxwell", "Glenn Maxwell", "AUS", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RarityGold, []string{"Finisher", "Spin Basher"}, 76, 90, 68, 64, 8},
	{"marcus-stoinis", "Marcus Stoinis", "AUS", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 70, 82, 64, 60, 8},
	{"alex-carey", "Alex Carey", "AUS", engine.RoleWK, engine.HandLeft, engine.BowlPace, engine.RarityGold, nil, 74, 70, 18, 12, 84},
	{"josh-inglis", "Josh Inglis", "AUS", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 72, 76, 16, 10, 78},
	{"pat-cummins", "Pat Cummins", "AUS", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Strike Bowler"}, 48, 40, 88, 86, 8},
	{"mitchell-starc", "Mitchell Starc", "AUS", engine.RoleBOWL, engine.HandLeft, engine.BowlPace, engine.RarityLegend, []string{"Yorker King"}, 36, 32, 82, 88, 8},
	{"josh-hazlewood", "Josh Hazlewood", "AUS", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 32, 26, 90, 80, 8},
	{"adam-zampa", "Adam Zampa", "AUS", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RarityGold, nil, 30, 24, 80, 78, 8},
	{"spencer-johnson", "Spencer Johnson", "AUS", engine.RoleBOWL, engine.HandLeft, engine.BowlPace, engine.RarityBronze, nil, 26, 22, 70, 72, 8},
	{"nathan-ellis", "Nathan Ellis", "AUS", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Death Specialist"}, 28, 24, 76, 74, 8},
	{"cameron-green", "Cameron Green", "AUS", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 74, 78, 72, 68, 8},
	{"tim-david", "Tim David", "AUS", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 68, 88, 22, 16, 8},

	// England
	{"joe-root", "Joe Root", "ENG", engine.RoleBAT, engine.HandRight, engine.BowlSpin, engine.RarityLegend, []string{"Anchor"}, 92, 74, 50, 36, 8},
	{"harry-brook", "Harry Brook", "ENG", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Pace Basher"}, 84, 86, 26, 16, 8},
	{"ben-duckett", "Ben Duckett", "ENG", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityGold, []string{"Powerplay Hitter"}, 80, 80, 22, 14, 8},
	{"zak-crawley", "Zak Crawley", "ENG", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 76, 78, 20, 12, 8},
	{"dawid-malan", "Dawid Malan", "ENG", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RaritySilver, nil, 78, 74, 24, 16, 8},
	{"jonny-bairstow", "Jonny Bairstow", "ENG", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Powerplay Hitter"}, 78, 84, 18, 12, 76},
	{"jos-buttler", "Jos Buttler", "ENG", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Finisher"}, 80, 90, 18, 12, 82},
	{"phil-salt", "Phil Salt", "ENG", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Powerplay Hitter"}, 72, 86, 16, 10, 74},
	{"ben-stokes", "Ben Stokes", "ENG", engine.RoleAR, engine.HandLeft, engine.BowlPace, engine.RarityLegend, []string{"Finisher"}, 80, 84, 74, 76, 8},
	{"moeen-ali", "Moeen Ali", "ENG", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RarityGold, []string{"Spin Basher"}, 72, 78, 72, 70, 8},
	{"liam-livingstone", "Liam Livingstone", "ENG", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RarityGold, []string{"Finisher"}, 70, 88, 66, 64, 8},
	{"sam-curran", "Sam Curran", "ENG", engine.RoleAR, engine.HandLeft, engine.BowlPace, engine.RaritySilver, nil, 66, 70, 72, 68, 8},
	{"jofra-archer", "Jofra Archer", "ENG", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Strike Bowler"}, 34, 30, 86, 88, 8},
	{"mark-wood", "Mark Wood", "ENG", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 30, 26, 80, 86, 8},
	{"adil-rashid", "Adil Rashid", "ENG", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RarityGold, []string{"Mystery Spinner"}, 32, 26, 82, 80, 8},
	{"reece-topley", "Reece Topley", "ENG", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 28, 22, 76, 72, 8},
	{"gus-atkinson", "Gus Atkinson", "ENG", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 30, 26, 76, 74, 8},
	{"chris-woakes", "Chris Woakes", "ENG", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 64, 62, 78, 72, 8},

	// New Zealand
	{"kane-williamson", "Kane Williamson", "NZ", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Anchor"}, 90, 72, 36, 24, 8},
	{"devon-conway", "Devon Conway", "NZ", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityGold, nil, 84, 74, 22, 14, 10},
	{"rachin-ravindra", "Rachin Ravindra", "NZ", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RarityGold, []string{"Spin Basher"}, 80, 78, 70, 66, 8},
	{"daryl-mitchell", "Daryl Mitchell", "NZ", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Finisher"}, 76, 80, 62, 58, 8},
	{"glenn-phillips", "Glenn Phillips", "NZ", engine.RoleBAT, engine.HandRight, engine.BowlSpin, engine.RaritySilver, []string{"Safe Hands"}, 72, 84, 50, 46, 8},
	{"tom-latham", "Tom Latham", "NZ", engine.RoleWK, engine.HandLeft, engine.BowlPace, engine.RarityGold, nil, 78, 68, 16, 10, 82},
	{"tim-seifert", "Tim Seifert", "NZ", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 70, 76, 14, 10, 76},
	{"trent-boult", "Trent Boult", "NZ", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Strike Bowler"}, 32, 26, 86, 84, 8},
	{"tim-southee", "Tim Southee", "NZ", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 30, 28, 78, 76, 8},
	{"lockie-ferguson", "Lockie Ferguson", "NZ", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 28, 24, 80, 82, 8},
	{"mitchell-santner", "Mitchell Santner", "NZ", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RaritySilver, nil, 64, 62, 76, 70, 8},
	{"ish-sodhi", "Ish Sodhi", "NZ", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RaritySilver, nil, 28, 22, 76, 74, 8},
	{"matt-henry", "Matt Henry", "NZ", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 30, 24, 80, 74, 8},

	// South Africa
	{"quinton-de-kock", "Quinton de Kock", "SA", engine.RoleWK, engine.HandLeft, engine.BowlPace, engine.RarityLegend, []string{"Powerplay Hitter"}, 82, 86, 16, 10, 84},
	{"heinrich-klaasen", "Heinrich Klaasen", "SA", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Finisher"}, 76, 90, 18, 12, 78},
	{"david-miller", "David Miller", "SA", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityGold, []string{"Finisher"}, 74, 88, 22, 14, 8},
	{"aiden-markram", "Aiden Markram", "SA", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 82, 78, 40, 32, 8},
	{"rassie-van-der-dussen", "Rassie van der Dussen", "SA", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Anchor"}, 80, 74, 22, 14, 8},
	{"tristan-stubbs", "Tristan Stubbs", "SA", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 72, 84, 24, 16, 8},
	{"marco-jansen", "Marco Jansen", "SA", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 62, 68, 80, 78, 8},
	{"keshav-maharaj", "Keshav Maharaj", "SA", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RaritySilver, nil, 36, 30, 78, 72, 8},
	{"kagiso-rabada", "Kagiso Rabada", "SA", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Strike Bowler"}, 34, 28, 88, 86, 8},
	{"anrich-nortje", "Anrich Nortje", "SA", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 28, 24, 80, 84, 8},
	{"lungi-ngidi", "Lungi Ngidi", "SA", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 26, 22, 76, 74, 8},
	{"tabraiz-shamsi", "Tabraiz Shamsi", "SA", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RaritySilver, []string{"Mystery Spinner"}, 26, 20, 78, 76, 8},
	{"gerald-coetzee", "Gerald Coetzee", "SA", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 28, 26, 72, 74, 8},

	// Sri Lanka
	{"kusal-mendis", "Kusal Mendis", "SL", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 78, 76, 16, 10, 80},
	{"pathum-nissanka", "Pathum Nissanka", "SL", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Anchor"}, 82, 74, 20, 12, 8},
	{"charith-asalanka", "Charith Asalanka", "SL", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RaritySilver, nil, 76, 78, 28, 22, 8},
	{"sadeera-samarawickrama", "Sadeera Samarawickrama", "SL", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 74, 70, 16, 10, 76},
	{"wanindu-hasaranga", "Wanindu Hasaranga", "SL", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RarityGold, []string{"Mystery Spinner"}, 66, 72, 82, 84, 8},
	{"dasun-shanaka", "Dasun Shanaka", "SL", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 64, 78, 62, 58, 8},
	{"angelo-mathews", "Angelo Mathews", "SL", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Anchor"}, 74, 68, 64, 60, 8},
	{"maheesh-theekshana", "Maheesh Theekshana", "SL", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RarityGold, []string{"Mystery Spinner"}, 26, 20, 82, 76, 8},
	{"dunith-wellalage", "Dunith Wellalage", "SL", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RarityBronze, nil, 62, 58, 70, 66, 8},
	{"dilshan-madushanka", "Dilshan Madushanka", "SL", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 26, 22, 74, 76, 8},
	{"matheesha-pathirana", "Matheesha Pathirana", "SL", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Yorker King", "Death Specialist"}, 24, 22, 76, 84, 8},
	{"kusal-perera", "Kusal Perera", "SL", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RaritySilver, []string{"Powerplay Hitter"}, 74, 80, 18, 12, 12},

	// West Indies
	{"nicholas-pooran", "Nicholas Pooran", "WI", engine.RoleWK, engine.HandLeft, engine.BowlPace, engine.RarityGold, []string{"Finisher"}, 74, 90, 16, 10, 76},
	{"shai-hope", "Shai Hope", "WI", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Anchor"}, 82, 72, 16, 10, 82},
	{"brandon-king", "Brandon King", "WI", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Powerplay Hitter"}, 74, 80, 20, 12, 8},
	{"shamarh-brooks", "Shamarh Brooks", "WI", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 72, 70, 20, 12, 8},
	{"roston-chase", "Roston Chase", "WI", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RaritySilver, nil, 70, 66, 70, 66, 8},
	{"jason-holder", "Jason Holder", "WI", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 66, 70, 76, 72, 8},
	{"andre-russell", "Andre Russell", "WI", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityLegend, []string{"Finisher", "Death Specialist"}, 62, 94, 70, 74, 8},
	{"romario-shepherd", "Romario Shepherd", "WI", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 58, 82, 68, 66, 8},
	{"alzarri-joseph", "Alzarri Joseph", "WI", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 28, 26, 78, 80, 8},
	{"gudakesh-motie", "Gudakesh Motie", "WI", engine.RoleBOWL, engine.HandLeft, engine.BowlSpin, engine.RaritySilver, nil, 30, 26, 76, 72, 8},
	{"akel-hosein", "Akeal Hosein", "WI", engine.RoleBOWL, engine.HandLeft, engine.BowlSpin, engine.RaritySilver, nil, 32, 28, 78, 70, 8},
	{"shimron-hetmyer", "Shimron Hetmyer", "WI", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 70, 86, 20, 12, 8},
	{"johnson-charles", "Johnson Charles", "WI", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityBronze, []string{"Powerplay Hitter"}, 68, 82, 18, 12, 10},

	// Bangladesh
	{"litton-das", "Litton Das", "BAN", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityGold, nil, 78, 74, 16, 10, 80},
	{"mushfiqur-rahim", "Mushfiqur Rahim", "BAN", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Anchor", "Keeper-Captain"}, 80, 70, 16, 10, 86},
	{"najmul-hossain-shanto", "Najmul Hossain Shanto", "BAN", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RaritySilver, nil, 78, 70, 24, 16, 8},
	{"towhid-hridoy", "Towhid Hridoy", "BAN", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 74, 76, 22, 14, 8},
	{"shakib-al-hasan", "Shakib Al Hasan", "BAN", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RarityLegend, []string{"Anchor"}, 78, 76, 82, 78, 8},
	{"mehidy-hasan", "Mehidy Hasan Miraz", "BAN", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RaritySilver, nil, 66, 62, 76, 70, 8},
	{"mustafizur-rahman", "Mustafizur Rahman", "BAN", engine.RoleBOWL, engine.HandLeft, engine.BowlPace, engine.RarityGold, []string{"Death Specialist"}, 28, 22, 82, 80, 8},
	{"taskin-ahmed", "Taskin Ahmed", "BAN", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 28, 24, 76, 76, 8},
	{"shoriful-islam", "Shoriful Islam", "BAN", engine.RoleBOWL, engine.HandLeft, engine.BowlPace, engine.RarityBronze, nil, 26, 22, 70, 72, 8},
	{"hasan-mahmud", "Hasan Mahmud", "BAN", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 26, 22, 70, 70, 8},
	{"mahedi-hasan", "Mahedi Hasan", "BAN", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RarityBronze, nil, 60, 62, 72, 66, 8},

	// Afghanistan
	{"rahmanullah-gurbaz", "Rahmanullah Gurbaz", "AFG", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityGold, []string{"Powerplay Hitter"}, 72, 86, 16, 10, 74},
	{"ibrahim-zadran", "Ibrahim Zadran", "AFG", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Anchor"}, 78, 70, 22, 14, 8},
	{"rahmat-shah", "Rahmat Shah", "AFG", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 76, 68, 24, 16, 8},
	{"hazratullah-zazai", "Hazratullah Zazai", "AFG", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityBronze, []string{"Powerplay Hitter"}, 64, 84, 18, 12, 8},
	{"mohammad-nabi", "Mohammad Nabi", "AFG", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RarityGold, []string{"Finisher"}, 70, 74, 76, 72, 8},
	{"rashid-khan", "Rashid Khan", "AFG", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RarityLegend, []string{"Mystery Spinner", "Death Specialist"}, 40, 48, 88, 90, 8},
	{"mujeeb-ur-rahman", "Mujeeb Ur Rahman", "AFG", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RarityGold, []string{"Mystery Spinner"}, 28, 22, 82, 78, 8},
	{"fazalhaq-farooqi", "Fazalhaq Farooqi", "AFG", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 26, 22, 76, 76, 8},
	{"nangeyalia-kharote", "Nangeyalia Kharote", "AFG", engine.RoleAR, engine.HandLeft, engine.BowlSpin, engine.RarityBronze, nil, 58, 60, 68, 64, 8},
	{"azmatullah-omarzai", "Azmatullah Omarzai", "AFG", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 64, 72, 70, 66, 8},
	{"ikram-alikhil", "Ikram Alikhil", "AFG", engine.RoleWK, engine.HandLeft, engine.BowlPace, engine.RarityBronze, nil, 64, 60, 14, 10, 74},

	// More depth / bronze-silver filler
	{"prithvi-shaw", "Prithvi Shaw", "IND", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityBronze, []string{"Powerplay Hitter"}, 70, 80, 20, 12, 8},
	{"devdutt-padikkal", "Devdutt Padikkal", "IND", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityBronze, nil, 72, 70, 20, 12, 8},
	{"abhishek-sharma", "Abhishek Sharma", "IND", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RaritySilver, []string{"Powerplay Hitter"}, 74, 82, 26, 20, 8},
	{"nitish-reddy", "Nitish Kumar Reddy", "IND", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 68, 74, 64, 60, 8},
	{"harshal-patel", "Harshal Patel", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Death Specialist"}, 32, 36, 74, 72, 8},
	{"umran-malik", "Umran Malik", "IND", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 24, 22, 64, 78, 8},
	{"matthew-wade", "Matthew Wade", "AUS", engine.RoleWK, engine.HandLeft, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 68, 76, 16, 10, 76},
	{"aaron-finch", "Aaron Finch", "AUS", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Powerplay Hitter"}, 74, 82, 22, 14, 8},
	{"sean-abbott", "Sean Abbott", "AUS", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 58, 64, 70, 68, 8},
	{"jason-behrendorff", "Jason Behrendorff", "AUS", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 26, 22, 72, 70, 8},
	{"dawid-malan-t20", "Will Jacks", "ENG", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RaritySilver, []string{"Powerplay Hitter"}, 70, 84, 60, 56, 8},
	{"jason-roy", "Jason Roy", "ENG", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Powerplay Hitter"}, 74, 82, 20, 12, 8},
	{"sam-billings", "Sam Billings", "ENG", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 66, 74, 14, 10, 72},
	{"chris-jordan", "Chris Jordan", "ENG", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Death Specialist", "Safe Hands"}, 36, 40, 74, 76, 8},
	{"finn-allen", "Finn Allen", "NZ", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Powerplay Hitter"}, 68, 88, 20, 12, 8},
	{"james-neesham", "James Neesham", "NZ", engine.RoleAR, engine.HandLeft, engine.BowlPace, engine.RaritySilver, []string{"Finisher"}, 64, 78, 66, 64, 8},
	{"adam-milne", "Adam Milne", "NZ", engine.RoleBOWL, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 26, 22, 70, 76, 8},
	{"reeza-hendricks", "Reeza Hendricks", "SA", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 74, 70, 20, 12, 8},
	{"andile-phehlukwayo", "Andile Phehlukwayo", "SA", engine.RoleAR, engine.HandLeft, engine.BowlPace, engine.RarityBronze, nil, 58, 66, 66, 62, 8},
	{"kusal-perera-wk", "Dinesh Chandimal", "SL", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 70, 64, 14, 10, 74},
	{"dhananjaya-de-silva", "Dhananjaya de Silva", "SL", engine.RoleAR, engine.HandRight, engine.BowlSpin, engine.RaritySilver, nil, 72, 68, 68, 62, 8},
	{"rovel-brathwaite", "Kyle Mayers", "WI", engine.RoleAR, engine.HandLeft, engine.BowlPace, engine.RarityBronze, []string{"Powerplay Hitter"}, 66, 80, 58, 54, 8},
	{"obediah-mccoy", "Obed McCoy", "WI", engine.RoleBOWL, engine.HandLeft, engine.BowlPace, engine.RarityBronze, nil, 24, 22, 68, 70, 8},
	{"soumya-sarkar", "Soumya Sarkar", "BAN", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityBronze, nil, 68, 72, 24, 18, 8},
	{"nasum-ahmed", "Nasum Ahmed", "BAN", engine.RoleBOWL, engine.HandLeft, engine.BowlSpin, engine.RarityBronze, nil, 26, 22, 70, 66, 8},
	{"najibullah-zadran", "Najibullah Zadran", "AFG", engine.RoleBAT, engine.HandLeft, engine.BowlPace, engine.RarityBronze, []string{"Finisher"}, 64, 80, 20, 12, 8},
	{"noor-ahmad", "Noor Ahmad", "AFG", engine.RoleBOWL, engine.HandRight, engine.BowlSpin, engine.RaritySilver, []string{"Mystery Spinner"}, 26, 22, 78, 76, 8},
	{"rassie-bavuma", "Temba Bavuma", "SA", engine.RoleBAT, engine.HandRight, engine.BowlPace, engine.RaritySilver, []string{"Anchor"}, 78, 68, 22, 14, 8},
	{"henrich-de-zwart", "Ryan Rickelton", "SA", engine.RoleWK, engine.HandLeft, engine.BowlPace, engine.RaritySilver, nil, 74, 76, 16, 10, 76},
	{"ben-mcdermott", "Ben McDermott", "AUS", engine.RoleWK, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 66, 74, 14, 10, 70},
	{"moises-henriques", "Moises Henriques", "AUS", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 66, 68, 62, 58, 8},
	{"deepak-hooda", "Deepak Hooda", "IND", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RarityBronze, nil, 66, 70, 56, 52, 8},
	{"shardul-thakur", "Shardul Thakur", "IND", engine.RoleAR, engine.HandRight, engine.BowlPace, engine.RaritySilver, nil, 58, 64, 70, 68, 8},
}
