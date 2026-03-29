-- Run in Supabase SQL Editor if cache migration failed partway, e.g.:
--   ERROR: column "updated_at" does not exist
--   or PostgREST: column post_analysis_cache.result / post_hash / social_posts.from_cache missing
--
-- This drops the broken cache table (cache rows are lost) and recreates it cleanly.
-- Then reload the API schema.

drop trigger if exists trg_post_analysis_cache_updated_at on public.post_analysis_cache;
drop index if exists public.post_analysis_cache_updated_idx;
drop table if exists public.post_analysis_cache cascade;

create or replace function public.set_post_analysis_cache_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.post_analysis_cache (
  post_hash text primary key,
  result jsonb not null,
  hit_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index post_analysis_cache_updated_idx on public.post_analysis_cache (updated_at desc);

create trigger trg_post_analysis_cache_updated_at
  before update on public.post_analysis_cache
  for each row execute function public.set_post_analysis_cache_updated_at();

alter table public.social_posts add column if not exists from_cache boolean not null default false;

alter table public.post_analysis_cache enable row level security;
revoke all on table public.post_analysis_cache from public;
revoke all on table public.post_analysis_cache from anon, authenticated;

grant usage on schema public to service_role;
grant all privileges on table public.post_analysis_cache to service_role;
grant all privileges on table public.post_analysis_cache to postgres;

drop policy if exists "post_analysis_cache_service_role" on public.post_analysis_cache;
create policy "post_analysis_cache_service_role"
  on public.post_analysis_cache
  for all
  to service_role
  using (true)
  with check (true);

select pg_notify('pgrst', 'reload schema');
