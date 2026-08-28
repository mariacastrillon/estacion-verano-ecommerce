import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as esperar } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const raizProyecto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const archivoCatalogo = path.join(raizProyecto, "src/data/catalogo.json");
const carpetaRespaldos = path.join(raizProyecto, "respaldos/catalogo");
let colaEscrituras = Promise.resolve();

const esTexto = (valor) => typeof valor === "string";
const esListaDeTextos = (valor) =>
  Array.isArray(valor) && valor.every(esTexto);

function validarVariante(variante, indice, ids) {
  const ruta = `variantes[${indice}]`;
  if (!variante || typeof variante !== "object" || Array.isArray(variante)) {
    throw new Error(`${ruta} debe ser un objeto.`);
  }
  if ("colorHex" in variante) {
    throw new Error(`${ruta}: usa codigo para el hexadecimal, no colorHex.`);
  }
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(variante.id ?? "")) {
    throw new Error(`${ruta}.id solo puede usar letras, números y guiones.`);
  }
  if (ids.has(variante.id)) throw new Error(`ID de variante repetido: ${variante.id}.`);
  ids.add(variante.id);
  if (!esTexto(variante.nombre) || !variante.nombre.trim()) {
    throw new Error(`${ruta}.nombre es obligatorio.`);
  }
  if (!esTexto(variante.codigo) || (variante.codigo && !/^#[0-9a-f]{6}$/i.test(variante.codigo))) {
    throw new Error(`${ruta}.codigo debe estar vacío o tener formato #RRGGBB.`);
  }
  if (typeof variante.activo !== "undefined" && typeof variante.activo !== "boolean") {
    throw new Error(`${ruta}.activo debe ser booleano.`);
  }
  if (!esListaDeTextos(variante.tallas)) throw new Error(`${ruta}.tallas no es válida.`);
  if (!esListaDeTextos(variante.imagenes)) throw new Error(`${ruta}.imagenes no es válida.`);
  if (!esTexto(variante.miniatura)) throw new Error(`${ruta}.miniatura no es válida.`);
  if (variante.activo !== false && variante.imagenes.length === 0) {
    throw new Error(`${ruta}: una variante activa debe tener al menos una imagen.`);
  }
  if (variante.imagenes.length > 0 && variante.miniatura !== variante.imagenes[0]) {
    throw new Error(`${ruta}.miniatura debe ser la primera imagen.`);
  }

  for (const imagen of variante.imagenes) {
    if (!imagen.startsWith("/productos/") || imagen.includes("..")) {
      throw new Error(`${ruta} contiene una ruta de imagen no permitida.`);
    }
  }
}

export function validarCatalogo(catalogo) {
  if (!Array.isArray(catalogo)) throw new Error("El catálogo debe ser una lista.");
  const ids = new Set();

  catalogo.forEach((producto, indice) => {
    const ruta = `productos[${indice}]`;
    if (!producto || typeof producto !== "object" || Array.isArray(producto)) {
      throw new Error(`${ruta} debe ser un objeto.`);
    }
    if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(producto.id ?? "")) {
      throw new Error(`${ruta}.id solo puede usar letras, números y guiones.`);
    }
    if (ids.has(producto.id)) throw new Error(`ID de producto repetido: ${producto.id}.`);
    ids.add(producto.id);
    if (!esTexto(producto.nombre) || !producto.nombre.trim()) {
      throw new Error(`${ruta}.nombre es obligatorio.`);
    }
    if (!esTexto(producto.precio) || !/^\d{1,3}(?:\.\d{3})*$/.test(producto.precio)) {
      throw new Error(`${ruta}.precio debe tener un formato como 60.000.`);
    }
    if (!esTexto(producto.categoria) || !producto.categoria.trim()) {
      throw new Error(`${ruta}.categoria es obligatoria.`);
    }
    if (typeof producto.descripcion !== "undefined" && !esTexto(producto.descripcion)) {
      throw new Error(`${ruta}.descripcion no es válida.`);
    }
    if (typeof producto.activo !== "boolean" || typeof producto.favorito !== "boolean") {
      throw new Error(`${ruta}: activo y favorito deben ser booleanos.`);
    }
    if (!esListaDeTextos(producto.etiquetas ?? [])) {
      throw new Error(`${ruta}.etiquetas no es válida.`);
    }
    if (!esListaDeTextos(producto.palabrasClave ?? [])) {
      throw new Error(`${ruta}.palabrasClave no es válida.`);
    }
    if (!Array.isArray(producto.variantes) || producto.variantes.length === 0) {
      throw new Error(`${ruta} debe tener al menos una variante.`);
    }
    const idsVariantes = new Set();
    producto.variantes.forEach((variante, varianteIndice) =>
      validarVariante(variante, varianteIndice, idsVariantes)
    );
    if (
      producto.activo &&
      !producto.variantes.some(
        (variante) => variante.activo !== false && variante.imagenes.length > 0
      )
    ) {
      throw new Error(`${ruta}: un producto activo necesita una variante activa con imágenes.`);
    }
  });

  return catalogo;
}

export async function leerCatalogo() {
  return validarCatalogo(JSON.parse(await readFile(archivoCatalogo, "utf8")));
}

function nombreRespaldo() {
  return `catalogo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

async function reemplazarConReintentos(temporal, destino) {
  for (let intento = 0; intento < 12; intento += 1) {
    try {
      await rename(temporal, destino);
      return;
    } catch (error) {
      if (!["EPERM", "EBUSY", "EACCES"].includes(error.code) || intento === 11) throw error;
      await esperar(100 * (intento + 1));
    }
  }
}

async function guardarSinCola(catalogo) {
    validarCatalogo(catalogo);
    const actual = await readFile(archivoCatalogo, "utf8");
    await mkdir(carpetaRespaldos, { recursive: true });
    await writeFile(path.join(carpetaRespaldos, nombreRespaldo()), actual, "utf8");

    const temporal = `${archivoCatalogo}.${process.pid}.tmp`;
    const contenido = `${JSON.stringify(catalogo, null, 2)}\n`;
    await writeFile(temporal, contenido, { encoding: "utf8", flag: "wx" });
    JSON.parse(await readFile(temporal, "utf8"));
    await reemplazarConReintentos(temporal, archivoCatalogo);
    return catalogo;
}

function encolar(accion) {
  const operacion = colaEscrituras.then(accion);

  colaEscrituras = operacion.catch(() => undefined);
  return operacion;
}

export function guardarCatalogo(catalogo) {
  return encolar(() => guardarSinCola(catalogo));
}

export function actualizarCatalogo(transformar) {
  return encolar(async () => {
    const catalogo = await leerCatalogo();
    const actualizado = await transformar(catalogo);
    return guardarSinCola(actualizado);
  });
}
