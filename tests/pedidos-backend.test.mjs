import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createOrdersApi } from '../server/orders/api.mjs';
import { createRpc } from '../server/orders/supabase.mjs';
import { expireOrders } from '../server/orders/expiration.mjs';
import { installSchema, seed } from './helpers/orders-db.mjs';
import { config as apiConfig } from '../netlify/functions/orders.mjs';
import { config as workerConfig } from '../netlify/functions/expire-orders.mjs';
import { reservationTtlMinutes, withLocalReservationTtl } from '../herramientas/pedidos/reservation-ttl.mjs';

const env = { CONTEXT: 'dev', ORDERS_API_ENABLED: 'true', ORDERS_EXPIRATION_ENABLED: 'true',
  ORDERS_ALLOWED_ORIGIN: 'https://tienda.test', ORDERS_SESSION_SECRET: 'test-only-secret-that-is-at-least-32-bytes',
  SUPABASE_URL: 'https://database.test', SUPABASE_SECRET_KEY: 'sb_secret_test_never_public' };
const logs = [];
let db, api, rpc;
const call = (handler, path, data, cookie = '', extra = {}) => handler(new Request(`${env.ORDERS_ALLOWED_ORIGIN}/api/pedidos/${path}`, {
  method: 'POST', headers: { Origin: env.ORDERS_ALLOWED_ORIGIN, 'Content-Type': 'application/json', Cookie: cookie, ...extra }, body: JSON.stringify(data),
}));
async function cookie(handler = api) {
  const response = await call(handler, 'sesion', {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict;.*Secure/);
  return response.headers.get('set-cookie').split(';')[0];
}
before(async () => {
  db = new PGlite(); await installSchema(db);
  rpc = createRpc({ env, fetchImpl: async (url, options) => {
    assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, 'error');
    const p = JSON.parse(options.body);
    const name = new URL(url).pathname.split('/').at(-1);
    try {
      let result;
      if (name === 'reserve_order') result = (await db.query('select reserve_order($1,$2,$3::jsonb) value', [p.p_customer_ref, p.p_idempotency_key, JSON.stringify(p.p_items)])).rows[0].value;
      else if (name === 'transition_order') result = (await db.query('select transition_order($1,$2,$3) value', [p.p_order_id, p.p_customer_ref, p.p_action])).rows[0].value;
      else result = (await db.query('select * from expired_order_candidates($1)', [p.p_limit])).rows;
      return Response.json(result);
    } catch (error) { return Response.json({ message: error.message, details: 'SQL INTERNAL NEVER PUBLIC' }, { status: 400 }); }
  } });
  api = createOrdersApi({ env, rpc, log: (entry) => logs.push(entry) });
});
after(async () => db?.close());

test('TTL local validado; produccion, preview y adaptadores no locales conservan 30', () => {
  for (const value of [undefined, '', '0', '-1', '31', '2.5', 'NaN', '2x']) {
    assert.equal(reservationTtlMinutes({ CONTEXT: 'dev', ORDERS_RESERVATION_TTL_MINUTES: value }, true), 30);
  }
  for (const value of ['1', '2', '30']) {
    const config = { CONTEXT: 'dev', ORDERS_RESERVATION_TTL_MINUTES: value };
    assert.equal(reservationTtlMinutes(config, true), Number(value));
    assert.equal(reservationTtlMinutes(config), 30);
    for (const CONTEXT of ['production', 'deploy-preview', undefined]) {
      assert.equal(reservationTtlMinutes({ ...config, CONTEXT }, true), 30);
    }
    assert.equal(reservationTtlMinutes({ ...config, NODE_ENV: 'production' }, true), 30);
    assert.equal(withLocalReservationTtl({ env: { ...config, NODE_ENV: 'production' }, rpc, localDevelopment: true }), rpc);
  }
});

test('TTL local atomico, reintento estable, worker libera stock y estado refleja expiracion', async () => {
  const f = await seed(db, [['M']], '-ttl');
  const localRpc = withLocalReservationTtl({ env: { ...env, ORDERS_RESERVATION_TTL_MINUTES: '2', ORDERS_DEV_DATABASE_URL: 'test' },
    rpc, localDevelopment: true, clientFactory: () => ({ connect: async () => {}, end: async () => {}, query: (...args) => db.query(...args) }) });
  const handler = createOrdersApi({ env, rpc: localRpc });
  const session = await cookie(handler);
  const payload = { attempt_id: randomUUID(), items: f.items(['M']) };
  const response = await call(handler, 'reservar', payload, session);
  assert.equal(response.status, 200);
  const { order } = await response.json();
  const duration = await db.query('select extract(epoch from expires_at-created_at)::float8 seconds from orders where id=$1', [order.id]);
  assert.equal(duration.rows[0].seconds, 120);
  assert.equal((await (await call(handler, 'reservar', payload, session)).json()).order.expires_at, order.expires_at);
  for (const key of ['ttl', 'expires_at', 'ORDERS_RESERVATION_TTL_MINUTES']) {
    assert.equal((await call(handler, 'reservar', { ...payload, [key]: 1 }, session)).status, 400);
  }
  assert.equal((await expireOrders({ rpc })).expired, 0);
  // Advance the database fixture past the deadline without a two-minute sleep.
  await db.query("update orders set expires_at=expires_at-interval '121 seconds' where id=$1", [order.id]);
  const stats = await expireOrders({ rpc });
  assert.equal(stats.expired, 1);
  const state = (await (await call(handler, 'estado', { order_id: order.id }, session)).json()).order;
  assert.equal(state.status, 'cancelled');
  assert.equal(state.cancellation_reason, 'expired');
  const units = await db.query(`select u.status, a.released_at from inventory_units u
    join order_item_units a on a.inventory_unit_id=u.id join order_items i on i.id=a.order_item_id where i.order_id=$1`, [order.id]);
  assert.equal(units.rows[0].status, 'available');
  assert.ok(units.rows[0].released_at);
});

test('RPC original conserva treinta minutos', async () => {
  const f = await seed(db, [['M']], '-ttl-default');
  const order = await rpc('reserve_order', { p_customer_ref: 'ttl-default', p_idempotency_key: randomUUID(), p_items: f.items(['M']) });
  const { rows: [row] } = await db.query('select extract(epoch from expires_at-created_at)::float8 seconds from orders where id=$1', [order.id]);
  assert.ok(Math.abs(row.seconds - 1800) < 1);
  await rpc('transition_order', { p_order_id: order.id, p_customer_ref: 'ttl-default', p_action: 'cancel' });
});

test('fallo al aplicar TTL revierte reserva y stock; sin URI no reserva', async () => {
  const f = await seed(db, [['M']], '-ttl-rollback');
  const config = { ...env, ORDERS_RESERVATION_TTL_MINUTES: '2' };
  const params = { p_customer_ref: 'ttl-rollback', p_idempotency_key: randomUUID(), p_items: f.items(['M']) };
  const missing = withLocalReservationTtl({ env: config, rpc, localDevelopment: true });
  await assert.rejects(missing('reserve_order', params), { code: 'UNAVAILABLE' });
  const failing = withLocalReservationTtl({ env: { ...config, ORDERS_DEV_DATABASE_URL: 'test' }, rpc, localDevelopment: true,
    clientFactory: () => ({ connect: async () => {}, end: async () => {}, query: (sql, values) => {
      if (sql.startsWith('update public.orders')) throw new Error('private database error');
      return db.query(sql, values);
    } }) });
  await assert.rejects(failing('reserve_order', params), { code: 'UNAVAILABLE' });
  assert.equal((await db.query('select count(*)::int n from orders where customer_ref=$1', [params.p_customer_ref])).rows[0].n, 0);
  const order = await rpc('reserve_order', params);
  assert.equal(order.status, 'pending');
  await rpc('transition_order', { p_order_id: order.id, p_customer_ref: params.p_customer_ref, p_action: 'cancel' });
});

test('HTTP reserva multiples lineas compatibles, idempotencia, titularidad y cancelacion', async () => {
  const f = await seed(db, [['M', 'L'], ['M']], '-http');
  const owner = await cookie();
  const payload = { attempt_id: randomUUID(), items: f.items() };
  const response = await call(api, 'reservar', payload, owner);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { order } = await response.json();
  assert.equal(order.status, 'pending'); assert.equal(order.items.length, 2);
  assert.doesNotMatch(JSON.stringify(order), /inventory_unit_id|physical_size|customer_ref|sb_secret/);
  const [retryA, retryB] = await Promise.all([call(api, 'reservar', payload, owner), call(api, 'reservar', payload, owner)]);
  assert.equal((await retryA.json()).order.id, order.id);
  assert.equal((await retryB.json()).order.id, order.id);
  const changed = await call(api, 'reservar', { ...payload, items: f.items(['M']) }, owner);
  assert.equal(changed.status, 409); assert.equal((await changed.json()).error, 'IDEMPOTENCY_CONFLICT');
  const thief = await cookie();
  assert.equal((await call(api, 'cancelar', { order_id: order.id }, thief)).status, 404);
  assert.equal((await call(api, 'estado', { order_id: order.id }, thief)).status, 404);
  const cancelled = await (await call(api, 'cancelar', { order_id: order.id }, owner)).json();
  assert.equal(cancelled.order.status, 'cancelled');
  assert.equal((await (await call(api, 'cancelar', { order_id: order.id }, owner)).json()).order.status, 'cancelled');
  assert.equal((await db.query('select count(*)::int n from order_item_units a join order_items i on i.id=a.order_item_id where i.order_id=$1 and a.released_at is not null', [order.id])).rows[0].n, 2);
});

test('falta de stock HTTP 409 no deja un pedido parcial', async () => {
  const f = await seed(db, [['M', 'L']], '-http-stock');
  const beforeCount = (await db.query('select count(*)::int n from orders')).rows[0].n;
  const response = await call(api, 'reservar', { attempt_id: randomUUID(), items: f.items() }, await cookie());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'INSUFFICIENT_STOCK');
  assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n, beforeCount);
});

test('sesion firmada, CSRF, entradas estrictas, limites y produccion deshabilitada', async () => {
  let calls = 0;
  const handler = createOrdersApi({ env, rpc: async () => { calls++; throw new Error('NO RPC EXPECTED'); } });
  const session = await cookie(handler);
  const valid = { product_id: 'product', variant_id: randomUUID(), display_size: 'M', quantity: 1 };
  assert.equal((await call(handler, 'reservar', {}, '')).status, 401);
  assert.equal((await call(handler, 'reservar', {}, session + 'x')).status, 401);
  assert.equal((await call(handler, 'sesion', {}, '', { Origin: 'https://attacker.test' })).status, 403);
  assert.equal((await call(handler, 'sesion', {}, '', { Origin: '' })).status, 403);
  assert.equal((await call(handler, 'sesion', {}, '', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  for (const items of [[], null, [{ ...valid, quantity: 0 }], [{ ...valid, quantity: 1.5 }], [{ ...valid, quantity: 11 }],
    [{ ...valid, quantity: '1' }], [{ ...valid, stock: 999 }], [{ ...valid, physical_size: 'M' }],
    [valid, valid], Array.from({ length: 11 }, () => ({ ...valid, variant_id: randomUUID() })),
    Array.from({ length: 3 }, () => ({ ...valid, variant_id: randomUUID(), quantity: 10 }))]) {
    assert.equal((await call(handler, 'reservar', { attempt_id: randomUUID(), items }, session)).status, 400);
  }
  assert.equal((await call(handler, 'reservar', { attempt_id: randomUUID(), items: [valid], customer_ref: 'forged' }, session)).status, 400);
  assert.equal((await call(handler, 'cancelar', { order_id: randomUUID(), action: 'complete' }, session)).status, 400);
  assert.equal((await call(handler, 'sesion', { oversized: 'x'.repeat(17000) }, session)).status, 413);
  const prod = createOrdersApi({ env: { ...env, CONTEXT: 'production' } });
  assert.equal((await call(prod, 'sesion', {})).status, 404);
  const disabled = createOrdersApi({ env: { ...env, ORDERS_EXPIRATION_ENABLED: 'false' } });
  assert.equal((await call(disabled, 'reservar', { attempt_id: randomUUID(), items: [valid] }, session)).status, 503);
  const expired = createOrdersApi({ env, now: () => Date.now() + 8 * 86400000 });
  assert.equal((await call(expired, 'estado', { order_id: randomUUID() }, session)).status, 401);
  assert.equal(calls, 0);
});

test('cada sesion deriva customer_ref e idempotencia propias desde servidor', async () => {
  const params = [];
  const handler = createOrdersApi({ env, rpc: async (_name, p) => { params.push(p); throw new Error('simulated'); } });
  const a = await cookie(handler), b = await cookie(handler);
  const payload = { attempt_id: randomUUID(), items: [{ product_id: 'p', variant_id: randomUUID(), display_size: 'M', quantity: 1 }] };
  await call(handler, 'reservar', payload, a); await call(handler, 'reservar', payload, a); await call(handler, 'reservar', payload, b);
  assert.equal(params[0].p_idempotency_key, params[1].p_idempotency_key);
  assert.notEqual(params[0].p_idempotency_key, payload.attempt_id);
  assert.notEqual(params[0].p_idempotency_key, params[2].p_idempotency_key);
  assert.notEqual(params[0].p_customer_ref, params[2].p_customer_ref);
});

test('DTO por lista permitida y errores Supabase nunca filtran SQL ni secretos', async () => {
  const f = await seed(db, [['M']], '-dto');
  const owner = await cookie();
  const payload = { attempt_id: randomUUID(), items: f.items(['M']) };
  const result = await (await call(api, 'reservar', payload, owner)).json();
  const poisoned = { ...result.order, physical_size: 'SECRET_PHYSICAL', inventory_unit_id: 'INTERNAL_ID', secret: env.SUPABASE_SECRET_KEY,
    items: result.order.items.map((item) => ({ ...item, physical_size: 'SECRET_PHYSICAL', inventory_unit_id: 'INTERNAL_ID' })) };
  const sanitizing = createOrdersApi({ env, rpc: async () => poisoned });
  assert.doesNotMatch(await (await call(sanitizing, 'reservar', payload, owner)).text(), /SECRET_PHYSICAL|INTERNAL_ID|sb_secret/);
  for (const fetchImpl of [async () => { throw new Error(env.SUPABASE_SECRET_KEY); },
    async () => Response.json({ message: `SQL ${env.SUPABASE_SECRET_KEY}`, details: 'physical_size' }, { status: 500 }),
    async () => new Response('not json', { status: 502 })]) {
    const failing = createOrdersApi({ env, rpc: createRpc({ env, fetchImpl }), log: (entry) => logs.push(entry) });
    const failure = await call(failing, 'reservar', payload, owner);
    assert.equal(failure.status, 503); assert.doesNotMatch(await failure.text(), /SQL|sb_secret|physical_size/);
  }
  assert.doesNotMatch(JSON.stringify(logs), /sb_secret|SQL|customer_ref/);
  await call(api, 'cancelar', { order_id: result.order.id }, owner);
});

test('worker expira pedidos reales, concurrentemente e independientemente', async () => {
  const f = await seed(db, [['M'], ['M']], '-worker');
  const owner = await cookie();
  const orders = [];
  for (let n = 0; n < 2; n++) orders.push((await (await call(api, 'reservar', { attempt_id: randomUUID(), items: f.items(['M']) }, owner)).json()).order);
  await db.query("update orders set expires_at=now()-interval '1 minute' where id=any($1::uuid[])", [orders.map((order) => order.id)]);
  const summaries = await Promise.all([expireOrders({ rpc }), expireOrders({ rpc })]);
  assert.ok(summaries.every((s) => s.failed === 0));
  for (const order of orders) {
    const result = await (await call(api, 'estado', { order_id: order.id }, owner)).json();
    assert.equal(result.order.status, 'cancelled'); assert.equal(result.order.cancellation_reason, 'expired');
  }
  assert.equal((await db.query('select stock from public_inventory_availability where variant_id=$1 and display_size=$2', [f.variant, 'M'])).rows[0].stock, 2);
});

test('worker continua tras errores, acota tiempo y registra solo metadatos seguros', async () => {
  const records = [];
  const candidates = Array.from({ length: 3 }, () => ({ order_id: randomUUID(), customer_ref: 'private_customer' }));
  const workerRpc = async (name, p) => {
    if (name === 'expired_order_candidates') return candidates;
    assert.equal(p.p_action, 'expire');
    if (p.p_order_id === candidates[0].order_id) throw new Error(`SQL ${env.SUPABASE_SECRET_KEY}`);
    return { status: 'cancelled', cancellation_reason: 'expired' };
  };
  const stats = await expireOrders({ rpc: workerRpc, log: (entry) => records.push(entry), now: () => 0 });
  assert.equal(stats.failed, 1); assert.equal(stats.expired, 2);
  assert.doesNotMatch(JSON.stringify(records), /SQL|sb_secret|private_customer/);
  let time = 0;
  const limited = await expireOrders({ rpc: workerRpc, now: () => time++ * 25000, budgetMs: 20000 });
  assert.equal(limited.deferred, 3);
  await assert.rejects(expireOrders({ rpc: async () => { throw new Error('SQL'); } }), /No pudimos confirmar/);
});

test('Netlify configura cron independiente y limite distribuido sobre todas las rutas', () => {
  assert.equal(workerConfig.schedule, '* * * * *');
  assert.equal(workerConfig.path, undefined);
  assert.equal(apiConfig.path.length, 4);
  assert.deepEqual(apiConfig.rateLimit, { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] });
});

test('rotacion no deja candidatos sin turno aunque solo quepa uno por ciclo', async () => {
  const candidates = Array.from({ length: 20 }, () => ({ order_id: randomUUID(), customer_ref: 'test' }));
  const seen = new Set();
  for (let minute = 0; minute < candidates.length; minute++) {
    let time = minute * 60000;
    const stats = await expireOrders({ now: () => time, concurrency: 1, budgetMs: 20000, rpc: async (name, params) => {
      if (name === 'expired_order_candidates') return candidates;
      seen.add(params.p_order_id); time += 20000;
      throw new Error('simulated persistent error');
    } });
    assert.equal(stats.deferred, 19);
  }
  assert.equal(seen.size, candidates.length);
});
