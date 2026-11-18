package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"calculator/internal/calc"
)

// Code is the wire error code. Calc codes are passed through as-is; the rest are transport-level.
type Code string

const (
	codeInvalidJSON      Code = "INVALID_JSON"
	codePayloadTooLarge  Code = "PAYLOAD_TOO_LARGE"
	codeNotFound         Code = "NOT_FOUND"
	codeMethodNotAllowed Code = "METHOD_NOT_ALLOWED"
	codeInternal         Code = "INTERNAL"
)

// apiError is a transport-level failure (not produced by calc).
type apiError struct {
	Code    Code
	Message string
}

func (e *apiError) Error() string { return e.Message }

var (
	errInvalidJSON      = &apiError{codeInvalidJSON, "Invalid input"}
	errPayloadTooLarge  = &apiError{codePayloadTooLarge, "Invalid input"}
	errNotFound         = &apiError{codeNotFound, "Not found"}
	errMethodNotAllowed = &apiError{codeMethodNotAllowed, "Method not allowed"}
	errInternal         = &apiError{codeInternal, "Internal error"}
)

// statusFor is the single code-to-status table; codes not listed are 500.
var statusFor = map[Code]int{
	Code(calc.CodeInvalidExpression): 400,
	Code(calc.CodeExpressionTooLong): 400,
	Code(calc.CodeInvalidOperands):   400,
	codeInvalidJSON:                  400,
	Code(calc.CodeUnknownOperation):  404,
	codeNotFound:                     404,
	codeMethodNotAllowed:             405,
	Code(calc.CodeDivisionByZero):    422,
	Code(calc.CodeInvalidOperation):  422,
	Code(calc.CodeOverflow):          422,
	codePayloadTooLarge:              413,
}

// result is the success body of both calculation endpoints.
type result struct {
	Result float64 `json:"result"`
}

type errBody struct {
	Code     Code   `json:"code"`
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
	var b errBody
	switch {
	case errors.As(err, &ce):
		b = errBody{Code: Code(ce.Code), Message: ce.Message}
		if ce.Position >= 0 {
			b.Position = &ce.Position
		}
	case errors.As(err, &ae):
		b = errBody{Code: ae.Code, Message: ae.Message}
	default:
		b = errBody{Code: errInternal.Code, Message: errInternal.Message}
	}
	status, ok := statusFor[b.Code]
	if !ok {
		status = http.StatusInternalServerError
	}
	writeJSON(w, status, map[string]errBody{"error": b})
}

func notFound(w http.ResponseWriter, _ *http.Request) { writeError(w, errNotFound) }

func methodNotAllowed(w http.ResponseWriter, _ *http.Request) { writeError(w, errMethodNotAllowed) }
