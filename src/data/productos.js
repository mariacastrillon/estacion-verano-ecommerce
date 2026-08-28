import catalogo from "./catalogo.json";

const crearVariantePredeterminada = (producto) => ({
  id: producto.id,
  nombre: producto.nombre,
  codigo: "",
  miniatura: producto.imagenes?.[0] ?? "",
  imagenes: producto.imagenes ?? [],
  tallas: producto.tallas ?? [],
});

const productosConVariantes = catalogo.map((producto) => ({
  ...producto,
  variantes:
    Array.isArray(producto.variantes) && producto.variantes.length > 0
      ? producto.variantes
      : [crearVariantePredeterminada(producto)],
}));

export const obtenerVariantes = (producto) =>
  (producto.variantes ?? []).filter((variante) => variante.activo !== false);

export const obtenerTallas = (producto) => [
  ...new Set(
    obtenerVariantes(producto).flatMap((variante) => variante.tallas ?? [])
  ),
];

export default productosConVariantes;
