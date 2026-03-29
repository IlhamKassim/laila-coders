# AI track — documentation index

All Markdown here describes the **NutriCheck** Gemini path under [`ai-track/`](../) (parent repo: `laila-coders`).

**Path convention:** Bare paths like `scripts/…`, `schemas/…`, `supabase/…` are relative to the **`ai-track/`** directory unless a doc says otherwise.

---

## Reading order

| Order | Doc | What it is |
|------|-----|------------|
| 1 | [phases/PHASE1_PATH.md](phases/PHASE1_PATH.md) | Path C: Gemini + Google Search grounding, `sources[]` from `groundingMetadata`. |
| 2 | [phases/PHASE2.md](phases/PHASE2.md) | CLI prototype, smoke tests, merge/validation, known limitations. |
| 3 | [phases/PHASE3.md](phases/PHASE3.md) | HTTP `POST /analyze`, Supabase worker, shared pipeline, troubleshooting. |
| 4 | [contracts/IRFAN_CONTRACT.md](contracts/IRFAN_CONTRACT.md) | Extension ↔ DB ↔ worker ownership; request/response shapes. |
| 5 | [supabase/SUPABASE_BRIDGE.md](supabase/SUPABASE_BRIDGE.md) | `social_posts` flow, diagrams, worker runbook, security notes. |
| 6 | [phases/PHASE4_CACHE.md](phases/PHASE4_CACHE.md) | `post_hash` dedupe, `post_analysis_cache`, `from_cache` flag. |

---

## Other reference (not in `docs/`)

| Location | Purpose |
|----------|---------|
| [`../prompts/nutrition-v1-system.md`](../prompts/nutrition-v1-system.md) | System instruction for NutriCheck (live prompt). |
| [`../schemas/`](../schemas/) | JSON Schema + TypeScript types for API contracts. |
| [`../examples/`](../examples/) | Example request/response JSON. |
| [`../supabase/migrations/`](../supabase/migrations/) | SQL: `social_posts`, optional RPC, legacy `nutricheck_jobs`, ops views `nutricheck_ops_*` (`20260331120000_ops_dashboard_views.sql`, `20260331130000_ops_latency_tokens.sql`). |
| [`../supabase/sql/fix_postgrest_social_posts_columns.sql`](../supabase/sql/fix_postgrest_social_posts_columns.sql) | Fix PostgREST “schema cache” missing `result` / `error`. |

---

## Phase 4

- **Cache:** [phases/PHASE4_CACHE.md](phases/PHASE4_CACHE.md) (implemented in worker + migration `20260330120000_post_analysis_cache.sql`).
- **Still optional:** auth / rate limits for a public deploy — see the end of [phases/PHASE3.md](phases/PHASE3.md).
