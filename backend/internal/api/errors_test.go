package api

import (
	"testing"

	"calculator/internal/calc"
)

func TestStatusDefaultsTo500(t *testing.T) {
	if got := status("NOPE"); got != 500 {
		t.Fatalf("unmapped code: got %d, want 500", got)
	}
	if got := status(calc.CodeDivisionByZero); got != 422 {
		t.Fatalf("mapped code: got %d, want 422", got)
	}
}
