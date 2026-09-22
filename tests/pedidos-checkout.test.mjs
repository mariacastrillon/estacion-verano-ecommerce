import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { crearClientePedidos } from '../src/services/pedidos.js';

const lines = [{ productoId: 'p1', varianteId: randomUUID(), selectedSize: 'M', cantidad: 1, stockDisponible: 90, precio: '80.000' },
  { productoId: 'p1', varianteId: randomUUID(), selectedSize: 'L', cantidad: 2 }];
const order = { id: randomUUID(), status: 'pending', expires_at: '2026-10-01T12:00:00Z', currency: 'COP', total_cop: 240000,
  items: lines.map((l) => ({ product_id: l.productoId, variant_id: l.varianteId, display_size: l.selectedSize, quantity: l.cantidad,
    product_name: 'Producto', variant_name: 'Azul', unit_price_cop: 80000 })) };
function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}
const success = () => Response.json({ order });

test('checkout envia solo identificadores comerciales y doble clic comparte intento', async () => {
  const calls = [];
  const client = crearClientePedidos({ storage: storage(), fetchImpl: async (path, options) => {
    calls.push({ path, payload: JSON.parse(options.body) });
    assert.equal(options.credentials, 'same-origin');
    return path.endsWith('sesion') ? Response.json({ ok: true }) : success();
  } });
  const a = client.reserve(lines), b = client.reserve(lines);
  assert.equal(a, b);
  assert.equal((await a).order.id, order.id);
  assert.equal(calls.length, 2);
  assert.doesNotMatch(JSON.stringify(calls), /stockDisponible|precio|customer_ref|idempotency_key|physical_size|inventory_unit_id/);
  assert.deepEqual(calls[1].payload.items.map((i) => i.quantity), [1, 2]);
  assert.equal((await client.reserve([])).order.id, order.id);
  assert.equal(calls.length, 2);
  assert.throws(() => client.reset(), /Recupera o cancela/);
});

test('respuesta perdida y recarga conservan UUID, lineas y sesion sin crear otro pedido', async () => {
  const saved = storage();
  let original;
  const first = crearClientePedidos({ storage: saved, fetchImpl: async (path, options) => {
    if (path.endsWith('sesion')) return Response.json({ ok: true });
    original = JSON.parse(options.body);
    throw new Error('connection lost after database commit');
  } });
  await assert.rejects(first.reserve(lines), /Reintenta el mismo pedido/);
  assert.throws(() => first.reset(), /Recupera o cancela/);
  const second = crearClientePedidos({ storage: saved, fetchImpl: async (path, options) => {
    assert.ok(path.endsWith('reservar'));
    assert.deepEqual(JSON.parse(options.body), original);
    return success();
  } });
  assert.equal((await second.reserve([{ ...lines[0], cantidad: 9 }])).order.id, order.id);
});

test('stock agotado permite revisar carrito e iniciar un nuevo intento explicitamente', async () => {
  const client = crearClientePedidos({ storage: storage(), fetchImpl: async (path) => path.endsWith('sesion')
    ? Response.json({ ok: true }) : Response.json({ error: 'INSUFFICIENT_STOCK', message: 'INTERNAL SQL' }, { status: 409 }) });
  await assert.rejects(client.reserve(lines), /no hay stock suficiente/);
  assert.equal(client.load().failure, 'INSUFFICIENT_STOCK');
  client.reset(); assert.equal(client.load(), null);
});

test('cancelacion y consulta de vencimiento actualizan el pedido persistido', async () => {
  let expired = false;
  const calls = [];
  const client = crearClientePedidos({ storage: storage(), fetchImpl: async (path, options) => {
    calls.push(path);
    if (path.endsWith('sesion')) return Response.json({ ok: true });
    if (path.endsWith('cancelar') || path.endsWith('estado')) {
      assert.deepEqual(JSON.parse(options.body), { order_id: order.id });
      return Response.json({ order: { ...order, status: 'cancelled', cancellation_reason: expired ? 'expired' : 'requested' } });
    }
    return success();
  } });
  await client.reserve(lines);
  assert.equal((await client.cancel()).order.status, 'cancelled');
  client.reset(); await client.reserve(lines); expired = true;
  assert.equal((await client.refresh()).order.cancellation_reason, 'expired');
  assert.ok(calls.includes('/api/pedidos/cancelar'));
  assert.ok(calls.includes('/api/pedidos/estado'));
});

test('sesion perdida o servicio caido no rota el intento ni refleja errores internos', async () => {
  let errorCode = 'UNAVAILABLE';
  const client = crearClientePedidos({ storage: storage(), fetchImpl: async (path) => path.endsWith('sesion')
    ? Response.json({ ok: true }) : Response.json({ error: errorCode, message: 'SQL sb_secret_123' }, { status: 503 }) });
  await assert.rejects(client.reserve(lines), /Reintenta el mismo pedido/);
  const id = client.load().attempt_id;
  errorCode = 'SESSION_REQUIRED';
  await assert.rejects(client.reserve(lines), /Se perdió la sesión/);
  assert.equal(client.load().attempt_id, id);
  assert.throws(() => client.reset());
});

test('sin almacenamiento no se envia una reserva que luego no pueda recuperarse', async () => {
  const calls = [];
  const client = crearClientePedidos({ storage: { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } },
    fetchImpl: async (path) => { calls.push(path); return Response.json({ ok: true }); } });
  await assert.rejects(client.reserve(lines), /Storage unavailable/);
  assert.deepEqual(calls, ['/api/pedidos/sesion']);
});

test('rate limit HTML de Netlify conserva intento y pide esperar', async () => {
  const client = crearClientePedidos({ storage: storage(), fetchImpl: async (path) => path.endsWith('sesion')
    ? Response.json({ ok: true }) : new Response('<h1>Too many requests</h1>', { status: 429 }) });
  await assert.rejects(client.reserve(lines), /Espera un minuto/);
  assert.ok(client.load().attempt_id);
  assert.throws(() => client.reset());
});

test('cancelar mientras se actualiza el estado espera y no pierde la cancelacion', async () => {
  let release;
  const calls = [];
  const client = crearClientePedidos({ storage: storage(), fetchImpl: async (path) => {
    calls.push(path);
    if (path.endsWith('sesion')) return Response.json({ ok: true });
    if (path.endsWith('estado')) return new Promise((resolve) => { release = () => resolve(success()); });
    if (path.endsWith('cancelar')) return Response.json({ order: { ...order, status: 'cancelled' } });
    return success();
  } });
  await client.reserve(lines);
  const refresh = client.refresh();
  const cancel = client.cancel();
  release();
  await refresh;
  assert.equal((await cancel).order.status, 'cancelled');
  assert.deepEqual(calls.slice(-2), ['/api/pedidos/estado', '/api/pedidos/cancelar']);
});

test('frontend no importa backend ni llama RPC privadas; checkout limitado a DEV', async () => {
  const root = new URL('../src/', import.meta.url);
  const files = await readdir(root, { recursive: true });
  for (const file of files.filter((file) => /\.(js|jsx)$/.test(file))) {
    const source = await readFile(new URL(file.replaceAll('\\', '/'), root), 'utf8');
    assert.doesNotMatch(source, /reserve_order|transition_order|expired_order_candidates|SUPABASE_SECRET_KEY|ORDERS_SESSION_SECRET|server\/orders/);
  }
  const checkout = await readFile(new URL('../src/pages/Checkout.jsx', import.meta.url), 'utf8');
  assert.match(checkout, /import\.meta\.env\.DEV && import\.meta\.env\.VITE_ORDERS_DEV === 'true'/);
  assert.match(checkout, /lazy\(\(\) => import/);
  const ui = await readFile(new URL('../src/components/CheckoutReservas.jsx', import.meta.url), 'utf8');
  assert.match(ui, /await revalidar\(\)/);
  assert.match(ui, /Cancelar reserva/);
  assert.match(ui, /Consultar por WhatsApp/);
});
