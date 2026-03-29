#!/usr/bin/env node
/**
 * Phase 1 — Grounding smoke test (Google Search tool).
 * Docs: https://ai.google.dev/gemini-api/docs/google-search
 *
 * Usage (from this directory):
 *   export GEMINI_API_KEY=... && node grounding-smoke.mjs
 * Or copy ../.env.example to ../.env, add the key, then (Node 20.6+):
 *   node --env-file=../.env grounding-smoke.mjs
 *
 * Prints model text (truncated) and full groundingMetadata for inspection.
 */

const MODEL = process.env.GEMINI_GROUNDING_MODEL ?? "gemini-2.5-flash";
const PROMPT =
  process.env.GEMINI_SMOKE_PROMPT ?? "Who won UEFA Euro 2024? Answer in one sentence.";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("Missing GEMINI_API_KEY in environment.");
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const body = {
  contents: [
    {
      role: "user",
      parts: [{ text: PROMPT }],
    },
  ],
  // REST body matches official curl: https://ai.google.dev/gemini-api/docs/google-search
  tools: [{ google_search: {} }],
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    "x-goog-api-key": key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("API error:", res.status, JSON.stringify(json, null, 2));
  process.exit(1);
}

const candidate = json.candidates?.[0];
const text =
  candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ?? "";
const meta = candidate?.groundingMetadata ?? candidate?.grounding_metadata;

console.log("--- model text (first 500 chars) ---\n");
console.log(text.slice(0, 500) + (text.length > 500 ? "…" : ""));
console.log("\n--- groundingMetadata (full JSON) ---\n");
console.log(JSON.stringify(meta ?? null, null, 2));

if (!meta) {
  console.warn("\n[warn] No groundingMetadata on candidate — try a prompt that clearly needs search, or check model/region support.");
}
