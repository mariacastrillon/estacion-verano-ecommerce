const STORAGE_KEY = 'verano_pedido_desarrollo_v1';
const messages = {
  INSUFFICIENT_STOCK: 'Ya no hay stock suficiente. Revisa el carrito antes de preparar otro pedido.',
  INVALID_SELECTION: 'Una selección ya no está disponible. Revisa el carrito.',
  INVALID_REQUEST: 'Revisa tallas y cantidades: máximo 10 líneas y 20 prendas por pedido.',
  SESSION_REQUIRED: 'Se perdió la sesión del pedido. No crees otra reserva; consulta por WhatsApp.',
  IDEMPOTENCY_CONFLICT: 'El intento pertenece a otra selección. Recupera el pedido antes de continuar.',
  INVALID_TRANSITION: 'El pedido ya no permite esta operación. Actualiza su estado.',
  NOT_FOUND: 'No encontramos el pedido en esta sesión.',
  DISABLED: 'Las reservas no están habilitadas o el vencimiento automático no está disponible.',
  RATE_LIMITED: 'Espera un minuto antes de volver a intentarlo.',
  UNAVAILABLE: 'No pudimos confirmar el resultado. Reintenta el mismo pedido para evitar duplicados.',
};
const definiteFailures = new Set(['INSUFFICIENT_STOCK', 'INVALID_SELECTION', 'INVALID_REQUEST']);
const active = (order) => order && ['pending', 'confirmed'].includes(order.status);

export function crearClientePedidos({ storage, fetchImpl = fetch, uuid = () => crypto.randomUUID() }) {
  let inFlight;
  function load() {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Si el estado persistido se corrompe, fallar cerrado sin crear otra reserva.
    const state = JSON.parse(raw);
    if (!state?.attempt_id || !Array.isArray(state.items)) throw new Error('No se pudo recuperar el intento guardado. Consulta por WhatsApp.');
    return state;
  }
  function save(state) {
    // Si no se puede persistir, no se envía una reserva nueva.
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
  async function call(path, payload) {
    let response, data;
    try {
      response = await fetchImpl(`/api/pedidos/${path}`, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
    } catch {
      const error = new Error(messages.UNAVAILABLE); error.code = 'UNAVAILABLE'; throw error;
    }
    // Netlify puede responder 429 con HTML, antes de ejecutar la Function.
    if (response.status === 429) {
      const error = new Error(messages.RATE_LIMITED); error.code = 'RATE_LIMITED'; throw error;
    }
    try { data = await response.json(); }
    catch { const error = new Error(messages.UNAVAILABLE); error.code = 'UNAVAILABLE'; throw error; }
    if (!response.ok) {
      const code = Object.hasOwn(messages, data?.error) ? data.error : 'UNAVAILABLE';
      const error = new Error(messages[code]); error.code = code; throw error;
    }
    if (path !== 'sesion' && (!data?.order?.id || !Array.isArray(data.order.items))) {
      const error = new Error(messages.UNAVAILABLE); error.code = 'UNAVAILABLE'; throw error;
    }
    return data;
  }
  function singleFlight(kind, work) {
    if (inFlight) {
      if (inFlight.kind === kind) return inFlight.promise;
      // Una actualización de estado no debe absorber una cancelación: esperar
      // la operación anterior y ejecutar después la acción solicitada.
      return inFlight.promise.catch(() => {}).then(() => singleFlight(kind, work));
    }
    const promise = work().finally(() => { if (inFlight?.promise === promise) inFlight = null; });
    inFlight = { kind, promise };
    return promise;
  }
  return {
    load,
    reserve(lineas) {
      return singleFlight('reserve', async () => {
        let state = load();
        if (!state) {
          await call('sesion', {});
          state = save({ attempt_id: uuid(), items: lineas.map((linea) => ({ product_id: linea.productoId,
            variant_id: linea.varianteId, display_size: linea.selectedSize, quantity: linea.cantidad })), order: null });
        }
        if (state.order) return state;
        try {
          const { order } = await call('reservar', { attempt_id: state.attempt_id, items: state.items });
          return save({ ...state, order, failure: null });
        } catch (error) {
          save({ ...state, failure: definiteFailures.has(error.code) ? error.code : null });
          throw error;
        }
      });
    },
    cancel() {
      return singleFlight('cancel', async () => {
        const state = load();
        if (!state?.order) throw new Error('Primero recupera el pedido creado.');
        const { order } = await call('cancelar', { order_id: state.order.id });
        return save({ ...state, order });
      });
    },
    refresh() {
      return singleFlight('refresh', async () => {
        const state = load();
        if (!state?.order) return state;
        const { order } = await call('estado', { order_id: state.order.id });
        return save({ ...state, order });
      });
    },
    reset() {
      if (inFlight) throw new Error('Espera a que termine la solicitud.');
      const state = load();
      if (state && (active(state.order) || (!state.order && !definiteFailures.has(state.failure)))) {
        throw new Error('Recupera o cancela el pedido antes de iniciar otro intento.');
      }
      storage.removeItem(STORAGE_KEY);
    },
  };
}
