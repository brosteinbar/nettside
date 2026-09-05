-- Leverandørkatalog: produkter importert fra grossister (først Vinhuset), slik
-- at admin kan søke på produsent/produkt på nettsiden. Tabellen har en
-- leverandør-diskriminator (vendor) så Hansa, Asko m.fl. kan legges til senere.
--
-- Skriving skjer KUN fra importskriptet (scripts/import-vinhuset.mjs) som kjører
-- i GitHub Actions med service-role-nøkkelen (omgår RLS). Klienten har bare
-- lesetilgang, og bare for admin (is_admin(), se 20260902000000_timestempling.sql).
--
-- Fremtidige utvidelser (ikke bygget her):
--   alter table wine_items add column vendor_product_id uuid references vendor_products(id);
--   favoritter nøklet på (user_id, vendor, producer) og (user_id, vendor_product_id)
--   -> derfor trimmes produsentnavn i importen.

create extension if not exists pg_trgm;

-- Leverandører -----------------------------------------------------------------
create table vendors (
  id text primary key,                       -- 'vinhuset' | senere 'hansa', 'asko'
  name text not null,
  created_at timestamptz not null default now()
);

insert into vendors (id, name) values ('vinhuset', 'Vinhuset');

-- Produkter --------------------------------------------------------------------
create table vendor_products (
  id uuid primary key default gen_random_uuid(),
  vendor text not null references vendors(id),
  vendor_product_id text not null,           -- leverandørens varenummer (Vinhuset ItemId)
  vendor_record_id bigint,                   -- Vinhuset RecordId (pris-/lager-API senere)
  name text not null,
  producer text,                             -- VH-Produsent (trimmet)
  importer text,                             -- VH-Importør
  category text,                             -- VP-Hovedkategori (null for ikke-vin)
  subcategory text,                          -- VP-Mellomkategori
  country text,                              -- VH-Opprinnelsesland, ellers VP-Land
  region text,                               -- VH-Distrikt, ellers VP-Distrikt
  subregion text,                            -- VP-Underdistrikt
  vintage text,                              -- VH-Årgang, ellers VP-År (fritekst)
  grapes text,                               -- VP-Ingredienser
  volume_cl numeric,                         -- VH-Volum(cl)
  abv numeric,                               -- VH-ABV, ellers VP-Alkohol verdi
  price numeric,                             -- Vinhusets listepris (NOK, uten kundeavtale)
  retail_price numeric,                      -- VP-Pris (Vinmonopolet)
  vinmonopolet_id text,                      -- VH-Polnummer
  stock_status text,                         -- VH-Beholdning ('På lager' | 'Bestillingsvare')
  lifecycle text,                            -- VH-Livssyklus
  organic boolean,                           -- VH-Økologisk = 'Ja'
  image_url text,
  description text,
  unit text,                                 -- DefaultUnitOfMeasure
  attributes jsonb not null default '{}'::jsonb,  -- alle råattributter nøklet på KeyName
  is_active boolean not null default true,   -- false = ikke sett i siste fulle import
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor, vendor_product_id)
);

create index vendor_products_producer_trgm   on vendor_products using gin (producer gin_trgm_ops);
create index vendor_products_name_trgm       on vendor_products using gin (name gin_trgm_ops);
create index vendor_products_vendor_producer on vendor_products (vendor, producer);
create index vendor_products_category        on vendor_products (vendor, category);
create index vendor_products_country         on vendor_products (vendor, country);

-- Importkjøringer ----------------------------------------------------------------
create table import_runs (
  id uuid primary key default gen_random_uuid(),
  vendor text not null references vendors(id),
  status text not null check (status in ('running', 'success', 'failed')),
  trigger_source text,                       -- 'schedule' | 'workflow_dispatch' | 'local'
  producer_filter text,                      -- null = full import
  dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  pages_fetched int not null default 0,
  products_seen int not null default 0,
  products_upserted int not null default 0,
  products_deactivated int not null default 0,
  error text
);

create index import_runs_vendor_started on import_runs (vendor, started_at desc);

-- Views for søk og filtre --------------------------------------------------------
-- security_invoker: RLS på vendor_products gjelder også gjennom viewene.
create view vendor_producers with (security_invoker = true) as
  select vendor,
         producer,
         count(*) filter (where is_active) as product_count,
         array_agg(distinct country)  filter (where country  is not null) as countries,
         array_agg(distinct category) filter (where category is not null) as categories
  from vendor_products
  where producer is not null
  group by vendor, producer;

create view vendor_product_categories with (security_invoker = true) as
  select vendor, category, count(*) as product_count
  from vendor_products
  where is_active and category is not null
  group by vendor, category;

create view vendor_product_countries with (security_invoker = true) as
  select vendor, country, count(*) as product_count
  from vendor_products
  where is_active and country is not null
  group by vendor, country;

-- RLS: kun admin kan lese, ingen klientskriving -----------------------------------
alter table vendors         enable row level security;
alter table vendor_products enable row level security;
alter table import_runs     enable row level security;

create policy "admin read vendors" on vendors
  for select to authenticated using (is_admin());
create policy "admin read vendor products" on vendor_products
  for select to authenticated using (is_admin());
create policy "admin read import runs" on import_runs
  for select to authenticated using (is_admin());
