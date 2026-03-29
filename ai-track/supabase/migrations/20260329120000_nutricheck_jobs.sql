-- Alternate / earlier job table shape (post_text + image_urls jsonb).
-- The live Chrome extension uses **public.social_posts** — see 20260329150000_social_posts.sql.
-- Apply in Supabase SQL editor or via supabase db push.

create table if not exists public.nutricheck_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  request_schema_version text not null default '1.0.0',
  post_text text not null,
  image_urls jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  result jsonb,
  error text
);

create index if not exists nutricheck_jobs_status_created_idx
  on public.nutricheck_jobs (status, created_at asc);

comment on table public.nutricheck_jobs is 'Async bridge: extension inserts pending; worker sets processing→completed/failed with Gemini result in result jsonb.';

-- Keep updated_at fresh (optional; worker also sets it)
create or replace function public.set_nutricheck_jobs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_nutricheck_jobs_updated_at on public.nutricheck_jobs;
create trigger trg_nutricheck_jobs_updated_at
  before update on public.nutricheck_jobs
  for each row execute function public.set_nutricheck_jobs_updated_at();

-- One pending row → processing, atomically (multi-worker safe)
create or replace function public.claim_next_nutricheck_job()
returns public.nutricheck_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.nutricheck_jobs;
begin
  with picked as (
    select id from public.nutricheck_jobs
    where status = 'pending'
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.nutricheck_jobs j
  set status = 'processing'
  from picked
  where j.id = picked.id
  returning j.* into job;

  return job;
end;
$$;

revoke all on function public.claim_next_nutricheck_job() from public;
grant execute on function public.claim_next_nutricheck_job() to service_role;

-- RLS: enable when Maryam wires auth. Until then, use service role on worker only;
-- extension typically uses anon + policies OR an Edge Function proxy (see docs/supabase/SUPABASE_BRIDGE.md).
alter table public.nutricheck_jobs enable row level security;

-- Dev-friendly: allow anon to insert pending rows and read any row (REPLACE before prod).
create policy "nutricheck_anon_insert_pending"
  on public.nutricheck_jobs for insert to anon
  with check (status = 'pending' and result is null and error is null);

create policy "nutricheck_anon_select"
  on public.nutricheck_jobs for select to anon
  using (true);

-- Worker uses service_role (bypasses RLS). If you run worker as anon, add update policies — do not.
