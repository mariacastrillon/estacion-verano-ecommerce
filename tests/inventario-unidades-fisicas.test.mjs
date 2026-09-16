import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { crearServicioInventario, validarConfiguracionGrupos } from "../herramientas/gestor-local/inventario-supabase.js";
import { alternarCompatibilidadUnidad, alternarTallaDeGrupo, fusionarGrupoEnPrimero, prepararGrupoFisico, prepararInventarioFisico, stockDerivado } from "../src/pages/gestor/inventario-fisico-ui.js";

const unit = (id, physicalSize, displaySizes) => ({ id, physical_size: physicalSize, display_sizes: displaySizes });
const group = (units, displaySizes = ["M", "L"], id = "grupo") => ({ id, display_sizes: displaySizes, units });
const validar = (groups) => validarConfiguracionGrupos({ variant_id: "variante", groups });
const preparada = (units, displaySizes = ["M", "L"]) => prepararInventarioFisico({
  product_id: "producto",
  variants: [{ id: "variante", active: true, name: "Negro", groups: [group(units, displaySizes)] }],
}).variants[0].groups[0];
const json = (valor, status = 200) => new Response(JSON.stringify(valor), { status });

test("una unidad tiene exactamente una talla física y stock uno", () => {
  const [resultado] = validar([group([unit("u1", "M", ["M"])])]).groups[0].units;
  assert.equal(resultado.physical_size, "M");
  assert.equal(stockDerivado(preparada([{ id: "u1", physical_size: "M", display_sizes: ["M"], status: "available" }])), 1);
});

test("dos unidades físicas de Negro pueden ser M y L", () => {
  const unidades = validar([group([unit("u1", "M", ["M"]), unit("u2", "L", ["L"])])]).groups[0].units;
  assert.deepEqual(unidades.map(({ physical_size: talla }) => talla), ["M", "L"]);
});

test("tres unidades físicas permiten M, M y L", () => {
  const unidades = validar([group([unit("u1", "M", ["M"]), unit("u2", "M", ["M"]), unit("u3", "L", ["L"])])]).groups[0].units;
  assert.deepEqual(unidades.map(({ physical_size: talla }) => talla), ["M", "M", "L"]);
});

test("retirar una unidad reduce el stock derivado sin modificar otra", () => {
  const grupo = preparada([unit("u1", "M", ["M"]), unit("u2", "L", ["L"])]);
  assert.equal(stockDerivado(grupo), 2);
  assert.equal(stockDerivado({ ...grupo, units: grupo.units.filter(({ id }) => id !== "u2") }), 1);
});

test("añadir y confirmar una unidad aumenta el stock derivado", () => {
  const grupo = preparada([unit("u1", "M", ["M"])]);
  assert.equal(stockDerivado({ ...grupo, units: [...grupo.units, { id: null, physicalSize: "L", displaySizes: ["L"] }] }), 2);
});

test("pendientes sin confirmar no cuentan como stock activo", () => {
  const grupo = preparada([
    { id: "u1", physical_size: "M", display_sizes: ["M"], status: "available" },
    { id: "u2", physical_size: null, display_sizes: [], status: "pending" },
  ]);
  assert.equal(stockDerivado(grupo), 1);
});

test("no permite guardar una unidad sin talla física confirmada", () => {
  assert.throws(() => validar([group([unit("u1", null, ["M"])])]), /talla física confirmada/);
});

test("varias tallas visibles pueden compartir varias unidades compatibles", () => {
  const grupos = validar([group([unit("u1", "M", ["M", "L"]), unit("u2", "L", ["M", "L"])])]).groups;
  assert.deepEqual(grupos[0].units.map(({ display_sizes: sizes }) => sizes), [["M", "L"], ["M", "L"]]);
  const editable = preparada([unit("u1", "M", ["M"]), unit("u2", "L", ["L"])]);
  const cambiados = alternarCompatibilidadUnidad([editable], editable.uiId, editable.units[0].uiId, "L");
  assert.deepEqual(cambiados[0].units[0].displaySizes, ["M", "L"]);
});

test("una sola unidad M puede servir comercialmente para M y L", () => {
  const resultado = validar([group([unit("u1", "M", ["M", "L"])])]).groups[0];
  assert.equal(resultado.units.length, 1);
  assert.deepEqual(resultado.units[0].display_sizes, ["M", "L"]);
});

test("mover una talla visible entre grupos elimina la compatibilidad anterior", () => {
  const dos = [preparada([unit("u1", "M", ["M"])], ["M"]), prepararGrupoFisico(group([unit("u2", "L", ["L"])], ["L"], "otro"))];
  const movidos = alternarTallaDeGrupo(dos, dos[1].uiId, "M");
  assert.deepEqual(movidos.map(({ displaySizes }) => displaySizes), [[], ["L", "M"]]);
  assert.deepEqual(movidos[0].units[0].displaySizes, []);
});

test("fusión manual reúne M y L sin perder UUIDs ni inventar stock", () => {
  const dos = [preparada([unit("u1", "M", ["M"])], ["M"]), prepararGrupoFisico(group([unit("u2", "L", ["L"])], ["L"], "otro"))];
  const [fusionado] = fusionarGrupoEnPrimero(dos, dos[1].uiId);
  assert.deepEqual(fusionado.displaySizes, ["M", "L"]);
  assert.deepEqual(fusionado.units.map(({ id, physicalSize }) => [id, physicalSize]), [["u1", "M"], ["u2", "L"]]);
  assert.equal(stockDerivado(fusionado), 2);
});

test("guardado y reapertura conservan unidades, UUIDs, tallas y compatibilidades", async () => {
  const guardados = [group([
    { ...unit("u1", "M", ["M"]), status: "available", active: true },
    { ...unit("u2", "L", ["L"]), status: "available", active: true },
  ])];
  let cuerpo;
  const servicio = crearServicioInventario({
    obtenerCredenciales: () => ({ url: "https://proyecto.supabase.co", secret: "CLAVE_PRIVADA" }),
    fetchImpl: async (url, opciones) => {
      assert.match(url, /rpc\/admin_save_inventory_physical_units$/);
      cuerpo = JSON.parse(opciones.body);
      return json(guardados);
    },
  });
  const resultado = await servicio.guardarGrupos({ variant_id: "variante", groups: [group([unit("u1", "M", ["M"]), unit("u2", "L", ["L"])])] });
  assert.equal(cuerpo.p_confirm_reconfigure, false);
  assert.equal("stock" in cuerpo.p_groups[0], false);
  const reabierta = prepararInventarioFisico({ product_id: "producto", variants: [{ id: "variante", active: true, name: "Negro", groups: resultado.groups }] });
  assert.deepEqual(reabierta.variants[0].groups[0].units.map(({ id, physicalSize, displaySizes }) => ({ id, physicalSize, displaySizes })), [
    { id: "u1", physicalSize: "M", displaySizes: ["M"] },
    { id: "u2", physicalSize: "L", displaySizes: ["L"] },
  ]);
});

test("GET administrativo relaciona variante, grupo, unidades y opciones por UUID", async () => {
  const llamadas = [];
  const servicio = crearServicioInventario({
    obtenerCredenciales: () => ({ url: "https://proyecto.supabase.co", secret: "CLAVE_PRIVADA" }),
    fetchImpl: async (url, opciones) => {
      assert.equal(opciones.method ?? "GET", "GET");
      const tabla = new URL(url).pathname.split("/").at(-1);
      llamadas.push(tabla);
      if (tabla === "variants") return json([{ id: "v1", product_id: "negro", variant_key: "negro", name: "Negro", active: true }]);
      if (tabla === "inventory_groups") return json([{ id: "g1", variant_id: "v1", legacy_stock: 2, active: true }]);
      if (tabla === "variant_size_options") return json([
        { id: "oM", inventory_group_id: "g1", display_size: "M", active: true },
        { id: "oL", inventory_group_id: "g1", display_size: "L", active: true },
      ]);
      if (tabla === "inventory_units") return json([
        { id: "u1", inventory_group_id: "g1", physical_size: "M", status: "available", active: true },
        { id: "u2", inventory_group_id: "g1", physical_size: "L", status: "available", active: true },
      ]);
      if (tabla === "inventory_unit_size_options") return json([
        { inventory_unit_id: "u1", variant_size_option_id: "oM", active: true },
        { inventory_unit_id: "u2", variant_size_option_id: "oL", active: true },
      ]);
      throw new Error("Tabla inesperada");
    },
  });
  const respuesta = await servicio.leerPorProducto("negro");
  assert.deepEqual(llamadas, ["variants", "inventory_groups", "variant_size_options", "inventory_units", "inventory_unit_size_options"]);
  assert.deepEqual(respuesta.variants[0].groups[0].units.map(({ id, display_sizes: sizes }) => [id, sizes]), [["u1", ["M"]], ["u2", ["L"]]]);
});

test("la UI no envía claves ni stock numérico y solo usa la API local", async () => {
  const ui = await readFile(new URL("../src/pages/gestor/EditorInventarioFisico.jsx", import.meta.url), "utf8");
  assert.match(ui, /gestorApi\.guardarGruposInventario/);
  assert.match(ui, /Stock físico: \{stockDerivado\(grupo\)\}/);
  assert.doesNotMatch(ui, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|type="number"/);
});

test("SQL conserva stock histórico, migra extras pendientes y calcula la disponibilidad", async () => {
  const sql = await readFile(new URL("../herramientas/supabase/2026-09-15-inventory-physical-units.sql", import.meta.url), "utf8");
  assert.match(sql, /legacy_stock = stock where legacy_stock is null/);
  assert.match(sql, /generate_series\(1, groups\.legacy_stock\)/);
  assert.match(sql, /case when position\.number = 1 then groups\.physical_size else null end/);
  assert.match(sql, /on conflict \(legacy_group_id, legacy_position\) do nothing/);
  assert.match(sql, /count\(distinct unit\.id\)::integer as stock/);
  assert.match(sql, /security_invoker = true/);
  assert.match(sql, /revoke all on function public\.admin_save_inventory_units/);
  assert.match(sql, /retirar un grupo lógico requiere confirmación explícita/);
  assert.match(sql, /update public\.inventory_groups groups set active = false/);
  assert.doesNotMatch(sql.slice(sql.indexOf("create or replace view public.public_inventory_availability"), sql.indexOf("create or replace view public.inventory_physical_units_overview")), /physical_size/);
});

test("SQL termina todo el DDL antes del backfill y hace COMMIT atómico", async () => {
  const sql = await readFile(new URL("../herramientas/supabase/2026-09-15-inventory-physical-units.sql", import.meta.url), "utf8");
  const rls = sql.indexOf("alter table public.inventory_units enable row level security;");
  const ultimoGrant = sql.indexOf("grant execute on function public.admin_save_inventory_physical_units");
  const legacyBackfill = sql.indexOf("update public.inventory_groups set legacy_stock = stock where legacy_stock is null;");
  const unitBackfill = sql.indexOf("with inserted_units as (");
  const commit = sql.lastIndexOf("commit;");
  assert.ok(rls > 0 && ultimoGrant > rls && legacyBackfill > ultimoGrant && unitBackfill > legacyBackfill && commit > unitBackfill);
  assert.equal(sql.slice(unitBackfill, commit).match(/\balter table\b/gi), null);
  assert.equal((sql.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((sql.match(/^commit;$/gm) ?? []).length, 1);
  assert.match(sql, /^notify pgrst, 'reload schema';\ncommit;$/m);
});
