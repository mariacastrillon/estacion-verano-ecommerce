const etiquetas = {
  nuevo: {
    texto: "⭐ Nuevo",
    color: "bg-sky-500",
  },

  pareo: {
    texto: "🌸 Incluye pareo",
    color: "bg-pink-500",
  },

  "3-piezas": {
    texto: "💎 3 piezas",
    color: "bg-emerald-600",
  },

  "4-piezas": {
    texto: "👑 4 piezas",
    color: "bg-violet-600",
  },

  "flores-removibles": {
    texto: "🌺 Flores removibles",
    color: "bg-fuchsia-600",
  },

  "edicion-limitada": {
    texto: "✨ Edición limitada",
    color: "bg-amber-500 text-slate-900",
  },

  "ultimas-unidades": {
    texto: "🔥 Últimas unidades",
    color: "bg-red-600",
  },
};

function Etiqueta({ tipo }) {
  const etiqueta = etiquetas[tipo];

  if (!etiqueta) return null;

  return (
    <span
      className={`${etiqueta.color} text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg`}
    >
      {etiqueta.texto}
    </span>
  );
}

export default Etiqueta;