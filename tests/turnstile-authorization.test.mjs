import assert from "node:assert/strict";
import test from "node:test";
import {
  COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  TURNSTILE_ACTION,
  crearSesion,
  manejarSolicitud,
  validarSesion,
} from "../netlify/functions/turnstile-authorization.mjs";

const AHORA = Date.parse("2026-08-31T18:00:00.000Z");
const ENV_PRODUCCION = {
  CONTEXT: "production",
  TURNSTILE_SECRET_KEY: "secret-turnstile-de-prueba-unitaria",
  TURNSTILE_SESSION_SECRET: "secret-sesion-unitaria-con-longitud-suficiente",
};

function solicitudPost(token = "token-valido") {
  return new Request("https://estacionverano.com/api/turnstile/authorization", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ token }),
  });
}

function respuestaSiteverify(sobrescribir = {}) {
  return async () =>
    new Response(
      JSON.stringify({
        success: true,
        hostname: "estacionverano.com",
        action: TURNSTILE_ACTION,
        challenge_ts: new Date(AHORA - 1000).toISOString(),
        "error-codes": [],
        ...sobrescribir,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
}

async function ejecutar(request, fetchImpl) {
  return manejarSolicitud(request, { ip: "203.0.113.10" }, {
    env: ENV_PRODUCCION,
    fetchImpl,
    ahora: AHORA,
  });
}

test("rechaza un token inválido", async () => {
  const respuesta = await ejecutar(
    solicitudPost("invalido"),
    respuestaSiteverify({ success: false, "error-codes": ["invalid-input-response"] })
  );
  assert.equal(respuesta.status, 403);
  assert.equal(respuesta.headers.has("set-cookie"), false);
});

test("rechaza un token usado o expirado aunque exista una sesión", async () => {
  const sesion = crearSesion(ENV_PRODUCCION.TURNSTILE_SESSION_SECRET, AHORA);
  const request = solicitudPost("token-repetido");
  request.headers.set("Cookie", `${COOKIE_NAME}=${sesion}`);
  const respuesta = await ejecutar(
    request,
    respuestaSiteverify({ success: false, "error-codes": ["timeout-or-duplicate"] })
  );
  assert.equal(respuesta.status, 403);
  assert.match((await respuesta.json()).error, /expiró|utilizada/);
});

test("rechaza hostname incorrecto", async () => {
  const respuesta = await ejecutar(
    solicitudPost(),
    respuestaSiteverify({ hostname: "sitio-ejemplo.net" })
  );
  assert.equal(respuesta.status, 403);
});

test("rechaza action incorrecta", async () => {
  const respuesta = await ejecutar(
    solicitudPost(),
    respuestaSiteverify({ action: "otra_accion" })
  );
  assert.equal(respuesta.status, 403);
});

test("rechaza challenge_ts vencido", async () => {
  const respuesta = await ejecutar(
    solicitudPost(),
    respuestaSiteverify({
      challenge_ts: new Date(AHORA - 5 * 60 * 1000 - 1).toISOString(),
    })
  );
  assert.equal(respuesta.status, 403);
});

test("acepta localmente la respuesta identificada por la clave oficial de prueba", async () => {
  const respuesta = await manejarSolicitud(solicitudPost("XXXX.DUMMY.TOKEN.XXXX"), {}, {
    env: { CONTEXT: "dev" },
    ahora: AHORA,
    fetchImpl: respuestaSiteverify({
      hostname: "example.com",
      action: undefined,
      metadata: { result_with_testing_key: true },
    }),
  });
  assert.equal(respuesta.status, 200);
  assert.doesNotMatch(respuesta.headers.get("set-cookie"), /Secure/);
});

test("el modo local no acepta una respuesta que no provenga de testing", async () => {
  const respuesta = await manejarSolicitud(solicitudPost(), {}, {
    env: { CONTEXT: "dev" },
    ahora: AHORA,
    fetchImpl: respuestaSiteverify({ metadata: undefined }),
  });
  assert.equal(respuesta.status, 403);
});

test("una validación correcta entrega cookie segura sin token ni secrets", async () => {
  const respuesta = await ejecutar(solicitudPost(), respuestaSiteverify());
  const cookie = respuesta.headers.get("set-cookie");
  assert.equal(respuesta.status, 200);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, new RegExp(`Max-Age=${SESSION_DURATION_SECONDS}`));
  assert.doesNotMatch(cookie, /token-valido/);
  assert.doesNotMatch(cookie, new RegExp(ENV_PRODUCCION.TURNSTILE_SECRET_KEY));
  assert.doesNotMatch(cookie, new RegExp(ENV_PRODUCCION.TURNSTILE_SESSION_SECRET));
});

test("la cookie autoriza durante la ventana y expira después", async () => {
  const sesion = crearSesion(ENV_PRODUCCION.TURNSTILE_SESSION_SECRET, AHORA);
  const requestVigente = new Request(
    "https://estacionverano.com/api/turnstile/authorization",
    { headers: { Cookie: `${COOKIE_NAME}=${sesion}` } }
  );
  const vigente = await manejarSolicitud(requestVigente, {}, {
    env: ENV_PRODUCCION,
    ahora: AHORA + (SESSION_DURATION_SECONDS - 1) * 1000,
  });
  assert.deepEqual(await vigente.json(), { authorized: true });

  const requestExpirada = new Request(
    "https://estacionverano.com/api/turnstile/authorization",
    { headers: { Cookie: `${COOKIE_NAME}=${sesion}` } }
  );
  const expirada = await manejarSolicitud(requestExpirada, {}, {
    env: ENV_PRODUCCION,
    ahora: AHORA + SESSION_DURATION_SECONDS * 1000,
  });
  assert.deepEqual(await expirada.json(), { authorized: false });
});

test("una firma alterada nunca autoriza", () => {
  const sesion = crearSesion(ENV_PRODUCCION.TURNSTILE_SESSION_SECRET, AHORA);
  assert.equal(
    validarSesion(`${sesion}alterada`, ENV_PRODUCCION.TURNSTILE_SESSION_SECRET, AHORA),
    false
  );
});

test("valida método, Content-Type, campos y tamaño", async () => {
  const put = await ejecutar(
    new Request("https://estacionverano.com/api/turnstile/authorization", {
      method: "PUT",
    })
  );
  assert.equal(put.status, 405);

  const tipo = await ejecutar(
    new Request("https://estacionverano.com/api/turnstile/authorization", {
      method: "POST",
      body: JSON.stringify({ token: "x" }),
    })
  );
  assert.equal(tipo.status, 415);

  const extra = await ejecutar(
    new Request("https://estacionverano.com/api/turnstile/authorization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "x", admin: true }),
    })
  );
  assert.equal(extra.status, 400);

  const grande = await ejecutar(solicitudPost("x".repeat(3000)));
  assert.equal(grande.status, 400);
});
