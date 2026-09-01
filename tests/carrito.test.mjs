import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CARRITO_STORAGE_KEY, agregarLinea, cambiarCantidad, crearClaveLinea, crearLineaCarrito, eliminarLinea, leerCarritoGuardado, subtotalCarrito, totalUnidades } from "../src/cart/carrito.js";

const producto = { id: "violeta", nombre: "Violeta Urbana", precio: "60.000" };
const fuccia = { id: "fuccia", nombre: "Fuccia", miniatura: "/fuccia-mini.webp", imagenes: ["/fuccia.webp"], tallas: ["S", "M"] };
const lila = { id: "lila", nombre: "Lila", imagenes: ["/lila.webp"], tallas: ["S"] };
const linea = (variante = fuccia, talla = "S") => crearLineaCarrito({ producto, variante, talla });

test("agrega un producto con el modelo minimo", () => {
  const resultado = agregarLinea([], linea());
  assert.equal(resultado.length, 1);
  assert.deepEqual(Object.keys(resultado[0]), ["productoId", "nombre", "varianteId", "varianteNombre", "talla", "precio", "cantidad", "imagen"]);
});
test("misma seleccion permanece en una linea con cantidad uno", () => {
  const resultado = agregarLinea(agregarLinea([], linea()), linea());
  assert.equal(resultado.length, 1); assert.equal(resultado[0].cantidad, 1);
});
test("otra talla crea otra linea", () => assert.equal(agregarLinea([linea()], linea(fuccia, "M")).length, 2));
test("otro color crea otra linea", () => assert.equal(agregarLinea([linea()], linea(lila)).length, 2));
test("un producto con tallas exige seleccion", () => assert.equal(crearLineaCarrito({ producto, variante: fuccia }), null));
test("un producto sin tallas se agrega", () => assert.ok(crearLineaCarrito({ producto, variante: { ...fuccia, tallas: [] } })));
test("la imagen pertenece a la variante seleccionada", () => {
  assert.equal(linea().imagen, "/fuccia-mini.webp"); assert.equal(linea(lila).imagen, "/lila.webp");
});
test("la cantidad nunca puede superar ni bajar de uno", () => {
  const clave = crearClaveLinea(linea());
  assert.equal(cambiarCantidad([linea()], clave, 1)[0].cantidad, 1);
  assert.equal(cambiarCantidad([linea()], clave, -1)[0].cantidad, 1);
});
test("elimina una linea completa", () => assert.deepEqual(eliminarLinea([linea()], crearClaveLinea(linea())), []));
test("subtotal y contador suman cantidades", () => {
  const lineas = [linea(), linea(lila)];
  assert.equal(subtotalCarrito(lineas), 12_000_000); assert.equal(totalUnidades(lineas), 2);
});
test("persiste y se recupera de datos corruptos", () => {
  const storage = { valor: JSON.stringify([linea()]), getItem() { return this.valor; }, removeItem() { this.valor = null; } };
  assert.deepEqual(leerCarritoGuardado(storage), [linea()]);
  storage.valor = "{roto"; assert.deepEqual(leerCarritoGuardado(storage), []); assert.equal(storage.valor, null);
  assert.equal(CARRITO_STORAGE_KEY, "verano_carrito");
});
test("incluye estado vacio, badge y layout responsive", async () => {
  const carrito = await readFile(new URL("../src/pages/Carrito.jsx", import.meta.url), "utf8");
  assert.match(carrito, /Tu carrito está vacío/); assert.match(carrito, /sm:grid-cols|lg:grid-cols/);
  assert.match(carrito, /disabled=\{linea\.cantidad === 1\}[^>]*aria-label="Aumentar cantidad"/);
  const navbar = await readFile(new URL("../src/components/Navbar.jsx", import.meta.url), "utf8");
  assert.match(navbar, /totalUnidades/); assert.match(navbar, /to="\/carrito"/);
});
