import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { rootCertificates, checkServerIdentity } from 'node:tls';
import { Readable } from 'node:stream';
import test, { before, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { installSchema, seed, reserve, transition } from './helpers/orders-db.mjs';
import { cargarConexion, diagnosticoSeguro, crearEliminadorProducto, eliminarProductoCatalogo, MENSAJE_HISTORIAL } from '../herramientas/gestor-local/eliminar-producto.mjs';
import { crearGestor } from '../herramientas/gestor-local/servidor.js';

let db;
before(async () => { db = new PGlite(); await installSchema(db); });
after(async () => db?.close());
const eliminador = (query = (...args) => db.query(...args)) => crearEliminadorProducto({ obtenerConexion: async () => ({}),
  log: () => {},
  crearCliente: () => ({ connect: async () => {}, end: async () => {}, query }) });

const uriPrueba = 'postgresql://postgres:Clave%40privada@db.proyectoprueba.supabase.co:5432/postgres?sslmode=require';
// Test fixture only: production requires the operator's official project CA.
const caPrueba = rootCertificates[0];
const rutaCaPrueba = path.resolve('.temp', 'fixture-root.crt');
const entornoPrueba = (uri = uriPrueba, caPath = rutaCaPrueba) =>
  `SUPABASE_URL=https://proyectoprueba.supabase.co\nGESTOR_DATABASE_URL=${uri}\nGESTOR_DATABASE_CA_PATH=${caPath}\n`;
const configPrueba = () => cargarConexion({ leerArchivo: async (file) => typeof file === 'string' ? caPrueba : entornoPrueba() });

test('CA se lee desde el archivo local y pg conserva CA, hostname y verificación', async (t) => {
  const root = path.resolve('.temp');
  await mkdir(root, { recursive: true });
  const folder = await mkdtemp(path.join(root, 'gestor-ca-'));
  t.after(async () => {
    assert.equal(path.dirname(folder), root);
    await rm(folder, { recursive: true, force: true });
  });
  const caPath = path.join(folder, 'supabase-root.crt');
  await writeFile(caPath, caPrueba);
  const config = await cargarConexion({ leerArchivo: async (file, encoding) => {
    if (typeof file === 'string') return readFile(file, encoding);
    assert.ok(file.pathname.endsWith('/herramientas/supabase/.env'));
    return entornoPrueba(uriPrueba, caPath);
  } });
  assert.equal(config.connectionString, undefined);
  const client = new pg.Client(config);
  assert.equal(client.connectionParameters.password, 'Clave@privada');
  assert.equal(client.connectionParameters.host, 'db.proyectoprueba.supabase.co');
  assert.equal(client.connectionParameters.ssl.ca, caPrueba);
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(client.connectionParameters.ssl.checkServerIdentity, checkServerIdentity);
  assert.equal(client.connectionParameters.ssl.servername, config.host);
  const cert = { subjectaltname: `DNS:${config.host}` };
  assert.equal(config.ssl.checkServerIdentity(config.host, cert), undefined);
  assert.equal(config.ssl.checkServerIdentity('otro.example', cert).code, 'ERR_TLS_CERT_ALTNAME_INVALID');
});

test('parámetros SSL o host en URI no reemplazan CA ni relajan TLS', async () => {
  const uri = `${uriPrueba}&ssl=0&sslrootcert=ignorar.crt&sslcert=ignorar.crt&sslkey=ignorar.key&host=otro.example&uselibpqcompat=true`;
  const config = await cargarConexion({ leerArchivo: async (file) => typeof file === 'string' ? caPrueba : entornoPrueba(uri) });
  const client = new pg.Client(config);
  assert.equal(client.connectionParameters.ssl.ca, caPrueba);
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(client.connectionParameters.ssl.checkServerIdentity, checkServerIdentity);
  assert.equal(client.connectionParameters.host, 'db.proyectoprueba.supabase.co');
});

test('CA ausente, inexistente, ilegible o inválida produce error claro sin ruta privada', async () => {
  await assert.rejects(cargarConexion({ leerArchivo: async () => entornoPrueba(uriPrueba, '') }), /Configura GESTOR_DATABASE_CA_PATH/);
  for (const code of ['ENOENT', 'EACCES']) {
    await assert.rejects(cargarConexion({ leerArchivo: async (file) => {
      if (typeof file !== 'string') return entornoPrueba();
      throw Object.assign(new Error(`Error ${rutaCaPrueba} password=secreto`), { code });
    } }), (e) => e.estado === 503 && /archivo CA/.test(e.message) && !e.message.includes(rutaCaPrueba) && !e.message.includes('secreto'));
  }
  await assert.rejects(cargarConexion({ leerArchivo: async (file) => typeof file === 'string' ? 'no es PEM' : entornoPrueba() }), /PEM válido/);
});

test('sin CA válida no crea cliente ni intenta borrar; log y error no contienen certificado ni URI', async () => {
  const logs = [];
  const eliminar = crearEliminadorProducto({ obtenerConexion: () => cargarConexion({ leerArchivo: async (file) => {
    if (typeof file !== 'string') return entornoPrueba();
    throw Object.assign(new Error(`ENOENT ${rutaCaPrueba}`), { code: 'ENOENT' });
  } }), crearCliente: () => assert.fail('No debe conectar sin CA'), log: (r) => logs.push(r) });
  await assert.rejects(eliminar('test'), /No existe el archivo CA/);
  assert.equal(logs[0].etapa, 'configuracion');
  assert.equal(logs[0].conectado, false);
  assert.ok(!JSON.stringify(logs).includes(rutaCaPrueba));
  const safe = diagnosticoSeguro({ message: caPrueba, detail: uriPrueba }, [uriPrueba]);
  assert.doesNotMatch(JSON.stringify(safe), /BEGIN CERTIFICATE|Clave|supabase\.co/);
});

test('diagnóstico conserva los cinco campos y redacta URI, contraseña, tokens y saltos de línea', () => {
  const error = { message: `fallo ${uriPrueba} Clave@privada db.proyectoprueba.supabase.co`, code: '23503',
    detail: 'password=oculta sb_secret_abc https://privado.test/path\nlinea', constraint: 'fk_historial', table: 'order_items',
    stack: 'NO LOG', query: 'NO LOG' };
  const safe = diagnosticoSeguro(error, [uriPrueba]);
  assert.deepEqual(Object.keys(safe), ['message', 'code', 'detail', 'constraint', 'table']);
  assert.equal(safe.code, '23503');
  assert.equal(safe.constraint, 'fk_historial');
  assert.equal(safe.table, 'order_items');
  assert.doesNotMatch(JSON.stringify(safe), /Clave|supabase\.co|privado\.test|oculta|sb_secret_abc|NO LOG|\\n/);
});

test('fallo TLS se registra antes de cualquier SQL y HTTP conserva error genérico', async () => {
  const logs = [];
  const queries = [];
  let cerrado = false;
  const eliminar = crearEliminadorProducto({ obtenerConexion: configPrueba, log: (r) => logs.push(r),
    crearCliente: () => ({ connect: async () => { throw Object.assign(new Error('self-signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }); },
      query: async (sql) => queries.push(sql), end: async () => { cerrado = true; } }) });
  await assert.rejects(eliminar('test'), (e) => e.estado === 503 && !/certificate|SELF_SIGNED/.test(e.message));
  assert.deepEqual(queries, []);
  assert.equal(cerrado, true);
  assert.deepEqual(logs[0], { event: 'gestor_eliminar_error', etapa: 'conexion', conectado: false,
    message: 'self-signed certificate in certificate chain', code: 'SELF_SIGNED_CERT_IN_CHAIN', detail: null, constraint: null, table: null });
});

test('registra conexión confirmada y error SQL seguro; rollback conserva mensaje HTTP', async () => {
  const logs = [];
  const queries = [];
  const eliminar = crearEliminadorProducto({ obtenerConexion: configPrueba, log: (r) => logs.push(r),
    crearCliente: () => ({ connection: { stream: { encrypted: true } }, connect: async () => {}, end: async () => {},
      query: async (sql) => {
        queries.push(sql);
        if (sql.startsWith('lock table')) throw Object.assign(new Error(`permiso denegado ${uriPrueba}`),
          { code: '42501', detail: 'detalle Clave@privada', constraint: 'fk_real', table: 'products' });
      } }) });
  await assert.rejects(eliminar('test'), (e) => e.estado === 503 && !/42501|permiso|Clave/.test(e.message));
  assert.deepEqual(logs[0], { event: 'gestor_eliminar_conectado', sslmode: 'verify-full', tls: true });
  assert.equal(logs[1].etapa, 'borrado');
  assert.equal(logs[1].conectado, true);
  assert.equal(logs[1].code, '42501');
  assert.equal(logs[1].constraint, 'fk_real');
  assert.equal(logs[1].table, 'products');
  assert.doesNotMatch(JSON.stringify(logs), /postgresql:|supabase\.co|Clave/);
  assert.equal(queries.at(-1), 'rollback');
});

test('fallo de configuración o logger nunca expone error crudo al frontend', async () => {
  const logs = [];
  const eliminar = crearEliminadorProducto({ obtenerConexion: async () => { throw new Error('password=no_publicar'); }, log: (r) => logs.push(r) });
  await assert.rejects(eliminar('test'), (e) => e.estado === 503 && !e.message.includes('no_publicar'));
  assert.equal(logs[0].etapa, 'configuracion');
  assert.equal(logs[0].conectado, false);
  assert.doesNotMatch(JSON.stringify(logs), /no_publicar/);
  await assert.rejects(crearEliminadorProducto({ obtenerConexion: async () => { throw new Error('password=no_publicar'); },
    log: () => { throw new Error('logger caído'); } })('test'), (e) => e.estado === 503 && !/logger|no_publicar/.test(e.message));
});

test('elimina producto y todas las dependencias reales, preserva otro producto y desaparece de disponibilidad pública', async () => {
  const f = await seed(db, [['M'], ['L']], '-delete');
  const otro = await seed(db, [['M']], '-keep');
  const { rows: [legacy] } = await db.query("insert into inventory(variant_id,size,stock) values ($1,'M',2) returning id", [f.variant]);
  await db.query('update inventory_groups set legacy_inventory_id=$1 where variant_id=$2', [legacy.id, f.variant]);
  await db.query("insert into inventory_group_sizes(inventory_group_id,size) select id,'M' from inventory_groups where variant_id=$1", [f.variant]);
  await db.query('update inventory_units set legacy_group_id=inventory_group_id where inventory_group_id in (select id from inventory_groups where variant_id=$1)', [f.variant]);
  const resultado = await eliminador()(f.product);
  assert.equal(resultado.imagenes, 'conservadas');
  assert.deepEqual(resultado.eliminados, { inventory_unit_size_options: 2, inventory_units: 2,
    variant_size_options: 2, inventory_group_sizes: 1, inventory_groups: 1, inventory: 1, variants: 1, products: 1 });
  assert.equal((await db.query('select count(*)::int n from public_inventory_availability where product_id=$1', [f.product])).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from public_inventory_availability where product_id=$1', [otro.product])).rows[0].n, 2);
  for (const [table, ids] of [['products', [f.product]], ['variants', [f.variant]]]) {
    assert.equal((await db.query(`select count(*)::int n from ${table} where id::text=any($1)`, [ids])).rows[0].n, 0);
  }
});

test('pedidos pendientes, cancelados y vendidos bloquean; no altera historial ni stock', async () => {
  for (const action of [null, 'cancel', 'complete']) {
    const f = await seed(db, [['M']], `-history-${action}`);
    const order = await reserve(db, f.items(['M']), randomUUID());
    if (action === 'complete') await transition(db, order.id, 'confirm');
    if (action) await transition(db, order.id, action);
    const snapshot = await db.query('select order_public_result($1) result', [order.id]);
    await assert.rejects(eliminador()(f.product), (e) => e.estado === 409 && e.message === MENSAJE_HISTORIAL);
    assert.deepEqual(await db.query('select order_public_result($1) result', [order.id]), snapshot);
    assert.equal((await db.query('select count(*)::int n from variants where id=$1', [f.variant])).rows[0].n, 1);
  }
});

test('inspecciona FK adicional de otro esquema y bloquea CASCADE y SET NULL', async () => {
  await db.exec('create schema audit');
  for (const mode of ['cascade', 'set null']) {
    const f = await seed(db, [['M']], `-extra-${mode.replace(' ', '-')}`);
    await db.exec(`create table audit.history(id int primary key, product text references products(id) on delete ${mode})`);
    await db.query('insert into audit.history values (1,$1)', [f.product]);
    await assert.rejects(eliminador()(f.product), (e) => e.estado === 409 && /otras relaciones/.test(e.message));
    assert.equal((await db.query('select product from audit.history')).rows[0].product, f.product);
    await db.exec('drop table audit.history');
    await eliminador()(f.product);
  }
});

test('FK de catálogo hacia otro producto no borra ni altera unidades compartidas', async () => {
  const a = await seed(db, [['M']], '-cross-a');
  const b = await seed(db, [['M']], '-cross-b');
  await db.query(`update inventory_units set legacy_group_id=(select id from inventory_groups where variant_id=$1)
    where inventory_group_id in (select id from inventory_groups where variant_id=$2)`, [a.variant, b.variant]);
  await assert.rejects(eliminador()(a.product), (e) => e.estado === 409);
});

test('un fallo a mitad del borrado revierte todas las dependencias y no filtra SQL', async () => {
  const f = await seed(db, [['M']], '-rollback-delete');
  const fallo = eliminador((sql, args) => {
    if (sql.startsWith('delete from public."inventory_groups"')) throw new Error('SQL password=secret');
    return db.query(sql, args);
  });
  await assert.rejects(fallo(f.product), (e) => e.estado === 503 && !e.message.includes('secret'));
  assert.equal((await db.query('select count(*)::int n from public_inventory_availability where product_id=$1 and stock>0', [f.product])).rows[0].n, 1);
  assert.equal((await eliminador()(f.product)).eliminados.inventory_units, 1);
});

test('catálogo local se filtra solo después del éxito; error de disco admite reintento idempotente', async () => {
  const f = await seed(db, [['M']], '-local-delete');
  let catalogo = [{ id: f.product, activo: true }, { id: 'other', activo: true }];
  const actualizarCatalogo = async (fn) => { catalogo = await fn(structuredClone(catalogo)); };
  const dependencias = { actualizarCatalogo, eliminar: eliminador() };
  await assert.rejects(eliminarProductoCatalogo(f.product, { ...dependencias, actualizarCatalogo: async (fn) => {
    await fn(structuredClone(catalogo)); throw new Error('disk full');
  } }), /Reintenta Eliminar/);
  assert.equal(catalogo.length, 2);
  await eliminarProductoCatalogo(f.product, dependencias);
  assert.deepEqual(catalogo, [{ id: 'other', activo: true }]);
  assert.equal((await db.query('select count(*)::int n from products where id=$1', [f.product])).rows[0].n, 0);
});

test('bloqueo por historial conserva también el catálogo local', async () => {
  const f = await seed(db, [['M']], '-local-history');
  await reserve(db, f.items(['M']), randomUUID());
  let catalogo = [{ id: f.product, activo: true, imagenes: ['/productos/compartida.webp'] }];
  const anterior = structuredClone(catalogo);
  await assert.rejects(eliminarProductoCatalogo(f.product, { eliminar: eliminador(),
    actualizarCatalogo: async (fn) => { catalogo = await fn(structuredClone(catalogo)); } }), /historial de pedidos/);
  assert.deepEqual(catalogo, anterior);
});

async function http(handler, method, path, payload, headers = {}) {
  const req = Readable.from(payload === undefined ? [] : [JSON.stringify(payload)]);
  Object.assign(req, { method, url: `/api/gestor${path}`, headers: { host: '127.0.0.1:4174',
    origin: 'http://127.0.0.1:5173', 'content-type': 'application/json', ...headers } });
  let status;
  let result;
  await handler(req, { writeHead: (code) => { status = code; }, end: (body) => { result = JSON.parse(body); } });
  return { status, result };
}

test('Desactivar conserva producto y variantes; DELETE exige confirmación y origen local', async () => {
  let catalogo = [{ id: 'test', activo: true, variantes: [{ id: 'azul', activo: true }] }];
  let llamadas = 0;
  const handler = crearGestor({ leer: async () => structuredClone(catalogo), guardar: async (c) => { catalogo = c; },
    eliminar: async () => { llamadas++; return { ok: true }; } });
  assert.equal((await http(handler, 'PATCH', '/productos/test/activo', { activo: false })).status, 200);
  assert.equal(catalogo[0].activo, false);
  assert.equal(catalogo[0].variantes[0].activo, true);
  assert.equal((await http(handler, 'DELETE', '/productos/test', {})).status, 400);
  for (const headers of [{ origin: undefined }, { origin: 'https://evil.test' },
    { host: 'evil.test:4174' }, { 'content-type': 'text/plain' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await http(handler, 'DELETE', '/productos/test', { confirmar: 'test' }, headers)).status, 403);
  }
  assert.equal(llamadas, 0);
  assert.equal((await http(handler, 'DELETE', '/productos/test', { confirmar: 'test' })).status, 200);
  assert.equal(llamadas, 1);
});

test('Eliminar está deshabilitado en producción sin abrir conexión', async (t) => {
  const logs = [];
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  const handler = crearGestor({ eliminar: () => assert.fail('No debe borrar') });
  assert.equal((await http(handler, 'DELETE', '/productos/test', { confirmar: 'test' })).status, 403);
  await assert.rejects(crearEliminadorProducto({ log: (r) => logs.push(r), obtenerConexion: () => assert.fail('No debe leer secretos') })('test'), (e) => e.estado === 403);
  assert.deepEqual(logs, []);
});

test('Desactivar concurrente espera a Eliminar y no recrea un producto eliminado', async () => {
  let catalogo = [{ id: 'test', activo: true }];
  let liberar;
  let iniciada;
  const inicio = new Promise((resolve) => { iniciada = resolve; });
  const pausa = new Promise((resolve) => { liberar = resolve; });
  const handler = crearGestor({ leer: async () => structuredClone(catalogo), guardar: async (c) => { catalogo = c; },
    eliminar: async () => { iniciada(); await pausa; catalogo = []; return { ok: true }; } });
  const eliminacion = http(handler, 'DELETE', '/productos/test', { confirmar: 'test' });
  await inicio;
  const desactivacion = http(handler, 'PATCH', '/productos/test/activo', { activo: false });
  liberar();
  assert.equal((await eliminacion).status, 200);
  assert.equal((await desactivacion).status, 404);
  assert.deepEqual(catalogo, []);
});

test('UI confirma con nombre, muestra acción destructiva y no incluye conexión privada', async () => {
  const ui = await readFile(new URL('../src/pages/gestor/GestorCatalogo.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/services/gestorApi.js', import.meta.url), 'utf8');
  assert.match(ui, /window\.confirm\(`¿Eliminar definitivamente “\$\{producto.nombre\}/);
  assert.match(ui, /text-red-200.*Eliminar/);
  assert.match(ui, /eliminacionEnCurso\.current/);
  assert.doesNotMatch(ui + client, /GESTOR_DATABASE_URL|pg_catalog|eliminar-producto\.mjs/);
});
