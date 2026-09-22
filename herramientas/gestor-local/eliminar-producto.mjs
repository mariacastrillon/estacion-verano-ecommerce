import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { X509Certificate } from 'node:crypto';
import { checkServerIdentity } from 'node:tls';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';
import { ErrorInventario } from './inventario-supabase.js';

export const MENSAJE_HISTORIAL = 'Este producto tiene historial de pedidos y no puede eliminarse definitivamente. Puedes desactivarlo para retirarlo del catálogo.';
const mensajeRelaciones = 'Este producto tiene otras relaciones o historial que deben conservarse. No puede eliminarse definitivamente; puedes desactivarlo.';
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const tabla = (name) => `public.${quote(name)}`;

// Dependency order confirmed against the project's Supabase OpenAPI metadata.
// Only these catalogue tables may be deleted. Any other inbound FK is history.
const seleccion = {
  products: 'select id from public.products where id=$1',
  variants: 'select id from public.variants where product_id=$1',
  inventory: 'select i.id from public.inventory i join public.variants v on v.id=i.variant_id where v.product_id=$1',
  inventory_groups: 'select g.id from public.inventory_groups g join public.variants v on v.id=g.variant_id where v.product_id=$1',
  variant_size_options: 'select o.id from public.variant_size_options o join public.variants v on v.id=o.variant_id where v.product_id=$1',
  inventory_group_sizes: 'select s.id from public.inventory_group_sizes s join public.inventory_groups g on g.id=s.inventory_group_id join public.variants v on v.id=g.variant_id where v.product_id=$1',
  inventory_units: 'select u.id from public.inventory_units u join public.inventory_groups g on g.id=u.inventory_group_id join public.variants v on v.id=g.variant_id where v.product_id=$1',
  inventory_unit_size_options: 'select s.id from public.inventory_unit_size_options s join public.inventory_units u on u.id=s.inventory_unit_id join public.inventory_groups g on g.id=u.inventory_group_id join public.variants v on v.id=g.variant_id where v.product_id=$1',
};
const orden = ['inventory_unit_size_options', 'inventory_units', 'variant_size_options',
  'inventory_group_sizes', 'inventory_groups', 'inventory', 'variants', 'products'];

export async function inspeccionarRelaciones(client) {
  // All schemas, including FKs absent from PostgREST. Preserve column order for
  // composite FKs. Identifiers below come from pg_catalog, never from the UI.
  return (await client.query(`select c.conname, ns.nspname as child_schema, t.relname as child_table,
    ps.nspname as parent_schema, p.relname as parent_table, c.confdeltype,
    array(select a.attname::text from unnest(c.conkey) with ordinality k(n,pos)
      join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.n order by k.pos) as child_columns,
    array(select a.attname::text from unnest(c.confkey) with ordinality k(n,pos)
      join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.n order by k.pos) as parent_columns
    from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace ns on ns.oid=t.relnamespace
    join pg_class p on p.oid=c.confrelid join pg_namespace ps on ps.oid=p.relnamespace
    where c.contype='f' and ps.nspname='public' and p.relname=any($1::text[])
    order by ns.nspname,t.relname,c.conname`, [Object.keys(seleccion)])).rows;
}

// The caller owns BEGIN/COMMIT. No RPC, grants, migrations or public endpoint.
export async function borrarProductoEnTransaccion(client, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(id)) {
    throw new ErrorInventario('ID de producto inválido.', 400);
  }
  // Short, local administrative operation: stop writes (including reservations)
  // while inspecting actual FKs and deleting. Readers continue to work.
  await client.query(`lock table ${Object.keys(seleccion).sort().map(tabla).join(', ')} in share row exclusive mode`);
  const relaciones = await inspeccionarRelaciones(client);
  const hijos = [...new Set(relaciones.map((r) => `${quote(r.child_schema)}.${quote(r.child_table)}`))].sort();
  if (hijos.length) await client.query(`lock table ${hijos.join(', ')} in share row exclusive mode`);
  for (const r of relaciones) {
    const condiciones = r.child_columns.map((column, index) => `h.${quote(column)}=p.${quote(r.parent_columns[index])}`).join(' and ');
    const hijoCatalogo = r.child_schema === 'public' && Object.hasOwn(seleccion, r.child_table);
    // Even a known catalogue FK must not affect rows belonging to another
    // product (e.g. a legacy pointer to a shared group).
    const fuera = hijoCatalogo ? `and h.id not in (${seleccion[r.child_table]})` : '';
    const { rows: [row] } = await client.query(`select exists(select 1 from ${quote(r.child_schema)}.${quote(r.child_table)} h
      join ${tabla(r.parent_table)} p on ${condiciones}
      where p.id in (${seleccion[r.parent_table]}) ${fuera}) as blocked`, [id]);
    if (row.blocked) throw new ErrorInventario(['order_items', 'order_item_units'].includes(r.child_table)
      ? MENSAJE_HISTORIAL : mensajeRelaciones, 409);
    if (hijoCatalogo && orden.indexOf(r.child_table) >= orden.indexOf(r.parent_table)) {
      throw new ErrorInventario('Las dependencias de catálogo cambiaron. Deben revisarse antes de eliminar.', 409);
    }
  }
  const { rows: [historial] } = await client.query(`select exists(select 1 from public.inventory_units
    where id in (${seleccion.inventory_units}) and status in ('reserved','sold')) as blocked`, [id]);
  if (historial.blocked) throw new ErrorInventario(mensajeRelaciones, 409);
  const eliminados = {};
  for (const name of orden) {
    // Save target IDs before deleting children, so all selections stay stable.
    // Every selector only traverses parent tables, which still exist here.
    const result = await client.query(`delete from ${tabla(name)} where id in (${seleccion[name]})`, [id]);
    eliminados[name] = result.rowCount;
  }
  await client.query('set constraints all immediate');
  return { eliminados, imagenes: 'conservadas' };
}

export async function cargarConexion({ leerArchivo = readFile } = {}) {
  let env;
  try { env = parseEnv(await leerArchivo(new URL('../supabase/.env', import.meta.url), 'utf8')); }
  catch { throw new ErrorInventario('No se pudo leer la configuración privada del gestor.', 503); }
  const uri = env.GESTOR_DATABASE_URL;
  let db;
  try {
    db = new URL(uri);
    const api = new URL(env.SUPABASE_URL);
    const ref = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
    const mismoProyecto = ref && (db.hostname === `db.${ref}.supabase.co`
      || (db.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(db.username).endsWith(`.${ref}`)));
    if (!['postgres:', 'postgresql:'].includes(db.protocol) || !mismoProyecto || !db.password
      || db.pathname !== '/postgres' || !['require', 'verify-full'].includes(db.searchParams.get('sslmode'))) throw new Error();
  } catch {
    throw new ErrorInventario('Configura GESTOR_DATABASE_URL en herramientas/supabase/.env con la conexión PostgreSQL del mismo proyecto y sslmode=require. No se ha eliminado nada.', 503);
  }
  if (!env.GESTOR_DATABASE_CA_PATH || !path.isAbsolute(env.GESTOR_DATABASE_CA_PATH)) {
    throw new ErrorInventario('Configura GESTOR_DATABASE_CA_PATH con la ruta absoluta al certificado raíz oficial descargado de Supabase.', 503);
  }
  let ca;
  try { ca = await leerArchivo(env.GESTOR_DATABASE_CA_PATH, 'utf8'); }
  catch (error) {
    throw new ErrorInventario(error.code === 'ENOENT'
      ? 'No existe el archivo CA de GESTOR_DATABASE_CA_PATH. Descarga el certificado raíz oficial de Supabase y revisa la ruta.'
      : 'No se pudo leer el archivo CA de GESTOR_DATABASE_CA_PATH. Revisa la ruta y sus permisos.', 503);
  }
  try {
    if (!ca.includes('-----BEGIN CERTIFICATE-----') || ca.includes('PRIVATE KEY') || !new X509Certificate(ca).ca) throw new Error();
  } catch { throw new ErrorInventario('El archivo CA no es un certificado raíz PEM válido. Usa Download Certificate del proyecto Supabase.', 503); }
  // Do not pass connectionString to pg: its SSL URL parameters replace ssl.ca.
  // Only explicit, validated connection fields reach the driver. URL query
  // options cannot override the hostname, CA or certificate verification.
  return { host: db.hostname, port: Number(db.port || 5432), user: decodeURIComponent(db.username),
    password: decodeURIComponent(db.password), database: 'postgres',
    ssl: { ca, rejectUnauthorized: true, servername: db.hostname, checkServerIdentity } };
}

export function diagnosticoSeguro(error, secretos = []) {
  const privados = new Set(secretos.filter((value) => typeof value === 'string' && value));
  for (const value of [...privados]) {
    try {
      const url = new URL(value);
      for (const parte of [url.hostname, url.username, url.password, ...url.searchParams.values()]) {
        if (!parte || ['require', 'verify-full'].includes(parte)) continue;
        privados.add(parte);
        try { privados.add(decodeURIComponent(parte)); } catch { /* Invalid encoding. */ }
      }
    } catch { /* Also accept plain secrets. */ }
  }
  const redactar = (value) => {
    if (typeof value !== 'string') return null;
    let texto = value;
    for (const secreto of [...privados].sort((a, b) => b.length - a.length)) texto = texto.replaceAll(secreto, '[REDACTADO]');
    return texto.replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[CERTIFICADO REDACTADO]')
      .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"'<>]+/gi, '[URL REDACTADA]')
      .replace(/\b(?:password|passwd|pwd|secret|token|apikey|api_key)\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '[CREDENCIAL REDACTADA]')
      .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9._-]+/g, '[CLAVE REDACTADA]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[TOKEN REDACTADO]')
      .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').slice(0, 2000);
  };
  return Object.fromEntries(['message', 'code', 'detail', 'constraint', 'table'].map((key) => [key, redactar(error?.[key])]));
}

async function registrarErrorLocal(error, contexto, log, conexion, client) {
  if (process.env.NODE_ENV === 'production') return;
  const secretos = [conexion?.host, conexion?.password, conexion?.ssl?.ca,
    client?.connectionParameters?.host, client?.connectionParameters?.password,
    ...Object.entries(process.env).filter(([key]) => /SECRET|PASSWORD|TOKEN|DATABASE_URL|SUPABASE_URL|SERVICE_ROLE|API_KEY/i.test(key)).map(([, value]) => value)];
  try {
    const env = parseEnv(await readFile(new URL('../supabase/.env', import.meta.url), 'utf8'));
    secretos.push(...Object.values(env));
  } catch { /* Configuration may be the failing stage. */ }
  try { log({ event: 'gestor_eliminar_error', ...contexto, ...diagnosticoSeguro(error, secretos) }); }
  catch { /* Logging must never replace the sanitized HTTP error. */ }
}

export function crearEliminadorProducto({ obtenerConexion = cargarConexion,
  log = (record) => console.error('[gestor:eliminar]', record),
  crearCliente = (config) => new pg.Client({ ...config, connectionTimeoutMillis: 5000,
    statement_timeout: 10000, query_timeout: 15000, lock_timeout: 5000, idle_in_transaction_session_timeout: 15000 }) } = {}) {
  return async (id) => {
    if (process.env.NODE_ENV === 'production') throw new ErrorInventario('La eliminación solo está disponible en el gestor local.', 403);
    let client, conexion;
    let etapa = 'configuracion';
    let conectado = false;
    let transaccion = false;
    try {
      conexion = await obtenerConexion();
      etapa = 'conexion';
      client = crearCliente(conexion);
      await client.connect();
      conectado = true;
      try { if (process.env.NODE_ENV !== 'production') log({ event: 'gestor_eliminar_conectado', sslmode: 'verify-full',
        tls: client.connection?.stream?.encrypted === true }); } catch { /* Test doubles or unavailable logger. */ }
      etapa = 'begin';
      await client.query('begin');
      transaccion = true;
      // Owner connection must not silently skip history hidden by RLS.
      etapa = 'permisos';
      await client.query('set local row_security = off');
      etapa = 'borrado';
      const result = await borrarProductoEnTransaccion(client, id);
      etapa = 'commit';
      await client.query('commit');
      return result;
    } catch (error) {
      await registrarErrorLocal(error, { etapa, conectado }, log, conexion, client);
      if (transaccion) try { await client.query('rollback'); } catch { /* Disconnected: close below. */ }
      if (error instanceof ErrorInventario) throw error;
      if (error.code === '23503') throw new ErrorInventario(mensajeRelaciones, 409);
      throw new ErrorInventario('No se pudo confirmar la eliminación en Supabase. Reintenta; el catálogo local se conserva.', 503);
    } finally { if (client) await client.end().catch(() => {}); }
  };
}

export const eliminarProductoSupabase = crearEliminadorProducto();

export async function eliminarProductoCatalogo(id, { actualizarCatalogo, eliminar = eliminarProductoSupabase }) {
  let resultado;
  let borradoConfirmado = false;
  try {
    await actualizarCatalogo(async (catalogo) => {
      if (!catalogo.some((p) => p.id === id)) throw new ErrorInventario('Producto no encontrado.', 404);
      resultado = await eliminar(id);
      borradoConfirmado = true;
      return catalogo.filter((p) => p.id !== id);
    });
  } catch (error) {
    if (borradoConfirmado) throw new ErrorInventario('Producto eliminado en Supabase, pero no se pudo guardar el catálogo local. Reintenta Eliminar para completar la sincronización; no vuelvas a guardar el producto.', 503);
    throw error;
  }
  return { ...resultado, id, mensaje: 'Producto eliminado. Las imágenes locales se conservaron.' };
}
