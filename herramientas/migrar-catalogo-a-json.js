import { constants as fsConstants } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const carpetaHerramientas = path.dirname(fileURLToPath(import.meta.url));
const raizProyecto = path.resolve(carpetaHerramientas, "..");
const archivoProductos = path.join(raizProyecto, "src/data/productos.js");
const archivoCatalogo = path.join(raizProyecto, "src/data/catalogo.json");
const carpetaRespaldos = path.join(raizProyecto, "respaldos/catalogo");
const archivoRespaldo = path.join(
  carpetaRespaldos,
  "productos.pre-migracion-2026-08-28.js.txt"
);
let productosReemplazado = false;

const contenidoCapaCompatibilidad = `import catalogo from "./catalogo.json";

const crearVariantePredeterminada = (producto) => ({
  id: producto.id,
  nombre: producto.nombre,
  codigo: "",
  miniatura: producto.imagenes?.[0] ?? "",
  imagenes: producto.imagenes ?? [],
  tallas: producto.tallas ?? [],
});

const productosConVariantes = catalogo.map((producto) => ({
  ...producto,
  variantes:
    Array.isArray(producto.variantes) && producto.variantes.length > 0
      ? producto.variantes
      : [crearVariantePredeterminada(producto)],
}));

export const obtenerVariantes = (producto) =>
  (producto.variantes ?? []).filter((variante) => variante.activo !== false);

export const obtenerTallas = (producto) => [
  ...new Set(
    obtenerVariantes(producto).flatMap((variante) => variante.tallas ?? [])
  ),
];

export default productosConVariantes;
`;

function aplicarConvencionDeColor(productos) {
  return productos.map((producto) => ({
    ...producto,
    variantes: producto.variantes.map((variante) => {
      if (!("colorHex" in variante)) return variante;

      const { colorHex, ...varianteSinColorHex } = variante;
      return {
        ...varianteSinColorHex,
        codigo: colorHex,
      };
    }),
  }));
}

function ordenar(valor) {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (!valor || typeof valor !== "object") return valor;

  return Object.fromEntries(
    Object.keys(valor)
      .sort()
      .map((clave) => [clave, ordenar(valor[clave])])
  );
}

function sonIguales(a, b) {
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
}

function resumen(productos) {
  return {
    cantidad: productos.length,
    ids: productos.map((producto) => producto.id),
    variantes: productos.map((producto) => ({
      id: producto.id,
      variantes: producto.variantes,
    })),
    imagenes: productos.map((producto) => ({
      id: producto.id,
      imagenes: producto.imagenes,
      imagenesVariantes: producto.variantes.map((variante) => variante.imagenes),
    })),
    tallas: productos.map((producto) => ({
      id: producto.id,
      tallas: producto.tallas,
      tallasVariantes: producto.variantes.map((variante) => variante.tallas),
    })),
    activos: productos.map((producto) => ({
      id: producto.id,
      activo: producto.activo,
      variantes: producto.variantes.map((variante) => variante.activo),
    })),
    favoritos: productos.map((producto) => ({
      id: producto.id,
      favorito: producto.favorito,
    })),
    camposOpcionales: productos.map((producto) => ({
      id: producto.id,
      campos: Object.fromEntries(
        Object.entries(producto).filter(
          ([clave]) => !["id", "variantes"].includes(clave)
        )
      ),
    })),
  };
}

function verificarEquivalencia(esperado, obtenido) {
  const esperadoResumido = resumen(esperado);
  const obtenidoResumido = resumen(obtenido);
  const comprobaciones = Object.keys(esperadoResumido).map((nombre) => ({
    nombre,
    correcta: sonIguales(esperadoResumido[nombre], obtenidoResumido[nombre]),
  }));

  const fallidas = comprobaciones.filter(({ correcta }) => !correcta);
  if (fallidas.length > 0 || !sonIguales(esperado, obtenido)) {
    throw new Error(
      `Fallaron las comparaciones: ${fallidas.map(({ nombre }) => nombre).join(", ") || "documento completo"}`
    );
  }

  return comprobaciones;
}

async function escribirAtomico(destino, contenido) {
  const temporal = `${destino}.tmp`;
  await writeFile(temporal, contenido, "utf8");
  await rename(temporal, destino);
}

async function migrar() {
  await mkdir(carpetaRespaldos, { recursive: true });
  await copyFile(archivoProductos, archivoRespaldo, fsConstants.COPYFILE_EXCL);

  const moduloActual = await import(
    `${pathToFileURL(archivoProductos).href}?migracion=${Date.now()}`
  );
  const catalogoEsperado = aplicarConvencionDeColor(moduloActual.default);

  const json = `${JSON.stringify(catalogoEsperado, null, 2)}\n`;
  await escribirAtomico(archivoCatalogo, json);

  const catalogoLeido = JSON.parse(await readFile(archivoCatalogo, "utf8"));
  const comprobaciones = verificarEquivalencia(catalogoEsperado, catalogoLeido);

  await escribirAtomico(archivoProductos, contenidoCapaCompatibilidad);
  productosReemplazado = true;

  console.log(`Respaldo: ${path.relative(raizProyecto, archivoRespaldo)}`);
  console.log(`Productos migrados: ${catalogoLeido.length}`);
  for (const { nombre } of comprobaciones) {
    console.log(`OK: ${nombre}`);
  }
  console.log("OK: equivalencia completa");
  console.log("OK: colorHex eliminado; codigo conserva el hexadecimal");
}

migrar().catch(async (error) => {
  console.error("Migracion cancelada:", error.message);

  try {
    if (productosReemplazado) {
      await copyFile(archivoRespaldo, archivoProductos);
      console.error("productos.js fue restaurado desde el respaldo.");
    }
    await rm(`${archivoCatalogo}.tmp`, { force: true });
  } catch (restauracionError) {
    console.error("No se pudo restaurar automaticamente:", restauracionError.message);
  }

  process.exitCode = 1;
});
