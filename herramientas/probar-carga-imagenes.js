import { Buffer } from "node:buffer";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { guardarCatalogo, leerCatalogo } from "./gestor-local/catalogo-repository.js";
import { guardarProductoConImagenes } from "./gestor-local/procesar-imagenes-upload.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivoCatalogo = path.join(raiz, "src/data/catalogo.json");
const carpetaProductos = path.join(raiz, "public/productos");
const original = await leerCatalogo();
const contenidoOriginal = await readFile(archivoCatalogo, "utf8");
let rutasCreadas = [];

const base64 = (buffer) => buffer.toString("base64");
const imagenSolida = (width, height, background, formato) => {
  const imagen = sharp({ create: { width, height, channels: 4, background } });
  if (formato === "jpeg") return imagen.jpeg({ quality: 90 }).toBuffer();
  if (formato === "png") return imagen.png().toBuffer();
  return imagen.webp({ quality: 90 }).toBuffer();
};

try {
  const [jpg, png, webp] = await Promise.all([
    imagenSolida(1400, 1600, "#d97706", "jpeg"),
    imagenSolida(1000, 1200, "#0f766e", "png"),
    imagenSolida(700, 900, "#7c3aed", "webp"),
  ]);
  const archivos = [
    { token: "jpg-prueba", nombre: "foto.jpg", tipo: "image/jpeg", contenido: base64(jpg) },
    { token: "png-prueba", nombre: "foto.png", tipo: "image/png", contenido: base64(png) },
    { token: "webp-prueba", nombre: "foto.webp", tipo: "image/webp", contenido: base64(webp) },
  ];
  const producto = {
    id: "prueba-carga-imagenes",
    activo: true,
    favorito: false,
    categoria: "trajes",
    nombre: "Prueba carga imágenes",
    precio: "60.000",
    palabrasClave: [],
    etiquetas: [],
    descripcion: "Producto temporal de prueba.",
    variantes: [{
      id: "mezcla",
      activo: true,
      nombre: "Mezcla",
      codigo: "#123456",
      miniatura: "upload:jpg-prueba",
      imagenes: [
        "upload:jpg-prueba",
        "/productos/fleur-limon-frontal.webp",
        "upload:png-prueba",
        "upload:webp-prueba",
      ],
      tallas: ["M"],
    }],
  };
  const guardado = await guardarProductoConImagenes({ producto, imagenesNuevas: archivos, modo: "crear" });
  const variante = guardado.variantes[0];
  rutasCreadas = variante.imagenes.filter((ruta) => ruta.includes("prueba-carga-imagenes"));

  if (variante.imagenes[1] !== "/productos/fleur-limon-frontal.webp") throw new Error("Falló la mezcla o el orden de imágenes.");
  if (variante.miniatura !== variante.imagenes[0]) throw new Error("La primera imagen no quedó como miniatura.");
  for (const ruta of rutasCreadas) {
    const base = path.join(carpetaProductos, path.basename(ruta, ".webp"));
    for (const sufijo of [".webp", "-480w.webp", "-768w.webp"]) {
      const metadata = await sharp(`${base}${sufijo}`).metadata();
      if (metadata.format !== "webp") throw new Error(`Formato incorrecto en ${base}${sufijo}.`);
    }
  }
  const webpBase = path.join(carpetaProductos, path.basename(rutasCreadas[2], ".webp"));
  const webp768 = await sharp(`${webpBase}-768w.webp`).metadata();
  if (webp768.width !== 700) throw new Error("Una imagen pequeña fue ampliada.");

  const antesDelFallo = await readFile(archivoCatalogo, "utf8");
  let falloControlado = false;
  try {
    await guardarProductoConImagenes({
      modo: "crear",
      imagenesNuevas: [{ token: "invalida", nombre: "invalida.jpg", tipo: "image/jpeg", contenido: base64(Buffer.from("no-es-imagen")) }],
      producto: { ...producto, id: "prueba-carga-fallida", variantes: [{ ...producto.variantes[0], imagenes: ["upload:invalida"], miniatura: "upload:invalida" }] },
    });
  } catch {
    falloControlado = true;
  }
  if (!falloControlado) throw new Error("La imagen inválida no fue rechazada.");
  if ((await readFile(archivoCatalogo, "utf8")) !== antesDelFallo) throw new Error("El JSON cambió después de un procesamiento fallido.");

  console.log("OK: JPG, PNG y WebP procesados a original, 480w y 768w.");
  console.log("OK: imágenes pequeñas no se amplían.");
  console.log("OK: mezcla, orden y miniatura principal.");
  console.log("OK: un fallo de procesamiento no modifica catalogo.json.");
} finally {
  await guardarCatalogo(original);
  for (const ruta of rutasCreadas) {
    const base = path.join(carpetaProductos, path.basename(ruta, ".webp"));
    await Promise.all([".webp", "-480w.webp", "-768w.webp"].map((sufijo) => rm(`${base}${sufijo}`, { force: true })));
  }
  const restaurado = await readFile(archivoCatalogo, "utf8");
  if (JSON.stringify(JSON.parse(restaurado)) !== JSON.stringify(JSON.parse(contenidoOriginal))) {
    console.error("ERROR: no se pudo restaurar completamente el catálogo después de la prueba.");
    process.exitCode = 1;
  }
}
