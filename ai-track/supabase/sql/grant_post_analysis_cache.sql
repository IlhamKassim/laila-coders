-- Run if worker logs: permission denied for table post_analysis_cache
-- (Keeps existing rows; only fixes privileges + RLS policy.)

grant usage on schema public to service_role;
grant all privileges on table public.post_analysis_cache to service_role;

drop policy if exists "post_analysis_cache_service_role" on public.post_analysis_cache;
create policy "post_analysis_cache_service_role"
  on public.post_analysis_cache
  for all
  to service_role
  using (true)
  with check (true);

select pg_notify('pgrst', 'reload schema');
