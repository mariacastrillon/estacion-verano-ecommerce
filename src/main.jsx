import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";

import { FavoritosProvider } from "./context/FavoritosContext.jsx";
import { CarritoProvider } from "./context/CarritoContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FavoritosProvider>
      <CarritoProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CarritoProvider>
    </FavoritosProvider>
  </StrictMode>
);
