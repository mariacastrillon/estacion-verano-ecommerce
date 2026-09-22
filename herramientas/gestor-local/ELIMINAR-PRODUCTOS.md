# Eliminar productos desde el gestor local

Arrancar con `npm run dev` y abrir `http://127.0.0.1:5173/gestor`.
Cada tarjeta tiene **Editar**, **Desactivar** (o Activar) y **Eliminar**, en rojo.
Eliminar abre la confirmación nativa del navegador con el nombre del producto,
sus consecuencias y la conservación de imágenes. Cancelar no envía solicitudes.
Al aceptar, el botón muestra «Eliminando…» y evita envíos duplicados. Solo al
completar la eliminación se retira la tarjeta. Un error mantiene la tarjeta y
explica qué ocurrió. Desactivar conserva su comportamiento previo.

## Configuración privada

En `herramientas/supabase/.env`, junto a las credenciales existentes, configurar:

```ini
GESTOR_DATABASE_URL=postgresql://postgres:CLAVE@db.REFERENCIA.supabase.co:5432/postgres?sslmode=require
GESTOR_DATABASE_CA_PATH=C:\Users\USUARIO\.supabase\certs\supabase-root.crt
```

Se admite también el session pooler de Supabase (`*.pooler.supabase.com`,
usuario `postgres.REFERENCIA`). Usar la URI del panel Connect, contraseña
codificada para URL y el mismo proyecto de `SUPABASE_URL`. El servidor valida
esa correspondencia. Se necesita el rol propietario con acceso a metadatos y
tablas; la clave REST existente no permite inspeccionar `pg_catalog` ni agrupar
varios DELETE en una transacción. No compartir esta URI ni usar prefijo `VITE_`.
No se modifica automáticamente el archivo privado.

### Descargar y configurar la CA oficial

1. Abre el **mismo proyecto** de Supabase al que apunta `GESTOR_DATABASE_URL`.
2. Entra en **Database Settings → SSL Configuration → Download Certificate**.
   Descarga el certificado raíz oficial del proyecto; no uses un certificado
   generado por ti ni el certificado capturado de una conexión fallida.
3. Crea la carpeta `C:\Users\USUARIO\.supabase\certs` y guarda el archivo
   descargado como `supabase-root.crt`. Está fuera del repositorio y del servidor
   web. No lo guardes en `public/`, `src/` ni en otra carpeta publicada por Vite.
   Si tu usuario Windows es distinto, adapta la ruta. El contenido debe seguir
   siendo el PEM original (`-----BEGIN CERTIFICATE-----`).
4. Añade la línea `GESTOR_DATABASE_CA_PATH` del ejemplo a
   `herramientas/supabase/.env`. Usa una ruta absoluta; si contiene espacios,
   puedes envolverla en comillas simples. Mantén privada `GESTOR_DATABASE_URL`.
5. Reinicia `npm run dev` y vuelve a intentar Eliminar.

El servidor lee y valida la CA antes de abrir la conexión. Si falta la variable,
el archivo no existe, no es legible o no contiene una CA PEM válida, informa del
problema sin mostrar la ruta privada y sin intentar borrar.

El cliente `pg` recibe `host`, `port`, `user`, `password` y `database` separados,
sin `connectionString`. Recibe además `ssl.ca`, `rejectUnauthorized: true` y el
verificador estándar de hostname de Node. Así, `sslmode=require` puede permanecer
en la URI privada, pero no reemplaza `ssl.ca`: la política efectiva siempre
verifica certificado y hostname (`verify-full`). Los demás parámetros de la
query de esa URI tampoco pueden sobrescribir estos campos.

El certificado y las credenciales solo se usan en el servidor local. Los logs
mantienen `[gestor:eliminar]`, con `gestor_eliminar_conectado`, `sslmode: verify-full`
y `tls: true` tras conectar. Ante un fallo, `gestor_eliminar_error` conserva la
etapa y el diagnóstico seguro; no imprime certificados, contraseñas ni URLs.
No se desactiva la verificación TLS. Si el certificado oficial no resuelve el
fallo, la conexión sigue bloqueada para revisar la cadena o el proyecto elegido.

Referencias oficiales: [CA de Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement)
y [configuración SSL de node-postgres](https://node-postgres.com/features/ssl).

Sin la URI, Eliminar devuelve un error de configuración sin cambiar datos.
No hace falta instalar migraciones, RPC, permisos o APIs públicas. La ruta DELETE
solo está en el servidor ligado a 127.0.0.1:4174, detrás del proxy de Vite local;
valida Host, Origin, JSON y confirmación explícita del ID. Se rechaza en
`NODE_ENV=production`. Las Functions de Netlify no contienen esta operación.

## Relaciones comprobadas

Se consultaron los metadatos OpenAPI del Supabase configurado (solo lectura).
Confirmaron estas relaciones; antes de cada borrado se inspeccionan todas las
FK entrantes mediante `pg_catalog`, incluidos otros esquemas y claves compuestas:

| Tabla | Referencias |
| --- | --- |
| variants | products |
| inventory | variants |
| inventory_groups | variants; inventory por legacy_inventory_id |
| inventory_group_sizes | inventory_groups |
| variant_size_options | variants; inventory_groups |
| inventory_units | inventory_groups por inventory_group_id y legacy_group_id |
| inventory_unit_size_options | inventory_units; variant_size_options |
| order_items | products; variants; variant_size_options; orders |
| order_item_units | order_items; inventory_units |

Orden de limpieza: inventory_unit_size_options → inventory_units →
variant_size_options → inventory_group_sizes → inventory_groups → inventory →
variants → products. Solo se borran filas del producto seleccionado, activas e
inactivas. Si una referencia cruza hacia otro producto, se bloquea.

`order_items` y `order_item_units` nunca se borran ni se actualizan. Cualquier
pedido, incluso cancelado o vencido, impide el borrado y muestra:

> Este producto tiene historial de pedidos y no puede eliminarse definitivamente. Puedes desactivarlo para retirarlo del catálogo.

Las otras FK con filas relacionadas también bloquean, aunque declaren CASCADE
o SET NULL. Una dependencia nueva que cambie el orden conocido requiere revisión.
Unidades reserved o sold también bloquean aunque no exista una asociación de
pedido. No se usa DELETE CASCADE ni se deshabilitan constraints, triggers o RLS.

## Transacción, catálogo e imágenes

La inspección y los DELETE se ejecutan en una sola transacción PostgreSQL con
bloqueos temporales de escritura sobre las tablas involucradas. Las lecturas
continúan; otras escrituras pueden esperar brevemente. Hay límites de espera y
rollback ante errores. La conexión exige visibilidad completa de las relaciones
(no acepta resultados parciales filtrados por RLS).

Después del commit se guarda el catálogo local mediante la cola, respaldo y
reemplazo atómico existentes. El servidor serializa sus operaciones de escritura
completas, incluida la sincronización, para evitar que otra edición lo recree
durante el borrado. Vite actualiza el catálogo público local desde ese JSON, y
la vista pública de disponibilidad ya no encuentra el producto en Supabase.
Un sitio estático ya publicado no se actualiza hasta su siguiente build/deploy;
esta tarea no publica nada.

PostgreSQL y el archivo JSON no comparten transacción. Si falla el guardado local
después del commit, se informa explícitamente: reintentar **Eliminar** completa
la limpieza local, incluso si el producto ya no existe en Supabase. No guardar
de nuevo el producto durante esa recuperación. Si se corta la conexión al
confirmar, el reintento vuelve a comprobar las relaciones y es seguro.

Las imágenes originales `.webp` y sus derivados `-480w.webp`/`-768w.webp` están
en `public/productos`. **Se conservan todos los archivos**, compartidos o no,
para proteger otros productos y los respaldos. No hay limpieza de imágenes
automática ni llamadas a Supabase Storage.

Pruebas: `npm run test:eliminar-producto`. Usan una base desechable; no borran
productos reales ni alteran el catálogo del usuario.
