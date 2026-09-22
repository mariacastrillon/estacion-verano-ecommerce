import { readFile } from 'node:fs/promises';

// El DDL inicial de products/variants/inventory no esta versionado en el repo.
// Fixture minimo del contrato utilizado por las herramientas existentes.
export const baseSchema = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE TABLE public.products(id text PRIMARY KEY, name text NOT NULL, price_cop bigint NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.variants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id text NOT NULL REFERENCES public.products,
  variant_key text NOT NULL, name text NOT NULL, active boolean NOT NULL DEFAULT true, UNIQUE(product_id, variant_key));
CREATE TABLE public.inventory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid REFERENCES public.variants,
  size text, stock integer DEFAULT 0, active boolean DEFAULT true);
`;

export async function installSchema(db) {
  await db.exec(baseSchema);
  for (const file of ['2026-09-05-inventory-groups.sql', '2026-09-06-physical-size-options.sql',
    '2026-09-07-public-inventory-read.sql', '2026-09-15-inventory-physical-units.sql', '2026-09-21-orders-reservations.sql']) {
    await db.exec(await readFile(new URL(`../../herramientas/supabase/${file}`, import.meta.url), 'utf8'));
  }
}

export async function seed(db, compatibilities = [['M', 'L'], ['M']], suffix = '') {
  const product = `test-product${suffix}`;
  await db.query('insert into products(id,name,price_cop) values ($1,$2,80000)', [product, 'Producto prueba']);
  const variant = (await db.query("insert into variants(product_id,variant_key,name) values ($1,'negro','Negro') returning id", [product])).rows[0].id;
  const groups = [{ display_sizes: ['M', 'L'], units: compatibilities.map((sizes) => ({ physical_size: 'M', display_sizes: sizes })) }];
  const saved = (await db.query('select admin_save_inventory_physical_units($1,$2::jsonb) as groups', [variant, JSON.stringify(groups)])).rows[0].groups;
  const items = (sizes = ['M', 'L']) => sizes.map((size) => ({ product_id: product, variant_id: variant, display_size: size, quantity: 1 }));
  return { product, variant, groups: saved, items };
}

export async function reserve(db, items, key, customer = 'customer-test') {
  return (await db.query('select reserve_order($1,$2,$3::jsonb) as result', [customer, key, JSON.stringify(items)])).rows[0].result;
}

export async function transition(db, id, action, customer = 'customer-test') {
  return (await db.query('select transition_order($1,$2,$3) as result', [id, customer, action])).rows[0].result;
}
