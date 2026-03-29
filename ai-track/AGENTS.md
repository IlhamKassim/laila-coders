# AI track — notes for agents & editors

Use this file for **fast orientation** when editing or answering questions about `ai-track/`. For humans, start with [`README.md`](README.md).

---

## Scope

- **Product:** NutriCheck — multimodal “nutrition label” style analysis (credibility, grounding, visuals) for social posts.  
- **Stack:** Node (ESM `.mjs`), Gemini + Google Search grounding, optional `node:http` server (`server/`), Supabase (`social_posts` + worker).  
- **Path convention:** Paths below are relative to **`ai-track/`** unless stated.

---

## Entry points (do not guess)

| Role | Path | Notes |
|------|------|--------|
| Shared Gemini + merge logic | `scripts/lib/gemini-nutrition-analyze.mjs` | Used by CLI and server/worker pipeline |
| Full pipeline wrapper | `scripts/lib/run-nutrition-analyze-pipeline.mjs` | Phase 3 shared path |
| CLI | `scripts/analyze-cli.mjs` | Args: `--text`, `--image`, `--image-url`, `--raw`, `--no-validate` |
| HTTP server | `server/index.mjs` | `npm start` from `server/` |
| Supabase worker | `supabase/worker.mjs` | `npm run worker` from `supabase/`; optional **`post_analysis_cache`** via `post-hash.mjs` |
| Ops dashboard (local) | `supabase/dashboard.mjs` | `npm run dashboard` — `127.0.0.1` only; reads `nutricheck_ops_*` views |
| Post dedupe hash | `scripts/lib/post-hash.mjs` | `computePostHash` for cache keys; see `docs/phases/PHASE4_CACHE.md` |
| System prompt (source of truth) | `prompts/nutrition-v1-system.md` | Keep in sync with analysis behavior docs |

---

## Contracts & validation

- **JSON Schema / types:** `schemas/`  
- **Examples:** `examples/`  
- **Extension ↔ backend:** `docs/contracts/IRFAN_CONTRACT.md` — ownership of fields, request/response shapes  
- **DB & worker flow:** `docs/supabase/SUPABASE_BRIDGE.md`

When changing API shapes, update **schemas**, **examples**, and **IRFAN_CONTRACT** together where applicable.

---

## Environment variables

| Context | File | Required |
|---------|------|----------|
| Scripts (Phase 1–2) | `.env` at `ai-track/` (from `.env.example`) | `GEMINI_API_KEY` |
| Worker + Supabase tests | `supabase/.env` (from `supabase/.env.example`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` |

Optional tuning (worker): see comments in `supabase/.env.example` (`WORKER_POLL_IDLE_MS`, `ANALYZE_MAX_IMAGES`, etc.).

**Security:** Never commit real keys. Do not embed API keys in Markdown or committed `.env` files.

---

## Phases (mental model)

1. **Phase 1** — Gemini + grounding, `sources[]` from `groundingMetadata` — `docs/phases/PHASE1_PATH.md`  
2. **Phase 2** — CLI, validation, smoke tests — `docs/phases/PHASE2.md`  
3. **Phase 3** — HTTP `/analyze`, Supabase worker, shared pipeline — `docs/phases/PHASE3.md`  
4. **Phase 4** — Planned (cache, auth, rate limits) — end of `PHASE3.md`

---

## SQL & migrations

- Migrations: `supabase/migrations/`  
- Ad-hoc fixes: e.g. `supabase/sql/fix_postgrest_social_posts_columns.sql` (PostgREST schema cache)

---

## Doc index

Full reading order: [`docs/README.md`](docs/README.md).
