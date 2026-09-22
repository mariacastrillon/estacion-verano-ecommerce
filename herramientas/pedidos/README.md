# Backend de pedidos y vencimiento

Implementación preparada sin deploy, sin pagos y sin cambios SQL/RLS. El usuario
ya validó manualmente en Supabase el ciclo reserva/cancelación de la migración
`2026-09-21-orders-reservations.sql`; este bloque utiliza esas mismas RPC.
Las pruebas automáticas no usan credenciales reales ni se conectan a Supabase.

## Arquitectura

Netlify Functions recibe solicitudes del mismo origen, valida una sesión de
invitado firmada, llama las RPC con credencial privada y reconstruye un DTO
público por lista permitida. React solo consulta `/api/pedidos/*`.

`server/orders/` contiene el núcleo reutilizable, fuera de `src`. Hay dos
Functions: `orders.mjs` para las cuatro rutas HTTP y `expire-orders.mjs` para el
cron. No se importa el servidor administrativo 127.0.0.1:4174.

En desarrollo un plugin de Vite adapta los mismos handlers y ejecuta el worker
local cada minuto. Se activa exclusivamente al servir Vite; no existe en
`vite build` ni en `vite preview`. No hace falta instalar Netlify CLI ni producir
un deploy para probar pedidos. El checkout usa un import dinámico protegido por
`import.meta.env.DEV` y un flag local: el build de producción elimina el componente
y el cliente de reservas, incluso si `VITE_ORDERS_DEV=true` por error.

**Protección de esta entrega:** la API HTTP admite contextos `dev` y
`deploy-preview` con activación explícita. Rechaza `production` y `branch-deploy`
aunque el flag esté activo. La habilitación pública requiere una revisión futura
de ese guard en `server/orders/api.mjs`; no basta con cambiar una variable.
En previews, no habilitar reservas sin un worker independiente operativo sobre
la misma base de ensayo: Netlify no ejecuta allí el cron automáticamente.

## Rutas

Todas usan POST, JSON y `Cache-Control: no-store`:

| Ruta | Entrada | Respuesta |
| --- | --- | --- |
| `/api/pedidos/sesion` | `{}` | `{ok:true}` y cookie firmada si no hay sesión válida. |
| `/api/pedidos/reservar` | `{attempt_id, items:[{product_id,variant_id,display_size,quantity}]}` | `{order: DTO público}`. |
| `/api/pedidos/cancelar` | `{order_id}` | DTO tras `transition_order(...,'cancel')`. |
| `/api/pedidos/estado` | `{order_id}` | DTO actual; usa `transition_order(...,'expire')` para liberar también si ya venció. |

No hay rutas para enumerar pedidos, candidatos de expiración, completar ventas
ni modificar inventario. Consultar/cancelar utiliza la `customer_ref` de la
cookie: conocer un UUID de pedido no autoriza a acceder a él.

La respuesta solo incluye id de pedido, estado, vencimiento, moneda, motivo de
cancelación, total y líneas comerciales. No se reenvía el objeto original de
Supabase. Tampoco se exponen `physical_size`, `inventory_unit_id`, identidad de
cliente, errores SQL, `details`, `hint` ni secretos.

Errores conocidos de stock devuelven 409. Sesión ausente o inválida: 401;
pedido ajeno/inexistente: 404; entrada inválida: 400; contenido no JSON: 415;
cuerpo mayor de 16 KiB: 413; fallo o timeout de Supabase: 503 con mensaje fijo.
El servidor no registra cuerpos de solicitudes ni errores crudos de Supabase.

## Sesión, idempotencia y límites

La cookie contiene un UUID generado en servidor, vencimiento de siete días y
firma HMAC-SHA256. En HTTPS se llama `__Host-verano_orders`, con `Secure`,
`HttpOnly`, `SameSite=Strict`, `Path=/` y sin `Domain`. Solo en localhost HTTP se
usa `verano_orders_dev` sin Secure. No identifica legalmente a una persona: es
una sesión de invitado cuyo poseedor puede administrar sus pedidos.

Se valida `Origin` exacto contra `ORDERS_ALLOWED_ORIGIN`, el origen de la URL,
JSON y los metadatos Fetch. No se habilita CORS. Una petición de otro origen no
puede crear sesión ni reservar/cancelar usando la cookie de la tienda.

El checkout genera un UUID de intento y guarda las líneas originales en
`sessionStorage` **antes** de enviar la reserva. El servidor deriva el UUID SQL
de idempotencia con HMAC usando sesión + intento; el cliente no elige ni envía
`customer_ref` ni `idempotency_key`. La RPC conserva su unicidad por cliente.

El doble clic comparte una promesa. Tras timeout o recarga se reenvía el mismo
intento y las mismas líneas, aunque el carrito haya cambiado. Una cancelación
solicitada durante una consulta espera a esa consulta y después sí se ejecuta.
Una respuesta perdida no permite reiniciar el intento: primero hay que recuperar
el pedido. Solo se ofrece otro intento después de un fallo definitivo de stock/
validación o un estado terminal. Si se pierde la cookie, no se sustituye la sesión
silenciosamente para ese intento: se bloquea y se ofrece WhatsApp. Cerrar la
pestaña puede perder `sessionStorage`; el worker sigue siendo responsable de
liberar cualquier reserva abandonada. No rotar el secreto de sesión durante las
pruebas con pedidos pendientes; una rotación invalida cookies anteriores.

Límites del endpoint: 10 líneas, 10 prendas por línea, 20 prendas totales,
sin duplicados variante/talla, sin campos adicionales ni cantidades decimales.
Netlify aplica una regla compartida para las rutas de la Function: 20 solicitudes
por IP/dominio cada 60 segundos. Incluye sesión, reserva, consulta y cancelación.
El cliente maneja también el 429 HTML de la plataforma y mantiene el intento.
El adaptador local usa un contador de proceso porque solo escucha loopback;
ese contador **no** se presenta como un rate limiter distribuido.

Estos son límites básicos, no un límite transaccional de reservas activas por
persona. Para apertura pública y mayor volumen se deberá añadir control de
abuso/identidad y, si hace falta, una cuota de reservas activas dentro de SQL.
Un bot con múltiples IP puede eludir un límite por IP. No se cambia RLS ni se
concede acceso RPC a `anon` para resolverlo.

## Variables

Configurar secretos en Netlify UI/API con scope **Functions**, por contexto;
no en `netlify.toml` y nunca con prefijo `VITE_`.

| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS del proyecto elegido para ese contexto. |
| `SUPABASE_SECRET_KEY` | Secret key moderna `sb_secret_...`, exclusivamente servidor. Se envía como `apikey`, no como JWT Bearer. |
| `ORDERS_SESSION_SECRET` | Al menos 32 bytes aleatorios representados en hex/base64; firma cookies y deriva idempotencia. |
| `ORDERS_ALLOWED_ORIGIN` | Un origen exacto, sin barra final; por ejemplo `http://127.0.0.1:5173` en desarrollo. |
| `ORDERS_API_ENABLED` | `true` habilita el backend únicamente en los contextos de desarrollo permitidos. Ausente/false lo deshabilita. Mantener false en producción. |
| `ORDERS_EXPIRATION_ENABLED` | `true` activa el worker. Sin ello tampoco se permite reservar. Cancelar/consultar no depende de ese flag. |
| `CONTEXT` | Lo proporciona Netlify. El adaptador de Vite establece `dev`; no falsificarlo en producción. |

Para el worker publicado bastan URL, secret key y flag de expiración. El secreto
de sesión/origen se necesita para HTTP, no para expirar pedidos. Las variables
públicas actuales `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` siguen
sirviendo solo para disponibilidad; deben apuntar al mismo proyecto de ensayo
que el backend al hacer pruebas locales.

## Activación local manual

El nombre del archivo es **`.env.orders.local`**, con `orders` en plural.
El cargador no busca otras variantes del nombre. El archivo permanece ignorado
por Git; no incluir sus valores en logs ni documentación.

1. Usar una base Supabase de ensayo con las migraciones ya instaladas. No usar
   credenciales de producción para probar este bloque.
2. Copiar `herramientas/pedidos/.env.example` a `.env.orders.local` en la raíz
   (Git lo ignora). Completar URL, secreto privado y secreto de sesión; poner los
   dos flags en `true`. Este archivo no fue creado ni completado automáticamente.
3. Apuntar las variables públicas de disponibilidad al mismo proyecto de ensayo,
   por ejemplo en `.env.development.local`.
4. Ejecutar `npm run dev:web`. Abrir el origen exacto configurado, por defecto
   `http://127.0.0.1:5173`, y añadir prendas con inventario de ensayo al carrito.
5. En checkout, confirmar reserva, revisar UUID/estado/líneas/precio/vencimiento,
   cancelar y comprobar la revalidación. WhatsApp permanece disponible.

El worker local se ejecuta al arrancar y cada minuto. Si no completa un ciclo sin
errores ni pendientes durante dos minutos, el servidor rechaza nuevas reservas;
cancelación y consulta siguen funcionando. El timer se detiene al cerrar Vite.
Cancelar las pruebas antes de cerrar, o mantener un worker separado sobre esa
base de ensayo. El cierre de Vite **no** puede garantizar la liberación futura:
para operación desatendida se necesita el scheduler desplegado.

El botón de confirmar crea un pedido `pending` con prendas reservadas. No llama
a `confirm`/`complete` ni registra pagos. El panel conserva la selección del
pedido por separado del carrito, revalida disponibilidad y permite consultar
el estado cada minuto. Un reloj del navegador nunca libera ni declara vendido
el inventario: solo PostgreSQL decide el estado.

## Netlify Dev y CSP

`npx netlify dev` usa el bloque `[dev]` de `netlify.toml`: ejecuta
`npm run dev:web`, conecta con Vite en 5173 y sirve la aplicación en
`http://localhost:8888`. El directorio estático local es `public`, mientras el
directorio publicado en producción sigue siendo `dist`. Tanto `[dev].publish`
como `[context.dev].publish` apuntan a `public`: Netlify CLI 27.8.0 vuelve a
resolver el directorio al preparar el proxy y necesita también el contexto.

Los headers de `netlify.toml` son globales; no admiten separación por
`context.dev`. Por eso la CSP estricta se conserva literalmente en
`herramientas/netlify/csp.mjs`, cuyo plugin de build escribe `dist/_headers`.
Netlify aplica esa misma política al desplegar el build. No se añade permiso
inline a scripts ni estilos de producción, y las demás directivas se conservan.

En Netlify Dev no se envía CSP: `public` no contiene `_headers` y el TOML ya no
define esa cabecera. Vite puede insertar el preámbulo React Refresh, sus estilos
y usar WebSocket para HMR. Esto sigue funcionando aunque exista un build anterior
en `dist`. No copiar `dist/_headers` a `public` ni cambiar ninguno de esos dos
valores `publish` de desarrollo a `dist`.
Los demás headers del TOML siguen aplicándose en ambos entornos.

Para verificar solamente renderizado sin iniciar el worker ni reservas, se puede
establecer `ORDERS_API_ENABLED=false` en el **proceso** antes de ejecutar Netlify
Dev. Ese false explícito prevalece sobre `.env.orders.local` en el plugin Vite;
no modifica ni imprime el archivo privado.

Esta separación resuelve el renderizado y la CSP. La guía de pruebas de pedidos
anterior usa Vite directo en el origen configurado. Para probar las Functions
desde 8888, configurar su entorno de servidor y `ORDERS_ALLOWED_ORIGIN` con ese
origen exacto: Netlify no carga automáticamente el archivo personalizado
`.env.orders.local` para las Functions. No usar credenciales de producción.

Referencia: [headers por contexto y archivos por deploy](https://docs.netlify.com/manage/routing/headers/).

## Expiración periódica en Netlify

`expire-orders.mjs` declara `schedule: '* * * * *'` en UTC. Después de **un deploy
aprobado**, Netlify invoca esa versión cada minuto: no usa build hooks, no hace
commits y no dispara un nuevo build/deploy por tick. Cada tick sí consume una
invocación y tiempo de Functions; son aproximadamente 43.200 invocaciones en
30 días, no 43.200 deploys. Revisar consumo real del plan antes de activarlo.

Solo el deploy publicado tiene cron automático. Deploy Previews y branch deploys
no lo ejecutan periódicamente. Netlify permite probar la Function con **Run now**
en su UI; no hay URL pública para invocarla. Netlify Dev tampoco ejecuta el cron
automáticamente; este proyecto implementa su propio timer exclusivamente local.
Las variables se capturan por deploy: cambios de cron/código/variables requieren
un nuevo deploy, pero cada ejecución periódica no.

Algoritmo del worker:

1. Consulta `expired_order_candidates(500)` sin exponer la lista al navegador.
2. Procesa hasta cinco solicitudes concurrentes, cada una llamando únicamente
   `transition_order(...,'expire')`. Cada HTTP RPC es su propia transacción.
3. Usa 20 segundos de presupuesto y timeout de 4,5 segundos por RPC, dejando margen
   al límite de 30 segundos de una Scheduled Function. No deja promesas sin esperar.
4. Registra el fallo individual y sigue con los demás pedidos. El siguiente tick
   vuelve a consultar los pendientes; la transición revalida y bloquea el pedido.
   Dos workers pueden seleccionar lo mismo sin liberar stock dos veces.
5. Rota el inicio del lote por minuto para repartir el presupuesto ante errores
   persistentes. Si hay fallos, trabajo diferido o 500 candidatos, registra resumen
   y marca la invocación como fallida **después** de procesar el lote para alertar.

Registrar/monitorizar `orders_expiration_summary`, `orders_expiration_error` y
`orders_expiration_attention`. Los logs contienen contadores, códigos fijos y,
cuando hace falta, UUID de pedido; nunca customer_ref, prendas físicas ni SQL.
Antes de habilitar reservas públicas, comprobar ticks efectivos y configurar
alerta por ausencia de ciclos, errores o saturación. Una inconsistencia de
inventario que la RPC rechace exige intervención; el worker no fuerza stock a
available. Si se acumulan más de 500 fallos persistentes, el límite de la RPC
actual puede ocultar pedidos posteriores: detener nuevas reservas, revisar el
lote y ampliar a paginación por cursor en una migración futura si el volumen
lo exige. No existe garantía de liberación mientras Supabase/scheduler estén
caídos; hay reintento automático y señalización, no pérdida silenciosa del fallo.

## Validación manual antes del próximo deploy

- Revisar que este bloque no necesita SQL nuevo, cambios de RLS ni permisos anon.
- Probar con credenciales de ensayo: sesión/cookie, reserva, pérdida de respuesta,
  recarga, doble clic, cancelación, falta de stock y expiración sin navegador abierto.
- Revisar visualmente el checkout; no hubo navegador conectado en esta sesión.
- Confirmar que `orders` y `expire-orders` son detectadas al empaquetar Functions,
  sus rutas prevalecen sobre la SPA y la función periódica muestra `Scheduled`.
- En el contexto elegido, verificar scope Functions, origen exacto y ausencia de
  secretos en el bundle. Mantener la API de producción deshabilitada.
- Validar rate limiting real de plataforma con 429; las pruebas locales verifican
  la configuración y el contador local, no la infraestructura de Netlify.
- Tras el futuro deploy autorizado, comprobar **Run now**, logs y al menos dos
  ticks automáticos del worker publicado, con un pedido de ensayo vencido.
  Para ensayar cron sin tocar producción hace falta un sitio publicado de ensayo.
- Acordar alertas y responsable de revisar inconsistencias/backlog. No habilitar
  frontend público hasta verificar el worker y revisar la política antiabuso.

## Pruebas y archivos

`npm run test:pedidos-backend` cubre rutas, sesión/CSRF, idempotencia, sanitización,
errores, expiración, concurrencia de cliente, HTTP local y ausencia de secretos
e integración de reservas en el bundle público. Usa PGlite con las migraciones
reales y transportes HTTP simulados; ninguna llamada llega a Supabase.
`npm run test:pedidos` conserva las pruebas transaccionales y de concurrencia
PostgreSQL nativa del bloque anterior.

Archivos nuevos: `server/orders/{api,domain,session,supabase,expiration}.mjs`,
`netlify/functions/{orders,expire-orders}.mjs`,
`herramientas/pedidos/{vite-plugin.mjs,.env.example,README.md}`,
`src/services/pedidos.js`, `src/components/CheckoutReservas.jsx`,
`tests/pedidos-{backend,checkout,dev}.test.mjs`.
Archivos ajustados: `src/pages/Checkout.jsx`, `vite.config.js`, `netlify.toml`,
`eslint.config.js`, `package.json`, `tests/build-env.test.mjs` y el índice de
documentación de Supabase. No se alteran migraciones, CSP, RLS ni catálogo.

Referencias oficiales consultadas:
[Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/),
[rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/),
[variables de Functions](https://docs.netlify.com/build/functions/environment-variables/),
[orden de procesamiento de rutas](https://docs.netlify.com/resources/troubleshooting/request-chain/).

## Probar vencimiento en dos minutos (solo Vite local)

En `.env.orders.local`, en la raíz, añadir:

```ini
ORDERS_RESERVATION_TTL_MINUTES=2
ORDERS_DEV_DATABASE_URL=postgresql://USUARIO:CLAVE@HOST:5432/postgres?sslmode=require
```

Obtener la URI privada en **Connect** del proyecto Supabase de ensayo (conexión
PostgreSQL directa o session pooler, con contraseña codificada para URL). Debe
apuntar al **mismo proyecto** que `SUPABASE_URL` y la configuración pública del
catálogo. Usar el rol propietario con permisos sobre pedidos. No registrar esta
URI, compartirla ni ponerle prefijo `VITE_`. No requiere migraciones, cambios de
permisos ni editar datos manualmente en Supabase.

Mantener `ORDERS_API_ENABLED=true`, `ORDERS_EXPIRATION_ENABLED=true` y
`ORDERS_ALLOWED_ORIGIN=http://127.0.0.1:5173`. Reiniciar con `npm run dev:web` y
abrir ese origen exacto. El archivo privado existente no se sobrescribe.

El TTL admite enteros de 1 a 30 minutos; ausente o inválido usa 30. Solo el
adaptador Vite lo aplica; las Functions y producción mantienen la RPC de 30
minutos. `NODE_ENV=production` también desactiva el ajuste. React no decide ni
envía TTL. Para el plazo corto, el servidor llama a `reserve_order` mediante
PostgreSQL y ajusta `expires_at` en la misma transacción, desde `created_at`, sin
extender vencimientos en reintentos. Sin conexión privada válida la reserva
corta falla; no se confirma silenciosamente una reserva de 30 minutos.

1. Crear una reserva en checkout y guardar su UUID. El vencimiento mostrado
   debe estar aproximadamente dos minutos después de su creación.
2. Mantener Vite abierto. Esperar entre dos y tres minutos: el worker de
   `expire-orders` consulta candidatos cada minuto. Buscar en la terminal
   `orders_expiration_summary` con `candidates: 1` y `expired: 1` (o más si hay
   otras reservas). No pulsar actualizar antes si se quiere observar al worker:
   la consulta de estado también puede ejecutar la expiración.
3. En Supabase SQL Editor ejecutar estas consultas **solo de lectura**,
   sustituyendo el UUID:

```sql
select id, status, cancellation_reason, created_at, expires_at,
       expires_at - created_at as ttl
from public.orders where id = 'UUID-DEL-PEDIDO';

select u.id, u.status, a.released_at
from public.order_items i
join public.order_item_units a on a.order_item_id = i.id
join public.inventory_units u on u.id = a.inventory_unit_id
where i.order_id = 'UUID-DEL-PEDIDO';
```

Se espera `ttl = 00:02:00`, pedido `cancelled`, motivo `expired`, unidades
`available` y `released_at` informado (antes de que otra reserva reutilice esas
unidades). Pulsar **Actualizar estado** en checkout: debe reflejar cancelación
por expiración y actualizar disponibilidad. Para volver al plazo normal,
quitar la variable TTL o poner `30` y reiniciar; la URI PostgreSQL ya no se usa.
