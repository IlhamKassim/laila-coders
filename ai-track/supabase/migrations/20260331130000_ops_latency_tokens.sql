-- Phase 4.1 (hackathon): latency + token metrics for ops dashboard.
-- Apply after social_posts + cache tables exist.

alter table public.social_posts
  add column if not exists queue_latency_ms integer,
  add column if not exists processing_latency_ms integer,
  add column if not exists token_prompt integer not null default 0,
  add column if not exists token_output integer not null default 0,
  add column if not exists token_thoughts integer not null default 0,
  add column if not exists token_total integer not null default 0;

comment on column public.social_posts.queue_latency_ms is
  'Time from row creation to worker claim (milliseconds).';
comment on column public.social_posts.processing_latency_ms is
  'Time spent in worker processing after claim (milliseconds).';
comment on column public.social_posts.token_total is
  'Gemini usageMetadata total tokens for this job (0 for cache hits/no usage metadata).';

create or replace view public.nutricheck_ops_perf_tokens as
select
  count(*)::bigint as completed_count,
  coalesce(round(avg(queue_latency_ms))::integer, 0) as avg_queue_latency_ms,
  coalesce(round(avg(processing_latency_ms))::integer, 0) as avg_processing_latency_ms,
  coalesce(max(processing_latency_ms), 0)::integer as max_processing_latency_ms,
  coalesce(sum(token_prompt), 0)::bigint as total_token_prompt,
  coalesce(sum(token_output), 0)::bigint as total_token_output,
  coalesce(sum(token_thoughts), 0)::bigint as total_token_thoughts,
  coalesce(sum(token_total), 0)::bigint as total_token_all,
  coalesce(round(avg(token_total))::integer, 0) as avg_token_per_completed
from public.social_posts
where status = 'completed';

comment on view public.nutricheck_ops_perf_tokens is
  'NutriCheck ops: aggregate queue/processing latency and Gemini token totals over completed jobs.';

create or replace view public.nutricheck_ops_recent_completed as
select id, created_at, platform, from_cache, queue_latency_ms, processing_latency_ms, token_total
from (
  select id, created_at, platform, from_cache, queue_latency_ms, processing_latency_ms, token_total
  from public.social_posts
  where status = 'completed'
  order by created_at desc
  limit 50
) sub;

comment on view public.nutricheck_ops_recent_completed is
  'NutriCheck ops: latest 50 completed rows with latency and token_total.';

revoke all on public.nutricheck_ops_perf_tokens from public;
revoke all on public.nutricheck_ops_recent_completed from public;
grant select on public.nutricheck_ops_perf_tokens to service_role;
grant select on public.nutricheck_ops_recent_completed to service_role;
