const CLAVE_POSICION_LISTA = "gestor:volver-a-producto";

export function guardarPosicionLista(productId, tarjeta, ventana = window) {
  try {
    ventana.sessionStorage.setItem(CLAVE_POSICION_LISTA, JSON.stringify({
      productId,
      scrollY: ventana.scrollY,
      offsetTarjeta: tarjeta.getBoundingClientRect().top,
    }));
  } catch { /* El gestor sigue funcionando si sessionStorage está bloqueado. */ }
}

export function descartarPosicionLista(ventana = window) {
  try { ventana.sessionStorage.removeItem(CLAVE_POSICION_LISTA); }
  catch { /* No impide la navegación. */ }
}

export function restaurarPosicionLista(ventana = window, documento = document) {
  let guardada;
  try {
    guardada = JSON.parse(ventana.sessionStorage.getItem(CLAVE_POSICION_LISTA));
  } catch { /* Se usa la posición actual si no hay un ancla válida. */ }
  descartarPosicionLista(ventana);
  if (!guardada || !Number.isFinite(guardada.scrollY)) return false;

  const tarjeta = [...documento.querySelectorAll("[data-gestor-producto-id]")]
    .find((elemento) => elemento.dataset.gestorProductoId === guardada.productId);
  const destino = tarjeta && Number.isFinite(guardada.offsetTarjeta)
    ? ventana.scrollY + tarjeta.getBoundingClientRect().top - guardada.offsetTarjeta
    : guardada.scrollY;
  ventana.scrollTo({ top: Math.max(0, destino), behavior: "instant" });
  return true;
}
