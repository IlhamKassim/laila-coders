-- Matches extension `background.js` → POST /rest/v1/social_posts
-- Irfan sends: raw_text, image_url, platform, status = 'pending_keywords'
-- Worker (Aqil) claims rows, writes result (NutritionLabelAnalysis jsonb) or error.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw_text text not null default '',
  image_url text,
  platform text,
  status text not null default 'pending_keywords',
  result jsonb,
  error text
);

-- If the table already existed (created in dashboard), add worker columns.
alter table public.social_posts add column if not exists result jsonb;
alter table public.social_posts add column if not exists error text;
alter table public.social_posts add column if not exists updated_at timestamptz;
alter table public.social_posts alter column updated_at set default now();

create index if not exists social_posts_status_created_idx
  on public.social_posts (status, created_at asc);

comment on table public.social_posts is 'Instagram scrape → Irfan inserts pending_keywords; worker fills result via Gemini.';

create or replace function public.set_social_posts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_social_posts_updated_at on public.social_posts;
create trigger trg_social_posts_updated_at
  before update on public.social_posts
  for each row execute function public.set_social_posts_updated_at();

-- Optional: PostgREST RPC for atomic claim with SKIP LOCKED.
-- The Node worker (`worker.mjs`) claims via REST + service role instead, so this
-- is not required unless you call the RPC yourself. After creating, reload API
-- schema:  select pg_notify('pgrst', 'reload schema');
create or replace function public.claim_next_social_post()
returns public.social_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.social_posts;
begin
  with picked as (
    select id from public.social_posts
    where status = 'pending_keywords'
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.social_posts t
  set status = 'processing'
  from picked
  where t.id = picked.id
  returning t.* into row;

  return row;
end;
$$;

revoke all on function public.claim_next_social_post() from public;
grant execute on function public.claim_next_social_post() to service_role;

-- Dev RLS (tighten with Maryam before production)
alter table public.social_posts enable row level security;

drop policy if exists "social_posts_anon_insert" on public.social_posts;
create policy "social_posts_anon_insert"
  on public.social_posts for insert to anon
  with check (
    status = 'pending_keywords'
    and result is null
    and error is null
  );

drop policy if exists "social_posts_anon_select" on public.social_posts;
create policy "social_posts_anon_select"
  on public.social_posts for select to anon
  using (true);
