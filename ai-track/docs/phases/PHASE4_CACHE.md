# Phase 4 — Post analysis cache (`post_hash`)

## Goal

If the **same post** is scraped twice (same normalized caption + primary image URL), the worker **reuses** the stored **`NutritionLabelAnalysis`** instead of calling Gemini again: **lower cost**, **stable result**, **faster** completion.

## How it works

1. **`post_hash`** — SHA-256 over a small JSON payload (`scripts/lib/post-hash.mjs`): hash version, normalized text, normalized image URL (query string stripped on Instagram / Meta CDNs so URLs don’t thrash).
2. **Table `post_analysis_cache`** — `post_hash` (PK), `result` (jsonb), `hit_count`, timestamps. Written by the worker after a **fresh** Gemini run; read on subsequent jobs with the same hash.
3. **`social_posts.from_cache`** — `true` when that row’s `result` was copied from cache (good for demos / analytics).

## Apply

Run the SQL migration on your Supabase project:

[`supabase/migrations/20260330120000_post_analysis_cache.sql`](../../supabase/migrations/20260330120000_post_analysis_cache.sql)

Then reload the API schema if PostgREST complains:

```sql
select pg_notify('pgrst', 'reload schema');
```

### If migration failed partway (`updated_at` missing, PostgREST “schema cache” errors)

Run the one-shot repair (drops `post_analysis_cache` rows, recreates table + `from_cache`):

[`supabase/sql/repair_post_analysis_cache.sql`](../../supabase/sql/repair_post_analysis_cache.sql)

It ends with `pg_notify` so PostgREST picks up `post_hash`, `result`, `from_cache`, etc.

### `permission denied for table post_analysis_cache`

The worker must use the **service_role** key (Dashboard → Settings → API → **service_role** secret, long `eyJ…` — not the anon/publishable key).

Then run [`supabase/sql/grant_post_analysis_cache.sql`](../../supabase/sql/grant_post_analysis_cache.sql) (grants + RLS policy for `service_role`).

## Worker env

| Variable | Effect |
|----------|--------|
| `WORKER_CACHE_DISABLED=1` | Always call Gemini; never read/write `post_analysis_cache`. |

## Limits (hackathon‑honest)

- Hash uses **caption + first image URL**, not file bytes — same image at a **different URL** is a **miss**.
- Changing IG CDN query params **after** normalization could still change URL rarely — then it’s a miss.
- **Invalidate** old cache by deleting rows in `post_analysis_cache` or bumping the hash version in code.

- [Documentation index](../README.md)
