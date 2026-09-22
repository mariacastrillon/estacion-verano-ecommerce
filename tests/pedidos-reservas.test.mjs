import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { installSchema, reserve, seed, transition } from './helpers/orders-db.mjs';

let db;
before(async () => { db = new PGlite(); await installSchema(db); });
after(async () => { await db?.close(); });

test('matching reasigna unidades flexibles y encuentra combinaciones no greedy', async () => {
  const u = Array.from({ length: 3 }, () => randomUUID());
  const match = async (edges) => (await db.query('select order_match_units($1::jsonb) as result', [JSON.stringify(edges)])).rows[0].result;
  assert.deepEqual(await match([[u[0], u[1]], [u[0]]]), [u[1], u[0]]);
  assert.deepEqual(await match([[u[0], u[1]], [u[1], u[2]], [u[0]]]), [u[1], u[2], u[0]]);
  assert.equal(await match([[u[0]], [u[0]]]), null);
});

test('matching coincide con busqueda exhaustiva en los 512 grafos de 3 por 3', async () => {
  const units = Array.from({ length: 3 }, () => randomUUID());
  function possible(edges, used = new Set(), pos = 0) {
    return pos === edges.length || edges[pos].some((u) => !used.has(u) && possible(edges, new Set([...used, u]), pos + 1));
  }
  for (let mask = 0; mask < 512; mask++) {
    const edges = Array.from({ length: 3 }, (_, slot) => units.filter((_, unit) => mask & (1 << (slot * 3 + unit))));
    const result = (await db.query('select order_match_units($1::jsonb) as result', [JSON.stringify(edges)])).rows[0].result;
    assert.equal(result !== null, possible(edges), `grafo ${mask}`);
    if (result) {
      assert.equal(new Set(result).size, 3);
      result.forEach((u, slot) => assert.ok(edges[slot].includes(u)));
    }
  }
});

test('reserva exacta, stock derivado, snapshot servidor y cancelacion idempotente', async () => {
  const f = await seed(db);
  const key = randomUUID();
  const order = await reserve(db, f.items(), key);
  assert.equal(order.status, 'pending');
  assert.equal(order.total_cop, 160000);
  assert.equal(order.items.length, 2);
  assert.doesNotMatch(JSON.stringify(order), /physical_size|inventory_unit_id|customer_ref/);
  assert.ok(new Date(order.expires_at).getTime() > Date.now());
  const units = (await db.query(`select u.status,u.active,i.display_size,c.active as compatible
    from order_item_units a join order_items i on i.id=a.order_item_id
    join inventory_units u on u.id=a.inventory_unit_id
    join inventory_unit_size_options c on c.inventory_unit_id=u.id and c.variant_size_option_id=i.variant_size_option_id
    where i.order_id=$1`, [order.id])).rows;
  assert.equal(units.length, 2);
  assert.ok(units.every((u) => u.status === 'reserved' && !u.active && u.compatible));
  const stock = (await db.query('select stock from public_inventory_availability where variant_id=$1', [f.variant])).rows;
  assert.ok(stock.every((s) => s.stock === 0));
  assert.equal((await reserve(db, f.items().reverse(), key)).id, order.id);
  await assert.rejects(reserve(db, f.items(['M']), key), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(transition(db, order.id, 'cancel', 'another-customer'), /ORDER_NOT_FOUND/);
  await db.query('update products set price_cop=90000 where id=$1', [f.product]);
  assert.equal((await reserve(db, f.items(), key)).total_cop, 160000);
  await assert.rejects(db.query('select admin_save_inventory_physical_units($1,$2::jsonb,true)', [f.variant, JSON.stringify(f.groups)]), /VARIANT_HAS_RESERVATIONS/);
  assert.equal((await transition(db, order.id, 'cancel')).status, 'cancelled');
  assert.equal((await transition(db, order.id, 'cancel')).cancellation_reason, 'requested');
  assert.equal((await db.query('select count(*)::int as n from order_item_units a join order_items i on i.id=a.order_item_id where i.order_id=$1 and a.released_at is not null', [order.id])).rows[0].n, 2);
  assert.ok((await db.query('select u.status,u.active from inventory_units u join inventory_groups g on g.id=u.inventory_group_id where g.variant_id=$1', [f.variant])).rows.every((u) => u.status === 'available' && u.active));
  assert.equal((await reserve(db, f.items(), key)).status, 'cancelled');
  const second = await reserve(db, f.items(), randomUUID());
  assert.notEqual(second.id, order.id);
  await transition(db, second.id, 'cancel');
});

test('stock insuficiente revierte pedido, lineas y todas las unidades', async () => {
  const f = await seed(db, [['M', 'L']], '-rollback');
  const key = randomUUID();
  await assert.rejects(reserve(db, f.items(), key), /INSUFFICIENT_STOCK/);
  assert.equal((await db.query('select count(*)::int as n from orders where idempotency_key=$1', [key])).rows[0].n, 0);
  assert.equal((await db.query('select stock from public_inventory_availability where variant_id=$1 limit 1', [f.variant])).rows[0].stock, 1);
  const order = await reserve(db, f.items(['M']), key);
  await assert.rejects(reserve(db, f.items(['L']), randomUUID()), /INSUFFICIENT_STOCK/);
  await transition(db, order.id, 'cancel');
});

test('valida entrada, producto/variante, estado y cantidades sin confiar en navegador', async () => {
  const f = await seed(db, [['M']], '-validation');
  for (const items of [null, [], {}, [null], [{ ...f.items(['M'])[0], stock: 99 }],
    [{ ...f.items(['M'])[0], quantity: 1.5 }], [{ ...f.items(['M'])[0], quantity: 0 }],
    [{ ...f.items(['M'])[0], quantity: 21 }], [{ ...f.items(['M'])[0], quantity: null }],
    [{ ...f.items(['M'])[0], quantity: '1' }], f.items(['M','M']),
    [{ ...f.items(['M'])[0], product_id: 'not-the-product' }], f.items(['XXL'])]) {
    await assert.rejects(reserve(db, items, randomUUID()));
  }
  await db.query('update products set active=false where id=$1', [f.product]);
  await assert.rejects(reserve(db, f.items(['M']), randomUUID()), /INVALID_SELECTION/);
  await db.query('update products set active=true where id=$1', [f.product]);
  const o = await reserve(db, f.items(['M']), randomUUID());
  await assert.rejects(transition(db, o.id, 'complete'), /CONFIRM_FIRST/);
  await transition(db, o.id, 'cancel');
});

test('confirmar y completar vende; cancelar nunca recupera una unidad vendida', async () => {
  const f = await seed(db, [['M']], '-sold');
  const o = await reserve(db, f.items(['M']), randomUUID());
  assert.equal((await transition(db, o.id, 'confirm')).status, 'confirmed');
  assert.equal((await transition(db, o.id, 'confirm')).status, 'confirmed');
  assert.equal((await transition(db, o.id, 'complete')).status, 'completed');
  assert.equal((await transition(db, o.id, 'complete')).status, 'completed');
  await assert.rejects(transition(db, o.id, 'cancel'), /INVALID_TRANSITION/);
  const unit = (await db.query('select u.status,u.active,a.sold_at,a.released_at from inventory_units u join order_item_units a on a.inventory_unit_id=u.id join order_items i on i.id=a.order_item_id where i.order_id=$1', [o.id])).rows[0];
  assert.equal(unit.status, 'sold'); assert.equal(unit.active, false);
  assert.ok(unit.sold_at); assert.equal(unit.released_at, null);
});

test('vencimiento pendiente y confirmado libera; confirmar vencido no resucita', async () => {
  const f = await seed(db, [['M']], '-expiry');
  for (const action of ['expire', 'confirm', 'complete']) {
    const o = await reserve(db, f.items(['M']), randomUUID());
    assert.equal((await transition(db, o.id, 'expire')).status, 'pending');
    if (action === 'complete') await transition(db, o.id, 'confirm');
    await db.query("update orders set expires_at=clock_timestamp()-interval '1 minute' where id=$1", [o.id]);
    assert.ok((await db.query('select * from expired_order_candidates()')).rows.some((r) => r.order_id === o.id));
    const expired = await transition(db, o.id, action);
    assert.equal(expired.status, 'cancelled'); assert.equal(expired.cancellation_reason, 'expired');
    assert.equal((await transition(db, o.id, 'expire')).status, 'cancelled');
  }
});

test('indice unico impide asignar una unidad activa dos veces', async () => {
  const f = await seed(db, [['M'], ['M']], '-unique');
  const o = await reserve(db, f.items(['M']), randomUUID());
  const other = await reserve(db, f.items(['M']), randomUUID());
  await assert.rejects(db.query(`insert into order_item_units(order_item_id,inventory_unit_id)
    select other.id,a.inventory_unit_id from order_item_units a join order_items i on i.id=a.order_item_id
    cross join order_items other where i.order_id=$1 and other.order_id=$2`, [o.id, other.id]),
  (error) => error.constraint === 'order_item_units_exclusive_idx');
  await transition(db, o.id, 'cancel');
  await transition(db, other.id, 'cancel');
});

test('cantidad dos guarda dos UUID distintos y revierte si otra variante no alcanza', async () => {
  const f = await seed(db, [['M'], ['M']], '-quantity');
  const empty = await seed(db, [], '-empty');
  const items = [{ ...f.items(['M'])[0], quantity: 2 }];
  const key = randomUUID();
  await assert.rejects(reserve(db, [...items, ...empty.items(['M'])], key), /INSUFFICIENT_STOCK/);
  assert.equal((await db.query('select count(*)::int n from orders where idempotency_key=$1', [key])).rows[0].n, 0);
  const o = await reserve(db, items, key);
  assert.equal((await db.query('select count(distinct a.inventory_unit_id)::int n from order_item_units a join order_items i on i.id=a.order_item_id where i.order_id=$1', [o.id])).rows[0].n, 2);
  await transition(db, o.id, 'cancel');
});

test('ignora compatibilidades inactivas y prendas pending, retired y sold', async () => {
  const f = await seed(db, [['M'], ['M'], ['M'], ['M', 'L']], '-inactive');
  // La RPC ordena UUIDs, no conserva el orden de entrada de prendas.
  const flexible = f.groups[0].units.find((unit) => unit.display_sizes.length === 2);
  const units = f.groups[0].units.filter((unit) => unit.id !== flexible.id);
  for (const [pos, status] of ['pending', 'retired', 'sold'].entries()) {
    await db.query('update inventory_units set status=$1,active=false where id=$2', [status, units[pos].id]);
  }
  await db.query(`update inventory_unit_size_options c set active=false from variant_size_options s
    where c.variant_size_option_id=s.id and s.display_size='M' and c.inventory_unit_id=$1`, [flexible.id]);
  await assert.rejects(reserve(db, f.items(['M']), randomUUID()), /INSUFFICIENT_STOCK/);
  const o = await reserve(db, f.items(['L']), randomUUID());
  await transition(db, o.id, 'cancel');
});

test('una escritura administrativa directa no libera ni vende una unidad asignada', async () => {
  const f = await seed(db, [['M']], '-direct');
  const o = await reserve(db, f.items(['M']), randomUUID());
  await db.exec('set role service_role');
  try {
    await assert.rejects(db.query("update inventory_units set status='available',active=true where id=$1", [f.groups[0].units[0].id]), /ORDER_UNIT_STATE_CONFLICT/);
    await assert.rejects(db.query("update inventory_units set status='sold',active=false where id=$1", [f.groups[0].units[0].id]), /ORDER_UNIT_STATE_CONFLICT/);
  } finally { await db.exec('reset role'); }
  await transition(db, o.id, 'cancel');
});

test('permisos: clientes sin RPC ni tablas; service_role solo muta pedidos por RPC', async () => {
  for (const role of ['anon', 'authenticated']) {
    const result = (await db.query(`select
      has_table_privilege($1,'orders','SELECT') as read,
      has_table_privilege($1,'order_item_units','INSERT') as write,
      has_function_privilege($1,'reserve_order(text,uuid,jsonb)','EXECUTE') as reserve,
      has_function_privilege($1,'transition_order(uuid,text,text)','EXECUTE') as change,
      has_function_privilege($1,'order_public_result(uuid)','EXECUTE') as leak,
      has_column_privilege($1,'inventory_units','physical_size','SELECT') as physical`, [role])).rows[0];
    assert.ok(Object.values(result).every((v) => v === false));
  }
  const rights = (await db.query(`select
    has_function_privilege('service_role','reserve_order(text,uuid,jsonb)','EXECUTE') as reserve,
    has_table_privilege('service_role','orders','INSERT') as direct,
    has_function_privilege('service_role','admin_save_inventory_physical_units_before_orders(uuid,jsonb,boolean)','EXECUTE') as bypass`)).rows[0];
  assert.deepEqual(rights, { reserve: true, direct: false, bypass: false });
  const f = await seed(db, [['M']], '-role');
  await db.exec('set role service_role');
  try {
    const o = await reserve(db, f.items(['M']), randomUUID());
    await transition(db, o.id, 'cancel');
    await assert.rejects(db.query('select order_public_result($1)', [o.id]), /permission denied/);
  } finally { await db.exec('reset role'); }
});
