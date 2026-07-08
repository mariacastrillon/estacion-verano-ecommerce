import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import productos from "../data/productos";
import ImagenModal from "../components/ImagenModal";
import Navbar from "../components/Navbar";

function ProductoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const producto = productos.find(
    (p) => p.id === id
  );

  const [imagenActiva, setImagenActiva] = useState(
    producto?.imagenes[0]
  );

  const [tallaSeleccionada, setTallaSeleccionada] = useState("");

  const [mensajeError, setMensajeError] = useState("");

  const [zoomStyle, setZoomStyle] = useState({});

  const [modalAbierto, setModalAbierto] = useState(false);
  const [esMovil, setEsMovil] = useState(false);

  const indiceImagen =
    producto?.imagenes.findIndex(
      (img) => img === imagenActiva
    ) ?? 0;

  useEffect(() => {
    const comprobarPantalla = () => {
      setEsMovil(window.innerWidth < 768);
    };

    comprobarPantalla();

    window.addEventListener("resize", comprobarPantalla);

    return () =>
      window.removeEventListener(
        "resize",
        comprobarPantalla
      );
  }, []);

  const handleMouseMove = (e) => {
    const { left, top, width, height } =
      e.currentTarget.getBoundingClientRect();

    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;

    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: "scale(2.2)",
    });
  };

  const handleMouseLeave = () => {
    setZoomStyle({
      transform: "scale(1)",
    });
  };

  if (!producto) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <h1>Producto no encontrado</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-16">

        <div className="grid lg:grid-cols-2 gap-12">

          {/* Galería */}

          <div>

            <div
              className="overflow-hidden rounded-3xl cursor-zoom-in"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={() => {
                if (esMovil) {
                  setModalAbierto(true);
                }
              }}
            >

              <img
                src={imagenActiva}
                alt={producto.nombre}
                className="w-full transition-transform duration-300"
                style={zoomStyle}
              />

            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">

              {producto.imagenes.map((imagen, index) => (

                <button
                  key={index}
                  onClick={() => setImagenActiva(imagen)}
                  className="overflow-hidden rounded-xl border border-slate-700"
                >

                  <img
                    src={imagen}
                    alt={`${producto.nombre} ${index + 1}`}
                    className="w-full h-28 object-cover"
                  />

                </button>

              ))}

            </div>

          </div>

          {/* Información */}

          <div>

            <div className="flex gap-6 mb-8">

              <button
                onClick={() => navigate("/coleccion")}
                className="text-[#DCCDA4] hover:underline"
              >
                ← Volver a la colección
              </button>

              <button
                onClick={() => navigate("/")}
                className="text-slate-400 hover:underline"
              >
                Inicio
              </button>

            </div>

            <h1 className="text-4xl md:text-5xl font-light mb-4">
              {producto.nombre}
            </h1>

            <p className="text-[#DCCDA4] text-4xl font-semibold mb-8">
              ${producto.precio}
            </p>
              
              {/* Características */}

<div className="space-y-4 mb-10">

  {producto.color && (
    <div>
      <h3 className="text-[#DCCDA4] font-medium">
        🎨 Color
      </h3>

      <p className="text-slate-300">
        {producto.color}
      </p>
    </div>
  )}

  {producto.material && (
    <div>
      <h3 className="text-[#DCCDA4] font-medium">
        🧵 Material
      </h3>

      <p className="text-slate-300">
        {producto.material}
      </p>
    </div>
  )}

  {producto.medidas && (
    <div>
      <h3 className="text-[#DCCDA4] font-medium">
        📏 Medidas
      </h3>

      <p className="text-slate-300">
        {producto.medidas}
      </p>
    </div>
  )}

  {producto.incluye && (
    <div>
      <h3 className="text-[#DCCDA4] font-medium">
        ✨ Incluye
      </h3>

      <p className="text-slate-300">
        {producto.incluye}
      </p>
    </div>
  )}

</div>

            {/* Tallas */}

            {producto.tallas?.length > 0 && (

              <div className="mb-8">

                <h3 className="text-lg mb-3">
                  Tallas disponibles
                </h3>

                <div className="flex gap-3">

                  {producto.tallas.map((talla) => (

                    <button
                      key={talla}
                      onClick={() => {
                        setTallaSeleccionada(talla);
                        setMensajeError("");
                      }}
                      className={`px-5 py-2 rounded-full border transition-all duration-300
                        ${
                          tallaSeleccionada === talla
                            ? "bg-[#DCCDA4] text-slate-900 border-[#DCCDA4]"
                            : "border-[#DCCDA4] text-[#DCCDA4] hover:bg-[#DCCDA4] hover:text-slate-900"
                        }`}
                    >
                      {talla}
                    </button>

                  ))}

                </div>

              </div>

            )}

            {/* Descripción */}

            <div className="mb-10">

              <h3 className="text-lg mb-3">
                Descripción
              </h3>

              <p className="text-slate-300 leading-relaxed">
                {producto.descripcion}
              </p>

            </div>

            <button
              onClick={() => {

                if (
                  producto.tallas?.length > 0 &&
                  !tallaSeleccionada
                ) {
                  setMensajeError(
                    "Por favor selecciona una talla antes de continuar."
                  );
                  return;
                }

                const mensaje = `Hola.

Me interesa:

${producto.nombre}

${
  producto.tallas?.length > 0
    ? `Talla: ${tallaSeleccionada}`
    : ""
}

¿Está disponible?`;

                window.open(
                  `https://wa.me/573159048807?text=${encodeURIComponent(
                    mensaje
                  )}`,
                  "_blank"
                );

              }}
              className="bg-[#DCCDA4] text-slate-900 px-8 py-4 rounded-full font-medium hover:opacity-90 transition"
            >
              Comprar por WhatsApp
            </button>

            {mensajeError && (

              <p className="mt-4 text-red-400 text-sm">
                {mensajeError}
              </p>

            )}

          </div>

        </div>

      </div>

      <ImagenModal
        abierto={modalAbierto}
        imagenes={producto.imagenes}
        indiceInicial={indiceImagen}
        onCerrar={() => setModalAbierto(false)}
      />

    </main>
  );
}

export default ProductoDetalle;