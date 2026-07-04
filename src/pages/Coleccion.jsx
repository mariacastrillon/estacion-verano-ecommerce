import { useState } from "react";
import productos from "../data/productos";
import ProductoCard from "../components/ProductoCard";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

function Coleccion() {
  const navigate = useNavigate();

  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("recientes");
  const [filtroTalla, setFiltroTalla] = useState("todas");

  const productosFiltrados = [...productos]
    .filter((producto) => {
      const texto = busqueda.toLowerCase().trim();

      const precioNormalizado = producto.precio
        .replace(/\./g, "")
        .replace(/,/g, "");

      const contenido = `
        ${producto.nombre}
        ${producto.descripcion}
        ${producto.tallas.join(" ")}
        ${producto.precio}
        ${producto.color}
        ${precioNormalizado}
      `.toLowerCase();

      const coincideBusqueda = contenido.includes(texto);

      const coincideTalla =
        filtroTalla === "todas" ||
        producto.tallas.includes(filtroTalla);

      return (
        coincideBusqueda &&
        coincideTalla
      );
    })
    .sort((a, b) => {
      const precioA = Number(a.precio.replace(/\./g, ""));
      const precioB = Number(b.precio.replace(/\./g, ""));

      switch (orden) {
        case "menor-precio":
          return precioA - precioB;

        case "mayor-precio":
          return precioB - precioA;

        case "nombre":
          return a.nombre.localeCompare(b.nombre);

        default:
          return 0;
      }
    });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <section className="max-w-7xl mx-auto px-6 py-20">

        <button
          onClick={() => navigate("/")}
          className="text-[#DCCDA4] hover:underline mb-8"
        >
          ← Volver al inicio
        </button>

        <h1 className="text-4xl font-light text-center mb-4">
          Colección Completa
        </h1>

        <p className="text-center text-slate-400 mb-12">
          Encuentra el diseño perfecto para ti
        </p>

        {/* BUSCADOR Y ORDEN */}

        <div className="flex flex-col md:flex-row gap-4 mb-10">

          <input
            type="text"
            placeholder="🔍 Buscar por nombre, talla o precio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-[#DCCDA4]"
          />

          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3"
          >
            <option value="recientes">Más recientes</option>
            <option value="menor-precio">Menor precio</option>
            <option value="mayor-precio">Mayor precio</option>
            <option value="nombre">Nombre A-Z</option>
          </select>

        </div>

        {/* FILTRO TALLAS */}

        <div className="flex flex-wrap gap-3 mb-8">

          <button
            onClick={() => setFiltroTalla("todas")}
            className={`px-4 py-2 rounded-full border transition ${
              filtroTalla === "todas"
                ? "bg-[#DCCDA4] text-slate-900 border-[#DCCDA4]"
                : "border-slate-600 hover:border-[#DCCDA4]"
            }`}
          >
            Todas
          </button>

          {["S", "M", "L"].map((talla) => (
            <button
              key={talla}
              onClick={() => setFiltroTalla(talla)}
              className={`px-4 py-2 rounded-full border transition ${
                filtroTalla === talla
                  ? "bg-[#DCCDA4] text-slate-900 border-[#DCCDA4]"
                  : "border-slate-600 hover:border-[#DCCDA4]"
              }`}
            >
              {talla}
            </button>
          ))}

        </div>

        {/* CONTADOR */}

        <p className="text-slate-400 mb-8">
          {productosFiltrados.length}{" "}
          {productosFiltrados.length === 1
            ? "diseño encontrado"
            : "diseños encontrados"}
        </p>

        {/* MENSAJE SI NO HAY RESULTADOS */}

        {productosFiltrados.length === 0 ? (

          <div className="text-center py-20">

            <h2 className="text-3xl font-light mb-4">
              No encontramos resultados
            </h2>

            <p className="text-slate-400">
              Intenta buscar por nombre, talla o precio.
            </p>

          </div>

        ) : (

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

  {productosFiltrados.map((producto) => (

    <ProductoCard
      key={producto.id}
      producto={producto}
    />

  ))}

</div>

        )}

      </section>

    </main>
  );
}

export default Coleccion;