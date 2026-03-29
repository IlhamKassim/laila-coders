# Phase 2 — CLI prototype (AI track)

## Scope

- **Prompts:** `prompts/nutrition-v1-system.md` (system instruction for NutriCheck).
- **JSON shape:** The Gemini API does **not** allow `responseMimeType: application/json` together with the `google_search` tool. The CLI uses a strict system prompt (“JSON only, no fences”) and **`JSON.parse`** on the model text (still validated after merge). The file `scripts/lib/nutrition-model-schema.mjs` documents the model-only field set for tooling/docs.
- **Grounding:** Same `google_search` tool as Phase 1; **`sources[]` is always built from `groundingMetadata`** in `scripts/lib/sources-from-grounding.mjs`, then merged into the final payload.
- **Multimodal:** Optional `--image` / `--image-url` (inline base64 per REST).
- **Validation:** `scripts/lib/validate-nutrition.mjs` checks the **merged** object against the public v1 contract.

No Supabase in this phase.

**Irfan handoff:** See [`IRFAN_CONTRACT.md`](../contracts/IRFAN_CONTRACT.md) (request vs response), [`examples/analyze-request.example.json`](../../examples/analyze-request.example.json), and [`examples/nutrition-label.response.example.json`](../../examples/nutrition-label.response.example.json) (sanitized golden response).

## Run

### Multimodal smoke (check vision + tools before full CLI)

From `ai-track/scripts` (with `GEMINI_API_KEY` set):

```bash
node multimodal-smoke.mjs                           # embedded 1×1 PNG + google_search
node multimodal-smoke.mjs --image ./your-photo.jpg  # real image
node multimodal-smoke.mjs --no-search               # vision only (no grounding tool)
```

Optional: `GEMINI_MULTIMODAL_SMOKE_MODEL`, `--caption '…'` or `GEMINI_MULTIMODAL_CAPTION` (only if you want a caption-vs-image check). The script no longer injects a default fake caption.

## Offline tests (no API key)

Fake fixtures + merge/validation logic only:

```bash
# from repo root (laila-coders/)
node --test ai-track/scripts/test/nutrition-pipeline.test.mjs
```

This does **not** call Gemini; it checks JSON extraction, `sources[]` dedupe, confidence cap without sources, and schema validation. Live multimodal + search behavior is still manual.

**Why search sometimes stays empty:** With `google_search`, the **model** decides whether to run queries. Short captions like “is this AI?” used to be treated as “no factual claim,” so search often did not run. The smoke prompt now pushes authenticity questions toward **targeted** searches (event/debunk hooks). Grounding is still **not** reverse-image search; it’s web text search driven by the model’s queries.

### Full NutriCheck CLI

```bash
node analyze-cli.mjs --text 'Your post caption…'
node analyze-cli.mjs --text '…' --image /path/to/photo.jpg
node analyze-cli.mjs --text '…' --image-url https://example.com/x.jpg
```

In **zsh**, prefer **single quotes** for `--text` when the caption contains `!` (otherwise you may get a `dquote>` prompt from history expansion).

Optional: `GEMINI_ANALYZE_MODEL` (default `gemini-2.5-flash`). Use `--raw` to dump the full API response to stderr.

## Outputs

- **Stdout:** Token usage line, then JSON matching `schemas/nutrition-label.schema.json` (including `sources` from grounding).
- **Flags:** CLI adds `multimodal` when an image is present, and `weak_grounding` when normalized `sources` is empty (deduped with model flags).

## Known limitations — synthetic / “AI?” detection (fix later)

**Caption framing steers the model.** For ambiguous photos, paraphrasing the user question (“is this AI?” vs “is this real?”) can push answers in opposite directions. That is **LLM bias**, not a reliable detector. We are **not** solving that in Phase 2.

**Hard ceiling today.** Path C uses **Gemini vision + optional web grounding**. There is no dedicated **AI-generated image classifier**, **provenance** (C2PA), or **reverse-image** pipeline. Borderline images will stay uncertain; high `confidence` on “AI vs real” from the model alone should be treated skeptically (we already cap overall `confidence` when `sources` is empty).

**Future directions (when you come back to this):**

- **Neutral analysis prompt** for the extension (same user-facing question → stable internal instruction; avoid echoing leading wording in the model’s reasoning).
- **Separate signals:** keep **visualIntegrity / credibility** as “suspicion” and **separate** from “we proved AI” unless a dedicated tool or strong grounding says so.
- **Optional upgrades:** provenance APIs, third-party synthetic-media detectors, or human-in-the-loop for gray-zone content.

Until then, document in the product that **authenticity calls are indicative, not forensic**.

## Next (Phase 3)

Implemented: see [`PHASE3.md`](PHASE3.md) — `ai-track/server` (`POST /analyze`, capped image fetch, shared pipeline with this CLI).

- [Documentation index](../README.md)
