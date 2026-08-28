import path from "node:path";
import { Buffer } from "node:buffer";
import sharp from "sharp";

sharp.cache(false);

export const ANCHOS_RESPONSIVOS = [480, 768];
export const CALIDAD_WEBP = 82;
export const ANCHO_ORIGINAL = 1200;
export const FORMATOS_ADMITIDOS = new Set(["jpeg", "png", "webp"]);

export async function validarImagen(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("La imagen está vacía.");
  if (buffer.length > 25 * 1024 * 1024) throw new Error("Cada imagen puede pesar máximo 25 MB.");
  const metadata = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
  if (!FORMATOS_ADMITIDOS.has(metadata.format)) {
    throw new Error("Solo se permiten imágenes JPG, JPEG, PNG o WebP.");
  }
  if (!metadata.width || !metadata.height) throw new Error("No se pudieron leer las dimensiones de la imagen.");
  return metadata;
}

export async function procesarImagenBuffer(buffer, carpetaSalida, nombreBase) {
  await validarImagen(buffer);
  const original = path.join(carpetaSalida, `${nombreBase}.webp`);
  await sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: ANCHO_ORIGINAL, withoutEnlargement: true })
    .webp({ quality: CALIDAD_WEBP })
    .toFile(original);

  const derivados = [];
  for (const width of ANCHOS_RESPONSIVOS) {
    const salida = path.join(carpetaSalida, `${nombreBase}-${width}w.webp`);
    await sharp(original)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: CALIDAD_WEBP })
      .toFile(salida);
    derivados.push(salida);
  }
  return { original, derivados };
}

export async function generarDerivadosDesdeWebp(entrada, salidas) {
  await Promise.all(
    salidas.map(({ width, salida }) =>
      sharp(entrada)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: CALIDAD_WEBP })
        .toFile(salida)
    )
  );
}
