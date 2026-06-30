import { useState, useEffect, useRef } from "react";

function ImagenModal({
  abierto,
  imagenes,
  indiceInicial,
  onCerrar,
}) {
  const [indice, setIndice] = useState(indiceInicial);

  const inicioX = useRef(0);
  const finX = useRef(0);

  useEffect(() => {
    setIndice(indiceInicial);
  }, [indiceInicial]);

  if (!abierto) return null;

  const anterior = () => {
    setIndice((i) =>
      i === 0 ? imagenes.length - 1 : i - 1
    );
  };

  const siguiente = () => {
    setIndice((i) =>
      i === imagenes.length - 1 ? 0 : i + 1
    );
  };

  // ===========================
  // Swipe para móviles
  // ===========================

  const iniciarTouch = (e) => {
    inicioX.current = e.touches[0].clientX;
  };

  const moverTouch = (e) => {
    finX.current = e.touches[0].clientX;
  };

  const finalizarTouch = () => {
    const distancia = inicioX.current - finX.current;

    if (Math.abs(distancia) < 50) return;

    if (distancia > 0) {
      siguiente();
    } else {
      anterior();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="relative max-w-6xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}

        <button
          onClick={onCerrar}
          className="absolute right-3 top-3 text-white text-4xl z-50"
        >
          ×
        </button>

        {/* Flecha izquierda (solo escritorio) */}

        <button
          onClick={anterior}
          className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 text-white text-5xl z-50 items-center justify-center hover:scale-110 transition"
        >
          ‹
        </button>

        {/* Imagen */}

        <img
          src={imagenes[indice]}
          alt=""
          draggable={false}
          onTouchStart={iniciarTouch}
          onTouchMove={moverTouch}
          onTouchEnd={finalizarTouch}
          className="w-full max-h-[90vh] object-contain rounded-2xl select-none"
        />

        {/* Flecha derecha (solo escritorio) */}

        <button
          onClick={siguiente}
          className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 text-white text-5xl z-50 items-center justify-center hover:scale-110 transition"
        >
          ›
        </button>

        {/* Indicadores */}

        <div className="flex justify-center gap-2 mt-5">

          {imagenes.map((_, i) => (

            <button
              key={i}
              onClick={() => setIndice(i)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                indice === i
                  ? "bg-[#DCCDA4] scale-125"
                  : "bg-slate-500"
              }`}
            />

          ))}

        </div>

      </div>
    </div>
  );
}

export default ImagenModal;