function Producto({ nombre, precio, tallas, imagen }) {
  const mensaje = `Hola, estoy interesada en ${nombre}. ¿Podrías darme más información?`;

  return (
    <div className="w-full max-w-[320px] bg-[#102A2A] rounded-3xl overflow-hidden border border-[#2E4A47] hover:scale-105 hover:border-[#DCCDA4] transition-all duration-500 shadow-xl">

      <img
        src={imagen}
        alt={nombre}
        className="w-full h-[350px] md:h-[420px] object-cover"
      />

      <div className="p-6">

        <h3 className="text-xl md:text-2xl font-light mb-4 text-white">
          {nombre}
        </h3>

        <p className="text-[#DCCDA4] text-2xl md:text-3xl font-semibold mb-3">
          ${precio}
        </p>

        <p className="text-slate-300 mb-6">
          Tallas: {tallas}
        </p>

        <a
          href={`https://wa.me/573159048807?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <button className="w-full bg-[#DCCDA4] text-[#102A2A] py-3 rounded-full font-medium hover:opacity-90 transition cursor-pointer">
            Comprar por WhatsApp
          </button>
        </a>

      </div>

    </div>
  );
}

export default Producto;