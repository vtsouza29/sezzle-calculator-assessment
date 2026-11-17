import { describe, expect, it, vi } from 'vitest';
import { ApiError, evaluate } from './client';

const res = (body: string, status = 200) => Promise.resolve(new Response(body, { status }));
const fail = async (p: Promise<unknown>) => p.then(() => null, (e) => e);

describe('evaluate', () => {
  it('POSTs the expression and returns the result', async () => {
    const f = vi.fn(() => res('{"result":14,"repeat":"* 4"}'));
    expect(await evaluate('2 + 3 * 4', f as unknown as typeof fetch)).toEqual({ result: 14 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/evaluate');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"expression":"2 + 3 * 4"}');
  });
  it('maps an error envelope to ApiError', async () => {
    const f = () => res('{"error":{"code":"DIVISION_BY_ZERO","message":"Undefined"}}', 422);
    const e = await fail(evaluate('1 / 0', f as unknown as typeof fetch));
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ code: 'DIVISION_BY_ZERO', message: 'Undefined' });
  });
  it.each([
    ['fetch throws', () => Promise.reject(new TypeError('x'))],
    ['502 HTML', () => res('<html>Bad Gateway</html>', 502)],
    ['2xx without numeric result', () => res('{"result":"5"}')],
    ['2xx non-JSON', () => res('<html>')],
  ])('%s -> NETWORK_ERROR', async (_n, f) => {
    const e = await fail(evaluate('1', f as unknown as typeof fetch));
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ code: 'NETWORK_ERROR', message: "Can't reach server" });
  });
});
