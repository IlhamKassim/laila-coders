import {
  sourcesFromGrounding,
  groundingDebugFromMetadata,
} from "./sources-from-grounding.mjs";

/** No usable web citations — cap confidence so we do not imply search-backed certainty. */
export const MAX_CONFIDENCE_NO_SOURCES = 0.55;

export function mergeNutritionPayload(modelJson, groundingMeta, { hasImage }) {
  const sources = sourcesFromGrounding(groundingMeta);
  const flags = new Set(
    Array.isArray(modelJson.flags) ? modelJson.flags : [],
  );
  if (hasImage) flags.add("multimodal");
  if (sources.length === 0) flags.add("weak_grounding");

  let confidence = Number(modelJson.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.max(0, Math.min(1, confidence));
  if (sources.length === 0) {
    confidence = Math.min(confidence, MAX_CONFIDENCE_NO_SOURCES);
  }

  const debug = groundingDebugFromMetadata(groundingMeta);
  const out = {
    schemaVersion: "1.0.0",
    confidence,
    summary: modelJson.summary,
    scores: modelJson.scores,
    sources,
    flags: [...flags],
  };
  if (debug?.webSearchQueries?.length) {
    out.groundingDebug = debug;
  }
  return out;
}
