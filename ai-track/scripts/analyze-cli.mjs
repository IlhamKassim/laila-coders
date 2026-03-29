#!/usr/bin/env node
/**
 * Phase 2 — CLI: multimodal post + Google Search grounding + JSON parsed from text
 * (API forbids application/json MIME type together with tools).
 * Uses the same core as Phase 3 server: `lib/gemini-nutrition-analyze.mjs`.
 *
 * Usage:
 *   export GEMINI_API_KEY=...
 *   node analyze-cli.mjs --text 'Your post caption here...'   # single quotes if text contains !
 *   node analyze-cli.mjs --text "..." --image ./photo.jpg
 *   node analyze-cli.mjs --text "..." --image-url https://example.com/p.jpg
 *
 * Options:
 *   --raw          Print full API JSON (stderr); stdout: token line then merged JSON
 *   --no-validate  Skip local contract validation
 */

import { loadInlineImagePart } from "./lib/inline-image-part.mjs";
import {
  analyzeNutritionPost,
  formatGeminiUsageLine,
} from "./lib/gemini-nutrition-analyze.mjs";
import { validateNutritionV1 } from "./lib/validate-nutrition.mjs";

function parseArgs(argv) {
  const o = { raw: false, validate: true };
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--text") o.text = rest.shift();
    else if (a === "--image") o.imagePath = rest.shift();
    else if (a === "--image-url") o.imageUrl = rest.shift();
    else if (a === "--raw") o.raw = true;
    else if (a === "--no-validate") o.validate = false;
    else {
      console.error("Unknown argument:", a);
      o.help = true;
      break;
    }
  }
  return o;
}

function printHelp() {
  console.log(`analyze-cli.mjs — Phase 2 NutriCheck prototype

Required:
  --text "…"           Post caption / visible text

Optional:
  --image PATH         Local image file (jpeg/png/webp/gif)
  --image-url URL      Fetch image (cap ~5 MiB)
  --raw                Log full API response to stderr
  --no-validate        Skip merged JSON checks

Environment:
  GEMINI_API_KEY       Required
  GEMINI_ANALYZE_MODEL Optional (default: gemini-2.5-flash)

Shell (zsh): use single quotes around --text if the caption contains ! (history expansion).
  Example: node analyze-cli.mjs --text 'Breaking: … overnight!'
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.text) {
  printHelp();
  process.exit(args.help ? 0 : 1);
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

const inlineImageParts = [];
const imagePart = await loadInlineImagePart({
  imagePath: args.imagePath,
  imageUrl: args.imageUrl,
}).catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
if (imagePart) inlineImageParts.push(imagePart);

let merged;
let geminiRaw;
let usage;
try {
  const out = await analyzeNutritionPost({
    apiKey: key,
    postText: args.text,
    inlineImageParts,
  });
  merged = out.merged;
  geminiRaw = out.geminiRaw;
  usage = out.usage;
} catch (e) {
  console.error(e.message || e);
  if (args.raw && e.geminiBody) {
    console.error(JSON.stringify(e.geminiBody, null, 2));
  }
  if (e.modelRawText) {
    console.error("Model text:\n", e.modelRawText);
  }
  process.exit(1);
}

if (args.raw) {
  console.error("--- full API response ---\n", JSON.stringify(geminiRaw, null, 2));
}

if (args.validate) {
  const { ok, errors } = validateNutritionV1(merged);
  if (!ok) {
    console.error("Validation failed:", errors.join("; "));
    console.error("Merged payload:", JSON.stringify(merged, null, 2));
    process.exit(1);
  }
}

console.log(formatGeminiUsageLine("[analyze-cli]", usage));
console.log(JSON.stringify(merged, null, 2));
