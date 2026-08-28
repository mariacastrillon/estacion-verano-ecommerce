import { constants as fsConstants } from "node:fs";
import { Buffer } from "node:buffer";
import { access, copyFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { procesarImagenBuffer } from "../imagenes/procesar-imagen-producto.js";
import { actualizarCatalogo, validarCatalogo } from "./catalogo-repository.js";

const raizProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const carpetaProductos = path.join(raizProyecto, "public/productos");
const MARCADOR = "upload:";

const slug = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function existe(ruta) {
  try { await access(ruta); return true; } catch { return false; }
}

async function nombreDisponible(base) {
  for (let intento = 1; intento < 10_000; intento += 1) {
    const candidato = intento === 1 ? base : `${base}-${intento}`;
    const nombres = [`${candidato}.webp`, `${candidato}-480w.webp`, `${candidato}-768w.webp`];
    if (!(await Promise.all(nombres.map((nombre) => existe(path.join(carpetaProductos, nombre))))).some(Boolean)) return candidato;
  }
  throw new Error("No se pudo generar un nombre de imagen disponible.");
}

function decodificar(archivo) {
  if (!archivo?.token || !archivo?.contenido || !archivo?.nombre) throw new Error("Carga de imagen incompleta.");
  if (!/^[a-zA-Z0-9-]+$/.test(archivo.token)) throw new Error("Identificador de imagen no válido.");
  return Buffer.from(archivo.contenido, "base64");
}

export async function guardarProductoConImagenes({ producto, imagenesNuevas = [], modo, idOriginal }) {
  const porToken = new Map(imagenesNuevas.map((archivo) => [archivo.token, archivo]));
  if (porToken.size !== imagenesNuevas.length) throw new Error("Hay imágenes nuevas repetidas.");
  const staging = await mkdtemp(path.join(os.tmpdir(), "estacion-verano-imagenes-"));
  const destinosCreados = [];

  try {
    return await actualizarCatalogo(async (catalogo) => {
      const preparado = structuredClone(producto);
      for (const variante of preparado.variantes) {
        const imagenesFinales = [];
        for (let indice = 0; indice < variante.imagenes.length; indice += 1) {
          const referencia = variante.imagenes[indice];
          if (!referencia.startsWith(MARCADOR)) {
            imagenesFinales.push(referencia);
            continue;
          }
          const token = referencia.slice(MARCADOR.length);
          const archivo = porToken.get(token);
          if (!archivo) throw new Error("No se recibió una de las imágenes seleccionadas.");
          const base = await nombreDisponible(`${slug(preparado.id)}-${slug(variante.id)}-${String(indice + 1).padStart(2, "0")}`);
          const procesadas = await procesarImagenBuffer(decodificar(archivo), staging, base);
          await mkdir(carpetaProductos, { recursive: true });
          for (const origen of [procesadas.original, ...procesadas.derivados]) {
            const destino = path.join(carpetaProductos, path.basename(origen));
            await copyFile(origen, destino, fsConstants.COPYFILE_EXCL);
            destinosCreados.push(destino);
          }
          imagenesFinales.push(`/productos/${base}.webp`);
          porToken.delete(token);
        }
        variante.imagenes = imagenesFinales;
        variante.miniatura = imagenesFinales[0] ?? "";
      }
      if (porToken.size) throw new Error("Se recibieron imágenes que no pertenecen al producto.");

      if (modo === "crear") {
        if (catalogo.some(({ id }) => id === preparado.id)) throw new Error(`Ya existe el producto ${preparado.id}.`);
        catalogo.unshift(preparado);
      } else {
        if (preparado.id !== idOriginal) throw new Error("El ID publicado no se puede modificar.");
        const indice = catalogo.findIndex(({ id }) => id === idOriginal);
        if (indice < 0) throw new Error("Producto no encontrado.");
        catalogo[indice] = preparado;
      }
      validarCatalogo(catalogo);
      return catalogo;
    }).then((catalogo) => catalogo.find(({ id }) => id === producto.id));
  } catch (error) {
    await Promise.all(destinosCreados.map((destino) => rm(destino, { force: true })));
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  }
}
