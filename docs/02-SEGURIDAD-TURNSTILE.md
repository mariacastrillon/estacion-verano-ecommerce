# Seguridad de WhatsApp con Turnstile

## Configuración de producción

El widget real de Cloudflare debe autorizar únicamente estos hostnames:

- `estacionverano.com`
- `www.estacionverano.com`

Netlify necesita estas variables:

- `VITE_TURNSTILE_SITE_KEY`: clave pública, disponible durante el build.
- `TURNSTILE_SECRET_KEY`: secreto disponible únicamente para Functions.
- `TURNSTILE_SESSION_SECRET`: secreto independiente disponible únicamente para Functions.

Los dos secretos no deben usar el prefijo `VITE_` ni guardarse en el repositorio.

## Desarrollo local

El código selecciona automáticamente las claves oficiales de prueba de Cloudflare
cuando Vite y Netlify Functions se ejecutan en modo local. No se debe autorizar
`localhost` ni `127.0.0.1` en el widget real.

Para probar la página y la Function juntas se necesita Netlify CLI:

```powershell
npx netlify dev
```

La URL local configurada es `http://localhost:8888`. Ejecutar Vite directamente en
el puerto 5173 sirve la interfaz, pero no emula la Netlify Function.

## Autorización temporal

Después de una validación correcta se crea una cookie firmada durante 10 minutos.
En producción usa `HttpOnly`, `Secure` y `SameSite=Lax`. La cookie solo contiene
versión y expiración; nunca contiene el token de Turnstile ni secretos.

Cada solicitud POST valida siempre el token con Siteverify. La cookie se consulta
por GET únicamente para reutilizar una autorización ya obtenida.

## CSP

Turnstile está permitido exclusivamente desde `https://challenges.cloudflare.com`
en `script-src`, `frame-src` y `connect-src`.

No se permite `unsafe-eval`. La única excepción inline es
`style-src-attr 'unsafe-inline'`, necesaria para conservar el zoom dinámico existente en
`ProductoDetalle`; los elementos `<style>` continúan limitados a archivos del
mismo origen mediante `style-src-elem 'self'`.
