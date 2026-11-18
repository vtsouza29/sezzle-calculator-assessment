import { describe, expect, it } from 'vitest';
import { keyToAction } from './keyboard';

describe('keyToAction', () => {
  it.each([
    ['7', { type: 'digit', digit: '7' }],
    ['.', { type: 'decimal' }], [',', { type: 'decimal' }],
    ['+', { type: 'operator', op: '+' }], ['-', { type: 'operator', op: '-' }],
    ['*', { type: 'operator', op: '*' }], ['/', { type: 'operator', op: '/' }],
    ['^', { type: 'operator', op: '^' }],
    ['%', { type: 'percent' }],
    ['Enter', { type: 'equals' }], ['=', { type: 'equals' }],
    ['Backspace', { type: 'backspace' }], ['Escape', { type: 'clear' }],
    ['r', { type: 'sqrt' }], ['n', { type: 'negate' }],
    ['a', null],
  ])('%s', (k, a) => expect(keyToAction(k)).toEqual(a));
});
