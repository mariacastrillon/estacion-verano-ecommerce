import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { crearServicioInventario } from "../herramientas/gestor-local/inventario-supabase.js";

const producto = {
  id: "producto-prueba", nombre: "Producto prueba", categoria: "trajes",
  precio: "60.000", activo: true, favorito: false, descripcion: "Descripción",
  variantes: [{ id: "azul", nombre: "Azul", codigo: "#123456", activo: true,
    miniatura: "/azul.webp", imagenes: ["/azul.webp"] }],
};

function simularSupabase({ fallar = false } = {}) {
  const products = new Map();
  const variants = new Map();
  const llamadas = [];
  const fetchImpl = async (url, opciones) => {
    const ruta = new URL(url).pathname;
    const filas = JSON.parse(opciones.body);
    llamadas.push({ ruta, metodo: opciones.method, filas });
    if (fallar && ruta.endsWith("/products")) return { ok: false, status: 503,
      json: async () => ({ code: "NETWORK", message: "Fallo simulado" }) };
    if (ruta.endsWith("/products")) {
      for (const fila of filas) products.set(fila.id, fila);
      return { ok: true, json: async () => filas.map(({ id }) => ({ id })) };
    }
    if (ruta.endsWith("/variants")) {
      for (const fila of filas) {
        const clave = `${fila.product_id}/${fila.variant_key}`;
        variants.set(clave, { ...fila, id: variants.get(clave)?.id ?? `uuid-${variants.size + 1}` });
      }
      return { ok: true, json: async () => filas.map((fila) => variants.get(`${fila.product_id}/${fila.variant_key}`)) };
    }
    throw new Error(`Tabla inesperada: ${ruta}`);
  };
  return { products, variants, llamadas, servicio: crearServicioInventario({
    fetchImpl, obtenerCredenciales: () => ({ url: "https://example.invalid", secret: "clave-simulada" }),
  }) };
}

test("producto nuevo sincroniza campos y obtiene UUID de variante", async () => {
  const db = simularSupabase();
  const resultado = await db.servicio.sincronizarProducto(producto);
  assert.equal(db.products.get(producto.id).price_cop, 60000);
  assert.equal(db.products.get(producto.id).description, producto.descripcion);
  assert.equal(resultado.variantes[0].id, "uuid-1");
  assert.equal(db.variants.get("producto-prueba/azul").images[0], "/azul.webp");
});

test("producto existente y guardado doble reutilizan las claves estables", async () => {
  const db = simularSupabase();
  await db.servicio.sincronizarProducto(producto);
  const editado = { ...producto, nombre: "Nuevo nombre", precio: "70.000" };
  const resultado = await db.servicio.sincronizarProducto(editado);
  assert.equal(resultado.variantes[0].id, "uuid-1");
  assert.equal(db.products.size, 1);
  assert.equal(db.variants.size, 1);
  assert.equal(db.products.get(producto.id).price_cop, 70000);
});

test("una variante nueva crea solo su clave faltante sin recrear la anterior", async () => {
  const db = simularSupabase();
  await db.servicio.sincronizarProducto(producto);
  const extendido = { ...producto, variantes: [...producto.variantes,
    { ...producto.variantes[0], id: "rojo", nombre: "Rojo" }] };
  const resultado = await db.servicio.sincronizarProducto(extendido);
  assert.equal(db.variants.size, 2);
  assert.deepEqual(resultado.variantes.map(({ id }) => id), ["uuid-1", "uuid-2"]);
});

test("la sincronización nunca solicita tablas físicas ni reinicializa stock", async () => {
  const db = simularSupabase();
  await db.servicio.sincronizarProducto(producto);
  assert.deepEqual(db.llamadas.map(({ ruta }) => ruta), ["/rest/v1/products", "/rest/v1/variants"]);
});

test("fallo de Supabase ocurre después del guardado local y se informa sin secretos", async () => {
  const db = simularSupabase({ fallar: true });
  await assert.rejects(db.servicio.sincronizarProducto(producto));
  const servidor = await readFile(new URL("../herramientas/gestor-local/servidor.js", import.meta.url), "utf8");
  assert.ok(servidor.indexOf("guardarProductoConImagenes({ producto") < servidor.indexOf("sincronizarGuardado(guardado)"));
  assert.match(servidor, /Producto guardado localmente\. No se pudo sincronizar/);
  assert.doesNotMatch(servidor, /SUPABASE_SECRET_KEY/);
});
