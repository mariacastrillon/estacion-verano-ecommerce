export const CARRITO_STORAGE_KEY = "verano_carrito";

export const crearClaveLinea = ({ productoId, varianteId, talla = "" }) =>
  `${productoId}::${varianteId}::${talla}`;

export function precioACentavos(precio) {
  if (typeof precio === "number") {
    return Number.isFinite(precio) ? Math.max(0, Math.round(precio * 100)) : 0;
  }
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

export function crearLineaCarrito({ producto, variante, talla = "" }) {
  if (!producto?.id || !producto?.nombre || !variante?.id) return null;
  if ((variante.tallas?.length ?? 0) > 0 && !talla) return null;
  return {
    productoId: producto.id,
    nombre: producto.nombre,
    varianteId: variante.id,
    varianteNombre: variante.nombre ?? "",
    talla,
    precio: producto.precio,
    cantidad: 1,
    imagen: variante.miniatura || variante.imagenes?.[0] || "",
  };
}

export function agregarLinea(lineas, nuevaLinea) {
  if (!nuevaLinea) return lineas;
  const clave = crearClaveLinea(nuevaLinea);
  const existente = lineas.findIndex((linea) => crearClaveLinea(linea) === clave);
  if (existente === -1) return [...lineas, nuevaLinea];
  return lineas;
}

export function cambiarCantidad(lineas, clave, cambio) {
  return lineas.map((linea) => crearClaveLinea(linea) === clave
    ? { ...linea, cantidad: Math.min(1, Math.max(1, linea.cantidad + cambio)) }
    : linea);
}

export const eliminarLinea = (lineas, clave) => lineas.filter((linea) => crearClaveLinea(linea) !== clave);

const esLineaValida = (linea) => linea &&
  typeof linea.productoId === "string" && typeof linea.nombre === "string" &&
  typeof linea.varianteId === "string" && typeof linea.precio === "string" &&
  Number.isInteger(linea.cantidad) && linea.cantidad >= 1;

export function leerCarritoGuardado(storage) {
  try {
    const valor = storage?.getItem(CARRITO_STORAGE_KEY);
    if (!valor) return [];
    const lineas = JSON.parse(valor);
    if (!Array.isArray(lineas) || !lineas.every(esLineaValida)) throw new Error("Carrito invalido");
    return lineas.map((linea) => ({ ...linea, cantidad: 1 }));
  } catch {
    try { storage?.removeItem(CARRITO_STORAGE_KEY); } catch { /* El almacenamiento puede estar bloqueado. */ }
    return [];
  }
}
