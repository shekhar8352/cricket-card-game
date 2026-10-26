package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/sudhanshushekhar/cricket-card-game/internal/seedcatalog"
)

func main() {
	b, err := json.MarshalIndent(seedcatalog.All(), "", "  ")
	if err != nil {
		panic(err)
	}
	path := "seed/players.json"
	if _, err := os.Stat("server/seed"); err == nil {
		path = "server/seed/players.json"
	}
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	if err := os.WriteFile(path, b, 0644); err != nil {
		panic(err)
	}
	fmt.Println("wrote", path, "players", len(seedcatalog.All()))
}
