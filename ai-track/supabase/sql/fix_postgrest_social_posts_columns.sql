-- Run in Supabase → SQL Editor if the worker logs:
--   "Could not find the 'error' column of 'social_posts' in the schema cache"
-- (Same fix if `result` is missing from the cache.)

alter table public.social_posts add column if not exists result jsonb;
alter table public.social_posts add column if not exists error text;

-- Refresh PostgREST so REST sees new columns
select pg_notify('pgrst', 'reload schema');
