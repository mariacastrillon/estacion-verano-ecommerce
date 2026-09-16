import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CARRITO_STORAGE_KEY, agregarLinea, cambiarCantidad, crearClaveLinea, crearLineaCarrito, eliminarLinea, leerCarritoGuardado, subtotalCarrito, totalUnidades } from "../src/cart/carrito.js";

const producto = { id: "violeta", nombre: "Violeta Urbana", precio: "60.000" };
const fuccia = { id: "fuccia", nombre: "Fuccia", miniatura: "/fuccia-mini.webp", imagenes: ["/fuccia.webp"] };
const lila = { id: "lila", nombre: "Lila", imagenes: ["/lila.webp"] };
const opcion = (displaySize = "S", groupId = "grupo-fuccia", stock = 2, variantId = "uuid-fuccia") => ({
  displaySize, inventoryGroupId: groupId, stockDisponible: stock, variantId,
});
const linea = (variante = fuccia, opcionInventario = opcion()) => crearLineaCarrito({ producto, variante, opcionInventario });

test("agrega una línea con identidad de inventario completa", () => {
  const resultado = agregarLinea([], linea());
  assert.equal(resultado.length, 1);
  assert.deepEqual(Object.keys(resultado[0]), ["productoId", "nombre", "varianteId", "varianteKey", "varianteNombre", "selectedSize", "inventoryGroupId", "stockDisponible", "cantidad", "precio", "imagen", "invalida", "mensajeStock", "estadoStock"]);
});
test("la misma selección aumenta cantidad dentro del stock", () => {
  const resultado = agregarLinea(agregarLinea([], linea()), linea());
  assert.equal(resultado.length, 1); assert.equal(resultado[0].cantidad, 2);
});
test("otra talla visual crea otra línea si el grupo tiene stock", () => assert.equal(agregarLinea([linea()], linea(fuccia, opcion("M"))).length, 2));
test("otro color con otro grupo crea otra línea", () => assert.equal(agregarLinea([linea()], linea(lila, opcion("S", "grupo-lila", 1, "uuid-lila"))).length, 2));
test("sin opción verificada no crea línea", () => assert.equal(crearLineaCarrito({ producto, variante: fuccia }), null));
test("la imagen pertenece a la variante seleccionada", () => {
  assert.equal(linea().imagen, "/fuccia-mini.webp"); assert.equal(linea(lila, opcion("S", "grupo-lila", 1, "uuid-lila")).imagen, "/lila.webp");
});
test("cantidad respeta el stock compartido", () => {
  const actual = linea(fuccia, opcion("S", "grupo", 2));
  const clave = crearClaveLinea(actual);
  assert.equal(cambiarCantidad([actual], clave, 1)[0].cantidad, 2);
  assert.equal(cambiarCantidad(cambiarCantidad([actual], clave, 1), clave, 1)[0].cantidad, 2);
  assert.equal(cambiarCantidad([actual], clave, -1)[0].cantidad, 1);
});
test("elimina una línea completa", () => assert.deepEqual(eliminarLinea([linea()], crearClaveLinea(linea())), []));
test("subtotal y contador suman cantidades", () => {
  const lineas = [linea(), linea(lila, opcion("S", "grupo-lila", 1, "uuid-lila"))];
  assert.equal(subtotalCarrito(lineas), 12_000_000); assert.equal(totalUnidades(lineas), 2);
});
test("persiste y recupera el nuevo modelo", () => {
  const storage = { valor: JSON.stringify([linea()]), getItem() { return this.valor; }, removeItem() { this.valor = null; } };
  assert.equal(leerCarritoGuardado(storage)[0].estadoStock, "no verificable");
  assert.equal(CARRITO_STORAGE_KEY, "verano_carrito");
});
test("conserva líneas antiguas pero las marca pendientes", () => {
  const antigua = { productoId: "p", nombre: "P", varianteId: "v", talla: "S", precio: "1.000", cantidad: 1 };
  const storage = { getItem: () => JSON.stringify([antigua]), removeItem() {} };
  const [recuperada] = leerCarritoGuardado(storage);
  assert.equal(recuperada.selectedSize, "S"); assert.equal(recuperada.invalida, true);
});
test("incluye estado vacío, disponibilidad y layout responsive", async () => {
  const carrito = await readFile(new URL("../src/pages/Carrito.jsx", import.meta.url), "utf8");
  assert.match(carrito, /Tu carrito está vacío/); assert.match(carrito, /sm:grid-cols|lg:grid-cols/);
  assert.match(carrito, /mensajeStock|estadoStock/); assert.match(carrito, /revalidar/);
  const navbar = await readFile(new URL("../src/components/Navbar.jsx", import.meta.url), "utf8");
  assert.match(navbar, /totalUnidades/); assert.match(navbar, /to="\/carrito"/);
});
