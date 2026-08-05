function SelectorVariantes({
  variantes,
  varianteActiva,
  onSeleccionar,
}) {
  if (!variantes || variantes.length <= 1) {
    return null;
  }

  return (
    <div className="mt-8">

      <h3 className="text-lg mb-4 text-slate-200">
        Otros colores disponibles
      </h3>

      <div className="flex flex-wrap gap-4">

        {variantes.map((variante) => (

          <button
            key={variante.id}
            onClick={() => onSeleccionar(variante)}
            className={`group flex w-24 flex-col rounded-2xl border-2 bg-slate-900/70 p-1 text-left transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCCDA4] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              variante.id === varianteActiva?.id
                ? "border-[#DCCDA4] scale-[1.04] shadow-[0_10px_25px_rgba(220,205,164,0.18)]"
                : "border-slate-700 hover:-translate-y-1 hover:border-[#DCCDA4] hover:shadow-[0_8px_20px_rgba(15,23,42,0.5)]"
            }`}
          >

            <img
              src={variante.miniatura}
              alt={variante.nombre}
              className="h-24 w-full rounded-xl object-cover"
            />

            <span className={`px-1 pt-2 text-center text-xs font-medium transition-colors ${
              variante.id === varianteActiva?.id
                ? "text-[#DCCDA4]"
                : "text-slate-300 group-hover:text-white"
            }`}>
              {variante.nombre}
            </span>

          </button>

        ))}

      </div>

    </div>
  );
}

export default SelectorVariantes;
