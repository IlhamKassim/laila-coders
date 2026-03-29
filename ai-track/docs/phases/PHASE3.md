# Phase 3 — analyze pipeline (HTTP + Supabase)

## Supabase bridge (Irfan’s extension)

**Table + worker:** see [`SUPABASE_BRIDGE.md`](../supabase/SUPABASE_BRIDGE.md).

- Extension **`background.js`** inserts **`social_posts`** with **`status: pending_keywords`** (`raw_text`, `image_url`, `platform`).
- **`supabase/worker.mjs`** claims the oldest **`pending_keywords`** row via **REST** (service role), runs the same pipeline as **`POST /analyze`** (`run-nutrition-analyze-pipeline.mjs`), writes **`result`** / **`error`**, logs **token usage** on stdout. Optional SQL RPC `claim_next_social_post()` exists in migrations but is not required.

---

## HTTP `POST /analyze` (optional local server)

Minimal **Node HTTP** server in `server/` that:

- Accepts **`AnalyzePostRequest`** JSON on **`POST /analyze`** (see [`IRFAN_CONTRACT.md`](../contracts/IRFAN_CONTRACT.md) + `schemas/analyze-request.schema.json`).
- Fetches **`imageUrls`** server-side with **HTTPS-only**, **count**, **byte**, and **timeout** caps (`fetch-image-urls.mjs`).
- Calls Gemini with **`GEMINI_API_KEY`** only on the server (`scripts/lib/gemini-nutrition-analyze.mjs` — same path as the Phase 2 CLI).
- Returns **`NutritionLabelAnalysis`** JSON (validated before send).

## Run

From `ai-track/server`:

```bash
cp .env.example .env
# edit .env — set GEMINI_API_KEY

npm start
# or: node index.mjs
# optional: node --env-file=.env index.mjs
```

- **`GET /health`** — `{ ok: true, geminiConfigured: boolean }`
- **`POST /analyze`** — body = `examples/analyze-request.example.json` shape

### curl

```bash
curl -sS http://127.0.0.1:8787/health
curl -sS http://127.0.0.1:8787/analyze \
  -H 'Content-Type: application/json' \
  -d '{"schemaVersion":"1.0.0","postText":"Hello world"}'
```

## Test Supabase read (Phase 3 wiring)

Confirm the project reaches **`social_posts`** (no Gemini needed):

```bash
cd ai-track/supabase
cp .env.example .env
# Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard → Settings → API

node --env-file=.env test-fetch.mjs
# or: npm run test-fetch
```

Optional: `test-fetch.mjs --id <uuid>` for one row. If you see **RLS** or **empty** with anon, use **service role** for this test.

## CORS

Default **`Access-Control-Allow-Origin: *`** for local dev. Set **`CORS_ORIGIN`** to a specific origin in production if needed.

## Shared code

- **`scripts/lib/run-nutrition-analyze-pipeline.mjs`** — shared by **`server/index.mjs`** and **`supabase/worker.mjs`** (fetch images → Gemini → validate).
- **`scripts/lib/gemini-nutrition-analyze.mjs`** — also used by **`analyze-cli.mjs`**.

## Troubleshooting

**`EADDRINUSE` on 8787** — Another process (often a previous `node index.mjs`) is bound to that port.

```bash
PORT=8788 npm start
# or
lsof -i :8787    # then kill that PID if it is yours
```

**PostgREST “Could not find the `error` column … schema cache”** — Run [`supabase/sql/fix_postgrest_social_posts_columns.sql`](../../supabase/sql/fix_postgrest_social_posts_columns.sql) in the Supabase SQL Editor.

## Next (Phase 4)

- Supabase cache by `post_hash` before calling Gemini.
- Auth / rate limits for public deploy.

- [Documentation index](../README.md)
