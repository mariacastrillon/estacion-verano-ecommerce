import { useEffect, useState } from "react";
import { gestorApi } from "../../services/gestorApi.js";
import { alternarCompatibilidadUnidad, alternarTallaDeGrupo, fusionarGrupoEnPrimero, prepararGrupoFisico, prepararInventarioFisico, stockDerivado } from "./inventario-fisico-ui.js";

const unidadNueva = () => ({
  id: null, uiId: crypto.randomUUID(), physicalSize: null,
  displaySizes: [], status: "pending", active: false,
});

const firma = (variante) => JSON.stringify(variante.groups.map((grupo) => ({
  id: grupo.id,
  displaySizes: [...grupo.displaySizes].sort(),
  units: grupo.units.filter(({ id }) => id).map((unidad) => ({
    id: unidad.id, physicalSize: unidad.physicalSize,
    displaySizes: [...unidad.displaySizes].sort(),
  })),
})));

export default function EditorInventarioFisico({ productId }) {
  const [inventario, setInventario] = useState(null);
  const [originales, setOriginales] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    gestorApi.leerInventario(productId).then(
      (respuesta) => {
        if (!vigente) return;
        const preparada = prepararInventarioFisico(respuesta);
        setInventario(preparada);
        setOriginales(structuredClone(preparada));
        setCargando(false);
      },
      (err) => {
        if (!vigente) return;
        setError(err.message);
        setCargando(false);
      }
    );
    return () => { vigente = false; };
  }, [productId]);

  const cambiarVariante = (variantId, transformar) => {
    setInventario((actual) => ({
      ...actual,
      variants: actual.variants.map((variante) => variante.id === variantId ? transformar(variante) : variante),
    }));
    setMensaje("");
    setError("");
  };

  const cambiarGrupo = (variantId, groupUiId, transformar) => cambiarVariante(variantId, (variante) => ({
    ...variante,
    groups: variante.groups.map((grupo) => grupo.uiId === groupUiId ? transformar(grupo) : grupo),
  }));

  const agregarGrupo = (variantId) => cambiarVariante(variantId, (variante) => ({
    ...variante,
    groups: [...variante.groups, prepararGrupoFisico({ id: null, display_sizes: [], units: [], stock: 0 })],
  }));

  const agregarUnidad = (variantId, groupUiId) => cambiarGrupo(variantId, groupUiId, (grupo) => ({
    ...grupo, units: [...grupo.units, unidadNueva()],
  }));

  const fusionarGrupo = (variantId, grupo) => {
    if (grupo.id && !window.confirm("¿Fusionar este grupo en el primero? Las prendas y tallas conservarán sus valores; el grupo anterior quedará inactivo al guardar.")) return;
    cambiarVariante(variantId, (variante) => ({
      ...variante, groups: fusionarGrupoEnPrimero(variante.groups, grupo.uiId),
    }));
  };

  const eliminarUnidad = (variantId, groupUiId, unidad) => {
    if (unidad.id && !window.confirm(`¿Retirar la unidad física ${unidad.physicalSize || "pendiente"}? El stock disponible bajará en una unidad.`)) return;
    cambiarGrupo(variantId, groupUiId, (grupo) => ({
      ...grupo, units: grupo.units.filter(({ uiId }) => uiId !== unidad.uiId),
    }));
  };

  const guardar = async (variante) => {
    if (variante.groups.some((grupo) => !grupo.displaySizes.length || grupo.units.some((unidad) =>
      !unidad.physicalSize || !unidad.displaySizes.length || unidad.displaySizes.some((talla) => !grupo.displaySizes.includes(talla))
    ))) {
      setError("Cada grupo necesita tallas visibles; cada unidad necesita talla física y al menos una talla compatible de su grupo.");
      return;
    }
    const original = originales.variants.find(({ id }) => id === variante.id);
    const cambiaExistente = firma(variante) !== firma(original);
    const confirmar = cambiaExistente
      ? window.confirm("Esta acción reconfigura o retira unidades existentes. Las tallas y unidades indicadas son una decisión explícita. ¿Confirmas?")
      : false;
    if (cambiaExistente && !confirmar) return;
    const grupos = variante.groups.map((grupo) => ({
      id: grupo.id,
      display_sizes: grupo.displaySizes,
      units: grupo.units.map((unidad) => ({
        id: unidad.id,
        physical_size: unidad.physicalSize,
        display_sizes: unidad.displaySizes,
      })),
    }));
    setGuardando(variante.id);
    setError("");
    setMensaje("");
    try {
      const respuesta = await gestorApi.guardarGruposInventario(variante.id, grupos, confirmar);
      const actualizada = { ...variante, groups: respuesta.groups.map(prepararGrupoFisico) };
      cambiarVariante(variante.id, () => actualizada);
      setOriginales((actual) => ({
        ...actual,
        variants: actual.variants.map((item) => item.id === variante.id ? structuredClone(actualizada) : item),
      }));
      setMensaje(`Inventario de ${variante.name} guardado correctamente.`);
    } catch (err) {
      setError(`${err.message} Los valores editados se conservaron.`);
    } finally {
      setGuardando("");
    }
  };

  return <section className="rounded-2xl border border-[#DCCDA4]/50 bg-[#102A2A] p-6">
    <h2 className="text-lg font-medium tracking-wide text-[#DCCDA4]">INVENTARIO</h2>
    <p className="mt-1 text-sm text-slate-400">El stock se deriva de prendas físicas confirmadas. Una talla visible puede ser compatible con varias prendas del mismo grupo.</p>
    {cargando && <p className="mt-4 text-sm text-slate-400">Cargando inventario desde Supabase…</p>}
    {inventario && <div className="mt-5 space-y-6">{inventario.variants.map((variante) => (
      <div key={variante.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-medium uppercase">{variante.name}</h3>
          <button type="button" onClick={() => agregarGrupo(variante.id)} className="rounded-full border border-slate-600 px-4 py-1.5 text-sm">+ Añadir otro grupo lógico</button>
        </div>
        <div className="space-y-5">{variante.groups.map((grupo, groupIndex) => (
          <div key={grupo.uiId} className="rounded-xl border border-slate-600 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h4 className="font-medium text-[#DCCDA4]">{variante.groups.length === 1 ? "Unidades físicas" : `Grupo lógico ${groupIndex + 1}`}</h4>
              <div className="flex flex-wrap items-center gap-3">
                <strong className="text-sm text-emerald-300">Stock físico: {stockDerivado(grupo)}</strong>
                {groupIndex > 0 && <button type="button" onClick={() => fusionarGrupo(variante.id, grupo)} className="text-sm text-amber-200 underline">Fusionar en primer grupo</button>}
              </div>
            </div>
            {grupo.historicalStock > stockDerivado(grupo) && <p className="mb-4 text-xs text-amber-200">Registro histórico: {grupo.historicalStock} unidad(es). Confirma las prendas pendientes; ese número no es stock disponible.</p>}
            <fieldset className="mb-5"><legend className="mb-2 text-sm text-slate-300">Tallas visibles para la clienta</legend>
              <div className="flex flex-wrap gap-2">{variante.allowedSizes.map((talla) => (
                <button key={talla} type="button" onClick={() => cambiarVariante(variante.id, (actual) => ({
                  ...actual, groups: alternarTallaDeGrupo(actual.groups, grupo.uiId, talla),
                }))} className={`rounded-full border px-3 py-1.5 text-sm ${grupo.displaySizes.includes(talla) ? "border-[#DCCDA4] bg-[#DCCDA4] text-slate-950" : "border-slate-600 text-slate-300"}`}>{talla}</button>
              ))}</div>
            </fieldset>
            <div className="space-y-3">{grupo.units.map((unidad, indice) => (
              <div key={unidad.uiId} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                <div className="mb-3 flex justify-between gap-3"><p className="font-medium">Unidad física {indice + 1}{unidad.status === "pending" && !unidad.physicalSize ? " · pendiente de confirmar" : ""}</p><button type="button" onClick={() => eliminarUnidad(variante.id, grupo.uiId, unidad)} className="text-sm text-red-300">Retirar unidad</button></div>
                <fieldset><legend className="mb-2 text-sm text-slate-300">Talla física real</legend><div className="flex flex-wrap gap-2">{variante.allowedSizes.map((talla) => (
                  <button key={talla} type="button" onClick={() => cambiarGrupo(variante.id, grupo.uiId, (actual) => ({
                    ...actual, units: actual.units.map((item) => item.uiId === unidad.uiId ? { ...item, physicalSize: talla } : item),
                  }))} className={`rounded-full border px-3 py-1.5 text-sm ${unidad.physicalSize === talla ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-slate-600 text-slate-300"}`}>{talla}</button>
                ))}</div></fieldset>
                <fieldset className="mt-4"><legend className="mb-2 text-sm text-slate-300">Tallas visibles compatibles con esta unidad</legend><div className="flex flex-wrap gap-2">{grupo.displaySizes.map((talla) => (
                  <button key={talla} type="button" onClick={() => cambiarVariante(variante.id, (actual) => ({
                    ...actual, groups: alternarCompatibilidadUnidad(actual.groups, grupo.uiId, unidad.uiId, talla),
                  }))} className={`rounded-full border px-3 py-1.5 text-sm ${unidad.displaySizes.includes(talla) ? "border-[#DCCDA4] bg-[#DCCDA4] text-slate-950" : "border-slate-600 text-slate-300"}`}>{talla}</button>
                ))}</div></fieldset>
              </div>
            ))}</div>
            <button type="button" onClick={() => agregarUnidad(variante.id, grupo.uiId)} className="mt-4 rounded-full border border-[#DCCDA4] px-4 py-2 text-sm text-[#DCCDA4]">+ Añadir unidad física</button>
          </div>
        ))}</div>
        <button type="button" disabled={guardando === variante.id || variante.groups.length === 0} onClick={() => guardar(variante)} className="mt-5 rounded-full bg-[#DCCDA4] px-5 py-2 font-medium text-slate-950 disabled:opacity-50">{guardando === variante.id ? "Guardando…" : `Guardar inventario de ${variante.name}`}</button>
      </div>
    ))}</div>}
    {mensaje && <p role="status" className="mt-4 rounded-lg border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-200">{mensaje}</p>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
  </section>;
}
