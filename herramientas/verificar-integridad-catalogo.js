import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validarCatalogo } from "./gestor-local/catalogo-repository.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogo = JSON.parse(await readFile(path.join(raiz, "src/data/catalogo.json"), "utf8"));
validarCatalogo(catalogo);

const ids = new Set(catalogo.map(({ id }) => id));
const variantes = catalogo.flatMap(({ variantes }) => variantes);
const conColorHex = variantes.filter((variante) => "colorHex" in variante);
const rutas = [...new Set(variantes.flatMap(({ imagenes }) => imagenes))];
const inexistentes = [];
for (const ruta of rutas) {
  try { await access(path.join(raiz, "public", ruta.replace(/^[/\\]+/, ""))); }
  catch { inexistentes.push(ruta); }
}

console.log(`OK: ${catalogo.length} productos y ${ids.size} IDs únicos.`);
console.log(`OK: ${variantes.length} variantes estructuralmente válidas.`);
console.log(`OK: ${conColorHex.length} campos colorHex; codigo conserva #HEX.`);
if (inexistentes.length) {
  console.warn(`Aviso: ${inexistentes.length} referencia(s) histórica(s) sin archivo físico:`);
  inexistentes.forEach((ruta) => console.warn(`- ${ruta}`));
} else {
  console.log(`OK: ${rutas.length} imágenes referenciadas existen.`);
}
