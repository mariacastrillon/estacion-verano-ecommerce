import { Routes, Route } from "react-router-dom";

import Inicio from "./pages/Inicio.jsx";
import Coleccion from "./pages/Coleccion.jsx";
import ProductoDetalle from "./pages/ProductoDetalle.jsx";
import Favoritos from "./pages/Favoritos.jsx";

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

    </Routes>
  );
}

export default App;