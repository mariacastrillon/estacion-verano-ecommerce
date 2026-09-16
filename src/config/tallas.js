export const TALLAS_VERANO = Object.freeze(["XS", "S", "M", "L", "XL", "XXL", "ÚNICA"]);

export function normalizarTallaVerano(talla) {
  return typeof talla === "string" && talla.toLocaleLowerCase("es") === "unica"
    ? "ÚNICA"
    : talla;
}
