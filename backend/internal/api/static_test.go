package api

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStatic(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("app"), 0o644)
	os.WriteFile(filepath.Join(dir, "assets", "a.js"), []byte("js"), 0o644)
	h := NewRouter(slog.New(slog.DiscardHandler), dir)

	get := func(p string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		return rec
	}
	if r := get("/assets/a.js"); r.Code != 200 || r.Body.String() != "js" {
		t.Errorf("asset: %d %q", r.Code, r.Body)
	}
	if r := get("/some/route"); r.Code != 200 || r.Body.String() != "app" {
		t.Errorf("spa: %d %q", r.Code, r.Body)
	}
	r := get("/api/v1/nope")
	if r.Code != http.StatusNotFound || !strings.Contains(r.Body.String(), "NOT_FOUND") || r.Header().Get("Content-Type") != "application/json" {
		t.Errorf("api 404: %d %q", r.Code, r.Body)
	}
}
