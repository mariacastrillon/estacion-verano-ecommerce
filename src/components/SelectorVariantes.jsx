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

      <h3 className="text-lg mb-4">
        Otros colores disponibles
      </h3>

      <div className="flex flex-wrap gap-4">

        {variantes.map((variante) => (

          <button
            key={variante.id}
            onClick={() => onSeleccionar(variante)}
            className={`rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
              variante.id === varianteActiva.id
                ? "border-[#DCCDA4] scale-105"
                : "border-slate-700 hover:border-[#DCCDA4]"
            }`}
          >

            <img
              src={variante.miniatura}
              alt={variante.nombre}
              className="w-20 h-24 object-cover"
            />

          </button>

        ))}

      </div>

    </div>
  );
}

export default SelectorVariantes;