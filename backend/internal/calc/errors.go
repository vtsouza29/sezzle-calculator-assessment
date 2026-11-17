package calc

type Code string

const (
	CodeInvalidExpression Code = "INVALID_EXPRESSION"
	CodeExpressionTooLong Code = "EXPRESSION_TOO_LONG"
	CodeInvalidOperands   Code = "INVALID_OPERANDS"
	CodeUnknownOperation  Code = "UNKNOWN_OPERATION"
	CodeDivisionByZero    Code = "DIVISION_BY_ZERO"
	CodeInvalidOperation  Code = "INVALID_OPERATION"
	CodeOverflow          Code = "OVERFLOW"
)

// Error is a typed calculation error. Position is -1 when not applicable.
type Error struct {
	Code     Code
	Message  string
	Position int
}

func (e *Error) Error() string { return e.Message }

var messages = map[Code]string{
	CodeDivisionByZero:   "Undefined",
	CodeOverflow:         "Overflow",
	CodeUnknownOperation: "Unknown operation",
}

func newError(code Code, pos int) *Error {
	msg, ok := messages[code]
	if !ok {
		msg = "Invalid input"
	}
	return &Error{Code: code, Message: msg, Position: pos}
}
