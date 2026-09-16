import { formatearCOP, subtotalCarrito } from "../cart/carrito.js";

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

export function crearMensajeCarritoWhatsApp(lineas) {
  const mensaje = ["Hola 👋 Quiero finalizar mi compra de Estación Verano:", ""];
  lineas.forEach((linea, indice) => {
    mensaje.push(`${indice + 1}. Producto: ${linea.nombre}`);
    if (linea.varianteNombre) mensaje.push(`Color: ${linea.varianteNombre}`);
    if (linea.selectedSize) mensaje.push(`Talla: ${linea.selectedSize}`);
    mensaje.push(`Cantidad: ${linea.cantidad}`, "");
  });
  mensaje.push(`Total: ${formatearCOP(subtotalCarrito(lineas))}`, "",
    "Revisemos la disponibilidad final y los datos del pedido antes de confirmarlo. 🌴");
  return mensaje.join("\n");
}
