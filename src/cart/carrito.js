export const CARRITO_STORAGE_KEY = "verano_carrito";

export const crearClaveLinea = ({ productoId, varianteId, selectedSize = "", talla = "" }) =>
  `${productoId}::${varianteId}::${selectedSize || talla}`;

export function precioACentavos(precio) {
  if (typeof precio === "number") return Number.isFinite(precio) ? Math.max(0, Math.round(precio * 100)) : 0;
  if (typeof precio !== "string") return 0;
  const pesos = Number.parseInt(precio.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(pesos) ? pesos * 100 : 0;
}

export const formatearCOP = (centavos) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.max(0, Math.round(centavos / 100)));

export const totalUnidades = (lineas) => lineas.reduce((total, linea) => total + linea.cantidad, 0);
export const subtotalCarrito = (lineas) => lineas.reduce(
  (total, linea) => total + precioACentavos(linea.precio) * linea.cantidad, 0
);
export const cantidadEnGrupo = (lineas, inventoryGroupId) => lineas
  .filter((linea) => inventoryGroupId && linea.inventoryGroupId === inventoryGroupId)
  .reduce((total, linea) => total + linea.cantidad, 0);

export function crearLineaCarrito({ producto, variante, opcionInventario }) {
  if (!producto?.id || !producto?.nombre || !variante?.id || !opcionInventario?.inventoryGroupId) return null;
  if (!opcionInventario.displaySize || !Number.isInteger(opcionInventario.stockDisponible)) return null;
  return {
    productoId: producto.id,
    nombre: producto.nombre,
    varianteId: opcionInventario.variantId,
    varianteKey: variante.id,
    varianteNombre: variante.nombre ?? "",
    selectedSize: opcionInventario.displaySize,
    inventoryGroupId: opcionInventario.inventoryGroupId,
    stockDisponible: opcionInventario.stockDisponible,
    cantidad: 1,
    precio: producto.precio,
    imagen: variante.miniatura || variante.imagenes?.[0] || "",
    invalida: false,
    mensajeStock: "",
    estadoStock: "disponible",
  };
}

export function puedeAgregarLinea(lineas, nuevaLinea) {
  if (!nuevaLinea || nuevaLinea.stockDisponible < 1) return false;
  return cantidadEnGrupo(lineas, nuevaLinea.inventoryGroupId) + nuevaLinea.cantidad <= nuevaLinea.stockDisponible;
}

export function agregarLinea(lineas, nuevaLinea) {
  if (!puedeAgregarLinea(lineas, nuevaLinea)) return lineas;
  const clave = crearClaveLinea(nuevaLinea);
  const existente = lineas.findIndex((linea) => crearClaveLinea(linea) === clave);
  if (existente === -1) return [...lineas, nuevaLinea];
  return lineas.map((linea, indice) => indice === existente
    ? { ...linea, cantidad: linea.cantidad + nuevaLinea.cantidad }
    : linea);
}

export function cambiarCantidad(lineas, clave, cambio) {
  const objetivo = lineas.find((linea) => crearClaveLinea(linea) === clave);
  if (!objetivo || !Number.isInteger(cambio)) return lineas;
  if (cambio > 0 && (objetivo.estadoStock === "no verificable" || objetivo.estadoStock === "agotado" ||
    cantidadEnGrupo(lineas, objetivo.inventoryGroupId) + cambio > objetivo.stockDisponible)) return lineas;
  return lineas.map((linea) => crearClaveLinea(linea) === clave
    ? { ...linea, cantidad: Math.max(1, linea.cantidad + cambio) }
    : linea);
}

export const eliminarLinea = (lineas, clave) => lineas.filter((linea) => crearClaveLinea(linea) !== clave);

export function aplicarRevalidacion(lineas, resultados) {
  const porLinea = new Map(resultados.map((resultado) => [
    `${resultado.productoId}\u0000${resultado.varianteKey}\u0000${resultado.selectedSize}`, resultado,
  ]));
  const consumido = new Map();
  return lineas.map((linea) => {
    const resultado = porLinea.get(`${linea.productoId}\u0000${linea.varianteKey}\u0000${linea.selectedSize}`);
    if (!resultado?.vigente || !resultado.inventoryGroupId) return {
      ...linea, estadoStock: "no verificable", invalida: true, stockDisponible: 0,
      mensajeStock: "No pudimos verificar la disponibilidad de esta talla.",
    };
    const base = { ...linea, varianteId: resultado.varianteId,
      inventoryGroupId: resultado.inventoryGroupId, stockDisponible: resultado.stockDisponible };
    if (resultado.stockDisponible === 0) return { ...base, estadoStock: "agotado", invalida: true,
      mensajeStock: "Este producto se agotó." };
    const usado = consumido.get(resultado.inventoryGroupId) ?? 0;
    const disponible = Math.max(0, resultado.stockDisponible - usado);
    if (disponible === 0) return { ...base, estadoStock: "agotado", invalida: true,
      mensajeStock: "El stock compartido de esta talla se agotó. Puedes eliminarla." };
    const cantidad = Math.min(linea.cantidad, disponible);
    consumido.set(resultado.inventoryGroupId, usado + cantidad);
    return cantidad < linea.cantidad
      ? { ...base, cantidad, estadoStock: "stock reducido", invalida: false,
        mensajeStock: `La disponibilidad cambió. Ajustamos tu carrito a ${cantidad}.` }
      : { ...base, estadoStock: linea.estadoStock === "stock reducido" ? "stock reducido" : "disponible",
        invalida: false, mensajeStock: linea.estadoStock === "stock reducido" ? linea.mensajeStock : "" };
  });
}

export const carritoPuedeFinalizar = (lineas, verificado = true) =>
  verificado && lineas.length > 0 && lineas.every((linea) => !linea.invalida &&
    linea.estadoStock !== "agotado" && linea.estadoStock !== "no verificable" &&
    Boolean(linea.inventoryGroupId) && Number.isInteger(linea.cantidad) &&
    linea.cantidad >= 1 && cantidadEnGrupo(lineas, linea.inventoryGroupId) <= linea.stockDisponible);

export function normalizarLineaCarrito(linea, catalogo = []) {
  if (!linea || typeof linea !== "object" || Array.isArray(linea)) return null;
  const productoId = linea.productoId ?? linea.producto?.id ?? "";
  const producto = catalogo.find(({ id }) => id === productoId);
  const variantes = producto?.variantes ?? [];
  const variante = variantes.find(({ id, nombre }) => id === (linea.varianteKey ?? linea.varianteId) ||
    nombre === linea.varianteNombre) ?? (variantes.length === 1 ? variantes[0] : null);
  const selectedSize = linea.selectedSize ?? linea.talla ?? "";
  return {
    ...linea, productoId, nombre: linea.nombre ?? producto?.nombre ?? "Producto por verificar",
    varianteKey: linea.varianteKey ?? variante?.id ?? "",
    varianteId: linea.varianteId ?? "", varianteNombre: linea.varianteNombre ?? variante?.nombre ?? "",
    selectedSize, inventoryGroupId: linea.inventoryGroupId ?? "",
    stockDisponible: 0, cantidad: Number.isInteger(linea.cantidad) && linea.cantidad > 0 ? linea.cantidad : 1,
    precio: linea.precio ?? producto?.precio ?? "0", imagen: linea.imagen ?? variante?.miniatura ?? "",
    estadoStock: "no verificable", invalida: true,
    mensajeStock: "Disponibilidad pendiente de verificación.",
  };
}

export function leerCarritoGuardado(storage, catalogo = []) {
  try {
    const valor = storage?.getItem(CARRITO_STORAGE_KEY);
    if (!valor) return [];
    const lineas = JSON.parse(valor);
    return Array.isArray(lineas) ? lineas.map((linea) => normalizarLineaCarrito(linea, catalogo)).filter(Boolean) : [];
  } catch {
    return [];
  }
}
