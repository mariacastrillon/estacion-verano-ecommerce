import { TALLAS_VERANO } from "../../config/tallas.js";

const unicas = (valores = []) => [...new Set(valores)];

export function prepararGrupoFisico(grupo) {
  return {
    ...grupo,
    uiId: grupo.id ?? crypto.randomUUID(),
    displaySizes: unicas(grupo.display_sizes),
    historicalStock: grupo.legacy_stock ?? grupo.stock ?? 0,
    units: grupo.units.map((unidad) => ({
      ...unidad,
      uiId: unidad.id ?? crypto.randomUUID(),
      physicalSize: unidad.physical_size ?? null,
      displaySizes: unicas(unidad.display_sizes),
    })),
  };
}

export function prepararInventarioFisico(respuesta) {
  return {
    ...respuesta,
    variants: respuesta.variants.map((variante) => ({
      ...variante,
      allowedSizes: TALLAS_VERANO,
      groups: variante.groups.length
        ? variante.groups.map(prepararGrupoFisico)
        : variante.active === false ? [] : [prepararGrupoFisico({ id: null, display_sizes: [], units: [], stock: 0 })],
    })),
  };
}

export function stockDerivado(grupo) {
  return grupo.units.filter((unidad) =>
    unidad.physicalSize && unidad.displaySizes.length > 0 && unidad.status !== "reserved" && unidad.status !== "sold" && unidad.status !== "retired"
  ).length;
}

export function alternarTallaDeGrupo(grupos, groupUiId, talla) {
  const grupoActual = grupos.find(({ uiId }) => uiId === groupUiId);
  const estaba = grupoActual?.displaySizes.includes(talla);
  return grupos.map((grupo) => ({
    ...grupo,
    displaySizes: grupo.uiId === groupUiId
      ? estaba ? grupo.displaySizes.filter((actual) => actual !== talla) : [...grupo.displaySizes, talla]
      : grupo.displaySizes.filter((actual) => actual !== talla),
    units: grupo.units.map((unidad) => ({
      ...unidad,
      displaySizes: grupo.uiId === groupUiId && !estaba
        ? unidad.displaySizes
        : unidad.displaySizes.filter((actual) => actual !== talla),
    })),
  }));
}

export function alternarCompatibilidadUnidad(grupos, groupUiId, unitUiId, talla) {
  return grupos.map((grupo) => grupo.uiId !== groupUiId ? grupo : ({
    ...grupo,
    units: grupo.units.map((unidad) => unidad.uiId !== unitUiId ? unidad : ({
      ...unidad,
      displaySizes: unidad.displaySizes.includes(talla)
        ? unidad.displaySizes.filter((actual) => actual !== talla)
        : grupo.displaySizes.includes(talla) ? [...unidad.displaySizes, talla] : unidad.displaySizes,
    })),
  }));
}

export function fusionarGrupoEnPrimero(grupos, sourceUiId) {
  const destino = grupos[0];
  const origen = grupos.find(({ uiId }) => uiId === sourceUiId);
  if (!destino || !origen || destino.uiId === sourceUiId) return grupos;
  return grupos.filter(({ uiId }) => uiId !== sourceUiId).map((grupo) => grupo.uiId === destino.uiId
    ? {
      ...grupo,
      displaySizes: unicas([...grupo.displaySizes, ...origen.displaySizes]),
      units: [...grupo.units, ...origen.units],
    }
    : grupo);
}
