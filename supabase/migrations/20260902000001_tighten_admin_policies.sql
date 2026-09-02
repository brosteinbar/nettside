-- Rollseparasjon: tidligere ga "admin all"-policyene full skrivetilgang til
-- ALLE innloggede brukere. Med den delte kontorbrukeren (timestempling) må
-- skriving begrenses til admin (admin_users / is_admin(), se
-- 20260902000000_timestempling.sql).
--
-- I tillegg: "anon read"-policyene gjaldt bare rollen anon, mens innloggede
-- ikke-admins (kontorbrukeren) tidligere leste via "admin all". Nye
-- lesepolicyer gir kontorbrukeren samme offentlige lesetilgang som anon.

-- menu_categories
drop policy "admin all categories" on menu_categories;
create policy "admin all categories" on menu_categories
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "authenticated read categories" on menu_categories
  for select to authenticated using (deleted_at is null);

-- menu_items
drop policy "admin all items" on menu_items;
create policy "admin all items" on menu_items
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "authenticated read items" on menu_items
  for select to authenticated using (deleted_at is null);

-- events
drop policy "admin all events" on events;
create policy "admin all events" on events
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "authenticated read events" on events
  for select to authenticated using (cron is not null or date >= current_date);

-- wine_categories
drop policy "admin all wine categories" on wine_categories;
create policy "admin all wine categories" on wine_categories
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "authenticated read wine categories" on wine_categories
  for select to authenticated using (deleted_at is null);

-- wine_items
drop policy "admin all wine items" on wine_items;
create policy "admin all wine items" on wine_items
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "authenticated read wine items" on wine_items
  for select to authenticated using (deleted_at is null);

-- menu_settings
drop policy "admin all menu settings" on menu_settings;
create policy "admin all menu settings" on menu_settings
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "authenticated read menu settings" on menu_settings
  for select to authenticated using (true);
