import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { OrderError, UUID } from './domain.mjs';

const DAY = 86400;
function secret(env) {
  if (typeof env.ORDERS_SESSION_SECRET !== 'string' || env.ORDERS_SESSION_SECRET.length < 32) throw new OrderError();
  return env.ORDERS_SESSION_SECRET;
}
function mac(value, env) { return createHmac('sha256', secret(env)).update(value).digest('base64url'); }
function cookieName(secure) { return secure ? '__Host-verano_orders' : 'verano_orders_dev'; }

export function readSession(request, env, now = Date.now()) {
  const secure = new URL(request.url).protocol === 'https:';
  const cookies = (request.headers.get('cookie') ?? '').split(';').map((part) => part.trim());
  const prefix = `${cookieName(secure)}=`;
  const value = cookies.find((part) => part.startsWith(prefix))?.slice(prefix.length);
  if (!value || value.length > 300) return null;
  const [id, expires, signature, extra] = value.split('.');
  if (extra || !UUID.test(id) || !/^\d{10}$/.test(expires) || !signature) return null;
  const expected = Buffer.from(mac(`session:${id}.${expires}`, env));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || Number(expires) <= now / 1000) return null;
  return { customerRef: `guest:${id}`, id, expires: Number(expires) };
}

export function createSession(request, env, now = Date.now()) {
  const id = randomUUID();
  const expires = Math.floor(now / 1000) + 7 * DAY;
  const secure = new URL(request.url).protocol === 'https:';
  const value = `${id}.${expires}.${mac(`session:${id}.${expires}`, env)}`;
  return `${cookieName(secure)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * DAY}${secure ? '; Secure' : ''}`;
}

// Version estable de UUID derivado. El cliente solo conserva un identificador
// de intento aleatorio; no puede elegir customer_ref ni la clave SQL efectiva.
export function idempotencyKey(session, attempt, env) {
  if (typeof attempt !== 'string' || !UUID.test(attempt)) throw new OrderError('INVALID_REQUEST', 400);
  const bytes = createHmac('sha256', secret(env)).update(`order:v1:${session.id}:${attempt.toLowerCase()}`).digest();
  bytes[6] = (bytes[6] & 15) | 0x50; bytes[8] = (bytes[8] & 63) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
