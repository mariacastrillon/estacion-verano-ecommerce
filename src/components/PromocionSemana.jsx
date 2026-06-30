import { useState } from "react";

function PromocionSemana() {
  const [abierto, setAbierto] = useState(false);
  const [zoom, setZoom] = useState(false);

  const cerrarModal = () => {
    setAbierto(false);
    setZoom(false);
  };

  return (
    <>
      {/* Tarjeta */}

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div
          onClick={() => setAbierto(true)}
          className="cursor-pointer bg-gradient-to-r from-[#102A2A] to-[#1B3B3B] border border-[#DCCDA4] rounded-3xl p-10 text-center transition hover:scale-[1.02] hover:shadow-2xl"
        >
          <p className="text-[#DCCDA4] uppercase tracking-[0.25em] text-sm mb-3">
            Promoción de la Semana
          </p>

          <h2 className="text-3xl md:text-4xl font-light mb-4">
            Tenemos algo especial para ti
          </h2>

          <p className="text-slate-300 mb-8">
            Descubre la promoción vigente y aprovecha antes de que termine.
          </p>

          <button className="bg-[#DCCDA4] text-slate-900 px-8 py-3 rounded-full font-medium hover:opacity-90 transition">
            Ver promoción
          </button>
        </div>
      </section>

      {/* Modal */}

      {abierto && (
        <div
          onClick={cerrarModal}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col items-center"
          >
            {/* Botón cerrar */}

            <button
              onClick={cerrarModal}
              className="absolute -top-5 -right-5 bg-white text-black rounded-full w-10 h-10 text-xl shadow-lg hover:scale-110 transition"
            >
              ×
            </button>

            {/* Imagen */}

            <img
              src="/promociones/promo-semana.jpg"
              alt="Promoción de la semana"
              onClick={() => setZoom(!zoom)}
              className={`
                rounded-3xl
                shadow-2xl
                transition-all
                duration-300
                cursor-zoom-in
                object-contain
                ${
                  zoom
                    ? "scale-150 cursor-zoom-out"
                    : "max-h-[80vh] w-auto"
                }
              `}
            />

            <p className="text-slate-300 text-sm mt-4">
              Haz clic sobre la imagen para acercarla.
            </p>

            <a
              href="https://wa.me/573159048807?text=Hola,%20vi%20la%20promoción%20de%20la%20semana%20y%20quiero%20aprovecharla."
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6"
            >
              <button className="bg-[#DCCDA4] text-slate-900 px-8 py-3 rounded-full font-medium hover:opacity-90 transition">
                Aprovechar promoción 📲
              </button>
            </a>
          </div>
        </div>
      )}
    </>
  );
}

export default PromocionSemana;