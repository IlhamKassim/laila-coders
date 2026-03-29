/**
 * One path for Phase 2 CLI patterns, Phase 3 HTTP /analyze, and Supabase worker:
 * fetch images → Gemini (nutrition + grounding) → merge → validate.
 */
import { analyzeNutritionPost } from "./gemini-nutrition-analyze.mjs";
import { fetchImageUrlsAsInlineParts } from "./fetch-image-urls.mjs";
import { validateNutritionV1 } from "./validate-nutrition.mjs";

function defaultFetchOpts() {
  return {
    maxImages: Number(process.env.ANALYZE_MAX_IMAGES) || 8,
    maxBytesPerImage:
      Number(process.env.ANALYZE_MAX_IMAGE_BYTES) || 5 * 1024 * 1024,
    timeoutMsPerUrl:
      Number(process.env.ANALYZE_IMAGE_FETCH_TIMEOUT_MS) || 15_000,
  };
}

/**
 * Map a `social_posts` row (Irfan insert) to analyze inputs.
 * @param {{ raw_text?: string, image_url?: string | null }} row
 */
export function socialPostRowToAnalyzeInput(row) {
  const postText =
    typeof row?.raw_text === "string" && row.raw_text.trim()
      ? row.raw_text.trim()
      : "(no caption)";
  const u = row?.image_url;
  const imageUrls =
    !u || typeof u !== "string" ? [] : [u.trim()].filter(Boolean);
  return { postText, imageUrls };
}

/**
 * @param {{
 *   apiKey: string,
 *   postText: string,
 *   imageUrls?: string[],
 *   fetchOpts?: { maxImages?: number, maxBytesPerImage?: number, timeoutMsPerUrl?: number }
 * }} opts
 */
export async function runNutritionAnalyzePipeline({
  apiKey,
  postText,
  imageUrls = [],
  fetchOpts = {},
}) {
  const inlineParts = await fetchImageUrlsAsInlineParts(imageUrls, {
    ...defaultFetchOpts(),
    ...fetchOpts,
  });
  const { merged, usage } = await analyzeNutritionPost({
    apiKey,
    postText,
    inlineImageParts: inlineParts,
  });
  const { ok, errors } = validateNutritionV1(merged);
  if (!ok) {
    const err = new Error(`Validation: ${errors.join("; ")}`);
    err.validationErrors = errors;
    throw err;
  }
  if (process.env.STRIP_GROUNDING_DEBUG === "1") {
    delete merged.groundingDebug;
  }
  return { merged, usage };
}
