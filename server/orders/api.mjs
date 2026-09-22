import { OrderError, UUID, exactObject, publicOrder, validateItems } from './domain.mjs';
import { createSession, idempotencyKey, readSession } from './session.mjs';
import { createRpc } from './supabase.mjs';

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
async function body(request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new OrderError('INVALID_REQUEST', 415);
  if (Number(request.headers.get('content-length')) > 16384) throw new OrderError('INVALID_REQUEST', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new OrderError('INVALID_REQUEST', 400);
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new OrderError('INVALID_REQUEST', 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof OrderError) throw error;
    throw new OrderError('INVALID_REQUEST', 400);
  }
}

export function createOrdersApi({ env, rpc, now = Date.now, log = () => {} }) {
  return async (request, context = {}) => {
    try {
      // Defensa independiente del flag Vite: esta entrega no abre reservas en producción.
      const deployment = context.deploy?.context ?? env.CONTEXT;
      if (env.ORDERS_API_ENABLED !== 'true' || !['dev', 'deploy-preview'].includes(deployment)) throw new OrderError('DISABLED', 404);
      const url = new URL(request.url);
      let allowed;
      try { allowed = new URL(env.ORDERS_ALLOWED_ORIGIN); } catch { throw new OrderError(); }
      const local = ['127.0.0.1', 'localhost'].includes(allowed.hostname);
      if (allowed.origin !== env.ORDERS_ALLOWED_ORIGIN || (allowed.protocol !== 'https:' && !(local && deployment === 'dev'))
        || url.origin !== allowed.origin || request.headers.get('origin') !== allowed.origin
        || ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site'))) throw new OrderError('FORBIDDEN', 403);
      if (request.method !== 'POST') return json({ error: 'INVALID_REQUEST', message: 'Usa POST.' }, 405, { Allow: 'POST' });
      const payload = await body(request);
      const session = readSession(request, env, now());
      const action = url.pathname.replace(/\/$/, '');
      if (action === '/api/pedidos/sesion') {
        if (!exactObject(payload, [])) throw new OrderError('INVALID_REQUEST', 400);
        return json({ ok: true }, 200, session ? {} : { 'Set-Cookie': createSession(request, env, now()) });
      }
      if (!session) throw new OrderError('SESSION_REQUIRED', 401);
      const call = rpc ?? createRpc({ env });
      let result;
      if (action === '/api/pedidos/reservar') {
        // No crear reservas si el mecanismo de liberación no está habilitado.
        if (env.ORDERS_EXPIRATION_ENABLED !== 'true') throw new OrderError('DISABLED', 503);
        if (!exactObject(payload, ['attempt_id', 'items'])) throw new OrderError('INVALID_REQUEST', 400);
        const items = validateItems(payload.items);
        result = await call('reserve_order', { p_customer_ref: session.customerRef,
          p_idempotency_key: idempotencyKey(session, payload.attempt_id, env), p_items: items });
      } else if (['/api/pedidos/cancelar', '/api/pedidos/estado'].includes(action)) {
        if (!exactObject(payload, ['order_id']) || typeof payload.order_id !== 'string' || !UUID.test(payload.order_id)) throw new OrderError('INVALID_REQUEST', 400);
        // expire es no-op antes del vencimiento y permite consultar/liberar SOLO
        // el pedido del titular; nunca enumera candidatos desde una ruta pública.
        result = await call('transition_order', { p_order_id: payload.order_id,
          p_customer_ref: session.customerRef, p_action: action.endsWith('/cancelar') ? 'cancel' : 'expire' });
      } else throw new OrderError('NOT_FOUND', 404);
      return json({ order: publicOrder(result) });
    } catch (error) {
      const safe = error instanceof OrderError ? error : new OrderError();
      if (safe.status >= 500) log({ event: 'orders_api_error', code: safe.code });
      return json({ error: safe.code, message: safe.message }, safe.status);
    }
  };
}
