import { numberTokenFrom, toApiExpression, toDisplay } from './expression';
import type { NumberToken, Operator, Token } from './types';

export type Action =
  | { type: 'digit'; digit: string } | { type: 'decimal' } | { type: 'operator'; op: Operator }
  | { type: 'sqrt' } | { type: 'percent' } | { type: 'negate' } | { type: 'backspace' }
  | { type: 'clear' } | { type: 'equals' }
  | { type: 'resolved'; result: number } | { type: 'failed'; message: string };

export type CalcState =
  | { status: 'editing'; tokens: Token[] }
  | { status: 'pending'; tokens: Token[]; request: string; expressionLine: string; repeat: Token[] | null }
  | { status: 'result'; result: number; repeat: Token[] | null; expressionLine: string }
  | { status: 'error'; message: string; expressionLine: string };

export const initialState: CalcState = { status: 'editing', tokens: [] };

const MAX_LEN = 256;
const blank = (digits = ''): NumberToken => ({ kind: 'number', digits, negative: false, sqrt: false, percent: false });

export function mainLine(s: CalcState): string {
  switch (s.status) {
    case 'result': return String(s.result).replace(/^-/, '−');
    case 'error': return s.message;
    default: return toDisplay(s.tokens) || '0';
  }
}

export const expressionLine = (s: CalcState): string => (s.status === 'editing' ? '' : s.expressionLine);

const pending = (tokens: Token[], repeat: Token[] | null): CalcState =>
  ({ status: 'pending', tokens, request: toApiExpression(tokens), expressionLine: toDisplay(tokens), repeat });

// Keypad tokens never contain parentheses, so the last operator and everything after it is the repeat.
const repeatOf = (tokens: Token[]): Token[] | null => {
  const i = tokens.findLastIndex((t) => t.kind === 'operator');
  return i < 0 ? null : tokens.slice(i);
};

export function reducer(state: CalcState, action: Action): CalcState {
  if (action.type === 'clear') return initialState;
  if (state.status === 'pending') {
    if (action.type === 'resolved') return { status: 'result', result: action.result, repeat: state.repeat, expressionLine: state.expressionLine };
    if (action.type === 'failed') return { status: 'error', message: action.message, expressionLine: state.expressionLine };
    return state;
  }
  if (action.type === 'resolved' || action.type === 'failed') return state;
  if (state.status === 'result') {
    if (action.type === 'backspace') return state;
    if (action.type === 'equals') return state.repeat ? pending([numberTokenFrom(state.result), ...state.repeat], state.repeat) : state;
  }
  if (state.status === 'editing' && action.type === 'equals') {
    const last = state.tokens[state.tokens.length - 1];
    return last?.kind === 'number' && last.digits !== '' ? pending(state.tokens, repeatOf(state.tokens)) : state;
  }
  const tokens = editTokens(startTokens(state, action), action);
  return state.status === 'editing' && tokens === state.tokens ? state : { status: 'editing', tokens };
}

function startTokens(state: CalcState, action: Action): Token[] {
  if (state.status === 'editing') return state.tokens;
  if (state.status === 'result') return action.type === 'digit' || action.type === 'decimal' ? [] : [numberTokenFrom(state.result)];
  return [];
}

// Pure key edit; returns the same array when the key does nothing.
function editTokens(tokens: Token[], action: Action): Token[] {
  const next = apply(tokens, action);
  return toApiExpression(next).length > MAX_LEN ? tokens : next;
}

function apply(tokens: Token[], action: Action): Token[] {
  const last = tokens[tokens.length - 1];
  const num = last?.kind === 'number' ? last : null;
  const cur = num ?? blank();
  // Replace the trailing number, or append when there is none; null drops the trailing number.
  const setCurrent = (t: NumberToken | null): Token[] =>
    [...(num ? tokens.slice(0, -1) : tokens), ...(t ? [t] : [])];

  switch (action.type) {
    case 'digit':
      if (num?.percent) return tokens;
      return setCurrent({ ...cur, digits: cur.digits === '0' ? action.digit : cur.digits + action.digit });
    case 'decimal':
      if (num?.percent || num?.digits.includes('.')) return tokens;
      return setCurrent({ ...cur, digits: (cur.digits || '0') + '.' });
    case 'operator': {
      if (num?.digits === '') return tokens;
      const opTok: Token = { kind: 'operator', op: action.op };
      if (last?.kind === 'operator') return [...tokens.slice(0, -1), opTok];
      return [...(tokens.length ? tokens : [blank('0')]), opTok];
    }
    case 'sqrt':
      return num?.sqrt ? tokens : setCurrent({ ...cur, sqrt: true });
    case 'percent':
      return !num || num.digits === '' || num.percent ? tokens : setCurrent({ ...num, percent: true });
    case 'negate': {
      const t = { ...cur, negative: !cur.negative };
      return setCurrent(t.digits === '' && !t.sqrt && !t.negative ? null : t);
    }
    case 'backspace': {
      if (!last) return tokens;
      if (!num) return tokens.slice(0, -1);
      if (num.digits.includes('e')) return setCurrent(null); // e-notation is atomic
      const t = num.percent ? { ...num, percent: false } : { ...num, digits: num.digits.slice(0, -1) };
      return setCurrent(t.digits === '' ? null : t);
    }
    default:
      return tokens;
  }
}
