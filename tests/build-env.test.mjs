import assert from "node:assert/strict";
import test from "node:test";
import { build } from "vite";
import { verificarEntornoBuild } from "../herramientas/verificar-entorno-build.mjs";
import { readFile } from 'node:fs/promises';

const entorno = {
  VITE_SUPABASE_URL: "https://build-check.supabase.co/",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_build_check",
};
const chunk = (code) => ({ app: { type: "chunk", code } });

test("el check falla cuando falta configuracion o el bundle pierde un valor", () => {
  assert.throws(() => verificarEntornoBuild({}, {}), /Falta VITE_SUPABASE_URL/);
  assert.throws(() => verificarEntornoBuild({ VITE_SUPABASE_URL: entorno.VITE_SUPABASE_URL },
    chunk(entorno.VITE_SUPABASE_URL)), /Falta VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.throws(() => verificarEntornoBuild(entorno, chunk(entorno.VITE_SUPABASE_PUBLISHABLE_KEY)),
    /no contiene el valor de VITE_SUPABASE_URL/);
  assert.throws(() => verificarEntornoBuild(entorno, chunk(entorno.VITE_SUPABASE_URL)),
    /no contiene el valor de VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.throws(() => verificarEntornoBuild(entorno, {
    asset: { type: "asset", source: Object.values(entorno).join(" ") },
  }), /no contiene/);
});

test("el build real incrusta URL y clave publica sin filtrar la clave secreta", async (t) => {
  const variables = {
    ...entorno,
    SUPABASE_SECRET_KEY: "sb_secret_build_check_never_public",
    SUPABASE_SERVICE_ROLE_KEY: "service_role_build_check_never_public",
    ORDERS_SESSION_SECRET: "orders_session_secret_never_public_1234567890",
    ORDERS_API_ENABLED: "true",
    VITE_ORDERS_DEV: "true",
    VITE_TURNSTILE_SITE_KEY: "turnstile_build_check_unused",
  };
  for (const [nombre, valor] of Object.entries(variables)) {
    const anterior = process.env[nombre];
    process.env[nombre] = valor;
    t.after(() => {
      if (anterior === undefined) delete process.env[nombre];
      else process.env[nombre] = anterior;
    });
  }
  const resultado = await build({ envDir: false, logLevel: "error", build: { write: false } });
  const codigo = resultado.output.filter((archivo) => archivo.type === "chunk")
    .map((archivo) => archivo.code).join("\n");
  assert.ok(codigo.includes(entorno.VITE_SUPABASE_URL.replace(/\/$/, "")));
  assert.ok(codigo.includes(entorno.VITE_SUPABASE_PUBLISHABLE_KEY));
  assert.ok(!codigo.includes(variables.SUPABASE_SECRET_KEY));
  assert.ok(!codigo.includes(variables.SUPABASE_SERVICE_ROLE_KEY));
  assert.ok(!codigo.includes(variables.ORDERS_SESSION_SECRET));
  assert.ok(!codigo.includes('/api/pedidos/'));
  assert.ok(!codigo.includes('reserve_order'));
  assert.ok(!codigo.includes('Reserva de prueba'));
  assert.ok(!codigo.includes(variables.VITE_TURNSTILE_SITE_KEY));
  const headers = resultado.output.find((archivo) => archivo.fileName === '_headers');
  assert.ok(headers, 'Todo build debe incluir la CSP de Netlify');
  assert.equal(headers.source, "/*\n  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://rymnnyzpsngnmnoeilne.supabase.co; frame-src 'none'; manifest-src 'self'; upgrade-insecure-requests\n");
});

test('Netlify Dev no lee los headers del build ni hereda CSP del TOML', async () => {
  const toml = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.doesNotMatch(toml, /^\s*Content-Security-Policy\s*=/m);
  assert.match(toml, /\[dev\][\s\S]*?publish = "public"/);
  assert.match(toml, /\[context\.dev\][\s\S]*?publish = "public"/);
  assert.match(toml, /\[build\][\s\S]*?publish = "dist"/);
  await assert.rejects(readFile(new URL('../public/_headers', import.meta.url)), { code: 'ENOENT' });
});
