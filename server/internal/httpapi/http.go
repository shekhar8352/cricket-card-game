package httpapi

import (
	"log"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/match"
	"github.com/sudhanshushekhar/cricket-card-game/internal/matchmaking"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
	"github.com/sudhanshushekhar/cricket-card-game/internal/tournament"
	"github.com/sudhanshushekhar/cricket-card-game/internal/trophy"
	"golang.org/x/crypto/bcrypt"
	"nhooyr.io/websocket"
)

type Server struct {
	Store  *store.Store
	Match  *match.Service
	Tour   *tournament.Service
	Q      *matchmaking.Queue
	Redis  *redis.Client
	Secret []byte
}

func New(s *store.Store, q *matchmaking.Queue, rdb *redis.Client, secret string) *Server {
	ms := &match.Service{Store: s, Q: q}
	ts := &tournament.Service{Store: s, Match: ms}
	ms.OnComplete = ts.OnMatchComplete
	return &Server{
		Store:  s,
		Match:  ms,
		Tour:   ts,
		Q:      q,
		Redis:  rdb,
		Secret: []byte(secret),
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	origin := os.Getenv("CORS_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{origin, "http://localhost:5173", "http://127.0.0.1:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"ok": "true"})
	})
	r.Post("/auth/register", s.register)
	r.Post("/auth/login", s.login)
	// Public, read-only: how the match engine works.
	r.Get("/engine/model", s.engineModel)
	r.Post("/engine/odds", s.engineOdds)

	r.Group(func(r chi.Router) {
		r.Use(s.auth)
		r.Get("/me", s.me)
		r.Get("/me/stats", s.myStats)
		r.Get("/me/trophies", s.myTrophies)
		r.Get("/cards", s.listCards)
		r.Post("/cards/{id}/train", s.train)
		r.Get("/squad", s.getSquad)
		r.Put("/squad", s.saveSquad)
		r.Post("/matches", s.createMatch)
		r.Get("/matches", s.myMatches)
		r.Get("/matches/{id}", s.getMatch)
		r.Post("/matches/{id}/lineup", s.lockLineup)
		r.Post("/matches/{id}/break", s.submitBreak)
		r.Post("/matches/{id}/superover", s.submitSuperOver)
		r.Get("/matches/{id}/scorecard", s.scorecard)
		r.Post("/rooms", s.createRoom)
		r.Post("/rooms/join", s.joinRoom)
		r.Post("/rooms/{id}/cancel", s.cancelRoom)
		r.Post("/join", s.joinAny)
		r.Get("/tournaments", s.myTournaments)
		r.Post("/tournaments", s.createTournament)
		r.Get("/tournaments/{id}", s.getTournament)
		r.Post("/tournaments/{id}/start", s.startTournament)
		r.Post("/tournaments/{id}/leave", s.leaveTournament)
		r.Post("/tournaments/{id}/autoplay", s.autoplayTournament)
		r.Get("/leaderboard", s.leaderboard)
		r.Get("/users/{id}", s.userProfile)
		r.Get("/traits", s.traits)
	})
	r.Get("/matches/{id}/live", s.live)
	return r
}

func (s *Server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			http.Error(w, "unauthorized", 401)
			return
		}
		tok := strings.TrimPrefix(h, "Bearer ")
		claims := jwt.MapClaims{}
		t, err := jwt.ParseWithClaims(tok, claims, func(t *jwt.Token) (any, error) { return s.Secret, nil })
		if err != nil || !t.Valid {
			http.Error(w, "unauthorized", 401)
			return
		}
		sub, _ := claims["sub"].(string)
		id, err := uuid.Parse(sub)
		if err != nil {
			http.Error(w, "unauthorized", 401)
			return
		}
		u, err := s.Store.UserByID(r.Context(), id)
		if err != nil {
			http.Error(w, "unauthorized", 401)
			return
		}
		ctx := context.WithValue(r.Context(), ctxUser{}, u)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type ctxUser struct{}

func userFrom(r *http.Request) store.User { return r.Context().Value(ctxUser{}).(store.User) }

func (s *Server) token(u store.User) (string, error) {
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": u.ID.String(),
		"exp": time.Now().Add(30 * 24 * time.Hour).Unix(),
	})
	return t.SignedString(s.Secret)
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Username) < 3 || len(body.Password) < 4 {
		http.Error(w, "invalid body", 400)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "server error", 500)
		return
	}
	u, err := s.Store.CreateUser(r.Context(), body.Username, string(hash))
	if err != nil {
		http.Error(w, "username taken", 409)
		return
	}
	starter, err := s.Match.GrantStarter(r.Context(), u)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	tok, _ := s.token(u)
	if s.Q != nil {
		_ = s.Q.SetScore(r.Context(), u.ID, u.Trophies)
	}
	writeJSON(w, 201, map[string]any{
		"token": tok, "user": publicUser(u), "starterPack": mapCards(starter),
	})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	u, err := s.Store.UserByName(r.Context(), body.Username)
	if err != nil {
		http.Error(w, "invalid credentials", 401)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)) != nil {
		http.Error(w, "invalid credentials", 401)
		return
	}
	tok, _ := s.token(u)
	writeJSON(w, 200, map[string]any{"token": tok, "user": publicUser(u)})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	next := trophy.NextAfter(u.Arena)
	streak, _ := s.Store.WinStreak(r.Context(), u.ID)
	writeJSON(w, 200, map[string]any{
		"user":      publicUser(u),
		"nextArena": next,
		"streak": map[string]any{
			"current": streak, "nextWinBonus": trophy.StreakBonus(streak + 1),
			"boostAt": trophy.StreakBoostAt, "nextWinBoosted": streak+1 >= trophy.StreakBoostAt,
		},
	})
}

func (s *Server) listCards(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	cs, err := s.Store.CardsForUser(r.Context(), u.ID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	forms, err := s.Store.CardForms(r.Context(), u.ID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	out := mapCards(cs)
	for i, c := range cs {
		if f, ok := forms[c.ID]; ok {
			out[i]["form"] = f
		}
	}
	writeJSON(w, 200, out)
}

func (s *Server) train(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	var body struct {
		SacrificeIDs []string `json:"sacrificeIds"`
		DryRun       bool     `json:"dryRun"` // preview only: nothing is changed
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&body); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	var sids []uuid.UUID
	for _, x := range body.SacrificeIDs {
		uid, err := uuid.Parse(x)
		if err != nil {
			http.Error(w, "bad sacrifice id", 400)
			return
		}
		sids = append(sids, uid)
	}
	if body.DryRun {
		res, err := s.Match.PreviewTraining(r.Context(), userFrom(r), id, sids)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		writeJSON(w, 200, map[string]any{"result": res, "xpGained": res.XPGained})
		return
	}
	c, res, err := s.Match.Train(r.Context(), userFrom(r), id, sids)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	writeJSON(w, 200, map[string]any{"card": mapCard(c), "result": res, "xpGained": res.XPGained})
}

func (s *Server) getSquad(w http.ResponseWriter, r *http.Request) {
	sq, err := s.Store.Squad(r.Context(), userFrom(r).ID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, map[string]any{
		"cardIds": sq.CardIDs, "battingOrder": sq.BattingOrder, "bowlingPlan": sq.BowlingPlan,
		"captainId": sq.CaptainID, "batPlan": sq.BatPlan, "bowlPlan": sq.BowlPlan,
	})
}

// saveSquad stores the user's default team and strategy after validating it
// with the same rules as a match lineup.
func (s *Server) saveSquad(w http.ResponseWriter, r *http.Request) {
	var body match.LineupReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384)).Decode(&body); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	if err := s.Match.SaveDefault(r.Context(), userFrom(r), body); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	writeJSON(w, 200, map[string]string{"ok": "true"})
}

func (s *Server) createMatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Mode string `json:"mode"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	u := userFrom(r)
	if body.Mode == "pvp" {
		m, paired, err := s.Match.CreatePvPMatch(r.Context(), u)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, 201, s.matchDTO(r.Context(), m, u, paired))
		return
	}
	m, err := s.Match.CreateBotMatch(r.Context(), u)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 201, s.matchDTO(r.Context(), m, u, true))
}

func (s *Server) myMatches(w http.ResponseWriter, r *http.Request) {
	ms, err := s.Store.MatchesForUser(r.Context(), userFrom(r).ID, 30)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	u := userFrom(r)
	var out []any
	for _, m := range ms {
		out = append(out, s.matchDTO(r.Context(), m, u, true))
	}
	writeJSON(w, 200, out)
}

func (s *Server) getMatch(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	m, err := s.Store.MatchByID(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", 404)
		return
	}
	u := userFrom(r)
	if m.Status == match.StatusWaitingRoom && s.Match.ExpireRoom(r.Context(), m) {
		m, _ = s.Store.MatchByID(r.Context(), id)
	}
	if m.Status == match.StatusMatching {
		m, _ = s.Match.FallbackBotIfNeeded(r.Context(), m, u)
	}
	if m.Status == match.StatusLineup {
		// Only locks an idle player-vs-player opponent after the grace period;
		// never the viewer's own lineup in a bot match.
		if err := s.Match.LockStaleLineup(r.Context(), m); err != nil {
			log.Printf("match %s: stale lineup: %v", m.ID, err)
		}
		m, _ = s.Store.MatchByID(r.Context(), id)
	}
	if m.Status == match.StatusBreak || m.Status == match.StatusSuperOver {
		if err := s.Match.ResolveStalePause(r.Context(), m); err != nil {
			log.Printf("match %s: stale pause: %v", m.ID, err)
		}
		m, _ = s.Store.MatchByID(r.Context(), id)
	}
	writeJSON(w, 200, s.matchDTO(r.Context(), m, u, true))
}

func (s *Server) lockLineup(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	var req match.LineupReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	if err := s.Match.LockLineup(r.Context(), userFrom(r), id, req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	m, _ := s.Store.MatchByID(r.Context(), id)
	writeJSON(w, 200, s.matchDTO(r.Context(), m, userFrom(r), true))
}

func (s *Server) scorecard(w http.ResponseWriter, r *http.Request) {
	s.getMatch(w, r)
}

func (s *Server) leaderboard(w http.ResponseWriter, r *http.Request) {
	arena := r.URL.Query().Get("arena")
	users, err := s.Store.Leaderboard(r.Context(), arena, 50)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	me := userFrom(r)
	type row struct {
		Rank      int    `json:"rank"`
		ID        string `json:"id"`
		Username  string `json:"username"`
		Trophies  int    `json:"trophies"`
		Arena     string `json:"arena"`
		Division  string `json:"division"` // "Gold II"
		Protected bool   `json:"protected"`
		Best      int    `json:"best"`
		Me        bool   `json:"me"`
	}
	var out []row
	for i, u := range users {
		rk := trophy.RankOf(u.Arena, u.Trophies)
		out = append(out, row{i + 1, u.ID.String(), u.Username, u.Trophies, u.Arena, rk.Label, rk.Protected, max(u.BestTrophies, u.Trophies), u.ID == me.ID})
	}
	writeJSON(w, 200, out)
}

func (s *Server) traits(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, engine.TraitCatalog)
}

func (s *Server) live(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	defer c.Close(websocket.StatusNormalClosure, "done")
	ctx := r.Context()
	m, err := s.Store.MatchByID(ctx, id)
	if err != nil {
		_ = c.Write(ctx, websocket.MessageText, []byte(`{"type":"error"}`))
		return
	}
	payload, _ := json.Marshal(map[string]any{"type": "state", "status": m.Status, "ballLog": json.RawMessage(orEmpty(m.BallLog)), "result": json.RawMessage(orEmpty(m.Result))})
	_ = c.Write(ctx, websocket.MessageText, payload)
	if m.Status == match.StatusComplete {
		return
	}
	if s.Redis == nil {
		return
	}
	sub := s.Redis.Subscribe(ctx, matchmaking.EventChannel(id))
	defer sub.Close()
	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			_ = c.Write(ctx, websocket.MessageText, []byte(msg.Payload))
		}
	}
}

func (s *Server) matchDTO(ctx context.Context, m store.MatchRow, viewer store.User, _ bool) map[string]any {
	lus, _ := s.Store.Lineups(ctx, m.ID)
	bothLocked := true
	var homeL, awayL *store.LineupRow
	for i := range lus {
		if lus[i].LockedAt == nil {
			bothLocked = false
		}
		if lus[i].UserID == m.HomeUserID.String() {
			homeL = &lus[i]
		} else {
			awayL = &lus[i]
		}
	}
	if m.Status != match.StatusComplete {
		// still hide orders unless both locked or complete
		if !bothLocked || m.Status == match.StatusLineup || m.Status == match.StatusMatching {
			bothLocked = bothLocked && m.Status != match.StatusMatching
		}
	} else {
		bothLocked = true
	}
	hideOrders := m.Status == match.StatusLineup || m.Status == match.StatusMatching
	if hideOrders && bothLocked && m.Status != match.StatusMatching {
		hideOrders = false
	}

	lineupDTO := func(l *store.LineupRow, mine bool) map[string]any {
		if l == nil {
			return nil
		}
		var cards []engine.Card
		_ = json.Unmarshal(l.Snapshot, &cards)
		// Include the derived overall rating so match screens can show it on cards.
		type cardView struct {
			engine.Card
			Overall int `json:"overall"`
		}
		views := make([]cardView, len(cards))
		for i, c := range cards {
			views[i] = cardView{Card: c, Overall: engine.Overall(c)}
		}
		dto := map[string]any{"cards": views, "locked": l.LockedAt != nil}
		if mine || !hideOrders {
			dto["battingOrder"] = l.BattingOrder
			dto["bowlingPlan"] = l.BowlingPlan
			dto["tossPref"] = l.TossPref
			if l.CaptainID != nil {
				dto["captainId"] = l.CaptainID.String()
			}
			dto["batPlan"], dto["bowlPlan"] = l.BatPlan, l.BowlPlan
		}
		return dto
	}

	var rewards []any
	if ids, _ := s.Store.RewardsForMatch(ctx, viewer.ID, m.ID); len(ids) > 0 {
		for _, id := range ids {
			if c, err := s.Store.CardByID(ctx, id); err == nil {
				rewards = append(rewards, mapCard(c))
			}
		}
	}

	oppName := "Bot"
	oppTrophies := 0
	if m.IsBot && len(m.BotProfile) > 0 {
		var p map[string]any
		_ = json.Unmarshal(m.BotProfile, &p)
		if n, ok := p["name"].(string); ok {
			oppName = n
		}
		if t, ok := p["trophies"].(float64); ok {
			oppTrophies = int(t)
		}
	} else if m.AwayUserID != nil {
		if u, err := s.Store.UserByID(ctx, *m.AwayUserID); err == nil {
			oppName = u.Username
			oppTrophies = u.Trophies
		}
	}
	if viewer.ID != m.HomeUserID && m.AwayUserID != nil && viewer.ID == *m.AwayUserID {
		if u, err := s.Store.UserByID(ctx, m.HomeUserID); err == nil {
			oppName = u.Username
			oppTrophies = u.Trophies
		}
	}

	var result any
	if len(m.Result) > 0 {
		_ = json.Unmarshal(m.Result, &result)
	}
	var balls any
	if len(m.BallLog) > 0 {
		_ = json.Unmarshal(m.BallLog, &balls)
	}
	var toss any
	if len(m.Toss) > 0 {
		_ = json.Unmarshal(m.Toss, &toss)
	}

	homeMine := viewer.ID == m.HomeUserID
	dto := map[string]any{
		"id": m.ID, "status": m.Status, "isBot": m.IsBot, "seed": m.Seed,
		"createdAt": m.CreatedAt, "completedAt": m.CompletedAt,
		"opponent": map[string]any{"name": oppName, "trophies": oppTrophies},
		"homeLineup": lineupDTO(homeL, homeMine),
		"awayLineup": lineupDTO(awayL, !homeMine),
		"toss": toss, "result": result, "ballLog": balls,
		"pitch": engine.PitchByCode(engine.PitchForSeed(m.Seed)),
		"opponentCaptain": opponentCaptain(m, homeL, awayL, homeMine),
		"trophyDeltaHome": m.TrophyDeltaHome, "trophyDeltaAway": m.TrophyDeltaAway,
		"rewards": rewards, "youAreHome": homeMine,
		"ratings": func() map[string]float64 {
			if m.Status != match.StatusComplete {
				return nil
			}
			return matchRatings(m.Result)
		}(),
		"pause":       s.pauseDTO(m, lus, viewer),
		"rivalries":   s.matchRivalries(ctx, viewer, homeL, awayL),
		"lineupDeadline": match.LineupDeadline(m, lus, viewer.ID),
		"xpEarned": s.matchXP(ctx, m.ID, viewer.ID),
		"homeUserId": m.HomeUserID,
		"mode":       m.Mode,
	}
	if m.TournamentID != nil {
		dto["tournamentId"] = m.TournamentID
		if m.Stage != nil {
			dto["stage"] = *m.Stage
		}
		if t, err := s.Store.TournamentByID(ctx, *m.TournamentID); err == nil {
			dto["tournamentName"] = t.Name
		}
	}
	if m.Status == match.StatusWaitingRoom && m.RoomCode != nil {
		dto["roomCode"] = *m.RoomCode
		dto["roomExpiresAt"] = m.CreatedAt.Add(match.RoomTTL)
		dto["opponent"] = map[string]any{"name": "Waiting for a friend", "trophies": nil}
	}
	if m.AwayUserID != nil {
		dto["awayUserId"] = m.AwayUserID
	}
	if m.WinnerUserID != nil {
		dto["winnerUserId"] = m.WinnerUserID
	}
	return dto
}

func mapCards(cs []store.CardRow) []map[string]any {
	var out []map[string]any
	for _, c := range cs {
		out = append(out, mapCard(c))
	}
	return out
}

func mapCard(c store.CardRow) map[string]any {
	e := c.ToEngine()
	return map[string]any{
		"id": e.ID, "playerId": e.PlayerID, "name": e.Name, "country": e.Country,
		"role": e.Role, "batHand": e.BatHand, "bowlType": e.BowlType, "rarity": e.Rarity,
		"level": e.Level, "xp": e.XP, "xpToNext": func() int {
			return 80 * e.Level
		}(), "levelCap": engine.LevelCap(e.Rarity),
		"attrs": e.Attrs, "effective": engine.Effective(e), "overall": engine.Overall(e),
		"traits": e.Traits, "createdAt": c.CreatedAt,
		"captaincy": engine.CaptaincyOf(e), "captainRep": c.CaptainRep, "partners": e.Partners,
	}
}

func publicUser(u store.User) map[string]any {
	next := trophy.NextAfter(u.Arena)
	var nextName string
	var nextMin int
	if next != nil {
		nextName, nextMin = next.Name, next.MinTrophy
	}
	best := max(u.BestTrophies, u.Trophies)
	return map[string]any{
		"id": u.ID, "username": u.Username, "trophies": u.Trophies, "arena": u.Arena,
		"nextArena": nextName, "nextArenaMin": nextMin,
		// Arena, division, next step and buffer protection.
		"arenaRank":    trophy.RankOf(u.Arena, u.Trophies),
		"bestTrophies": best,
		"bestRank":     trophy.RankOf(trophy.ArenaFor(best).Name, best),
		"bestAt":       u.BestAt,
	}
}

// myTrophies is the trophy road (every arena and division), the buffer rule,
// and the player's trophy count after each ranked match.
func (s *Server) myTrophies(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	hist, err := s.Store.TrophyHistory(r.Context(), u.ID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	type point struct {
		MatchID  string `json:"matchId"`
		At       string `json:"at"`
		Delta    int    `json:"delta"`
		Trophies int    `json:"trophies"`
	}
	// Replay forward from zero with the floor at 0, as the trophies were applied.
	replay := func(start int) []point {
		out := make([]point, len(hist))
		t := start
		for i, h := range hist {
			t = trophy.Apply(t, h.Delta)
			out[i] = point{h.MatchID.String(), h.At.Format(time.RFC3339), h.Delta, t}
		}
		return out
	}
	t := 0
	pts := replay(t)
	if n := len(pts); n == 0 {
		t = u.Trophies
	} else if pts[n-1].Trophies != u.Trophies {
		// History doesn't add up to today (trophies set outside matches): work
		// backwards from the real count so the line ends where the player is.
		t = u.Trophies
		for i := n - 1; i >= 0; i-- {
			pts[i].Trophies = t
			t = max(0, t-hist[i].Delta)
		}
	}
	writeJSON(w, 200, map[string]any{
		"road":    trophy.Road(),
		"buffer":  trophy.Buffer,
		"start":   t,
		"history": pts,
		"rank":    trophy.RankOf(u.Arena, u.Trophies),
		"best":    max(u.BestTrophies, u.Trophies),
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func orEmpty(b []byte) []byte {
	if len(b) == 0 {
		return []byte("null")
	}
	return b
}

func writeErr(w http.ResponseWriter, err error) {
	if errors.Is(err, context.Canceled) {
		return
	}
	http.Error(w, err.Error(), 500)
}

func atoi(s string, d int) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return d
	}
	return n
}


// matchRatings rates every player in a finished match (nil before then).
func matchRatings(result []byte) map[string]float64 {
	if len(result) == 0 {
		return nil
	}
	var res engine.MatchResult
	if json.Unmarshal(result, &res) != nil {
		return nil
	}
	return engine.PlayerRatings(res)
}

func (s *Server) matchXP(ctx context.Context, matchID, userID uuid.UUID) map[string]int {
	xp, err := s.Store.MatchXP(ctx, matchID, userID)
	if err != nil || len(xp) == 0 {
		return nil
	}
	return xp
}
