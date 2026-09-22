import { useCallback, useEffect, useState } from 'react';
import { crearClientePedidos } from '../services/pedidos.js';
import { formatearCOP } from '../cart/carrito.js';
import { crearMensajeCarritoWhatsApp } from '../config/whatsapp.js';
import WhatsAppButton from './WhatsAppButton.jsx';

const estados = { pending: 'Reservado, pendiente de confirmación', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Completado' };

export default function CheckoutReservas({ lineas, puedeFinalizar, revalidar }) {
  const [cliente] = useState(() => crearClientePedidos({ storage: window.sessionStorage }));
  const [state, setState] = useState(() => { try { return cliente.load(); } catch { return null; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const order = state?.order;
  const activa = order && ['pending', 'confirmed'].includes(order.status);
  const operar = useCallback(async (accion) => {
    setBusy(true); setError('');
    try { setState(await accion()); }
    catch (e) {
      setError(e.message);
      try { setState(cliente.load()); } catch { /* No crear otro intento si el guardado es ilegible. */ }
    } finally { setBusy(false); await revalidar(); }
  }, [cliente, revalidar]);

  useEffect(() => {
    if (!activa) return;
    let mounted = true;
    const actualizar = async () => {
      try {
        const updated = await cliente.refresh();
        if (mounted) { setState(updated); await revalidar(); }
      } catch { if (mounted) setError('No pudimos actualizar el pedido. Puedes volver a intentarlo.'); }
    };
    void actualizar();
    const interval = setInterval(actualizar, 60000);
    return () => { mounted = false; clearInterval(interval); };
  }, [activa, cliente, revalidar]);

  const reiniciar = () => {
    try { cliente.reset(); setState(null); setError(''); }
    catch (e) { setError(e.message); }
  };
  const mensaje = order
    ? `Hola, quiero consultar el pedido ${order.id}. Estado: ${estados[order.status]}. Total: ${formatearCOP(order.total_cop * 100)}. No he realizado un pago.`
    : crearMensajeCarritoWhatsApp(lineas);
  return <section className="mt-8 rounded-2xl border border-[#DCCDA4] p-6 text-left" aria-label="Reserva de desarrollo">
    <h2 className="text-xl text-[#DCCDA4]">Reserva de prueba · desarrollo</h2>
    <p className="mt-2 text-sm text-slate-300">La reserva retiene las prendas durante 30 minutos. No se realizará ningún cobro.</p>
    {!state && !puedeFinalizar && <p className="mt-3 text-amber-200">Para reservar, vuelve al carrito y revisa que todas las tallas y cantidades estén disponibles.</p>}
    {error && <p role="alert" className="mt-4 text-amber-200">{error}</p>}
    {order ? <div className="mt-4" aria-live="polite">
      <p>Pedido: <span className="break-all">{order.id}</span></p>
      <p>{estados[order.status]}{order.cancellation_reason === 'expired' ? ' por vencimiento' : ''}</p>
      {activa && <p>Vence: {new Date(order.expires_at).toLocaleString('es-CO')}</p>}
      <ul className="my-4 space-y-2">{order.items.map((item) => <li key={`${item.variant_id}-${item.display_size}`}>
        {item.product_name} · {item.variant_name} · {item.display_size} × {item.quantity} — {formatearCOP(item.unit_price_cop * item.quantity * 100)}
      </li>)}</ul>
      <p>Total del servidor: {formatearCOP(order.total_cop * 100)}</p>
    </div> : state && <p className="mt-4 text-sm text-amber-200">El intento conserva las tallas y cantidades originales. Reintentar recupera ese pedido aunque haya cambiado el carrito.</p>}
    <div className="mt-5 flex flex-wrap gap-3">
      {!order && <button disabled={busy || (!state && !puedeFinalizar)} onClick={() => operar(() => cliente.reserve(lineas))}
        className="rounded-lg bg-[#DCCDA4] px-5 py-3 text-slate-950 disabled:opacity-50">{busy ? 'Procesando…' : state ? 'Reintentar el mismo pedido' : 'Confirmar reserva'}</button>}
      {activa && <button disabled={busy} onClick={() => operar(() => cliente.cancel())} className="rounded-lg border border-[#DCCDA4] px-5 py-3 disabled:opacity-50">Cancelar reserva</button>}
      {order && <button disabled={busy} onClick={() => operar(() => cliente.refresh())} className="rounded-lg border border-slate-500 px-5 py-3">Actualizar estado</button>}
      {((order && !activa) || state?.failure) && <button disabled={busy} onClick={reiniciar} className="rounded-lg border border-slate-500 px-5 py-3">Preparar otro pedido</button>}
      <WhatsAppButton mensaje={mensaje} className="rounded-lg border border-[#DCCDA4] px-5 py-3">Consultar por WhatsApp</WhatsAppButton>
    </div>
  </section>;
}
