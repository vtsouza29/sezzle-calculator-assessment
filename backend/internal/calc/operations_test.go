package calc

import (
	"errors"
	"math"
	"testing"
)

func TestApply(t *testing.T) {
	tests := []struct {
		name string
		op   string
		args []float64
		want float64
		code Code
	}{
		{"add", "add", []float64{2, 3}, 5, ""},
		{"subtract", "subtract", []float64{2, 3}, -1, ""},
		{"multiply", "multiply", []float64{4, 2.5}, 10, ""},
		{"divide", "divide", []float64{8, 2}, 4, ""},
		{"divide by zero", "divide", []float64{8, 0}, 0, CodeDivisionByZero},
		{"power", "power", []float64{2, 10}, 1024, ""},
		{"power negative exponent", "power", []float64{2, -1}, 0.5, ""},
		{"zero to negative power", "power", []float64{0, -1}, 0, CodeDivisionByZero},
		{"negative base fractional exponent", "power", []float64{-8, 0.5}, 0, CodeInvalidOperation},
		{"negative base integer exponent", "power", []float64{-2, 3}, -8, ""},
		{"sqrt", "sqrt", []float64{9}, 3, ""},
		{"sqrt negative", "sqrt", []float64{-4}, 0, CodeInvalidOperation},
		{"percent", "percent", []float64{50}, 0.5, ""},
		{"overflow", "multiply", []float64{1e308, 10}, 0, CodeOverflow},
		{"unknown op", "modulo", []float64{1, 2}, 0, CodeUnknownOperation},
		{"wrong arity", "add", []float64{1}, 0, CodeInvalidOperands},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Apply(tc.op, tc.args...)
			if tc.code != "" {
				var ce *Error
				if !errors.As(err, &ce) || ce.Code != tc.code {
					t.Fatalf("err = %v, want code %s", err, tc.code)
				}
				return
			}
			if err != nil || got != tc.want {
				t.Fatalf("got %v, %v; want %v", got, err, tc.want)
			}
		})
	}
}

func TestRound(t *testing.T) {
	if Round(0.1+0.2) != 0.3 {
		t.Error("0.1+0.2")
	}
	if Round(1.0/3) != 0.333333333333333 {
		t.Error("1/3")
	}
	if math.Signbit(Round(math.Copysign(0, -1))) {
		t.Error("negative zero")
	}
	if Round(1e21) != 1e21 {
		t.Error("1e21")
	}
}

func TestNewErrorMessage(t *testing.T) {
	if m := newError(CodeDivisionByZero, -1).Message; m != "Undefined" {
		t.Errorf("message = %q", m)
	}
}
