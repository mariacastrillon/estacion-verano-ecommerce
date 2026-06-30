import { useState } from "react";
import productos from "../data/productos";
import ProductoCard from "../components/ProductoCard";
import { Link } from "react-router-dom";
import PromocionSemana from "../components/PromocionSemana";

function Inicio() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* NAVBAR */}
      <nav className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">

          <h1 className="text-lg md:text-2xl tracking-[0.20em] font-light">
            ESTACIÓN VERANO
          </h1>

          <div className="hidden md:flex gap-10 text-sm uppercase tracking-widest text-slate-300">
            <Link to="/">Inicio</Link>
            <Link to="/coleccion">Colección</Link>
            <a href="#contacto">Contacto</a>
          </div>

          <button
            className="md:hidden text-3xl"
            onClick={() => setMenuAbierto(!menuAbierto)}
          >
            ☰
          </button>

        </div>

        {menuAbierto && (
          <div className="md:hidden flex flex-col items-center gap-4 py-4 border-t border-slate-800">

            <Link
              to="/"
              onClick={() => setMenuAbierto(false)}
            >
              Inicio
            </Link>

            <Link
              to="/coleccion"
              onClick={() => setMenuAbierto(false)}
            >
              Colección
            </Link>

            <a
              href="#contacto"
              onClick={() => setMenuAbierto(false)}
            >
              Contacto
            </a>

          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pt-4 pb-4">

        <div className="text-center">

          <h1 className="text-3xl md:text-5xl font-light tracking-[0.12em] mb-4">
            ESTACIÓN VERANO
          </h1>

          <p className="text-slate-300 text-sm md:text-lg max-w-sm md:max-w-3xl mx-auto leading-relaxed px-4">
            Diseños pensados para mujeres que saben quiénes son
          </p>

          <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-6 mt-6">

            <Link to="/coleccion">
              <button className="bg-[#DCCDA4] text-slate-900 px-8 py-3 rounded-full font-medium hover:opacity-90 transition">
                Ver Colección
              </button>
            </Link>

            <a
              href="https://wa.me/573159048807?text=Hola,%20quiero%20información%20sobre%20los%20trajes%20de%20baño"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="border border-[#DCCDA4] text-[#DCCDA4] px-8 py-3 rounded-full hover:bg-[#DCCDA4] hover:text-slate-900 transition">
                WhatsApp
              </button>
            </a>

          </div>

        </div>

      </section>

      {/* PORTADA */}
      <section className="w-full">
        <img
          src="/hero/portada.jpg"
          alt="Portada Estación Verano"
          className="w-full h-[210px] md:h-auto object-cover"
        />
      </section>

      {/* FAVORITOS */}
      <section className="max-w-7xl mx-auto px-6 py-20">

        <h2 className="text-2xl md:text-3xl font-semibold mb-2 text-center">
          Los Favoritos de Nuestras Clientas
        </h2>

        <p className="text-center text-slate-400 mb-10">
          Diseños que más han enamorado esta temporada
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

  {productos.slice(0, 3).map((producto) => (

    <ProductoCard
      key={producto.id}
      producto={producto}
    />

  ))}

</div>

        <div className="text-center mt-12">
          <Link to="/coleccion">
            <button className="bg-[#DCCDA4] text-slate-900 px-8 py-3 rounded-full font-medium hover:opacity-90 transition">
              Ver Colección Completa
            </button>
          </Link>
        </div>

      </section>

      <PromocionSemana />

      {/* SOBRE NOSOTROS */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">

        <h2 className="text-2xl md:text-4xl font-light mb-6">
          Sobre Estación Verano
        </h2>

        <p className="text-slate-300 leading-relaxed">
          En Estación Verano creemos que cada mujer merece sentirse segura,
          elegante y cómoda. Seleccionamos cuidadosamente cada diseño para
          ofrecer prendas que resalten la belleza natural.
        </p>

      </section>

      {/* FOOTER */}
      <footer
        id="contacto"
        className="border-t border-slate-800 mt-20 py-12"
      >
        <div className="max-w-7xl mx-auto px-6 text-center">

          <h3 className="text-2xl tracking-[0.2em] font-light mb-6">
            ESTACIÓN VERANO
          </h3>

          <div className="space-y-3 text-slate-300">

            <p>
              WhatsApp:
              <a
                href="https://wa.me/573159048807"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[#DCCDA4] hover:underline"
              >
                315 904 8807
              </a>
            </p>

            <p>
              Instagram:
              <a
                href="https://instagram.com/verano.sm"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[#DCCDA4] hover:underline"
              >
                @verano.sm
              </a>
            </p>

            <p>Santa Marta, Colombia</p>

          </div>

          <p className="text-slate-500 text-sm mt-8">
            © 2026 Estación Verano. Todos los derechos reservados.
          </p>

        </div>
      </footer>

    </main>
  );
}

export default Inicio;