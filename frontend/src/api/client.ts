export type EvaluateResult = { result: number };

export class ApiError extends Error {
  code: string;
  position?: number;
  constructor(code: string, message: string, position?: number) {
    super(message);
    this.code = code;
    this.position = position;
  }
}

const unreachable = () => new ApiError('NETWORK_ERROR', "Can't reach server");

export async function evaluate(expression: string, fetchFn: typeof fetch = fetch): Promise<EvaluateResult> {
  let res: Response;
  let body: any;
  try {
    res = await fetchFn('/api/v1/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression }),
    });
    body = await res.json();
  } catch {
    throw unreachable();
  }
  if (res.ok) {
    if (typeof body?.result !== 'number' || !Number.isFinite(body.result)) throw unreachable();
    return { result: body.result };
  }
  const e = body?.error;
  if (typeof e?.code === 'string' && typeof e?.message === 'string') {
    throw new ApiError(e.code, e.message, typeof e.position === 'number' ? e.position : undefined);
  }
  throw unreachable();
}
