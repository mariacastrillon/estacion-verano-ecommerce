import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import Inicio from "./pages/Inicio.jsx";
import Coleccion from "./pages/Coleccion.jsx";
import ProductoDetalle from "./pages/ProductoDetalle.jsx";
import Favoritos from "./pages/Favoritos.jsx";
import Carrito from "./pages/Carrito.jsx";
import Checkout from "./pages/Checkout.jsx";

const GestorCatalogo = import.meta.env.DEV
  ? lazy(() => import("./pages/gestor/GestorCatalogo.jsx"))
  : null;

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={<Inicio />}
      />

      {/* Colección completa */}

      <Route
        path="/coleccion"
        element={<Coleccion />}
      />

      {/* Categorías */}

      <Route
        path="/coleccion/:categoria"
        element={<Coleccion />}
      />

      <Route
        path="/favoritos"
        element={<Favoritos />}
      />

      <Route
        path="/producto/:id"
        element={<ProductoDetalle />}
      />

      <Route path="/carrito" element={<Carrito />} />
      <Route path="/checkout" element={<Checkout />} />

      {GestorCatalogo && (
        <Route
          path="/gestor"
          element={
            <Suspense fallback={<main className="min-h-screen bg-slate-950 p-10 text-white">Cargando gestor…</main>}>
              <GestorCatalogo />
            </Suspense>
          }
        />
      )}

    </Routes>
  );
}

export default App;
