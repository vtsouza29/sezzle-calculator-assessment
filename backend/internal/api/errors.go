package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"calculator/internal/calc"
)

// API-level codes, not produced by the calc package.
const (
	CodeInvalidJSON      calc.Code = "INVALID_JSON"
	CodePayloadTooLarge  calc.Code = "PAYLOAD_TOO_LARGE"
	codeNotFound         calc.Code = "NOT_FOUND"
	codeMethodNotAllowed calc.Code = "METHOD_NOT_ALLOWED"
)

var statusFor = map[calc.Code]int{
	calc.CodeInvalidExpression: 400,
	calc.CodeExpressionTooLong: 400,
	calc.CodeInvalidOperands:   400,
	CodeInvalidJSON:            400,
	calc.CodeUnknownOperation:  404,
	calc.CodeDivisionByZero:    422,
	calc.CodeInvalidOperation:  422,
	calc.CodeOverflow:          422,
	CodePayloadTooLarge:        413,
}

type errBody struct {
	Code     calc.Code `json:"code"`
	Message  string    `json:"message"`
	Position *int      `json:"position,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, b errBody) {
	writeJSON(w, status, map[string]errBody{"error": b})
}

func writeCodeErr(w http.ResponseWriter, code calc.Code, msg string) {
	writeErr(w, statusFor[code], errBody{Code: code, Message: msg})
}

func writeCalcErr(w http.ResponseWriter, err error) {
	var ce *calc.Error
	if !errors.As(err, &ce) {
		writeErr(w, 500, errBody{Code: "INTERNAL", Message: "Internal error"})
		return
	}
	b := errBody{Code: ce.Code, Message: ce.Message}
	if ce.Position >= 0 {
		b.Position = &ce.Position
	}
	writeErr(w, statusFor[ce.Code], b)
}

func notFound(w http.ResponseWriter, _ *http.Request) {
	writeErr(w, 404, errBody{Code: codeNotFound, Message: "Not found"})
}

func methodNotAllowed(w http.ResponseWriter, _ *http.Request) {
	writeErr(w, 405, errBody{Code: codeMethodNotAllowed, Message: "Method not allowed"})
}
