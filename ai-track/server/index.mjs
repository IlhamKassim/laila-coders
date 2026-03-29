/**
 * Phase 3 — POST /analyze (NutriCheck). Keys stay server-side only.
 */
import http from "node:http";
import { runNutritionAnalyzePipeline } from "../scripts/lib/run-nutrition-analyze-pipeline.mjs";

const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY_BYTES = 256 * 1024;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, obj) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function parseAnalyzeRequest(body) {
  if (body.schemaVersion !== "1.0.0") {
    return { error: 'schemaVersion must be "1.0.0"', status: 400 };
  }
  if (typeof body.postText !== "string" || !body.postText.trim()) {
    return { error: "postText is required and must be non-empty", status: 400 };
  }
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls
    : body.imageUrls == null
      ? []
      : null;
  if (imageUrls === null) {
    return { error: "imageUrls must be an array when present", status: 400 };
  }
  return {
    ok: true,
    postText: body.postText.trim(),
    imageUrls,
    metadata: body.metadata,
  };
}

async function handleAnalyze(body) {
  const parsed = parseAnalyzeRequest(body);
  if (!parsed.ok) {
    return { status: parsed.status, body: { error: parsed.error } };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      status: 503,
      body: { error: "Server misconfiguration: GEMINI_API_KEY not set" },
    };
  }

  try {
    const { merged } = await runNutritionAnalyzePipeline({
      apiKey: key,
      postText: parsed.postText,
      imageUrls: parsed.imageUrls,
    });
    return { status: 200, body: merged };
  } catch (e) {
    const msg = e.message || "";
    if (
      msg.includes("Invalid image URL") ||
      msg.includes("Image fetch") ||
      msg.includes("URL is not an image") ||
      msg.includes("Image exceeds") ||
      msg.includes("timed out")
    ) {
      return { status: 400, body: { error: msg || "Image fetch failed" } };
    }
    if (e.validationErrors) {
      return {
        status: 502,
        body: {
          error: "Merged payload failed validation",
          details: e.validationErrors,
        },
      };
    }
    const status = e.statusCode && e.statusCode >= 400 ? e.statusCode : 502;
    return {
      status,
      body: {
        error: e.message || "Analyze failed",
        ...(process.env.ANALYZE_VERBOSE_ERRORS === "1" && e.geminiBody
          ? { gemini: e.geminiBody }
          : {}),
      },
    };
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url.split("?")[0] === "/health") {
    return json(res, 200, {
      ok: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  }

  if (req.method === "POST" && req.url.split("?")[0] === "/analyze") {
    let text;
    try {
      text = await readBody(req);
    } catch {
      return json(res, 413, { error: "Request body too large" });
    }
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return json(res, 400, { error: "Invalid JSON body" });
    }
    const out = await handleAnalyze(body);
    return json(res, out.status, out.body);
  }

  cors(res);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[nutricheck-server] Port ${PORT} is already in use.\n` +
        `  Use another port:  PORT=8788 npm start\n` +
        `  Or find the process:  lsof -i :${PORT}`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(
    `[nutricheck-server] listening on http://127.0.0.1:${PORT}  POST /analyze  GET /health`,
  );
});
