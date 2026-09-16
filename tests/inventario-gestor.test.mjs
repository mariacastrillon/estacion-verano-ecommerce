import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TALLAS_VERANO } from "../src/config/tallas.js";
import { crearServicioInventario, validarConfiguracionUnidades } from "../herramientas/gestor-local/inventario-supabase.js";
import { moverTallaVisible, prepararInventarioParaEdicion } from "../src/pages/gestor/inventario-ui.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const credenciales = () => ({ url: "https://proyecto.supabase.co", secret: "sb_secret_NO_DEBE_APARECER" });
const json = (contenido, estado = 200) => new Response(JSON.stringify(contenido), { status: estado, headers: { "Content-Type": "application/json" } });

const respuestaLegada = {
  product_id: "marea-viva",
  variants: [{
    id: "variante-azul",
    variant_key: "azul-profundo",
    name: "Azul profundo",
    units: [{
      id: "unidad-s",
      variant_id: "variante-azul",
      legacy_inventory_id: "inventario-s",
      legacy_sizes: ["S"],
      physical_size: null,
      display_sizes: ["S", "M"],
      stock: 1,
      active: true,
    }],
  }],
};

test("expone la lista completa y centralizada de tallas físicas", () => {
  assert.deepEqual(TALLAS_VERANO, ["XS", "S", "M", "L", "XL", "XXL", "ÚNICA"]);
});

test("no toma la talla histórica como talla física automáticamente", () => {
  const preparada = prepararInventarioParaEdicion(respuestaLegada);
  assert.equal(preparada.variants[0].units[0].physicalSize, null);
  assert.deepEqual(preparada.variants[0].units[0].legacySizes, ["S"]);
});

test("acepta una talla física seleccionada manualmente", () => {
  const validada = validarConfiguracionUnidades({ variant_id: "variante-azul", units: [{
    id: "unidad-s", physical_size: "S", display_sizes: ["XS", "S", "M"], stock: 1,
  }] });
  assert.equal(validada.units[0].physical_size, "S");
});

test("varias tallas visibles apuntan a una sola unidad física", () => {
  const preparada = prepararInventarioParaEdicion(respuestaLegada);
  assert.deepEqual(preparada.variants[0].units[0].displaySizes, ["S", "M"]);
  assert.equal(preparada.variants[0].units.length, 1);
});

test("la talla visible puede ser distinta de la talla física", () => {
  const validada = validarConfiguracionUnidades({ variant_id: "variante-azul", units: [{
    id: "unidad-l", physical_size: "L", display_sizes: ["XL"], stock: 1,
  }] });
  assert.equal(validada.units[0].physical_size, "L");
  assert.deepEqual(validada.units[0].display_sizes, ["XL"]);
});

test("L y XL comparten el mismo UUID y stock físico", () => {
  const unidad = validarConfiguracionUnidades({ variant_id: "variante-naranja", units: [{
    id: "unidad-l", physical_size: "L", display_sizes: ["L", "XL"], stock: 1,
  }] }).units[0];
  assert.deepEqual(unidad, { id: "unidad-l", physical_size: "L", display_sizes: ["L", "XL"], stock: 1 });
});

test("permite una segunda unidad física del mismo color", () => {
  const unidades = validarConfiguracionUnidades({ variant_id: "variante-azul", units: [
    { id: "unidad-s", physical_size: "S", display_sizes: ["XS", "S"], stock: 1 },
    { id: null, physical_size: "L", display_sizes: ["L", "XL"], stock: 1 },
  ] }).units;
  assert.equal(unidades.length, 2);
});

test("dos colores conservan tallas físicas independientes", () => {
  const preparada = prepararInventarioParaEdicion({ product_id: "producto", variants: [
    { ...respuestaLegada.variants[0], physical_size: undefined },
    { id: "variante-naranja", variant_key: "naranja", name: "Naranja", units: [{ id: "unidad-l", legacy_inventory_id: null, legacy_sizes: [], physical_size: "L", display_sizes: ["L", "XL"], stock: 1 }] },
  ] });
  preparada.variants[0].units[0].physicalSize = "S";
  assert.deepEqual(preparada.variants.map(({ units }) => units[0].physicalSize), ["S", "L"]);
});

test("rechaza guardar sin talla física", () => {
  assert.throws(() => validarConfiguracionUnidades({ variant_id: "variante", units: [{
    id: "unidad", physical_size: null, display_sizes: ["S"], stock: 0,
  }] }), /talla física válida/);
});

test("rechaza guardar sin talla visible", () => {
  assert.throws(() => validarConfiguracionUnidades({ variant_id: "variante", units: [{
    id: "unidad", physical_size: "S", display_sizes: [], stock: 0,
  }] }), /al menos una talla visible/);
});

test("guardar y reabrir conserva talla física, visibles, UUID y stock", async () => {
  let cuerpo;
  const servicio = crearServicioInventario({
    obtenerCredenciales: credenciales,
    fetchImpl: async (url, opciones) => {
      assert.match(url, /rpc\/admin_save_inventory_units$/);
      cuerpo = JSON.parse(opciones.body);
      return json([{ id: "unidad-l", variant_id: "variante", physical_size: "L", legacy_sizes: ["L"], display_sizes: ["L", "XL"], stock: 1, active: true }]);
    },
  });
  const guardada = await servicio.guardar({ variant_id: "variante", units: [{ id: "unidad-l", physical_size: "L", display_sizes: ["L", "XL"], stock: 1 }] });
  assert.equal(cuerpo.p_units[0].physical_size, "L");
  const reabierta = prepararInventarioParaEdicion({ product_id: "producto", variants: [{ id: "variante", variant_key: "naranja", name: "Naranja", units: guardada.units }] });
  const unidad = reabierta.variants[0].units[0];
  assert.deepEqual({ id: unidad.id, physicalSize: unidad.physicalSize, displaySizes: unidad.displaySizes, stock: unidad.stock }, { id: "unidad-l", physicalSize: "L", displaySizes: ["L", "XL"], stock: "1" });
});

test("ÚNICA es el único legado que puede quedar preseleccionado inequívocamente", () => {
  const preparada = prepararInventarioParaEdicion({ product_id: "gafas", variants: [{
    id: "variante-unica", variant_key: "unica", name: "Única", units: [{ id: "unidad-unica", legacy_inventory_id: "inventario-unica", legacy_sizes: ["unica"], physical_size: "ÚNICA", display_sizes: ["ÚNICA"], stock: 0 }],
  }] });
  assert.equal(preparada.variants[0].units[0].physicalSize, "ÚNICA");
});

test("una talla visible se mueve y no queda en dos unidades", () => {
  const movidas = moverTallaVisible([
    { uiId: "unidad-s", displaySizes: ["S", "M"] },
    { uiId: "unidad-l", displaySizes: ["L"] },
  ], "unidad-l", "M");
  assert.deepEqual(movidas.map(({ displaySizes }) => displaySizes), [["S"], ["L", "M"]]);
});

test("rechaza stock negativo, decimal y tallas visibles duplicadas", () => {
  const base = { variant_id: "variante", units: [{ id: "unidad", physical_size: "S", display_sizes: ["S"], stock: 0 }] };
  assert.throws(() => validarConfiguracionUnidades({ ...base, units: [{ ...base.units[0], stock: -1 }] }), /entero mayor o igual a 0/);
  assert.throws(() => validarConfiguracionUnidades({ ...base, units: [{ ...base.units[0], stock: 1.5 }] }), /entero mayor o igual a 0/);
  assert.throws(() => validarConfiguracionUnidades({ variant_id: "variante", units: [base.units[0], { id: "otra", physical_size: "M", display_sizes: ["S"], stock: 0 }] }), /dos unidades físicas/);
});

test("la nueva migración preserva legado y deja physical_size pendiente salvo ÚNICA", async () => {
  const sql = await readFile(path.join(raiz, "herramientas/supabase/2026-09-06-physical-size-options.sql"), "utf8");
  assert.match(sql, /add column if not exists physical_size text/);
  assert.match(sql, /legacy_sizes/);
  assert.match(sql, /lower\(groups\.legacy_sizes\[1\]\) in \('unica', 'única'\)/);
  assert.match(sql, /admin_save_inventory_units/);
});

test("la secret key permanece fuera del frontend y de errores", async () => {
  const frontend = (await Promise.all(["src/services/gestorApi.js", "src/pages/gestor/GestorCatalogo.jsx"].map((archivo) => readFile(path.join(raiz, archivo), "utf8")))).join("\n");
  assert.doesNotMatch(frontend, /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY|sb_secret_/);
  const servicio = crearServicioInventario({ obtenerCredenciales: credenciales, fetchImpl: async () => json({ message: "sb_secret_FILTRADA" }, 500) });
  await assert.rejects(() => servicio.leerPorProducto("producto"), (error) => error.estado === 502 && !error.message.includes("sb_secret_"));
});

test("una variante con unidades persistidas no recibe una unidad adicional", () => {
  const preparada = prepararInventarioParaEdicion(respuestaLegada);
  assert.equal(preparada.variants[0].units.length, 1);
  assert.equal(preparada.variants[0].units[0].id, "unidad-s");
});

test("una variante activa sin unidades recibe exactamente un borrador local vacío", () => {
  const preparada = prepararInventarioParaEdicion({ product_id: "producto", variants: [{
    id: "variante-fuccia", variant_key: "fuccia", name: "Fuccia", active: true, units: [],
  }] });
  assert.deepEqual(preparada.variants[0].allowedSizes, TALLAS_VERANO);
  assert.deepEqual(preparada.variants[0].units, [{
    id: null,
    uiId: "unidad-pendiente-variante-fuccia",
    physicalSize: null,
    displaySizes: [],
    legacySizes: [],
    stock: "0",
    active: true,
  }]);
});

test("dos colores pueden mostrar uno configurado y otro con borrador nuevo", () => {
  const preparada = prepararInventarioParaEdicion({ product_id: "producto", variants: [
    respuestaLegada.variants[0],
    { id: "variante-fuccia", variant_key: "fuccia", name: "Fuccia", active: true, units: [] },
  ] });
  assert.equal(preparada.variants[0].units[0].id, "unidad-s");
  assert.equal(preparada.variants[1].units.length, 1);
  assert.equal(preparada.variants[1].units[0].id, null);
});

test("guardar un borrador completado envía id null y recibe el UUID persistido", async () => {
  let cuerpo;
  const servicio = crearServicioInventario({
    obtenerCredenciales: credenciales,
    fetchImpl: async (_url, opciones) => {
      cuerpo = JSON.parse(opciones.body);
      return json([{ id: "unidad-fuccia-creada", variant_id: "variante-fuccia", physical_size: "M", legacy_sizes: [], display_sizes: ["S", "M"], stock: 1, active: true }]);
    },
  });
  const resultado = await servicio.guardar({ variant_id: "variante-fuccia", units: [{
    id: null, physical_size: "M", display_sizes: ["S", "M"], stock: 1,
  }] });
  assert.equal(cuerpo.p_units[0].id, null);
  assert.equal(resultado.units[0].id, "unidad-fuccia-creada");
});

test("al reabrir la unidad recién creada se conserva y no aparece otro borrador", () => {
  const reabierta = prepararInventarioParaEdicion({ product_id: "producto", variants: [{
    id: "variante-fuccia", variant_key: "fuccia", name: "Fuccia", active: true,
    units: [{ id: "unidad-fuccia-creada", legacy_inventory_id: null, legacy_sizes: [], physical_size: "M", display_sizes: ["S", "M"], stock: 1, active: true }],
  }] });
  assert.equal(reabierta.variants[0].units.length, 1);
  assert.deepEqual({ id: reabierta.variants[0].units[0].id, physicalSize: reabierta.variants[0].units[0].physicalSize }, { id: "unidad-fuccia-creada", physicalSize: "M" });
});
