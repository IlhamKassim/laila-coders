-- Operational dashboard (hackathon): read-only aggregates for NutriCheck ops.
-- Query via service_role (local dashboard server) or SQL Editor.
-- PostgREST: select pg_notify('pgrst', 'reload schema'); after apply.

-- Queue depth: one row per status present in social_posts
create or replace view public.nutricheck_ops_queue_by_status as
select status, count(*)::bigint as cnt
from public.social_posts
group by status;

comment on view public.nutricheck_ops_queue_by_status is
  'NutriCheck ops: job counts by status (pending_keywords, processing, completed, failed).';

-- Completed rows only: cache reuse vs fresh Gemini
create or replace view public.nutricheck_ops_completed_cache as
select
  count(*) filter (where from_cache = true)::bigint as from_cache_count,
  count(*) filter (where from_cache = false)::bigint as fresh_gemini_count
from public.social_posts
where status = 'completed';

comment on view public.nutricheck_ops_completed_cache is
  'NutriCheck ops: among completed jobs, how many reused post_analysis_cache vs new Gemini.';

-- Global cache table stats (dedupe store + cumulative hits)
create or replace view public.nutricheck_ops_cache_table as
select
  count(*)::bigint as cache_entries,
  coalesce(sum(hit_count), 0)::bigint as total_cache_hits
from public.post_analysis_cache;

comment on view public.nutricheck_ops_cache_table is
  'NutriCheck ops: post_analysis_cache row count and sum(hit_count).';

-- Recent failures for triage (capped)
create or replace view public.nutricheck_ops_recent_failures as
select id, created_at, coalesce(error, '') as error, platform
from (
  select id, created_at, error, platform
  from public.social_posts
  where status = 'failed'
  order by created_at desc
  limit 50
) sub;

comment on view public.nutricheck_ops_recent_failures is
  'NutriCheck ops: up to 50 most recent failed jobs.';

revoke all on public.nutricheck_ops_queue_by_status from public;
revoke all on public.nutricheck_ops_completed_cache from public;
revoke all on public.nutricheck_ops_cache_table from public;
revoke all on public.nutricheck_ops_recent_failures from public;

grant select on public.nutricheck_ops_queue_by_status to service_role;
grant select on public.nutricheck_ops_completed_cache to service_role;
grant select on public.nutricheck_ops_cache_table to service_role;
grant select on public.nutricheck_ops_recent_failures to service_role;
