import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import productos from "../data/productos.js";
import { CARRITO_STORAGE_KEY, agregarLinea, aplicarRevalidacion, cambiarCantidad, carritoPuedeFinalizar, crearClaveLinea, crearLineaCarrito, eliminarLinea, leerCarritoGuardado, puedeAgregarLinea, subtotalCarrito, totalUnidades } from "../cart/carrito.js";
import { revalidarDisponibilidadLineas } from "../services/inventarioPublico.js";
import { CarritoContext } from "./carrito-context.js";

export function CarritoProvider({ children }) {
  const [lineas, setLineas] = useState(() => leerCarritoGuardado(window.localStorage, productos));
  const lineasActuales = useRef(lineas);
  const revisionLineas = useRef(0);
  const [verificandoStock, setVerificandoStock] = useState(false);
  const [inventarioVerificado, setInventarioVerificado] = useState(false);
  const [errorInventario, setErrorInventario] = useState("");
  const [mensajeCantidad, setMensajeCantidad] = useState("");

  useEffect(() => { lineasActuales.current = lineas; revisionLineas.current += 1; }, [lineas]);

  useEffect(() => {
    try { window.localStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify(lineas)); } catch { /* La tienda sigue disponible. */ }
  }, [lineas]);

  const revalidar = useCallback(async () => {
    const pendientes = lineasActuales.current;
    const revision = revisionLineas.current;
    if (pendientes.length === 0) {
      setInventarioVerificado(true);
      setErrorInventario("");
      return true;
    }
    setVerificandoStock(true);
    try {
      const resultados = await revalidarDisponibilidadLineas(pendientes);
      if (revision !== revisionLineas.current) return false;
      const actualizadas = aplicarRevalidacion(pendientes, resultados);
      setLineas((actuales) => JSON.stringify(actuales) === JSON.stringify(actualizadas) ? actuales : actualizadas);
      setInventarioVerificado(true);
      setErrorInventario("");
      return carritoPuedeFinalizar(actualizadas, true);
    } catch {
      if (revision !== revisionLineas.current) return false;
      setInventarioVerificado(false);
      setErrorInventario("No pudimos verificar la disponibilidad en este momento. Intenta nuevamente.");
      return false;
    } finally {
      setVerificandoStock(false);
    }
  }, []);

  useEffect(() => {
    if (lineas.length > 0 && !inventarioVerificado && !verificandoStock && !errorInventario) revalidar();
  }, [lineas, inventarioVerificado, verificandoStock, errorInventario, revalidar]);

  const valor = useMemo(() => ({
    lineas,
    agregarProducto: (seleccion) => {
      const linea = crearLineaCarrito(seleccion);
      if (!puedeAgregarLinea(lineas, linea)) return false;
      setLineas((actuales) => agregarLinea(actuales, linea));
      setInventarioVerificado(false);
      setErrorInventario("");
      return true;
    },
    cambiarCantidad: (linea, cambio) => {
      const actuales = lineasActuales.current;
      const actualizadas = cambiarCantidad(actuales, crearClaveLinea(linea), cambio);
      if (actualizadas === actuales && cambio > 0) {
        setMensajeCantidad(linea.stockDisponible > 0
          ? `Solo quedan ${linea.stockDisponible} unidades disponibles.`
          : "No pudimos verificar el stock de esta talla.");
        return false;
      }
      setMensajeCantidad("");
      setInventarioVerificado(false);
      setErrorInventario("");
      setLineas(actualizadas);
      return true;
    },
    eliminar: (linea) => { setLineas((actuales) => eliminarLinea(actuales, crearClaveLinea(linea))); setInventarioVerificado(false); setErrorInventario(""); },
    revalidar,
    verificandoStock,
    inventarioVerificado,
    errorInventario,
    mensajeCantidad,
    puedeFinalizar: carritoPuedeFinalizar(lineas, inventarioVerificado),
    totalUnidades: totalUnidades(lineas),
    subtotal: subtotalCarrito(lineas),
  }), [errorInventario, inventarioVerificado, lineas, mensajeCantidad, revalidar, verificandoStock]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}
