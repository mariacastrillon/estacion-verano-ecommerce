import { useEffect, useMemo, useState } from "react";
import { CARRITO_STORAGE_KEY, agregarLinea, cambiarCantidad, crearClaveLinea, crearLineaCarrito, eliminarLinea, leerCarritoGuardado, subtotalCarrito, totalUnidades } from "../cart/carrito.js";
import { CarritoContext } from "./carrito-context.js";

export function CarritoProvider({ children }) {
  const [lineas, setLineas] = useState(() => leerCarritoGuardado(window.localStorage));

  useEffect(() => {
    try { window.localStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify(lineas)); } catch { /* La tienda sigue disponible. */ }
  }, [lineas]);

  const valor = useMemo(() => ({
    lineas,
    agregarProducto: (seleccion) => {
      const linea = crearLineaCarrito(seleccion);
      if (!linea) return false;
      setLineas((actuales) => agregarLinea(actuales, linea));
      return true;
    },
    cambiarCantidad: (linea, cambio) => setLineas((actuales) => cambiarCantidad(actuales, crearClaveLinea(linea), cambio)),
    eliminar: (linea) => setLineas((actuales) => eliminarLinea(actuales, crearClaveLinea(linea))),
    totalUnidades: totalUnidades(lineas),
    subtotal: subtotalCarrito(lineas),
  }), [lineas]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}
