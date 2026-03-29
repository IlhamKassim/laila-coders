/**
 * Build Gemini REST `parts[]` entries with `inline_data` (snake_case per API).
 */
import { readFileSync } from "fs";
import { extname } from "path";

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** 1×1 PNG — no file needed for smoke tests. */
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function toInlineImagePart(buffer, mime_type) {
  return {
    inline_data: {
      mime_type,
      data: Buffer.from(buffer).toString("base64"),
    },
  };
}

export function inlineImagePartTinyPng() {
  return toInlineImagePart(Buffer.from(TINY_PNG_BASE64, "base64"), "image/png");
}

export function inlineImagePartFromFile(imagePath) {
  const ext = extname(imagePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw new Error(`Unsupported image extension: ${ext || "(none)"}`);
  }
  return toInlineImagePart(readFileSync(imagePath), mime);
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export async function inlineImagePartFromUrl(imageUrl, maxBytes = DEFAULT_MAX_BYTES) {
  const res = await fetch(imageUrl, {
    redirect: "follow",
    headers: { Accept: "image/*" },
  });
  if (!res.ok) throw new Error(`image-url fetch failed: ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  let mime = "image/jpeg";
  if (ct.includes("png")) mime = "image/png";
  else if (ct.includes("webp")) mime = "image/webp";
  else if (ct.includes("gif")) mime = "image/gif";
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.length > maxBytes) {
    throw new Error(`image larger than ${maxBytes} bytes`);
  }
  return toInlineImagePart(buf, mime);
}

/** @param {{ imagePath?: string, imageUrl?: string }} opts */
export async function loadInlineImagePart(opts) {
  const { imagePath, imageUrl } = opts;
  if (imagePath && imageUrl) {
    throw new Error("Use only one of imagePath or imageUrl");
  }
  if (imagePath) return inlineImagePartFromFile(imagePath);
  if (imageUrl) return await inlineImagePartFromUrl(imageUrl);
  return null;
}
