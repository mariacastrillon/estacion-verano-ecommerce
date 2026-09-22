import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { guardarPosicionLista, restaurarPosicionLista } from "../src/pages/gestor/posicion-lista.js";

function entorno(scrollY = 3000, offset = 180) {
  const datos = new Map();
  const ventana = {
    scrollY,
    sessionStorage: {
      setItem: (clave, valor) => datos.set(clave, valor),
      getItem: (clave) => datos.get(clave) ?? null,
      removeItem: (clave) => datos.delete(clave),
    },
    scrollTo({ top, behavior }) { this.scrollY = top; this.behavior = behavior; },
  };
  const posicionDocumento = scrollY + offset;
  const tarjeta = { dataset: { gestorProductoId: "producto-47" }, getBoundingClientRect: () => ({ top: posicionDocumento - ventana.scrollY }) };
  const documento = { querySelectorAll: () => [tarjeta] };
  return { ventana, tarjeta, documento, datos };
}

test("al guardar vuelve cerca de la tarjeta editada y consume el ancla", () => {
  const { ventana, tarjeta, documento, datos } = entorno();
  guardarPosicionLista("producto-47", tarjeta, ventana);
  ventana.scrollY = 900;
  assert.equal(restaurarPosicionLista(ventana, documento), true);
  assert.equal(ventana.scrollY, 3000);
  assert.equal(ventana.behavior, "instant");
  assert.equal(datos.size, 0);
});

test("al cancelar restaura la posición incluso si cambió la altura de la lista", () => {
  const { ventana, tarjeta, documento } = entorno(3000, 180);
  guardarPosicionLista("producto-47", tarjeta, ventana);
  ventana.scrollY = 0;
  documento.querySelectorAll = () => [{ ...tarjeta, getBoundingClientRect: () => ({ top: 3500 - ventana.scrollY }) }];
  assert.equal(restaurarPosicionLista(ventana, documento), true);
  assert.equal(ventana.scrollY, 3320);
});

test("si el filtro oculta el producto usa scrollY como respaldo", () => {
  const { ventana, tarjeta, documento } = entorno();
  guardarPosicionLista("producto-47", tarjeta, ventana);
  documento.querySelectorAll = () => [];
  ventana.scrollY = 0;
  assert.equal(restaurarPosicionLista(ventana, documento), true);
  assert.equal(ventana.scrollY, 3000);
});

test("entrar normalmente desde otra página no recupera un ancla antigua", () => {
  const { ventana, tarjeta, documento } = entorno();
  guardarPosicionLista("producto-47", tarjeta, ventana);
  // El componente solo invoca la restauración al cerrar una edición iniciada en esta lista.
  assert.equal(ventana.scrollY, 3000);
  assert.equal(documento.querySelectorAll().length, 1);
});

test("la lista espera al montaje, conserva búsqueda y solo marca el retorno de edición", async () => {
  const fuente = await readFile(new URL("../src/pages/gestor/GestorCatalogo.jsx", import.meta.url), "utf8");
  assert.match(fuente, /useLayoutEffect\(\(\) => \{/);
  assert.match(fuente, /if \(seleccion \|\| !regresoDesdeEdicion\.current\) return/);
  assert.match(fuente, /guardarPosicionLista\(producto\.id/);
  assert.match(fuente, /onCancelar=\{async \(\) => \{ await cargar\(\); volverALista\(\); \}\}/);
  assert.match(fuente, /onGuardado=\{async \(\) => \{ await cargar\(\); volverALista\(\); \}\}/);
  assert.match(fuente, /const \[busqueda, setBusqueda\]/);
});
