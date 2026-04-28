create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text default null,
  cron text default null,
  date date default null,
  start_time time not null,
  end_time time default null,
  created_at timestamptz default now()
);

alter table events enable row level security;

-- Public only sees recurring events and upcoming one-time events
create policy "anon read events" on events
  for select to anon
  using (cron is not null or date >= current_date);

-- Authenticated users see and manage everything
create policy "admin all events" on events
  for all to authenticated using (true) with check (true);
