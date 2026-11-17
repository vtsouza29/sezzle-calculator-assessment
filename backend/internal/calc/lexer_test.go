package calc

import (
	"errors"
	"testing"
)

type tk struct {
	k TokenKind
	v float64
	p int
}

func TestLex(t *testing.T) {
	cases := []struct {
		in   string
		want []tk
	}{
		{"2 + 3*4", []tk{{TokNumber, 2, 0}, {TokPlus, 0, 2}, {TokNumber, 3, 4}, {TokStar, 0, 5}, {TokNumber, 4, 6}, {TokEOF, 0, 7}}},
		{".5", []tk{{TokNumber, 0.5, 0}, {TokEOF, 0, 2}}},
		{"1e21", []tk{{TokNumber, 1e21, 0}, {TokEOF, 0, 4}}},
		{"1.5e-7", []tk{{TokNumber, 1.5e-7, 0}, {TokEOF, 0, 6}}},
		{"1E+3", []tk{{TokNumber, 1000, 0}, {TokEOF, 0, 4}}},
		{"sqrt 9", []tk{{TokSqrt, 0, 0}, {TokNumber, 9, 5}, {TokEOF, 0, 6}}},
		{"(-2)^2%", []tk{{TokLParen, 0, 0}, {TokMinus, 0, 1}, {TokNumber, 2, 2}, {TokRParen, 0, 3}, {TokCaret, 0, 4}, {TokNumber, 2, 5}, {TokPercent, 0, 6}, {TokEOF, 0, 7}}},
		{"1.2.3", []tk{{TokNumber, 1.2, 0}, {TokNumber, 0.3, 3}, {TokEOF, 0, 5}}},
		{"/", []tk{{TokSlash, 0, 0}, {TokEOF, 0, 1}}},
	}
	for _, c := range cases {
		got, err := Lex(c.in)
		if err != nil {
			t.Fatalf("%q: %v", c.in, err)
		}
		if len(got) != len(c.want) {
			t.Fatalf("%q: got %v", c.in, got)
		}
		for i, w := range c.want {
			if g := (tk{got[i].Kind, got[i].Value, got[i].Pos}); g != w {
				t.Errorf("%q[%d]: got %v want %v", c.in, i, g, w)
			}
		}
	}
}

func TestLexErrors(t *testing.T) {
	for in, pos := range map[string]int{"2 & 3": 2, "sqr 9": 0, "1e": 0, ".": 0} {
		_, err := Lex(in)
		var e *Error
		if !errors.As(err, &e) || e.Code != CodeInvalidExpression || e.Position != pos {
			t.Errorf("%q: got %v, want INVALID_EXPRESSION at %d", in, err, pos)
		}
	}
}
