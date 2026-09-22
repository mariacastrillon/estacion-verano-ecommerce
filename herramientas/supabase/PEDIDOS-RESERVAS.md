# Pedidos y reserva transaccional — primera versión

Preparado para revisión; este trabajo no aplica SQL en Supabase, no publica un
endpoint, no conecta React a reservas y no implementa pagos. El checkout existente
continúa consultando disponibilidad y abriendo WhatsApp sin prometer una reserva.

## Esquema existente revisado

La secuencia versionada es 2026-09-05, 09-06, 09-07 y 09-15. No existe en el
repositorio el DDL inicial de `products`, `variants` e `inventory`; el migrador y el
gestor muestran `products.id` textual, `variants.id` UUID, relación por
`variants.product_id`, y precio entero en `products.price_cop`. Hay que contrastar
este contrato con el esquema instalado antes de aplicar el nuevo archivo.

| Objeto | Función actual e implicación |
| --- | --- |
| `inventory_groups` | Agrupa tallas de una variante; `stock` y `legacy_stock` son históricos, no se usan para reservar. |
| `inventory_units` | Una fila por prenda. `active = (status = 'available')`; disponible requiere talla física y compatibilidad. Reservar debe escribir también `active=false`. |
| `inventory_unit_size_options` | Relación muchos a muchos entre prendas y opciones visibles. Una misma prenda puede satisfacer M o L. |
| `variant_size_options` | Una talla activa por variante, enlazada a un grupo. El gestor puede reutilizar el UUID y cambiar el grupo. |
| `public_inventory_availability` | Conteo de prendas compatibles activas por talla, sin talla física. Los conteos de distintas tallas no se pueden sumar: pueden compartir prendas. |
| Carrito | Persiste selección y datos orientativos; revalida la vista y limita conservadoramente por grupo. No es autoridad para reservar ni para cobrar. |
| Checkout | Revalida y genera mensaje de WhatsApp. No hay pedido persistido ni reserva. |
| Gestor local | API en 127.0.0.1:4174, credencial secreta solo de servidor; sincroniza catálogo por REST y guarda inventario con `admin_save_inventory_physical_units`. No es un backend público autenticado. |
| Migrador local | Carga catálogo y variantes; conserva stock previo. No se ejecuta para este bloque. |

## Arquitectura y frontera de confianza

Flujo futuro: navegador → endpoint de servidor autenticado → `reserve_order` por
PostgREST con credencial privada → una transacción PostgreSQL → respuesta pública.
Ningún endpoint nuevo queda expuesto en esta entrega. El motor transaccional sí
queda implementado en la migración para conectarlo después de revisarla.

El endpoint debe obtener `customer_ref` de la identidad validada o de una sesión
de invitado firmada por servidor; nunca de un campo arbitrario enviado por React.
Debe autorizar cada consulta/cancelación, aplicar límites de solicitudes y de
reservas activas, traducir errores sin divulgar SQL y permitir `complete` solo a
personal autorizado. CORS por sí solo no autentica. No reutilizar directamente
el servidor administrativo local como endpoint público.

La entrada de cada línea contiene **exclusivamente** `product_id`, `variant_id`
(UUID real de Supabase, no `variant_key`), `display_size` y `quantity`. No acepta
stock, precio, grupo, talla física ni IDs de unidades. Límites de esta versión:
20 líneas, 20 prendas por línea y 100 prendas totales. Líneas repetidas se rechazan;
el backend debe agregarlas antes de llamar. Los precios y nombres se copian desde
el catálogo SQL activo dentro de la transacción; moneda COP y valores en pesos.
No hay flete, impuestos calculados, pago ni dirección de envío en esta versión.

El catálogo local sigue siendo fuente editorial; una sincronización pendiente
puede producir diferencias frente a los precios SQL. El endpoint futuro debe
presentar los precios devueltos por servidor y pedir aceptación cuando difieran.

## Tablas y relaciones

`orders` 1 → N `order_items` 1 → N `order_item_units` N → 1 `inventory_units`.

- `orders`: UUID, referencia opaca del cliente, clave UUID de idempotencia,
  solicitud canónica, estado, vencimiento, moneda, motivo de cancelación y fechas.
- `order_items`: producto, variante, opción visible por FK, talla visible y
  snapshots de nombres/precio, cantidad y número de línea. Los snapshots preservan
  lo pedido aunque se edite el catálogo después.
- `order_item_units`: UUID exacto de cada prenda, línea, fecha de reserva,
  liberación o venta. No se borra al cancelar. El índice único parcial sobre
  `inventory_unit_id WHERE released_at IS NULL` impide dos asignaciones vigentes.
  Las vendidas mantienen esa exclusividad.

Las FK usan `RESTRICT`; no se permite borrar el historial por cascada. RLS queda
habilitado sin políticas públicas. `anon` y `authenticated` no acceden a estas
tablas ni ejecutan RPC. `service_role` lee las tablas para operación interna y
solo modifica pedidos por RPC, no por INSERT/UPDATE/DELETE directo.

El DTO devuelve UUID de pedido, estado, vencimiento, moneda, motivo, total y
líneas comerciales. No devuelve `physical_size`, `inventory_unit_id` ni identidad
del cliente. La vista pública existente conserva su definición y permisos.

## RPC y transacciones

| RPC | Operación |
| --- | --- |
| `reserve_order(customer_ref, idempotency_key, items)` | Valida identidad de selección y catálogo activo, asigna todas las prendas, crea pedido `pending`, líneas y asociaciones, y marca unidades `reserved`. Reserva de 30 minutos definida por servidor. |
| `transition_order(order_id, customer_ref, 'confirm')` | `pending → confirmed`; continúa reservado, sin extender vencimiento. Repetir confirmación válida es idempotente. |
| `transition_order(..., 'cancel')` | `pending/confirmed → cancelled`, libera las prendas reservadas y registra `released_at`. Repetir no libera dos veces. |
| `transition_order(..., 'complete')` | Solo `confirmed → completed`; todas las prendas pasan a `sold`, registra `sold_at`. No significa pago recibido: es una operación administrativa de venta/entrega. |
| `transition_order(..., 'expire')` | Cancela solo si ya venció y permanece pendiente/confirmado. Revalida dentro del lock. |
| `expired_order_candidates(limit)` | Lista interna acotada para un futuro worker; no libera por sí misma. |

Los auxiliares `order_match_units`, `order_public_result` y
`check_order_unit_state` no son RPC accesibles al backend o al público.

Idempotencia: clave única por cliente; reintentos con las mismas líneas incluso
reordenadas devuelven el mismo pedido. Reutilizar la clave con otro contenido
falla. Repetir una reserva cancelada devuelve la cancelación; para volver a
reservar se necesita una clave nueva. Un fallo revierte incluso el registro de
idempotencia. El backend debe conservar la clave al reintentar tras timeout.
Reintentar `reserve_order` no renueva ni libera una reserva vencida; el DTO lleva
`expires_at` y toda transición comercial comprueba el vencimiento.

## Exclusión y asignación compatible

1. Bloqueo transaccional de idempotencia y después locks advisory de variantes
   en orden UUID, con la misma clave que usa el gestor.
2. Locks de lectura sobre catálogo, grupos y opciones; `FOR UPDATE` sobre las
   prendas disponibles, y locks de lectura sobre compatibilidades.
3. Relectura de estados, actividad, grupo y enlaces vigentes bajo esos locks.
4. Matching bipartito completo mediante caminos aumentantes dentro de PostgreSQL.
   Ejemplo: prenda A sirve M/L y B solo M; pedir M+L asigna B a M y A a L.
5. Si no existe asignación para **todas** las cantidades, excepción y rollback
   completo. Si existe, se guardan exactamente esos UUIDs y estados atómicamente.

Se espera el bloqueo; no se usa `SKIP LOCKED` para no declarar agotado un stock
que una transacción temporalmente retiene y podría devolver con rollback. El
índice exclusivo es una segunda barrera. Los triggers diferidos comprueban que
una asociación vigente concuerde con unidad `reserved` y pedido activo, o unidad
`sold` y pedido completado. Una escritura directa que libere o venda una unidad
asignada sin la transición correspondiente falla al finalizar la transacción.

La nueva migración envuelve la RPC del gestor y rechaza reconfigurar **cualquier
variante con prendas reserved**, incluidas reservas anteriores sin pedido. Esto
evita romper las compatibilidades necesarias para cancelar. Revoca ejecución de
la implementación interna y de la RPC antigua de grupos numéricos. Los estados
`pending`, `available`, `reserved`, `sold`, `retired` se conservan.

La serialización por variante es deliberadamente conservadora: puede añadir
esperas aunque dos compradores pidan prendas distintas del mismo color. Para el
volumen inicial prima la coherencia con el gestor. Cada llamada RPC debe ser una
transacción corta independiente, con aislamiento predeterminado READ COMMITTED;
el backend debe reintentar deadlocks/errores de serialización con la misma clave.
No agrupar múltiples pedidos ni llamadas del gestor en una transacción cliente.

Referencia de semántica de locks:
[documentación oficial PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html).

## Cancelación y vencimiento

Cancelar bloquea el pedido, las variantes y las unidades antes de comprobar el
estado. Actualiza solo `reserved → available` con `active=true`, marca liberación
y cancela el pedido en la misma transacción. `completed` no se puede cancelar.
Si se detecta una prenda vendida o una asociación inconsistente en un pedido
activo, toda la cancelación falla para revisión; nunca vuelve a poner una venta
en circulación. No hay devoluciones parciales en esta versión.

`pending` y `confirmed` vencen a los 30 minutos. Una confirmación o finalización
que llega tarde devuelve `cancelled` con motivo `expired`, libera stock y **no
lanza excepción después de liberar**, para que la liberación se confirme.
El backend debe comprobar el estado devuelto, no solo el HTTP 200.

Después de aprobar el despliegue, un worker de servidor cada minuto llamaría
`expired_order_candidates(100)` y luego `transition_order(..., 'expire')` en una
transacción independiente por pedido. Puede haber varios workers: las
transiciones son idempotentes y bloquean la fila de pedido. Errores individuales
se registran y alertan sin detener el resto. No se instala cron en este bloque.
Sin worker, las reservas vencidas siguen reteniendo stock hasta que una
transición las libere: no se considera vencimiento una simple consulta pública.
Debe existir worker operativo antes de habilitar reservas a compradores.

## Riesgos y límites que deben revisarse

- El DDL base y el estado instalado de Supabase no se verificaron remotamente.
  Las pruebas usan un fixture explícito del contrato base y ejecutan después las
  cuatro migraciones reales del repositorio y la nueva migración completa.
- El propietario SQL puede eludir permisos, deshabilitar triggers o editar
  catálogos directamente; no es una frontera contra el administrador de la BD.
  Las credenciales `service_role` existentes todavía administran inventario:
  las reconfiguraciones deben pasar por la RPC protegida, nunca por REST directo
  a grupos/opciones/compatibilidades. Reservas antiguas no se convierten en pedidos.
- No repetir migraciones históricas después de ésta: reemplazarían la RPC
  protegida y podrían restablecer permisos. La nueva migración es de aplicación
  única, dentro de BEGIN/COMMIT; una segunda ejecución falla y revierte.
- Falta integrar autenticación/sesión, endpoint público, límites antiacaparamiento,
  worker y UI de confirmación. No se deben habilitar permisos RPC para `anon`
  como atajo. No hay pagos ni conexión a proveedores externos.
- Cambiar 30 minutos por otro plazo o permitir retenciones indefinidas de pedidos
  confirmados requiere una decisión comercial; hoy ambos vencen igual.

## Revisión y ejecución manual posterior

Primero revisar en SQL Editor (consultas de lectura; no se ejecutaron aquí):

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name in
  ('products','variants','inventory_groups','inventory_units',
   'variant_size_options','inventory_unit_size_options')
order by table_name, ordinal_position;

select pg_get_functiondef('public.admin_save_inventory_physical_units(uuid,jsonb,boolean)'::regprocedure);
select pg_get_viewdef('public.public_inventory_availability'::regclass, true);
select status, count(*) from public.inventory_units group by status;
select to_regclass('public.orders'), to_regclass('public.order_items'),
       to_regclass('public.order_item_units'); -- deben ser NULL antes de aplicar
```

Confirmar `products.id text`, `products.name`, `products.price_cop` entero,
`products.active`, `variants.id uuid`, `variants.product_id`, `variants.name`,
`variants.active` y que la migración del 15 de septiembre ya esté instalada.
Si el esquema remoto difiere, adaptar y probar antes de ejecutar.

Después de revisar y respaldar, ejecutar **el archivo completo**
`herramientas/supabase/2026-09-21-orders-reservations.sql` una sola vez como
propietario de las tablas/funciones en SQL Editor, preferiblemente primero en un
entorno de ensayo. No ejecutar el fixture de tests ni volver a ejecutar las
migraciones anteriores en una base ya actualizada. El archivo termina con
`NOTIFY pgrst, 'reload schema'` y `COMMIT`. No hay comando npm que lo publique.

Contrato de llamada futura, exclusivamente desde servidor (ejemplo, no ejecutar
con UUIDs ficticios ni en producción para probar):

```sql
select public.reserve_order(
  'sesion-validada-en-servidor',
  '11111111-1111-4111-8111-111111111111'::uuid,
  '[{"product_id":"producto-real","variant_id":"22222222-2222-4222-8222-222222222222","display_size":"M","quantity":1}]'::jsonb
);
-- transition_order(<id devuelto>, <referencia validada>, 'confirm'|'cancel'|'complete'|'expire')
```

## Pruebas locales

`npm run test:pedidos` ejecuta pruebas SQL en PGlite y carreras reales con
PostgreSQL 17 nativo, tres conexiones y observación de espera en
`pg_stat_activity`. El clúster es nuevo, temporal, escucha exclusivamente en
127.0.0.1 y se elimina al terminar. No lee `.env`, `DATABASE_URL` ni credenciales
de Supabase. Las dependencias agregadas son exclusivamente de desarrollo.

Las pruebas cubren matching con reasignación, cantidades, rollback, exclusividad,
identidad producto/variante, entradas inválidas, precio de servidor, idempotencia,
permisos, cancelación, venta, expiración y bloqueo del gestor. Las de concurrencia
comprueban dos compradores, rollback del primero, doble envío, gestor contra
reserva, cancelación contra venta y bloqueo de fila frente a escritura directa.
En Windows el entorno aislado de ejecución puede impedir iniciar PostgreSQL;
el runner debe ejecutarse con permisos para crear procesos locales. En Linux
PostgreSQL requiere usuario no root; el runner no crea usuarios del sistema.

Validación realizada en este bloque:

- 12 pruebas SQL en PGlite aprobadas, incluido matching contra búsqueda exhaustiva
  de los 512 grafos de tres solicitudes y tres prendas.
- 6 pruebas concurrentes aprobadas con PostgreSQL 17.10 y conexiones independientes.
- `npm run build` y `git diff --check` correctos.
- La batería general detectó un fallo preexistente en
  `tests/posicion-lista-gestor.test.mjs`: espera literalmente
  `onCancelar={volverALista}`, que no coincide con el componente actual.
- `npm run lint` detectó tres errores existentes en `ImagenModal.jsx`,
  `ProductoCard.jsx` y `FavoritosContext.jsx`, además de un warning. Esos archivos
  y el test anterior no se modificaron en este bloque.
