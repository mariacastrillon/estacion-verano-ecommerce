import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { after, afterEach, before, test } from 'node:test';
import { installSchema, reserve, seed, transition } from './helpers/orders-db.mjs';
import { startLocalPostgres } from './helpers/native-postgres.mjs';
import { borrarProductoEnTransaccion, MENSAJE_HISTORIAL } from '../herramientas/gestor-local/eliminar-producto.mjs';

let cluster, db, a, b;
before(async () => {
  cluster = await startLocalPostgres();
  db = await cluster.connect(); a = await cluster.connect(); b = await cluster.connect();
  await installSchema(db);
});
after(async () => { await cluster?.close(); });
afterEach(async () => { await Promise.all([a?.query('rollback'), b?.query('rollback')]); });

test('Eliminar espera una reserva concurrente y conserva su historial al confirmar', async () => {
  const f = await seed(db, [['M']], '-delete-race');
  await a.query('begin');
  const order = await reserve(a, f.items(['M']), randomUUID());
  await b.query('begin');
  const next = borrarProductoEnTransaccion(b, f.product).then((result) => ({ result }), (error) => ({ error }));
  try { await waitForLock(b); } finally { await a.query('commit'); }
  const result = await next;
  await b.query('rollback');
  assert.equal(result.error?.message, MENSAJE_HISTORIAL);
  assert.equal((await db.query('select status from orders where id=$1', [order.id])).rows[0].status, 'pending');
  await transition(db, order.id, 'cancel');
});

test('reserva que llega durante Eliminar espera y no crea historial huérfano', async () => {
  const f = await seed(db, [['M']], '-reserve-delete-race');
  await a.query('begin');
  await borrarProductoEnTransaccion(a, f.product);
  const key = randomUUID();
  const next = reserve(b, f.items(['M']), key).then((result) => ({ result }), (error) => ({ error }));
  try { await waitForLock(b); } finally { await a.query('commit'); }
  assert.ok((await next).error);
  assert.equal((await db.query('select count(*)::int n from orders where idempotency_key=$1', [key])).rows[0].n, 0);
});

// Observar espera real en pg_stat_activity, sin depender de un sleep arbitrario.
async function waitForLock(client) {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    const row = (await db.query('select wait_event_type from pg_stat_activity where pid=$1', [client.processID])).rows[0];
    if (row?.wait_event_type === 'Lock') return;
    await setTimeout(20);
  }
  assert.fail('La segunda conexion no espero el bloqueo');
}

test('dos pedidos simultaneos sobre una prenda: uno gana y otro revierte', async () => {
  const f = await seed(db, [['M', 'L']], '-race');
  await a.query('begin');
  const first = await reserve(a, f.items(['M']), randomUUID());
  const key = randomUUID();
  const next = reserve(b, f.items(['L']), key).then((result) => ({ result }), (error) => ({ error }));
  try { await waitForLock(b); } finally { await a.query('commit'); }
  const loser = await next;
  assert.match(loser.error?.message ?? '', /INSUFFICIENT_STOCK/);
  assert.equal((await db.query('select count(*)::int n from orders where idempotency_key=$1', [key])).rows[0].n, 0);
  await transition(db, first.id, 'cancel');
});

test('si el primer comprador hace rollback el segundo consigue la prenda', async () => {
  const f = await seed(db, [['M']], '-race-rollback');
  await a.query('begin');
  const rolledBack = await reserve(a, f.items(['M']), randomUUID());
  const next = reserve(b, f.items(['M']), randomUUID());
  try { await waitForLock(b); } finally { await a.query('rollback'); }
  const winner = await next;
  assert.equal(winner.status, 'pending');
  assert.equal((await db.query('select count(*)::int n from orders where id=$1', [rolledBack.id])).rows[0].n, 0);
  await transition(db, winner.id, 'cancel');
});

test('reintentos concurrentes crean un solo pedido', async () => {
  const f = await seed(db, [['M']], '-race-idempotent');
  const key = randomUUID();
  await a.query('begin');
  const first = await reserve(a, f.items(['M']), key);
  const next = reserve(b, f.items(['M']), key);
  try { await waitForLock(b); } finally { await a.query('commit'); }
  assert.equal((await next).id, first.id);
  assert.equal((await db.query('select count(*)::int n from orders where idempotency_key=$1', [key])).rows[0].n, 1);
  await transition(db, first.id, 'cancel');
});

test('el gestor espera la reserva y no puede reconfigurarla despues', async () => {
  const f = await seed(db, [['M']], '-race-admin');
  await a.query('begin');
  const first = await reserve(a, f.items(['M']), randomUUID());
  const next = b.query('select admin_save_inventory_physical_units($1,$2::jsonb,true)', [f.variant, JSON.stringify(f.groups)])
    .then((result) => ({ result }), (error) => ({ error }));
  try { await waitForLock(b); } finally { await a.query('commit'); }
  assert.match((await next).error?.message ?? '', /VARIANT_HAS_RESERVATIONS/);
  await transition(db, first.id, 'cancel');
});

test('cancelar contra completar: una sola transicion terminal y sin revivir vendidos', async () => {
  const f = await seed(db, [['M']], '-race-complete');
  const o = await reserve(db, f.items(['M']), randomUUID());
  await transition(db, o.id, 'confirm');
  await a.query('begin');
  await transition(a, o.id, 'complete');
  const next = transition(b, o.id, 'cancel').then((result) => ({ result }), (error) => ({ error }));
  try { await waitForLock(b); } finally { await a.query('commit'); }
  assert.match((await next).error?.message ?? '', /INVALID_TRANSITION/);
  assert.equal((await db.query('select status from orders where id=$1', [o.id])).rows[0].status, 'completed');
  assert.equal((await db.query('select u.status from inventory_units u join inventory_groups g on g.id=u.inventory_group_id where g.variant_id=$1', [f.variant])).rows[0].status, 'sold');
});

test('FOR UPDATE espera incluso a un escritor que no toma advisory lock', async () => {
  const f = await seed(db, [['M']], '-race-row');
  await a.query('begin');
  await a.query("update inventory_units set status='retired',active=false where id=$1", [f.groups[0].units[0].id]);
  const next = reserve(b, f.items(['M']), randomUUID()).then((result) => ({ result }), (error) => ({ error }));
  try { await waitForLock(b); } finally { await a.query('commit'); }
  assert.match((await next).error?.message ?? '', /INSUFFICIENT_STOCK/);
});
