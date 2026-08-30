import { useEffect, useMemo, useState } from "react";
import { gestorApi } from "../../services/gestorApi";

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

const slug = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const listaDesdeTexto = (texto) => [
  ...new Set(texto.split(",").map((item) => item.trim()).filter(Boolean)),
];

const idVarianteUnico = (nombre, variantes, indiceActual = -1) => {
  const base = slug(nombre) || "color";
  const ocupados = new Set(
    variantes
      .filter((_, indice) => indice !== indiceActual)
      .map(({ id }) => id)
  );
  if (!ocupados.has(base)) return base;
  let consecutivo = 2;
  while (ocupados.has(`${base}-${consecutivo}`)) consecutivo += 1;
  return `${base}-${consecutivo}`;
};

const nuevaVariante = (variantes = []) => ({
  uiId: crypto.randomUUID(),
  esNueva: true,
  id: idVarianteUnico("Color principal", variantes),
  activo: false,
  nombre: "Color principal",
  codigo: "#111111",
  miniatura: "",
  imagenes: [],
  tallas: [],
});

const imagenExistente = (ruta, indice) => ({
  id: `existente-${indice}-${ruta}`,
  tipo: "existente",
  ruta,
  preview: ruta,
});

const prepararParaEdicion = (producto) => ({
  ...structuredClone(producto),
  variantes: producto.variantes.map((variante) => ({
    ...variante,
    uiId: variante.uiId ?? crypto.randomUUID(),
    esNueva: variante.esNueva ?? false,
    imagenes: variante.imagenes.map(imagenExistente),
  })),
});

function archivoABase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(",")[1]);
    lector.onerror = () => reject(new Error(`No se pudo leer ${archivo.name}.`));
    lector.readAsDataURL(archivo);
  });
}

const nuevoProducto = () => ({
  id: "",
  activo: false,
  favorito: false,
  categoria: "trajes",
  nombre: "",
  precio: "",
  palabrasClave: [],
  etiquetas: [],
  descripcion: "",
  variantes: [nuevaVariante()],
});

function SelectorTallas({ valor, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TALLAS.map((talla) => (
        <button
          key={talla}
          type="button"
          onClick={() => onChange(valor.includes(talla) ? valor.filter((item) => item !== talla) : [...valor, talla])}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            valor.includes(talla)
              ? "border-[#DCCDA4] bg-[#DCCDA4] text-slate-950"
              : "border-slate-600 text-slate-300"
          }`}
        >
          {talla}
        </button>
      ))}
    </div>
  );
}

function EditorVariante({ variante, indice, total, onChange, onCambiarNombre, onMover, onAgregar }) {
  const [arrastrando, setArrastrando] = useState(false);
  const [errorImagen, setErrorImagen] = useState("");
  const cambiar = (campo, valor) => onChange({ ...variante, [campo]: valor });
  const moverImagen = (origen, direccion) => {
    const destino = origen + direccion;
    if (destino < 0 || destino >= variante.imagenes.length) return;
    const imagenes = [...variante.imagenes];
    [imagenes[origen], imagenes[destino]] = [imagenes[destino], imagenes[origen]];
    cambiar("imagenes", imagenes);
  };

  const agregarArchivos = (lista) => {
    const archivos = [...lista];
    const invalidos = archivos.filter((archivo) =>
      !["image/jpeg", "image/png", "image/webp"].includes(archivo.type) || archivo.size > 25 * 1024 * 1024
    );
    if (invalidos.length) {
      setErrorImagen("Solo se permiten JPG, PNG o WebP de máximo 25 MB por archivo.");
      return;
    }
    setErrorImagen("");
    cambiar("imagenes", [
      ...variante.imagenes,
      ...archivos.map((archivo) => ({
        id: crypto.randomUUID(),
        tipo: "nueva",
        archivo,
        preview: URL.createObjectURL(archivo),
      })),
    ]);
  };

  const quitarImagen = (imagen) => {
    if (imagen.tipo === "nueva") URL.revokeObjectURL(imagen.preview);
    cambiar("imagenes", variante.imagenes.filter(({ id }) => id !== imagen.id));
  };

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-lg text-[#DCCDA4]">Color {indice + 1}</h3>
        <div className="flex gap-2">
          <button type="button" disabled={indice === 0} onClick={() => onMover(-1)} className="rounded-lg border border-slate-600 px-3 py-1 disabled:opacity-30">↑</button>
          <button type="button" disabled={indice === total - 1} onClick={() => onMover(1)} className="rounded-lg border border-slate-600 px-3 py-1 disabled:opacity-30">↓</button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-300">Nombre del color
          <input value={variante.nombre} onChange={(e) => onCambiarNombre(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <label className="text-sm text-slate-300">Color
          <div className="mt-1 flex gap-3">
            <input type="color" value={variante.codigo || "#111111"} onChange={(e) => cambiar("codigo", e.target.value.toUpperCase())} className="h-12 w-16 rounded-lg bg-transparent" />
            <input value={variante.codigo} onChange={(e) => cambiar("codigo", e.target.value.toUpperCase())} placeholder="#111111" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
          </div>
        </label>
        <label className="text-sm text-slate-300">ID del color
          <input readOnly value={variante.id} className="mt-1 w-full cursor-default rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-400" />
        </label>
        <label className="flex items-center gap-3 pt-7 text-sm text-slate-300">
          <input type="checkbox" checked={variante.activo !== false} onChange={(e) => cambiar("activo", e.target.checked)} /> Variante activa
        </label>
      </div>
      <div className="mt-5">
        <p className="mb-2 text-sm text-slate-300">Tallas de esta variante</p>
        <SelectorTallas valor={variante.tallas} onChange={(tallas) => cambiar("tallas", tallas)} />
      </div>
      <div className="mt-5">
        <p className="mb-2 text-sm font-medium tracking-wide text-slate-200">IMÁGENES</p>
        <label
          onDragEnter={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregarArchivos(e.dataTransfer.files); }}
          className={`mb-4 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed p-6 text-center transition ${arrastrando ? "border-[#DCCDA4] bg-[#DCCDA4]/10" : "border-slate-600 hover:border-[#DCCDA4]"}`}
        >
          <span className="text-base text-white">Arrastra tus fotos aquí</span>
          <span className="my-1 text-sm text-slate-500">o</span>
          <span className="rounded-full bg-[#DCCDA4] px-5 py-2 text-sm font-medium text-slate-950">Seleccionar imágenes</span>
          <span className="mt-3 text-xs text-slate-500">JPG, PNG o WebP · máximo 25 MB cada una</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(e) => { agregarArchivos(e.target.files); e.target.value = ""; }} />
        </label>
        {errorImagen && <p className="mb-3 text-sm text-red-300">{errorImagen}</p>}
        {variante.imagenes.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {variante.imagenes.map((imagen, imagenIndice) => (
              <div key={imagen.id} className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                <img src={imagen.preview} alt={`Imagen ${imagenIndice + 1}`} className="h-48 w-full object-cover" />
                {imagenIndice === 0 && <span className="absolute left-2 top-2 rounded-full bg-[#DCCDA4] px-3 py-1 text-xs font-semibold text-slate-950">Principal</span>}
                {imagen.tipo === "nueva" && <span className="absolute right-2 top-2 rounded-full bg-emerald-700 px-2 py-1 text-xs">Nueva</span>}
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="text-xs text-slate-400">Posición {imagenIndice + 1}</span>
                  <div className="flex gap-2">
                    <button aria-label="Mover imagen a la izquierda" className="rounded-lg border border-slate-600 px-2 py-1 disabled:opacity-30" type="button" onClick={() => moverImagen(imagenIndice, -1)} disabled={imagenIndice === 0}>←</button>
                    <button aria-label="Mover imagen a la derecha" className="rounded-lg border border-slate-600 px-2 py-1 disabled:opacity-30" type="button" onClick={() => moverImagen(imagenIndice, 1)} disabled={imagenIndice === variante.imagenes.length - 1}>→</button>
                    <button aria-label="Quitar imagen del formulario" className="rounded-lg border border-red-800 px-2 py-1 text-red-300" type="button" onClick={() => quitarImagen(imagen)}>×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">Sin imágenes. Mantén la variante inactiva hasta añadir al menos una.</p>}
      </div>
      {indice === total - 1 && (
        <button type="button" onClick={onAgregar} className="mt-5 rounded-full border border-[#DCCDA4] px-5 py-2 text-sm text-[#DCCDA4]">+ Agregar otro color</button>
      )}
    </section>
  );
}

function FormularioProducto({ inicial, esNuevo, onCancelar, onGuardado }) {
  const [producto, setProducto] = useState(() => prepararParaEdicion(inicial));
  const [palabrasClaveTexto, setPalabrasClaveTexto] = useState(() =>
    (inicial.palabrasClave ?? []).join(", ")
  );
  const [etiquetasTexto, setEtiquetasTexto] = useState(() =>
    (inicial.etiquetas ?? []).join(", ")
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (campo, valor) => setProducto((actual) => ({ ...actual, [campo]: valor }));
  const cambiarVariante = (indice, variante) => setProducto((actual) => ({
    ...actual,
    variantes: actual.variantes.map((item, itemIndice) => itemIndice === indice ? variante : item),
  }));
  const cambiarNombreVariante = (indice, nombre) => setProducto((actual) => ({
    ...actual,
    variantes: actual.variantes.map((variante, varianteIndice) => {
      if (varianteIndice !== indice) return variante;
      return {
        ...variante,
        nombre,
        id: variante.esNueva
          ? idVarianteUnico(nombre, actual.variantes, indice)
          : variante.id,
      };
    }),
  }));
  const moverVariante = (indice, direccion) => setProducto((actual) => {
    const variantes = [...actual.variantes];
    [variantes[indice], variantes[indice + direccion]] = [variantes[indice + direccion], variantes[indice]];
    return { ...actual, variantes };
  });

  const guardar = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const imagenesNuevas = [];
      const preparado = {
        ...producto,
        id: esNuevo ? slug(producto.id || producto.nombre) : producto.id,
        palabrasClave: listaDesdeTexto(palabrasClaveTexto),
        etiquetas: listaDesdeTexto(etiquetasTexto),
        variantes: await Promise.all(producto.variantes.map(async (variante) => {
          const imagenes = [];
          for (const imagen of variante.imagenes) {
            if (imagen.tipo === "existente") {
              imagenes.push(imagen.ruta);
            } else {
              imagenes.push(`upload:${imagen.id}`);
              imagenesNuevas.push({ token: imagen.id, nombre: imagen.archivo.name, tipo: imagen.archivo.type, contenido: await archivoABase64(imagen.archivo) });
            }
          }
          const varianteCatalogo = Object.fromEntries(
            Object.entries(variante).filter(
              ([campo]) => !["uiId", "esNueva"].includes(campo)
            )
          );
          return {
            ...varianteCatalogo,
            id: variante.id,
            imagenes,
            miniatura: imagenes[0] ?? "",
          };
        })),
      };
      if (esNuevo) await gestorApi.crear(preparado, imagenesNuevas);
      else await gestorApi.guardar(preparado, imagenesNuevas);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm uppercase tracking-widest text-[#DCCDA4]">{esNuevo ? "Nuevo producto" : "Editar producto"}</p><h1 className="text-3xl font-light">{producto.nombre || "Producto sin nombre"}</h1></div>
        <button type="button" onClick={onCancelar} className="text-slate-400 hover:text-white">← Volver a la lista</button>
      </div>
      <section className="grid gap-5 rounded-2xl border border-slate-700 bg-[#102A2A] p-6 md:grid-cols-2">
        <label className="text-sm text-slate-300">Nombre
          <input required value={producto.nombre} onChange={(e) => cambiar("nombre", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <label className="text-sm text-slate-300">ID {esNuevo ? "(se genera automáticamente)" : "(no se puede cambiar)"}
          <input required disabled={!esNuevo} value={producto.id || slug(producto.nombre)} onChange={(e) => cambiar("id", slug(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 disabled:opacity-60" />
        </label>
        <label className="text-sm text-slate-300">Precio
          <input required value={producto.precio} onChange={(e) => cambiar("precio", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="60.000" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <label className="text-sm text-slate-300">Categoría
          <select value={producto.categoria} onChange={(e) => cambiar("categoria", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"><option value="trajes">Trajes</option><option value="salidas">Salidas</option><option value="accesorios">Accesorios</option><option value="bolsos">Bolsos</option></select>
        </label>
        <label className="text-sm text-slate-300 md:col-span-2">Descripción
          <textarea value={producto.descripcion ?? ""} onChange={(e) => cambiar("descripcion", e.target.value)} rows="4" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <label className="text-sm text-slate-300">Palabras clave, separadas por coma
          <input value={palabrasClaveTexto} onChange={(e) => setPalabrasClaveTexto(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <label className="text-sm text-slate-300">Etiquetas, separadas por coma
          <input value={etiquetasTexto} onChange={(e) => setEtiquetasTexto(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={producto.activo} onChange={(e) => cambiar("activo", e.target.checked)} /> Producto activo</label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={producto.favorito} onChange={(e) => cambiar("favorito", e.target.checked)} /> Favorito destacado</label>
      </section>
      <div className="space-y-4">
        {producto.variantes.map((variante, indice) => (
          <EditorVariante key={variante.uiId} variante={variante} indice={indice} total={producto.variantes.length} onChange={(valor) => cambiarVariante(indice, valor)} onCambiarNombre={(nombre) => cambiarNombreVariante(indice, nombre)} onMover={(direccion) => moverVariante(indice, direccion)} onAgregar={() => cambiar("variantes", [...producto.variantes, nuevaVariante(producto.variantes)])} />
        ))}
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-500/60 bg-red-950/50 p-4 text-red-200">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" onClick={onCancelar} className="rounded-full border border-slate-600 px-6 py-3">Cancelar</button><button disabled={guardando} className="rounded-full bg-[#DCCDA4] px-7 py-3 font-medium text-slate-950 disabled:opacity-50">{guardando ? "Guardando…" : "Guardar producto"}</button></div>
    </form>
  );
}

export default function GestorCatalogo() {
  const [productos, setProductos] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  const cargar = async () => {
    try {
      const respuesta = await gestorApi.listar();
      setProductos(respuesta.productos);
      setError("");
    } catch (err) { setError(err.message); }
  };
  useEffect(() => {
    gestorApi.listar().then(
      ({ productos: catalogo }) => setProductos(catalogo),
      (err) => setError(err.message)
    );
  }, []);
  const visibles = useMemo(() => productos.filter(({ nombre, id }) => `${nombre} ${id}`.toLowerCase().includes(busqueda.toLowerCase())), [productos, busqueda]);

  const cambiarEstado = async (producto) => {
    try { await gestorApi.cambiarProducto(producto.id, !producto.activo); await cargar(); }
    catch (err) { setError(err.message); }
  };
  const cambiarVariante = async (producto, variante) => {
    try { await gestorApi.cambiarVariante(producto.id, variante.id, variante.activo === false); await cargar(); }
    catch (err) { setError(err.message); }
  };

  if (seleccion) return <main className="min-h-screen bg-slate-950 px-5 py-10 text-white"><FormularioProducto inicial={seleccion.producto} esNuevo={seleccion.nuevo} onCancelar={() => setSeleccion(null)} onGuardado={async () => { await cargar(); setSeleccion(null); }} /></main>;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm uppercase tracking-[0.22em] text-[#DCCDA4]">Estación Verano</p><h1 className="text-4xl font-light">Gestor local de catálogo</h1><p className="mt-2 text-slate-400">Disponible únicamente durante el desarrollo local.</p></div><button onClick={() => setSeleccion({ nuevo: true, producto: nuevoProducto() })} className="rounded-full bg-[#DCCDA4] px-6 py-3 font-medium text-slate-950">+ Nuevo producto</button></header>
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…" className="mb-6 w-full rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4" />
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/60 p-4 text-red-200">{error}</p>}
        <div className="space-y-3">
          {visibles.map((producto) => (
            <article key={producto.id} className="rounded-2xl border border-slate-700 bg-[#102A2A] p-5">
              <div className="flex flex-wrap items-center gap-4"><img src={producto.variantes[0]?.imagenes[0]} alt="" className="h-20 w-20 rounded-xl bg-slate-800 object-cover" /><div className="min-w-48 flex-1"><h2 className="text-xl">{producto.nombre}</h2><p className="text-sm text-slate-400">{producto.id} · {producto.categoria} · {producto.variantes.length} color(es)</p><span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${producto.activo ? "bg-emerald-900 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>{producto.activo ? "Activo" : "Inactivo"}</span></div><button onClick={() => setSeleccion({ nuevo: false, producto })} className="rounded-full border border-[#DCCDA4] px-5 py-2 text-[#DCCDA4]">Editar</button><button onClick={() => cambiarEstado(producto)} className="rounded-full border border-slate-600 px-5 py-2">{producto.activo ? "Desactivar" : "Activar"}</button></div>
              {producto.variantes.length > 1 && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-700 pt-4">{producto.variantes.map((variante) => <button key={variante.id} onClick={() => cambiarVariante(producto, variante)} className="flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 text-xs"><span className="h-3 w-3 rounded-full border border-white/30" style={{ background: variante.codigo || "transparent" }} />{variante.nombre}: {variante.activo === false ? "inactiva" : "activa"}</button>)}</div>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
