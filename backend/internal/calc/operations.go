package calc

import (
	"math"
	"strconv"
)

type Operation struct {
	Arity int
	Fn    func(args []float64) (float64, error)
}

var Operations = map[string]Operation{
	"add":      {2, func(a []float64) (float64, error) { return a[0] + a[1], nil }},
	"subtract": {2, func(a []float64) (float64, error) { return a[0] - a[1], nil }},
	"multiply": {2, func(a []float64) (float64, error) { return a[0] * a[1], nil }},
	"divide": {2, func(a []float64) (float64, error) {
		if a[1] == 0 {
			return 0, newError(CodeDivisionByZero, -1)
		}
		return a[0] / a[1], nil
	}},
	"power": {2, func(a []float64) (float64, error) {
		if a[0] == 0 && a[1] < 0 {
			return 0, newError(CodeDivisionByZero, -1)
		}
		return math.Pow(a[0], a[1]), nil
	}},
	"sqrt":    {1, func(a []float64) (float64, error) { return math.Sqrt(a[0]), nil }},
	"percent": {1, func(a []float64) (float64, error) { return a[0] / 100, nil }},
}

// Apply runs an operation without rounding.
func Apply(name string, args ...float64) (float64, error) {
	op, ok := Operations[name]
	if !ok {
		return 0, newError(CodeUnknownOperation, -1)
	}
	if len(args) != op.Arity {
		return 0, newError(CodeInvalidOperands, -1)
	}
	r, err := op.Fn(args)
	if err != nil {
		return 0, err
	}
	if math.IsInf(r, 0) {
		return 0, newError(CodeOverflow, -1)
	}
	if math.IsNaN(r) {
		return 0, newError(CodeInvalidOperation, -1)
	}
	return r, nil
}

// Round rounds to 15 significant digits and normalizes -0 to 0.
func Round(x float64) float64 {
	r, _ := strconv.ParseFloat(strconv.FormatFloat(x, 'g', 15, 64), 64)
	if r == 0 {
		return 0
	}
	return r
}
