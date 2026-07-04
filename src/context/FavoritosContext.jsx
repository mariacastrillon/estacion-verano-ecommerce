import { createContext, useContext, useEffect, useState } from "react";

const FavoritosContext = createContext();

export function FavoritosProvider({ children }) {
  const [favoritos, setFavoritos] = useState(() => {
    const guardados = localStorage.getItem("favoritos");

    return guardados ? JSON.parse(guardados) : [];
  });

  useEffect(() => {
    localStorage.setItem(
      "favoritos",
      JSON.stringify(favoritos)
    );
  }, [favoritos]);

  const esFavorito = (id) => {
    return favoritos.includes(id);
  };

  const toggleFavorito = (id) => {
    setFavoritos((actuales) => {
      if (actuales.includes(id)) {
        return actuales.filter((item) => item !== id);
      }

      return [...actuales, id];
    });
  };

  return (
    <FavoritosContext.Provider
      value={{
        favoritos,
        esFavorito,
        toggleFavorito,
      }}
    >
      {children}
    </FavoritosContext.Provider>
  );
}

export function useFavoritos() {
  return useContext(FavoritosContext);
}