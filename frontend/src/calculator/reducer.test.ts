import { describe, expect, it } from 'vitest';
import { initialState, mainLine, reducer, type Action, type CalcState } from './reducer';

const press = (...actions: Action[]): CalcState => actions.reduce(reducer, initialState);
const d = (s: string): Action[] => [...s].map((c) => (c === '.' ? { type: 'decimal' } : { type: 'digit', digit: c }));
const op = (o: '+' | '-' | '*' | '/' | '^'): Action => ({ type: 'operator', op: o });
const eq: Action = { type: 'equals' };
const bs: Action = { type: 'backspace' };
const neg: Action = { type: 'negate' };
const sqrt: Action = { type: 'sqrt' };
const pct: Action = { type: 'percent' };
const resolved = (result: number, repeat?: string): Action => ({ type: 'resolved', result, repeat });
const line = (...a: Action[]) => mainLine(press(...a));

describe('typing', () => {
  it('appends digits', () => expect(line(...d('12'))).toBe('12'));
  it('ignores a second decimal', () => expect(line(...d('1..2'))).toBe('1.2'));
  it('leading decimal gives 0.', () => expect(line(...d('.'))).toBe('0.'));
  it('replaces a lone leading zero but keeps 0.5', () => {
    expect(line(...d('05'))).toBe('5');
    expect(line(...d('0.5'))).toBe('0.5');
  });
  it('replaces an operator', () => expect(line(...d('2'), op('+'), op('*'))).toBe('2×'));
  it('operator on empty starts from 0', () => expect(line(op('+'))).toBe('0+'));
  it('ignores operator on an incomplete number', () => expect(line(sqrt, op('+'))).toBe('√'));
  it('ignores digits after percent', () => expect(line(...d('50'), pct, ...d('1'))).toBe('50%'));
  it('ignores decimal after percent', () => expect(line(...d('50'), pct, ...d('.'))).toBe('50%'));
  it('ignores digits past 256 chars', () => {
    const s = press(...d('1'.repeat(300)));
    expect(mainLine(s)).toBe('1'.repeat(256));
  });
});

describe('equals', () => {
  it('goes pending with the api expression', () => {
    const s = press(...d('2'), op('+'), ...d('3'), op('*'), ...d('4'), eq);
    expect(s.status).toBe('pending');
    expect(s.request).toBe('2 + 3 * 4');
  });
  it('resolves to a result', () => {
    const s = press(...d('2'), op('+'), ...d('3'), op('*'), ...d('4'), eq, resolved(14, '* 4'));
    expect(s).toMatchObject({ status: 'result', request: null, expressionLine: '2+3×4', result: 14, repeat: '* 4' });
    expect(mainLine(s)).toBe('14');
  });
  it('repeats with the repeat fragment', () => {
    const s = press(...d('2'), op('+'), ...d('3'), op('*'), ...d('4'), eq, resolved(14, '* 4'), eq);
    expect(s).toMatchObject({ status: 'pending', request: '14 * 4' });
  });
  it('wraps a negative result in parentheses', () => {
    expect(press(...d('1'), eq, resolved(-2, '^ 2'), eq).request).toBe('(-2) ^ 2');
  });
  it('repeats a percent expression', () => {
    const s = press(...d('200'), op('+'), ...d('10'), pct, eq, resolved(220, '+ 10%'), eq);
    expect(s.request).toBe('220 + 10%');
  });
  it('is a no-op after a result without repeat', () => {
    const s = press(...d('1'), eq, resolved(1));
    expect(reducer(s, eq)).toBe(s);
  });
  it('is a no-op on trailing operator, empty, or incomplete number', () => {
    for (const a of [[...d('2'), op('+')], [], [sqrt], [neg]]) {
      const s = press(...a);
      expect(reducer(s, eq)).toBe(s);
    }
  });
});

describe('after a result', () => {
  const r = press(...d('2'), op('+'), ...d('3'), op('*'), ...d('4'), eq, resolved(14, '* 4'));
  it('digit starts a new expression', () => {
    const s = reducer(r, { type: 'digit', digit: '7' });
    expect(mainLine(s)).toBe('7');
    expect(s.status).toBe('editing');
  });
  it('decimal starts a new expression', () => expect(mainLine(reducer(r, { type: 'decimal' }))).toBe('0.'));
  it('operator continues from the result', () => expect(mainLine(reducer(r, op('*')))).toBe('14×'));
  it('backspace is unchanged', () => expect(reducer(r, bs)).toBe(r));
  it('negative result continues with a negative number', () => {
    const s = press(...d('1'), eq, resolved(-2), op('+'), ...d('1'), eq);
    expect(s.request).toBe('(-2) + 1');
  });
});

describe('negate, sqrt, percent', () => {
  it('toggles sign', () => {
    const s = press(...d('2'), neg);
    expect(mainLine(s)).toBe('−2');
    expect(press(...d('2'), neg, op('^'), ...d('2'), eq).request).toBe('(-2) ^ 2');
    expect(line(...d('2'), neg, neg)).toBe('2');
  });
  it('negate with no number starts a negative number', () => {
    expect(line(neg)).toBe('−');
    expect(line(neg, ...d('5'))).toBe('−5');
    expect(line(...d('2'), op('+'), neg, ...d('5'))).toBe('2+−5');
    expect(line(neg, neg)).toBe('0');
  });
  it('negate still toggles a percent number', () => expect(line(...d('5'), pct, neg)).toBe('−5%'));
  it('sqrt before and after digits', () => {
    expect(line(sqrt, ...d('9'))).toBe('√9');
    expect(line(...d('9'), sqrt)).toBe('√9');
    expect(press(...d('9'), sqrt, eq).request).toBe('sqrt 9');
  });
  it('sqrt twice is a no-op', () => expect(line(...d('9'), sqrt, sqrt)).toBe('√9'));
  it('percent', () => {
    expect(line(...d('50'), pct)).toBe('50%');
    expect(line(...d('50'), pct, pct)).toBe('50%');
  });
  it('percent on empty/incomplete is a no-op', () => {
    expect(line(pct)).toBe('0');
    expect(line(sqrt, pct)).toBe('√');
    expect(line(...d('2'), op('+'), pct)).toBe('2+');
  });
});

describe('backspace', () => {
  it('number digit', () => expect(line(...d('12'), bs)).toBe('1'));
  it('operator', () => expect(line(...d('2'), op('+'), bs)).toBe('2'));
  it('percent first', () => expect(line(...d('50'), pct, bs)).toBe('50'));
  it('clears sqrt when digits run out, dropping the token', () => {
    expect(line(sqrt, ...d('9'), bs)).toBe('0');
    expect(line(sqrt, bs)).toBe('0');
  });
  it('drops an empty negative number', () => expect(line(...d('2'), op('+'), neg, bs)).toBe('2+'));
  it('on empty input is a no-op', () => expect(reducer(initialState, bs)).toBe(initialState));
});

describe('clear and pending', () => {
  it('AC resets from any status', () => {
    const pend = press(...d('1'), eq);
    for (const s of [pend, reducer(pend, resolved(1)), reducer(pend, { type: 'failed', message: 'x' }), press(...d('5'))]) {
      expect(reducer(s, { type: 'clear' })).toEqual(initialState);
    }
  });
  it('ignores input while pending', () => {
    const s = press(...d('1'), eq);
    for (const a of [{ type: 'digit', digit: '2' }, op('+'), eq, bs, pct, sqrt, neg, { type: 'decimal' }] as Action[]) {
      expect(reducer(s, a)).toBe(s);
    }
  });
  it('drops resolved/failed when not pending', () => {
    const s = press(...d('1'));
    expect(reducer(s, resolved(9))).toBe(s);
    expect(reducer(s, { type: 'failed', message: 'x' })).toBe(s);
  });
});

describe('errors', () => {
  const e = press(...d('1'), op('/'), ...d('0'), eq, { type: 'failed', message: 'Undefined' });
  it('shows the message', () => {
    expect(e.status).toBe('error');
    expect(e.request).toBeNull();
    expect(mainLine(e)).toBe('Undefined');
  });
  it('next digit starts fresh', () => {
    const s = reducer(e, { type: 'digit', digit: '5' });
    expect(mainLine(s)).toBe('5');
    expect(s.status).toBe('editing');
  });
  it('next operator gives 0+', () => expect(mainLine(reducer(e, op('+')))).toBe('0+'));
  it('equals after error clears', () => expect(reducer(e, eq)).toEqual(initialState));
});
