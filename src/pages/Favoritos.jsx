import { Link } from "react-router-dom";
import { useFavoritos } from "../context/FavoritosContext";
import productos from "../data/productos";
import ProductoCard from "../components/ProductoCard";
import Navbar from "../components/Navbar";

function Favoritos() {
  const { favoritos } = useFavoritos();

  const productosFavoritos = productos.filter((producto) =>
    favoritos.includes(producto.id)
  );

  return (
    <main className="min-h-screen bg-[#08131F] text-white">
        <Navbar />

      <section className="max-w-7xl mx-auto px-6 py-20">

        <h1 className="text-5xl font-light tracking-[0.15em] text-center mb-5">
          Mis Favoritos
        </h1>

        <p className="text-center text-slate-300 mb-16">
          Guarda aquí los diseños que más te gusten para volver a verlos cuando quieras.
        </p>

        {productosFavoritos.length === 0 ? (

          <div className="text-center py-24">

            <div className="text-7xl mb-8">
              🤍
            </div>

            <h2 className="text-3xl font-light mb-4">
              Aún no tienes favoritos
            </h2>

            <p className="text-slate-400 mb-10">
              Cuando marques un diseño con el corazón aparecerá aquí automáticamente.
            </p>

            <Link to="/coleccion">

              <button className="bg-[#DCCDA4] text-slate-900 px-10 py-4 rounded-full hover:scale-105 transition-all duration-300 font-medium">

                Explorar colección

              </button>

            </Link>

          </div>

        ) : (

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">

            {productosFavoritos.map((producto) => (

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

export default Favoritos;