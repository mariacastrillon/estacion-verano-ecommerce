import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import productos, { obtenerVariantes } from "../data/productos";
import ImagenModal from "../components/ImagenModal";
import Navbar from "../components/Navbar";
import SelectorVariantes from "../components/SelectorVariantes";
import WhatsAppButton from "../components/WhatsAppButton";
import { crearMensajeProductoWhatsApp } from "../config/whatsapp";

function ProductoDetalleContenido({ id }) {
  const navigate = useNavigate();
  const producto = productos.find((item) => item.id === id);
  const variantes = producto ? obtenerVariantes(producto) : [];

  const [varianteActiva, setVarianteActiva] = useState(() => variantes[0] ?? null);
  const [imagenActiva, setImagenActiva] = useState(
    () => variantes[0]?.imagenes?.[0] ?? ""
  );
  const [tallaSeleccionada, setTallaSeleccionada] = useState("");
  const [mensajeError, setMensajeError] = useState("");
  const [zoomStyle, setZoomStyle] = useState({});
  const [modalAbierto, setModalAbierto] = useState(false);
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    const comprobarPantalla = () => setEsMovil(window.innerWidth < 768);

    comprobarPantalla();
    window.addEventListener("resize", comprobarPantalla);

    return () => window.removeEventListener("resize", comprobarPantalla);
  }, []);

  if (!producto) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <h1>Producto no encontrado</h1>
      </main>
    );
  }

  const imagenesActivas = varianteActiva?.imagenes ?? [];
  const tallasActivas = varianteActiva?.tallas ?? [];
  const indiceImagen = Math.max(0, imagenesActivas.indexOf(imagenActiva));

  const handleMouseMove = (event) => {
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - left) / width) * 100;
    const y = ((event.clientY - top) / height) * 100;

    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: "scale(2.2)",
    });
  };

  const seleccionarVariante = (variante) => {
    setVarianteActiva(variante);
    setImagenActiva(variante.imagenes?.[0] ?? "");
    setTallaSeleccionada("");
    setMensajeError("");
  };

  const validarCompra = () => {
    if (tallasActivas.length > 0 && !tallaSeleccionada) {
      setMensajeError("Por favor selecciona una talla antes de continuar.");
      return false;
    }

    return true;
  };

  const mensajeWhatsApp = crearMensajeProductoWhatsApp({
    producto,
    variante: varianteActiva,
    cantidadVariantes: variantes.length,
    talla: tallaSeleccionada,
  });


  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <div
              className="overflow-hidden rounded-3xl cursor-zoom-in"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setZoomStyle({ transform: "scale(1)" })}
              onClick={() => {
                if (esMovil && imagenesActivas.length > 0) setModalAbierto(true);
              }}
            >
              {imagenActiva && (
                <img
                  src={imagenActiva}
                  width="1200"
                  height="1600"
                  decoding="async"
                  alt={producto.nombre}
                  className="w-full transition-transform duration-300"
                  style={zoomStyle}
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              {imagenesActivas.map((imagen, index) => (
                <button
                  key={imagen || index}
                  onClick={() => setImagenActiva(imagen)}
                  className="overflow-hidden rounded-xl border border-slate-700"
                >
                  <img
                    src={imagen}
                    alt={`${producto.nombre} ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    width="400"
                    height="400"
                    className="w-full h-28 object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex gap-6 mb-8">
              <button
                onClick={() => navigate("/coleccion")}
                className="text-[#DCCDA4] hover:underline"
              >
                &larr; Volver a la colecci&oacute;n
              </button>
              <button onClick={() => navigate("/")} className="text-slate-400 hover:underline">
                Inicio
              </button>
            </div>

            <h1 className="text-4xl md:text-5xl font-light mb-4">{producto.nombre}</h1>
            <p className="text-[#DCCDA4] text-4xl font-semibold mb-8">${producto.precio}</p>

            {variantes.length >= 2 && varianteActiva?.nombre && (
              <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Color seleccionado</p>
                <p className="mt-1 text-lg font-medium text-[#DCCDA4]">
                  {varianteActiva.nombre}
                </p>
              </div>
            )}

            <SelectorVariantes
              variantes={variantes}
              varianteActiva={varianteActiva}
              onSeleccionar={seleccionarVariante}
            />

            <div className="space-y-4 mb-10">
              {producto.color && (
                <p className="text-slate-300">
                  {Array.isArray(producto.color) ? producto.color.join(" • ") : producto.color}
                </p>
              )}

              {producto.material && (
                <div><h3 className="text-[#DCCDA4] font-medium">🧵 Material</h3><p className="text-slate-300">{producto.material}</p></div>
              )}
              {producto.medidas && (
                <div><h3 className="text-[#DCCDA4] font-medium">📏 Medidas</h3><p className="text-slate-300">{producto.medidas}</p></div>
              )}
              {producto.incluye && (
                <div><h3 className="text-[#DCCDA4] font-medium">✨ Incluye</h3><p className="text-slate-300">{producto.incluye}</p></div>
              )}
            </div>

            {tallasActivas.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg mb-3">Tallas disponibles</h3>
                <div className="flex gap-3">
                  {tallasActivas.map((talla) => (
                    <button
                      key={talla}
                      onClick={() => { setTallaSeleccionada(talla); setMensajeError(""); }}
                      className={`px-5 py-2 rounded-full border transition-all duration-300 ${tallaSeleccionada === talla ? "bg-[#DCCDA4] text-slate-900 border-[#DCCDA4]" : "border-[#DCCDA4] text-[#DCCDA4] hover:bg-[#DCCDA4] hover:text-slate-900"}`}
                    >
                      {talla}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-10">
              <h3 className="text-lg mb-3">Descripción</h3>
              <p className="text-slate-300 leading-relaxed">{producto.descripcion}</p>
            </div>

            <WhatsAppButton
              mensaje={mensajeWhatsApp}
              onBeforeOpen={validarCompra}
              className="bg-[#DCCDA4] text-slate-900 px-8 py-4 rounded-full font-medium hover:opacity-90 transition"
            >
              Comprar por WhatsApp
            </WhatsAppButton>

            {mensajeError && <p className="mt-4 text-red-400 text-sm">{mensajeError}</p>}
          </div>
        </div>
      </div>

      <ImagenModal
        abierto={modalAbierto}
        imagenes={imagenesActivas}
        indiceInicial={indiceImagen}
        onCerrar={() => setModalAbierto(false)}
      />
    </main>
  );
}

function ProductoDetalle() {
  const { id } = useParams();
  return <ProductoDetalleContenido key={id} id={id} />;
}

export default ProductoDetalle;
