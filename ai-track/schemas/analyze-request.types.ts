/**
 * Request body for POST /analyze (Phase 3).
 * Pair with `analyze-request.schema.json` and `examples/analyze-request.example.json`.
 */

export type AnalyzeRequestSchemaVersion = "1.0.0";

export interface AnalyzePostMetadata {
  platform?: string;
  postId?: string;
  permalink?: string;
  [key: string]: unknown;
}

/** What the extension sends to the backend (not to Gemini). */
export interface AnalyzePostRequest {
  schemaVersion: AnalyzeRequestSchemaVersion;
  postText: string;
  /** Omit or [] when there is no image to analyze. */
  imageUrls?: string[];
  metadata?: AnalyzePostMetadata;
}
