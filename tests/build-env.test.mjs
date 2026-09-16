import assert from "node:assert/strict";
import test from "node:test";
import { build } from "vite";
import { verificarEntornoBuild } from "../herramientas/verificar-entorno-build.mjs";

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
  assert.ok(!codigo.includes(variables.VITE_TURNSTILE_SITE_KEY));
});
