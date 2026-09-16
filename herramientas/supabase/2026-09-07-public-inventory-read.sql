begin;

alter table public.variants enable row level security;
alter table public.inventory_groups enable row level security;
alter table public.variant_size_options enable row level security;

drop policy if exists variants_public_active_read on public.variants;
create policy variants_public_active_read on public.variants
for select to anon, authenticated
using (active);

drop policy if exists inventory_groups_public_active_read on public.inventory_groups;
create policy inventory_groups_public_active_read on public.inventory_groups
for select to anon, authenticated
using (active);

drop policy if exists variant_size_options_public_active_read on public.variant_size_options;
create policy variant_size_options_public_active_read on public.variant_size_options
for select to anon, authenticated
using (active);

create or replace view public.public_inventory_availability
with (security_invoker = true)
as
select
  variants.product_id,
  variants.variant_key,
  variants.id as variant_id,
  options.display_size,
  options.inventory_group_id,
  groups.stock,
  true as active
from public.variants variants
join public.variant_size_options options
  on options.variant_id = variants.id
join public.inventory_groups groups
  on groups.id = options.inventory_group_id
 and groups.variant_id = variants.id
where variants.active
  and options.active
  and groups.active;

revoke all on public.variants from anon, authenticated;
revoke all on public.inventory_groups from anon, authenticated;
revoke all on public.variant_size_options from anon, authenticated;
revoke all on public.public_inventory_availability from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select (id, product_id, variant_key, active)
  on public.variants to anon, authenticated;
grant select (id, variant_id, stock, active)
  on public.inventory_groups to anon, authenticated;
grant select (variant_id, display_size, inventory_group_id, active)
  on public.variant_size_options to anon, authenticated;
grant select on public.public_inventory_availability to anon, authenticated;

commit;

notify pgrst, 'reload schema';
