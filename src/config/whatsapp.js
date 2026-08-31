export const WHATSAPP_NUMBER = "573159048807";

export function crearUrlWhatsApp(mensaje = "") {
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/${WHATSAPP_NUMBER}${texto}`;
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
  lineas.push(`Precio: $${producto.precio}`, "", "¿Está disponible? 🌴");
  return lineas.join("\n");
}
