begin;

create table if not exists public.inventory_groups (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete restrict,
  legacy_inventory_id uuid unique references public.inventory(id) on delete restrict,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_group_sizes (
  id uuid primary key default gen_random_uuid(),
  inventory_group_id uuid not null references public.inventory_groups(id) on delete restrict,
  size text not null check (length(btrim(size)) > 0),
  created_at timestamptz not null default now(),
  unique (inventory_group_id, size)
);

create index if not exists inventory_groups_variant_id_idx
  on public.inventory_groups(variant_id);
create index if not exists inventory_group_sizes_group_id_idx
  on public.inventory_group_sizes(inventory_group_id);
create index if not exists inventory_group_sizes_size_idx
  on public.inventory_group_sizes(size);

create or replace function public.set_inventory_group_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_groups_set_updated_at on public.inventory_groups;
create trigger inventory_groups_set_updated_at
before update on public.inventory_groups
for each row execute function public.set_inventory_group_updated_at();

create or replace function public.check_active_inventory_group_size_unique()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_group public.inventory_groups%rowtype;
begin
  select * into target_group
  from public.inventory_groups
  where id = new.inventory_group_id;

  perform pg_advisory_xact_lock(hashtextextended(target_group.variant_id::text || ':' || new.size, 0));
  if target_group.active and exists (
    select 1
    from public.inventory_group_sizes existing_size
    join public.inventory_groups existing_group on existing_group.id = existing_size.inventory_group_id
    where existing_group.variant_id = target_group.variant_id
      and existing_group.active
      and existing_size.size = new.size
      and existing_size.id <> new.id
  ) then
    raise exception 'La talla % ya pertenece a otro grupo activo de la variante.', new.size
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_group_sizes_unique_active on public.inventory_group_sizes;
create trigger inventory_group_sizes_unique_active
before insert or update on public.inventory_group_sizes
for each row execute function public.check_active_inventory_group_size_unique();

create or replace function public.check_activated_inventory_group_sizes_unique()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.active and not old.active and exists (
    select 1
    from public.inventory_group_sizes own_size
    join public.inventory_group_sizes other_size on other_size.size = own_size.size
    join public.inventory_groups other_group on other_group.id = other_size.inventory_group_id
    where own_size.inventory_group_id = new.id
      and other_group.variant_id = new.variant_id
      and other_group.active
      and other_group.id <> new.id
  ) then
    raise exception 'No se puede activar el grupo: una talla ya pertenece a otro grupo activo.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_groups_unique_sizes_on_activation on public.inventory_groups;
create trigger inventory_groups_unique_sizes_on_activation
before update of active on public.inventory_groups
for each row execute function public.check_activated_inventory_group_sizes_unique();

with inserted_groups as (
  insert into public.inventory_groups (variant_id, legacy_inventory_id, stock, active)
  select inventory.variant_id, inventory.id, 0, inventory.active
  from public.inventory
  on conflict (legacy_inventory_id) do nothing
  returning id, legacy_inventory_id
)
insert into public.inventory_group_sizes (inventory_group_id, size)
select inserted_groups.id, inventory.size
from inserted_groups
join public.inventory on inventory.id = inserted_groups.legacy_inventory_id;

create or replace view public.inventory_groups_overview
with (security_invoker = true)
as
select
  products.id as product_id,
  products.name as product,
  variants.id as variant_id,
  variants.variant_key,
  variants.name as variant,
  inventory_groups.id as group_id,
  array_agg(inventory_group_sizes.size order by inventory_group_sizes.size) as sizes,
  inventory_groups.stock,
  inventory_groups.active
from public.inventory_groups
join public.variants on variants.id = inventory_groups.variant_id
join public.products on products.id = variants.product_id
join public.inventory_group_sizes on inventory_group_sizes.inventory_group_id = inventory_groups.id
group by products.id, products.name, variants.id, variants.variant_key, variants.name,
  inventory_groups.id, inventory_groups.stock, inventory_groups.active;

create or replace function public.admin_save_inventory_groups(
  p_variant_id uuid,
  p_groups jsonb,
  p_confirm_reconfigure boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposed_group jsonb;
  proposed_id uuid;
  proposed_stock integer;
  proposed_sizes text[];
  existing_ids uuid[];
  original_size_count integer;
  proposed_size_count integer;
  original_stock_total bigint;
  proposed_stock_total bigint := 0;
  topology_changed boolean;
begin
  if not exists (select 1 from public.variants where id = p_variant_id) then
    raise exception 'La variante no existe.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'Debe existir al menos un grupo.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_variant_id::text, 0));
  select coalesce(array_agg(id), array[]::uuid[]), coalesce(sum(stock), 0)
    into existing_ids, original_stock_total
  from public.inventory_groups where variant_id = p_variant_id and active;

  create temporary table proposed_inventory_groups (
    position integer primary key,
    id uuid,
    stock integer not null,
    sizes text[] not null
  ) on commit drop;

  for proposed_group in select value from jsonb_array_elements(p_groups)
  loop
    proposed_id := nullif(proposed_group->>'id', '')::uuid;
    proposed_stock := (proposed_group->>'stock')::integer;
    select coalesce(array_agg(value order by value), array[]::text[])
      into proposed_sizes from jsonb_array_elements_text(proposed_group->'sizes');
    if proposed_stock < 0 or cardinality(proposed_sizes) = 0 then
      raise exception 'Cada grupo debe tener tallas y stock entero no negativo.' using errcode = '22023';
    end if;
    if proposed_id is not null and not (proposed_id = any(existing_ids)) then
      raise exception 'Un grupo no pertenece a la variante indicada.' using errcode = '22023';
    end if;
    insert into proposed_inventory_groups(position, id, stock, sizes)
    values ((select count(*) + 1 from proposed_inventory_groups), proposed_id, proposed_stock, proposed_sizes);
    proposed_stock_total := proposed_stock_total + proposed_stock;
  end loop;

  if exists (
    select proposed_size.size_value
    from proposed_inventory_groups proposed
    cross join lateral unnest(proposed.sizes) as proposed_size(size_value)
    group by proposed_size.size_value having count(*) > 1
  ) then
    raise exception 'Una talla no puede pertenecer a dos grupos activos.' using errcode = '23505';
  end if;

  select count(*) into original_size_count
  from public.inventory_group_sizes sizes
  join public.inventory_groups groups on groups.id = sizes.inventory_group_id
  where groups.variant_id = p_variant_id and groups.active;
  select count(*) into proposed_size_count
  from proposed_inventory_groups proposed
  cross join lateral unnest(proposed.sizes) as proposed_size(size_value);
  if original_size_count <> proposed_size_count or exists (
    (select sizes.size
     from public.inventory_group_sizes sizes
     join public.inventory_groups groups on groups.id = sizes.inventory_group_id
     where groups.variant_id = p_variant_id and groups.active
     except select proposed_size.size_value
     from proposed_inventory_groups proposed
     cross join lateral unnest(proposed.sizes) as proposed_size(size_value))
    union all
    (select proposed_size.size_value
     from proposed_inventory_groups proposed
     cross join lateral unnest(proposed.sizes) as proposed_size(size_value)
     except select sizes.size
     from public.inventory_group_sizes sizes
     join public.inventory_groups groups on groups.id = sizes.inventory_group_id
     where groups.variant_id = p_variant_id and groups.active)
  ) then
    raise exception 'La reconfiguración no puede dejar tallas huérfanas ni inventar tallas.' using errcode = '22023';
  end if;

  topology_changed := exists (
    select 1
    from proposed_inventory_groups proposed
    cross join lateral unnest(proposed.sizes) as proposed_size(size_value)
    left join public.inventory_group_sizes current_size
      on current_size.size = proposed_size.size_value
    left join public.inventory_groups current_group
      on current_group.id = current_size.inventory_group_id
      and current_group.variant_id = p_variant_id and current_group.active
    where proposed.id is distinct from current_group.id
  );

  if topology_changed and original_stock_total > 0 then
    if not p_confirm_reconfigure then
      raise exception 'CONFIRM_RECONFIGURE: fusionar o dividir grupos con stock requiere confirmación explícita.'
        using errcode = 'P0001';
    end if;
    if proposed_stock_total <> original_stock_total then
      raise exception 'La reconfiguración debe conservar el stock total; indique explícitamente su reparto.'
        using errcode = '22023';
    end if;
  end if;

  update public.inventory_groups set active = false
  where variant_id = p_variant_id and active;
  delete from public.inventory_group_sizes sizes
  using public.inventory_groups groups
  where sizes.inventory_group_id = groups.id and groups.variant_id = p_variant_id;

  for proposed_id, proposed_stock, proposed_sizes in
    select id, stock, sizes from proposed_inventory_groups order by position
  loop
    if proposed_id is null then
      insert into public.inventory_groups(variant_id, stock, active)
      values (p_variant_id, proposed_stock, true)
      returning id into proposed_id;
    else
      update public.inventory_groups set stock = proposed_stock, active = true where id = proposed_id;
    end if;
    insert into public.inventory_group_sizes(inventory_group_id, size)
    select proposed_id, proposed_size.size_value
    from unnest(proposed_sizes) as proposed_size(size_value);
  end loop;

  update public.inventory_groups set stock = 0
  where variant_id = p_variant_id and not active;

  delete from public.inventory_groups groups
  where groups.variant_id = p_variant_id and not groups.active and groups.stock = 0
    and groups.legacy_inventory_id is null
    and not exists (select 1 from public.inventory_group_sizes sizes where sizes.inventory_group_id = groups.id);

  return (
    select jsonb_agg(jsonb_build_object(
      'id', groups.id,
      'variant_id', groups.variant_id,
      'stock', groups.stock,
      'active', groups.active,
      'sizes', (select jsonb_agg(sizes.size order by sizes.size)
                from public.inventory_group_sizes sizes where sizes.inventory_group_id = groups.id)
    ) order by groups.created_at, groups.id)
    from public.inventory_groups groups
    where groups.variant_id = p_variant_id and groups.active
  );
end;
$$;

alter table public.inventory_groups enable row level security;
alter table public.inventory_group_sizes enable row level security;

revoke all on public.inventory_groups from anon, authenticated;
revoke all on public.inventory_group_sizes from anon, authenticated;
revoke all on public.inventory_groups_overview from anon, authenticated;
revoke all on function public.admin_save_inventory_groups(uuid, jsonb, boolean) from public, anon, authenticated;
grant all on public.inventory_groups to service_role;
grant all on public.inventory_group_sizes to service_role;
grant select on public.inventory_groups_overview to service_role;
grant execute on function public.admin_save_inventory_groups(uuid, jsonb, boolean) to service_role;

commit;
