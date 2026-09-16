const urlSupabase = (typeof import.meta.env === "undefined"
  ? undefined : import.meta.env.VITE_SUPABASE_URL)?.replace(/\/$/, "");
const publishableKey = typeof import.meta.env === "undefined"
  ? undefined : import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export class ErrorDisponibilidad extends Error {
  constructor(mensaje = "No pudimos verificar la disponibilidad en este momento.", opciones) {
    super(mensaje, opciones);
    this.name = "ErrorDisponibilidad";
  }
}

export function resolverOpcionesInventario(filas) {
  return filas.map((fila) => ({
    variantId: fila.variant_id,
    displaySize: fila.display_size,
    inventoryGroupId: fila.inventory_group_id,
    stockDisponible: fila.stock,
    available: fila.stock > 0,
  }));
}

async function consultar(tabla, parametros) {
  if (!urlSupabase || !publishableKey) throw new ErrorDisponibilidad("Disponibilidad por confirmar.");
  let respuesta;
  try {
    respuesta = await fetch(`${urlSupabase}/rest/v1/${tabla}?${new URLSearchParams(parametros)}`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
    });
  } catch (error) {
    throw new ErrorDisponibilidad(undefined, { cause: error });
  }
  if (!respuesta.ok) throw new ErrorDisponibilidad();
  try {
    return await respuesta.json();
  } catch (error) {
    throw new ErrorDisponibilidad(undefined, { cause: error });
  }
}

export async function consultarDisponibilidadVariante(productId, variantKey) {
  const filas = await consultar("public_inventory_availability", {
    select: "product_id,variant_key,variant_id,display_size,inventory_group_id,stock,active",
    product_id: `eq.${productId}`,
    variant_key: `eq.${variantKey}`,
    active: "eq.true",
    order: "display_size.asc",
  });
  const options = resolverOpcionesInventario(filas);
  return { configured: options.length > 0, variantId: filas[0]?.variant_id ?? null, options };
}

export async function revalidarDisponibilidadLineas(lineas) {
  const idsProductos = [...new Set(lineas.map(({ productoId, varianteKey, selectedSize }) =>
    productoId && varianteKey && selectedSize ? productoId : null).filter(Boolean))];
  const opciones = idsProductos.length === 0 ? [] : await consultar("public_inventory_availability", {
    select: "product_id,variant_key,variant_id,display_size,inventory_group_id,stock,active",
    product_id: `in.(${idsProductos.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(",")})`,
    active: "eq.true",
  });
  const opcionPorIdentidad = new Map(opciones.map((opcion) =>
    [`${opcion.product_id}\u0000${opcion.variant_key}\u0000${opcion.display_size}`, opcion]));
  return lineas.map((linea) => {
    const opcion = opcionPorIdentidad.get(`${linea.productoId}\u0000${linea.varianteKey}\u0000${linea.selectedSize}`);
    return {
      productoId: linea.productoId,
      varianteKey: linea.varianteKey,
      selectedSize: linea.selectedSize,
      vigente: Boolean(opcion && Number.isInteger(opcion.stock) && opcion.stock >= 0),
      inventoryGroupId: opcion?.inventory_group_id ?? "",
      varianteId: opcion?.variant_id ?? "",
      stockDisponible: opcion?.stock ?? 0,
    };
  });
}
