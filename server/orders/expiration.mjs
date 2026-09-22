import { OrderError, UUID } from './domain.mjs';

export async function expireOrders({ rpc, now = Date.now, log = () => {}, budgetMs = 20000, concurrency = 5 }) {
  const started = now();
  const stats = { candidates: 0, expired: 0, unchanged: 0, failed: 0, deferred: 0 };
  let candidates;
  try {
    candidates = await rpc('expired_order_candidates', { p_limit: 500 });
    if (!Array.isArray(candidates) || candidates.length > 500 || candidates.some((item) =>
      !item || !UUID.test(item.order_id) || typeof item.customer_ref !== 'string' || !item.customer_ref)) throw new OrderError();
  } catch {
    log({ event: 'orders_expiration_error', stage: 'candidates', code: 'UNAVAILABLE' });
    throw new OrderError();
  }
  stats.candidates = candidates.length;
  // Rotar el comienzo por minuto evita que errores persistentes al principio
  // del lote consuman siempre el presupuesto antes de los otros candidatos.
  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  let step = Math.max(1, Math.floor(candidates.length / 5));
  // Coprimo con el tamaño: un lote estable recorre TODOS los inicios, incluso
  // si el presupuesto solo deja procesar un pedido por ejecución.
  while (candidates.length && gcd(step, candidates.length) !== 1) step++;
  const offset = candidates.length ? (Math.floor(started / 60000) * step) % candidates.length : 0;
  candidates = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  let cursor = 0;
  async function consume() {
    while (cursor < candidates.length && now() - started < budgetMs) {
      const item = candidates[cursor++];
      try {
        const order = await rpc('transition_order', { p_order_id: item.order_id, p_customer_ref: item.customer_ref, p_action: 'expire' });
        if (!order || !['pending', 'confirmed', 'cancelled', 'completed'].includes(order.status)) throw new OrderError();
        if (order.status === 'cancelled' && order.cancellation_reason === 'expired') stats.expired++;
        else stats.unchanged++;
      } catch {
        stats.failed++;
        log({ event: 'orders_expiration_error', order_id: item.order_id, code: 'UNAVAILABLE' });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, consume));
  stats.deferred = candidates.length - cursor;
  log({ event: 'orders_expiration_summary', ...stats, saturated: candidates.length === 500 });
  return stats;
}
