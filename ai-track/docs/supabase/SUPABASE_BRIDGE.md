# Supabase bridge — **`social_posts`** (Irfan + Aqil)

The extension **`background.js`** POSTs to **`/rest/v1/social_posts`** with the shape below. The **worker** claims rows where **`status = 'pending_keywords'`**, runs Gemini, then updates **`result`** (Nutrition Label JSON) or **`error`**.

## Architecture graph

```mermaid
flowchart TB
  subgraph ext["Chrome extension — Irfan"]
    CS[content.js scrape]
    BG[background.js POST social_posts]
  end

  subgraph supa["Supabase"]
    PG[(social_posts)]
  end

  subgraph worker_host["Aqil — worker.mjs"]
    W[service role\nREST claim row]
  end

  subgraph google["Google"]
    GM[Gemini + google_search]
    IMG[image_url fetch]
  end

  CS --> BG
  BG -->|"anon key\npending_keywords"| PG
  W -->|"claim + UPDATE result"| PG
  W --> GM
  W --> IMG
```

## Sequence

```mermaid
sequenceDiagram
  participant CS as content.js
  participant BG as background.js
  participant DB as social_posts
  participant W as worker_service_role
  participant G as Gemini

  CS->>BG: scraped text + image + platform
  BG->>DB: INSERT raw_text, image_url, platform, status=pending_keywords
  DB-->>BG: row id (return=representation)
  W->>DB: SELECT oldest pending_keywords, then UPDATE → processing
  DB-->>W: claimed row (if still pending)
  W->>G: analyzeNutritionPost(raw_text, image)
  G-->>W: merged JSON
  W->>DB: UPDATE result, status=completed (or failed + error)
  Note over BG,DB: Irfan can SELECT by id until status terminal, then read result
```

## Table columns (contract)

| Column | Writer | Notes |
|--------|--------|-------|
| `id` | DB | UUID. Returned to extension after insert — **poll** `SELECT` by `id`. |
| `raw_text` | Irfan | Caption string from scrape. |
| `image_url` | Irfan | Single HTTPS URL or null. |
| `platform` | Irfan | e.g. `instagram`. |
| `status` | Irfan → Worker | Irfan sets **`pending_keywords`**. Worker: **`processing`** → **`completed`** / **`failed`**. |
| `result` | Worker | `NutritionLabelAnalysis` jsonb when completed. |
| `error` | Worker | Text when failed. |
| `from_cache` | Worker | `true` if `result` was copied from **`post_analysis_cache`** (same `post_hash`, no Gemini call). See [phases/PHASE4_CACHE.md](../phases/PHASE4_CACHE.md). |

SQL: [`supabase/migrations/20260329150000_social_posts.sql`](../../supabase/migrations/20260329150000_social_posts.sql) + cache migration [`20260330120000_post_analysis_cache.sql`](../../supabase/migrations/20260330120000_post_analysis_cache.sql).

## Worker

```bash
cd ai-track/supabase
cp .env.example .env
npm install
node --env-file=.env worker.mjs
```

## Security

- Extension: **anon** key only (never service role / never `GEMINI_API_KEY`).
- RLS in migration is **dev-loose**; tighten before production.

## Alternate: `nutricheck_jobs`

Earlier experiment with `post_text` + `image_urls[]` — see [`20260329120000_nutricheck_jobs.sql`](../../supabase/migrations/20260329120000_nutricheck_jobs.sql). **Not** what `background.js` uses today.

## HTTP `/analyze` (local dev)

[`server/`](../../server/) — direct POST without Supabase.

- [Documentation index](../README.md)
