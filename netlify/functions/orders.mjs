import process from 'node:process';
import { createOrdersApi } from '../../server/orders/api.mjs';

export default (request, context) => createOrdersApi({ env: process.env,
  log: (record) => console.error(JSON.stringify(record)) })(request, context);

export const config = {
  path: ['/api/pedidos/sesion', '/api/pedidos/reservar', '/api/pedidos/cancelar', '/api/pedidos/estado'],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
