-- Phase 4 — dedupe Gemini: same normalized caption + image → reuse stored result.
-- If a previous run failed (e.g. missing updated_at), use sql/repair_post_analysis_cache.sql
-- then: select pg_notify('pgrst', 'reload schema');

create table if not exists public.post_analysis_cache (
  post_hash text primary key,
  result jsonb not null,
  hit_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_analysis_cache_updated_idx
  on public.post_analysis_cache (updated_at desc);

comment on table public.post_analysis_cache is 'NutriCheck: cache NutritionLabelAnalysis by post hash; worker upserts on miss.';

create or replace function public.set_post_analysis_cache_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_post_analysis_cache_updated_at on public.post_analysis_cache;
create trigger trg_post_analysis_cache_updated_at
  before update on public.post_analysis_cache
  for each row execute function public.set_post_analysis_cache_updated_at();

alter table public.social_posts add column if not exists from_cache boolean not null default false;
comment on column public.social_posts.from_cache is 'True when result was copied from post_analysis_cache (no Gemini call for that row).';

alter table public.post_analysis_cache enable row level security;

revoke all on table public.post_analysis_cache from public;
revoke all on table public.post_analysis_cache from anon, authenticated;

-- Worker uses SUPABASE_SERVICE_ROLE_KEY (DB role service_role). Needs schema usage + table privileges.
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
