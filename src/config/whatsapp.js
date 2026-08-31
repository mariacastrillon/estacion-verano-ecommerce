export const WHATSAPP_NUMBER = "573159048807";

export function crearUrlWhatsApp(mensaje = "") {
  const url = new URL(`https://wa.me/${WHATSAPP_NUMBER}`);

  if (mensaje) {
    url.searchParams.set("text", mensaje);
  }

  return url.toString();
}
