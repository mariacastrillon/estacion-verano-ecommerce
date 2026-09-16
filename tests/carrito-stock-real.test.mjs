import assert from "node:assert/strict";
import test from "node:test";
import { agregarLinea, aplicarRevalidacion, cambiarCantidad, carritoPuedeFinalizar,
  crearClaveLinea, crearLineaCarrito, leerCarritoGuardado, subtotalCarrito } from "../src/cart/carrito.js";

const producto = { id: "marea", nombre: "Marea Viva", precio: "60.000",
  variantes: [{ id: "azul", nombre: "Azul", miniatura: "/azul.webp" },
    { id: "rojo", nombre: "Rojo", miniatura: "/rojo.webp" }] };
const linea = (size = "M", group = "grupo-azul", stock = 3, variante = producto.variantes[0]) =>
  crearLineaCarrito({ producto, variante, opcionInventario: {
    displaySize: size, inventoryGroupId: group, stockDisponible: stock,
    variantId: `uuid-${variante.id}`,
  } });
const resultado = (line, stock, group = line.inventoryGroupId) => ({
  productoId: line.productoId, varianteKey: line.varianteKey, selectedSize: line.selectedSize,
  varianteId: line.varianteId, inventoryGroupId: group, stockDisponible: stock, vigente: true,
});

test("stock 1 permite una sola unidad y no incrementa más", () => {
  const primera = linea("M", "grupo", 1);
  assert.equal(agregarLinea([primera], primera).length, 1);
  assert.equal(cambiarCantidad([primera], crearClaveLinea(primera), 1)[0].cantidad, 1);
});
test("stock 3 permite cantidad 3 pero no 4", () => {
  const inicial = linea();
  const tres = agregarLinea(agregarLinea([inicial], inicial), inicial);
  assert.equal(tres[0].cantidad, 3);
  assert.equal(agregarLinea(tres, inicial)[0].cantidad, 3);
});
test("carrito 3 y stock 2 ajusta cantidad y subtotal", () => {
  const inicial = linea();
  const tres = agregarLinea(agregarLinea([inicial], inicial), inicial);
  const [actual] = aplicarRevalidacion(tres, [resultado(inicial, 2)]);
  assert.equal(actual.cantidad, 2);
  assert.equal(actual.estadoStock, "stock reducido");
  assert.equal(subtotalCarrito([actual]), 12_000_000);
  assert.equal(carritoPuedeFinalizar([actual]), true);
});
test("stock 0 conserva línea agotada y bloquea checkout", () => {
  const inicial = linea();
  const [actual] = aplicarRevalidacion([inicial], [resultado(inicial, 0)]);
  assert.equal(actual.cantidad, 1);
  assert.equal(actual.estadoStock, "agotado");
  assert.equal(carritoPuedeFinalizar([actual]), false);
});
test("error de consulta conserva carrito y checkout permanece bloqueado", () => {
  const inicial = linea();
  assert.equal(carritoPuedeFinalizar([inicial], false), false);
  assert.equal(inicial.cantidad, 1);
});
test("carrito antiguo reconstruye variante desde catálogo y no borra la línea", () => {
  const vieja = { productoId: "marea", varianteId: "azul", talla: "M", cantidad: 2 };
  const storage = { getItem: () => JSON.stringify([vieja]), removeItem: () => assert.fail("No debe borrar") };
  const [recuperada] = leerCarritoGuardado(storage, [producto]);
  assert.equal(recuperada.varianteKey, "azul");
  assert.equal(recuperada.selectedSize, "M");
  assert.equal(recuperada.cantidad, 2);
  assert.equal(recuperada.estadoStock, "no verificable");
});
test("línea vieja irresoluble queda no verificable, sin borrar otras", () => {
  const storage = { getItem: () => JSON.stringify([{ productoId: "desconocido", talla: "S" }, linea()]) };
  const recuperadas = leerCarritoGuardado(storage, [producto]);
  assert.equal(recuperadas.length, 2);
  assert.equal(recuperadas[0].estadoStock, "no verificable");
});
test("tallas M y L del mismo grupo comparten límite físico", () => {
  const m = linea("M", "grupo", 1);
  const l = linea("L", "grupo", 1);
  assert.equal(agregarLinea([m], l).length, 1);
  const revalidadas = aplicarRevalidacion([m, l], [resultado(m, 1), resultado(l, 1)]);
  assert.equal(revalidadas[1].estadoStock, "agotado");
  assert.equal(carritoPuedeFinalizar(revalidadas), false);
});
test("dos variantes de color distinto tienen stock independiente", () => {
  const azul = linea("M", "grupo-azul", 1);
  const rojo = linea("M", "grupo-rojo", 1, producto.variantes[1]);
  const actual = aplicarRevalidacion([azul, rojo], [resultado(azul, 1), resultado(rojo, 1)]);
  assert.equal(carritoPuedeFinalizar(actual), true);
  assert.equal(actual.length, 2);
});
test("opción retirada queda no verificable y checkout bloqueado", () => {
  const [actual] = aplicarRevalidacion([linea()], []);
  assert.equal(actual.estadoStock, "no verificable");
  assert.equal(carritoPuedeFinalizar([actual]), false);
});
