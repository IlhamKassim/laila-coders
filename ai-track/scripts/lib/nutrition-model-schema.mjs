/**
 * Subset of the public Nutrition Label contract for the **model** only.
 * `sources[]` is filled by the CLI/server from groundingMetadata (never from the model).
 *
 * Note: With `google_search` enabled, Gemini REST rejects `responseMimeType: application/json`
 * alongside tools. The CLI uses this schema as documentation and steers the model via prompt;
 * optional future: two-step flow or a no-tools call could pass this as `responseJsonSchema`.
 */
export const nutritionModelJsonSchema = {
  type: "object",
  properties: {
    schemaVersion: {
      type: "string",
      enum: ["1.0.0"],
      description: "Contract version; must be 1.0.0.",
    },
    confidence: {
      type: "number",
      description: "0–1 overall confidence.",
    },
    summary: {
      type: "string",
      description: "Neutral summary; no URLs.",
    },
    scores: {
      type: "object",
      properties: {
        credibility: {
          type: "integer",
          description: "0–100 trustworthiness.",
        },
        factualAlignment: {
          type: "integer",
          description: "0–100 alignment with verifiable facts.",
        },
        visualIntegrity: {
          type: "integer",
          description: "0–100; use 0 if no image provided.",
        },
      },
      required: ["credibility", "factualAlignment", "visualIntegrity"],
    },
    flags: {
      type: "array",
      items: { type: "string" },
      description: "e.g. weak_grounding, disputed_claim, multimodal.",
    },
  },
  required: ["schemaVersion", "confidence", "summary", "scores", "flags"],
};
