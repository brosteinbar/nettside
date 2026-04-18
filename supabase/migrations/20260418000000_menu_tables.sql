create table menu_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  sort_order integer not null default 0,
  deleted_at timestamptz default null,
  created_at timestamptz default now()
);

create table menu_items (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references menu_categories(id) on delete cascade,
  name text not null,
  description text default null,
  allergens text default null,
  price integer default null,
  sort_order integer not null default 0,
  deleted_at timestamptz default null,
  created_at timestamptz default now()
);

alter table menu_categories enable row level security;
alter table menu_items enable row level security;

create policy "anon read categories" on menu_categories
  for select to anon using (deleted_at is null);

create policy "anon read items" on menu_items
  for select to anon using (deleted_at is null);

create policy "admin all categories" on menu_categories
  for all to authenticated using (true) with check (true);

create policy "admin all items" on menu_items
  for all to authenticated using (true) with check (true);
