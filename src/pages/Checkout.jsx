import { useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import WhatsAppButton from "../components/WhatsAppButton.jsx";
import { crearMensajeCarritoWhatsApp } from "../config/whatsapp.js";
import { useCarrito } from "../hooks/useCarrito.js";

function Checkout() {
  const { lineas, revalidar, verificandoStock, puedeFinalizar, errorInventario } = useCarrito();
  useEffect(() => { revalidar(); }, [revalidar]);
  return <main className="min-h-screen bg-slate-950 text-white">
    <Navbar />
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-3xl font-light md:text-5xl">{puedeFinalizar ? "Próximamente" : "Verificando tu carrito"}</h1>
      {puedeFinalizar ? <div className="mt-5 text-lg text-slate-300"><p>Próximamente podrás completar tu compra aquí.<br />Esta revisión de stock no reserva prendas.</p><p className="mt-6">Mientras tanto, puedes finalizar tu compra por WhatsApp.<br />Revisaremos contigo la disponibilidad final y los datos del pedido antes de confirmarlo.</p></div> : <div role="alert" className="mt-5 text-lg text-amber-200"><p>{verificandoStock ? "Verificando disponibilidad…" : errorInventario || "El carrito contiene una selección sin stock válido. Regresa para revisarla."}</p>{!verificandoStock && lineas.filter(({ invalida }) => invalida).map((linea) => <p key={`${linea.productoId}-${linea.varianteKey}-${linea.selectedSize}`} className="mt-2 text-sm">{linea.nombre} · {linea.selectedSize || "talla por confirmar"}: {linea.mensajeStock}</p>)}</div>}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {puedeFinalizar && <WhatsAppButton mensaje={crearMensajeCarritoWhatsApp(lineas)} className="inline-flex bg-[#DCCDA4] px-7 py-3 font-medium text-slate-950 transition hover:opacity-90">Finalizar por WhatsApp</WhatsAppButton>}
        <Link to="/carrito" className="inline-flex border border-[#DCCDA4] px-7 py-3 text-[#DCCDA4] transition hover:bg-[#DCCDA4] hover:text-slate-950">Volver al carrito</Link>
      </div>
    </section>
  </main>;
}

export default Checkout;
