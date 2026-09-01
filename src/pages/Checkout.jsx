import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";

function Checkout() {
  return <main className="min-h-screen bg-slate-950 text-white">
    <Navbar />
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-3xl font-light md:text-5xl">Próximamente</h1>
      <p className="mt-5 text-lg text-slate-300">Próximamente podrás completar tu compra aquí.</p>
      <Link to="/carrito" className="mt-8 inline-flex border border-[#DCCDA4] px-7 py-3 text-[#DCCDA4] transition hover:bg-[#DCCDA4] hover:text-slate-950">Volver al carrito</Link>
    </section>
  </main>;
}

export default Checkout;
