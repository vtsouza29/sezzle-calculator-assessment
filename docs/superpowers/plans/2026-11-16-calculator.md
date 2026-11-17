# Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Go REST calculator service and a React + TypeScript pocket-calculator UI that uses it, shipped as one Docker image, with tests, coverage reports and a README that tells the build story.

**Architecture:** All math lives in Go: `internal/calc` (lexer → recursive-descent parser → operation table, no HTTP) behind `internal/api` (chi handlers). The React app is a thin input layer. A pure reducer builds the expression from key presses and holds what the backend returns, and atomic-design components render it on top of CSS-variable design tokens. In production, one Go binary serves both `/api` and the built frontend.

**Tech Stack:** Go 1.27, chi v5, log/slog, stdlib testing/httptest; Vite, React, TypeScript (strict), CSS Modules, Vitest, React Testing Library, @vitest/coverage-v8; Docker multi-stage + compose.

**Spec:** `docs/superpowers/specs/2026-11-16-calculator-design.md` (read it before any task; section numbers below refer to it). Brief: `docs/brief.md`.

## Global Constraints

- Backend Go module path: `calculator` (in `backend/go.mod`). Only allowed non-stdlib dependency: `github.com/go-chi/chi/v5`. No testify.
- Frontend: no UI library, no Tailwind, no state library. Components use design tokens only, never raw colors/spacing.
- The frontend never computes results. The reducer only builds expression strings.
- Wire operators are ASCII: `+ - * / ^ %`, `sqrt`, `( )`. Display symbols are `+ − × ÷ ^ % √`.
- Results are rounded to 15 significant digits. `±Inf` → `OVERFLOW`, `NaN` → `INVALID_OPERATION`. Never serialize Inf/NaN.
- Expression max length 256 characters. Request body max 4096 bytes.
- Error messages (exact display copy): `DIVISION_BY_ZERO` → `Undefined`; `OVERFLOW` → `Overflow`; `INVALID_EXPRESSION`, `EXPRESSION_TOO_LONG`, `INVALID_OPERANDS`, `INVALID_OPERATION`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE` → `Invalid input`; `UNKNOWN_OPERATION` → `Unknown operation`; frontend-only network failure → `Can't reach server`.
- Sezzle brand: the exact light/dark color table in spec §5.3 (operators `#8333d4` with white text, `=` `#9ff4d9` with `#201733` text). Satoshi font, self-hosted. Pill/circle keys. Keys are at least 44×44 px. No Sezzle logo assets.
- Commits: Conventional Commits, one per task, each ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Negative zero:** `0 * -1` must come back as `0`, not `-0` (Go's JSON encodes `-0`). Test in Task 1.
2. **Repeated `=` after a `%` expression:** `200 + 10% =` → `220`, then `=` sends `220 + 10%` → `242`. Tests in Tasks 3 and 8.
3. **Key presses while a request is in flight** (double-tapping `=`): ignored except `AC`, and only one request is sent. Tests in Tasks 8 and 11.
4. **`Enter` while a keypad button has focus** must fire equals once, not also "click" the focused button. Test in Task 11.
5. **Backend down or returning non-JSON** (proxy 502 HTML) must show `Can't reach server`, not crash or show raw HTML. Test in Task 9.

---

## Backend

### Task 1: Module, typed errors, operation table

**Files:**
- Create: `backend/go.mod` (`go mod init calculator`, go 1.27)
- Create: `backend/internal/calc/errors.go`, `backend/internal/calc/operations.go`
- Test: `backend/internal/calc/operations_test.go`

**Interfaces:**
- Produces:
  ```go
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
  type Error struct { Code Code; Message string; Position int } // Position -1 when not applicable
  func (e *Error) Error() string
  func newError(code Code, pos int) *Error // fills Message from the Global Constraints copy
  type Operation struct { Arity int; Fn func(args []float64) (float64, error) }
  var Operations map[string]Operation // add subtract multiply divide power (2); sqrt percent (1)
  func Apply(name string, args ...float64) (float64, error) // unrounded; for parser + handler
  func Round(x float64) float64                             // 15 sig digits, -0 → 0
  ```

- [ ] **Step 1: Write the failing tests.** A table-driven `TestApply` with `errors.As` checks on `Code`, plus `TestRound`:

  ```go
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
  ```
  `TestRound`: `Round(0.1+0.2) == 0.3`, `Round(1.0/3) == 0.333333333333333`, `math.Signbit(Round(math.Copysign(0, -1))) == false`, and `Round(1e21) == 1e21`. Also assert that `newError(CodeDivisionByZero, -1).Message == "Undefined"`.

- [ ] **Step 2: Run `cd backend && go test ./internal/calc/`.** Expected: FAIL (undefined: Apply).

- [ ] **Step 3: Implement** `errors.go` and `operations.go` to the interfaces above. `Apply` checks the result: `IsInf` → `CodeOverflow`, `IsNaN` → `CodeInvalidOperation`. `Round` = `strconv.ParseFloat(strconv.FormatFloat(x, 'g', 15, 64), 64)`, then `+ 0` to drop negative zero (or an explicit `if r == 0 { return 0 }`).

- [ ] **Step 4: Run `go test ./internal/calc/`.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(backend): add operation table with typed errors and rounding`.

### Task 2: Lexer

**Files:**
- Create: `backend/internal/calc/lexer.go`
- Test: `backend/internal/calc/lexer_test.go`

**Interfaces:**
- Consumes: `Error`, `newError`, `CodeInvalidExpression` (Task 1)
- Produces:
  ```go
  type TokenKind int // TokNumber TokPlus TokMinus TokStar TokSlash TokCaret TokPercent TokSqrt TokLParen TokRParen TokEOF
  type Token struct { Kind TokenKind; Value float64; Pos int } // Pos = byte offset of first char; EOF Pos = len(input)
  func Lex(input string) ([]Token, error) // always ends with TokEOF
  ```

- [ ] **Step 1: Write the failing tests.** `TestLex` compares kinds, values and positions:
  - `"2 + 3*4"` → `Num(2)@0 Plus@2 Num(3)@4 Star@5 Num(4)@6 EOF@7`
  - `".5"` → `Num(0.5)@0`; `"1e21"` → `Num(1e21)`; `"1.5e-7"` → `Num(1.5e-7)`; `"1E+3"` → `Num(1000)`
  - `"sqrt 9"` → `Sqrt@0 Num(9)@5`; `"(-2)^2%"` → `LParen Minus Num RParen Caret Num Percent`
  - `"1.2.3"` → `Num(1.2)@0 Num(0.3)@3` (the parser rejects this, see Task 3)
  - `TestLexErrors`: `"2 & 3"` → `CodeInvalidExpression` at Position 2; `"sqr 9"` → Position 0; `"1e"` → Position 0; `"."` → Position 0.

- [ ] **Step 2: Run `go test ./internal/calc/ -run Lex`.** Expected: FAIL.

- [ ] **Step 3: Implement `Lex`.** Skip whitespace. Scan a number greedily as `digits [. digits] | . digits`, then an optional `[eE][+-]?digits` (an `e` without digits is an error at the number's start), and parse with `strconv.ParseFloat`. Treat the letters `sqrt` as one keyword. Any other character is an error at its position.

- [ ] **Step 4: Run the tests.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(backend): add expression lexer`.

### Task 3: Parser and `Evaluate`

**Files:**
- Create: `backend/internal/calc/parser.go`
- Test: `backend/internal/calc/parser_test.go`

**Interfaces:**
- Consumes: `Lex`, `Token` (Task 2); `Apply`, `Round`, error helpers (Task 1)
- Produces:
  ```go
  const MaxExpressionLength = 256
  type Result struct { Value float64; Repeat string }
  func Evaluate(expr string) (Result, error)
  ```

- [ ] **Step 1: Write the failing tests.** `TestEvaluate` (value + repeat):

  | input | value | repeat |
  |---|---|---|
  | `2 + 3 * 4` | 14 | `* 4` |
  | `5 + 5` | 10 | `+ 5` |
  | `10 + 5` | 15 | `+ 5` |
  | `2 ^ 3 ^ 2` | 512 | `^ 2` |
  | `-2^2` | -4 | `^ 2` |
  | `(-2)^2` | 4 | `^ 2` |
  | `2^-1` | 0.5 | `^ -1` |
  | `2 * -3` | -6 | `* -3` |
  | `5 - -3` | 8 | `- -3` |
  | `200 + 10%` | 220 | `+ 10%` |
  | `220 + 10%` | 242 | `+ 10%` |
  | `200 - 10%` | 180 | `- 10%` |
  | `200 * 10%` | 20 | `* 10%` |
  | `50%` | 0.5 | `` |
  | `sqrt 9 + 1` | 4 | `+ 1` |
  | `2 + sqrt 9 * 2^3` | 26 | `^ 3` |
  | `sqrt (-4)` | error `INVALID_OPERATION` | |
  | `0.1 + 0.2` | 0.3 | `+ 0.2` |
  | `1e21 + 5` | 1e21 | `+ 5` |
  | `(1 + 2) * 3` | 9 | `* 3` |
  | `42` | 42 | `` |
  | `0 * -1` | 0 (not negative zero) | `* -1` |

  `TestEvaluateErrors` (code, position):
  - `8 / 0` → `DIVISION_BY_ZERO`
  - `2 + * 3` → `INVALID_EXPRESSION` at 4
  - `1.2.3` → `INVALID_EXPRESSION` at 3
  - `(1 + 2` → `INVALID_EXPRESSION` at 6
  - `2 +` → `INVALID_EXPRESSION` at 3
  - `` → `INVALID_EXPRESSION` at 0
  - `"   "` → `INVALID_EXPRESSION` at 3
  - `strings.Repeat("1", 257)` → `EXPRESSION_TOO_LONG`
  - `1e308 * 10` → `OVERFLOW`

- [ ] **Step 2: Run `go test ./internal/calc/ -run Evaluate`.** Expected: FAIL.

- [ ] **Step 3: Implement** a recursive-descent parser over the token slice, following the grammar in spec §4.4 exactly (`unary` below `^`, `power` right-associative with a `unary` exponent, `prefix` = `sqrt`, `postfix` = `%`). Every arithmetic step goes through `Apply`, and only `Evaluate` calls `Round`. Two rules the grammar doesn't settle:
  - **Contextual `%`:** the operand parsers report whether the operand was a bare `postfix` with `%` (carry the raw `n` alongside the value). In `expr`, when the right operand of `+`/`−` is such an operand, use `left * n / 100` instead of `n / 100`.
  - **Repeat:** whenever a binary operator is parsed at paren depth 0, record `(opPos, rhsEndPos)`. After parsing, take the record with the **largest `opPos`** (not the last one recorded: `+` in `2 + 3 * 4` is recorded after `*`). Repeat = `opSymbol + " " + strings.TrimSpace(input[opPos+1 : rhsEnd])`. Empty if there's no record.
  - Leftover tokens after `expr` → `INVALID_EXPRESSION` at the leftover token's `Pos`. Unexpected tokens and EOF report their own `Pos`. Check the length before lexing.

- [ ] **Step 4: Run `go test ./internal/calc/ -cover`.** Expected: PASS, coverage ≥ 90%.

- [ ] **Step 5: Commit** `feat(backend): add recursive-descent evaluator with contextual percent and repeat`.

### Task 4: HTTP API

**Files:**
- Create: `backend/internal/api/router.go` (router + middleware), `backend/internal/api/handlers.go`, `backend/internal/api/errors.go` (code → status, JSON writers), `backend/internal/api/static.go` (SPA handler)
- Test: `backend/internal/api/handlers_test.go`, `backend/internal/api/static_test.go`
- Modify: `backend/go.mod` (`go get github.com/go-chi/chi/v5`)

**Interfaces:**
- Consumes: `calc.Evaluate`, `calc.Apply`, `calc.Round`, `calc.Error` (Tasks 1–3)
- Produces: `func NewRouter(logger *slog.Logger, staticDir string) http.Handler` (staticDir `""` = no static serving)

- [ ] **Step 1: Write the failing handler tests** with `httptest.NewRecorder` against `NewRouter(slog.New(slog.DiscardHandler), "")`. Assert status + exact JSON body:
  - `POST /api/v1/evaluate {"expression":"2 + 3 * 4"}` → 200 `{"result":14,"repeat":"* 4"}`
  - `{"expression":"42"}` → 200 `{"result":42}` (no `repeat` key)
  - `{"expression":"8 / 0"}` → 422 `{"error":{"code":"DIVISION_BY_ZERO","message":"Undefined"}}`
  - `{"expression":"2 + * 3"}` → 400 `{"error":{"code":"INVALID_EXPRESSION","message":"Invalid input","position":4}}`
  - body `not json` → 400 `INVALID_JSON`; body `{"expression":"1","extra":1}` → 400 `INVALID_JSON` (unknown fields are rejected)
  - 5000-byte body → 413 `PAYLOAD_TOO_LARGE`
  - `POST /api/v1/operations/divide {"operands":[8,2]}` → 200 `{"result":4}`
  - `POST /api/v1/operations/add {"operands":[0.1,0.2]}` → 200 `{"result":0.3}`
  - `/operations/sqrt {"operands":[-4]}` → 422 `INVALID_OPERATION`
  - `/operations/modulo {"operands":[1,2]}` → 404 `UNKNOWN_OPERATION`
  - `/operations/add {"operands":[1]}` → 400 `INVALID_OPERANDS`
  - `GET /healthz` → 200 `{"status":"ok"}`
  - `GET /api/v1/evaluate` → 405
  - Every response has `Content-Type: application/json`.

  `static_test.go`: with a `t.TempDir()` holding `index.html` ("app") and `assets/a.js`: `GET /assets/a.js` serves the file, `GET /some/route` serves `index.html`, `GET /api/v1/nope` → 404 JSON (never the SPA).

- [ ] **Step 2: Run `go test ./internal/api/`.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Status map: 400 for `INVALID_EXPRESSION`, `EXPRESSION_TOO_LONG`, `INVALID_OPERANDS` and `INVALID_JSON`; 404 for `UNKNOWN_OPERATION`; 422 for `DIVISION_BY_ZERO`, `INVALID_OPERATION` and `OVERFLOW`; 413 for `PAYLOAD_TOO_LARGE`.
  - `position` is emitted only when `Position >= 0` (`*int` with omitempty).
  - Decode with `http.MaxBytesReader(w, r.Body, 4096)` + `DisallowUnknownFields`. A `*http.MaxBytesError` maps to 413.
  - Middleware: `middleware.Recoverer` plus a small slog request logger (method, path, status, duration_ms) built on `middleware.NewWrapResponseWriter`.
  - The SPA handler serves an existing file under `staticDir`, otherwise `index.html`, and is mounted as `NotFound` only when `staticDir != ""`. Unknown `/api/` paths always return JSON 404.

- [ ] **Step 4: Run `go test ./... -cover`.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(backend): add chi REST API with JSON error envelope and SPA serving`.

### Task 5: Server entrypoint

**Files:**
- Create: `backend/cmd/server/main.go`

**Interfaces:**
- Consumes: `api.NewRouter` (Task 4)
- Produces: binary `server`. Env `PORT` (default `8080`) and `STATIC_DIR` (default empty). The flag `-healthcheck` does a GET on `http://127.0.0.1:$PORT/healthz` and exits 0 on 200, 1 otherwise (used by compose, because distroless has no curl).

- [ ] **Step 1: Implement** `main` with: `slog.NewJSONHandler(os.Stdout)`, `http.Server{ReadTimeout: 5s, WriteTimeout: 10s, IdleTimeout: 60s, ReadHeaderTimeout: 2s}`, and graceful shutdown on SIGINT/SIGTERM via `signal.NotifyContext` + `Shutdown` with a 10s timeout. No unit test: the logic is wiring, and Task 4 covers the router.
- [ ] **Step 2: Verify manually.** `cd backend && go run ./cmd/server &`, then `curl -s -XPOST localhost:8080/api/v1/evaluate -d '{"expression":"2+3*4"}'` → `{"result":14,"repeat":"* 4"}`. Then `go run ./cmd/server -healthcheck; echo $?` → `0`. Kill the server.
- [ ] **Step 3: Run `go vet ./... && go test ./...`.** Expected: clean, PASS.
- [ ] **Step 4: Commit** `feat(backend): add server entrypoint with timeouts, graceful shutdown, healthcheck flag`.

---

## Frontend

### Task 6: Scaffold, design tokens, test setup

**Files:**
- Create via `npm create vite@latest frontend -- --template react-ts`, then delete the template's demo assets/CSS/content
- Create: `frontend/src/styles/tokens.css`, `frontend/src/styles/global.css`, `frontend/src/test/setup.ts`, `frontend/src/assets/fonts/Satoshi-{Regular,Medium,Bold}.woff2`
- Modify: `frontend/vite.config.ts` (dev proxy `/api` → `http://localhost:8080`; `test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', css: { modules: { classNameStrategy: 'non-scoped' } }, coverage: { provider: 'v8', reporter: ['text', 'html', 'json-summary'], include: ['src/**'], exclude: ['src/main.tsx', 'src/**/*.test.*', 'src/test/**'] } }`), `frontend/package.json` (scripts `test`, `test:coverage`), `frontend/src/App.tsx`, `frontend/src/main.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces these token names (CSS custom properties on `:root`, overridden for dark under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and again under `:root[data-theme="dark"]`):
  `--color-surface --color-surface-card --color-text --color-text-muted --color-error --color-focus --color-key-digit --color-key-digit-text --color-key-function --color-key-function-text --color-key-operator --color-key-operator-text --color-key-equals --color-key-equals-text`, `--space-1..--space-6`, `--font-family --font-size-key --font-size-display --font-size-display-sm --font-size-expression`, `--radius-key --radius-card`, `--shadow-card --color-glow --color-hairline`, `--key-size` (min 44px; `clamp`-based, scales with viewport width).

- [ ] **Step 1: Install dev dependencies.** `npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8`. `setup.ts` imports `@testing-library/jest-dom/vitest`.
- [ ] **Step 2: Write the failing smoke test** `App.test.tsx`: `render(<App />)` and `expect(screen.getByRole('main')).toBeInTheDocument()`.
- [ ] **Step 3: Run `cd frontend && npx vitest run`.** Expected: FAIL (template App has no `main`).
- [ ] **Step 4: Implement.** Download Satoshi 400/500/700 woff2 from Fontshare (`https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700` lists the file URLs) into `frontend/src/assets/fonts/`, and declare `@font-face` with `font-display: swap` in `global.css`. Write `tokens.css` with the exact spec §5.3 color table for light and dark and `global.css` (reset, `body { background: var(--color-surface); color: var(--color-text); font-family: var(--font-family) }`, visible `:focus-visible` ring), both imported in `main.tsx`. `App` temporarily renders `<main />`, and Task 11 replaces it.
- [ ] **Step 5: Run `npx vitest run && npx tsc -b`.** Expected: PASS, no type errors.
- [ ] **Step 6: Commit** `chore(frontend): scaffold Vite React TS app with design tokens and Vitest`.

### Task 7: Expression model

**Files:**
- Create: `frontend/src/calculator/types.ts`, `frontend/src/calculator/expression.ts`
- Test: `frontend/src/calculator/expression.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Operator = '+' | '-' | '*' | '/' | '^';
  export type NumberToken = { kind: 'number'; digits: string; negative: boolean; sqrt: boolean; percent: boolean };
  export type OperatorToken = { kind: 'operator'; op: Operator };
  export type Token = NumberToken | OperatorToken;
  export function toApiExpression(tokens: Token[]): string;
  export function toDisplay(tokens: Token[]): string;
  export function numberTokenFrom(value: number): NumberToken; // result → token (negative flag, digits = String(Math.abs(value)))
  ```
  Number serialization: `(sqrt ? 'sqrt ' : '') + (negative ? '(-' + digits + ')' : digits) + (percent ? '%' : '')`. Display: `(sqrt ? '√' : '') + (negative ? '−' : '') + digits + (percent ? '%' : '')`. Tokens are joined with single spaces on the wire and with no spaces on screen. Display operator symbols: `+ − × ÷ ^`.

- [ ] **Step 1: Write the failing tests:**
  - `[2, +, 3, *, 4]` → api `"2 + 3 * 4"`, display `"2+3×4"`
  - a negative 2 with `^ 2` → api `"(-2) ^ 2"`, display `"−2^2"`
  - sqrt 9 → api `"sqrt 9"`, display `"√9"`
  - `200 + 10%` → api `"200 + 10%"`
  - `÷` → api `/`, display `÷`
  - `numberTokenFrom(-2)` → `{digits:'2', negative:true, sqrt:false, percent:false}`
  - `numberTokenFrom(1e21)` → digits `'1e+21'`
  - `toApiExpression([numberTokenFrom(1e21)])` → `"1e+21"` (the backend lexer accepts it)
- [ ] **Step 2: Run `npx vitest run src/calculator`.** Expected: FAIL.
- [ ] **Step 3: Implement** to the interfaces.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): add expression token model and serializers`.

### Task 8: Calculator reducer

**Files:**
- Create: `frontend/src/calculator/reducer.ts`
- Test: `frontend/src/calculator/reducer.test.ts`

**Interfaces:**
- Consumes: `Token`, `toApiExpression`, `toDisplay`, `numberTokenFrom` (Task 7)
- Produces:
  ```ts
  export type Action =
    | { type: 'digit'; digit: string } | { type: 'decimal' } | { type: 'operator'; op: Operator }
    | { type: 'sqrt' } | { type: 'percent' } | { type: 'negate' } | { type: 'backspace' }
    | { type: 'clear' } | { type: 'equals' }
    | { type: 'resolved'; result: number; repeat?: string } | { type: 'failed'; message: string };
  export type CalcState = {
    tokens: Token[];
    status: 'editing' | 'pending' | 'result' | 'error';
    request: string | null;   // API expression to send; set only on the transition to 'pending'
    expressionLine: string;   // small line: display of what was evaluated
    result: number | null;
    repeat: string | null;
    message: string | null;   // error text when status === 'error'
  };
  export const initialState: CalcState;
  export function reducer(state: CalcState, action: Action): CalcState;
  export function mainLine(state: CalcState): string; // big line: result, error message, or toDisplay(tokens) || '0'
  ```

- [ ] **Step 1: Write the failing tests.** Use a `press(...actions)` helper that folds the actions over `initialState`. One test per rule, with exact expectations:
  - Digits `1`, `2` → mainLine `"12"`. `.` twice in one number → `"1.2"` from `1 . . 2`. A leading `.` → digits `"0."`.
  - `2 + ×` → the operator is replaced, display `"2×"`. An operator on empty input → `"0+"`.
  - `2 + 3 × 4 =` → status `pending`, request `"2 + 3 * 4"`. Then `resolved {14, '* 4'}` → status `result`, mainLine `"14"`, expressionLine `"2+3×4"`, request `null`.
  - `=` after a result with repeat → request `"14 * 4"`. With result `-2` and repeat `^ 2` → request `"(-2) ^ 2"`.
  - `200 + 10% =`, then resolved `{220, '+ 10%'}`, then `=` → request `"220 + 10%"` (Review Focus 2).
  - After a result: digit `7` → new expression `"7"`. Operator `×` → `"14×"` (continues from the result).
  - `=` with a trailing operator (`2 +`) or on empty input → state unchanged.
  - `±` on `2` → display `"−2"`, api `"(-2)"`. `±` again → `"2"`.
  - `√` then `9` → `"√9"`. `9` then `√` → also `"√9"`. `%` on `50` → `"50%"`, after which digits are ignored.
  - `⌫`: on `12` → `"1"`. On `2+` → `"2"`. On `50%` → `"50"`. On a result → state unchanged.
  - `AC` → `initialState` from any status.
  - While `pending`: digits, operators and `=` → state unchanged (Review Focus 3). `AC` still clears.
  - `failed {message:'Undefined'}` → status `error`, mainLine `"Undefined"`. The next `digit 5` → `"5"`, editing. The next `operator +` after an error → `"0+"`.
  - Max length: digits that would push `toApiExpression` past 256 characters are ignored.
- [ ] **Step 2: Run `npx vitest run src/calculator/reducer`.** Expected: FAIL.
- [ ] **Step 3: Implement** `reducer` as a pure switch. No arithmetic, no fetch. For `resolved`/`failed`, ignore the action unless the status is `pending` (a late response after `AC` is dropped).
- [ ] **Step 4: Run the tests with coverage.** Expected: PASS, and `reducer.ts` near 100%.
- [ ] **Step 5: Commit** `feat(frontend): add pure calculator reducer`.

### Task 9: API client, keyboard mapping, `useCalculator` hook

**Files:**
- Create: `frontend/src/api/client.ts`, `frontend/src/calculator/keyboard.ts`, `frontend/src/calculator/useCalculator.ts`
- Test: `frontend/src/api/client.test.ts`, `frontend/src/calculator/keyboard.test.ts`, `frontend/src/calculator/useCalculator.test.ts`

**Interfaces:**
- Consumes: `reducer`, `initialState`, `Action`, `CalcState` (Task 8)
- Produces:
  ```ts
  // client.ts
  export type EvaluateResult = { result: number; repeat?: string };
  export class ApiError extends Error { constructor(public code: string, message: string, public position?: number) }
  export function evaluate(expression: string, fetchFn?: typeof fetch): Promise<EvaluateResult>; // POST /api/v1/evaluate
  // keyboard.ts
  export function keyToAction(key: string): Action | null;
  // useCalculator.ts
  export function useCalculator(evaluateFn?: typeof evaluate): { state: CalcState; dispatch: (a: Action) => void };
  ```

- [ ] **Step 1: Write the failing tests.**
  - **client:** a 200 JSON response → resolves `{result: 14, repeat: '* 4'}`, sent as POST with JSON body `{"expression":"2 + 3 * 4"}`. A 422 envelope → rejects `ApiError('DIVISION_BY_ZERO', 'Undefined')`. `fetch` throwing → `ApiError('NETWORK_ERROR', "Can't reach server")`. A 502 with an HTML body → `ApiError('NETWORK_ERROR', "Can't reach server")` (Review Focus 5).
  - **keyboard:** `'7'` → digit 7. `'.'` and `','` → decimal. `'+'` `'-'` `'*'` `'/'` `'^'` → operators. `'%'` → percent. `'Enter'` and `'='` → equals. `'Backspace'` → backspace. `'Escape'` → clear. `'r'` → sqrt. `'n'` → negate. `'a'` → `null`.
  - **useCalculator** (`renderHook`, mocked `evaluateFn`): dispatching `2 + 3 =` calls `evaluateFn('2 + 3')` exactly once and ends in `result` 5. A rejected `ApiError` ends in `error` with its message. Dispatching `=` twice while pending calls `evaluateFn` once.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** The hook uses `useReducer`, plus a `useEffect` keyed on `state.request` that calls `evaluateFn` and dispatches `resolved`/`failed`. Any non-`ApiError` failure maps to `"Can't reach server"`.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): add API client, keyboard mapping and useCalculator hook`.

### Task 10: Atoms and molecules

**Files:**
- Create: `frontend/src/components/atoms/Key/Key.tsx` + `Key.module.css`, `atoms/DisplayLine/DisplayLine.tsx` + css, `atoms/ThemeToggle/ThemeToggle.tsx` + css, `molecules/Display/Display.tsx` + css (one folder per component, each with its own `index.ts` re-export)
- Test: `Key.test.tsx`, `ThemeToggle.test.tsx`, `Display.test.tsx` next to each component

**Interfaces:**
- Produces:
  ```ts
  type KeyVariant = 'digit' | 'function' | 'operator' | 'equals';
  Key(props: { label: string; ariaLabel?: string; variant: KeyVariant; onPress: () => void; className?: string })
  DisplayLine(props: { text: string; variant: 'expression' | 'result' | 'error' })
  ThemeToggle() // reads/writes localStorage 'theme' ('light'|'dark') in try/catch; sets document.documentElement.dataset.theme; initial = stored ?? OS preference
  Display(props: { expression: string; value: string; isError: boolean }) // value line is aria-live="polite"; adds class `long` when value.length > 9
  ```

- [ ] **Step 1: Write the failing tests.**
  - **Key:** renders a `button` with the accessible name `ariaLabel ?? label`. A click calls `onPress` once. It has the class `equals` for that variant.
  - **ThemeToggle:** a click sets `document.documentElement.dataset.theme` to `'dark'` and stores it. A second click → `'light'`. With `localStorage.setItem` throwing, it still toggles.
  - **Display:** shows both lines. The value line has `aria-live="polite"`. `isError` gives the error variant. `"0.333333333333333"` gets the class `long`.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement** using tokens only. The `Key` variants map to the `--color-key-*` tokens, keys are circular at `--key-size`, and a pressed state scales slightly. `Display` aligns right, and `long` switches to `--font-size-display-sm`.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): add Key, DisplayLine, ThemeToggle atoms and Display molecule`.

### Task 11: Organisms, template, page, app wiring

**Files:**
- Create: `frontend/src/components/organisms/Keypad/` (Keypad.tsx + css), `organisms/Calculator/` (Calculator.tsx + css), `templates/CenteredLayout/`, `pages/CalculatorPage/`
- Modify: `frontend/src/App.tsx` (render `<CalculatorPage />`), `frontend/src/App.test.tsx`
- Test: `Keypad.test.tsx`, `Calculator.test.tsx`

**Interfaces:**
- Consumes: `Key`, `Display`, `ThemeToggle` (Task 10); `useCalculator`, `keyToAction`, `mainLine` (Tasks 8–9); `evaluate` (Task 9)
- Produces:
  ```ts
  Keypad(props: { onAction: (a: Action) => void })
  Calculator(props: { evaluateFn?: typeof evaluate })   // owns useCalculator + window keydown listener
  CenteredLayout(props: { children: ReactNode })          // <main>: full-bleed on phones, centered card ≥ 480px
  CalculatorPage()
  ```
  The keypad order and variants are exactly spec §3.1. A 4-column CSS grid, `=` spans 2 rows and `0` spans 2 columns. ARIA labels: `AC` "clear", `⌫` "backspace", `±` "toggle sign", `÷` "divide", `xʸ` "power", `√` "square root", `%` "percent", `×` "multiply", `−` "subtract", `+` "add", `=` "equals", `.` "decimal point".

- [ ] **Step 1: Write the failing tests** (`Calculator` with a mocked `evaluateFn`, using user-event):
  - Clicking `2 + 3 × 4 =` calls `evaluateFn('2 + 3 * 4')`, and the display then shows `14` with expression `2+3×4`.
  - Typing `5+5` then `{Enter}` on the keyboard shows `10`. A second `{Enter}` calls `evaluateFn('10 + 5')`.
  - A mocked rejection `ApiError('DIVISION_BY_ZERO','Undefined')` → the display shows `Undefined`.
  - **Review Focus 4:** focus the `7` button, press `{Enter}` with `2+3` already entered → `evaluateFn` is called once with `'2 + 3'`, and no `7` is appended. The keydown handler calls `preventDefault()` for mapped keys.
  - **Review Focus 3:** `evaluateFn` returns a never-resolving promise, and clicking `=` twice → called once.
  - **Keypad:** renders 22 buttons in spec order (snapshot of the accessible names).
  - **App:** the smoke test still finds `main`.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** The `Calculator` card applies spec §5.3's patterns: a soft purple shadow in light; in dark, a radial `--color-glow` behind the display plus a 1px `#8333d4` gradient hairline on top, both via pseudo-elements with `pointer-events: none`. `Calculator` attaches the `keydown` listener on `window` in an effect and cleans it up. It ignores events with `ctrl`/`meta`/`alt` held.
- [ ] **Step 4: Run `npx vitest run && npx tsc -b && npm run build`.** Expected: all PASS, build OK.
- [ ] **Step 5: Verify in a browser.** Run `go run ./cmd/server` in `backend/` and `npm run dev` in `frontend/`, then check `2+3×4=14`, `8÷0` → `Undefined`, both themes, and a 375px-wide viewport with no horizontal scroll.
- [ ] **Step 6: Commit** `feat(frontend): assemble Keypad and Calculator organisms with keyboard support`.

---

## Delivery

### Task 12: Docker, compose, Makefile

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `Makefile`

**Interfaces:**
- Consumes: the `server` binary + `STATIC_DIR` + `-healthcheck` (Task 5), and `frontend/dist` (Task 11)

- [ ] **Step 1: Write the `Dockerfile`.** Stage `web`: `node:26-alpine`, `npm ci`, `npm run build`. Stage `api`: `golang:1.27-alpine`, `CGO_ENABLED=0 go build -o /server ./cmd/server`. Final: `gcr.io/distroless/static-debian12:nonroot`, copying `/server` and `/web` (dist), with `ENV STATIC_DIR=/web PORT=8080`, `EXPOSE 8080` and `ENTRYPOINT ["/server"]`. `.dockerignore`: `node_modules`, `dist`, `.git`, `.superpowers`, `.remember`, `docs/coverage`.
- [ ] **Step 2: Write `docker-compose.yml`.** One service, `calculator`: `build: .`, ports `8080:8080`, and healthcheck `["CMD", "/server", "-healthcheck"]` (interval 10s).
- [ ] **Step 3: Write the `Makefile` targets.**
  - `test`: backend `go test ./...` + frontend `npm test -- --run`
  - `coverage`: writes `docs/coverage/backend/coverage.html` + `coverage.txt` (`go tool cover -func`) and `docs/coverage/frontend/` (the vitest html + `coverage-summary.json`)
  - `dev-backend`, `dev-frontend`, `docker` (`docker compose up --build`)
- [ ] **Step 4: Verify.** `docker compose up --build -d`, then `curl -s localhost:8080/healthz` → `{"status":"ok"}`, `curl -s localhost:8080/` returns the HTML, and the evaluate curl from Task 5 works. `docker compose ps` shows `healthy`. Then `docker compose down`.
- [ ] **Step 5: Commit** `build: add multi-stage Dockerfile, compose wrapper and Makefile`.

### Task 13: OpenAPI contract

**Files:**
- Create: `openapi.yaml` (OpenAPI 3.1)

- [ ] **Step 1: Write `openapi.yaml`** documenting `POST /api/v1/evaluate`, `POST /api/v1/operations/{op}` (enum: `add subtract multiply divide power sqrt percent`) and `GET /healthz`, with request/response schemas, the error envelope (`position` optional), every status from Task 4 and one example per error code.
- [ ] **Step 2: Validate** with `npx @redocly/cli lint openapi.yaml`. Expected: no errors. Don't add redocly to `package.json`.
- [ ] **Step 3: Commit** `docs: add OpenAPI contract`.

### Task 14: Coverage reports and README

**Files:**
- Create: `README.md`, `docs/coverage/**` (generated)

- [ ] **Step 1: Run `make coverage`.** Expected: `internal/calc` ≥ 90%, and reports written under `docs/coverage/`.
- [ ] **Step 2: Write `README.md`** with these sections:
  1. What it is, with a screenshot (`docs/screenshot-light.png`, `docs/screenshot-dark.png`, taken from the running app).
  2. Quick start (`docker compose up --build` → http://localhost:8080).
  3. Local development (Go 1.27, Node 26, `make dev-backend` / `make dev-frontend`).
  4. Tests and coverage (`make test`, `make coverage`, a summary table with the real numbers, links to the HTML reports).
  5. API with `curl` examples for evaluate, an operation, and two error cases, linking to `openapi.yaml`.
  6. Design decisions: a condensed spec §8 table plus the float64/rounding trade-off and the "why math lives in Go" paragraph.
  7. Project structure: the tree for the backend layers and frontend atomic folders.
  8. How this was built: brief → brainstorming + grilling → spec → plan → TDD tasks → review, linking `docs/brief.md`, the spec, this plan and `git log --oneline`.
  9. Out of scope / next steps: scientific mode, and what the grammar and op table already support.
- [ ] **Step 3: Verify.** Every command in the README runs as written from a clean checkout (fresh clone into a temp dir, then `make test`).
- [ ] **Step 4: Commit** `docs: add README and coverage reports`.

### Task 15: Final review

- [ ] **Step 1:** Run a whole-branch code review (superpowers:requesting-code-review) against the spec and this plan.
- [ ] **Step 2:** Fix each accepted finding in its own commit (`fix: …` / `refactor: …`), re-running `make test` each time.
- [ ] **Step 3:** Regenerate coverage if the code changed, update the README numbers, and commit `docs: refresh coverage after review`.
