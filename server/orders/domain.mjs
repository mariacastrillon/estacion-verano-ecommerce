export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIZES = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA']);

const messages = {
  INVALID_REQUEST: 'Revisa los productos, tallas y cantidades del pedido.',
  SESSION_REQUIRED: 'La sesión de reserva no está disponible. No se ha enviado un pedido nuevo.',
  FORBIDDEN: 'No se pudo validar la solicitud.',
  NOT_FOUND: 'No encontramos ese pedido en tu sesión.',
  DISABLED: 'Las reservas no están habilitadas en este entorno.',
  INSUFFICIENT_STOCK: 'Ya no hay suficientes prendas para esta selección. Revisa el carrito.',
  INVALID_SELECTION: 'Una selección dejó de estar disponible. Revisa el carrito.',
  IDEMPOTENCY_CONFLICT: 'Este intento pertenece a otra selección. Recupera el pedido antes de volver a reservar.',
  INVALID_TRANSITION: 'El pedido ya no permite esta operación.',
  UNAVAILABLE: 'No pudimos confirmar el resultado. Reintenta el mismo pedido; no crees otro intento.',
  RATE_LIMITED: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
};
export class OrderError extends Error {
  constructor(code = 'UNAVAILABLE', status = 503) {
    super(messages[code] ?? messages.UNAVAILABLE);
    this.code = code;
    this.status = status;
  }
}
export function exactObject(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
export function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 10) throw new OrderError('INVALID_REQUEST', 400);
  const seen = new Set();
  let total = 0;
  const result = items.map((item) => {
    if (!exactObject(item, ['product_id', 'variant_id', 'display_size', 'quantity'])
      || typeof item.product_id !== 'string' || !item.product_id.trim() || item.product_id.length > 200
      || typeof item.variant_id !== 'string' || !UUID.test(item.variant_id)
      || !SIZES.has(item.display_size) || !Number.isInteger(item.quantity)
      || item.quantity < 1 || item.quantity > 10) throw new OrderError('INVALID_REQUEST', 400);
    const variant = item.variant_id.toLowerCase();
    const key = `${variant}:${item.display_size}`;
    if (seen.has(key)) throw new OrderError('INVALID_REQUEST', 400);
    seen.add(key); total += item.quantity;
    return { product_id: item.product_id, variant_id: variant, display_size: item.display_size, quantity: item.quantity };
  });
  if (total > 20) throw new OrderError('INVALID_REQUEST', 400);
  return result.sort((a, b) => `${a.variant_id}:${a.display_size}`.localeCompare(`${b.variant_id}:${b.display_size}`));
}

// Reconstruir por lista permitida; nunca reenviar objetos de Supabase completos.
export function publicOrder(data) {
  if (!data || typeof data !== 'object' || !UUID.test(data.id)
    || !['pending', 'confirmed', 'cancelled', 'completed'].includes(data.status)
    || data.currency !== 'COP' || !Number.isFinite(Date.parse(data.expires_at))
    || !Number.isSafeInteger(data.total_cop) || data.total_cop < 0
    || !Array.isArray(data.items) || !data.items.length || data.items.length > 20) throw new OrderError();
  const items = data.items.map((item) => {
    if (!item || typeof item.product_id !== 'string' || !UUID.test(item.variant_id)
      || !SIZES.has(item.display_size) || !Number.isInteger(item.quantity) || item.quantity < 1
      || !Number.isSafeInteger(item.unit_price_cop) || item.unit_price_cop < 0
      || typeof item.product_name !== 'string' || typeof item.variant_name !== 'string') throw new OrderError();
    return { product_id: item.product_id, variant_id: item.variant_id, display_size: item.display_size,
      quantity: item.quantity, product_name: item.product_name, variant_name: item.variant_name, unit_price_cop: item.unit_price_cop };
  });
  return { id: data.id, status: data.status, expires_at: data.expires_at, currency: 'COP',
    cancellation_reason: ['requested', 'expired'].includes(data.cancellation_reason) ? data.cancellation_reason : null,
    total_cop: data.total_cop, items };
}
