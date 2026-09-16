import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { agregarLinea, aplicarRevalidacion, carritoPuedeFinalizar, crearLineaCarrito } from "../src/cart/carrito.js";
import { consultarDisponibilidadVariante, resolverOpcionesInventario } from "../src/services/inventarioPublico.js";

const producto = { id: "marea-viva", nombre: "Marea Viva", precio: "60.000" };
const azul = { id: "azul-profundo", nombre: "Azul profundo", miniatura: "/azul.webp" };
const resolver = (opciones, grupos) => resolverOpcionesInventario(opciones.map((opcionActual) => ({
  ...opcionActual,
  stock: grupos.find(({ id }) => id === opcionActual.inventory_group_id)?.stock ?? 0,
})));
const opcion = (displaySize, inventoryGroupId) => ({ variant_id: "uuid-azul", display_size: displaySize, inventory_group_id: inventoryGroupId });
const grupo = (id, _physicalSize, stock) => ({ id, stock, active: true });
const linea = (opcionInventario) => crearLineaCarrito({ producto, variante: azul, opcionInventario });

test("talla visible igual a talla física queda disponible sin exponer talla física", () => {
  const [resultado] = resolver([opcion("L", "grupo-a")], [grupo("grupo-a", "L", 1)]);
  assert.equal(resultado.displaySize, "L");
  assert.equal("physicalSize" in resultado, false);
});

test("talla visible distinta de talla física no revela la talla administrativa", () => {
  const [resultado] = resolver([opcion("XL", "grupo-a")], [grupo("grupo-a", "L", 1)]);
  assert.equal(resultado.displaySize, "XL");
  assert.equal("physicalSize" in resultado, false);
});

test("L y XL resuelven al mismo grupo", () => {
  const resultados = resolver([opcion("L", "grupo-a"), opcion("XL", "grupo-a")], [grupo("grupo-a", "L", 1)]);
  assert.deepEqual(resultados.map(({ inventoryGroupId }) => inventoryGroupId), ["grupo-a", "grupo-a"]);
});

test("stock compartido 1 impide agregar L y XL como dos unidades", () => {
  const [l, xl] = resolver([opcion("L", "grupo-a"), opcion("XL", "grupo-a")], [grupo("grupo-a", "L", 1)]);
  const carrito = agregarLinea(agregarLinea([], linea(l)), linea(xl));
  assert.equal(carrito.length, 1);
});

test("stock compartido 2 permite una combinación máxima de dos", () => {
  const [l, xl] = resolver([opcion("L", "grupo-a"), opcion("XL", "grupo-a")], [grupo("grupo-a", "L", 2)]);
  const dos = agregarLinea(agregarLinea([], linea(l)), linea(xl));
  assert.equal(dos.length, 2);
  assert.equal(agregarLinea(dos, linea(l)).reduce((total, item) => total + item.cantidad, 0), 2);
});

test("stock cero deshabilita todas las tallas del grupo", () => {
  const resultados = resolver([opcion("L", "grupo-a"), opcion("XL", "grupo-a")], [grupo("grupo-a", "L", 0)]);
  assert.deepEqual(resultados.map(({ available }) => available), [false, false]);
  assert.equal(agregarLinea([], linea(resultados[0])).length, 0);
});

test("dos colores usan grupos independientes", () => {
  const azulL = { ...resolver([opcion("L", "grupo-azul")], [grupo("grupo-azul", "L", 1)])[0] };
  const rojoL = { ...azulL, variantId: "uuid-rojo", inventoryGroupId: "grupo-rojo" };
  const rojo = { id: "rojo", nombre: "Rojo", miniatura: "/rojo.webp" };
  const carrito = agregarLinea(agregarLinea([], linea(azulL)), crearLineaCarrito({ producto, variante: rojo, opcionInventario: rojoL }));
  assert.equal(carrito.length, 2);
});

test("revalidación agrupa cantidades por inventoryGroupId", () => {
  const [l, xl] = resolver([opcion("L", "grupo-a"), opcion("XL", "grupo-a")], [grupo("grupo-a", "L", 2)]);
  const carrito = [linea(l), linea(xl)];
  const resultados = carrito.map((item) => ({ inventoryGroupId: item.inventoryGroupId, varianteId: item.varianteId, selectedSize: item.selectedSize, vigente: true, stockDisponible: 1 }));
  assert.ok(aplicarRevalidacion(carrito, resultados).every(({ invalida }) => invalida));
});

test("checkout se bloquea con stock inválido", () => {
  assert.equal(carritoPuedeFinalizar([{ ...linea(resolver([opcion("L", "grupo-a")], [grupo("grupo-a", "L", 1)])[0]), invalida: true }], true), false);
  assert.equal(carritoPuedeFinalizar([linea(resolver([opcion("L", "grupo-a")], [grupo("grupo-a", "L", 1)])[0])], false), false);
});

test("error de Supabase bloquea disponibilidad automática", async () => {
  await assert.rejects(() => consultarDisponibilidadVariante("producto", "variante"), /Disponibilidad por confirmar/);
});

test("selectedSize se conserva sin physicalSize en el navegador", () => {
  const seleccion = linea(resolver([opcion("XL", "grupo-a")], [grupo("grupo-a", "L", 1)])[0]);
  assert.equal(seleccion.selectedSize, "XL");
  assert.equal("physicalSize" in seleccion, false);
});

test("secret keys administrativas están ausentes de src", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout = "" } = await promisify(execFile)("rg", ["-n", "SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|sb_secret_", "src"])
    .catch((error) => ({ stdout: error.stdout ?? "" }));
  assert.equal(stdout, "");
  const servicio = await readFile(new URL("../src/services/inventarioPublico.js", import.meta.url), "utf8");
  assert.match(servicio, /VITE_SUPABASE_PUBLISHABLE_KEY/);
});
