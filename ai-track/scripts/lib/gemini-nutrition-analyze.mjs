/**
 * Shared Gemini call + merge for CLI and Phase 3 server.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { extractJsonFromModelText } from "./extract-model-json.mjs";
import { mergeNutritionPayload } from "./merge-nutrition-payload.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {Record<string, unknown>} json Top-level generateContent response
 * @returns {{ prompt: number, output: number, thoughts?: number, total: number } | null}
 */
export function geminiUsageFromResponse(json) {
  const u = json?.usageMetadata ?? json?.usage_metadata;
  if (!u || typeof u !== "object") return null;
  const prompt =
    Number(u.promptTokenCount ?? u.prompt_token_count ?? NaN) || 0;
  const output =
    Number(u.candidatesTokenCount ?? u.candidates_token_count ?? NaN) || 0;
  const thoughtsRaw =
    u.thoughtsTokenCount ?? u.thoughts_token_count ?? undefined;
  const thoughts =
    thoughtsRaw != null ? Number(thoughtsRaw) || 0 : undefined;
  const total =
    Number(u.totalTokenCount ?? u.total_token_count ?? NaN) ||
    prompt + output + (thoughts ?? 0);
  const hasThoughts = thoughts != null && thoughts > 0;
  if (!prompt && !output && !hasThoughts) return null;
  const o = { prompt, output, total };
  if (hasThoughts) o.thoughts = thoughts;
  return o;
}

/** One line for stdout / stderr (worker, CLI). */
export function formatGeminiUsageLine(prefix, usage) {
  if (!usage) return `${prefix} tokens (API did not return usageMetadata)`;
  const parts = [`prompt=${usage.prompt}`, `output=${usage.output}`];
  if (usage.thoughts != null) parts.push(`thoughts=${usage.thoughts}`);
  parts.push(`total=${usage.total}`);
  return `${prefix} tokens ${parts.join(" ")}`;
}

function loadSystemPrompt() {
  const p = join(__dirname, "../../prompts/nutrition-v1-system.md");
  return readFileSync(p, "utf8");
}

/**
 * @param {{
 *   apiKey: string,
 *   postText: string,
 *   inlineImageParts?: object[],
 *   model?: string,
 * }} opts
 * @returns {Promise<{ merged: object, geminiRaw: object, usage: object | null }>}
 */
export async function analyzeNutritionPost({
  apiKey,
  postText,
  inlineImageParts = [],
  model = process.env.GEMINI_ANALYZE_MODEL ?? "gemini-2.5-flash",
}) {
  const systemText = loadSystemPrompt();
  let userText = `## Post caption\n${postText}\n`;
  const hasImage = inlineImageParts.length > 0;
  if (hasImage) {
    userText += `
An image is attached. Assess visual integrity and whether it aligns with the caption.
If the caption or scene raises authenticity (AI-generated, fake, manipulated) or checkable real-world events, use Google Search when it could surface debunks or reporting (e.g. similar viral imagery). You still output only the JSON fields required by the system prompt.
`;
  }

  const parts = [{ text: userText }, ...inlineImageParts];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts }],
    tools: [{ google_search: {} }],
  };

  const timeoutMs = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || 120_000;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(tid);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      json?.error?.message || `Gemini HTTP ${res.status}`,
    );
    err.statusCode = res.status;
    err.geminiBody = json;
    throw err;
  }

  const candidate = json.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
    const err = new Error(
      `No candidate text (finishReason: ${candidate?.finishReason ?? "unknown"})`,
    );
    err.statusCode = 502;
    err.geminiBody = json;
    throw err;
  }

  const rawText =
    candidate.content.parts.map((p) => p.text).filter(Boolean).join("") ?? "";
  const meta =
    candidate?.groundingMetadata ?? candidate?.grounding_metadata ?? null;

  let modelJson;
  try {
    modelJson = JSON.parse(extractJsonFromModelText(rawText));
  } catch {
    const err = new Error("Model did not return parseable JSON");
    err.statusCode = 502;
    err.modelRawText = rawText;
    throw err;
  }

  const merged = mergeNutritionPayload(modelJson, meta, { hasImage });
  const usage = geminiUsageFromResponse(json);
  return { merged, geminiRaw: json, usage };
}
