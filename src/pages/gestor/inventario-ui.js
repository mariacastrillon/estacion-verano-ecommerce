import { normalizarTallaVerano, TALLAS_VERANO } from "../../config/tallas.js";

const unicas = (valores) => [...new Set(valores.map(normalizarTallaVerano))];

export function prepararInventarioParaEdicion(respuesta) {
  return {
    ...respuesta,
    variants: respuesta.variants.map((variante) => {
      const units = variante.units.map((unidad) => ({
        ...unidad,
        uiId: unidad.id,
        physicalSize: unidad.physical_size ?? null,
        displaySizes: unicas(unidad.display_sizes),
        legacySizes: unicas(unidad.legacy_sizes ?? []),
        stock: String(unidad.stock),
      }));
      if (variante.active !== false && units.length === 0) {
        return {
          ...variante,
          allowedSizes: TALLAS_VERANO,
          requiresInitialMerge: false,
          units: [{
            id: null,
            uiId: `unidad-pendiente-${variante.id}`,
            physicalSize: null,
            displaySizes: [],
            legacySizes: [],
            stock: "0",
            active: true,
          }],
        };
      }
      const sonLegadasSinConfirmar = units.length > 0
        && units.every(({ legacy_inventory_id: legacyId }) => Boolean(legacyId))
        && units.every(({ physicalSize }) => physicalSize === null || physicalSize === "ÚNICA");
      if (sonLegadasSinConfirmar) {
        const displaySizes = unicas(units.flatMap(({ displaySizes: sizes }) => sizes));
        const legacySizes = unicas(units.flatMap(({ legacySizes: sizes }) => sizes));
        const soloUnica = displaySizes.length === 1 && displaySizes[0] === "ÚNICA";
        return {
          ...variante,
          allowedSizes: TALLAS_VERANO,
          requiresInitialMerge: units.length > 1,
          units: [{
            ...units[0],
            physicalSize: soloUnica ? "ÚNICA" : null,
            displaySizes,
            legacySizes,
            stock: String(units.reduce((total, unidad) => total + Number(unidad.stock), 0)),
          }],
        };
      }
      return { ...variante, allowedSizes: TALLAS_VERANO, requiresInitialMerge: false, units };
    }),
  };
}

export function moverTallaVisible(unidades, unitUiId, talla) {
  const estabaSeleccionada = unidades.some(
    ({ uiId, displaySizes }) => uiId === unitUiId && displaySizes.includes(talla)
  );
  return unidades.map((unidad) => ({
    ...unidad,
    displaySizes: unidad.uiId === unitUiId
      ? (estabaSeleccionada ? unidad.displaySizes.filter((item) => item !== talla) : [...unidad.displaySizes, talla])
      : unidad.displaySizes.filter((item) => item !== talla),
  }));
}
