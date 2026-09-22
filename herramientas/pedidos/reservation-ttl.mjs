import pg from 'pg';
import { OrderError } from '../../server/orders/domain.mjs';

export function reservationTtlMinutes(env, localDevelopment = false) {
  if (!localDevelopment || env.CONTEXT !== 'dev' || env.NODE_ENV === 'production') return 30;
  const value = env.ORDERS_RESERVATION_TTL_MINUTES;
  return typeof value === 'string' && /^(?:[1-9]|[12][0-9]|30)$/.test(value) ? Number(value) : 30;
}

// Installed only by Vite. Deployed Functions keep the unmodified SQL RPC.
export function withLocalReservationTtl({ env, rpc, localDevelopment = false,
  clientFactory = (connectionString) => new pg.Client({ connectionString, connectionTimeoutMillis: 4500,
    query_timeout: 10000, statement_timeout: 10000 }) }) {
  const ttl = reservationTtlMinutes(env, localDevelopment);
  if (ttl === 30) return rpc;
  return async (name, params) => {
    if (name !== 'reserve_order') return rpc(name, params);
    if (!env.ORDERS_DEV_DATABASE_URL) throw new OrderError();
    const client = clientFactory(env.ORDERS_DEV_DATABASE_URL);
    try {
      await client.connect();
      await client.query('BEGIN');
      const { rows: [row] } = await client.query('select public.reserve_order($1,$2,$3::jsonb) as result',
        [params.p_customer_ref, params.p_idempotency_key, JSON.stringify(params.p_items)]);
      // Creation time makes retries idempotent. LEAST never extends a deadline.
      // The row lock serializes retries and transitions; rollback covers both writes.
      await client.query(`update public.orders set expires_at = least(expires_at, created_at + $3 * interval '1 minute')
        where id = $1 and customer_ref = $2 and status = 'pending'`,
      [row.result.id, params.p_customer_ref, ttl]);
      const { rows: [updated] } = await client.query("select public.transition_order($1,$2,'expire') as result",
        [row.result.id, params.p_customer_ref]);
      await client.query('COMMIT');
      return updated.result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Connection may have failed. */ }
      const safe = { INSUFFICIENT_STOCK: ['INSUFFICIENT_STOCK', 409], INVALID_SELECTION: ['INVALID_SELECTION', 409],
        IDEMPOTENCY_CONFLICT: ['IDEMPOTENCY_CONFLICT', 409] }[error.message];
      throw safe ? new OrderError(...safe) : new OrderError();
    } finally { await client.end().catch(() => {}); }
  };
}
