import { OrderError } from './domain.mjs';

export function createRpc({ env, fetchImpl = fetch, timeoutMs = 4500 }) {
  let base;
  try { base = new URL(env.SUPABASE_URL); } catch { throw new OrderError(); }
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash
    || typeof env.SUPABASE_SECRET_KEY !== 'string' || !env.SUPABASE_SECRET_KEY.startsWith('sb_secret_')) throw new OrderError();
  return async (name, params) => {
    if (!['reserve_order', 'transition_order', 'expired_order_candidates'].includes(name)) throw new OrderError();
    try {
      const response = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, base), {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      if (!response.ok) {
        // Comparación exacta; jamás reflejar message/details/hint/SQL del servidor.
        const safe = { INSUFFICIENT_STOCK: ['INSUFFICIENT_STOCK', 409], INVALID_SELECTION: ['INVALID_SELECTION', 409],
          IDEMPOTENCY_CONFLICT: ['IDEMPOTENCY_CONFLICT', 409], ORDER_NOT_FOUND: ['NOT_FOUND', 404],
          INVALID_TRANSITION: ['INVALID_TRANSITION', 409] }[data?.message];
        if (safe) throw new OrderError(...safe);
        throw new OrderError();
      }
      return data;
    } catch (error) {
      if (error instanceof OrderError) throw error;
      throw new OrderError();
    }
  };
}
