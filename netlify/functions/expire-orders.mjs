import process from 'node:process';
import { createRpc } from '../../server/orders/supabase.mjs';
import { expireOrders } from '../../server/orders/expiration.mjs';

export default async () => {
  if (process.env.ORDERS_EXPIRATION_ENABLED !== 'true') return;
  try {
    const stats = await expireOrders({ rpc: createRpc({ env: process.env }), log: (record) => console.log(JSON.stringify(record)) });
    if (stats.failed || stats.deferred || stats.candidates === 500) {
      // El lote ya se intentó completo dentro del presupuesto. Señalar problemas
      // al monitoreo de Netlify sin impedir que el siguiente minuto reintente.
      throw new Error('EXPIRATION_REQUIRES_ATTENTION');
    }
  } catch {
    console.error(JSON.stringify({ event: 'orders_expiration_attention', code: 'UNAVAILABLE_OR_BACKLOG' }));
    throw new Error('EXPIRATION_REQUIRES_ATTENTION');
  }
};

// Netlify no expone una URL pública para una Scheduled Function.
export const config = { schedule: '* * * * *' };
