begin;

alter table public.inventory_groups
  add column if not exists physical_size text,
  add column if not exists legacy_sizes text[] not null default array[]::text[];

alter table public.inventory_groups
  drop constraint if exists inventory_groups_physical_size_valid;
alter table public.inventory_groups
  add constraint inventory_groups_physical_size_valid
  check (physical_size is null or physical_size = any (array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA']));

update public.inventory_groups groups
set legacy_sizes = historical.sizes
from (
  select group_sizes.inventory_group_id, array_agg(group_sizes.size order by group_sizes.size) as sizes
  from public.inventory_group_sizes group_sizes
  group by group_sizes.inventory_group_id
) historical
where groups.id = historical.inventory_group_id
  and cardinality(groups.legacy_sizes) = 0;

update public.inventory_groups groups
set physical_size = 'ÚNICA'
where groups.physical_size is null
  and cardinality(groups.legacy_sizes) = 1
  and lower(groups.legacy_sizes[1]) in ('unica', 'única');

create table if not exists public.variant_size_options (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete restrict,
  display_size text not null check (display_size = any (array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA'])),
  inventory_group_id uuid not null references public.inventory_groups(id) on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists variant_size_options_active_size_uidx
  on public.variant_size_options(variant_id, display_size) where active;
create index if not exists variant_size_options_group_idx
  on public.variant_size_options(inventory_group_id);
create index if not exists variant_size_options_variant_sort_idx
  on public.variant_size_options(variant_id, sort_order) where active;

create or replace function public.set_variant_size_option_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists variant_size_options_set_updated_at on public.variant_size_options;
create trigger variant_size_options_set_updated_at
before update on public.variant_size_options
for each row execute function public.set_variant_size_option_updated_at();

create or replace function public.check_variant_size_option_group()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.inventory_groups groups
    where groups.id = new.inventory_group_id and groups.variant_id = new.variant_id
  ) then
    raise exception 'La opción visible y la unidad física deben pertenecer a la misma variante.'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists variant_size_options_check_group on public.variant_size_options;
create trigger variant_size_options_check_group
before insert or update on public.variant_size_options
for each row execute function public.check_variant_size_option_group();

insert into public.variant_size_options(variant_id, display_size, inventory_group_id, active, sort_order)
select
  groups.variant_id,
  case when lower(group_sizes.size) in ('unica', 'única') then 'ÚNICA' else group_sizes.size end,
  groups.id,
  groups.active,
  case group_sizes.size
    when 'XS' then 10 when 'S' then 20 when 'M' then 30 when 'L' then 40
    when 'XL' then 50 when 'XXL' then 60 else 70
  end
from public.inventory_groups groups
join public.inventory_group_sizes group_sizes on group_sizes.inventory_group_id = groups.id
where not exists (
  select 1 from public.variant_size_options options
  where options.variant_id = groups.variant_id
    and options.display_size = case when lower(group_sizes.size) in ('unica', 'única') then 'ÚNICA' else group_sizes.size end
    and options.active
);

create or replace function public.admin_save_inventory_units(
  p_variant_id uuid,
  p_units jsonb,
  p_confirm_reconfigure boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposed_unit jsonb;
  proposed_id uuid;
  proposed_physical_size text;
  proposed_stock integer;
  proposed_display_sizes text[];
  existing_ids uuid[];
  original_stock_total bigint;
  proposed_stock_total bigint := 0;
  configuration_changed boolean;
begin
  if not exists (select 1 from public.variants where id = p_variant_id) then
    raise exception 'La variante no existe.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_units) <> 'array' or jsonb_array_length(p_units) = 0 then
    raise exception 'Debe existir al menos una unidad física.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_variant_id::text, 0));
  select coalesce(array_agg(id), array[]::uuid[]), coalesce(sum(stock), 0)
    into existing_ids, original_stock_total
  from public.inventory_groups where variant_id = p_variant_id and active;

  create temporary table proposed_inventory_units (
    position integer primary key,
    id uuid,
    physical_size text not null,
    stock integer not null,
    display_sizes text[] not null
  ) on commit drop;

  for proposed_unit in select value from jsonb_array_elements(p_units)
  loop
    proposed_id := nullif(proposed_unit->>'id', '')::uuid;
    proposed_physical_size := nullif(proposed_unit->>'physical_size', '');
    proposed_stock := (proposed_unit->>'stock')::integer;
    select coalesce(array_agg(option_value order by option_value), array[]::text[])
      into proposed_display_sizes
    from jsonb_array_elements_text(proposed_unit->'display_sizes') as option(option_value);

    if proposed_physical_size is null or proposed_physical_size <> all (array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA']) then
      raise exception 'Cada unidad requiere una talla física válida confirmada manualmente.' using errcode = '22023';
    end if;
    if proposed_stock < 0 or cardinality(proposed_display_sizes) = 0 then
      raise exception 'Cada unidad requiere stock no negativo y al menos una talla visible.' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(proposed_display_sizes) as option_value(size_value)
      where option_value.size_value <> all (array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA'])
    ) then
      raise exception 'Una talla visible no pertenece a la lista válida de VERANO.' using errcode = '22023';
    end if;
    if proposed_id is not null and not (proposed_id = any(existing_ids)) then
      raise exception 'Una unidad física no pertenece a la variante indicada.' using errcode = '22023';
    end if;
    insert into proposed_inventory_units(position, id, physical_size, stock, display_sizes)
    values ((select count(*) + 1 from proposed_inventory_units), proposed_id, proposed_physical_size, proposed_stock, proposed_display_sizes);
    proposed_stock_total := proposed_stock_total + proposed_stock;
  end loop;

  if exists (
    select option_value.size_value
    from proposed_inventory_units proposed
    cross join lateral unnest(proposed.display_sizes) as option_value(size_value)
    group by option_value.size_value having count(*) > 1
  ) then
    raise exception 'Una talla visible solo puede apuntar a una unidad física activa.' using errcode = '23505';
  end if;

  configuration_changed := exists (
    select 1
    from proposed_inventory_units proposed
    cross join lateral unnest(proposed.display_sizes) as option_value(size_value)
    left join public.variant_size_options current_option
      on current_option.variant_id = p_variant_id
      and current_option.display_size = option_value.size_value
      and current_option.active
    left join public.inventory_groups current_group on current_group.id = current_option.inventory_group_id
    where proposed.id is distinct from current_option.inventory_group_id
       or proposed.physical_size is distinct from current_group.physical_size
  ) or exists (
    select 1 from public.variant_size_options current_option
    where current_option.variant_id = p_variant_id and current_option.active
      and not exists (
        select 1 from proposed_inventory_units proposed
        cross join lateral unnest(proposed.display_sizes) as option_value(size_value)
        where option_value.size_value = current_option.display_size
      )
  );

  if configuration_changed and original_stock_total > 0 then
    if not p_confirm_reconfigure then
      raise exception 'CONFIRM_RECONFIGURE: cambiar tallas físicas o visibles con stock requiere confirmación explícita.' using errcode = 'P0001';
    end if;
    if proposed_stock_total <> original_stock_total then
      raise exception 'La reconfiguración debe conservar el stock total y su reparto debe ser explícito.' using errcode = '22023';
    end if;
  end if;

  update public.inventory_groups set active = false where variant_id = p_variant_id and active;
  update public.variant_size_options set active = false where variant_id = p_variant_id and active;

  for proposed_id, proposed_physical_size, proposed_stock, proposed_display_sizes in
    select id, physical_size, stock, display_sizes from proposed_inventory_units order by position
  loop
    if proposed_id is null then
      insert into public.inventory_groups(variant_id, physical_size, stock, active)
      values (p_variant_id, proposed_physical_size, proposed_stock, true)
      returning id into proposed_id;
    else
      update public.inventory_groups
      set physical_size = proposed_physical_size, stock = proposed_stock, active = true
      where id = proposed_id;
    end if;

    insert into public.variant_size_options(variant_id, display_size, inventory_group_id, active, sort_order)
    select p_variant_id, option_value.size_value, proposed_id, true,
      array_position(array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA'], option_value.size_value) * 10
    from unnest(proposed_display_sizes) as option_value(size_value)
    on conflict (variant_id, display_size) where active
    do update set inventory_group_id = excluded.inventory_group_id,
                  sort_order = excluded.sort_order,
                  updated_at = now();
  end loop;

  update public.inventory_groups set stock = 0
  where variant_id = p_variant_id and not active;

  return (
    select jsonb_agg(jsonb_build_object(
      'id', groups.id,
      'variant_id', groups.variant_id,
      'physical_size', groups.physical_size,
      'legacy_sizes', groups.legacy_sizes,
      'stock', groups.stock,
      'active', groups.active,
      'display_sizes', (
        select jsonb_agg(options.display_size order by options.sort_order)
        from public.variant_size_options options
        where options.inventory_group_id = groups.id and options.active
      )
    ) order by groups.created_at, groups.id)
    from public.inventory_groups groups
    where groups.variant_id = p_variant_id and groups.active
  );
end;
$$;

create or replace view public.inventory_units_overview
with (security_invoker = true)
as
select
  products.id as product_id,
  products.name as product,
  variants.id as variant_id,
  variants.variant_key,
  variants.name as variant,
  groups.id as inventory_group_id,
  groups.physical_size,
  array_agg(options.display_size order by options.sort_order) as display_sizes,
  groups.stock,
  groups.active
from public.inventory_groups groups
join public.variants variants on variants.id = groups.variant_id
join public.products products on products.id = variants.product_id
join public.variant_size_options options on options.inventory_group_id = groups.id and options.active
group by products.id, products.name, variants.id, variants.variant_key, variants.name,
  groups.id, groups.physical_size, groups.stock, groups.active;

alter table public.variant_size_options enable row level security;
revoke all on public.variant_size_options from anon, authenticated;
revoke all on public.inventory_units_overview from anon, authenticated;
revoke all on function public.admin_save_inventory_units(uuid, jsonb, boolean) from public, anon, authenticated;
grant all on public.variant_size_options to service_role;
grant select on public.inventory_units_overview to service_role;
grant execute on function public.admin_save_inventory_units(uuid, jsonb, boolean) to service_role;

commit;
