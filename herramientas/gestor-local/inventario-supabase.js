import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { TALLAS_VERANO } from "../../src/config/tallas.js";

const raizProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rutaEntorno = path.join(raizProyecto, "herramientas/supabase/.env");

export class ErrorInventario extends Error {
  constructor(mensaje, estado = 500, opciones) {
    super(mensaje, opciones);
    this.name = "ErrorInventario";
    this.estado = estado;
  }
}

export function validarConfiguracionUnidades({ variant_id: variantId, units: unidades }) {
  if (typeof variantId !== "string" || !variantId.trim()) throw new ErrorInventario("variant_id es obligatorio.", 400);
  if (!Array.isArray(unidades) || unidades.length === 0) throw new ErrorInventario("Una variante debe conservar al menos una unidad física.", 400);
  const tallasVisibles = new Set();
  return {
    variant_id: variantId,
    units: unidades.map((unidad, indice) => {
      if (!unidad || typeof unidad !== "object" || Array.isArray(unidad)) throw new ErrorInventario(`units[${indice}] debe ser un objeto.`, 400);
      if (unidad.id !== null && unidad.id !== undefined && (typeof unidad.id !== "string" || !unidad.id.trim())) {
        throw new ErrorInventario(`units[${indice}].id no es válido.`, 400);
      }
      if (!TALLAS_VERANO.includes(unidad.physical_size)) throw new ErrorInventario(`units[${indice}] requiere una talla física válida.`, 400);
      if (!Number.isInteger(unidad.stock) || unidad.stock < 0) throw new ErrorInventario(`units[${indice}].stock debe ser un entero mayor o igual a 0.`, 400);
      if (!Array.isArray(unidad.display_sizes) || unidad.display_sizes.length === 0) throw new ErrorInventario(`units[${indice}] debe tener al menos una talla visible.`, 400);
      const visiblesUnidad = new Set();
      for (const talla of unidad.display_sizes) {
        if (!TALLAS_VERANO.includes(talla)) throw new ErrorInventario(`units[${indice}].display_sizes contiene una talla inválida.`, 400);
        if (visiblesUnidad.has(talla)) throw new ErrorInventario(`La talla visible ${talla} está repetida dentro de la unidad.`, 400);
        if (tallasVisibles.has(talla)) throw new ErrorInventario(`La talla visible ${talla} no puede apuntar a dos unidades físicas.`, 400);
        visiblesUnidad.add(talla);
        tallasVisibles.add(talla);
      }
      return { id: unidad.id ?? null, physical_size: unidad.physical_size, stock: unidad.stock, display_sizes: [...visiblesUnidad] };
    }),
  };
}

export function validarConfiguracionGrupos({ variant_id: variantId, groups: grupos }) {
  if (typeof variantId !== "string" || !variantId.trim()) throw new ErrorInventario("variant_id es obligatorio.", 400);
  if (!Array.isArray(grupos) || grupos.length === 0) throw new ErrorInventario("Se requiere al menos un grupo lógico.", 400);
  const tallasVariante = new Set();
  const gruposId = new Set();
  const unidadesId = new Set();
  return {
    variant_id: variantId,
    groups: grupos.map((grupo, indiceGrupo) => {
      if (!grupo || typeof grupo !== "object" || Array.isArray(grupo)) throw new ErrorInventario(`groups[${indiceGrupo}] debe ser un objeto.`, 400);
      if (grupo.id != null && (typeof grupo.id !== "string" || !grupo.id.trim() || gruposId.has(grupo.id))) throw new ErrorInventario("ID de grupo inválido o repetido.", 400);
      if (grupo.id) gruposId.add(grupo.id);
      if (!Array.isArray(grupo.display_sizes) || grupo.display_sizes.length === 0) throw new ErrorInventario("Un grupo necesita al menos una talla visible.", 400);
      const tallasGrupo = new Set();
      for (const talla of grupo.display_sizes) {
        if (!TALLAS_VERANO.includes(talla) || tallasGrupo.has(talla) || tallasVariante.has(talla)) throw new ErrorInventario("Talla visible inválida o duplicada entre grupos.", 400);
        tallasGrupo.add(talla);
        tallasVariante.add(talla);
      }
      if (!Array.isArray(grupo.units)) throw new ErrorInventario("units debe ser un array.", 400);
      return {
        id: grupo.id ?? null,
        display_sizes: [...tallasGrupo],
        units: grupo.units.map((unidad, indiceUnidad) => {
          if (!unidad || typeof unidad !== "object" || Array.isArray(unidad)) throw new ErrorInventario(`groups[${indiceGrupo}].units[${indiceUnidad}] debe ser un objeto.`, 400);
          if (unidad.id != null && (typeof unidad.id !== "string" || !unidad.id.trim() || unidadesId.has(unidad.id))) throw new ErrorInventario("ID de unidad inválido o repetido.", 400);
          if (unidad.id) unidadesId.add(unidad.id);
          if (!TALLAS_VERANO.includes(unidad.physical_size)) throw new ErrorInventario("Cada unidad requiere una talla física confirmada.", 400);
          if (!Array.isArray(unidad.display_sizes) || unidad.display_sizes.length === 0) throw new ErrorInventario("Cada unidad necesita al menos una talla compatible.", 400);
          const compatibles = new Set();
          for (const talla of unidad.display_sizes) {
            if (!tallasGrupo.has(talla) || compatibles.has(talla)) throw new ErrorInventario("Compatibilidad inválida o duplicada dentro de la unidad.", 400);
            compatibles.add(talla);
          }
          return { id: unidad.id ?? null, physical_size: unidad.physical_size, display_sizes: [...compatibles] };
        }),
      };
    }),
  };
}

function cargarCredenciales() {
  try {
    process.loadEnvFile(rutaEntorno);
  } catch (error) {
    if (error?.code === "ENOENT") throw new ErrorInventario("No está configurado el archivo local de credenciales de Supabase.", 503, { cause: error });
    throw new ErrorInventario("No se pudo cargar la configuración local de Supabase.", 503, { cause: error });
  }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new ErrorInventario("Faltan credenciales locales requeridas para consultar Supabase.", 503);
  return { url, secret };
}

export function crearServicioInventario({ fetchImpl = fetch, obtenerCredenciales = cargarCredenciales } = {}) {
  async function solicitar(ruta, opciones = {}) {
    const { url, secret } = obtenerCredenciales();
    let respuesta;
    try {
      respuesta = await fetchImpl(`${url}/rest/v1/${ruta}`, {
        ...opciones,
        headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...opciones.headers },
      });
    } catch (error) {
      throw new ErrorInventario("No se pudo conectar con Supabase.", 502, { cause: error });
    }
    if (!respuesta.ok) {
      let diagnostico;
      try {
        diagnostico = await respuesta.json();
      } catch {
        diagnostico = {};
      }
      const secretos = [
        process.env.SUPABASE_SECRET_KEY,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        secret,
      ].filter(Boolean);
      const redactar = (valor) => {
        if (typeof valor !== "string") return valor ?? null;
        const sinClavesConocidas = secretos.reduce((texto, secreto) => texto.replaceAll(secreto, "[REDACTADO]"), valor);
        return sinClavesConocidas.replace(/sb_secret_[A-Za-z0-9._-]+/g, "[REDACTADO]");
      };
      console.error("Error de inventario devuelto por Supabase:", {
        status: respuesta.status,
        code: redactar(diagnostico.code),
        message: redactar(diagnostico.message),
        details: redactar(diagnostico.details),
        hint: redactar(diagnostico.hint),
      });
      throw new ErrorInventario(`Supabase no pudo completar la operación de inventario (${respuesta.status}).`, 502);
    }
    try {
      return await respuesta.json();
    } catch (error) {
      throw new ErrorInventario("Supabase devolvió una respuesta de inventario inválida.", 502, { cause: error });
    }
  }

  async function leerPorProducto(productId) {
    if (typeof productId !== "string" || !productId.trim()) throw new ErrorInventario("productId es obligatorio.", 400);
    const consultaVariantes = new URLSearchParams({ select: "id,product_id,variant_key,name,active", product_id: `eq.${productId}`, order: "variant_key.asc" });
    const variantes = await solicitar(`variants?${consultaVariantes}`);
    if (!Array.isArray(variantes)) throw new ErrorInventario("Supabase devolvió variantes inválidas.", 502);
    if (variantes.length === 0) throw new ErrorInventario("El producto no tiene variantes migradas en Supabase.", 404);

    const idsVariantes = variantes.map(({ id }) => id);
    const consultaGrupos = new URLSearchParams({ select: "id,variant_id,legacy_stock,stock,active,created_at", variant_id: `in.(${idsVariantes.join(",")})`, active: "eq.true", order: "created_at.asc" });
    const grupos = await solicitar(`inventory_groups?${consultaGrupos}`);
    if (!Array.isArray(grupos)) throw new ErrorInventario("Supabase devolvió grupos de inventario inválidos.", 502);

    const idsGrupos = grupos.map(({ id }) => id);
    let opciones = [];
    if (idsGrupos.length > 0) {
      const consultaOpciones = new URLSearchParams({ select: "id,variant_id,inventory_group_id,display_size,active,sort_order", inventory_group_id: `in.(${idsGrupos.join(",")})`, active: "eq.true", order: "sort_order.asc" });
      opciones = await solicitar(`variant_size_options?${consultaOpciones}`);
      if (!Array.isArray(opciones)) throw new ErrorInventario("Supabase devolvió opciones visibles inválidas.", 502);
    }

    const idsOpciones = opciones.map(({ id }) => id);
    const consultaUnidades = idsGrupos.length ? new URLSearchParams({ select: "id,inventory_group_id,physical_size,status,active,created_at", inventory_group_id: `in.(${idsGrupos.join(",")})`, status: "in.(available,pending)", order: "created_at.asc" }) : null;
    const unidades = consultaUnidades ? await solicitar(`inventory_units?${consultaUnidades}`) : [];
    if (!Array.isArray(unidades)) throw new ErrorInventario("Supabase devolvió unidades físicas inválidas.", 502);
    const idsUnidades = unidades.map(({ id }) => id);
    const consultaCompatibilidades = idsUnidades.length && idsOpciones.length ? new URLSearchParams({ select: "inventory_unit_id,variant_size_option_id,active", inventory_unit_id: `in.(${idsUnidades.join(",")})`, active: "eq.true" }) : null;
    const compatibilidades = consultaCompatibilidades ? await solicitar(`inventory_unit_size_options?${consultaCompatibilidades}`) : [];
    if (!Array.isArray(compatibilidades)) throw new ErrorInventario("Supabase devolvió compatibilidades inválidas.", 502);

    const opcionesPorId = new Map(opciones.map((opcion) => [opcion.id, opcion]));
    const compatibilidadesPorUnidad = Map.groupBy(compatibilidades, ({ inventory_unit_id: unitId }) => unitId);
    const unidadesPorGrupo = Map.groupBy(unidades, ({ inventory_group_id: groupId }) => groupId);
    const opcionesPorGrupo = Map.groupBy(opciones, ({ inventory_group_id: groupId }) => groupId);
    const gruposPorVariante = Map.groupBy(grupos, ({ variant_id: variantId }) => variantId);
    return {
      product_id: productId,
      variants: variantes.map((variante) => ({
        ...variante,
        groups: (gruposPorVariante.get(variante.id) ?? []).map((grupo) => ({
          ...grupo,
          display_sizes: (opcionesPorGrupo.get(grupo.id) ?? []).map(({ display_size: displaySize }) => displaySize),
          units: (unidadesPorGrupo.get(grupo.id) ?? []).map((unidad) => ({
            ...unidad,
            display_sizes: (compatibilidadesPorUnidad.get(unidad.id) ?? [])
              .map(({ variant_size_option_id: optionId }) => opcionesPorId.get(optionId)?.display_size)
              .filter(Boolean),
          })),
        })),
      })),
    };
  }

  async function sincronizarProducto(producto) {
    const precio = Number(String(producto.precio).replaceAll(".", ""));
    if (!Number.isSafeInteger(precio) || precio < 0) throw new ErrorInventario("El precio local no es válido para Supabase.", 400);
    const variantes = producto.variantes.map((variante) => ({
      product_id: producto.id,
      variant_key: variante.id,
      name: variante.nombre,
      color_hex: variante.codigo,
      active: variante.activo !== false,
      thumbnail: variante.miniatura,
      images: variante.imagenes,
    }));
    const preferencia = { Prefer: "resolution=merge-duplicates,return=representation" };
    await solicitar(`products?on_conflict=id&select=id`, {
      method: "POST", headers: preferencia,
      body: JSON.stringify([{
        id: producto.id, name: producto.nombre, category: producto.categoria,
        price_cop: precio, active: producto.activo, favorite: producto.favorito,
        description: producto.descripcion ?? null,
      }]),
    });
    const guardadas = await solicitar("variants?on_conflict=product_id,variant_key&select=id,product_id,variant_key", {
      method: "POST", headers: preferencia, body: JSON.stringify(variantes),
    });
    if (!Array.isArray(guardadas) || guardadas.length !== variantes.length ||
      guardadas.some(({ id, product_id: productId, variant_key: key }) =>
        !id || !variantes.some((variante) => variante.product_id === productId && variante.variant_key === key))) {
      throw new ErrorInventario("Supabase no devolvió los UUID de todas las variantes.", 502);
    }
    return { variantes: guardadas };
  }

  async function guardar(configuracion, confirmarReconfiguracion = false) {
    const validada = validarConfiguracionUnidades(configuracion);
    const unidades = await solicitar("rpc/admin_save_inventory_units", {
      method: "POST",
      body: JSON.stringify({ p_variant_id: validada.variant_id, p_units: validada.units, p_confirm_reconfigure: confirmarReconfiguracion === true }),
    });
    if (!Array.isArray(unidades)) throw new ErrorInventario("Supabase devolvió una configuración de unidades inválida.", 502);
    return { variant_id: validada.variant_id, units: unidades };
  }

  async function guardarGrupos(configuracion, confirmarReconfiguracion = false) {
    const validada = validarConfiguracionGrupos(configuracion);
    const grupos = await solicitar("rpc/admin_save_inventory_physical_units", {
      method: "POST",
      body: JSON.stringify({
        p_variant_id: validada.variant_id,
        p_groups: validada.groups,
        p_confirm_reconfigure: confirmarReconfiguracion === true,
      }),
    });
    if (!Array.isArray(grupos)) throw new ErrorInventario("Supabase devolvió grupos físicos inválidos.", 502);
    return { variant_id: validada.variant_id, groups: grupos };
  }

  return { leerPorProducto, guardar, guardarGrupos, sincronizarProducto };
}

export const servicioInventario = crearServicioInventario();
