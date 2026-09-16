import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Ver Colección en Inicio lleva a trajes con y sin aviso previo", async () => {
  const inicio = await readFile(new URL("../src/pages/Inicio.jsx", import.meta.url), "utf8");
  assert.equal((inicio.match(/navigate\("\/coleccion\/trajes"\)/g) ?? []).length, 2);
  assert.doesNotMatch(inicio, /navigate\("\/coleccion"\)/);
});

test("la ruta de categoría usa el campo categoria del catálogo sin duplicarlo", async () => {
  const [app, coleccion, catalogoTexto] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Coleccion.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/data/catalogo.json", import.meta.url), "utf8"),
  ]);
  const catalogo = JSON.parse(catalogoTexto);
  assert.match(app, /path="\/coleccion\/:categoria"/);
  assert.match(coleccion, /producto\.categoria !== categoria/);
  assert.ok(catalogo.some(({ categoria }) => categoria === "trajes"));
  assert.ok(catalogo.some(({ categoria }) => categoria !== "trajes"));
});
