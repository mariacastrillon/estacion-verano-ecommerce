export const WHATSAPP_NUMBER = "573159048807";

export function crearUrlWhatsApp(mensaje = "") {
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/${WHATSAPP_NUMBER}${texto}`;
}

export function crearUrlInternaAbsoluta(ruta, origin, prefijoPermitido) {
  if (typeof ruta !== "string" || !ruta.startsWith(prefijoPermitido)) return "";

  try {
    const base = new URL(origin);
    if (base.protocol !== "https:" && base.protocol !== "http:") return "";

    const url = new URL(ruta, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(prefijoPermitido)) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function mostrarColor(variante, producto, cantidadVariantes) {
  const nombre = variante?.nombre?.trim();
  if (!nombre) return false;
  if (cantidadVariantes > 1) return true;

  const nombreNormalizado = nombre.toLocaleLowerCase("es");
  return (
    !/^(color\s+principal|principal|predeterminado)$/.test(nombreNormalizado) &&
    nombreNormalizado !== producto.nombre?.trim().toLocaleLowerCase("es")
  );
}

export function crearMensajeProductoWhatsApp({
  producto,
  variante,
  cantidadVariantes,
  talla,
  origin,
}) {
  const lineas = [
    "Hola 👋 Quiero consultar disponibilidad de:",
    "",
    `Producto: ${producto.nombre}`,
  ];

  if (mostrarColor(variante, producto, cantidadVariantes)) {
    lineas.push(`Color: ${variante.nombre.trim()}`);
  }

  if (talla) lineas.push(`Talla: ${talla}`);
  lineas.push(`Precio: $${producto.precio}`, "");

  const rutaImagen = variante?.miniatura || variante?.imagenes?.[0] || "";
  const urlImagen = crearUrlInternaAbsoluta(
    rutaImagen,
    origin,
    "/productos/"
  );
  if (urlImagen) lineas.push(`Foto: ${urlImagen}`);

  const rutaProducto = `/producto/${encodeURIComponent(producto.id)}`;
  const urlProducto = crearUrlInternaAbsoluta(
    rutaProducto,
    origin,
    "/producto/"
  );
  if (urlProducto) lineas.push(`Producto: ${urlProducto}`);

  lineas.push("", "¿Está disponible? 🌴");
  return lineas.join("\n");
}
