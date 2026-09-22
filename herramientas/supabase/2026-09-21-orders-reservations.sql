-- Revision manual. Ejecutar UNA VEZ, despues de 2026-09-15.
-- No instala endpoints, pagos ni tareas programadas.
begin;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_ref text not null check (length(customer_ref) between 1 and 200),
  idempotency_key uuid not null,
  request_items jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled','completed')),
  currency text not null default 'COP' check (currency = 'COP'),
  expires_at timestamptz not null,
  cancellation_reason text check (cancellation_reason in ('requested','expired')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (customer_ref, idempotency_key),
  check ((status = 'cancelled') = (cancellation_reason is not null))
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  product_id text not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.variants(id) on delete restrict,
  variant_size_option_id uuid not null references public.variant_size_options(id) on delete restrict,
  display_size text not null,
  product_name text not null,
  variant_name text not null,
  unit_price_cop bigint not null check (unit_price_cop >= 0),
  quantity integer not null check (quantity between 1 and 20),
  unique (order_id, line_number)
);

create table public.order_item_units (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  inventory_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  reserved_at timestamptz not null default clock_timestamp(),
  released_at timestamptz,
  sold_at timestamptz,
  unique (order_item_id, inventory_unit_id),
  check (released_at is null or sold_at is null)
);
-- Una venta conserva la exclusividad para siempre; cancelar conserva el historial.
create unique index order_item_units_exclusive_idx
  on public.order_item_units(inventory_unit_id) where released_at is null;
create index orders_expiry_idx on public.orders(expires_at, id)
  where status in ('pending','confirmed');
create index order_items_order_idx on public.order_items(order_id);

-- Defensa adicional frente a escrituras administrativas directas sobre unidades.
-- Diferido: las RPC actualizan estado y asociacion en la misma transaccion.
create function public.check_order_unit_state()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  unit_uuid uuid;
begin
  if tg_table_name = 'inventory_units' then
    unit_uuid := new.id;
  elsif tg_op = 'DELETE' then
    unit_uuid := old.inventory_unit_id;
  else
    unit_uuid := new.inventory_unit_id;
  end if;
  if exists (
    select 1 from public.order_item_units a
    join public.order_items i on i.id = a.order_item_id
    join public.orders o on o.id = i.order_id
    join public.inventory_units u on u.id = a.inventory_unit_id
    where a.inventory_unit_id = unit_uuid and a.released_at is null
      and not ((u.status = 'reserved' and a.sold_at is null and o.status in ('pending','confirmed'))
        or (u.status = 'sold' and a.sold_at is not null and o.status = 'completed'))
  ) then
    raise exception 'ORDER_UNIT_STATE_CONFLICT' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger inventory_units_order_state
  after insert or update on public.inventory_units deferrable initially deferred
  for each row execute function public.check_order_unit_state();
create constraint trigger order_item_units_state
  after insert or update or delete on public.order_item_units deferrable initially deferred
  for each row execute function public.check_order_unit_state();

-- Matching bipartito mediante caminos aumentantes. Cada elemento de p_edges
-- es la lista de unidades compatibles con UNA prenda solicitada.
-- BFS reasigna selecciones previas: evita los falsos agotados de un greedy.
create function public.order_match_units(p_edges jsonb)
returns uuid[] language plpgsql immutable set search_path = pg_catalog, public as $$
declare
  result uuid[] := array[]::uuid[];
  owners jsonb := '{}'::jsonb;
  parents jsonb;
  queue integer[];
  head integer;
  root integer;
  slot integer;
  owner_slot integer;
  unit_id uuid;
  previous_unit uuid;
  found boolean;
begin
  for root in 1..jsonb_array_length(p_edges) loop
    queue := array[root]; head := 1; parents := '{}'::jsonb; found := false;
    while head <= cardinality(queue) and not found loop
      slot := queue[head]; head := head + 1;
      for unit_id in select value::uuid from jsonb_array_elements_text(p_edges->(slot - 1)) loop
        if parents ? unit_id::text then continue; end if;
        parents := parents || jsonb_build_object(unit_id::text, slot);
        owner_slot := (owners->>unit_id::text)::integer;
        if owner_slot is not null then
          queue := array_append(queue, owner_slot);
        else
          loop
            slot := (parents->>unit_id::text)::integer;
            previous_unit := result[slot];
            result[slot] := unit_id;
            owners := owners || jsonb_build_object(unit_id::text, slot);
            exit when previous_unit is null;
            unit_id := previous_unit;
          end loop;
          found := true;
          exit;
        end if;
      end loop;
    end loop;
    if not found then return null; end if;
  end loop;
  return result;
end;
$$;

-- DTO deliberadamente sin talla fisica, UUID de unidad ni datos del cliente.
create function public.order_public_result(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'id', o.id, 'status', o.status, 'expires_at', o.expires_at,
    'currency', o.currency, 'cancellation_reason', o.cancellation_reason,
    'total_cop', (select sum(i.quantity * i.unit_price_cop) from public.order_items i where i.order_id = o.id),
    'items', (select jsonb_agg(jsonb_build_object(
      'product_id', i.product_id, 'variant_id', i.variant_id,
      'display_size', i.display_size, 'quantity', i.quantity,
      'product_name', i.product_name, 'variant_name', i.variant_name,
      'unit_price_cop', i.unit_price_cop
    ) order by i.line_number) from public.order_items i where i.order_id = o.id)
  ) from public.orders o where o.id = p_order_id;
$$;

create function public.reserve_order(p_customer_ref text, p_idempotency_key uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  order_row public.orders%rowtype;
  payload jsonb;
  item jsonb;
  variant_uuid uuid;
  option_row record;
  line_no integer := 0;
  count_requested integer := 0;
  qty integer;
  item_id uuid;
  item_ids uuid[] := array[]::uuid[];
  edges jsonb := '[]'::jsonb;
  candidates jsonb;
  assignment uuid[];
  pos integer;
begin
  if p_customer_ref is null or length(btrim(p_customer_ref)) not between 1 and 200
     or p_idempotency_key is null then
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) is distinct from 'object'
       or not (item ?& array['product_id','variant_id','display_size','quantity'])
       or (item - array['product_id','variant_id','display_size','quantity']) <> '{}'::jsonb
       or jsonb_typeof(item->'product_id') is distinct from 'string'
       or jsonb_typeof(item->'variant_id') is distinct from 'string'
       or jsonb_typeof(item->'display_size') is distinct from 'string'
       or jsonb_typeof(item->'quantity') is distinct from 'number'
       or (item->>'quantity') !~ '^[0-9]{1,2}$' then
      raise exception 'INVALID_ITEM' using errcode = '22023';
    end if;
    qty := (item->>'quantity')::integer;
    if qty not between 1 and 20 then raise exception 'INVALID_QUANTITY' using errcode = '22023'; end if;
    count_requested := count_requested + qty;
    variant_uuid := (item->>'variant_id')::uuid;
  end loop;
  if count_requested > 100 then raise exception 'ORDER_TOO_LARGE' using errcode = '22023'; end if;
  -- Orden canonico: reintentar con las mismas lineas reordenadas es idempotente.
  select jsonb_agg(value order by value->>'variant_id', value->>'display_size', value->>'product_id')
    into payload from jsonb_array_elements(p_items);
  if exists (select 1 from jsonb_array_elements(payload) x
    group by (x->>'variant_id')::uuid, x->>'display_size' having count(*) > 1) then
    raise exception 'DUPLICATE_ITEM' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('order:' || p_customer_ref || ':' || p_idempotency_key::text, 1));
  select * into order_row from public.orders
    where customer_ref = p_customer_ref and idempotency_key = p_idempotency_key;
  if found then
    if order_row.request_items <> payload then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023'; end if;
    return public.order_public_result(order_row.id);
  end if;

  -- Mismo lock que admin_save_inventory_physical_units, UUIDs ordenados.
  for variant_uuid in select distinct (value->>'variant_id')::uuid from jsonb_array_elements(payload) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(variant_uuid::text, 0));
  end loop;
  -- Protege tambien snapshots de catalogo frente a la sincronizacion local.
  perform p.id from public.products p
    where p.id in (select value->>'product_id' from jsonb_array_elements(payload))
    order by p.id for share;
  perform v.id from public.variants v
    where v.id in (select (value->>'variant_id')::uuid from jsonb_array_elements(payload))
    order by v.id for share;
  perform g.id from public.inventory_groups g
    where g.variant_id in (select (value->>'variant_id')::uuid from jsonb_array_elements(payload))
    order by g.id for share;
  perform s.id from public.variant_size_options s
    where s.variant_id in (select (value->>'variant_id')::uuid from jsonb_array_elements(payload))
    order by s.id for share;
  -- Bloqueo real de filas, sin SKIP LOCKED: esperar evita un falso agotado.
  perform u.id from public.inventory_units u join public.inventory_groups g on g.id = u.inventory_group_id
    where g.variant_id in (select (value->>'variant_id')::uuid from jsonb_array_elements(payload))
      and u.status = 'available' and u.active
    order by u.id for update of u;
  perform c.id from public.inventory_unit_size_options c join public.inventory_units u on u.id = c.inventory_unit_id
    join public.inventory_groups g on g.id = u.inventory_group_id
    where g.variant_id in (select (value->>'variant_id')::uuid from jsonb_array_elements(payload))
    order by c.id for share of c;

  insert into public.orders(customer_ref, idempotency_key, request_items, expires_at)
    values (p_customer_ref, p_idempotency_key, payload, clock_timestamp() + interval '30 minutes')
    returning * into order_row;
  for item in select value from jsonb_array_elements(payload) loop
    select s.id, s.inventory_group_id, p.name as product_name, v.name as variant_name, p.price_cop
      into option_row
      from public.variant_size_options s
      join public.variants v on v.id = s.variant_id
      join public.products p on p.id = v.product_id
      join public.inventory_groups g on g.id = s.inventory_group_id and g.variant_id = v.id
      where v.id = (item->>'variant_id')::uuid and p.id = item->>'product_id'
        and s.display_size = item->>'display_size' and p.active and v.active and s.active and g.active;
    if not found then raise exception 'INVALID_SELECTION' using errcode = '22023'; end if;
    qty := (item->>'quantity')::integer; line_no := line_no + 1;
    insert into public.order_items(order_id, line_number, product_id, variant_id, variant_size_option_id,
      display_size, product_name, variant_name, unit_price_cop, quantity)
      values (order_row.id, line_no, item->>'product_id', (item->>'variant_id')::uuid, option_row.id,
        item->>'display_size', option_row.product_name, option_row.variant_name, option_row.price_cop, qty)
      returning id into item_id;
    select coalesce(jsonb_agg(u.id order by u.id), '[]'::jsonb) into candidates
      from public.inventory_units u
      join public.inventory_unit_size_options c on c.inventory_unit_id = u.id
      where c.variant_size_option_id = option_row.id and c.active
        and u.inventory_group_id = option_row.inventory_group_id and u.status = 'available' and u.active
        and not exists (select 1 from public.order_item_units a where a.inventory_unit_id = u.id and a.released_at is null);
    for pos in 1..qty loop
      edges := edges || jsonb_build_array(candidates);
      item_ids := array_append(item_ids, item_id);
    end loop;
  end loop;
  assignment := public.order_match_units(edges);
  if assignment is null then raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001'; end if;
  for pos in 1..cardinality(assignment) loop
    update public.inventory_units set status = 'reserved', active = false, updated_at = clock_timestamp()
      where id = assignment[pos] and status = 'available' and active;
    if not found then raise exception 'INVENTORY_CONFLICT' using errcode = 'P0001'; end if;
    insert into public.order_item_units(order_item_id, inventory_unit_id) values (item_ids[pos], assignment[pos]);
  end loop;
  return public.order_public_result(order_row.id);
end;
$$;

-- pending -> confirmed conserva la reserva; completed significa venta fisica.
-- expires_at aplica a pending Y confirmed; confirmar no extiende el plazo.
create function public.transition_order(p_order_id uuid, p_customer_ref text, p_action text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  o public.orders%rowtype;
  variant_uuid uuid;
  expired boolean;
begin
  if p_action is null or p_action not in ('confirm','cancel','complete','expire') then
    raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order_id and customer_ref = p_customer_ref for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if (p_action = 'cancel' and o.status = 'cancelled') or (p_action = 'complete' and o.status = 'completed')
     or (p_action = 'expire' and o.status in ('cancelled','completed')) then
    return public.order_public_result(o.id);
  end if;
  if o.status not in ('pending','confirmed') then raise exception 'INVALID_TRANSITION' using errcode = '22023'; end if;
  for variant_uuid in select distinct variant_id from public.order_items where order_id = o.id order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(variant_uuid::text, 0));
  end loop;
  perform u.id from public.inventory_units u join public.order_item_units a on a.inventory_unit_id = u.id
    join public.order_items i on i.id = a.order_item_id
    where i.order_id = o.id and a.released_at is null order by u.id for update of u;
  expired := o.expires_at <= clock_timestamp();
  if p_action = 'expire' and not expired then return public.order_public_result(o.id); end if;
  if exists (select 1 from public.order_items i where i.order_id = o.id and i.quantity <>
    (select count(*) from public.order_item_units a where a.order_item_id = i.id and a.released_at is null)) then
    raise exception 'INVENTORY_INCONSISTENT' using errcode = 'P0001';
  end if;
  if p_action in ('cancel','expire') or expired then
    -- Una inconsistencia de venta jamas vuelve a available; requiere revision.
    if exists (select 1 from public.order_item_units a join public.order_items i on i.id = a.order_item_id
      join public.inventory_units u on u.id = a.inventory_unit_id
      where i.order_id = o.id and a.released_at is null and (u.status <> 'reserved' or a.sold_at is not null)) then
      raise exception 'INVENTORY_INCONSISTENT' using errcode = 'P0001';
    end if;
    update public.inventory_units u set status = 'available', active = true, updated_at = clock_timestamp()
      from public.order_item_units a, public.order_items i
      where a.inventory_unit_id = u.id and i.id = a.order_item_id and i.order_id = o.id
        and a.released_at is null and a.sold_at is null and u.status = 'reserved';
    update public.order_item_units a set released_at = clock_timestamp()
      from public.order_items i where i.id = a.order_item_id and i.order_id = o.id and a.released_at is null;
    update public.orders set status = 'cancelled', cancellation_reason = case when expired then 'expired' else 'requested' end,
      updated_at = clock_timestamp() where id = o.id;
  else
    if exists (select 1 from public.order_item_units a join public.order_items i on i.id = a.order_item_id
      join public.inventory_units u on u.id = a.inventory_unit_id
      where i.order_id = o.id and a.released_at is null and (u.status <> 'reserved' or a.sold_at is not null)) then
      raise exception 'INVENTORY_INCONSISTENT' using errcode = 'P0001';
    end if;
    if p_action = 'complete' then
      if o.status <> 'confirmed' then raise exception 'CONFIRM_FIRST' using errcode = '22023'; end if;
      update public.inventory_units u set status = 'sold', active = false, updated_at = clock_timestamp()
        from public.order_item_units a, public.order_items i
        where a.inventory_unit_id = u.id and i.id = a.order_item_id and i.order_id = o.id and a.released_at is null;
      update public.order_item_units a set sold_at = clock_timestamp()
        from public.order_items i where i.id = a.order_item_id and i.order_id = o.id and a.released_at is null;
    end if;
    update public.orders set status = case when p_action = 'complete' then 'completed' else 'confirmed' end,
      updated_at = clock_timestamp() where id = o.id;
  end if;
  return public.order_public_result(o.id);
end;
$$;

-- El scheduler futuro llama una RPC por pedido: un fallo no bloquea todo el lote.
-- Solo identifica candidatos; transition_order(..., 'expire') revalida bajo lock.
create function public.expired_order_candidates(p_limit integer default 100)
returns table(order_id uuid, customer_ref text) language sql stable security definer
set search_path = pg_catalog, public as $$
  select id, customer_ref from public.orders
  where status in ('pending','confirmed') and expires_at <= now()
  order by expires_at, id limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

-- Envolver la RPC existente sin copiar su implementacion. Bloqueo igual al
-- original: reconfigurar una variante reservada puede romper la cancelacion.
alter function public.admin_save_inventory_physical_units(uuid,jsonb,boolean)
  rename to admin_save_inventory_physical_units_before_orders;
revoke all on function public.admin_save_inventory_physical_units_before_orders(uuid,jsonb,boolean)
  from public, anon, authenticated, service_role;
-- La RPC numerica de septiembre 5 tambien debe quedar inhabilitada.
revoke all on function public.admin_save_inventory_groups(uuid,jsonb,boolean)
  from public, anon, authenticated, service_role;
create function public.admin_save_inventory_physical_units(p_variant_id uuid, p_groups jsonb, p_confirm_reconfigure boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_variant_id::text, 0));
  if exists (select 1 from public.inventory_units u join public.inventory_groups g on g.id = u.inventory_group_id
    where g.variant_id = p_variant_id and u.status = 'reserved') then
    raise exception 'VARIANT_HAS_RESERVATIONS' using errcode = 'P0001';
  end if;
  return public.admin_save_inventory_physical_units_before_orders(p_variant_id, p_groups, p_confirm_reconfigure);
end;
$$;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_units enable row level security;
revoke all on public.orders, public.order_items, public.order_item_units from public, anon, authenticated, service_role;
grant select on public.orders, public.order_items, public.order_item_units to service_role;
revoke all on function public.check_order_unit_state(), public.order_match_units(jsonb), public.order_public_result(uuid),
  public.reserve_order(text,uuid,jsonb), public.transition_order(uuid,text,text),
  public.expired_order_candidates(integer), public.admin_save_inventory_physical_units(uuid,jsonb,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_order(text,uuid,jsonb), public.transition_order(uuid,text,text),
  public.expired_order_candidates(integer), public.admin_save_inventory_physical_units(uuid,jsonb,boolean) to service_role;

notify pgrst, 'reload schema';
commit;
