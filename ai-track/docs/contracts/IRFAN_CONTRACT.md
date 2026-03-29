# Irfan — NutriCheck contracts

## Who owns what (so you can work in parallel)

| Area | Owner (typical) | What they do |
|------|-----------------|--------------|
| **Scrape + filter** | Irfan (extension / content scripts) | Decide **which** caption text and **which** image URLs belong to the post; normalize or drop junk before insert. |
| **Insert + wait** | Irfan | `INSERT` into **`social_posts`** (`pending_keywords`), keep **`id`** from `return=representation`, then **poll** / **Realtime** until `status` is `completed` or `failed`; read **`result`** or **`error`**. |
| **Process jobs** | You (Aqil) — **worker** | REST claim (`pending_keywords` → `processing`) with **service role**, fetch `image_url` → Gemini → `UPDATE` **`result`** / **`failed`**. Optional SQL RPC `claim_next_social_post()` in the same migration for `SKIP LOCKED` if you prefer RPC. |
| **Table + RLS (+ optional RPC)** | Maryam / shared SQL | [`20260329150000_social_posts.sql`](../../supabase/migrations/20260329150000_social_posts.sql); tighten RLS when ready. |

Worker only depends on **`raw_text`**, **`image_url`**, **`platform`**, and **`status = 'pending_keywords'`** on insert. Irfan only depends on **`result`** matching **`NutritionLabelAnalysis`** when `status = 'completed'`.

---

## Primary flow: **`social_posts`** (matches `background.js`)

1. **INSERT** into **`public.social_posts`**: `raw_text`, `image_url`, `platform`, **`status: "pending_keywords"`** (see extension `background.js`).
2. Response includes **`id`** (use **`Prefer: return=representation`**).
3. **Poll** `SELECT` by `id` until **`status`** is **`completed`** or **`failed`**.
4. Read **`result`** (Nutrition Label JSON) or **`error`**.

Diagrams + SQL: [`SUPABASE_BRIDGE.md`](../supabase/SUPABASE_BRIDGE.md), [`supabase/migrations/20260329150000_social_posts.sql`](../../supabase/migrations/20260329150000_social_posts.sql).  
Example: [`examples/supabase-job-row.example.json`](../../examples/supabase-job-row.example.json).

**Column mapping** (extension → DB):

| Extension / concept | DB column |
|--------------------|-----------|
| `payload.text` | `raw_text` |
| `payload.image` | `image_url` |
| `payload.platform` | `platform` |
| (fixed) | `status` = `pending_keywords` on insert |

**Worker-set columns (read-only for Irfan):** `result`, `error`, **`from_cache`** (`true` when the analysis was reused from `post_analysis_cache` — same normalized post, no second Gemini call). See [phases/PHASE4_CACHE.md](../phases/PHASE4_CACHE.md).

**Older alternate table** `nutricheck_jobs` (`post_text`, `image_urls[]`) — see [`20260329120000_nutricheck_jobs.sql`](../../supabase/migrations/20260329120000_nutricheck_jobs.sql) — not used by current `background.js`.

---

## Alternate flow: HTTP `POST /analyze` (local / dev)

For quick tests without Supabase:

- **`POST /analyze`** with JSON body = **`AnalyzePostRequest`** → immediate **`NutritionLabelAnalysis`** response.

See [`PHASE3.md`](../phases/PHASE3.md) and [`server/`](../../server/).

---

## Request shape (reference) — `AnalyzePostRequest`

Same fields whether you send JSON over HTTP or map them into **`social_posts`** / legacy **`nutricheck_jobs`**:

| Field | Required | Purpose |
|--------|----------|--------|
| `schemaVersion` | yes (HTTP) / default (DB) | `"1.0.0"` until you bump. |
| `postText` | yes | Caption / visible text. |
| `imageUrls` | no | `https://...` URLs; worker/server fetches with caps. `[]` or omit = text-only. |
| `metadata` | no | `platform`, `postId`, `permalink`, etc. |

**Files:** `schemas/analyze-request.schema.json`, `schemas/analyze-request.types.ts`, `examples/analyze-request.example.json`.

---

## Response — `NutritionLabelAnalysis`

Stored in **`social_posts.result`** when `status = 'completed'` (primary flow). Legacy **`nutricheck_jobs.result`** used the same JSON shape if you still have that table.

`confidence`, `summary`, `scores`, `sources`, `flags`, optional `groundingDebug`.

- **`sources[]`:** From server-side **grounding metadata**, not model-invented URLs.
- **`groundingDebug`:** Optional; strip in production if desired.

**Files:** `schemas/nutrition-label.schema.json`, `schemas/nutrition-label.types.ts`, `examples/nutrition-label.response.example.json`.

- [Documentation index](../README.md)
