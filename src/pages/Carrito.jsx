import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { formatearCOP, precioACentavos } from "../cart/carrito.js";
import { useCarrito } from "../hooks/useCarrito.js";

function Carrito() {
  const navigate = useNavigate();
  const { lineas, cambiarCantidad, eliminar, subtotal, revalidar, verificandoStock, errorInventario, mensajeCantidad, puedeFinalizar } = useCarrito();
  const [mensajeCheckout, setMensajeCheckout] = useState("");
  useEffect(() => { revalidar(); }, [revalidar]);
  const finalizar = async () => {
    setMensajeCheckout("");
    if (await revalidar()) navigate("/checkout");
    else setMensajeCheckout("Revisa la disponibilidad indicada antes de continuar.");
  };
  return <main className="min-h-screen bg-slate-950 text-white">
    <Navbar />
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="mb-8 text-3xl font-light md:text-5xl">Tu carrito</h1>
      {lineas.length === 0 ? <div className="border-t border-slate-800 py-16 text-center">
        <h2 className="mb-6 text-2xl font-light">Tu carrito está vacío</h2>
        <Link to="/coleccion" className="inline-flex bg-[#DCCDA4] px-7 py-3 font-medium text-slate-950 transition hover:opacity-90">Ver colección</Link>
      </div> : <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="divide-y divide-slate-800 border-y border-slate-800">
          {lineas.map((linea) => <article key={`${linea.productoId}-${linea.varianteKey}-${linea.selectedSize}`} className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:gap-6">
            <img src={linea.imagen} alt={linea.nombre} className="h-28 w-[92px] object-cover sm:h-40 sm:w-[132px]" />
            <div className="min-w-0">
              <h2 className="text-lg font-medium sm:text-xl">{linea.nombre}</h2>
              {linea.varianteNombre && <p className="mt-1 text-sm text-slate-400">Color: {linea.varianteNombre}</p>}
              {linea.selectedSize && <p className="text-sm text-slate-400">Talla: {linea.selectedSize}</p>}
              {linea.mensajeStock && <p className={`mt-2 text-sm ${linea.invalida ? "text-red-300" : "text-amber-200"}`}>{linea.mensajeStock}</p>}
              <p className="mt-3 text-[#DCCDA4]">{formatearCOP(precioACentavos(linea.precio))}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-10 grid-cols-[40px_42px_40px] items-center border border-slate-700" aria-label={`Cantidad de ${linea.nombre}`}>
                  <button type="button" onClick={() => cambiarCantidad(linea, -1)} disabled={linea.cantidad === 1} aria-label="Disminuir cantidad" className="h-full text-xl disabled:cursor-not-allowed disabled:opacity-35">−</button>
                  <span className="text-center" aria-live="polite">{linea.cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(linea, 1)} aria-label="Aumentar cantidad" className="h-full text-xl">+</button>
                </div>
                <button type="button" onClick={() => eliminar(linea)} className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">Eliminar</button>
              </div>
            </div>
            <p className="col-start-2 text-right font-medium sm:col-start-3 sm:row-start-1">{formatearCOP(precioACentavos(linea.precio) * linea.cantidad)}</p>
          </article>)}
        </div>
        <aside className="h-fit border-t border-slate-700 py-6 lg:sticky lg:top-6">
          <div className="mb-7 flex items-baseline justify-between gap-4"><span className="text-lg">Subtotal</span><strong className="text-2xl text-[#DCCDA4]">{formatearCOP(subtotal)}</strong></div>
          {(errorInventario || mensajeCheckout || mensajeCantidad) && <p role="alert" className="mb-4 text-sm text-red-300">{errorInventario || mensajeCheckout || mensajeCantidad}</p>}
          {!puedeFinalizar && lineas.some(({ invalida }) => invalida) && <p className="mb-4 text-sm text-amber-200">Revisa los productos señalados antes de continuar.</p>}
          {puedeFinalizar && <p className="mb-4 text-xs text-slate-400">La disponibilidad puede cambiar; esto todavía no reserva las prendas.</p>}
          <button type="button" disabled={verificandoStock || !puedeFinalizar} onClick={finalizar} className="flex w-full justify-center bg-[#DCCDA4] px-6 py-4 font-medium text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{verificandoStock ? "Verificando…" : "Finalizar compra"}</button>
          <Link to="/coleccion" className="mt-4 flex w-full justify-center border border-slate-600 px-6 py-4 transition hover:border-[#DCCDA4] hover:text-[#DCCDA4]">Continuar comprando</Link>
        </aside>
      </div>}
    </section>
  </main>;
}

export default Carrito;
