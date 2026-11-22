package seedcatalog

import "github.com/sudhanshushekhar/cricket-card-game/internal/engine"

// Captaincy profiles for well-known leaders, as game ratings inspired by their
// public reputations (aggression, game-reading, composure, unpredictability).
// Everyone else is derived from their attributes by engine.DeriveCaptaincy.
var captains = map[string]engine.Captaincy{
	"virat-kohli":           {Aggression: 92, Tactics: 70, Calm: 55, Flair: 60, Masterstroke: "chase_master"},
	"ms-dhoni":              {Aggression: 45, Tactics: 97, Calm: 99, Flair: 85, Masterstroke: "ice_veins"},
	"rohit-sharma":          {Aggression: 70, Tactics: 88, Calm: 85, Flair: 55, Masterstroke: "pull_party"},
	"hardik-pandya":         {Aggression: 82, Tactics: 72, Calm: 70, Flair: 75, Masterstroke: "all_out_attack"},
	"suryakumar-yadav":      {Aggression: 88, Tactics: 78, Calm: 80, Flair: 80, Masterstroke: "all_out_attack"},
	"shubman-gill":          {Aggression: 62, Tactics: 70, Calm: 78, Flair: 45, Masterstroke: "steady_hands"},
	"kl-rahul":              {Aggression: 42, Tactics: 72, Calm: 78, Flair: 35, Masterstroke: "steady_hands"},
	"rishabh-pant":          {Aggression: 90, Tactics: 64, Calm: 60, Flair: 95, Masterstroke: "wildcard"},
	"shreyas-iyer":          {Aggression: 66, Tactics: 80, Calm: 80, Flair: 55, Masterstroke: "trap_set"},
	"sanju-samson":          {Aggression: 70, Tactics: 66, Calm: 70, Flair: 60, Masterstroke: "all_out_attack"},
	"ravindra-jadeja":       {Aggression: 60, Tactics: 74, Calm: 78, Flair: 55, Masterstroke: "spin_web"},
	"jasprit-bumrah":        {Aggression: 55, Tactics: 85, Calm: 90, Flair: 60, Masterstroke: "pace_barrage"},
	"steve-smith":           {Aggression: 40, Tactics: 90, Calm: 75, Flair: 70, Masterstroke: "trap_set"},
	"pat-cummins":           {Aggression: 60, Tactics: 88, Calm: 92, Flair: 50, Masterstroke: "pace_barrage"},
	"aaron-finch":           {Aggression: 78, Tactics: 70, Calm: 72, Flair: 45, Masterstroke: "all_out_attack"},
	"mitchell-marsh":        {Aggression: 75, Tactics: 66, Calm: 75, Flair: 55, Masterstroke: "all_out_attack"},
	"david-warner":          {Aggression: 85, Tactics: 70, Calm: 70, Flair: 55, Masterstroke: "all_guns"},
	"travis-head":           {Aggression: 92, Tactics: 60, Calm: 70, Flair: 80, Masterstroke: "all_guns"},
	"glenn-maxwell":         {Aggression: 90, Tactics: 62, Calm: 55, Flair: 95, Masterstroke: "wildcard"},
	"ben-stokes":            {Aggression: 95, Tactics: 80, Calm: 85, Flair: 90, Masterstroke: "all_guns"},
	"jos-buttler":           {Aggression: 80, Tactics: 68, Calm: 70, Flair: 60, Masterstroke: "all_out_attack"},
	"joe-root":              {Aggression: 40, Tactics: 78, Calm: 85, Flair: 35, Masterstroke: "steady_hands"},
	"moeen-ali":             {Aggression: 65, Tactics: 70, Calm: 80, Flair: 65, Masterstroke: "spin_web"},
	"kane-williamson":       {Aggression: 30, Tactics: 92, Calm: 97, Flair: 40, Masterstroke: "patient_trap"},
	"tom-latham":            {Aggression: 40, Tactics: 78, Calm: 85, Flair: 30, Masterstroke: "trap_set"},
	"mitchell-santner":      {Aggression: 45, Tactics: 84, Calm: 85, Flair: 50, Masterstroke: "spin_web"},
	"tim-southee":           {Aggression: 60, Tactics: 72, Calm: 75, Flair: 45, Masterstroke: "pace_barrage"},
	"aiden-markram":         {Aggression: 60, Tactics: 78, Calm: 80, Flair: 45, Masterstroke: "trap_set"},
	"rassie-bavuma":         {Aggression: 35, Tactics: 75, Calm: 85, Flair: 30, Masterstroke: "steady_hands"},
	"quinton-de-kock":       {Aggression: 75, Tactics: 65, Calm: 72, Flair: 55, Masterstroke: "all_out_attack"},
	"david-miller":          {Aggression: 72, Tactics: 66, Calm: 85, Flair: 50, Masterstroke: "steady_hands"},
	"heinrich-klaasen":      {Aggression: 85, Tactics: 60, Calm: 70, Flair: 70, Masterstroke: "all_out_attack"},
	"kusal-mendis":          {Aggression: 60, Tactics: 68, Calm: 70, Flair: 55, Masterstroke: "all_out_attack"},
	"charith-asalanka":      {Aggression: 55, Tactics: 70, Calm: 75, Flair: 50, Masterstroke: "trap_set"},
	"wanindu-hasaranga":     {Aggression: 70, Tactics: 72, Calm: 68, Flair: 75, Masterstroke: "spin_web"},
	"dasun-shanaka":         {Aggression: 70, Tactics: 68, Calm: 70, Flair: 60, Masterstroke: "all_out_attack"},
	"angelo-mathews":        {Aggression: 45, Tactics: 80, Calm: 90, Flair: 40, Masterstroke: "steady_hands"},
	"nicholas-pooran":       {Aggression: 78, Tactics: 62, Calm: 65, Flair: 70, Masterstroke: "all_out_attack"},
	"shai-hope":             {Aggression: 40, Tactics: 72, Calm: 85, Flair: 35, Masterstroke: "steady_hands"},
	"jason-holder":          {Aggression: 55, Tactics: 76, Calm: 85, Flair: 45, Masterstroke: "pace_barrage"},
	"andre-russell":         {Aggression: 95, Tactics: 55, Calm: 60, Flair: 85, Masterstroke: "wildcard"},
	"najmul-hossain-shanto": {Aggression: 50, Tactics: 68, Calm: 72, Flair: 40, Masterstroke: "steady_hands"},
	"shakib-al-hasan":       {Aggression: 55, Tactics: 88, Calm: 80, Flair: 65, Masterstroke: "spin_web"},
	"litton-das":            {Aggression: 60, Tactics: 62, Calm: 65, Flair: 55, Masterstroke: "all_out_attack"},
	"mushfiqur-rahim":       {Aggression: 48, Tactics: 70, Calm: 60, Flair: 45, Masterstroke: "trap_set"},
	"rashid-khan":           {Aggression: 72, Tactics: 82, Calm: 80, Flair: 80, Masterstroke: "spin_web"},
	"mohammad-nabi":         {Aggression: 55, Tactics: 80, Calm: 85, Flair: 55, Masterstroke: "spin_web"},
	"ibrahim-zadran":        {Aggression: 50, Tactics: 62, Calm: 75, Flair: 40, Masterstroke: "steady_hands"},
}

// Well-known batting partnerships. Partners run and rotate strike better together.
var partnerships = [][2]string{
	{"rohit-sharma", "virat-kohli"},
	{"rohit-sharma", "shubman-gill"},
	{"yashasvi-jaiswal", "shubman-gill"},
	{"virat-kohli", "ms-dhoni"},
	{"jos-buttler", "phil-salt"},
	{"joe-root", "harry-brook"},
	{"ben-duckett", "zak-crawley"},
	{"david-warner", "aaron-finch"},
	{"david-warner", "travis-head"},
	{"travis-head", "mitchell-marsh"},
	{"quinton-de-kock", "rassie-bavuma"},
	{"quinton-de-kock", "aiden-markram"},
	{"heinrich-klaasen", "david-miller"},
	{"devon-conway", "kane-williamson"},
	{"devon-conway", "rachin-ravindra"},
	{"pathum-nissanka", "kusal-mendis"},
	{"shai-hope", "nicholas-pooran"},
	{"brandon-king", "shai-hope"},
	{"litton-das", "najmul-hossain-shanto"},
	{"litton-das", "soumya-sarkar"},
	{"rahmanullah-gurbaz", "ibrahim-zadran"},
}

var partnerIndex = func() map[string][]string {
	m := map[string][]string{}
	for _, p := range partnerships {
		m[p[0]] = append(m[p[0]], p[1])
		m[p[1]] = append(m[p[1]], p[0])
	}
	return m
}()

// Enrich attaches captaincy and known partners to a card (in place).
func Enrich(c *engine.Card) {
	if c.Captaincy == nil {
		if cp, ok := captains[c.PlayerID]; ok {
			cc := cp
			c.Captaincy = &cc
		} else {
			cc := engine.DeriveCaptaincy(*c)
			c.Captaincy = &cc
		}
	}
	if c.Partners == nil {
		c.Partners = partnerIndex[c.PlayerID]
	}
}
