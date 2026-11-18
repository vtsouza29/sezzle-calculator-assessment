package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"calculator/internal/calc"
)

const invalidInput = "Invalid input"

// apiError is a transport-level failure (not produced by calc) that carries its own status.
type apiError struct {
	status    int
	code, msg string
}

func (e *apiError) Error() string { return e.msg }

var (
	errInvalidJSON      = &apiError{400, "INVALID_JSON", invalidInput}
	errPayloadTooLarge  = &apiError{413, "PAYLOAD_TOO_LARGE", invalidInput}
	errNotFound         = &apiError{404, "NOT_FOUND", "Not found"}
	errMethodNotAllowed = &apiError{405, "METHOD_NOT_ALLOWED", "Method not allowed"}
)

// statusFor maps calc codes to HTTP statuses; unlisted codes are 500.
var statusFor = map[calc.Code]int{
	calc.CodeInvalidExpression: 400,
	calc.CodeExpressionTooLong: 400,
	calc.CodeInvalidOperands:   400,
	calc.CodeUnknownOperation:  404,
	calc.CodeDivisionByZero:    422,
	calc.CodeInvalidOperation:  422,
	calc.CodeOverflow:          422,
}

type result struct {
	Result float64 `json:"result"`
}

type errBody struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Position *int   `json:"position,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// writeError is the only error writer; unknown errors become 500 INTERNAL.
func writeError(w http.ResponseWriter, err error) {
	var ce *calc.Error
	var ae *apiError
	status, b := 500, errBody{Code: "INTERNAL", Message: "Internal error"}
	switch {
	case errors.As(err, &ce):
		if s, ok := statusFor[ce.Code]; ok {
			status = s
		}
		b = errBody{Code: string(ce.Code), Message: ce.Message}
		if ce.Position >= 0 {
			b.Position = &ce.Position
		}
	case errors.As(err, &ae):
		status, b = ae.status, errBody{Code: ae.code, Message: ae.msg}
	}
	writeJSON(w, status, map[string]errBody{"error": b})
}

func notFound(w http.ResponseWriter, _ *http.Request) { writeError(w, errNotFound) }
