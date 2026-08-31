import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { crearUrlWhatsApp } from "../config/whatsapp";
import WhatsAppContext from "./whatsappContextBase";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_ACTION = "whatsapp_purchase";
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_SITE_KEY = import.meta.env.DEV
  ? TURNSTILE_TEST_SITE_KEY
  : import.meta.env.VITE_TURNSTILE_SITE_KEY;
const AUTHORIZATION_URL = "/api/turnstile/authorization";

let promesaScriptTurnstile;

function cargarTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (promesaScriptTurnstile) return promesaScriptTurnstile;

  promesaScriptTurnstile = new Promise((resolve, reject) => {
    const existente = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    const script = existente ?? document.createElement("script");

    const comprobarCarga = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile no quedó disponible."));
    };

    script.addEventListener("load", comprobarCarga, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("No se pudo cargar Turnstile.")),
      { once: true }
    );

    if (!existente) {
      script.src = TURNSTILE_SCRIPT_URL;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    promesaScriptTurnstile = undefined;
    throw error;
  });

  return promesaScriptTurnstile;
}

async function leerRespuesta(respuesta) {
  const contenido = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(contenido.error || "No pudimos completar la verificación.");
  }
  return contenido;
}

function navegarPopup(popup, url) {
  if (popup && !popup.closed) {
    popup.opener = null;
    popup.location.replace(url);
    return true;
  }
  return false;
}

export function WhatsAppProvider({ children }) {
  const contenedorRef = useRef(null);
  const widgetRef = useRef(null);
  const [pendiente, setPendiente] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState("");
  const [urlManual, setUrlManual] = useState("");

  const cerrar = useCallback(() => {
    pendiente?.popup?.close();
    setPendiente(null);
    setError("");
    setUrlManual("");
  }, [pendiente]);

  const completar = useCallback((url, popup) => navegarPopup(popup, url), []);

  const verificarToken = useCallback(
    async (token) => {
      setVerificando(true);
      setError("");

      try {
        const respuesta = await fetch(AUTHORIZATION_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        await leerRespuesta(respuesta);
        if (completar(pendiente.url, pendiente.popup)) setPendiente(null);
        else setUrlManual(pendiente.url);
      } catch (errorVerificacion) {
        pendiente?.popup?.close();
        setPendiente((actual) =>
          actual ? { ...actual, popup: null } : actual
        );
        setError(errorVerificacion.message);
        if (widgetRef.current !== null && window.turnstile) {
          window.turnstile.reset(widgetRef.current);
        }
      } finally {
        setVerificando(false);
      }
    },
    [completar, pendiente]
  );

  useEffect(() => {
    if (!pendiente || urlManual || !contenedorRef.current) return undefined;
    let cancelado = false;

    cargarTurnstile()
      .then((turnstile) => {
        if (cancelado || !contenedorRef.current) return;
        widgetRef.current = turnstile.render(contenedorRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: TURNSTILE_ACTION,
          appearance: "interaction-only",
          execution: "execute",
          theme: "dark",
          language: "es",
          callback: verificarToken,
          "error-callback": () => {
            setError("No pudimos realizar la verificación. Intenta nuevamente.");
          },
          "expired-callback": () => {
            setError("La verificación expiró. Intenta nuevamente.");
          },
        });
        turnstile.execute(widgetRef.current);
      })
      .catch((errorCarga) => setError(errorCarga.message));

    return () => {
      cancelado = true;
      if (widgetRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [pendiente, urlManual, verificarToken]);

  const abrirWhatsApp = useCallback(async (mensaje = "") => {
    const url = crearUrlWhatsApp(mensaje);
    const popup = window.open("", "_blank");
    if (popup) popup.opener = null;
    setError("");
    setUrlManual("");

    try {
      const respuesta = await fetch(AUTHORIZATION_URL, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const autorizacion = await leerRespuesta(respuesta);

      if (autorizacion.authorized) {
        if (!completar(url, popup)) {
          setPendiente({ url, popup: null });
          setUrlManual(url);
        }
        return;
      }
    } catch {
      // Si no hay autorización vigente, se solicita un desafío nuevo.
    }

    setPendiente({ url, popup });
  }, [completar]);

  return (
    <WhatsAppContext.Provider value={{ abrirWhatsApp }}>
      {children}

      {pendiente && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-verificacion-whatsapp"
            className="relative w-full max-w-md rounded-3xl border border-[#DCCDA4]/40 bg-[#102A2A] p-7 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar verificación"
              className="absolute right-4 top-3 h-9 w-9 rounded-full text-xl text-slate-400 hover:bg-white/10 hover:text-white"
            >
              &times;
            </button>

            <h2 id="titulo-verificacion-whatsapp" className="mb-3 text-2xl font-light">
              Verificación de seguridad
            </h2>
            <p className="mb-5 text-sm text-slate-300">
              Confirma que eres una persona para continuar a WhatsApp.
            </p>

            {!urlManual && <div ref={contenedorRef} className="min-h-16" />}
            {verificando && <p className="mt-4 text-sm text-slate-300">Verificando…</p>}
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

            {urlManual && (
              <a
                href={urlManual}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPendiente(null)}
                className="mt-5 inline-block rounded-full bg-[#DCCDA4] px-7 py-3 font-medium text-slate-900"
              >
                Continuar a WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </WhatsAppContext.Provider>
  );
}
