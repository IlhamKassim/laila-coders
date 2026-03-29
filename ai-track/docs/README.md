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

---

## Other reference (not in `docs/`)

| Location | Purpose |
|----------|---------|
| [`../prompts/nutrition-v1-system.md`](../prompts/nutrition-v1-system.md) | System instruction for NutriCheck (live prompt). |
| [`../schemas/`](../schemas/) | JSON Schema + TypeScript types for API contracts. |
| [`../examples/`](../examples/) | Example request/response JSON. |
| [`../supabase/migrations/`](../supabase/migrations/) | SQL: `social_posts`, optional RPC, legacy `nutricheck_jobs`. |
| [`../supabase/sql/fix_postgrest_social_posts_columns.sql`](../supabase/sql/fix_postgrest_social_posts_columns.sql) | Fix PostgREST “schema cache” missing `result` / `error`. |

---

## Phase 4 (not built yet)

Outlined at the end of [phases/PHASE3.md](phases/PHASE3.md): `post_hash` cache before Gemini, auth/rate limits for public deploy.
