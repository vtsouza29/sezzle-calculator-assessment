package calc

const MaxExpressionLength = 256

type Result struct{ Value float64 }

// binaryOp names the operation for each left-associative binary token.
var binaryOp = map[TokenKind]string{TokPlus: "add", TokMinus: "subtract", TokStar: "multiply", TokSlash: "divide"}

// operand is a parsed value; pct/raw mark a bare `n%` so expr can apply the contextual rule.
type operand struct {
	v, raw float64
	pct    bool
}

type parser struct {
	toks []Token
	i    int
}

func (p *parser) peek() Token { return p.toks[p.i] }

func (p *parser) next() Token {
	t := p.toks[p.i]
	p.i++
	return t
}

func (p *parser) fail() error { return newError(CodeInvalidExpression, p.peek().Pos) }

func (p *parser) expr() (operand, error) {
	left, err := p.term()
	if err != nil {
		return left, err
	}
	for k := p.peek().Kind; k == TokPlus || k == TokMinus; k = p.peek().Kind {
		p.next()
		right, err := p.term()
		if err != nil {
			return left, err
		}
		if right.pct {
			if right.v, err = apply("multiply", left.v, right.raw); err == nil {
				right.v, err = apply("percent", right.v)
			}
			if err != nil {
				return left, err
			}
		}
		if left.v, err = apply(binaryOp[k], left.v, right.v); err != nil {
			return left, err
		}
	}
	return left, nil
}

func (p *parser) term() (operand, error) {
	left, err := p.unary()
	if err != nil {
		return left, err
	}
	for k := p.peek().Kind; k == TokStar || k == TokSlash; k = p.peek().Kind {
		p.next()
		right, err := p.unary()
		if err != nil {
			return left, err
		}
		if left.v, err = apply(binaryOp[k], left.v, right.v); err != nil {
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
	p.next()
	exp, err := p.unary()
	if err != nil {
		return base, err
	}
	v, err := apply("power", base.v, exp.v)
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
	v, err := apply("sqrt", o.v)
	return operand{v: v}, err
}

func (p *parser) postfix() (operand, error) {
	o, err := p.primary()
	if err != nil || p.peek().Kind != TokPercent {
		return o, err
	}
	p.next()
	v, err := apply("percent", o.v)
	return operand{v: v, raw: o.v, pct: true}, err
}

func (p *parser) primary() (operand, error) {
	switch t := p.peek(); t.Kind {
	case TokNumber:
		p.next()
		return operand{v: t.Value}, nil
	case TokLParen:
		p.next()
		o, err := p.expr()
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

// Evaluate parses and evaluates expr, returning the rounded value.
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
	// A bare literal such as 1e999 never passes through apply.
	v, err := finite(o.v)
	return Result{Value: round(v)}, err
}
