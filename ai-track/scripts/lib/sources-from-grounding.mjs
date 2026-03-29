/**
 * Build nutrition-label `sources[]` strictly from Gemini groundingMetadata.
 */

export function sourcesFromGrounding(metadata) {
  const chunks =
    metadata?.groundingChunks ?? metadata?.grounding_chunks ?? [];
  const seen = new Set();
  const out = [];
  for (const ch of chunks) {
    const web = ch.web ?? ch.Web;
    const uri = web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    const row = { uri };
    const title = web?.title;
    if (title) row.title = title;
    out.push(row);
  }
  return out;
}

export function groundingDebugFromMetadata(metadata) {
  if (!metadata) return undefined;
  const queries =
    metadata.webSearchQueries ?? metadata.web_search_queries ?? [];
  return { webSearchQueries: queries };
}
