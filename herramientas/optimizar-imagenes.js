import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const carpetaEntrada = path.join(__dirname, "../public/productos");

const extensiones = [".jpg", ".jpeg", ".png"];

async function optimizar() {

    const archivos = fs.readdirSync(carpetaEntrada);

    let contador = 0;

    for (const archivo of archivos) {

        const extension = path.extname(archivo).toLowerCase();

        if (!extensiones.includes(extension))
            continue;

        const entrada = path.join(carpetaEntrada, archivo);

        const salida = path.join(
            carpetaEntrada,
            path.parse(archivo).name + ".webp"
        );

        const antes = fs.statSync(entrada).size;

        await sharp(entrada)
            .resize({
                width: 1200,
                withoutEnlargement: true,
            })
            .webp({
                quality: 82,
            })
            .toFile(salida);

        const despues = fs.statSync(salida).size;

        const ahorro = (
            (1 - despues / antes) * 100
        ).toFixed(1);

        console.log(
            `✓ ${archivo}  (${ahorro}% menos)`
        );

        contador++;
    }

    console.log("");
    console.log(`🎉 ${contador} imágenes optimizadas.`);
}

optimizar();