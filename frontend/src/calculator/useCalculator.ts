import { useEffect, useReducer } from 'react';
import { ApiError, evaluate } from '../api/client';
import { initialState, reducer } from './reducer';

export function useCalculator(evaluateFn: typeof evaluate = evaluate) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { request } = state;

  useEffect(() => {
    if (request === null) return;
    let ignore = false; // drops stale responses (AC then new =)
    evaluateFn(request).then(
      (r) => { if (!ignore) dispatch({ type: 'resolved', result: r.result, repeat: r.repeat }); },
      (e) => {
        if (!ignore) dispatch({ type: 'failed', message: e instanceof ApiError ? e.message : "Can't reach server" });
      },
    );
    return () => { ignore = true; };
  }, [request, evaluateFn]);

  return { state, dispatch };
}
