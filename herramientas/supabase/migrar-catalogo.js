import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUTA_CATALOGO = path.join(RAIZ, "src/data/catalogo.json");
const RUTA_ENTORNO = path.join(RAIZ, "herramientas/supabase/.env");
const TALLA_UNICA = "ÚNICA";
const HEX = /^#[0-9a-f]{6}$/i;
const PRECIO_COP = /^\d{1,3}(?:\.\d{3})*$/;

function textoUsable(valor) {
  return typeof valor === "string" && valor.trim().length > 0;
}

function precioAEntero(precio) {
  if (!textoUsable(precio) || !PRECIO_COP.test(precio)) return null;
  const entero = Number(precio.replaceAll(".", ""));
  return Number.isSafeInteger(entero) ? entero : null;
}

function agregarError(errores, ruta, mensaje) {
  errores.push(`${ruta}: ${mensaje}`);
}

function analizarCatalogo(catalogo) {
  const errores = [];
  const advertencias = [];
  const products = [];
  const variants = [];
  const inventory = [];
  const idsProducto = new Set();
  const paresInventario = new Set();
  const productosConTalla = new Set();
  const productosSinTalla = new Set();

  if (!Array.isArray(catalogo)) {
    agregarError(errores, "catálogo", "la raíz debe ser un array");
    return { errores, advertencias, products, variants, inventory, productosConTalla, productosSinTalla };
  }

  catalogo.forEach((producto, indiceProducto) => {
    const rutaProducto = `productos[${indiceProducto}]`;
    if (!textoUsable(producto.id)) agregarError(errores, rutaProducto, "id no usable");
    else if (idsProducto.has(producto.id)) agregarError(errores, rutaProducto, `id duplicado: ${producto.id}`);
    else idsProducto.add(producto.id);

    const precio = precioAEntero(producto.precio);
    if (precio === null) agregarError(errores, `${rutaProducto}.precio`, `precio inválido: ${JSON.stringify(producto.precio)}`);
    if (!textoUsable(producto.nombre)) agregarError(errores, `${rutaProducto}.nombre`, "nombre no usable");
    if (!textoUsable(producto.categoria)) agregarError(errores, `${rutaProducto}.categoria`, "categoría no usable");
    if (typeof producto.activo !== "boolean") agregarError(errores, `${rutaProducto}.activo`, "debe ser boolean");
    if (typeof producto.favorito !== "boolean") agregarError(errores, `${rutaProducto}.favorito`, "debe ser boolean");
    if (producto.descripcion === undefined || producto.descripcion === null) {
      advertencias.push(`${rutaProducto}.descripcion no existe; se preserva como null`);
    } else if (typeof producto.descripcion !== "string") {
      agregarError(errores, `${rutaProducto}.descripcion`, "debe ser texto, null o estar ausente");
    }

    products.push({
      id: producto.id,
      name: producto.nombre,
      category: producto.categoria,
      price_cop: precio,
      active: producto.activo,
      favorite: producto.favorito,
      description: producto.descripcion ?? null,
    });

    if (!Array.isArray(producto.variantes) || producto.variantes.length === 0) {
      agregarError(errores, `${rutaProducto}.variantes`, "producto sin variantes");
      return;
    }

    const idsVariante = new Set();
    let variantesUsables = 0;
    let manejaTalla = false;

    producto.variantes.forEach((variante, indiceVariante) => {
      const rutaVariante = `${rutaProducto}.variantes[${indiceVariante}]`;
      if (!textoUsable(variante.id)) agregarError(errores, rutaVariante, "id de variante no usable");
      else if (idsVariante.has(variante.id)) agregarError(errores, rutaVariante, `id de variante duplicado en el producto: ${variante.id}`);
      else idsVariante.add(variante.id);

      if (!textoUsable(variante.nombre)) agregarError(errores, `${rutaVariante}.nombre`, "nombre no usable");
      if (typeof variante.codigo !== "string") agregarError(errores, `${rutaVariante}.codigo`, "debe ser texto");
      else if (variante.codigo !== "" && !HEX.test(variante.codigo)) agregarError(errores, `${rutaVariante}.codigo`, `HEX inválido: ${variante.codigo}`);
      else if (variante.codigo === "") advertencias.push(`${rutaVariante}.codigo está vacío; se preserva sin inventar un color`);
      if (!Array.isArray(variante.imagenes)) agregarError(errores, `${rutaVariante}.imagenes`, "debe ser un array");
      else if (variante.imagenes.some((imagen) => !textoUsable(imagen))) agregarError(errores, `${rutaVariante}.imagenes`, "contiene una ruta no usable");
      if (typeof variante.miniatura !== "string") agregarError(errores, `${rutaVariante}.miniatura`, "debe ser texto");
      if (variante.activo !== undefined && typeof variante.activo !== "boolean") agregarError(errores, `${rutaVariante}.activo`, "debe ser boolean cuando está presente");

      const activa = variante.activo !== false;
      const tieneImagen = Array.isArray(variante.imagenes) && variante.imagenes.length > 0 && variante.imagenes.every(textoUsable);
      const tieneMiniatura = textoUsable(variante.miniatura);
      if (activa && (!tieneImagen || !tieneMiniatura)) agregarError(errores, rutaVariante, "variante activa sin miniatura e imágenes usables");
      if (activa && tieneImagen && tieneMiniatura) variantesUsables += 1;
      if (variante.activo === undefined) advertencias.push(`${rutaVariante}.activo no existe; se interpreta como true, igual que el catálogo actual`);

      if (!Array.isArray(variante.tallas)) {
        agregarError(errores, `${rutaVariante}.tallas`, "debe ser un array");
      }
      const tallasOriginales = Array.isArray(variante.tallas) ? variante.tallas : [];
      if (tallasOriginales.some((talla) => !textoUsable(talla))) agregarError(errores, `${rutaVariante}.tallas`, "contiene una talla no usable");
      if (new Set(tallasOriginales).size !== tallasOriginales.length) agregarError(errores, `${rutaVariante}.tallas`, "contiene tallas duplicadas");
      if (tallasOriginales.length > 0) manejaTalla = true;
      const tallas = tallasOriginales.length > 0 ? tallasOriginales : [TALLA_UNICA];

      const claveTemporal = `${producto.id}\u0000${variante.id}`;
      variants.push({
        product_id: producto.id,
        variant_key: variante.id,
        name: variante.nombre,
        color_hex: variante.codigo,
        active: activa,
        thumbnail: variante.miniatura,
        images: variante.imagenes,
        _migration_key: claveTemporal,
      });

      tallas.forEach((talla) => {
        const par = `${claveTemporal}\u0000${talla}`;
        if (paresInventario.has(par)) agregarError(errores, `${rutaVariante}.tallas`, `inventario duplicado para ${talla}`);
        else paresInventario.add(par);
        inventory.push({ _migration_key: claveTemporal, size: talla, stock: 0, active: activa });
      });
    });

    if (producto.activo && variantesUsables === 0) agregarError(errores, rutaProducto, "producto activo sin variante activa usable");
    (manejaTalla ? productosConTalla : productosSinTalla).add(producto.id);
    if (Array.isArray(producto.tallas)) {
      const tallasVariantes = producto.variantes.flatMap((variante) => variante.tallas ?? []);
      if (JSON.stringify(producto.tallas) !== JSON.stringify(tallasVariantes)) {
        advertencias.push(`${rutaProducto}.tallas no coincide con variantes[].tallas; se usa el dato de cada variante`);
      }
    }
  });

  return { errores, advertencias, products, variants, inventory, productosConTalla, productosSinTalla };
}

function sinCamposInternos(registro) {
  return Object.fromEntries(Object.entries(registro).filter(([clave]) => !clave.startsWith("_")));
}

function ejemploCompleto(resultado, idProducto) {
  const product = resultado.products.find(({ id }) => id === idProducto);
  const variants = resultado.variants.filter(({ product_id }) => product_id === idProducto);
  return {
    product,
    variants: variants.map(sinCamposInternos),
    inventory: resultado.inventory
      .filter((fila) => variants.some((variante) => variante._migration_key === fila._migration_key))
      .map(({ _migration_key, ...fila }) => ({
        variant_key: variants.find((variante) => variante._migration_key === _migration_key).variant_key,
        ...fila,
      })),
  };
}

function mostrarReporte(catalogo, resultado) {
  const productosValidos = Math.max(0, catalogo.length - new Set(resultado.errores.map((error) => error.match(/^productos\[(\d+)\]/)?.[1]).filter(Boolean)).size);
  console.log("\nREPORTE DRY-RUN");
  console.log(`Productos leídos: ${catalogo.length}`);
  console.log(`Productos válidos: ${productosValidos}`);
  console.log(`Variantes: ${resultado.variants.length}`);
  console.log(`Registros de inventario a crear: ${resultado.inventory.length}`);
  console.log(`Productos sin talla: ${resultado.productosSinTalla.size}`);
  console.log(`Productos con talla: ${resultado.productosConTalla.size}`);
  console.log(`Errores: ${resultado.errores.length}`);
  console.log(`Advertencias: ${resultado.advertencias.length}`);

  if (resultado.errores.length) {
    console.log("\nERRORES");
    resultado.errores.forEach((error) => console.log(`- ${error}`));
  }
  if (resultado.advertencias.length) {
    console.log("\nADVERTENCIAS");
    const grupos = [
      ["codigo está vacío", "variantes con codigo vacío; se conserva exactamente sin inventar color"],
      ["activo no existe", "variantes sin activo explícito; se interpretan como true según la semántica actual"],
      ["tallas no coincide", "productos cuyo producto.tallas difiere de variantes[].tallas; gobierna cada variante"],
      ["descripcion no existe", "productos sin descripcion; se conserva como null"],
    ];
    const agrupadas = new Set();
    for (const [patron, mensaje] of grupos) {
      const coincidencias = resultado.advertencias.filter((advertencia) => advertencia.includes(patron));
      coincidencias.forEach((advertencia) => agrupadas.add(advertencia));
      if (coincidencias.length) console.log(`- ${coincidencias.length} ${mensaje}`);
    }
    resultado.advertencias.filter((advertencia) => !agrupadas.has(advertencia)).forEach((advertencia) => console.log(`- ${advertencia}`));
  }

  const conTallas = catalogo.find((producto) => producto.categoria === "trajes" && producto.variantes.some((variante) => variante.tallas.length > 0));
  const variasVariantes = catalogo.find((producto) => producto.variantes.length > 1 && producto.variantes.every((variante) => variante.activo !== false));
  const sinTalla = catalogo.find((producto) => producto.variantes.every((variante) => variante.tallas.length === 0));
  console.log("\n3 EJEMPLOS TRANSFORMADOS COMPLETOS");
  for (const [tipo, producto] of [["Traje con tallas", conTallas], ["Producto con varias variantes", variasVariantes], ["Producto sin talla", sinTalla]]) {
    console.log(`\n${tipo}:`);
    console.log(JSON.stringify(ejemploCompleto(resultado, producto.id), null, 2));
  }
}

async function upsert(tabla, filas, conflicto, columnasRetorno = "*", resolucion = "merge-duplicates") {
  const urlBase = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const llave = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const respuesta = await fetch(`${urlBase}/rest/v1/${tabla}?on_conflict=${encodeURIComponent(conflicto)}&select=${encodeURIComponent(columnasRetorno)}`, {
    method: "POST",
    headers: {
      apikey: llave,
      Authorization: `Bearer ${llave}`,
      "Content-Type": "application/json",
      Prefer: `resolution=${resolucion},return=representation`,
    },
    body: JSON.stringify(filas),
  });
  if (!respuesta.ok) throw new Error(`Supabase rechazó upsert de ${tabla} (${respuesta.status}): ${await respuesta.text()}`);
  return respuesta.json();
}

async function escribirEnSupabase(resultado) {
  if (!textoUsable(process.env.SUPABASE_URL) || !textoUsable(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno (SUPABASE_SERVICE_ROLE_KEY se admite como fallback).");
  }
  await upsert("products", resultado.products, "id", "id");
  const variantesGuardadas = await upsert("variants", resultado.variants.map(sinCamposInternos), "product_id,variant_key", "id,product_id,variant_key");
  const idsVariantes = new Map(variantesGuardadas.map((variante) => [`${variante.product_id}\u0000${variante.variant_key}`, variante.id]));
  const inventario = resultado.inventory.map(({ _migration_key, ...fila }) => ({ ...fila, variant_id: idsVariantes.get(_migration_key) }));
  if (inventario.some(({ variant_id }) => !variant_id)) throw new Error("Supabase no devolvió el UUID de una o más variantes; no se escribió inventario.");
  await upsert("inventory", inventario, "variant_id,size", "id", "ignore-duplicates");
  console.log(`Migración terminada: ${resultado.products.length} productos, ${resultado.variants.length} variantes y ${inventario.length} registros de inventario.`);
}

function cargarEntornoLocal() {
  try {
    process.loadEnvFile(RUTA_ENTORNO);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`No existe el archivo de credenciales requerido para --write: ${RUTA_ENTORNO}`, { cause: error });
    }
    throw new Error(`No se pudo cargar el archivo de credenciales para --write: ${RUTA_ENTORNO}`, { cause: error });
  }
}

async function principal() {
  const escribir = process.argv.includes("--write");
  const argumentosValidos = new Set(["--dry-run", "--write"]);
  const desconocidos = process.argv.slice(2).filter((argumento) => !argumentosValidos.has(argumento));
  if (desconocidos.length || (!process.argv.includes("--dry-run") && !escribir)) throw new Error("Uso: node migrar-catalogo.js --dry-run | --write");

  const catalogo = JSON.parse(await readFile(RUTA_CATALOGO, "utf8"));
  const resultado = analizarCatalogo(catalogo);
  mostrarReporte(catalogo, resultado);
  if (resultado.errores.length) throw new Error("Validación fallida. No se permite escribir en Supabase.");
  if (!escribir) {
    console.log("\nDRY-RUN COMPLETADO: no se abrió ninguna conexión ni se modificó Supabase.");
    return;
  }
  cargarEntornoLocal();
  console.log("\nPreflight obligatorio superado. Iniciando escritura idempotente sin borrados...");
  await escribirEnSupabase(resultado);
}

principal().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exitCode = 1;
});
