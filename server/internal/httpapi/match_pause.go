package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/match"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

// opponentCaptain shows who captains the other side, once their lineup exists.
func opponentCaptain(m store.MatchRow, homeL, awayL *store.LineupRow, homeMine bool) any {
	row := awayL
	if !homeMine {
		row = homeL
	}
	if row == nil {
		return nil
	}
	var cards []engine.Card
	if json.Unmarshal(row.Snapshot, &cards) != nil || len(cards) == 0 {
		return nil
	}
	id := ""
	if row.CaptainID != nil {
		id = row.CaptainID.String()
	}
	c := engine.CaptainOf(engine.Lineup{Cards: cards, CaptainID: id})
	if c == nil {
		return nil
	}
	cp := engine.CaptaincyOf(*c)
	ms, _ := engine.MasterstrokeByCode(cp.Masterstroke)
	return map[string]any{"cardId": c.ID, "name": c.Name, "rarity": c.Rarity, "country": c.Country, "role": c.Role,
		"captaincy": cp, "captainRep": c.CaptainRep, "masterstroke": ms}
}

// pauseDTO describes the innings break or Super Over for the viewer.
func (s *Server) pauseDTO(m store.MatchRow, lus []store.LineupRow, viewer store.User) any {
	if m.Status != match.StatusBreak && m.Status != match.StatusSuperOver {
		return nil
	}
	side := match.SideOf(m, viewer.ID)
	var mine, theirs *store.LineupRow
	for i := range lus {
		if lus[i].UserID == viewer.ID.String() {
			mine = &lus[i]
		} else {
			theirs = &lus[i]
		}
	}
	var fi engine.FirstInnings
	if json.Unmarshal(m.BreakState, &fi) != nil || side == "" || mine == nil {
		return nil
	}
	out := map[string]any{
		"kind":       map[string]string{match.StatusBreak: "break", match.StatusSuperOver: "super_over"}[m.Status],
		"deadline":   match.PauseDeadline(m, lus, viewer.ID),
		"role":       fi.RoleOf(side),
		"target":     fi.Target(),
		"conditions": engine.ConditionsByCode(fi.Conditions),
	}
	var lu engine.Lineup
	var cards []engine.Card
	if json.Unmarshal(mine.Snapshot, &cards) == nil {
		cid := ""
		if mine.CaptainID != nil {
			cid = mine.CaptainID.String()
		}
		lu = engine.Lineup{Cards: cards, CaptainID: cid}
	}
	if m.Status == match.StatusBreak {
		var opts []engine.BreakCallDef
		want := "bowl"
		if fi.RoleOf(side) == "chase" {
			want = "bat"
		}
		for _, d := range engine.BreakCalls {
			if d.Side == want {
				opts = append(opts, d)
			}
		}
		out["options"] = opts
		// The plan picked before the match for this side, which carries on by default.
		if plan := map[string]string{"bat": mine.BatPlan, "bowl": mine.BowlPlan}[want]; plan != "" {
			out["currentPlan"] = plan
		}
		if cap := engine.CaptainOf(lu); cap != nil {
			out["suggested"] = engine.SuggestBreakCall(m.Seed, *cap, fi.RoleOf(side), fi.Target(), engine.PitchByCode(fi.Pitch).Par)
		}
		out["decided"] = mine.BreakLocked != nil
		if mine.BreakCall != nil {
			out["yourCall"] = *mine.BreakCall
		}
		out["opponentDecided"] = theirs != nil && theirs.BreakLocked != nil
	} else {
		out["decided"] = mine.SuperLocked != nil
		out["opponentDecided"] = theirs != nil && theirs.SuperLocked != nil
		out["suggestedPicks"] = engine.AutoSuperOverPicks(lu)
	}
	return out
}

// matchRivalries lists the viewer's head-to-heads between the two sides' players.
func (s *Server) matchRivalries(ctx context.Context, viewer store.User, homeL, awayL *store.LineupRow) any {
	var pids []string
	inMatch := map[string]bool{}
	for _, row := range []*store.LineupRow{homeL, awayL} {
		if row == nil {
			continue
		}
		var cards []engine.Card
		if json.Unmarshal(row.Snapshot, &cards) != nil {
			continue
		}
		for _, c := range cards {
			pids = append(pids, c.PlayerID)
			inMatch[c.PlayerID] = true
		}
	}
	if len(pids) == 0 {
		return nil
	}
	rs, err := s.Store.Rivalries(ctx, viewer.ID, pids)
	if err != nil {
		return nil
	}
	var out []store.Rivalry
	for _, r := range rs {
		if inMatch[r.Bowler] && inMatch[r.Batter] && r.Balls > 0 {
			out = append(out, r)
		}
		if len(out) == 8 {
			break
		}
	}
	return out
}

func (s *Server) submitBreak(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	var body match.BreakReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	u := userFrom(r)
	if err := s.Match.SubmitBreak(r.Context(), u, id, body); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	m, _ := s.Store.MatchByID(r.Context(), id)
	writeJSON(w, 200, s.matchDTO(r.Context(), m, u, true))
}

func (s *Server) submitSuperOver(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	var body engine.SuperOverPicks
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	u := userFrom(r)
	if err := s.Match.SubmitSuperOver(r.Context(), u, id, body); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	m, _ := s.Store.MatchByID(r.Context(), id)
	writeJSON(w, 200, s.matchDTO(r.Context(), m, u, true))
}
