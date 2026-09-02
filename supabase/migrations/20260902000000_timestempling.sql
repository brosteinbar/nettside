-- Timestempling (personalliste, jf. bokføringsforskriften / Skatteetatens krav til
-- personalliste for serveringssteder).
--
-- Roller:
--   * admin  = auth-bruker med rad i admin_users (full tilgang)
--   * kontor = auth-bruker UTEN rad i admin_users (kan kun kjøre clock_toggle
--              og currently_clocked_in — ingenting annet)
--   * anon   = ingen tilgang til noe her
--
-- Sporbarhet: time_entries kan aldri slettes (ingen delete-policy). Alle
-- admin-korrigeringer logges automatisk (trigger) i entry_corrections.

-- ── admin_users ────────────────────────────────────────────────────────────

create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table admin_users enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from admin_users where user_id = auth.uid()) $$;

create policy "self read admin_users" on admin_users
  for select to authenticated using (user_id = auth.uid());
-- Ingen insert/update/delete-policyer: rader administreres via SQL editor / seed under.

-- Seed admin-brukeren.
insert into admin_users (user_id)
  select id from auth.users where email = 'paal@brosteinbar.com'
  on conflict do nothing;

-- ── employees ──────────────────────────────────────────────────────────────
-- PIN lagres i klartekst: et firesifret rom er trivielt å brute-force uansett
-- hashing, admin-UI må kunne vise koden, og unikhet krever constraint.
-- Beskyttelsen er RLS (kun admin kan lese tabellen) + SECURITY DEFINER-RPC.

create table employees (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  pin text not null check (pin ~ '^[0-9]{4}$'),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Unik PIN blant aktive ansatte (en sluttet ansatts PIN kan gjenbrukes).
create unique index employees_active_pin on employees (pin) where deleted_at is null;

alter table employees enable row level security;

create policy "admin all employees" on employees
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── time_entries ───────────────────────────────────────────────────────────

create table time_entries (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references employees(id),
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  created_at timestamptz default now(),
  check (clock_out is null or clock_out >= clock_in)
);

-- Maks én åpen stempling per ansatt (hard garanti mot dobbel innstempling).
create unique index time_entries_one_open on time_entries (employee_id) where clock_out is null;

alter table time_entries enable row level security;

create policy "admin select entries" on time_entries
  for select to authenticated using (is_admin());
create policy "admin insert entries" on time_entries
  for insert to authenticated with check (is_admin());
create policy "admin update entries" on time_entries
  for update to authenticated using (is_admin()) with check (is_admin());
-- Bevisst INGEN delete-policy: stemplinger skal aldri kunne slettes.
-- Annullering = sett clock_out = clock_in med notat.

-- ── entry_corrections (revisjonslogg) ──────────────────────────────────────

create table entry_corrections (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid not null references time_entries(id),
  edited_by uuid not null,
  edited_at timestamptz not null default now(),
  old_clock_in timestamptz,
  old_clock_out timestamptz,
  new_clock_in timestamptz,
  new_clock_out timestamptz,
  note text
);

alter table entry_corrections enable row level security;

create policy "admin read corrections" on entry_corrections
  for select to authenticated using (is_admin());
-- Ingen insert-policy: rader skrives kun av triggeren (security definer).

create or replace function log_entry_correction() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Kontorbrukerens clock_toggle-oppdateringer er ordinær drift, ikke korrigeringer.
  if is_admin() then
    insert into entry_corrections
      (entry_id, edited_by, old_clock_in, old_clock_out, new_clock_in, new_clock_out, note)
    values
      (old.id, auth.uid(), old.clock_in, old.clock_out, new.clock_in, new.clock_out,
       nullif(current_setting('app.correction_note', true), ''));
  end if;
  return new;
end $$;

create trigger trg_log_entry_correction
  before update on time_entries for each row
  when (old.clock_in is distinct from new.clock_in
     or old.clock_out is distinct from new.clock_out)
  execute function log_entry_correction();

-- ── RPC: clock_toggle (kontorbrukerens eneste skrivevei) ───────────────────

create or replace function clock_toggle(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_emp employees;
  v_open time_entries;
begin
  select * into v_emp from employees where pin = p_pin and deleted_at is null;
  if not found then
    perform pg_sleep(0.5);  -- bremser gjetting
    return json_build_object('status', 'invalid_pin');
  end if;

  select * into v_open from time_entries
    where employee_id = v_emp.id and clock_out is null
    for update;  -- serialiserer dobbelt-trykk

  if found then
    update time_entries set clock_out = now() where id = v_open.id;
    return json_build_object('status', 'clocked_out', 'name', v_emp.name,
                             'clock_in', v_open.clock_in, 'clock_out', now());
  else
    insert into time_entries (employee_id) values (v_emp.id);
    return json_build_object('status', 'clocked_in', 'name', v_emp.name, 'clock_in', now());
  end if;
end $$;

revoke execute on function clock_toggle(text) from public, anon;
grant execute on function clock_toggle(text) to authenticated;

-- ── RPC: currently_clocked_in (inspektørtabellen) ──────────────────────────

create or replace function currently_clocked_in()
returns table (entry_id uuid, name text, clock_in timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, e.name, t.clock_in
  from time_entries t
  join employees e on e.id = t.employee_id
  where t.clock_out is null
  order by t.clock_in
$$;

revoke execute on function currently_clocked_in() from public, anon;
grant execute on function currently_clocked_in() to authenticated;

-- ── RPC: correct_entry (admin-korrigering med notat) ───────────────────────
-- SECURITY INVOKER: RLS gjelder fortsatt, så bare admin får oppdatert noe.

create or replace function correct_entry(
  p_entry_id uuid,
  p_clock_in timestamptz,
  p_clock_out timestamptz,
  p_note text
) returns void language plpgsql as $$
begin
  perform set_config('app.correction_note', coalesce(p_note, ''), true);
  update time_entries
    set clock_in = p_clock_in, clock_out = p_clock_out
    where id = p_entry_id;
  if not found then
    raise exception 'Fant ikke stemplingen, eller mangler tilgang.';
  end if;
end $$;

revoke execute on function correct_entry(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function correct_entry(uuid, timestamptz, timestamptz, text) to authenticated;
