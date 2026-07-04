import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

function Navbar() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <nav className="border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">

        <Link to="/">
          <h1 className="text-lg md:text-2xl tracking-[0.20em] font-light hover:text-[#DCCDA4] transition">
            ESTACIÓN VERANO
          </h1>
        </Link>

        {/* Menú escritorio */}

        <div className="hidden md:flex gap-10 text-sm uppercase tracking-widest text-slate-300">

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

         <NavLink
  to="/coleccion"
  className={({ isActive }) =>
    `transition ${
      isActive
        ? "text-[#DCCDA4]"
        : "hover:text-[#DCCDA4]"
    }`
  }
>
  Colección
</NavLink>

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

        {/* Botón móvil */}

        <button
          className="md:hidden text-3xl"
          onClick={() => setMenuAbierto(!menuAbierto)}
        >
          ☰
        </button>

      </div>

      {/* Menú móvil */}

      {menuAbierto && (

        <div className="md:hidden flex flex-col items-center gap-5 py-5 border-t border-slate-800">

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