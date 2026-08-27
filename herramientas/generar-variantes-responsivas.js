import fs from "fs";
import path from "path";
import process from "node:process";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const carpetaProductos = path.join(__dirname, "../public/productos");
const anchos = [480, 768];

async function generarVariantesResponsivas() {
  const archivos = fs
    .readdirSync(carpetaProductos)
    .filter((archivo) => archivo.endsWith(".webp"))
    .filter((archivo) => !/-\d+w\.webp$/.test(archivo));

  const tareas = archivos.flatMap((archivo) => {
      const entrada = path.join(carpetaProductos, archivo);
      const nombre = path.parse(archivo).name;
      const fechaFuente = fs.statSync(entrada).mtimeMs;

      return anchos.flatMap((width) => {
        const salida = path.join(carpetaProductos, `${nombre}-${width}w.webp`);
        const necesitaGenerarse =
          !fs.existsSync(salida) || fs.statSync(salida).mtimeMs < fechaFuente;

        if (!necesitaGenerarse) return [];

        return sharp(entrada)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(salida);
      });
    });

  await Promise.all(tareas);

  console.log(
    tareas.length > 0
      ? `Generadas o actualizadas ${tareas.length} variantes responsivas.`
      : "Las variantes responsivas ya estaban actualizadas."
  );
}

generarVariantesResponsivas().catch((error) => {
  console.error("No se pudieron generar las variantes responsivas:", error);
  process.exitCode = 1;
});
