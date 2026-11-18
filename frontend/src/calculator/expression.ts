import type { NumberToken, Operator, Token } from './types';

const DISPLAY_OP: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };

export function toApiExpression(tokens: Token[]): string {
  return tokens
    .map((t) =>
      t.kind === 'operator'
        ? t.op
        : (t.sqrt ? 'sqrt ' : '') + (t.negative ? `(-${t.digits})` : t.digits) + (t.percent ? '%' : ''),
    )
    .join(' ');
}

export function toDisplay(tokens: Token[]): string {
  return tokens
    .map((t) =>
      t.kind === 'operator'
        ? DISPLAY_OP[t.op]
        : (t.sqrt ? '√' : '') + (t.negative ? '−' : '') + t.digits + (t.percent ? '%' : ''),
    )
    .join('');
}

export function numberTokenFrom(value: number): NumberToken {
  return { kind: 'number', digits: String(Math.abs(value)), negative: value < 0, sqrt: false, percent: false };
}
