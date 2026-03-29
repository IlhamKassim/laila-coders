# NutriCheck — AI track (Path C)

Multimodal nutrition and authenticity analysis for social posts using **Gemini** with **Google Search** grounding. This folder holds Node scripts, JSON schemas, an optional local HTTP API, and a **Supabase** worker that bridges the Chrome extension to the same analysis pipeline.

**Parent repo:** [`laila-coders`](../README.md) — NutriCheck browser extension.

---

## What lives here

| Area | Purpose |
|------|---------|
| [`scripts/`](scripts/) | CLI and shared libs (`gemini-nutrition-analyze`, validation, pipeline) |
| [`schemas/`](schemas/) & [`examples/`](examples/) | API contracts and sample JSON |
| [`prompts/`](prompts/) | Live system instruction for NutriCheck |
| [`server/`](server/) | Local HTTP API: `POST /analyze`, `GET /health` |
| [`supabase/`](supabase/) | Migrations, SQL helpers, `worker.mjs` (polls `social_posts`) |
| [`docs/`](docs/README.md) | Phases, Irfan contract, Supabase bridge diagrams |

Unless a doc says otherwise, paths are relative to **`ai-track/`**.

---

## Prerequisites

- **Node.js** (18+ recommended) for scripts, server, and worker  
- **Gemini API key** — set `GEMINI_API_KEY` (see env files below)  
- **Supabase** — for the worker: project URL + service role key in `supabase/.env`

---

## Quick start

**1. Environment**

- Phase 1–2 scripts: copy [`ai-track/.env.example`](.env.example) → `ai-track/.env` and set `GEMINI_API_KEY`.  
- Worker: copy [`supabase/.env.example`](supabase/.env.example) → `supabase/.env` and set `SUPABASE_*` + `GEMINI_API_KEY`.

**2. CLI (Phase 2)**

From `ai-track/scripts/` (with `GEMINI_API_KEY` in the environment):

```bash
node analyze-cli.mjs --text 'Your caption here'
node analyze-cli.mjs --text "..." --image ./photo.jpg
```

**3. Local HTTP API (Phase 3)**

From `ai-track/server/` (configure `.env` as needed):

```bash
npm install   # once
npm start
```

**4. Supabase worker**

From `ai-track/supabase/`:

```bash
npm install   # once
npm run worker
```

---

## Documentation

| Start here | Link |
|------------|------|
| **Doc index** (reading order, phases) | [`docs/README.md`](docs/README.md) |
| Extension ↔ DB contract | [`docs/contracts/IRFAN_CONTRACT.md`](docs/contracts/IRFAN_CONTRACT.md) |
| Supabase flow & runbook | [`docs/supabase/SUPABASE_BRIDGE.md`](docs/supabase/SUPABASE_BRIDGE.md) |

---

## Regenerating the README ([ReadmeAI](https://github.com/eli64s/readme-ai))

You can refresh or expand this README with **[ReadmeAI](https://github.com/eli64s/readme-ai)** — a Python CLI that scans a repo and generates structured Markdown (overview, features, directory tree, setup hints) using an LLM or **offline** mode.

**Install:** Python 3.9+ recommended. Use a virtual environment or [pipx](https://pypa.github.io/pipx/): `pipx install "readmeai[google-generativeai]"` (Gemini). See the [project README](https://github.com/eli64s/readme-ai) for pip, uv, and Docker options.

**Gemini API key:** ReadmeAI uses `GOOGLE_API_KEY`. If you only export `GEMINI_API_KEY` for this repo, run:

`export GOOGLE_API_KEY="$GEMINI_API_KEY"`

**Generate from `ai-track/`** (review the file, then merge what you want into `README.md`):

```bash
cd ai-track
readmeai --repository . --api gemini --model gemini-2.0-flash -o README.readmeai.md
# No API key: offline template-style output
readmeai --repository . --api offline -o README.readmeai.md
```

Scan exclusions for `node_modules`, `.env`, and venvs live in [`.readmeaiignore`](.readmeaiignore). If `pip install` fails on bleeding-edge Python (e.g. missing wheels for dependencies), use Python 3.11–3.12 in a venv or follow the [official troubleshooting](https://github.com/eli64s/readme-ai).

---

## Notes for AI assistants & editors

Structured repo map, entry points, and invariants: **[`AGENTS.md`](AGENTS.md)**.
