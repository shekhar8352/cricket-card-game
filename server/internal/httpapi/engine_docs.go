package httpapi

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/sudhanshushekhar/cricket-card-game/internal/cards"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/match"
	"github.com/sudhanshushekhar/cricket-card-game/internal/trophy"
)

var (
	matrixOnce sync.Once
	matrix     []engine.MatrixCell
)

// engineModel publishes the numbers the simulation actually uses, so the
// "How matches work" page can never drift from the engine.
func (s *Server) engineModel(w http.ResponseWriter, r *http.Request) {
	matrixOnce.Do(func() { matrix = engine.StrategyMatrix(2000) })

	approaches := map[string]engine.WeightDelta{}
	for k, v := range engine.ApproachEffects {
		approaches[string(k)] = v
	}
	fields := map[string]engine.WeightDelta{}
	for k, v := range engine.FieldEffects {
		fields[string(k)] = v
	}
	rewardOdds := map[string]cards.RewardOdds{}
	for _, a := range trophy.Arenas {
		rewardOdds[a.Name] = cards.OddsForArena(a.Name)
	}
	roles := []engine.Role{engine.RoleBAT, engine.RoleWK, engine.RoleAR, engine.RoleBOWL}
	affinity := map[string]map[string]float64{}
	for _, from := range roles {
		affinity[string(from)] = map[string]float64{}
		for _, to := range roles {
			affinity[string(from)][string(to)] = cards.RoleAffinity(from, to)
		}
	}
	sacrificeXP := map[string]any{
		"base": cards.SacrificeBase, "from": cards.SacrificeFrom, "growth": cards.SacrificeGrowth,
		"min": cards.SacrificeMinXP, "sameMult": cards.SacrificeSameMult, "affinity": affinity,
	}
	levelCaps := map[string]int{}
	for _, r := range []engine.Rarity{engine.RarityBronze, engine.RaritySilver, engine.RarityGold, engine.RarityLegend} {
		levelCaps[string(r)] = engine.LevelCap(r)
	}
	writeJSON(w, 200, map[string]any{
		"format": map[string]int{
			"overs": engine.OversPerInnings, "ballsPerOver": engine.BallsPerOver, "maxWickets": engine.MaxWickets,
		},
		"baseWeights": engine.BaseWeights(),
		"skillCurve": map[string]float64{
			"scale": engine.SkillCurveScale, "width": engine.SkillCurveWidth,
		},
		"phases":          engine.PhaseNames,
		"approachEffects": approaches,
		"fieldEffects":    fields,
		"counters":        engine.Counters,
		"matrix":          matrix,
		"pitches":         engine.Pitches,
		"pressure": map[string]int{
			"startsAt": engine.PressureStartsAt, "max": engine.PressureMax,
		},
		"matchup": map[string]any{
			"weakBelow": engine.MatchupWeakBelow, "strongAtLeast": engine.MatchupStrongAtLeast,
			"weakEffect": engine.MatchupWeakEffect, "strongEffect": engine.MatchupStrongEffect,
		},
		"traits": engine.TraitCatalog,
		"arenas": trophy.Arenas,
		"trophyRules": map[string]any{
			"buffer": trophy.Buffer, "divisions": trophy.Divisions, "road": trophy.Road(),
			"milestoneFloor": func() map[string]string {
				out := map[string]string{}
				for _, a := range trophy.Arenas[1:] {
					out[a.Name] = string(cards.MilestoneFloor(a.Name))
				}
				return out
			}(),
		},
		"progression": map[string]any{
			"rewardCardsPerWin": match.RewardCardsPerWin,
			"rewardOdds":        rewardOdds,
			"lossXP":            cards.LossXP(),
			"xpPerLevel":        cards.XPToNext(1), // XP to next level = level x this
			"levelBonus":        engine.LevelBonus(2),
			"levelCaps":         levelCaps,
			"performanceXP": map[string]float64{
				"min": cards.PerfXPMin, "perPoint": cards.PerfXPPerPoint, "fromRating": cards.PerfXPFromRating,
			},
			"sacrificeXP":   sacrificeXP,
			"maxSacrifices": match.MaxSacrifices,
		},
		"ratings":       engine.Ratings,
		"captain":       engine.Captain,
		"masterstrokes": engine.Masterstrokes,
		"breakCalls":    engine.BreakCalls,
		"conditions":    engine.ConditionsList,
		"chemistry":     engine.Chemistry,
		"powerplay": map[string]any{
			"overs": 2, "effect": engine.PowerplayEffect, "defendFieldScale": 0.5, "boundarySaves": false,
		},
		"freeHit": engine.FreeHitEffect,
		"rival":   map[string]any{"dismissals": engine.RivalDismissals, "effect": engine.RivalEdge},
		"superOver": map[string]any{
			"batters": engine.SuperOverBatters, "wickets": engine.SuperOverWickets,
			"graceSeconds": int(match.SuperOverGrace.Seconds()),
		},
		"pause": map[string]int{
			"breakGraceSeconds": int(match.BreakGrace.Seconds()), "lineupGraceSeconds": int(match.LineupGrace.Seconds()),
		},
		"streak": map[string]any{
			"bonus":   map[int]int{2: trophy.StreakBonus(2), 3: trophy.StreakBonus(3), 4: trophy.StreakBonus(4), 5: trophy.StreakBonus(5)},
			"boostAt": trophy.StreakBoostAt,
		},
		"reputation": map[string]int{"perMatch": match.RepPerMatch, "perWin": match.RepPerWin, "readsPerPoint": match.ReadsPerRep, "max": 100,
			"perTactics": engine.Captain.RepPerTactics, "maxTactics": engine.Captain.RepMaxBonus},
	})
}

// engineOdds runs the real per-ball calculation for a hypothetical delivery.
func (s *Server) engineOdds(w http.ResponseWriter, r *http.Request) {
	var req engine.OddsRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&req); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	if err := engine.ValidateTactics(engine.Tactics{
		BatApproach: []engine.Approach{req.Approach}, FieldPlan: []engine.FieldPlan{req.Field},
	}); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	writeJSON(w, 200, engine.Odds(req))
}
