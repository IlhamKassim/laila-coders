/**
 * Stable hash for "same post" detection (caption + primary image URL).
 * Used by the Supabase worker to skip duplicate Gemini calls.
 */
import { createHash } from "node:crypto";

const HASH_VERSION = 1;

/** @param {string} [s] */
export function normalizePostText(s) {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Normalize image URL so the same CDN asset hashes the same across sessions.
 * Strips query string on known Instagram / Meta CDNs (tracking params differ).
 * @param {string | null | undefined} url
 */
export function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  const t = url.trim();
  if (!t) return "";
  try {
    const u = new URL(t);
    u.hash = "";
    const h = u.hostname.toLowerCase();
    if (
      h.includes("cdninstagram.com") ||
      h.includes("fbcdn.net") ||
      h.includes("instagram.com")
    ) {
      u.search = "";
    }
    return u.toString();
  } catch {
    return t;
  }
}

/**
 * @param {{ postText: string, imageUrls?: string[] }} input
 * @returns {string} hex sha256
 */
export function computePostHash({ postText, imageUrls = [] }) {
  const firstUrl = Array.isArray(imageUrls) && imageUrls.length
    ? imageUrls[0]
    : "";
  const payload = JSON.stringify({
    v: HASH_VERSION,
    t: normalizePostText(postText),
    i: normalizeImageUrl(firstUrl),
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
