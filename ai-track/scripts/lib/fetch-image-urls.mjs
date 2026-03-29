/**
 * Fetch remote images for server-side /analyze (HTTPS, caps, timeout, image/* only).
 */
import { toInlineImagePart } from "./inline-image-part.mjs";

const DEFAULT_MAX_IMAGES = 8;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

function mimeFromContentType(ct) {
  const s = (ct || "").toLowerCase();
  if (s.includes("png")) return "image/png";
  if (s.includes("webp")) return "image/webp";
  if (s.includes("gif")) return "image/gif";
  return "image/jpeg";
}

/**
 * @param {string[]} urls
 * @param {{ maxImages?: number, maxBytesPerImage?: number, timeoutMsPerUrl?: number }} [opts]
 */
export async function fetchImageUrlsAsInlineParts(urls, opts = {}) {
  const maxImages = opts.maxImages ?? DEFAULT_MAX_IMAGES;
  const maxBytesPerImage = opts.maxBytesPerImage ?? DEFAULT_MAX_BYTES;
  const timeoutMsPerUrl = opts.timeoutMsPerUrl ?? DEFAULT_TIMEOUT_MS;

  if (!Array.isArray(urls)) {
    throw new Error("imageUrls must be an array");
  }

  const list = urls.slice(0, maxImages);
  const parts = [];

  for (const u of list) {
    if (typeof u !== "string" || !u.startsWith("https://")) {
      throw new Error(`Invalid image URL (https only): ${String(u)}`);
    }

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMsPerUrl);
    let res;
    try {
      res = await fetch(u, {
        signal: controller.signal,
        redirect: "follow",
        headers: { Accept: "image/*,*/*;q=0.8" },
      });
    } catch (e) {
      if (e.name === "AbortError") {
        throw new Error(`Image fetch timed out: ${u}`);
      }
      throw e;
    } finally {
      clearTimeout(tid);
    }

    if (!res.ok) {
      throw new Error(`Image fetch failed ${res.status}: ${u}`);
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.toLowerCase().startsWith("image/")) {
      throw new Error(`URL is not an image (${ct || "no content-type"}): ${u}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytesPerImage) {
      throw new Error(
        `Image exceeds ${maxBytesPerImage} bytes: ${u}`,
      );
    }

    parts.push(toInlineImagePart(buf, mimeFromContentType(ct)));
  }

  return parts;
}
