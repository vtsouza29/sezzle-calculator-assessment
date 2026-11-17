export type Operator = '+' | '-' | '*' | '/' | '^';
export type NumberToken = { kind: 'number'; digits: string; negative: boolean; sqrt: boolean; percent: boolean };
export type OperatorToken = { kind: 'operator'; op: Operator };
export type Token = NumberToken | OperatorToken;
