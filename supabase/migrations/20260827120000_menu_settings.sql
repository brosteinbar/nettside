-- Per-menu visibility toggle: admins can hide a menu from visitors
-- while working on it. Anon must be able to read the flag.

create table menu_settings (
  menu_key text primary key,
  visible boolean not null default true,
  updated_at timestamptz default now()
);

alter table menu_settings enable row level security;

create policy "anon read menu settings" on menu_settings
  for select to anon using (true);

create policy "admin all menu settings" on menu_settings
  for all to authenticated using (true) with check (true);

insert into menu_settings (menu_key, visible) values ('meny', true), ('vinmeny', true);
