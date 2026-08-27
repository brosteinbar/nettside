-- Vinmeny: wine categories + wine items (bottles only).
-- Mirrors menu_categories/menu_items conventions: uuid ids, sort_order,
-- soft-delete via deleted_at, RLS anon-read / authenticated-all.

create table wine_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  sort_order integer not null default 0,
  deleted_at timestamptz default null,
  created_at timestamptz default now()
);

create table wine_items (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references wine_categories(id) on delete cascade,
  name text not null,
  producer text default null,
  grape text default null,
  vintage text default null, -- free text: "2019", "NV", "2020/21"
  country text default null,
  region text default null,
  notes text default null,
  price integer default null,
  sort_order integer not null default 0,
  deleted_at timestamptz default null,
  created_at timestamptz default now()
);

alter table wine_categories enable row level security;
alter table wine_items enable row level security;

create policy "anon read wine categories" on wine_categories
  for select to anon using (deleted_at is null);

create policy "anon read wine items" on wine_items
  for select to anon using (deleted_at is null);

create policy "admin all wine categories" on wine_categories
  for all to authenticated using (true) with check (true);

create policy "admin all wine items" on wine_items
  for all to authenticated using (true) with check (true);
