package calc

import (
	"strconv"
	"strings"
)

type TokenKind int

const (
	TokNumber TokenKind = iota
	TokPlus
	TokMinus
	TokStar
	TokSlash
	TokCaret
	TokPercent
	TokSqrt
	TokLParen
	TokRParen
	TokEOF
)

// Token.Pos is the byte offset of the token's first character.
type Token struct {
	Kind  TokenKind
	Value float64
	Pos   int
}

var punct = map[byte]TokenKind{
	'+': TokPlus, '-': TokMinus, '*': TokStar, '/': TokSlash,
	'^': TokCaret, '%': TokPercent, '(': TokLParen, ')': TokRParen,
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }

// Lex tokenizes input; the result always ends with TokEOF.
func Lex(input string) ([]Token, error) {
	var toks []Token
	for i := 0; i < len(input); {
		c := input[i]
		switch {
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			i++
		case isDigit(c) || c == '.':
			start := i
			for i < len(input) && isDigit(input[i]) {
				i++
			}
			if i < len(input) && input[i] == '.' {
				i++
				fracStart := i
				for i < len(input) && isDigit(input[i]) {
					i++
				}
				if i == fracStart && start == fracStart-1 { // lone "."
					return nil, newError(CodeInvalidExpression, start)
				}
			}
			if i < len(input) && (input[i] == 'e' || input[i] == 'E') {
				i++
				if i < len(input) && (input[i] == '+' || input[i] == '-') {
					i++
				}
				expStart := i
				for i < len(input) && isDigit(input[i]) {
					i++
				}
				if i == expStart {
					return nil, newError(CodeInvalidExpression, start)
				}
			}
			v, err := strconv.ParseFloat(input[start:i], 64)
			if err != nil && !strings.Contains(err.Error(), "range") {
				return nil, newError(CodeInvalidExpression, start)
			}
			toks = append(toks, Token{TokNumber, v, start})
		case strings.HasPrefix(input[i:], "sqrt"):
			toks = append(toks, Token{Kind: TokSqrt, Pos: i})
			i += 4
		default:
			k, ok := punct[c]
			if !ok {
				return nil, newError(CodeInvalidExpression, i)
			}
			toks = append(toks, Token{Kind: k, Pos: i})
			i++
		}
	}
	return append(toks, Token{Kind: TokEOF, Pos: len(input)}), nil
}
