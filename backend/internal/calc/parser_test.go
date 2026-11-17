package calc

import (
	"errors"
	"strings"
	"testing"
)

func TestEvaluate(t *testing.T) {
	cases := []struct {
		in     string
		value  float64
		repeat string
	}{
		{"2 + 3 * 4", 14, "* 4"},
		{"5 + 5", 10, "+ 5"},
		{"10 + 5", 15, "+ 5"},
		{"2 ^ 3 ^ 2", 512, "^ 2"},
		{"-2^2", -4, "^ 2"},
		{"(-2)^2", 4, "^ 2"},
		{"2^-1", 0.5, "^ -1"},
		{"2 * -3", -6, "* -3"},
		{"5 - -3", 8, "- -3"},
		{"200 + 10%", 220, "+ 10%"},
		{"220 + 10%", 242, "+ 10%"},
		{"200 - 10%", 180, "- 10%"},
		{"200 * 10%", 20, "* 10%"},
		{"50%", 0.5, ""},
		{"sqrt 9 + 1", 4, "+ 1"},
		{"2 + sqrt 9 * 2^3", 26, "^ 3"},
		{"0.1 + 0.2", 0.3, "+ 0.2"},
		{"1e21 + 5", 1e21, "+ 5"},
		{"(1 + 2) * 3", 9, "* 3"},
		{"42", 42, ""},
		{"0 * -1", 0, "* -1"},
		{"12. + 1", 13, "+ 1"},
		{"200 + (-10)%", 180, "+ (-10)%"},
		{"200 - (-10)%", 220, "- (-10)%"},
		{"(10)%", 0.1, ""},
	}
	for _, c := range cases {
		got, err := Evaluate(c.in)
		if err != nil {
			t.Errorf("%q: unexpected error %v", c.in, err)
			continue
		}
		if got.Value != c.value || got.Repeat != c.repeat {
			t.Errorf("%q: got %v %q, want %v %q", c.in, got.Value, got.Repeat, c.value, c.repeat)
		}
		if got.Value == 0 && 1/got.Value < 0 {
			t.Errorf("%q: negative zero", c.in)
		}
	}
}

func TestEvaluateErrors(t *testing.T) {
	cases := []struct {
		in   string
		code Code
		pos  int
	}{
		{"8 / 0", CodeDivisionByZero, -1},
		{"sqrt (-4)", CodeInvalidOperation, -1},
		{"2 + * 3", CodeInvalidExpression, 4},
		{"1.2.3", CodeInvalidExpression, 3},
		{"(1 + 2", CodeInvalidExpression, 6},
		{"2 +", CodeInvalidExpression, 3},
		{"", CodeInvalidExpression, 0},
		{"   ", CodeInvalidExpression, 3},
		{strings.Repeat("1", 257), CodeExpressionTooLong, -1},
		{"1e308 * 10", CodeOverflow, -1},
		{"1e999", CodeOverflow, -1},
		{"1e999 - 1e999", CodeInvalidOperation, -1},
	}
	for _, c := range cases {
		_, err := Evaluate(c.in)
		var ce *Error
		if !errors.As(err, &ce) {
			t.Errorf("%q: got %v, want *Error", c.in, err)
			continue
		}
		if ce.Code != c.code || (c.pos >= 0 && ce.Position != c.pos) {
			t.Errorf("%q: got %s@%d, want %s@%d", c.in, ce.Code, ce.Position, c.code, c.pos)
		}
	}
}
