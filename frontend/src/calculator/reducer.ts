import { numberTokenFrom, toApiExpression, toDisplay } from './expression';
import type { NumberToken, Operator, Token } from './types';

export type Action =
  | { type: 'digit'; digit: string } | { type: 'decimal' } | { type: 'operator'; op: Operator }
  | { type: 'sqrt' } | { type: 'percent' } | { type: 'negate' } | { type: 'backspace' }
  | { type: 'clear' } | { type: 'equals' }
  | { type: 'resolved'; result: number; repeat?: string } | { type: 'failed'; message: string };

export type CalcState = {
  tokens: Token[];
  status: 'editing' | 'pending' | 'result' | 'error';
  request: string | null;
  expressionLine: string;
  result: number | null;
  repeat: string | null;
  message: string | null;
};

export const initialState: CalcState = {
  tokens: [], status: 'editing', request: null, expressionLine: '', result: null, repeat: null, message: null,
};

const MAX_LEN = 256;
const blank = (digits = ''): NumberToken => ({ kind: 'number', digits, negative: false, sqrt: false, percent: false });
const wrap = (n: number) => (n < 0 ? `(${n})` : String(n));

// Repeat fragment is "<op> <operand>", e.g. "- (-3)", "+ sqrt 9", "+ 10%".
const repeatDisplay = (r: string) =>
  r.replace(/^[-*/]/, (c) => ({ '-': '−', '*': '×', '/': '÷' })[c]!)
    .replace(/\(-([^)]+)\)/g, '−$1').replace(/sqrt /g, '√').replace(/ /g, '');

export function mainLine(s: CalcState): string {
  if (s.status === 'result') return String(s.result).replace(/^-/, '−');
  if (s.status === 'error') return s.message ?? '';
  return toDisplay(s.tokens) || '0';
}

// Replace the current number (last token if it is a number) or append a new one.
function withNumber(tokens: Token[], f: (n: NumberToken | null) => NumberToken | null): Token[] {
  const last = tokens[tokens.length - 1];
  if (last?.kind === 'number') {
    const n = f(last);
    return n ? [...tokens.slice(0, -1), n] : tokens.slice(0, -1);
  }
  const n = f(null);
  return n ? [...tokens, n] : tokens;
}

export function reducer(state: CalcState, action: Action): CalcState {
  if (action.type === 'clear') return initialState;
  if (state.status === 'pending') {
    if (action.type === 'resolved') {
      return { ...state, status: 'result', request: null, result: action.result, repeat: action.repeat ?? null,
        tokens: [numberTokenFrom(action.result)] };
    }
    if (action.type === 'failed') return { ...initialState, status: 'error', message: action.message, expressionLine: state.expressionLine };
    return state;
  }
  if (action.type === 'resolved' || action.type === 'failed') return state;

  if (state.status === 'result') {
    if (action.type === 'backspace') return state;
    if (action.type === 'equals') {
      if (state.repeat === null || state.result === null) return state;
      const request = `${wrap(state.result)} ${state.repeat}`;
      return { ...state, status: 'pending', request, expressionLine: toDisplay([numberTokenFrom(state.result)]) + repeatDisplay(state.repeat) };
    }
  }
  const base = state.status === 'error' ? initialState
    : state.status === 'result' ? { ...initialState, tokens: action.type === 'digit' || action.type === 'decimal' ? [] : state.tokens }
    : state;
  const tokens = base.tokens;
  const last = tokens[tokens.length - 1];
  const num = last?.kind === 'number' ? last : null;
  const edit = (next: Token[]): CalcState =>
    toApiExpression(next).length > MAX_LEN ? base : { ...initialState, tokens: next };

  switch (action.type) {
    case 'digit':
      if (num?.percent) return base;
      return edit(withNumber(tokens, (n) => (n ? { ...n, digits: n.digits === '0' ? action.digit : n.digits + action.digit } : blank(action.digit))));
    case 'decimal':
      if (num?.percent || num?.digits.includes('.')) return base;
      return edit(withNumber(tokens, (n) => (n ? { ...n, digits: (n.digits || '0') + '.' } : blank('0.'))));
    case 'operator': {
      if (num && num.digits === '') return base;
      const opTok: Token = { kind: 'operator', op: action.op };
      if (last?.kind === 'operator') return edit([...tokens.slice(0, -1), opTok]);
      return edit([...(tokens.length ? tokens : [blank('0')]), opTok]);
    }
    case 'sqrt':
      if (num?.sqrt) return base;
      return edit(withNumber(tokens, (n) => (n ? { ...n, sqrt: true } : { ...blank(), sqrt: true })));
    case 'percent':
      if (!num || num.digits === '' || num.percent) return base;
      return edit(withNumber(tokens, (n) => n && { ...n, percent: true }));
    case 'negate':
      return edit(withNumber(tokens, (n) => {
        const t = n ? { ...n, negative: !n.negative } : { ...blank(), negative: true };
        return t.digits === '' && !t.sqrt && !t.negative ? null : t;
      }));
    case 'backspace': {
      if (!last) return base;
      if (!num) return edit(tokens.slice(0, -1));
      return edit(withNumber(tokens, (n) => {
        if (!n || n.digits.includes('e')) return null; // e-notation is atomic
        const t = n.percent ? { ...n, percent: false } : { ...n, digits: n.digits.slice(0, -1) };
        if (t.digits === '') t.sqrt = false;
        return t.digits === '' ? null : t;
      }));
    }
    case 'equals': {
      if (!last || last.kind === 'operator' || last.digits === '') return base === state ? base : { ...initialState };
      return { ...base, status: 'pending', request: toApiExpression(tokens), expressionLine: toDisplay(tokens) };
    }
  }
}
