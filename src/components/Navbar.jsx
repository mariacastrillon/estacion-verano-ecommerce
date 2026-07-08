import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

function Navbar() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [coleccionesAbierto, setColeccionesAbierto] = useState(false);

  return (
    <nav className="border-b border-slate-800">

      <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">

        <Link to="/">
          <h1 className="text-lg md:text-2xl tracking-[0.20em] font-light hover:text-[#DCCDA4] transition">
            ESTACIÓN VERANO
          </h1>
        </Link>

        {/* ===========================
             MENÚ ESCRITORIO
        ============================ */}

        <div className="hidden md:flex items-center gap-10 text-sm uppercase tracking-widest text-slate-300">

          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `transition ${
                isActive
                  ? "text-[#DCCDA4]"
                  : "hover:text-[#DCCDA4]"
              }`
            }
          >
            Inicio
          </NavLink>

          {/* Colecciones */}

          <div
            className="relative"
            onMouseEnter={() => setColeccionesAbierto(true)}
            onMouseLeave={() => setColeccionesAbierto(false)}
          >

            <button
              className="flex items-center gap-2 hover:text-[#DCCDA4] transition"
            >
              Colecciones

              <span
                className={`text-[10px] transition-transform duration-300 ${
                  coleccionesAbierto ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {coleccionesAbierto && (

              <div className="absolute left-0 top-full pt-2 w-64 z-50">

                <div className="rounded-2xl bg-[#102A2A] border border-[#2E4A47] shadow-2xl overflow-hidden">

                  <Link
                    to="/coleccion/trajes"
                    className="block px-6 py-4 hover:bg-[#143737] transition"
                  >
                    🌊 Trajes de baño
                  </Link>

                  <Link
                    to="/coleccion/salidas"
                    className="block px-6 py-4 hover:bg-[#143737] transition"
                  >
                    🌴 Salidas de baño
                  </Link>

                  <Link
                    to="/coleccion/bolsos"
                    className="block px-6 py-4 hover:bg-[#143737] transition"
                  >
                    👜 Bolsos
                  </Link>

                  <Link
                    to="/coleccion/accesorios"
                    className="block px-6 py-4 hover:bg-[#143737] transition"
                  >
                    🕶️ Accesorios
                  </Link>

                </div>

              </div>

            )}

          </div>

          <NavLink
            to="/favoritos"
            className={({ isActive }) =>
              `transition ${
                isActive
                  ? "text-[#DCCDA4]"
                  : "hover:text-[#DCCDA4]"
              }`
            }
          >
            ♡ Mis Favoritos
          </NavLink>

          <a
            href="#contacto"
            className="hover:text-[#DCCDA4] transition"
          >
            Contacto
          </a>

        </div>

        {/* ===========================
             BOTÓN MÓVIL
        ============================ */}

        <button
          className="md:hidden text-3xl"
          onClick={() => setMenuAbierto(!menuAbierto)}
        >
          ☰
        </button>

      </div>

      {/* ===========================
             MENÚ MÓVIL
      ============================ */}

      {menuAbierto && (

        <div className="md:hidden flex flex-col gap-4 py-5 border-t border-slate-800 px-6">

          <Link
            to="/"
            onClick={() => setMenuAbierto(false)}
          >
            Inicio
          </Link>

          <div className="font-medium text-[#DCCDA4]">
            Colecciones
          </div>

          <Link
            to="/coleccion/trajes"
            onClick={() => setMenuAbierto(false)}
            className="ml-4"
          >
            🌊 Trajes de baño
          </Link>

          <Link
            to="/coleccion/salidas"
            onClick={() => setMenuAbierto(false)}
            className="ml-4"
          >
            🌴 Salidas de baño
          </Link>

          <Link
            to="/coleccion/bolsos"
            onClick={() => setMenuAbierto(false)}
            className="ml-4"
          >
            👜 Bolsos
          </Link>

          <Link
            to="/coleccion/accesorios"
            onClick={() => setMenuAbierto(false)}
            className="ml-4"
          >
            🕶️ Accesorios
          </Link>

          <Link
            to="/favoritos"
            onClick={() => setMenuAbierto(false)}
          >
            ♡ Mis Favoritos
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
  );
}

export default Navbar;