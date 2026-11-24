package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/match"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
	"github.com/sudhanshushekhar/cricket-card-game/internal/tournament"
)

// joinAny takes a code from the one "join with a code" box: it may belong to a
// friendly room or a tournament lobby.
func (s *Server) joinAny(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	u := userFrom(r)
	m, err := s.Match.JoinRoom(r.Context(), u, body.Code)
	if err == nil {
		writeJSON(w, 200, map[string]any{"type": "room", "id": m.ID})
		return
	}
	if !errors.Is(err, match.ErrRoomNotFound) {
		status := 500
		if errors.Is(err, match.ErrOwnRoom) || errors.Is(err, match.ErrRoomTaken) {
			status = 409
		}
		http.Error(w, err.Error(), status)
		return
	}
	t, err := s.Tour.Join(r.Context(), u, body.Code)
	switch {
	case errors.Is(err, tournament.ErrNotFound):
		http.Error(w, "No open room or tournament with that code. Check it with your friend; rooms close after 30 minutes.", 404)
	case err != nil:
		http.Error(w, err.Error(), 409)
	default:
		writeJSON(w, 200, map[string]any{"type": "tournament", "id": t.ID})
	}
}

func (s *Server) myTournaments(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	ts, err := s.Store.TournamentsForUser(r.Context(), u.ID, 30)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	out := []any{}
	for _, t := range ts {
		ps, _ := s.Store.TournamentPlayers(r.Context(), t.ID)
		ms, _ := s.Store.MatchesForTournament(r.Context(), t.ID)
		open := 0
		for _, m := range ms {
			if m.Status != match.StatusComplete && match.SideOf(m, u.ID) != "" {
				open++
			}
		}
		out = append(out, map[string]any{
			"id": t.ID, "name": t.Name, "status": t.Status, "format": t.Format,
			"players": len(ps), "createdAt": t.CreatedAt, "yourOpenMatches": open,
			"youAreHost": t.HostUserID == u.ID,
		})
	}
	writeJSON(w, 200, out)
}

func (s *Server) createTournament(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	u := userFrom(r)
	t, err := s.Tour.Create(r.Context(), u, body.Name)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	s.writeTournament(w, r, t.ID, 201)
}

func tournamentID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return id, false
	}
	return id, true
}

func (s *Server) getTournament(w http.ResponseWriter, r *http.Request) {
	id, ok := tournamentID(w, r)
	if !ok {
		return
	}
	// Self-healing: if a result landed without moving the tournament on, do it now.
	if err := s.Tour.Advance(r.Context(), id); err != nil {
		log.Printf("tournament %s: advance: %v", id, err)
	}
	s.writeTournament(w, r, id, 200)
}

func (s *Server) startTournament(w http.ResponseWriter, r *http.Request) {
	id, ok := tournamentID(w, r)
	if !ok {
		return
	}
	if err := s.Tour.Start(r.Context(), userFrom(r), id); err != nil {
		http.Error(w, err.Error(), 409)
		return
	}
	s.writeTournament(w, r, id, 200)
}

func (s *Server) leaveTournament(w http.ResponseWriter, r *http.Request) {
	id, ok := tournamentID(w, r)
	if !ok {
		return
	}
	if err := s.Tour.Leave(r.Context(), userFrom(r), id); err != nil {
		http.Error(w, err.Error(), 409)
		return
	}
	w.WriteHeader(204)
}

func (s *Server) autoplayTournament(w http.ResponseWriter, r *http.Request) {
	id, ok := tournamentID(w, r)
	if !ok {
		return
	}
	if _, err := s.Tour.AutoPlay(r.Context(), userFrom(r), id); err != nil {
		http.Error(w, err.Error(), 409)
		return
	}
	s.writeTournament(w, r, id, 200)
}

func (s *Server) writeTournament(w http.ResponseWriter, r *http.Request, id uuid.UUID, code int) {
	v, err := s.tournamentView(r.Context(), id, userFrom(r))
	if err != nil {
		if store.IsNoRows(err) {
			http.Error(w, "tournament not found", 404)
			return
		}
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, code, v)
}

var stageLabel = map[string]string{
	tournament.StageLeague:     "League",
	tournament.StageQualifier1: "Qualifier 1",
	tournament.StageEliminator: "Eliminator",
	tournament.StageQualifier2: "Qualifier 2",
	tournament.StageFinal:      "Final",
}

// tournamentView is everything the tournament page shows: lobby, points table,
// fixtures and results, and the honours once it's over.
func (s *Server) tournamentView(ctx context.Context, id uuid.UUID, viewer store.User) (map[string]any, error) {
	t, err := s.Store.TournamentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	players, err := s.Store.TournamentPlayers(ctx, id)
	if err != nil {
		return nil, err
	}
	matches, err := s.Store.MatchesForTournament(ctx, id)
	if err != nil {
		return nil, err
	}
	names := map[uuid.UUID]string{}
	in := false
	ps := make([]map[string]any, 0, len(players))
	for _, p := range players {
		names[p.UserID] = p.Username
		in = in || p.UserID == viewer.ID
		ps = append(ps, map[string]any{"userId": p.UserID, "username": p.Username, "trophies": p.Trophies})
	}
	format := tournament.FormatFor(len(players))
	if t.Format != nil {
		format = *t.Format
	}
	table := tournament.Standings(players, matches)
	user := func(uid uuid.UUID) map[string]any { return map[string]any{"userId": uid, "username": names[uid]} }

	fixtures := make([]map[string]any, 0, len(matches))
	leagueNo := 0
	for _, m := range matches {
		stage := ""
		if m.Stage != nil {
			stage = *m.Stage
		}
		label := stageLabel[stage]
		if stage == tournament.StageLeague {
			leagueNo++
			label = fmt.Sprintf("Match %d", leagueNo)
		}
		f := map[string]any{
			"id": m.ID, "stage": stage, "label": label, "status": m.Status,
			"home": user(m.HomeUserID), "yourSide": match.SideOf(m, viewer.ID),
		}
		if m.AwayUserID != nil {
			f["away"] = user(*m.AwayUserID)
		}
		if res, ok := tournament.Result(m); ok {
			score := map[string]string{}
			for _, inn := range res.Innings {
				score[inn.BattingSide] = fmt.Sprintf("%d/%d (%d.%d)", inn.Runs, inn.Wickets, inn.Balls/6, inn.Balls%6)
			}
			f["score"] = score
			f["margin"] = res.Margin
			if stage != tournament.StageLeague && m.AwayUserID != nil {
				win, _, onTable := tournament.Winner(m, table)
				f["winnerUserId"] = win
				f["wonOnTable"] = onTable
			} else if m.WinnerUserID != nil {
				f["winnerUserId"] = m.WinnerUserID
			}
		}
		fixtures = append(fixtures, f)
	}

	v := map[string]any{
		"id": t.ID, "name": t.Name, "code": t.Code, "status": t.Status, "format": format,
		"hostUserId": t.HostUserID, "youAreHost": t.HostUserID == viewer.ID, "youAreIn": in,
		"createdAt": t.CreatedAt, "startedAt": t.StartedAt, "completedAt": t.CompletedAt,
		"players": ps, "minPlayers": tournament.MinPlayers, "maxPlayers": tournament.MaxPlayers,
		"playoffsFrom": tournament.PlayoffsFrom, "qualifiers": tournament.Qualifiers(format),
		"table": table, "leagueDone": tournament.LeagueDone(matches), "matches": fixtures,
		"pointsWin": tournament.PointsWin, "pointsTie": tournament.PointsTie,
	}
	if len(t.Awards) > 0 {
		var h tournament.Honours
		if json.Unmarshal(t.Awards, &h) == nil {
			placings := make([]map[string]any, 0, len(h.Placings))
			for _, uid := range h.Placings {
				placings = append(placings, user(uid))
			}
			v["honours"] = map[string]any{
				"champion": user(h.Champion), "runnerUp": user(h.RunnerUp),
				"placings": placings, "awards": h.Awards,
			}
		}
	}
	return v, nil
}
