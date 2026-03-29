/**
 * Lightweight validation for the **merged** Nutrition Label v1 payload (extension contract).
 */

export function validateNutritionV1(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["root must be an object"] };
  }
  if (obj.schemaVersion !== "1.0.0") errors.push("schemaVersion must be '1.0.0'");
  if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) {
    errors.push("confidence must be a number in [0, 1]");
  }
  if (typeof obj.summary !== "string" || !obj.summary.trim()) {
    errors.push("summary must be a non-empty string");
  }
  const s = obj.scores;
  if (!s || typeof s !== "object") errors.push("scores must be an object");
  else {
    for (const k of ["credibility", "factualAlignment", "visualIntegrity"]) {
      const v = s[k];
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        errors.push(`scores.${k} must be an integer 0–100`);
      }
    }
  }
  if (!Array.isArray(obj.sources)) errors.push("sources must be an array");
  else {
    obj.sources.forEach((src, i) => {
      if (!src || typeof src.uri !== "string" || !src.uri.trim()) {
        errors.push(`sources[${i}].uri must be a non-empty string`);
      }
    });
  }
  if (!Array.isArray(obj.flags)) errors.push("flags must be an array");
  else if (!obj.flags.every((f) => typeof f === "string")) {
    errors.push("flags must be string[]");
  }
  return { ok: errors.length === 0, errors };
}
