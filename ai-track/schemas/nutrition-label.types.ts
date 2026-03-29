/**
 * NutriCheck / Nutrition Label contract (v1) — mirrors `nutrition-label.schema.json`.
 * Share with Irfan for extension UI typing.
 */

export type SchemaVersion = "1.0.0";

/** One entry per unique grounding chunk URI (from API metadata only). */
export interface NutritionSource {
  uri: string;
  title?: string;
}

export interface NutritionScores {
  credibility: number;
  factualAlignment: number;
  visualIntegrity: number;
}

export interface NutritionLabelAnalysis {
  schemaVersion: SchemaVersion;
  /** 0–1; lower when grounding is weak or absent. */
  confidence: number;
  /** No URLs in this string. */
  summary: string;
  scores: NutritionScores;
  sources: NutritionSource[];
  flags: string[];
  /** Optional; strip in production if you do not want queries exposed to clients. */
  groundingDebug?: Record<string, unknown>;
}
