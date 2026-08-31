import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";

import { FavoritosProvider } from "./context/FavoritosContext.jsx";
import { WhatsAppProvider } from "./context/WhatsAppContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FavoritosProvider>
      <WhatsAppProvider>

      <BrowserRouter>

        <App />

      </BrowserRouter>

      </WhatsAppProvider>

    </FavoritosProvider>
  </StrictMode>
);
