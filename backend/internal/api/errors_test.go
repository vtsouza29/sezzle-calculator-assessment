package api

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWriteErrorUnknownIs500Internal(t *testing.T) {
	rec := httptest.NewRecorder()
	writeError(rec, errors.New("boom"))
	want := `{"error":{"code":"INTERNAL","message":"Internal error"}}`
	if rec.Code != 500 || strings.TrimSpace(rec.Body.String()) != want {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
}
