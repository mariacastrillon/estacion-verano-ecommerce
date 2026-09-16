import { createServer } from "node:http";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { leerCatalogo, guardarCatalogo } from "./catalogo-repository.js";
import { guardarProductoConImagenes } from "./procesar-imagenes-upload.js";
import { ErrorInventario, servicioInventario } from "./inventario-supabase.js";

const HOST = "127.0.0.1";
const PORT = 4174;
const ORIGENES_PERMITIDOS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

function responder(respuesta, estado, contenido) {
  respuesta.writeHead(estado, { "Content-Type": "application/json; charset=utf-8" });
  respuesta.end(JSON.stringify(contenido));
}

async function leerJson(solicitud) {
  let contenido = "";
  for await (const fragmento of solicitud) {
    contenido += fragmento;
    if (contenido.length > 100_000_000) throw new Error("La solicitud es demasiado grande.");
  }
  return contenido ? JSON.parse(contenido) : {};
}

function comprobarSolicitudLocal(solicitud) {
  if (solicitud.headers.host !== `${HOST}:${PORT}`) return false;
  const origen = solicitud.headers.origin;
  return !origen || ORIGENES_PERMITIDOS.has(origen);
}

function segmentosDe(ruta) {
  return ruta.split("/").filter(Boolean).map(decodeURIComponent);
}

async function sincronizarGuardado(producto) {
  try {
    const { variantes } = await servicioInventario.sincronizarProducto(producto);
    return { ok: true, variantes };
  } catch {
    return { ok: false, mensaje: "Producto guardado localmente. No se pudo sincronizar con Supabase; vuelve a guardar para reintentar." };
  }
}

async function gestionar(solicitud, respuesta) {
  if (!comprobarSolicitudLocal(solicitud)) {
    responder(respuesta, 403, { error: "Solicitud local no permitida." });
    return;
  }

  const url = new URL(solicitud.url, `http://${HOST}:${PORT}`);
  const segmentos = segmentosDe(url.pathname);
  if (segmentos[0] !== "api" || segmentos[1] !== "gestor") {
    responder(respuesta, 404, { error: "Ruta no encontrada." });
    return;
  }

  if (solicitud.method === "GET" && segmentos.length === 3 && segmentos[2] === "catalogo") {
    responder(respuesta, 200, { productos: await leerCatalogo() });
    return;
  }

  if (solicitud.method === "GET" && segmentos[2] === "inventario" && segmentos.length === 4) {
    responder(respuesta, 200, await servicioInventario.leerPorProducto(segmentos[3]));
    return;
  }

  if (solicitud.method === "PUT" && segmentos[2] === "inventario" && segmentos[3] === "grupos" && segmentos.length === 4) {
    const { variant_id: variantId, groups, confirmar_reconfiguracion: confirmar } = await leerJson(solicitud);
    responder(respuesta, 200, await servicioInventario.guardarGrupos({ variant_id: variantId, groups }, confirmar));
    return;
  }

  if (solicitud.method === "PUT" && segmentos[2] === "inventario" && segmentos[3] === "unidades" && segmentos.length === 4) {
    responder(respuesta, 410, { error: "La escritura antigua por stock numérico fue reemplazada por unidades físicas." });
    return;
  }

  const esProductos = segmentos[2] === "productos";
  if (solicitud.method === "POST" && esProductos && segmentos.length === 3) {
    const { producto, imagenesNuevas } = await leerJson(solicitud);
    const guardado = await guardarProductoConImagenes({ producto, imagenesNuevas, modo: "crear" });
    responder(respuesta, 201, { producto: guardado, sincronizacion: await sincronizarGuardado(guardado) });
    return;
  }

  if (solicitud.method === "PUT" && esProductos && segmentos.length === 4) {
    const id = segmentos[3];
    const { producto, imagenesNuevas } = await leerJson(solicitud);
    const guardado = await guardarProductoConImagenes({ producto, imagenesNuevas, modo: "editar", idOriginal: id });
    responder(respuesta, 200, { producto: guardado, sincronizacion: await sincronizarGuardado(guardado) });
    return;
  }

  if (solicitud.method === "PATCH" && esProductos && segmentos[4] === "activo") {
    const id = segmentos[3];
    const { activo } = await leerJson(solicitud);
    if (typeof activo !== "boolean") throw new Error("activo debe ser booleano.");
    const catalogo = await leerCatalogo();
    const producto = catalogo.find((item) => item.id === id);
    if (!producto) {
      responder(respuesta, 404, { error: "Producto no encontrado." });
      return;
    }
    producto.activo = activo;
    await guardarCatalogo(catalogo);
    responder(respuesta, 200, { producto });
    return;
  }

  if (
    solicitud.method === "PATCH" && esProductos &&
    segmentos[4] === "variantes" && segmentos[6] === "activo"
  ) {
    const [, , , idProducto, , idVariante] = segmentos;
    const { activo } = await leerJson(solicitud);
    if (typeof activo !== "boolean") throw new Error("activo debe ser booleano.");
    const catalogo = await leerCatalogo();
    const producto = catalogo.find(({ id }) => id === idProducto);
    const variante = producto?.variantes.find(({ id }) => id === idVariante);
    if (!variante) {
      responder(respuesta, 404, { error: "Variante no encontrada." });
      return;
    }
    variante.activo = activo;
    await guardarCatalogo(catalogo);
    responder(respuesta, 200, { variante });
    return;
  }

  responder(respuesta, 404, { error: "Ruta no encontrada." });
}

export function iniciarServidorGestor() {
  const servidor = createServer((solicitud, respuesta) => {
    gestionar(solicitud, respuesta).catch((error) => {
      const estado = error instanceof ErrorInventario ? error.estado : 400;
      responder(respuesta, estado, { error: error.message || "No se pudo completar la operación." });
    });
  });
  servidor.listen(PORT, HOST, () => {
    console.log(`Gestor local: http://${HOST}:${PORT}`);
  });
  return servidor;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  iniciarServidorGestor();
}
