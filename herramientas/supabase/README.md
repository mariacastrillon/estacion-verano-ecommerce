# Migración administrativa del catálogo a Supabase

El catálogo local `src/data/catalogo.json` continúa siendo la fuente de verdad. Este
script no lo modifica y no cambia el frontend.

Primero ejecute siempre la simulación:

```sh
npm run supabase:migrar:dry
```

El comando real futuro es:

```sh
npm run supabase:migrar
```

La ejecución real repite obligatoriamente todo el preflight antes de conectarse. Si
hay un error de validación, no escribe. Usa `upsert` sobre `products.id`,
`variants(product_id, variant_key)` e `inventory(variant_id, size)`; no borra filas.
En inventario, los conflictos se ignoran para no devolver a cero un stock que se
haya actualizado después de la carga inicial.

Para una ejecución real, defina `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en el
entorno local. `SUPABASE_SECRET_KEY` debe contener una secret key moderna de
Supabase con formato `sb_secret_...`. Por compatibilidad, el migrador acepta
`SUPABASE_SERVICE_ROLE_KEY` como fallback si la variable moderna no está definida.

Estas credenciales son exclusivamente para uso local/administrativo: nunca deben
incluirse en React, variables `VITE_*`, un bundle público ni producción cliente. Los
archivos `.env` y `.env.*` están ignorados por Git, salvo el ejemplo sin secretos de
esta carpeta.

## Grupos de inventario compartido

La migración `2026-09-05-inventory-groups.sql` crea `inventory_groups`,
`inventory_group_sizes`, la vista administrativa `inventory_groups_overview` y la
función transaccional `admin_save_inventory_groups`. Debe ejecutarse manualmente en
el SQL Editor de Supabase antes de abrir el inventario del gestor.

La transición es conservadora: cada fila existente de `inventory` crea un grupo
propio con stock 0 y una sola talla. La relación queda registrada en
`legacy_inventory_id`, por lo que repetir la migración no crea duplicados. La tabla
`inventory` no se elimina ni modifica.

RLS queda activado y no se concede acceso a `anon` ni `authenticated`. Solo
`service_role` recibe permisos sobre las tablas, la vista y la función
administrativa. No habilite SELECT público hasta que el frontend público migre a
este modelo y exista una política diseñada para esa lectura.

## Talla física y tallas visibles

Después de la migración de grupos, ejecute manualmente
`2026-09-06-physical-size-options.sql`. Esta migración añade `physical_size` a las
unidades existentes y crea `variant_size_options` para resolver cada talla visible
hacia una unidad física. Las tallas anteriores se guardan en `legacy_sizes` solo
como referencia: `physical_size` queda pendiente, excepto en el caso inequívoco
`ÚNICA`.

La RPC administrativa pasa a ser `admin_save_inventory_units`. Sigue siendo
transaccional, exige talla física, una o más tallas visibles y stock no negativo, y
mantiene las confirmaciones y conservación de stock al reconfigurar unidades con
existencias. `inventory`, `inventory_groups` e `inventory_group_sizes` se preservan.

## Unidades físicas individuales (2026-09-15)

Ejecute manualmente `2026-09-15-inventory-physical-units.sql` después de la
migración de lectura pública `2026-09-07-public-inventory-read.sql`. No lo ejecute
automáticamente desde npm. Haga un respaldo de las tablas de inventario antes de
aplicarlo. Reinicie la API local y Vite después de ejecutar el SQL.

La versión corregida mantiene una sola transacción: primero crea toda la
estructura, RLS y permisos; solo al final actualiza `legacy_stock` y crea las
unidades históricas. Así no ejecuta `ALTER TABLE inventory_units` mientras hay
eventos de constraint triggers diferidos de sus `INSERT`. Si la ejecución completa
falló dentro del `BEGIN`, PostgreSQL revierte esa transacción; el archivo también
tolera objetos creados por ejecuciones parciales anteriores y se puede repetir.

`inventory_groups` sigue identificando el conjunto lógico de tallas visibles;
`inventory_units` registra cada prenda física, incluso cuando dos prendas tienen
la misma talla real. `inventory_unit_size_options` enlaza cada prenda con las
opciones visibles comerciales que puede cumplir. El stock operativo se calcula
con unidades `available` activas, no con `inventory_groups.stock`. Este último
campo y `legacy_stock` permanecen como evidencia histórica, sin borrar datos.

Un grupo histórico con `physical_size=M, stock=2` genera dos filas idempotentes:
la primera conserva la M registrada y sus compatibilidades anteriores; la segunda
queda `pending`, sin talla física asignada ni disponibilidad pública. Si la talla
de grupo estaba vacía, todas las filas quedan pendientes. Revise manualmente en
el gestor cada prenda pendiente antes de activarla; nunca copie M a las demás
automáticamente.

El gestor usa `GET /api/gestor/inventario/:productId` y
`PUT /api/gestor/inventario/grupos`. La escritura anterior por stock numérico
responde 410 y su RPC pierde permiso de ejecución para `service_role`. El nuevo
guardado es transaccional, conserva UUIDs y exige confirmación al retirar o
reconfigurar prendas existentes. Retirar una unidad la marca `retired`; no se
borra. Una unidad pendiente no se puede guardar como disponible sin talla física
y al menos una talla visible compatible.

Si la migración antigua dejó M y L en grupos distintos del mismo color, el botón
«Fusionar en primer grupo» reúne explícitamente sus prendas y tallas. El grupo
anterior queda inactivo, no eliminado; se exige confirmación y se bloquea la
fusión de un grupo con unidades reservadas.

La vista `public_inventory_availability` devuelve el conteo de prendas activas
compatibles por talla visible sin exponer `physical_size`. El frontend actual
permanece conservador al sumar líneas por grupo: puede impedir combinaciones
comprables, pero no puede vender más de las unidades confirmadas. Un futuro
checkout deberá hacer una asignación transaccional exacta de prendas concretas;
la comprobación del carrito no sustituye una reserva de servidor.
