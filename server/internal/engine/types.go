package engine

type Role string

const (
	RoleBAT  Role = "BAT"
	RoleWK   Role = "WK"
	RoleAR   Role = "AR"
	RoleBOWL Role = "BOWL"
)

type BowlType string

const (
	BowlPace BowlType = "pace"
	BowlSpin BowlType = "spin"
)

type BatHand string

const (
	HandRight BatHand = "right"
	HandLeft  BatHand = "left"
)

type Rarity string

const (
	RarityBronze Rarity = "Bronze"
	RaritySilver Rarity = "Silver"
	RarityGold   Rarity = "Gold"
	RarityLegend Rarity = "Legend"
)

type Outcome string

const (
	OutcomeDot    Outcome = "dot"
	OutcomeOne    Outcome = "one"
	OutcomeTwo    Outcome = "two"
	OutcomeThree  Outcome = "three"
	OutcomeFour   Outcome = "four"
	OutcomeSix    Outcome = "six"
	OutcomeWicket Outcome = "wicket"
	OutcomeWide   Outcome = "wide"
	OutcomeNoBall Outcome = "noball"
	OutcomeBye    Outcome = "bye"
)

type DismissalType string

const (
	DismissBowled     DismissalType = "bowled"
	DismissLBW        DismissalType = "lbw"
	DismissCaughtWK   DismissalType = "caught_behind"
	DismissCaught     DismissalType = "caught"
	DismissCaughtBowl DismissalType = "caught_and_bowled"
	DismissStumped    DismissalType = "stumped"
	DismissRunOut     DismissalType = "run_out"
)

type ChanceType string

const (
	ChanceCaughtBehind ChanceType = "caught_behind"
	ChanceCaught       ChanceType = "caught"
	ChanceCaughtBowled ChanceType = "caught_and_bowled"
	ChanceStumped      ChanceType = "stumped"
)

type ExtraType string

const (
	ExtraNone   ExtraType = ""
	ExtraWide   ExtraType = "wide"
	ExtraNoBall ExtraType = "noball"
	ExtraBye    ExtraType = "bye"
)

type Zone string

const (
	ZoneFineLeg    Zone = "fine_leg"
	ZoneSquareLeg  Zone = "square_leg"
	ZoneMidwicket  Zone = "midwicket"
	ZoneLongOn     Zone = "long_on"
	ZoneLongOff    Zone = "long_off"
	ZoneCover      Zone = "cover"
	ZonePoint      Zone = "point"
	ZoneThirdMan   Zone = "third_man"
	ZoneWicketKeep Zone = "keeper"
	ZonePitch      Zone = "pitch"
)

var FieldZones = []Zone{
	ZoneFineLeg, ZoneSquareLeg, ZoneMidwicket, ZoneLongOn,
	ZoneLongOff, ZoneCover, ZonePoint, ZoneThirdMan,
}

type Attributes struct {
	Technique    int `json:"technique"`
	Power        int `json:"power"`
	Timing       int `json:"timing"`
	VsPace       int `json:"vs_pace"`
	VsSpin       int `json:"vs_spin"`
	Temperament  int `json:"temperament"`
	Running      int `json:"running"`
	Accuracy     int `json:"accuracy"`
	Variation    int `json:"variation"`
	WicketTaking int `json:"wicket_taking"`
	Movement     int `json:"movement"`
	DeathBowling int `json:"death_bowling"`
	Catching     int `json:"catching"`
	GroundField  int `json:"ground_fielding"`
	Throwing     int `json:"throwing"`
	Keeping      int `json:"keeping"`
	Stumping     int `json:"stumping"`
	Reflexes     int `json:"reflexes"`
}

type Card struct {
	ID       string     `json:"id"`
	PlayerID string     `json:"playerId"`
	Name     string     `json:"name"`
	Country  string     `json:"country"`
	Role     Role       `json:"role"`
	BatHand  BatHand    `json:"batHand"`
	BowlType BowlType   `json:"bowlType"`
	Rarity   Rarity     `json:"rarity"`
	Level    int        `json:"level"`
	XP       int        `json:"xp"`
	Attrs    Attributes `json:"attrs"`
	Traits   []string   `json:"traits"`

	// Captaincy is filled from the catalog (curated for real captains,
	// derived for everyone else). Nil is derived on demand.
	Captaincy  *Captaincy `json:"captaincy,omitempty"`
	CaptainRep int        `json:"captainRep,omitempty"` // reputation 0-100 earned as captain
	Partners   []string   `json:"partners,omitempty"`   // player IDs of well-known batting partners
}

type Lineup struct {
	UserID       string   `json:"userId"`
	Cards        []Card   `json:"cards"`
	BattingOrder []string `json:"battingOrder"`
	BowlingPlan  []string `json:"bowlingPlan"`
	TossPref     string   `json:"tossPref"` // "" lets the captain decide
	Tactics      Tactics  `json:"tactics"`  // fixed plan; empty lets the captain decide each over
	CaptainID    string   `json:"captainId"`
	// Rivals: dismissals by this side's bowlers of opposing batters in the
	// owner's history, keyed "bowlerPlayerID|batterPlayerID". Built per match.
	Rivals map[string]int `json:"-"`
}

type TossResult struct {
	WinnerSide string `json:"winnerSide"` // "home" or "away"
	Decision   string `json:"decision"`   // "bat" or "chase"
}

type Extras struct {
	Type ExtraType `json:"type,omitempty"`
	Runs int       `json:"runs,omitempty"`
}

type Shot struct {
	Zone     Zone    `json:"zone"`
	Angle    float64 `json:"angle"`
	Aerial   bool    `json:"aerial"`
	Distance float64 `json:"distance"`
	Leave    bool    `json:"leave,omitempty"`
}

type Chance struct {
	Type      ChanceType `json:"type"`
	FielderID string     `json:"fielderId"`
	Converted bool       `json:"converted"`
}

type Dismissal struct {
	Type      DismissalType `json:"type"`
	BowlerID  string        `json:"bowlerId"`
	FielderID string        `json:"fielderId,omitempty"`
	Text      string        `json:"text"`
}

type BallEvent struct {
	Innings         int      `json:"innings"`
	Over            int      `json:"over"`
	Ball            int      `json:"ball"`
	Seq             int      `json:"seq"`
	BowlerID        string   `json:"bowlerId"`
	StrikerID       string   `json:"strikerId"`
	NonStrikerID    string   `json:"nonStrikerId"`
	Outcome         Outcome  `json:"outcome"`
	Runs            int      `json:"runs"`
	Legal           bool     `json:"legal"`
	Extras          Extras   `json:"extras"`
	Shot            Shot     `json:"shot"`
	Chance          *Chance  `json:"chance,omitempty"`
	Dismissal       *Dismissal `json:"dismissal,omitempty"`
	FieldingSave    bool     `json:"fieldingSave,omitempty"`
	TraitsTriggered []string `json:"traitsTriggered,omitempty"`
	Commentary      string   `json:"commentary"`
	Approach        string   `json:"approach,omitempty"` // batting approach in force
	Field           string   `json:"field,omitempty"`    // field plan in force
	Pressure        int      `json:"pressure,omitempty"` // dot balls in a row before this ball
	Matchup         string   `json:"matchup,omitempty"`  // e.g. "weak vs spin"
	Counter         string   `json:"counter,omitempty"`  // strategy counter in force, e.g. "Holing out"
	Powerplay       bool     `json:"powerplay,omitempty"`
	FreeHit         bool     `json:"freeHit,omitempty"`
	Masterstroke    string   `json:"masterstroke,omitempty"` // name of a masterstroke active this over
	MasterstrokeBy  string   `json:"masterstrokeBy,omitempty"` // "bat" or "bowl"
	Chemistry       int      `json:"chemistry,omitempty"` // link level 0-3 between the two batters
	Rivalry         bool     `json:"rivalry,omitempty"`   // the bowler "has his number"
	Score           int      `json:"score"`
	Wickets         int      `json:"wickets"`
}

type BatterScore struct {
	CardID     string     `json:"cardId"`
	Runs       int        `json:"runs"`
	Balls      int        `json:"balls"`
	Fours      int        `json:"fours"`
	Sixes      int        `json:"sixes"`
	Dismissal  *Dismissal `json:"dismissal,omitempty"`
	NotOut     bool       `json:"notOut"`
}

type BowlerScore struct {
	CardID  string  `json:"cardId"`
	Overs   float64 `json:"overs"`
	Balls   int     `json:"balls"`
	Runs    int     `json:"runs"`
	Wickets int     `json:"wickets"`
}

type FielderScore struct {
	CardID    string `json:"cardId"`
	Catches   int    `json:"catches"`
	Stumpings int    `json:"stumpings"`
	RunOuts   int    `json:"runOuts"`
	Drops     int    `json:"drops"`
	RunsSaved int    `json:"runsSaved"`
	IsKeeper  bool   `json:"isKeeper"`
}

type InningsResult struct {
	BattingSide string         `json:"battingSide"`
	BowlingSide string         `json:"bowlingSide"`
	Runs        int            `json:"runs"`
	Wickets     int            `json:"wickets"`
	Balls       int            `json:"balls"`
	Byes        int            `json:"byes"`
	Wides       int            `json:"wides"`
	NoBalls     int            `json:"noBalls"`
	Batters     []BatterScore  `json:"batters"`
	Bowlers     []BowlerScore  `json:"bowlers"`
	Fielders    []FielderScore `json:"fielders"`
	Declared    bool           `json:"allOut"`
	Calls       []OverCall     `json:"calls,omitempty"` // what each captain chose, over by over
}

type MatchResult struct {
	Innings [2]InningsResult `json:"innings"`
	Balls   []BallEvent      `json:"balls"`
	Winner  string           `json:"winner"` // "home", "away", "tie"
	Margin  string           `json:"margin"`
	Toss    TossResult       `json:"toss"`
	POTM    string           `json:"playerOfMatch"`
	Pitch   Pitch            `json:"pitch"`

	Conditions Conditions       `json:"conditions,omitempty"` // second-innings twist
	BreakCalls map[string]string `json:"breakCalls,omitempty"` // side -> BreakCall code
	SuperOver  *SuperOverResult `json:"superOver,omitempty"`
}
