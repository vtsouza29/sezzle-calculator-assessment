import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { evaluate } from '../api/client';
import { useCalculator } from './useCalculator';

type Fn = typeof evaluate;
const press = (r: { current: ReturnType<typeof useCalculator> }, ...keys: Parameters<ReturnType<typeof useCalculator>['dispatch']>[0][]) =>
  act(() => { keys.forEach(r.current.dispatch); });
const d = (digit: string) => ({ type: 'digit', digit }) as const;
const plus = { type: 'operator', op: '+' } as const;
const eq = { type: 'equals' } as const;

describe('useCalculator', () => {
  it('evaluates 2 + 3 once and shows the result', async () => {
    const fn = vi.fn(async () => ({ result: 5 }));
    const { result } = renderHook(() => useCalculator(fn as unknown as Fn));
    press(result, d('2'), plus, d('3'), eq);
    await waitFor(() => expect(result.current.state.status).toBe('result'));
    expect(fn).toHaveBeenCalledTimes(1);
    expect((fn.mock.calls as unknown[][])[0]![0]).toBe('2 + 3');
    expect(result.current.state).toMatchObject({ result: 5 });
  });
  it('shows ApiError message', async () => {
    const fn = vi.fn(async () => { throw new ApiError('DIVISION_BY_ZERO', 'Undefined'); });
    const { result } = renderHook(() => useCalculator(fn as unknown as Fn));
    press(result, d('2'), plus, d('3'), eq);
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toMatchObject({ message: 'Undefined' });
  });
  it('non-ApiError maps to Can\'t reach server', async () => {
    const fn = vi.fn(async () => { throw new Error('boom'); });
    const { result } = renderHook(() => useCalculator(fn as unknown as Fn));
    press(result, d('2'), plus, d('3'), eq);
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toMatchObject({ message: "Can't reach server" });
  });
  it('double = while pending calls once', async () => {
    const fn = vi.fn(() => new Promise<{ result: number }>(() => {}));
    const { result } = renderHook(() => useCalculator(fn as unknown as Fn));
    press(result, d('2'), plus, d('3'), eq, eq);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('drops a late response after AC and a new =', async () => {
    const resolvers: ((v: { result: number }) => void)[] = [];
    const fn = vi.fn((_e: string) => new Promise<{ result: number }>((r) => { resolvers.push(r); }));
    const { result } = renderHook(() => useCalculator(fn as unknown as Fn));
    press(result, d('2'), plus, d('3'), eq);
    press(result, { type: 'clear' });
    press(result, d('4'), plus, d('4'), eq);
    expect(fn).toHaveBeenCalledTimes(2);
    await act(async () => { resolvers[0]!({ result: 5 }); });
    expect(result.current.state.status).toBe('pending');
    await act(async () => { resolvers[1]!({ result: 8 }); });
    expect(result.current.state).toMatchObject({ result: 8 });
  });
});
