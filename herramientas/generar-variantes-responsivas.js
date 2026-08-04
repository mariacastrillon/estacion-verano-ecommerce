import fs from "fs";
import path from "path";
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

  await Promise.all(
    archivos.flatMap((archivo) => {
      const entrada = path.join(carpetaProductos, archivo);
      const nombre = path.parse(archivo).name;

      return anchos.map((width) =>
        sharp(entrada)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(path.join(carpetaProductos, `${nombre}-${width}w.webp`))
      );
    })
  );

  console.log(`Generadas ${archivos.length * anchos.length} variantes responsivas.`);
}

generarVariantesResponsivas();
