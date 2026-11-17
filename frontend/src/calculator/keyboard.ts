import type { Action } from './reducer';

const OPS = ['+', '-', '*', '/', '^'] as const;

export function keyToAction(key: string): Action | null {
  if (/^[0-9]$/.test(key)) return { type: 'digit', digit: key };
  const op = OPS.find((o) => o === key);
  if (op) return { type: 'operator', op };
  switch (key) {
    case '.': case ',': return { type: 'decimal' };
    case '%': return { type: 'percent' };
    case 'Enter': case '=': return { type: 'equals' };
    case 'Backspace': return { type: 'backspace' };
    case 'Escape': return { type: 'clear' };
    case 'r': return { type: 'sqrt' };
    case 'n': return { type: 'negate' };
    default: return null;
  }
}
