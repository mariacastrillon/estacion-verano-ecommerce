import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import productos from "../data/productos";
import ProductoCard from "../components/ProductoCard";
import { useNavigate } from "react-router-dom";
import PromocionSemana from "../components/PromocionSemana";
import Navbar from "../components/Navbar";

function Inicio() {
  const navigate = useNavigate();
  const [avisoColeccionAbierto, setAvisoColeccionAbierto] = useState(false);
  const botonAvisoRef = useRef(null);
  const botonOrigenRef = useRef(null);
  const dialogoColeccionRef = useRef(null);

  useEffect(() => {
    if (!avisoColeccionAbierto) return undefined;

    const gestionarTeclado = (event) => {
      if (event.key === "Escape") {
        setAvisoColeccionAbierto(false);
        return;
      }

      if (event.key !== "Tab") return;

      const elementos = dialogoColeccionRef.current?.querySelectorAll("button");
      if (!elementos?.length) return;

      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];

      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };

    window.addEventListener("keydown", gestionarTeclado);
    botonAvisoRef.current?.focus();
    const botonOrigen = botonOrigenRef.current;

    return () => {
      window.removeEventListener("keydown", gestionarTeclado);
      botonOrigen?.focus();
    };
  }, [avisoColeccionAbierto]);

  const abrirColeccion = (event) => {
    botonOrigenRef.current = event.currentTarget;
    let avisoVisto = false;

    try {
      avisoVisto = sessionStorage.getItem("aviso-coleccion-visto") === "true";
    } catch {
      // El aviso sigue funcionando aunque el navegador bloquee sessionStorage.
    }

    if (avisoVisto) {
      navigate("/coleccion");
      return;
    }

    setAvisoColeccionAbierto(true);
  };

  const confirmarColeccion = () => {
    try {
      sessionStorage.setItem("aviso-coleccion-visto", "true");
    } catch {
      // La navegación no debe bloquearse si sessionStorage no está disponible.
    }
    setAvisoColeccionAbierto(false);
    navigate("/coleccion");
  };

  

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* NAVBAR */}
      <Navbar />

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

            <button
              type="button"
              onClick={abrirColeccion}
              className="bg-[#DCCDA4] text-slate-900 px-8 py-3 rounded-full font-medium hover:opacity-90 transition"
            >
                Ver Colección
            </button>

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
          src="/hero/portada.webp"
          width="1280"
          height="853"
          fetchPriority="high"
          decoding="async"
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

  {productos
  .filter((producto) => producto.favorito)
  .map((producto) => (

    <ProductoCard
      key={producto.id}
      producto={producto}
    />

))}

</div>

        <div className="text-center mt-12">
          <button
            type="button"
            onClick={abrirColeccion}
            className="bg-[#DCCDA4] text-slate-900 px-8 py-3 rounded-full font-medium hover:opacity-90 transition"
          >
              Ver Colección Completa
          </button>
        </div>

      </section>

      {avisoColeccionAbierto && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-[2px] md:items-center">
          <div
            ref={dialogoColeccionRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-aviso-coleccion"
            className="relative w-full max-w-md rounded-3xl border border-[#DCCDA4]/40 bg-[#102A2A] px-6 pb-6 pt-8 text-center shadow-2xl transition duration-200 md:px-8 md:pb-8"
          >
            <button
              type="button"
              onClick={() => setAvisoColeccionAbierto(false)}
              aria-label="Cerrar aviso de la colecci&oacute;n"
              className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCCDA4]"
            >
              &times;
            </button>

            <h2
              id="titulo-aviso-coleccion"
              className="mb-3 pr-5 text-2xl font-light text-white"
            >
              Encuentra tu favorito m&aacute;s r&aacute;pido &#10024;
            </h2>

            <p className="mb-6 text-sm leading-relaxed text-slate-300 md:text-base">
              Usa la b&uacute;squeda, que tambi&eacute;n reconoce colores, filtra por
              talla y ordena por precio para encontrar opciones m&aacute;s cercanas
              a lo que buscas.
            </p>

            <button
              ref={botonAvisoRef}
              type="button"
              onClick={confirmarColeccion}
              className="w-full rounded-full bg-[#DCCDA4] px-6 py-3 font-medium text-slate-900 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#102A2A]"
            >
              Ver colecci&oacute;n
            </button>
          </div>
        </div>,
        document.body
      )}

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
