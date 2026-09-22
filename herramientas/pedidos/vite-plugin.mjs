import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { Readable } from 'node:stream';
import process from 'node:process';
import { createOrdersApi } from '../../server/orders/api.mjs';
import { createRpc } from '../../server/orders/supabase.mjs';
import { expireOrders } from '../../server/orders/expiration.mjs';
import { withLocalReservationTtl } from './reservation-ttl.mjs';

// Adaptador de desarrollo de los mismos handlers. No importa ni reutiliza el
// servidor administrativo y nunca se instala en vite build/preview.
async function loadLocalConfig() {
  // Permite verificar la UI sin iniciar reservas/expiraciones de la base local.
  // Un false explicito del proceso prevalece sobre el archivo privado.
  if (process.env.ORDERS_API_ENABLED === 'false') return {};
  try { return parseEnv(await readFile(new URL('../../.env.orders.local', import.meta.url), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return {}; }
}

export function pedidosDevPlugin({ loadConfig = loadLocalConfig, rpcFactory = createRpc,
  log = (record) => console.log(JSON.stringify(record)) } = {}) {
  let env = {};
  return {
    name: 'pedidos-solo-desarrollo',
    apply: 'serve',
    async config() {
      env = await loadConfig();
      env.CONTEXT = 'dev';
      return { define: { 'import.meta.env.VITE_ORDERS_DEV': JSON.stringify(env.ORDERS_API_ENABLED === 'true' ? 'true' : 'false') } };
    },
    configureServer(server) {
      if (env.ORDERS_API_ENABLED !== 'true') return;
      let running = false;
      let lastSuccess = 0;
      const tick = async () => {
        if (running || env.ORDERS_EXPIRATION_ENABLED !== 'true') return;
        running = true;
        try {
          const stats = await expireOrders({ rpc: rpcFactory({ env }), log });
          if (stats.failed === 0 && stats.deferred === 0) lastSuccess = Date.now();
        } catch { log({ event: 'orders_expiration_error', code: 'UNAVAILABLE' }); }
        finally { running = false; }
      };
      void tick();
      const timer = setInterval(tick, 60000);
      timer.unref();
      server.httpServer?.once('close', () => clearInterval(timer));
      let attempts = 0;
      let resetAt = 0;
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/pedidos/')) return next();
        // Un único proceso local y solo loopback; Netlify usa el rate limit de
        // plataforma, no este contador en memoria.
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
          res.writeHead(403); res.end(); return;
        }
        if (Date.now() >= resetAt) { attempts = 0; resetAt = Date.now() + 60000; }
        if (++attempts > 20) {
          res.writeHead(429, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' });
          res.end(JSON.stringify({ error: 'RATE_LIMITED', message: 'Espera un minuto antes de reintentar.' })); return;
        }
        try {
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method, headers: req.headers,
            ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
          });
          const healthyEnv = { ...env, ORDERS_EXPIRATION_ENABLED: env.ORDERS_EXPIRATION_ENABLED === 'true'
            && Date.now() - lastSuccess < 120000 ? 'true' : 'false' };
          const rpc = withLocalReservationTtl({ env: { ...env, NODE_ENV: process.env.NODE_ENV },
            rpc: rpcFactory({ env }), localDevelopment: true });
          const response = await createOrdersApi({ env: healthyEnv, rpc, log })(request);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: 'UNAVAILABLE', message: 'No pudimos confirmar el resultado. Reintenta el mismo pedido.' }));
        }
      });
    },
  };
}
