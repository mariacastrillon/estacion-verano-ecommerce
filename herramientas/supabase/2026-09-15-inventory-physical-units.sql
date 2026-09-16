-- Ejecutar manualmente después de 2026-09-07-public-inventory-read.sql.
-- inventory_groups.stock queda como dato histórico; la disponibilidad operativa
-- se deriva exclusivamente de unidades disponibles y compatibilidades activas.
-- Una sola transacción: primero toda la estructura, después el backfill.
begin;

-- Fase A: DDL, funciones, triggers, RLS, vistas y permisos.
alter table public.inventory_groups add column if not exists legacy_stock integer;

create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  inventory_group_id uuid not null references public.inventory_groups(id) on delete restrict,
  physical_size text check (physical_size is null or physical_size = any (array['XS','S','M','L','XL','XXL','ÚNICA'])),
  status text not null default 'pending' check (status in ('pending','available','reserved','sold','retired')),
  active boolean not null default false,
  legacy_group_id uuid references public.inventory_groups(id) on delete restrict,
  legacy_position integer check (legacy_position is null or legacy_position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_units_status_active_check check (
    active = (status = 'available') and (not active or physical_size is not null)
  ),
  unique (legacy_group_id, legacy_position)
);

create table if not exists public.inventory_unit_size_options (
  id uuid primary key default gen_random_uuid(),
  inventory_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  variant_size_option_id uuid not null references public.variant_size_options(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inventory_unit_id, variant_size_option_id)
);

create index if not exists inventory_units_group_status_idx
  on public.inventory_units(inventory_group_id, status);
create index if not exists inventory_unit_size_options_option_idx
  on public.inventory_unit_size_options(variant_size_option_id) where active;

create or replace function public.validate_inventory_unit_size_option()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.inventory_units unit
    join public.inventory_groups groups on groups.id = unit.inventory_group_id
    join public.variant_size_options option on option.id = new.variant_size_option_id
    where unit.id = new.inventory_unit_id
      and groups.id = option.inventory_group_id
      and groups.variant_id = option.variant_id
  ) then
    raise exception 'La talla visible y la unidad deben pertenecer al mismo grupo y variante.'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_unit_size_option_group_check on public.inventory_unit_size_options;
create trigger inventory_unit_size_option_group_check
before insert or update on public.inventory_unit_size_options
for each row execute function public.validate_inventory_unit_size_option();

create or replace function public.require_available_unit_compatibility()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if exists (
    select 1 from public.inventory_units unit
    where unit.id = new.id and unit.active
      and not exists (
        select 1 from public.inventory_unit_size_options compatibility
        join public.variant_size_options option on option.id = compatibility.variant_size_option_id
        where compatibility.inventory_unit_id = unit.id
          and compatibility.active and option.active
      )
  ) then
    raise exception 'Una unidad disponible necesita al menos una talla visible compatible.'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

drop trigger if exists inventory_units_compatibility_required on public.inventory_units;
create constraint trigger inventory_units_compatibility_required
after insert or update on public.inventory_units
deferrable initially deferred
for each row execute function public.require_available_unit_compatibility();

create or replace function public.require_unit_compatibility_after_link()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  checked_unit_id uuid;
begin
  if tg_op = 'DELETE' then
    checked_unit_id := old.inventory_unit_id;
  else
    checked_unit_id := new.inventory_unit_id;
  end if;
  if exists (
    select 1 from public.inventory_units unit
    where unit.id = checked_unit_id and unit.active
      and not exists (
        select 1 from public.inventory_unit_size_options compatibility
        join public.variant_size_options option on option.id = compatibility.variant_size_option_id
        where compatibility.inventory_unit_id = unit.id
          and compatibility.active and option.active
      )
  ) then
    raise exception 'Una unidad disponible necesita al menos una talla visible compatible.'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

drop trigger if exists inventory_unit_links_compatibility_required on public.inventory_unit_size_options;
create constraint trigger inventory_unit_links_compatibility_required
after insert or update or delete on public.inventory_unit_size_options
deferrable initially deferred
for each row execute function public.require_unit_compatibility_after_link();

create or replace function public.admin_save_inventory_physical_units(
  p_variant_id uuid,
  p_groups jsonb,
  p_confirm_reconfigure boolean default false
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_group_json jsonb;
  v_unit_json jsonb;
  v_group_position integer := 0;
  v_unit_position integer := 0;
  v_group_id uuid;
  v_unit_id uuid;
  v_option_id uuid;
  v_size_value text;
  v_group_sizes text[];
  v_unit_sizes text[];
  v_physical_size_value text;
  v_existing_active_count integer;
begin
  if not exists (select 1 from public.variants where id = p_variant_id) then
    raise exception 'La variante no existe.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'Se requiere al menos un grupo lógico.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_variant_id::text, 0));

  create temporary table proposed_physical_groups (
    position integer primary key, id uuid, display_sizes text[] not null
  ) on commit drop;
  create temporary table proposed_physical_units (
    position integer primary key, group_position integer not null,
    id uuid, physical_size text not null, display_sizes text[] not null
  ) on commit drop;

  for v_group_json in select item.value from jsonb_array_elements(p_groups) as item(value) loop
    v_group_position := v_group_position + 1;
    v_group_id := nullif(v_group_json->>'id', '')::uuid;
    if v_group_id is not null and not exists (
      select 1 from public.inventory_groups groups
      where groups.id = v_group_id and groups.variant_id = p_variant_id and groups.active
    ) then
      raise exception 'El grupo no pertenece a la variante.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_group_json->'display_sizes') <> 'array' then
      raise exception 'El grupo necesita tallas visibles.' using errcode = '22023';
    end if;
    select coalesce(array_agg(item.size_value), array[]::text[])
      into v_group_sizes
    from jsonb_array_elements_text(v_group_json->'display_sizes') as item(size_value);
    if cardinality(v_group_sizes) = 0 or exists (
      select 1 from unnest(v_group_sizes) as size_item(size_value)
      where size_item.size_value <> all (array['XS','S','M','L','XL','XXL','ÚNICA'])
    ) then
      raise exception 'El grupo necesita tallas visibles válidas.' using errcode = '22023';
    end if;
    insert into proposed_physical_groups values (v_group_position, v_group_id, v_group_sizes);

    if jsonb_typeof(v_group_json->'units') <> 'array' then
      raise exception 'units debe ser un array.' using errcode = '22023';
    end if;
    for v_unit_json in select item.value from jsonb_array_elements(v_group_json->'units') as item(value) loop
      v_unit_position := v_unit_position + 1;
      v_unit_id := nullif(v_unit_json->>'id', '')::uuid;
      v_physical_size_value := nullif(v_unit_json->>'physical_size', '');
      if v_physical_size_value is null or v_physical_size_value <> all (array['XS','S','M','L','XL','XXL','ÚNICA']) then
        raise exception 'Cada unidad requiere una talla física confirmada.' using errcode = '22023';
      end if;
      if jsonb_typeof(v_unit_json->'display_sizes') <> 'array' then
        raise exception 'La unidad necesita tallas compatibles.' using errcode = '22023';
      end if;
      select coalesce(array_agg(item.size_value), array[]::text[])
        into v_unit_sizes
      from jsonb_array_elements_text(v_unit_json->'display_sizes') as item(size_value);
      if cardinality(v_unit_sizes) = 0 or exists (
        select 1 from unnest(v_unit_sizes) as unit_size(size_value)
        where not (unit_size.size_value = any(v_group_sizes))
      ) then
        raise exception 'Cada unidad necesita al menos una talla compatible del grupo.' using errcode = '22023';
      end if;
      if v_unit_id is not null and not exists (
        select 1 from public.inventory_units unit
        join public.inventory_groups groups on groups.id = unit.inventory_group_id
        where unit.id = v_unit_id and groups.variant_id = p_variant_id
          and unit.status in ('available','pending')
      ) then
        raise exception 'La unidad no pertenece a la variante o ya fue consumida.' using errcode = '22023';
      end if;
      insert into proposed_physical_units values (
        v_unit_position, v_group_position, v_unit_id, v_physical_size_value, v_unit_sizes
      );
    end loop;
  end loop;

  if exists (
    select 1 from proposed_physical_groups proposed
    cross join lateral unnest(proposed.display_sizes) as size_item(size_value)
    group by size_item.size_value having count(*) > 1
  ) or exists (
    select 1 from proposed_physical_groups proposed
    where proposed.id is not null
    group by proposed.id having count(*) > 1
  ) or exists (
    select 1 from proposed_physical_units proposed
    where proposed.id is not null
    group by proposed.id having count(*) > 1
  ) or exists (
    select 1 from proposed_physical_units proposed
    cross join lateral unnest(proposed.display_sizes) as size_item(size_value)
    group by proposed.position, size_item.size_value having count(*) > 1
  ) then
    raise exception 'IDs o tallas visibles duplicadas.' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.inventory_groups groups
    where groups.variant_id = p_variant_id and groups.active
      and not exists (select 1 from proposed_physical_groups proposed where proposed.id = groups.id)
  ) and not p_confirm_reconfigure then
    raise exception 'CONFIRM_RECONFIGURE: retirar un grupo lógico requiere confirmación explícita.'
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.inventory_units unit
    join public.inventory_groups groups on groups.id = unit.inventory_group_id
    where groups.variant_id = p_variant_id and groups.active
      and unit.status in ('reserved','sold')
      and not exists (select 1 from proposed_physical_groups proposed where proposed.id = groups.id)
  ) then
    raise exception 'Un grupo con unidades reservadas o vendidas no puede retirarse.' using errcode = '22023';
  end if;

  select count(*) into v_existing_active_count
  from public.inventory_units unit
  join public.inventory_groups groups on groups.id = unit.inventory_group_id
  where groups.variant_id = p_variant_id and unit.active;
  if not p_confirm_reconfigure and (
    exists (
      select 1 from public.inventory_units unit
      join public.inventory_groups groups on groups.id = unit.inventory_group_id
      where groups.variant_id = p_variant_id and unit.status in ('available','pending')
        and not exists (select 1 from proposed_physical_units proposed where proposed.id = unit.id)
    ) or (v_existing_active_count > 0 and exists (
      select 1 from proposed_physical_units proposed
      join public.inventory_units unit on unit.id = proposed.id and unit.active
      join proposed_physical_groups target_group on target_group.position = proposed.group_position
      where unit.inventory_group_id is distinct from target_group.id
        or unit.physical_size is distinct from proposed.physical_size
        or exists (
          select option.display_size from public.inventory_unit_size_options link
          join public.variant_size_options option on option.id = link.variant_size_option_id
          where link.inventory_unit_id = unit.id and link.active and option.active
          except
          select size_item.size_value from unnest(proposed.display_sizes) as size_item(size_value)
        ) or exists (
          select size_item.size_value from unnest(proposed.display_sizes) as size_item(size_value)
          except
          select option.display_size from public.inventory_unit_size_options link
          join public.variant_size_options option on option.id = link.variant_size_option_id
          where link.inventory_unit_id = unit.id and link.active and option.active
        )
    ))) then
    raise exception 'CONFIRM_RECONFIGURE: retirar o reconfigurar unidades existentes requiere confirmación explícita.'
      using errcode = 'P0001';
  end if;

  update public.variant_size_options set active = false
  where variant_id = p_variant_id and active;
  update public.inventory_unit_size_options link set active = false
  from public.inventory_units unit, public.inventory_groups groups
  where link.inventory_unit_id = unit.id
    and unit.inventory_group_id = groups.id
    and groups.variant_id = p_variant_id
    and unit.status in ('available','pending') and link.active;
  update public.inventory_units unit set status = 'retired', active = false
  from public.inventory_groups groups
  where unit.inventory_group_id = groups.id and groups.variant_id = p_variant_id
    and unit.status in ('available','pending')
    and not exists (select 1 from proposed_physical_units proposed where proposed.id = unit.id);

  for v_group_position, v_group_id, v_group_sizes in
    select proposed.position, proposed.id, proposed.display_sizes
    from proposed_physical_groups proposed order by proposed.position
  loop
    if v_group_id is null then
      insert into public.inventory_groups(variant_id, stock, legacy_stock, active)
      values (p_variant_id, 0, 0, true) returning id into v_group_id;
      update proposed_physical_groups proposed
      set id = v_group_id where proposed.position = v_group_position;
    end if;
    foreach v_size_value in array v_group_sizes loop
      select option.id into v_option_id
      from public.variant_size_options option
      where option.variant_id = p_variant_id and option.display_size = v_size_value
      order by option.created_at desc limit 1;
      if v_option_id is null then
        insert into public.variant_size_options(
          variant_id, display_size, inventory_group_id, active, sort_order
        ) values (
          p_variant_id, v_size_value, v_group_id, true,
          array_position(array['XS','S','M','L','XL','XXL','ÚNICA'], v_size_value) * 10
        ) returning id into v_option_id;
      else
        update public.variant_size_options
        set inventory_group_id = v_group_id, active = true,
            sort_order = array_position(array['XS','S','M','L','XL','XXL','ÚNICA'], v_size_value) * 10
        where id = v_option_id;
      end if;
    end loop;
  end loop;

  for v_unit_position, v_group_position, v_unit_id, v_physical_size_value, v_unit_sizes in
    select proposed.position, proposed.group_position, proposed.id,
           proposed.physical_size, proposed.display_sizes
    from proposed_physical_units proposed order by proposed.position
  loop
    select proposed.id into v_group_id from proposed_physical_groups proposed
    where proposed.position = v_group_position;
    if v_unit_id is null then
      insert into public.inventory_units(inventory_group_id, physical_size, status, active)
      values (v_group_id, v_physical_size_value, 'available', true)
      returning id into v_unit_id;
    else
      update public.inventory_units
      set inventory_group_id = v_group_id, physical_size = v_physical_size_value,
          status = 'available', active = true, updated_at = now()
      where id = v_unit_id;
    end if;
    foreach v_size_value in array v_unit_sizes loop
      select option.id into v_option_id from public.variant_size_options option
      where option.inventory_group_id = v_group_id and option.display_size = v_size_value and option.active;
      insert into public.inventory_unit_size_options(inventory_unit_id, variant_size_option_id, active)
      values (v_unit_id, v_option_id, true)
      on conflict (inventory_unit_id, variant_size_option_id)
      do update set active = true, updated_at = now();
    end loop;
  end loop;

  -- Una fusión explícita conserva los grupos anteriores, pero los deja
  -- inactivos después de mover o retirar sus prendas dentro de la transacción.
  update public.inventory_groups groups set active = false
  where groups.variant_id = p_variant_id and groups.active
    and not exists (select 1 from proposed_physical_groups proposed where proposed.id = groups.id);

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', groups.id,
      'legacy_stock', groups.legacy_stock,
      'display_sizes', (
        select coalesce(jsonb_agg(option.display_size order by option.sort_order), '[]'::jsonb)
        from public.variant_size_options option
        where option.inventory_group_id = groups.id and option.active
      ),
      'units', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', unit.id, 'physical_size', unit.physical_size,
          'status', unit.status, 'active', unit.active,
          'display_sizes', (
            select coalesce(jsonb_agg(option.display_size order by option.sort_order), '[]'::jsonb)
            from public.inventory_unit_size_options link
            join public.variant_size_options option on option.id = link.variant_size_option_id
            where link.inventory_unit_id = unit.id and link.active and option.active
          )
        ) order by unit.created_at, unit.id), '[]'::jsonb)
        from public.inventory_units unit
        where unit.inventory_group_id = groups.id and unit.status in ('available','pending')
      )
    ) order by groups.created_at, groups.id), '[]'::jsonb)
    from public.inventory_groups groups
    where groups.variant_id = p_variant_id and groups.active
  );
end;
$$;

create or replace view public.public_inventory_availability
with (security_invoker = true) as
select variants.product_id, variants.variant_key, variants.id as variant_id,
  option.display_size, option.inventory_group_id,
  count(distinct unit.id)::integer as stock, true as active
from public.variants variants
join public.variant_size_options option on option.variant_id = variants.id and option.active
join public.inventory_groups groups on groups.id = option.inventory_group_id
  and groups.variant_id = variants.id and groups.active
left join public.inventory_unit_size_options compatibility
  on compatibility.variant_size_option_id = option.id and compatibility.active
left join public.inventory_units unit
  on unit.id = compatibility.inventory_unit_id
  and unit.inventory_group_id = groups.id and unit.active and unit.status = 'available'
where variants.active
group by variants.product_id, variants.variant_key, variants.id,
  option.display_size, option.inventory_group_id;

create or replace view public.inventory_physical_units_overview
with (security_invoker = true) as
select products.id as product_id, variants.variant_key,
  groups.id as inventory_group_id, unit.id as inventory_unit_id,
  unit.physical_size, unit.status,
  array_agg(option.display_size order by option.sort_order)
    filter (where compatibility.active and option.active) as compatible_display_sizes
from public.inventory_units unit
join public.inventory_groups groups on groups.id = unit.inventory_group_id
join public.variants variants on variants.id = groups.variant_id
join public.products products on products.id = variants.product_id
left join public.inventory_unit_size_options compatibility on compatibility.inventory_unit_id = unit.id
left join public.variant_size_options option on option.id = compatibility.variant_size_option_id
group by products.id, variants.variant_key, groups.id, unit.id,
  unit.physical_size, unit.status;

alter table public.inventory_units enable row level security;
alter table public.inventory_unit_size_options enable row level security;
drop policy if exists inventory_units_public_available_read on public.inventory_units;
create policy inventory_units_public_available_read on public.inventory_units
for select to anon, authenticated using (active and status = 'available');
drop policy if exists inventory_unit_size_options_public_read on public.inventory_unit_size_options;
create policy inventory_unit_size_options_public_read on public.inventory_unit_size_options
for select to anon, authenticated using (
  active and exists (
    select 1 from public.inventory_units unit
    where unit.id = inventory_unit_id and unit.active and unit.status = 'available'
  )
);

revoke all on public.inventory_units from anon, authenticated;
revoke all on public.inventory_unit_size_options from anon, authenticated;
revoke all on public.variants from anon, authenticated;
revoke all on public.inventory_groups from anon, authenticated;
revoke all on public.variant_size_options from anon, authenticated;
revoke all on public.public_inventory_availability from public, anon, authenticated;
revoke all on public.inventory_physical_units_overview from public, anon, authenticated;
revoke all on function public.admin_save_inventory_units(uuid, jsonb, boolean) from service_role;
revoke all on function public.admin_save_inventory_physical_units(uuid, jsonb, boolean)
  from public, anon, authenticated;
grant select (id, inventory_group_id, status, active)
  on public.inventory_units to anon, authenticated;
grant select (inventory_unit_id, variant_size_option_id, active)
  on public.inventory_unit_size_options to anon, authenticated;
grant select (id, product_id, variant_key, active)
  on public.variants to anon, authenticated;
grant select (id, variant_id, active)
  on public.inventory_groups to anon, authenticated;
grant select (id, variant_id, display_size, inventory_group_id, active)
  on public.variant_size_options to anon, authenticated;
grant select on public.public_inventory_availability to anon, authenticated;
grant all on public.inventory_units to service_role;
grant all on public.inventory_unit_size_options to service_role;
grant select on public.inventory_physical_units_overview to service_role;
grant execute on function public.admin_save_inventory_physical_units(uuid, jsonb, boolean)
  to service_role;

-- Fase B: datos. Ningún ALTER/DDL sigue a estas escrituras antes del COMMIT.
update public.inventory_groups set legacy_stock = stock where legacy_stock is null;

-- Cada grupo antiguo produce exactamente stock filas, pero solo la primera
-- puede reutilizar la talla física ya registrada. Las demás no se suponen M.
-- La primera prenda solo hereda las compatibilidades antiguas en su inserción
-- inicial: repetir el SQL nunca deshace una decisión manual posterior.
with inserted_units as (
  insert into public.inventory_units (
    inventory_group_id, physical_size, status, active, legacy_group_id, legacy_position
  )
  select groups.id,
    case when position.number = 1 then groups.physical_size else null end,
    case when position.number = 1 and groups.active and groups.physical_size is not null
      and exists (select 1 from public.variant_size_options option
        where option.inventory_group_id = groups.id and option.active)
      then 'available' else 'pending' end,
    position.number = 1 and groups.active and groups.physical_size is not null
      and exists (select 1 from public.variant_size_options option
        where option.inventory_group_id = groups.id and option.active),
    groups.id, position.number
  from public.inventory_groups groups
  cross join lateral generate_series(1, groups.legacy_stock) as position(number)
  on conflict (legacy_group_id, legacy_position) do nothing
  returning id, inventory_group_id, legacy_position, active
)
insert into public.inventory_unit_size_options(inventory_unit_id, variant_size_option_id)
select unit.id, option.id
from inserted_units unit
join public.variant_size_options option
  on option.inventory_group_id = unit.inventory_group_id and option.active
where unit.legacy_position = 1 and unit.active
on conflict (inventory_unit_id, variant_size_option_id) do nothing;

notify pgrst, 'reload schema';
commit;
