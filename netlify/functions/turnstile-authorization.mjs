import { createHmac, timingSafeEqual } from "node:crypto";

export const TURNSTILE_ACTION = "whatsapp_purchase";
export const SESSION_DURATION_SECONDS = 10 * 60;
export const COOKIE_NAME = "ev_turnstile_auth";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const LOCAL_SESSION_SECRET =
  "estacion-verano-local-session-secret-not-used-in-production";
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY_BYTES = 4096;
const TOKEN_MAX_LENGTH = 2048;
const TOKEN_MAX_AGE_MS = 5 * 60 * 1000;
const SITEVERIFY_TIMEOUT_MS = 5000;
const PRODUCTION_HOSTNAMES = new Set([
  "estacionverano.com",
  "www.estacionverano.com",
]);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

function json(estado, contenido, headers = {}) {
  return new Response(JSON.stringify(contenido), {
    status: estado,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function esDesarrolloLocal(env) {
  return env.NETLIFY_DEV === "true" || env.CONTEXT === "dev";
}

export function obtenerConfiguracion(env = process.env) {
  const local = esDesarrolloLocal(env);
  const turnstileSecret = local
    ? TURNSTILE_TEST_SECRET_KEY
    : env.TURNSTILE_SECRET_KEY;
  const sessionSecret = local
    ? LOCAL_SESSION_SECRET
    : env.TURNSTILE_SESSION_SECRET;

  if (!turnstileSecret || !sessionSecret) {
    throw new Error("Faltan variables de seguridad de Turnstile.");
  }

  return {
    local,
    turnstileSecret,
    sessionSecret,
    hostnames: local ? LOCAL_HOSTNAMES : PRODUCTION_HOSTNAMES,
  };
}

function codificarBase64Url(valor) {
  return Buffer.from(valor).toString("base64url");
}

function firmar(valor, secreto) {
  return createHmac("sha256", secreto).update(valor).digest("base64url");
}

export function crearSesion(secreto, ahora = Date.now()) {
  const payload = codificarBase64Url(
    JSON.stringify({ version: 1, exp: ahora + SESSION_DURATION_SECONDS * 1000 })
  );
  return `${payload}.${firmar(payload, secreto)}`;
}

export function validarSesion(sesion, secreto, ahora = Date.now()) {
  if (typeof sesion !== "string") return false;
  const [payload, firma, extra] = sesion.split(".");
  if (!payload || !firma || extra) return false;

  const firmaEsperada = Buffer.from(firmar(payload, secreto));
  const firmaRecibida = Buffer.from(firma);
  if (
    firmaEsperada.length !== firmaRecibida.length ||
    !timingSafeEqual(firmaEsperada, firmaRecibida)
  ) {
    return false;
  }

  try {
    const contenido = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      contenido.version === 1 &&
      Number.isFinite(contenido.exp) &&
      contenido.exp > ahora
    );
  } catch {
    return false;
  }
}

function obtenerCookie(request, nombre) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const parte of cookies.split(";")) {
    const [clave, ...valor] = parte.trim().split("=");
    if (clave === nombre) return valor.join("=");
  }
  return undefined;
}

function construirCookie(sesion, segura) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(sesion)}`,
    "Path=/",
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    segura ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function validarResultadoSiteverify(resultado, configuracion, ahora) {
  if (!resultado?.success) return false;

  if (configuracion.local) {
    if (resultado.metadata?.result_with_testing_key !== true) return false;
  } else {
    if (!configuracion.hostnames.has(resultado.hostname)) return false;
    if (resultado.action !== TURNSTILE_ACTION) return false;
  }

  const fechaDesafio = Date.parse(resultado.challenge_ts);
  if (!Number.isFinite(fechaDesafio)) return false;
  const edad = ahora - fechaDesafio;
  return edad >= -60_000 && edad <= TOKEN_MAX_AGE_MS;
}

export async function verificarTurnstile({
  token,
  remoteip,
  configuracion,
  fetchImpl = fetch,
  ahora = Date.now(),
}) {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), SITEVERIFY_TIMEOUT_MS);

  try {
    const cuerpo = new URLSearchParams({
      secret: configuracion.turnstileSecret,
      response: token,
    });
    if (remoteip) cuerpo.set("remoteip", remoteip);

    const respuesta = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      body: cuerpo,
      signal: controlador.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!respuesta.ok) throw new Error("Siteverify no respondió correctamente.");

    const resultado = await respuesta.json();
    return {
      valido: validarResultadoSiteverify(resultado, configuracion, ahora),
      codigos: Array.isArray(resultado["error-codes"])
        ? resultado["error-codes"]
        : [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function leerToken(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return { error: json(415, { error: "Content-Type debe ser application/json." }) };
  }

  const longitud = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(longitud) && longitud > MAX_BODY_BYTES) {
    return { error: json(413, { error: "La solicitud es demasiado grande." }) };
  }

  const texto = await request.text();
  if (Buffer.byteLength(texto, "utf8") > MAX_BODY_BYTES) {
    return { error: json(413, { error: "La solicitud es demasiado grande." }) };
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return { error: json(400, { error: "El cuerpo JSON no es válido." }) };
  }

  if (
    !cuerpo ||
    typeof cuerpo !== "object" ||
    Array.isArray(cuerpo) ||
    Object.keys(cuerpo).length !== 1 ||
    typeof cuerpo.token !== "string" ||
    cuerpo.token.length < 1 ||
    cuerpo.token.length > TOKEN_MAX_LENGTH
  ) {
    return { error: json(400, { error: "Token de Turnstile inválido." }) };
  }

  return { token: cuerpo.token };
}

export async function manejarSolicitud(
  request,
  context = {},
  { env = process.env, fetchImpl = fetch, ahora = Date.now() } = {}
) {
  let configuracion;
  try {
    configuracion = obtenerConfiguracion(env);
  } catch {
    return json(503, { error: "La verificación no está configurada." });
  }

  if (request.method === "GET") {
    const sesion = obtenerCookie(request, COOKIE_NAME);
    return json(200, {
      authorized: validarSesion(sesion, configuracion.sessionSecret, ahora),
    });
  }

  if (request.method !== "POST") {
    return json(405, { error: "Método no permitido." }, { Allow: "GET, POST" });
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return json(403, { error: "Origen de solicitud no permitido." });
  }

  const lectura = await leerToken(request);
  if (lectura.error) return lectura.error;

  try {
    const validacion = await verificarTurnstile({
      token: lectura.token,
      remoteip: context.ip,
      configuracion,
      fetchImpl,
      ahora,
    });

    if (!validacion.valido) {
      const duplicado = validacion.codigos.includes("timeout-or-duplicate");
      return json(403, {
        error: duplicado
          ? "La verificación expiró o ya fue utilizada. Intenta nuevamente."
          : "No pudimos validar la verificación. Intenta nuevamente.",
      });
    }

    const sesion = crearSesion(configuracion.sessionSecret, ahora);
    return json(
      200,
      { authorized: true, expiresIn: SESSION_DURATION_SECONDS },
      { "Set-Cookie": construirCookie(sesion, !configuracion.local) }
    );
  } catch {
    return json(502, {
      error: "El servicio de verificación no está disponible. Intenta nuevamente.",
    });
  }
}

export default (request, context) => manejarSolicitud(request, context);

export const config = {
  path: "/api/turnstile/authorization",
  rateLimit: {
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
