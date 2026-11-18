import { describe, expect, it } from 'vitest';
import { numberTokenFrom, toApiExpression, toDisplay } from './expression';
import type { NumberToken, Operator, Token } from './types';

const n = (digits: string, o: Partial<NumberToken> = {}): Token => ({ kind: 'number', digits, negative: false, sqrt: false, percent: false, ...o });
const op = (o: Operator): Token => ({ kind: 'operator', op: o });

describe('expression', () => {
  it('serializes 2 + 3 * 4', () => {
    const t = [n('2'), op('+'), n('3'), op('*'), n('4')];
    expect(toApiExpression(t)).toBe('2 + 3 * 4');
    expect(toDisplay(t)).toBe('2+3×4');
  });
  it('negative with power', () => {
    const t = [n('2', { negative: true }), op('^'), n('2')];
    expect(toApiExpression(t)).toBe('(-2) ^ 2');
    expect(toDisplay(t)).toBe('−2^2');
  });
  it('sqrt', () => {
    expect(toApiExpression([n('9', { sqrt: true })])).toBe('sqrt 9');
    expect(toDisplay([n('9', { sqrt: true })])).toBe('√9');
  });
  it('percent', () => {
    expect(toApiExpression([n('200'), op('+'), n('10', { percent: true })])).toBe('200 + 10%');
  });
  it('divide', () => {
    expect(toApiExpression([op('/')])).toBe('/');
    expect(toDisplay([op('/')])).toBe('÷');
  });
  it('numberTokenFrom', () => {
    expect(numberTokenFrom(-2)).toEqual({ kind: 'number', digits: '2', negative: true, sqrt: false, percent: false });
    expect(numberTokenFrom(1e21).digits).toBe('1e+21');
    expect(toApiExpression([numberTokenFrom(1e21)])).toBe('1e+21');
  });
});
