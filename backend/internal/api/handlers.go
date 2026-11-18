package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"calculator/internal/calc"
)

const maxBody = 4096

// decode reads a strict JSON body into v; on failure it writes the error response and returns false.
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, errPayloadTooLarge)
		} else {
			writeError(w, errInvalidJSON)
		}
		return false
	}
	return true
}

func evaluate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Expression string `json:"expression"`
	}
	if !decode(w, r, &req) {
		return
	}
	res, err := calc.Evaluate(req.Expression)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, result{res.Value})
}

func operation(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Operands []float64 `json:"operands"`
	}
	if !decode(w, r, &req) {
		return
	}
	res, err := calc.Operate(chi.URLParam(r, "name"), req.Operands...)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, result{res.Value})
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "ok"})
}
