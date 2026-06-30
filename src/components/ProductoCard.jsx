import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const estilosEtiquetas = {
  nuevo: {
    texto: "Nuevo",
    clase: "bg-[#DCCDA4] text-slate-900",
  },

  "3-piezas": {
    texto: "3 piezas",
    clase: "bg-[#143737] text-white border border-[#DCCDA4]",
  },

  "4-piezas": {
    texto: "4 piezas",
    clase: "bg-[#143737] text-white border border-[#DCCDA4]",
  },

  pareo: {
    texto: "Incluye pareo",
    clase: "bg-[#143737] text-white border border-[#DCCDA4]",
  },

  "flores-removibles": {
    texto: "Flores removibles",
    clase: "bg-pink-600 text-white",
  },

  "edicion-limitada": {
    texto: "Edición limitada",
    clase: "bg-red-600 text-white",
  },
};

function ProductoCard({ producto }) {
  const [imagenActual, setImagenActual] = useState(0);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!hover || producto.imagenes.length <= 1) {
      setImagenActual(0);
      setVisible(true);
      return;
    }

    const intervalo = setInterval(() => {
      // Fade de salida
      setVisible(false);

      // Cuando termina el fade cambia la imagen
      requestAnimationFrame(() => {
        setTimeout(() => {
          setImagenActual((actual) =>
            (actual + 1) % producto.imagenes.length
          );

          // Fade de entrada
          setVisible(true);
        }, 180);
      });
    }, 1300);

    return () => clearInterval(intervalo);
  }, [hover, producto.imagenes]);

  return (
    <div className="group relative bg-[#102A2A] rounded-3xl overflow-hidden border border-[#2E4A47] hover:border-[#DCCDA4] hover:-translate-y-2 transition-all duration-500 shadow-xl">

      {/* Etiquetas */}

      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">

        {producto.etiquetas?.map((etiqueta) => {

          const estilo = estilosEtiquetas[etiqueta];

          if (!estilo) return null;

          return (
            <span
              key={etiqueta}
              className={`${estilo.clase} text-xs font-medium px-3 py-1 rounded-full backdrop-blur shadow-lg`}
            >
              {estilo.texto}
            </span>
          );

        })}

      </div>

      {/* Favoritos */}

      <button
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center hover:scale-110 transition duration-300"
      >
        🤍
      </button>

      {/* Imagen */}

      <div
        className="overflow-hidden"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >

        <img
          src={producto.imagenes[imagenActual]}
          alt={producto.nombre}
          loading="lazy"
          className={`
            w-full
            h-[450px]
            object-cover
            transition-all
            duration-500
            ease-in-out
            group-hover:scale-105
            ${visible ? "opacity-100" : "opacity-0"}
          `}
        />

      </div>

      {/* Información */}

      <div className="p-6">

        <h3 className="text-2xl font-light mb-3 text-white">
          {producto.nombre}
        </h3>

        <p className="text-[#DCCDA4] text-3xl font-semibold mb-4">
          ${producto.precio}
        </p>

        <Link to={`/producto/${producto.id}`}>

          <button className="w-full bg-[#DCCDA4] text-slate-900 py-3 rounded-full font-medium hover:opacity-90 hover:scale-[1.02] transition-all duration-300">

            Ver detalles

          </button>

        </Link>

      </div>

    </div>
  );
}

export default ProductoCard;