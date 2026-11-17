# Quality Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the seven findings of the post-build code-quality review: restructure so whole concepts disappear (backend repeat bookkeeping, flat reducer state, focus sniffing, multiple error writers), without changing what a keypad user sees, except for the two behavior changes the user approved (listed below).

**Architecture:** Repeated `=` moves entirely into the frontend, which already holds the expression as tokens. The reducer state becomes a union keyed on status, with a pure token editor. The backend `calc` package exposes `Evaluate`/`Operate` returning one `Result` shape, and `api` writes every failure through one `writeError`.

**Tech Stack:** unchanged (Go 1.27 + chi; React + TS + Vitest).

**Spec:** `docs/superpowers/specs/2026-11-16-calculator-design.md` (updated in Task 5 for the two approved decision changes). Review findings source: the "Thermo-nuclear code quality review" in the session; each task cites its finding number.

## Global Constraints

- Everything in the original plan's Global Constraints still holds (`docs/superpowers/plans/2026-11-16-calculator.md`).
- **User-approved behavior changes (the only ones allowed):**
  1. The API no longer returns `repeat`; repeated `=` is computed client-side from tokens. UI behavior is identical: `5 + 5 =` → 10, `=` → 15; `2 + 3 × 4 =` repeats `× 4`; `200 + 10% =` → 220, `=` → `220 + 10%` → 242; a negative result is sent as `(-n)`.
  2. Mouse clicks no longer move focus to buttons. Enter/Space on a *keyboard-focused* button is native activation (tab to `7` + Enter types 7; tab to the theme toggle + Enter toggles). Every other key, and Enter when no button is focused, goes to the calculator. This replaces Review Focus 4 and resolves the "click toggle then Enter toggles theme" residual.
- Every other observable behavior stays the same; existing tests that encode it must keep passing (adjusted only for the two changes above or for renamed internals).
- Commits: Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Repeat parity:** every repeat case the backend used to pin (`* 4`, `+ 10%`, `- (-3)`, `+ sqrt 9`, `^ 2`) produces the same request string from client tokens. Tests in Task 1.
2. **No invalid state combinations:** TypeScript must reject a `result` state without `result`, a `pending` state without `request`. Enforced by types in Task 1.
3. **Unknown operation via HTTP still 404, wrong arity still 400, division by zero still 422 "Undefined"** after `Operate`. Tests in Tasks 2–3.
4. **Keyboard after mouse:** click the theme toggle, then type `2+2` Enter → 4. Test in Task 4.
5. **No dead code left behind:** no remaining `repeat` reads in backend/client, no `data-keypad`, no `writeCodeErr`/`writeCalcErr`. Grep check in Task 5.

---

### Task 1: Reducer union state + client-side repeat (findings 1-frontend, 2)

**Files:**
- Modify: `frontend/src/calculator/reducer.ts`, `frontend/src/calculator/reducer.test.ts`, `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`, `frontend/src/calculator/useCalculator.ts` (+ test if the `resolved` action shape changes), `frontend/src/components/organisms/Calculator/Calculator.tsx` (reads `state.expressionLine` — must work with the union)

**Interfaces:**
- Produces:
  ```ts
  export type CalcState =
    | { status: 'editing'; tokens: Token[] }
    | { status: 'pending'; tokens: Token[]; request: string; expressionLine: string; repeat: Token[] | null }
    | { status: 'result'; result: number; repeat: Token[] | null; expressionLine: string }
    | { status: 'error'; message: string; expressionLine: string };
  export type Action = /* same as today, except */ { type: 'resolved'; result: number } /* no repeat */;
  export const initialState: CalcState;            // { status: 'editing', tokens: [] }
  export function reducer(state: CalcState, action: Action): CalcState;
  export function mainLine(s: CalcState): string;
  export function expressionLine(s: CalcState): string; // '' for editing
  // internal (export for tests if useful): startTokens(state, action): Token[]; editTokens(tokens, action): Token[]
  ```
  `EvaluateResult` becomes `{ result: number }`; the client ignores any `repeat` field.

- [ ] **Step 1:** Adjust `reducer.test.ts` to the new shape (tests read state via `status`, `mainLine`, `expressionLine`; no `state.repeat` string). Add repeat-parity tests (Review Focus 1): after `resolved`, `=` sends exactly: `2 + 3 * 4` → `14 * 4`; `200 + 10%` → `220 + 10%`; `5 - (-3)` (5 − ±3) → `8 - (-3)`; `220 + sqrt 9`-style (`+ √9`) → `<r> + sqrt 9`; `2 ^ 2` with result −… → `(-n) ^ 2`; no operator (`42 =`) → `=` again is a no-op. Expression line after repeat uses display form (`14×4`, `220+√9`, `−2^2`).
- [ ] **Step 2:** Run `cd frontend && npx vitest run src/calculator` → FAIL.
- [ ] **Step 3:** Implement. Reducer = short dispatch on status: `clear` → initial; `pending` handles `resolved`/`failed` only; `result` + `equals` → repeat request from `[numberTokenFrom(result), ...repeat]` (no-op when `repeat` null); `result` + `backspace` → no-op; `equals` (editing) → pending with `repeat = tokens.slice(lastOperatorIndex)` or null; everything else → `{ status: 'editing', tokens: editTokens(startTokens(state, action), action) }` where `startTokens` = error → `[]`, result → digit/decimal ? `[]` : `[numberTokenFrom(result)]`, editing → tokens. `editTokens` is pure over tokens, applies the 256-char cap once, and uses `cur = num ?? blank()` + `setCurrent(tokens, t | null)` instead of `withNumber(f(n|null))`. Delete `wrap` and `repeatDisplay`. Error state keeps the evaluated `expressionLine`. Late `resolved`/`failed` outside `pending` are still ignored.
- [ ] **Step 4:** Run `npx vitest run && npx tsc -b` → PASS, pristine.
- [ ] **Step 5:** Commit `refactor(frontend): model calculator state as a status union and keep repeat as tokens`.

### Task 2: `calc` package — repeat removal, `Operate`, smaller surface (findings 1-backend, 5, 6)

**Files:**
- Modify: `backend/internal/calc/parser.go`, `operations.go`, `parser_test.go`, `operations_test.go`
- Modify (compile fix only): `backend/internal/api/handlers.go` — call `calc.Operate`; stop writing `repeat`

**Interfaces:**
- Produces:
  ```go
  type Result struct{ Value float64 }            // Repeat removed
  func Evaluate(expr string) (Result, error)     // unchanged otherwise
  func Operate(name string, args ...float64) (Result, error) // apply + finite check + round
  // unexported: apply, operations, round, finite(v float64) (float64, error), binaryOp map[TokenKind]string
  ```

- [ ] **Step 1:** Update tests: drop repeat expectations from `TestEvaluate` (keep every value/error row); rename `TestApply` → `TestOperate` asserting rounded `Result.Value` and the same error codes (unknown op, arity, divide by zero, 0^-1, negative base fractional exponent, sqrt negative, overflow); `TestRound` → internal `round`. Run → FAIL.
- [ ] **Step 2:** Implement: delete `depth`, `repOp`, `repEnd`, `hasRepOp`, `record()` and its call sites, and the repeat slice in `Evaluate`; `binaryOp` table replaces the add/subtract and multiply/divide name branches; one `finite()` used by `apply` and `Evaluate`; remove the dead `left.pct = false` in `expr` (keep `term`'s); unexport `Apply`/`Operations`/`Round`.
- [ ] **Step 3:** `cd backend && go vet ./... && go test ./... -cover` → PASS, calc ≥ 90%.
- [ ] **Step 4:** Commit `refactor(backend): drop repeat from the evaluator and expose Operate`.

### Task 3: `api` error layer + response shape + OpenAPI (findings 4, 1-api)

**Files:**
- Modify: `backend/internal/api/errors.go`, `handlers.go`, `router.go`, `static.go`, `handlers_test.go`, `errors_test.go`, `openapi.yaml`

**Interfaces:**
- Produces: `func writeError(w http.ResponseWriter, err error)` — the only error writer. API-level failures are package-level sentinel `*calc.Error` values or an api-local error type (implementer's choice, but transport codes must NOT be declared as `calc.Code` constants inside `calc`, and must not borrow the type for new constants if an api-local type is cleaner); one status table covers every code including NOT_FOUND/METHOD_NOT_ALLOWED; unknown errors → 500 `INTERNAL` via a typed constant. Both endpoints write the same `{ "result": number }` response type. `r.NotFound` registered once (if/else).

- [ ] **Step 1:** Update `handlers_test.go`: evaluate success bodies no longer contain `repeat` (`{"result":14}`); every other case keeps its exact status and body. Run → FAIL.
- [ ] **Step 2:** Implement; delete `writeErr`, `writeCodeErr`, `writeCalcErr` and the duplicated `"Invalid input"` literals.
- [ ] **Step 3:** Update `openapi.yaml`: remove `repeat` from the evaluate response schema, description and examples. `npx --yes @redocly/cli lint openapi.yaml` → 0 errors.
- [ ] **Step 4:** `go vet ./... && go test ./... -cover` → PASS.
- [ ] **Step 5:** Commit `refactor(backend): write every API error through one writer`.

### Task 4: Keyboard focus model (finding 3)

**Files:**
- Modify: `frontend/src/components/atoms/Key/Key.tsx`, `atoms/ThemeToggle/ThemeToggle.tsx`, `organisms/Keypad/Keypad.tsx`, `organisms/Calculator/Calculator.tsx`, and their tests

- [ ] **Step 1:** Tests (Calculator.test.tsx): (a) mouse-click the theme toggle, then type `2+2{Enter}` → `evaluateFn('2 + 2')` called, display `4` (Review Focus 4 of this plan); (b) Tab-focus the `7` key and press `{Enter}` → `7` appended, `evaluateFn` not called (replaces the old Focus-4 test); (c) Tab-focus the toggle, `{Enter}` → theme toggles, `evaluateFn` not called; (d) Key/ThemeToggle: `mousedown` default is prevented (focus does not move to the button on click). Run → FAIL.
- [ ] **Step 2:** Implement: `onMouseDown={(e) => e.preventDefault()}` on `Key` and `ThemeToggle`; the window handler skips only `(Enter or Space) && target is a button`; delete `data-keypad` and the `closest(...)` checks; keep the modifier and `e.repeat`-equals guards and `preventDefault()` for mapped keys.
- [ ] **Step 3:** `npx vitest run && npx tsc -b && npm run build` → PASS. Browser check if a browser tool exists (click toggle → type `2+2` Enter → 4; Tab to toggle → Enter toggles).
- [ ] **Step 4:** Commit `refactor(frontend): keep focus off clicked buttons instead of sniffing targets`.

### Task 5: Pages location, docs, coverage (finding 7 + doc sync)

**Files:**
- Move: `frontend/src/pages/CalculatorPage/` → `frontend/src/components/pages/CalculatorPage/` (update imports in `App.tsx`)
- Modify: spec (§3.3 repeated `=` row, §4.3 evaluate response, §5.2 if needed, §8 decision log: rows "Repeated =" and a new row for the focus model, each noting "changed after code-quality review, user decision"), `README.md` (curl outputs without `repeat`, design-decision table, "How this was built": add the quality-review → refactor step), original plan untouched.
- Regenerate: `make coverage` → `docs/coverage/**`; update README numbers.

- [ ] **Step 1:** Move + imports; `npx vitest run && npx tsc -b && npm run build` → PASS.
- [ ] **Step 2:** Docs edits; README curl examples re-run against `go run ./cmd/server` and pasted.
- [ ] **Step 3:** `make coverage`; `grep -r "/Users/" docs/coverage` empty; dead-code grep (Review Focus 5): `grep -rn "repeat" backend frontend/src/api` → none; `grep -rn "data-keypad\|writeCodeErr\|writeCalcErr" backend frontend/src` → none.
- [ ] **Step 4:** Commits `refactor(frontend): move pages under components` and `docs: sync spec, README and coverage with the quality refactor`.
