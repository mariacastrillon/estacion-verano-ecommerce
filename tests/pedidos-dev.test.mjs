import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createServer } from 'vite';
import { pedidosDevPlugin } from '../herramientas/pedidos/vite-plugin.mjs';

test('la desactivacion explicita del proceso evita cargar reservas y ejecutar el worker', async (t) => {
  const previous = process.env.ORDERS_API_ENABLED;
  process.env.ORDERS_API_ENABLED = 'false';
  t.after(() => {
    if (previous === undefined) delete process.env.ORDERS_API_ENABLED;
    else process.env.ORDERS_API_ENABLED = previous;
  });
  const plugin = pedidosDevPlugin({ rpcFactory: () => assert.fail('No debe acceder a Supabase') });
  const config = await plugin.config();
  assert.equal(config.define['import.meta.env.VITE_ORDERS_DEV'], '"false"');
  plugin.configureServer({ middlewares: { use: () => assert.fail('No debe instalar la API') } });
});

test('Vite expone handlers aislados y worker local con cookie y rate limit', async () => {
  const calls = [];
  const config = { ORDERS_API_ENABLED: 'true', ORDERS_EXPIRATION_ENABLED: 'true', ORDERS_SESSION_SECRET: 'local-test-secret-only-at-least-32-bytes' };
  const order = { id: randomUUID(), status: 'pending', expires_at: new Date(Date.now() + 1800000).toISOString(), currency: 'COP', total_cop: 80000,
    items: [{ product_id: 'prueba', variant_id: randomUUID(), display_size: 'M', quantity: 1, product_name: 'Prueba', variant_name: 'Azul', unit_price_cop: 80000 }] };
  const plugin = pedidosDevPlugin({ loadConfig: async () => config, log: () => {}, rpcFactory: () => async (name, params) => {
    calls.push({ name, params });
    if (name === 'expired_order_candidates') return [];
    if (name === 'transition_order') return { ...order, status: 'cancelled' };
    return order;
  } });
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', plugins: [plugin],
    server: { host: '127.0.0.1', port: 0, strictPort: false } });
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    config.ORDERS_ALLOWED_ORIGIN = origin;
    const post = (action, body, cookie = '') => fetch(`${origin}/api/pedidos/${action}`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
    const session = await post('sesion', {});
    assert.equal(session.status, 200);
    const cookie = session.headers.get('set-cookie').split(';')[0];
    assert.match(cookie, /^verano_orders_dev=/);
    assert.ok(calls.some(({ name }) => name === 'expired_order_candidates'));
    const response = await post('reservar', { attempt_id: randomUUID(), items: [{ product_id: 'prueba',
      variant_id: order.items[0].variant_id, display_size: 'M', quantity: 1 }] }, cookie);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).order.id, order.id);
    const cancelled = await post('cancelar', { order_id: order.id }, cookie);
    assert.equal((await cancelled.json()).order.status, 'cancelled');
    const cross = await fetch(`${origin}/api/pedidos/sesion`, { method: 'POST', headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(cross.status, 403);
    let responseLimit;
    for (let i = 0; i < 18; i++) responseLimit = await post('sesion', {}, cookie);
    assert.equal(responseLimit.status, 429);
    assert.equal(responseLimit.headers.get('retry-after'), '60');
  } finally { await server.close(); }
});

test('sin ciclo de expiracion saludable no admite reservas locales', async () => {
  const config = { ORDERS_API_ENABLED: 'true', ORDERS_EXPIRATION_ENABLED: 'true', ORDERS_SESSION_SECRET: 'local-test-secret-only-at-least-32-bytes' };
  const calls = [];
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent',
    plugins: [pedidosDevPlugin({ loadConfig: async () => config, log: () => {}, rpcFactory: () => async (name) => {
      calls.push(name); throw new Error('fake failure');
    } })], server: { host: '127.0.0.1', port: 0, strictPort: false } });
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    config.ORDERS_ALLOWED_ORIGIN = origin;
    const headers = { Origin: origin, 'Content-Type': 'application/json' };
    const session = await fetch(`${origin}/api/pedidos/sesion`, { method: 'POST', headers, body: '{}' });
    const cookie = session.headers.get('set-cookie').split(';')[0];
    const response = await fetch(`${origin}/api/pedidos/reservar`, { method: 'POST', headers: { ...headers, Cookie: cookie },
      body: JSON.stringify({ attempt_id: randomUUID(), items: [] }) });
    assert.equal(response.status, 503);
    assert.ok(!calls.includes('reserve_order'));
  } finally { await server.close(); }
});
