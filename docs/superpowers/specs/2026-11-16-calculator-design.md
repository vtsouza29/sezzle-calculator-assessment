# Calculator: Design

**Date:** 2026-11-16
**Status:** Approved for planning
**Inputs:** Sezzle take-home brief ([`docs/brief.md`](../../brief.md)); brainstorming session (product shape, UI); grilling session (backend)

## 1. Intent

A full-stack calculator: a Go REST service that does all the math, and a React + TypeScript frontend that looks and behaves like the stock calculator apps on phones and desktops.

The calculator is the vehicle. What the reviewer should remember is **the journey**: a visible, disciplined AI-assisted workflow, spec, then grilling, then plan, then test-first implementation, then review. They should be able to follow it through the documents in `docs/` and the commit history. Only the documents produced are committed, not the prompts or transcripts.

### Goals

- Meet every functional and non-functional requirement in the brief, including the optional ones: power, square root, percentage, Docker.
- Clean, idiomatic, testable code in both layers. Unit tests on the key logic, with coverage reports.
- A repo that tells the story of how it was built: specs, plans, small commits and a README with the design rationale.

### Non-goals (v1)

- Scientific mode (trig, logs, memory keys, paren keys on the keypad). This is the next possible step after v1. The design leaves room for it (operation table, parser grammar), but none of it is built.
- Auth, persistence, history, metrics, multi-user anything.
- Committing prompts or conversation transcripts.

### Anti-goals (a failure even if it works)

- Over-engineering: hexagonal layers, interfaces with one implementation, frameworks a calculator doesn't need.
- Math logic split across two languages. The frontend never computes results.
- A UI library or Tailwind standing in for the design system. The design system must be visibly ours.
- A look that is a copy of any specific vendor's calculator. The *format* is familiar, but the visual identity is our own.

## 2. Repository layout

```
backend/                 Go service (own go.mod)
frontend/                Vite + React + TypeScript app
docs/
  superpowers/specs/     design docs (this file)
  superpowers/plans/     implementation plans
  coverage/              committed coverage reports (backend + frontend)
openapi.yaml             hand-written API contract
Dockerfile               multi-stage: frontend build + Go build → one image
docker-compose.yml       one service wrapping the image
Makefile                 dev / test / coverage / docker shortcuts
README.md                setup, API examples, design decisions, workflow
```

*Builder's call:* exact Makefile target names, and whether `openapi.yaml` lives at the root or in `backend/`.

## 3. Product behavior

### 3.1 Layout (decided, see mockup history)

Single six-row keypad, always fully visible:

```
AC   ⌫    ±    ÷
xʸ   √    %    ×
7    8    9    −
4    5    6    +
1    2    3    =   (= spans two rows)
0 (wide)  .
```

- Digit keys are neutral. Function keys (`AC ⌫ ± xʸ √ %`) use a secondary neutral. Operator keys (`÷ × − +`) use a soft teal tint. **`=` is solid orange**, so it contrasts with the teal operators and is the one "do it" key.
- The display shows two lines: the expression being typed (small, muted) and the result or current entry (large).
- Mobile-first. On a phone, the calculator fills the viewport. On wider screens, it's a centered card. Keys are round, thumb-sized and at least 44×44 px.

### 3.2 Math rules

Standard order of operations: `2 + 3 × 4 = 14`. Precedence from high to low:

1. parentheses
2. `√` (prefix)
3. `%` (postfix)
4. `^` (right-associative, so `2^3^2 = 2^9`)
5. unary minus
6. `× ÷`
7. `+ −`

Under math rules `-2^2 = -4`, and `±` sends `(-2)` so that `± 2 xʸ 2 = 4`. An exponent may itself be negative: `2^-1 = 0.5`.

### 3.3 Key behavior

| Key | Behavior |
|---|---|
| Digits, `.` | Append to the current number. A second `.` in the same number is ignored. |
| `+ − × ÷ xʸ` | Append a binary operator. Pressing an operator right after another operator replaces it. An operator on an empty expression starts from `0`. |
| `=` | Send the expression to the backend and show the result. The expression line keeps what was evaluated. |
| `=` again | Repeat the last operation: `5 + 5 = 10`, `=` gives `15`, `=` gives `20`. The backend returns the `repeat` fragment (§4.3), and the frontend sends `"<result> <repeat>"`. |
| `AC` | Clear everything. |
| `⌫` | Delete the last typed character/token. |
| `±` | Toggle the sign of the current number, sent as `(-n)` so `± 2 xʸ 2 = 4`. |
| `√` | Prefix square root on the current/next number. Shown as `√9`, sent as `sqrt 9`. |
| `%` | Postfix on the current number. On its own it divides by 100 (`50% = 0.5`). Directly right of `+` or `−`, it is a percentage of the left side (`200 + 10% = 220`, `200 − 10% = 180`). Everywhere else (`×`, `÷`, `^`) it divides by 100 (`200 × 10% = 20`). |

After a result:
- Typing a digit starts a new expression.
- Typing an operator continues from the result (`10` then `× 2`).

*My call:* this is the standard phone behavior.

A result carried into the next expression (whether for repeated `=` or for continuing with an operator) is always sent as a number literal. A negative result is wrapped in parentheses: a result of `-2` with repeat `^ 2` is sent as `(-2) ^ 2 = 4`, not `-2 ^ 2 = -4`.

On an error:
- The display shows the error text in the error color instead of a result.
- The next key press clears the error and is then applied to an empty state.

**Error text shown in the display:**

| Situation | Display |
|---|---|
| Division by zero (including `0^-1`) | `Undefined` (user decision) |
| √ of a negative, negative base with fractional exponent | `Invalid input` |
| Result overflows `float64` | `Overflow` |
| Malformed expression | `Invalid input` |
| Network or server failure | `Can't reach server` |

*My call:* the backend's `message` field carries exactly these display strings (except the network one, which is frontend-only), so the frontend shows `message` as it comes.

### 3.4 Physical keyboard (decided)

Digits, `.` (and `,`), `+ - * / ^ %`, `Enter`/`=` for equals, `Backspace` for ⌫, `Escape` for AC. *My call:* `r` for √ and `n` for ± are nice-to-haves the builder may skip.

### 3.5 Frontend input validation

The frontend prevents obviously invalid sequences (double operators, double decimal points, more than 256 characters), so most bad input never reaches the network. The backend still validates everything. The frontend is a convenience, not the trust boundary.

## 4. Backend

### 4.1 Stack and layout

- Go 1.27, **chi** router (user decision over stdlib), `log/slog` for logs, standard `testing` + `httptest` for tests (no testify).

```
backend/
  cmd/server/main.go        config (PORT env, default 8080), wiring, graceful shutdown, static file serving
  internal/calc/            pure math, no HTTP imports
    operations.go           operation table: name → arity + func
    lexer.go                string → tokens (with positions)
    parser.go               recursive descent → result (+ repeat fragment)
    errors.go               typed errors carrying a code + display message
  internal/api/             chi router, handlers, JSON encode/decode, error → HTTP mapping
```

### 4.2 Numbers

- Numbers are `float64`. Every result is rounded to **15 significant digits** before it is returned, so `0.1 + 0.2` returns `0.3`.
- Results that are `±Inf` become `OVERFLOW`, and `NaN` becomes `INVALID_OPERATION`. Neither is ever serialized.
- The README explains this trade-off (exact decimals vs. supporting `√` and fractional powers).

### 4.3 API

All bodies are JSON. Base path `/api/v1`.

**`POST /api/v1/evaluate`** (what the UI uses)

```json
// request
{ "expression": "2 + 3 * 4" }
// 200
{ "result": 14, "repeat": "* 4" }
```

- `repeat` is the last top-level binary operator in the expression plus its right-hand operand, as source text (`"5 + 5"` gives `"+ 5"`, `"200 + 10%"` gives `"+ 10%"`). It is omitted when the expression has no binary operator.
- *My call:* "top-level" means outside parentheses. The precise rule for nested cases is the builder's call, as long as the simple keypad cases above hold.

**`POST /api/v1/operations/{op}`** (single operations, to match the brief)

```json
// POST /api/v1/operations/divide
{ "operands": [8, 2] }
// 200
{ "result": 4 }
```

- Operations: `add subtract multiply divide power` (arity 2), `sqrt percent` (arity 1, `percent` = x/100).
- Both endpoints use the same operation table. A future scientific op is one table entry.

**`GET /healthz`** returns `{"status":"ok"}`.

**Errors** always have this shape:

```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "Undefined" } }
```

| Code | HTTP | When |
|---|---|---|
| `INVALID_JSON` | 400 | Body isn't valid JSON / wrong shape |
| `INVALID_EXPRESSION` | 400 | Parse error. Also returns `"position": n` (0-based character index) inside `error` |
| `EXPRESSION_TOO_LONG` | 400 | More than 256 characters |
| `INVALID_OPERANDS` | 400 | Wrong operand count for the op |
| `UNKNOWN_OPERATION` | 404 | `{op}` not in the table |
| `DIVISION_BY_ZERO` | 422 | `x/0`, `0^negative` |
| `INVALID_OPERATION` | 422 | `√` of a negative, negative base ^ fractional exponent, any NaN |
| `OVERFLOW` | 422 | Result is ±Inf |
| `PAYLOAD_TOO_LARGE` | 413 | Body over 4 KB |

*My call:* the codes and statuses above. 413 and `INVALID_JSON` were implied by the body limit and JSON input rather than discussed.

### 4.4 Expression grammar

```
expr    := term (('+' | '-') term)*
term    := unary (('*' | '/') unary)*
unary   := '-' unary | power               // below ^, so -2^2 = -(2^2) = -4
power   := prefix ('^' unary)?             // right-associative; exponent may be negative (2^-1)
prefix  := 'sqrt' prefix | postfix         // negative radicand must be parenthesized: sqrt (-4)
postfix := primary '%'?
primary := number | '(' expr ')'
number  := digits ['.' digits] | '.' digits, with optional exponent [eE][+-]?digits
```

- Whitespace is ignored. Accepted numbers include `12`, `0.5`, `.5`, `1e21` and `1.5e-7` (results like `1e+21` must round-trip through repeated `=`).
- The contextual `%` rule is applied in `expr`. When a `+`/`−` right operand is a `postfix` with `%`, the operand becomes `left × n / 100`. Anywhere else, `n%` is `n / 100`.
- Parentheses exist in the grammar for `±` (`(-2)`) and as groundwork for scientific mode. The v1 keypad has no paren keys.
- Each operator evaluation goes through the operation table, so division by zero and similar errors are detected in one place.

### 4.5 Operational concerns

- chi middleware: request logging through `slog` (method, path, status, duration), panic recovery.
- `http.Server` read/write/idle timeouts. The body is capped at 4 KB with `http.MaxBytesReader`. The expression length is capped at 256.
- Graceful shutdown on SIGINT/SIGTERM.
- In production, the same binary serves the built frontend at `/` (SPA fallback to `index.html`), so the API and UI share an origin and no CORS is needed. In development, Vite's proxy forwards `/api` to `localhost:8080`.
- *My call:* the frontend build directory is passed by flag or env (e.g. `STATIC_DIR`), not `go:embed`, so the backend builds and tests without the frontend.

## 5. Frontend

### 5.1 Stack

Vite + React + TypeScript (strict). Plain CSS Modules on top of design-token CSS custom properties. No UI library, no Tailwind, no state library. Vitest + React Testing Library + `@vitest/coverage-v8`. *These are my calls; they weren't discussed.*

### 5.2 Atomic design structure (decided)

```
frontend/src/
  styles/tokens.css         design tokens: light + dark
  styles/global.css         reset, base typography, uses tokens only
  components/
    atoms/                  Key (button), DisplayLine, ThemeToggle
    molecules/              Display (expression + result lines)
    organisms/              Keypad, Calculator
    templates/              CenteredLayout (phone full-bleed / desktop card)
    pages/                  CalculatorPage
  calculator/
    reducer.ts              pure state machine: key events → state (expression tokens, result, error, repeat)
    expression.ts           tokens → display string and → API string (× → *, √ → sqrt, ± → (-n))
    keyboard.ts             KeyboardEvent → key event mapping
  api/client.ts             fetch wrapper: evaluate(expression) → result | typed error
  App.tsx, main.tsx
```

- Atoms are presentational and use only tokens, never raw color or spacing values.
- All behavior from §3.3 lives in `reducer.ts` as a pure function, so it can be unit-tested without rendering. The reducer never does arithmetic. It only builds the expression and holds the state the backend returns.
- Network calls happen outside the reducer, through a small hook or effect that dispatches result/error actions.

### 5.3 Design system (decided: minimal, with dark mode)

- **Tokens** (CSS custom properties on `:root`): color (surface, key-digit, key-function, key-operator, key-equals, text, text-muted, error, focus ring), spacing scale, type scale (display large/small, key), radius (key, card), shadow.
- **Themes:** the light values on `:root`, and the dark values when `prefers-color-scheme: dark` applies or `[data-theme="dark"]` is set. A manual toggle overrides the OS setting and is saved to `localStorage` (wrapped in try/catch).
- **Accent:** the operator tint is teal, and `=` is solid orange. The text on each must meet WCAG AA (the mockup used `#d9480f` with white, about 4.6:1). Exact hex values are the builder's call within that rule.

### 5.4 Responsiveness and accessibility

- Mobile-first. The keypad grid scales with the viewport width, and the result text shrinks to fit long numbers instead of overflowing.
- Keys are real `<button>`s with `aria-label`s ("divide", "square root", "toggle sign"). The result line is an `aria-live="polite"` region. Focus is visible.

## 6. Testing and coverage

- **Backend:** table-driven tests for the lexer, parser (precedence, associativity, unary, `%` rules, e-notation, parens, errors with positions), operations (every error code) and rounding. `httptest` tests for each endpoint, status code and error mapping. The target is high coverage of `internal/calc`. *My call:* aim for ≥90% there, without chasing coverage in `main.go`.
- **Frontend:** reducer unit tests covering every row of §3.3 and the after-result and error rules. `expression.ts` mapping tests. API client tests with a mocked `fetch`. RTL tests for Calculator (click and keyboard flows with a mocked client) and the theme toggle.
- **Reports:** `go test -coverprofile` + `go tool cover -html` and `vitest --coverage`, with the results committed under `docs/coverage/` and the summary numbers quoted in the README.

## 7. Workflow (part of the deliverable)

1. **Spec:** this document.
2. **Plan:** `docs/superpowers/plans/2026-11-16-calculator.md`, written from this spec, with small test-first tasks.
3. **Implementation:** TDD, one plan task per small commit, Conventional Commit messages.
4. **Review:** a code-review pass at the end, with the findings and fixes in their own commits.
5. **README:** setup (local + Docker), API examples (`curl`), design decisions (summarizing §4 and §5 with the reasons), a "How this was built" section that walks through the workflow and links to these docs, and the coverage summary.

## 8. Decision log

| Decision | Chosen | Alternatives considered | Why |
|---|---|---|---|
| Where math lives | Backend: `/evaluate` + `/operations/{op}` | Backend expression only; frontend precedence + single-op calls | One language owns the math. Single-op endpoints match the brief and come almost free from the op table. |
| HTTP library | chi | stdlib `net/http`; Gin/Echo | User preference. Small, works with net/http, and has middleware built in. |
| Numbers | `float64`, rounded to 15 sig. digits | `shopspring/decimal`; `math/big.Float` | `√` and fractional `^` need floats anyway. Rounding hides binary artifacts the way pocket calculators do. |
| Error format | `{error:{code,message}}` | RFC 9457; flat string | Machine-readable code for tests, display-ready message for the UI. |
| Wire format | Plain ASCII expression string | Token array; Unicode display symbols | Easy to curl and log. The backend owns tokenizing. |
| Parser | Hand-written recursive descent | Shunting-yard; expr-lang | Contextual `%` and precise errors aren't possible with a library. The grammar extends cleanly for scientific mode. |
| Repeated `=` | Backend returns `repeat` | Frontend tracks it; server session | The frontend never parses, and the API stays stateless. |
| Op endpoints | `POST /operations/{op}` + operands array | Route per op; GET with query | One route, and new ops are table entries. |
| Negatives | `±` sends `(-n)`, grammar has parens | Unary minus binds tightest; strict math | Math rules stay intact, and `±` does what the user expects. |
| Input syntax | Decimals + e-notation, 256 char cap | Plain decimals only | Large results must round-trip through repeated `=`. |
| Backend layout | `cmd/` + `internal/calc` + `internal/api` | Flat package; hexagonal | Pure math is testable without HTTP, with no extra ceremony. |
| Testing | stdlib only | testify; fuzzing | No dependencies, idiomatic. |
| Deployment | One multi-stage image + compose wrapper | Two services with nginx; both | Same origin, one image, and `docker compose up` stays the one-liner. |
| Keypad | One six-row pad | Basic pad + collapsible fx row | Simplest to build and test, and it fits a phone. |
| Division by zero display | `Undefined` | "Can't divide by zero" | User decision. |
