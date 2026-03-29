#!/usr/bin/env node
/**
 * Phase 2 — Multimodal + Google Search smoke test (same tool combo as analyze-cli).
 *
 * Verifies the API accepts text + inline image together with google_search.
 *
 * Usage (from this directory):
 *   export GEMINI_API_KEY=...
 *   node multimodal-smoke.mjs                    # 1×1 PNG baked in (zero files)
 *   node multimodal-smoke.mjs --image ./pic.jpg
 *   node multimodal-smoke.mjs --image-url 'https://...'
 *   node multimodal-smoke.mjs --no-search      # vision only (no grounding tool)
 *   node multimodal-smoke.mjs --image ./x.jpg --caption 'Your real post text'
 *
 * Node 20.6+:
 *   node --env-file=../.env multimodal-smoke.mjs
 */

import {
  inlineImagePartTinyPng,
  loadInlineImagePart,
} from "./lib/inline-image-part.mjs";

function parseArgs(argv) {
  const o = { useSearch: true, tiny: true };
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--image") {
      o.imagePath = rest.shift();
      o.tiny = false;
    } else if (a === "--image-url") {
      o.imageUrl = rest.shift();
      o.tiny = false;
    } else if (a === "--no-search") o.useSearch = false;
    else if (a === "--caption") o.caption = rest.shift();
    else {
      console.error("Unknown argument:", a);
      o.help = true;
      break;
    }
  }
  return o;
}

function printHelp() {
  console.log(`multimodal-smoke.mjs — text + image (+ optional Google Search)

Defaults to a tiny embedded PNG so you can run with no image file.

  --image PATH       Local jpeg/png/webp/gif
  --image-url URL    Fetch image (cap 5 MiB)
  --no-search        Omit google_search (vision-only sanity check)
  --caption "…"      Optional post text to pair with the image (verbatim)
  --help

By default there is NO synthetic caption in the prompt—only use --caption (or
GEMINI_MULTIMODAL_CAPTION) when you want caption-vs-image checks.

Env: GEMINI_API_KEY (required), GEMINI_MULTIMODAL_SMOKE_MODEL (optional),
     GEMINI_MULTIMODAL_CAPTION (optional; same as --caption)

For the full NutriCheck payload (confidence, scores, flags, sources[]): use analyze-cli.mjs
with --text and --image / --image-url — not this script.
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}
if (args.imagePath && args.imageUrl) {
  console.error("Use only one of --image or --image-url.");
  process.exit(1);
}

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("Missing GEMINI_API_KEY.");
  process.exit(1);
}

const MODEL =
  process.env.GEMINI_MULTIMODAL_SMOKE_MODEL ?? "gemini-2.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const caption =
  args.caption?.trim() ||
  process.env.GEMINI_MULTIMODAL_CAPTION?.trim() ||
  null;

const userText = caption
  ? `You are sanity-checking a social post. The caption below was supplied verbatim by the tester—do not invent a different caption.

Post caption: ${JSON.stringify(caption)}

Use the attached image. You have Google Search available.

Reply in 4–6 short sentences covering:
1) What the image shows (including anything that looks synthetic, staged, or physically implausible).
2) How the image relates to the caption.

Search / grounding policy (important):
- If the caption asks whether the image is AI-generated, fake, manipulated, or "real", treat that as a signal to USE SEARCH when it can help: e.g. search for the specific disaster/event/location if you can infer it from the image, or for widely reported debunks of similar viral imagery. This API is not reverse-image search, but you should still try web grounding for identifiable real-world hooks.
- If the caption only contains vague questions with no checkable anchor, run at least one targeted search if you can phrase a useful query (e.g. viral flood helicopter dog debunk) when the scene is extreme or uncanny.
- If search returns nothing useful, say so explicitly.

End with whether grounding/search changed your view and what is still uncertain.`
  : `Multimodal API smoke test. An image is attached.

No post caption was provided. Describe only what is visible in the image (2–4 short sentences). Do not attribute a headline or caption to the post unless those exact words appear inside the image (e.g. overlaid text). If the image suggests checkable facts, you may use search; do not invent a caption.`;

let imagePart;
try {
  if (args.tiny) {
    imagePart = inlineImagePartTinyPng();
  } else {
    imagePart = await loadInlineImagePart({
      imagePath: args.imagePath,
      imageUrl: args.imageUrl,
    });
  }
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}

const parts = [{ text: userText }, imagePart];

const body = {
  contents: [{ role: "user", parts }],
};
if (args.useSearch) {
  body.tools = [{ google_search: {} }];
}

console.error(
  `[multimodal-smoke] model=${MODEL} search=${args.useSearch} image=${args.tiny ? "embedded-1x1-png" : args.imagePath || args.imageUrl || "?"} caption=${caption ? "yes" : "no"}\n`,
);

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
if (!candidate?.content?.parts?.length) {
  console.error(
    "No candidate parts.",
    JSON.stringify(json, null, 2),
  );
  process.exit(1);
}

const text =
  candidate.content.parts.map((p) => p.text).filter(Boolean).join("\n") ?? "";
const meta =
  candidate.groundingMetadata ?? candidate.grounding_metadata ?? null;

console.log("--- model text ---\n");
console.log(text);
console.log("\n--- groundingMetadata (null if --no-search or no search run) ---\n");
console.log(JSON.stringify(meta, null, 2));

console.error("\n[ok] Multimodal request succeeded.");
