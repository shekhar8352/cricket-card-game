package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/match"
)

// createRoom opens a friendly room and returns it with its join code.
func (s *Server) createRoom(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	m, err := s.Match.CreateRoom(r.Context(), u)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 201, s.matchDTO(r.Context(), m, u, true))
}

// joinRoom seats the caller in the room with the given code.
func (s *Server) joinRoom(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", 400)
		return
	}
	u := userFrom(r)
	m, err := s.Match.JoinRoom(r.Context(), u, body.Code)
	switch {
	case errors.Is(err, match.ErrRoomNotFound):
		http.Error(w, "No open room with that code. Check it with your friend; rooms close after 30 minutes.", 404)
		return
	case errors.Is(err, match.ErrOwnRoom), errors.Is(err, match.ErrRoomTaken):
		http.Error(w, err.Error(), 409)
		return
	case err != nil:
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, s.matchDTO(r.Context(), m, u, true))
}

// cancelRoom lets the host close a room nobody has joined yet.
func (s *Server) cancelRoom(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	if err := s.Match.CancelRoom(r.Context(), userFrom(r), id); err != nil {
		http.Error(w, err.Error(), 409)
		return
	}
	w.WriteHeader(204)
}
