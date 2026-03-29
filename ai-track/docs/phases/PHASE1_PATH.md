# Phase 1 — Path decision (AI / Gemini track)

## Confirmed: Path C (primary)

- **Path C — Gemini + Google Search grounding** is the primary approach for NutriCheck analysis.
- Post text (and later images in multimodal calls) goes to Gemini with the **`google_search`** tool enabled.
- **Citations / `sources[]`** for the UI are derived from API **`groundingMetadata`** (see `schemas/` and `scripts/grounding-smoke.mjs`), not from free-form URLs in model prose.

## Fallbacks (no Supabase in Phase 1 scripts)

1. **Thin or missing grounding** — If search is not used or metadata is sparse, the contract still returns a valid payload with **lower confidence**, an **honest summary**, and **`sources: []`** (Path B–style behavior without inventing links).
2. **Later: Supabase cache** — Phase 4 adds cache lookup/write; **Phase 1–2 scripts do not** use Supabase or any DB.

## Constraints (unchanged)

- **`GEMINI_API_KEY` stays server-side** in production (`POST /analyze`); local smoke tests use env on the developer machine only, never in the extension.

## References

- [Grounding with Google Search (Gemini API)](https://ai.google.dev/gemini-api/docs/google-search)
- [Documentation index](../README.md)
