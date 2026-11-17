package calc

import (
	"math"
	"strings"
)

const MaxExpressionLength = 256

type Result struct {
	Value  float64
	Repeat string
}

// operand is a parsed value; pct/raw mark a bare `n%` so expr can apply the contextual rule.
type operand struct {
	v, raw float64
	pct    bool
}

type parser struct {
	toks     []Token
	i        int
	depth    int
	repOp    int // position of the rightmost top-level binary operator
	repEnd   int // position just past its right operand
	hasRepOp bool
}

func (p *parser) peek() Token { return p.toks[p.i] }

func (p *parser) next() Token {
	t := p.toks[p.i]
	p.i++
	return t
}

func (p *parser) fail() error { return newError(CodeInvalidExpression, p.peek().Pos) }

// record notes a top-level binary operator; the largest opPos wins because
// lower-precedence operators are recorded after higher ones.
func (p *parser) record(opPos int) {
	if p.depth == 0 && (!p.hasRepOp || opPos > p.repOp) {
		p.hasRepOp, p.repOp, p.repEnd = true, opPos, p.peek().Pos
	}
}

func (p *parser) expr() (operand, error) {
	left, err := p.term()
	if err != nil {
		return left, err
	}
	for k := p.peek().Kind; k == TokPlus || k == TokMinus; k = p.peek().Kind {
		op := p.next()
		right, err := p.term()
		if err != nil {
			return left, err
		}
		if right.pct {
			if right.v, err = Apply("multiply", left.v, right.raw); err == nil {
				right.v, err = Apply("percent", right.v)
			}
			if err != nil {
				return left, err
			}
		}
		p.record(op.Pos)
		name := "add"
		if k == TokMinus {
			name = "subtract"
		}
		if left.v, err = Apply(name, left.v, right.v); err != nil {
			return left, err
		}
		left.pct = false
	}
	return left, nil
}

func (p *parser) term() (operand, error) {
	left, err := p.unary()
	if err != nil {
		return left, err
	}
	for k := p.peek().Kind; k == TokStar || k == TokSlash; k = p.peek().Kind {
		op := p.next()
		right, err := p.unary()
		if err != nil {
			return left, err
		}
		p.record(op.Pos)
		name := "multiply"
		if k == TokSlash {
			name = "divide"
		}
		if left.v, err = Apply(name, left.v, right.v); err != nil {
			return left, err
		}
		left.pct = false
	}
	return left, nil
}

func (p *parser) unary() (operand, error) {
	if p.peek().Kind != TokMinus {
		return p.power()
	}
	p.next()
	o, err := p.unary()
	return operand{v: -o.v}, err
}

func (p *parser) power() (operand, error) {
	base, err := p.prefix()
	if err != nil || p.peek().Kind != TokCaret {
		return base, err
	}
	op := p.next()
	exp, err := p.unary()
	if err != nil {
		return base, err
	}
	p.record(op.Pos)
	v, err := Apply("power", base.v, exp.v)
	return operand{v: v}, err
}

func (p *parser) prefix() (operand, error) {
	if p.peek().Kind != TokSqrt {
		return p.postfix()
	}
	p.next()
	o, err := p.prefix()
	if err != nil {
		return o, err
	}
	v, err := Apply("sqrt", o.v)
	return operand{v: v}, err
}

func (p *parser) postfix() (operand, error) {
	o, err := p.primary()
	if err != nil || p.peek().Kind != TokPercent {
		return o, err
	}
	p.next()
	v, err := Apply("percent", o.v)
	return operand{v: v, raw: o.v, pct: true}, err
}

func (p *parser) primary() (operand, error) {
	switch t := p.peek(); t.Kind {
	case TokNumber:
		p.next()
		return operand{v: t.Value}, nil
	case TokLParen:
		p.next()
		p.depth++
		o, err := p.expr()
		p.depth--
		if err != nil {
			return o, err
		}
		if p.peek().Kind != TokRParen {
			return o, p.fail()
		}
		p.next()
		return operand{v: o.v}, nil
	}
	return operand{}, p.fail()
}

// Evaluate parses and evaluates expr, returning the rounded value and the
// repeat fragment (last top-level binary operator plus its right operand).
func Evaluate(expr string) (Result, error) {
	if len(expr) > MaxExpressionLength {
		return Result{}, newError(CodeExpressionTooLong, -1)
	}
	toks, err := Lex(expr)
	if err != nil {
		return Result{}, err
	}
	p := &parser{toks: toks}
	o, err := p.expr()
	if err == nil && p.peek().Kind != TokEOF {
		err = p.fail()
	}
	if err != nil {
		return Result{}, err
	}
	// A bare literal such as 1e999 never passes through Apply.
	if math.IsInf(o.v, 0) {
		return Result{}, newError(CodeOverflow, -1)
	}
	if math.IsNaN(o.v) {
		return Result{}, newError(CodeInvalidOperation, -1)
	}
	res := Result{Value: Round(o.v)}
	if p.hasRepOp {
		res.Repeat = expr[p.repOp:p.repOp+1] + " " + strings.TrimSpace(expr[p.repOp+1:p.repEnd])
	}
	return res, nil
}
