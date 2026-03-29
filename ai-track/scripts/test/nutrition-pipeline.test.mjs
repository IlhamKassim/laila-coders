/**
 * Offline "fake" tests — no Gemini API. Run from repo:
 *   node --test ai-track/scripts/test/nutrition-pipeline.test.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { extractJsonFromModelText } from "../lib/extract-model-json.mjs";
import {
  mergeNutritionPayload,
  MAX_CONFIDENCE_NO_SOURCES,
} from "../lib/merge-nutrition-payload.mjs";
import { sourcesFromGrounding } from "../lib/sources-from-grounding.mjs";
import { validateNutritionV1 } from "../lib/validate-nutrition.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (name) =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));

const modelJson = () => fx("fake-model-json.json");
const groundingWithSources = () => fx("fake-grounding-metadata.json");

describe("extractJsonFromModelText", () => {
  test("plain object", () => {
    const j = extractJsonFromModelText('{"a":1}');
    assert.equal(JSON.parse(j).a, 1);
  });
  test("markdown fence", () => {
    const j = extractJsonFromModelText("```json\n{\"x\":2}\n```");
    assert.equal(JSON.parse(j).x, 2);
  });
  test("prose around object", () => {
    const j = extractJsonFromModelText('Here:\n{"z":3}\nthanks');
    assert.equal(JSON.parse(j).z, 3);
  });
});

describe("sourcesFromGrounding", () => {
  test("dedupes by uri", () => {
    const src = sourcesFromGrounding(groundingWithSources());
    assert.equal(src.length, 2);
    assert.ok(src.every((s) => s.uri.includes("example")));
  });
  test("empty metadata", () => {
    assert.equal(sourcesFromGrounding(null).length, 0);
    assert.equal(sourcesFromGrounding({}).length, 0);
  });
});

describe("mergeNutritionPayload", () => {
  test("no grounding: weak_grounding, confidence cap, multimodal", () => {
    const m = modelJson();
    const out = mergeNutritionPayload(m, null, { hasImage: true });
    assert.ok(out.flags.includes("weak_grounding"));
    assert.ok(out.flags.includes("multimodal"));
    assert.equal(out.sources.length, 0);
    assert.ok(out.confidence <= MAX_CONFIDENCE_NO_SOURCES);
    assert.equal(out.confidence, Math.min(m.confidence, MAX_CONFIDENCE_NO_SOURCES));
  });
  test("with sources: no confidence cap, sources merged", () => {
    const m = modelJson();
    const out = mergeNutritionPayload(m, groundingWithSources(), {
      hasImage: true,
    });
    assert.equal(out.sources.length, 2);
    assert.equal(out.confidence, m.confidence);
    assert.ok(!out.flags.includes("weak_grounding"));
    assert.ok(out.flags.includes("multimodal"));
    assert.ok(out.groundingDebug?.webSearchQueries?.length);
  });
  test("text-only: no multimodal flag from merge", () => {
    const out = mergeNutritionPayload(modelJson(), groundingWithSources(), {
      hasImage: false,
    });
    assert.ok(!out.flags.includes("multimodal"));
  });
});

describe("validateNutritionV1", () => {
  test("accepts merged payload with sources", () => {
    const out = mergeNutritionPayload(modelJson(), groundingWithSources(), {
      hasImage: true,
    });
    const { ok, errors } = validateNutritionV1(out);
    assert.ok(ok, errors.join("; "));
  });
  test("rejects broken payload", () => {
    const { ok, errors } = validateNutritionV1({
      schemaVersion: "0.0.0",
      confidence: 2,
      summary: "",
      scores: {},
      sources: [],
      flags: [],
    });
    assert.equal(ok, false);
    assert.ok(errors.length > 0);
  });
});
