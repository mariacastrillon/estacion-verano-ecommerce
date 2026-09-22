async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(`/api/gestor${ruta}`, {
    ...opciones,
    headers: opciones.body ? { "Content-Type": "application/json" } : undefined,
  });
  const contenido = await respuesta.json();
  if (!respuesta.ok) throw new Error(contenido.error || "No se pudo completar la operación.");
  return contenido;
}

export const gestorApi = {
  listar: () => solicitar("/catalogo"),
  eliminarProducto: (id) => solicitar(`/productos/${encodeURIComponent(id)}`, {
    method: "DELETE", body: JSON.stringify({ confirmar: id }),
  }),
  crear: (producto, imagenesNuevas = []) =>
    solicitar("/productos", { method: "POST", body: JSON.stringify({ producto, imagenesNuevas }) }),
  guardar: (producto, imagenesNuevas = []) =>
    solicitar(`/productos/${encodeURIComponent(producto.id)}`, {
      method: "PUT",
      body: JSON.stringify({ producto, imagenesNuevas }),
    }),
  cambiarProducto: (id, activo) =>
    solicitar(`/productos/${encodeURIComponent(id)}/activo`, {
      method: "PATCH",
      body: JSON.stringify({ activo }),
    }),
  cambiarVariante: (idProducto, idVariante, activo) =>
    solicitar(
      `/productos/${encodeURIComponent(idProducto)}/variantes/${encodeURIComponent(idVariante)}/activo`,
      { method: "PATCH", body: JSON.stringify({ activo }) }
    ),
  leerInventario: (idProducto) =>
    solicitar(`/inventario/${encodeURIComponent(idProducto)}`),
  guardarGruposInventario: (variantId, groups, confirmarReconfiguracion = false) =>
    solicitar("/inventario/grupos", {
      method: "PUT",
      body: JSON.stringify({
        variant_id: variantId,
        groups,
        confirmar_reconfiguracion: confirmarReconfiguracion,
      }),
    }),
};
