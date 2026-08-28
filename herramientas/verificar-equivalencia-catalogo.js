import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const raizProyecto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const archivoRespaldo = path.join(
  raizProyecto,
  "respaldos/catalogo/productos.pre-migracion-2026-08-28.js.txt"
);
const archivoCatalogo = path.join(raizProyecto, "src/data/catalogo.json");

function aplicarConvencionDeColor(productos) {
  return productos.map((producto) => ({
    ...producto,
    variantes: producto.variantes.map((variante) => {
      if (!("colorHex" in variante)) return variante;

      const { colorHex, ...varianteSinColorHex } = variante;
      return { ...varianteSinColorHex, codigo: colorHex };
    }),
  }));
}

function serializar(valor) {
  if (Array.isArray(valor)) return valor.map(serializar);
  if (!valor || typeof valor !== "object") return valor;

  return Object.fromEntries(
    Object.keys(valor)
      .sort()
      .map((clave) => [clave, serializar(valor[clave])])
  );
}

function iguales(a, b) {
  return JSON.stringify(serializar(a)) === JSON.stringify(serializar(b));
}

function seleccionar(productos, selector) {
  return productos.map((producto) => ({ id: producto.id, ...selector(producto) }));
}

async function verificar() {
  const fuenteOriginal = await readFile(archivoRespaldo, "utf8");
  const urlFuente = `data:text/javascript;base64,${Buffer.from(fuenteOriginal).toString("base64")}`;
  const moduloOriginal = await import(urlFuente);
  const original = aplicarConvencionDeColor(moduloOriginal.default);
  const migrado = JSON.parse(await readFile(archivoCatalogo, "utf8"));

  const comprobaciones = {
    cantidad: original.length === migrado.length,
    ids: iguales(original.map(({ id }) => id), migrado.map(({ id }) => id)),
    variantes: iguales(
      seleccionar(original, ({ variantes }) => ({ variantes })),
      seleccionar(migrado, ({ variantes }) => ({ variantes }))
    ),
    imagenes: iguales(
      seleccionar(original, (producto) => ({
        imagenes: producto.imagenes,
        imagenesVariantes: producto.variantes.map(({ imagenes }) => imagenes),
      })),
      seleccionar(migrado, (producto) => ({
        imagenes: producto.imagenes,
        imagenesVariantes: producto.variantes.map(({ imagenes }) => imagenes),
      }))
    ),
    tallas: iguales(
      seleccionar(original, (producto) => ({
        tallas: producto.tallas,
        tallasVariantes: producto.variantes.map(({ tallas }) => tallas),
      })),
      seleccionar(migrado, (producto) => ({
        tallas: producto.tallas,
        tallasVariantes: producto.variantes.map(({ tallas }) => tallas),
      }))
    ),
    activos: iguales(
      seleccionar(original, (producto) => ({
        activo: producto.activo,
        variantes: producto.variantes.map(({ activo }) => activo),
      })),
      seleccionar(migrado, (producto) => ({
        activo: producto.activo,
        variantes: producto.variantes.map(({ activo }) => activo),
      }))
    ),
    favoritos: iguales(
      seleccionar(original, ({ favorito }) => ({ favorito })),
      seleccionar(migrado, ({ favorito }) => ({ favorito }))
    ),
    camposOpcionales: iguales(original, migrado),
  };

  for (const [nombre, correcta] of Object.entries(comprobaciones)) {
    console.log(`${correcta ? "OK" : "ERROR"}: ${nombre}`);
  }

  const variantes = migrado.flatMap(({ variantes }) => variantes);
  const sinColorHex = variantes.every((variante) => !("colorHex" in variante));
  console.log(`${sinColorHex ? "OK" : "ERROR"}: sin colorHex`);

  if (Object.values(comprobaciones).some((correcta) => !correcta) || !sinColorHex) {
    process.exitCode = 1;
    return;
  }

  console.log(`Equivalencia confirmada para ${migrado.length} productos.`);
}

verificar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
