package api

import (
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
)

func do(method, path, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	NewRouter(slog.New(slog.DiscardHandler), "").ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func TestAPI(t *testing.T) {
	const ev, op = "/api/v1/evaluate", "/api/v1/operations/"
	cases := []struct {
		name, method, path, body string
		status                   int
		want                     string
	}{
		{"expr", "POST", ev, `{"expression":"2 + 3 * 4"}`, 200, `{"result":14}`},
		{"expr plain", "POST", ev, `{"expression":"42"}`, 200, `{"result":42}`},
		{"div zero", "POST", ev, `{"expression":"8 / 0"}`, 422, `{"error":{"code":"DIVISION_BY_ZERO","message":"Undefined"}}`},
		{"syntax", "POST", ev, `{"expression":"2 + * 3"}`, 400, `{"error":{"code":"INVALID_EXPRESSION","message":"Invalid input","position":4}}`},
		{"not json", "POST", ev, `not json`, 400, `{"error":{"code":"INVALID_JSON","message":"Invalid input"}}`},
		{"unknown field", "POST", ev, `{"expression":"1","extra":1}`, 400, `{"error":{"code":"INVALID_JSON","message":"Invalid input"}}`},
		{"too large", "POST", ev, `{"expression":"` + strings.Repeat("1", 5000) + `"}`, 413, `{"error":{"code":"PAYLOAD_TOO_LARGE","message":"Invalid input"}}`},
		{"divide", "POST", op + "divide", `{"operands":[8,2]}`, 200, `{"result":4}`},
		{"add rounds", "POST", op + "add", `{"operands":[0.1,0.2]}`, 200, `{"result":0.3}`},
		{"sqrt neg", "POST", op + "sqrt", `{"operands":[-4]}`, 422, `{"error":{"code":"INVALID_OPERATION","message":"Invalid input"}}`},
		{"unknown op", "POST", op + "modulo", `{"operands":[1,2]}`, 404, `{"error":{"code":"UNKNOWN_OPERATION","message":"Unknown operation"}}`},
		{"bad operands", "POST", op + "add", `{"operands":[1]}`, 400, `{"error":{"code":"INVALID_OPERANDS","message":"Invalid input"}}`},
		{"op bad json", "POST", op + "add", `nope`, 400, `{"error":{"code":"INVALID_JSON","message":"Invalid input"}}`},
		{"health", "GET", "/healthz", "", 200, `{"status":"ok"}`},
		{"405", "GET", ev, "", 405, `{"error":{"code":"METHOD_NOT_ALLOWED","message":"Method not allowed"}}`},
		{"404", "GET", "/nope", "", 404, `{"error":{"code":"NOT_FOUND","message":"Not found"}}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := do(c.method, c.path, c.body)
			if rec.Code != c.status {
				t.Errorf("status = %d, want %d (%s)", rec.Code, c.status, rec.Body)
			}
			if got := strings.TrimSpace(rec.Body.String()); got != c.want {
				t.Errorf("body = %s, want %s", got, c.want)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("content-type = %q", ct)
			}
		})
	}
}
