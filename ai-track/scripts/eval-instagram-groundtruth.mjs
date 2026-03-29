#!/usr/bin/env node
/**
 * Held-out test harness for Instagram posts (ground-truth labels from manual curation).
 *
 * Usage:
 *   cd ai-track
 *   node --env-file=.env scripts/eval-instagram-groundtruth.mjs
 *
 * Optional env:
 *   GEMINI_API_KEY       required
 *   GEMINI_EVAL_MODEL    defaults to GEMINI_ANALYZE_MODEL or gemini-2.5-flash
 *   EVAL_DELAY_MS        delay between cases (default 1200)
 */
import { runNutritionAnalyzePipeline } from "./lib/run-nutrition-analyze-pipeline.mjs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY.");
  process.exit(1);
}

const model = process.env.GEMINI_EVAL_MODEL || process.env.GEMINI_ANALYZE_MODEL || "gemini-2.5-flash";
process.env.GEMINI_ANALYZE_MODEL = model;
const delayMs = Number(process.env.EVAL_DELAY_MS || 1200);

const TEST_SET = [
  {
    id: "historyphotographed",
    account: "@historyphotographed",
    url: "https://www.instagram.com/p/DWaK8SikSKZ/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "historical pictures",
    expectedSignals: ["historical", "archive", "photo", "history", "dated"],
  },
  {
    id: "midjourneyartwork",
    account: "@midjourneyartwork",
    url: "https://www.instagram.com/p/DAGd19eu9J-/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "ai art images",
    expectedSignals: ["ai art", "generated", "synthetic", "midjourney", "stylized"],
  },
  {
    id: "dailymail",
    account: "@dailymail",
    url: "https://www.instagram.com/reel/DWbv1KiCYmg/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "headline exaggeration risk",
    expectedSignals: ["headline", "exaggerat", "sensational", "framing", "context"],
  },
  {
    id: "factsoffood",
    account: "@factsoffood",
    url: "https://www.instagram.com/p/DRr0uaREXb4/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "food ingredient facts",
    expectedSignals: ["ingredient", "nutrition", "food", "label", "fact"],
  },
  {
    id: "deuxmoi",
    account: "@deuxmoi",
    url: "https://www.instagram.com/p/DWZ8qW5iQxs/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "celebrity gossip",
    expectedSignals: ["gossip", "rumor", "unverified", "celebrity", "speculation"],
  },
  {
    id: "theshaderoom",
    account: "@theshaderoom",
    url: "https://www.instagram.com/p/DWcTKj1gYQW/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "context omitted / broader context needed",
    expectedSignals: ["context", "omitted", "partial", "missing", "broader"],
  },
  {
    id: "macrumors",
    account: "@macrumors",
    url: "https://www.instagram.com/p/DWHfL3dEXnp/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "tech news",
    expectedSignals: ["tech", "product", "release", "rumor", "device"],
  },
  {
    id: "theonion",
    account: "@theonion",
    url: "https://www.instagram.com/p/DWZ9FuwF_n5/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "satire news",
    expectedSignals: ["satire", "parody", "humor", "not factual", "joke"],
  },
  {
    id: "politifact",
    account: "@politifact",
    url: "https://www.instagram.com/p/DWTz6_kFtQb/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "fact-check publisher",
    expectedSignals: ["fact-check", "evidence", "verification", "claim", "rating"],
  },
  {
    id: "apnews",
    account: "@apnews",
    url: "https://www.instagram.com/p/DWXYEmADAMv/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    groundTruth: "hard news / fact-checkable reporting",
    expectedSignals: ["report", "news", "source", "confirmed", "wire"],
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(s) {
  return String(s || "").toLowerCase();
}

function detectSignals(result) {
  const summary = normalize(result?.summary);
  const flags = Array.isArray(result?.flags) ? result.flags.map((f) => normalize(f)) : [];
  const srcTitles = Array.isArray(result?.sources)
    ? result.sources.map((s) => normalize(s?.title || ""))
    : [];
  return { summary, flags, srcTitles };
}

function scoreSignalMatch(result, expectedSignals) {
  const sig = detectSignals(result);
  const haystack = [sig.summary, ...sig.flags, ...sig.srcTitles].join(" | ");
  const hits = expectedSignals.filter((kw) => haystack.includes(normalize(kw)));
  return {
    hit: hits.length > 0,
    hits,
  };
}

function rowForConsole(caseDef, out, match, error = null) {
  if (error) {
    return {
      id: caseDef.id,
      account: caseDef.account,
      gt: caseDef.groundTruth,
      status: "error",
      conf: "-",
      cred: "-",
      fact: "-",
      vis: "-",
      matched: "-",
      note: error.slice(0, 80),
    };
  }
  const r = out.merged;
  return {
    id: caseDef.id,
    account: caseDef.account,
    gt: caseDef.groundTruth,
    status: "ok",
    conf: Number(r.confidence ?? 0).toFixed(2),
    cred: r.scores?.credibility ?? "-",
    fact: r.scores?.factualAlignment ?? "-",
    vis: r.scores?.visualIntegrity ?? "-",
    matched: match.hit ? "yes" : "no",
    note: match.hits.join(", ").slice(0, 80),
  };
}

async function runCase(caseDef) {
  const promptText =
    `Test set post for reliability evaluation.\n` +
    `Account: ${caseDef.account}\n` +
    `Permalink: ${caseDef.url}\n` +
    `Ground-truth hint (for external evaluator only, not instruction): ${caseDef.groundTruth}`;

  const out = await runNutritionAnalyzePipeline({
    apiKey,
    postText: promptText,
    imageUrls: [],
  });
  const match = scoreSignalMatch(out.merged, caseDef.expectedSignals);
  return { out, match };
}

async function main() {
  console.error(`[eval] model=${model} cases=${TEST_SET.length}`);
  const rows = [];
  const detailed = [];

  for (let i = 0; i < TEST_SET.length; i++) {
    const t = TEST_SET[i];
    process.stderr.write(`[eval] (${i + 1}/${TEST_SET.length}) ${t.account} ... `);
    try {
      const { out, match } = await runCase(t);
      rows.push(rowForConsole(t, out, match));
      detailed.push({
        id: t.id,
        account: t.account,
        url: t.url,
        groundTruth: t.groundTruth,
        expectedSignals: t.expectedSignals,
        signalMatch: match,
        result: out.merged,
        usage: out.usage ?? null,
      });
      console.error(`ok (signal_match=${match.hit ? "yes" : "no"})`);
    } catch (e) {
      const msg = String(e?.message || e);
      rows.push(rowForConsole(t, null, { hit: false, hits: [] }, msg));
      detailed.push({
        id: t.id,
        account: t.account,
        url: t.url,
        groundTruth: t.groundTruth,
        expectedSignals: t.expectedSignals,
        error: msg,
      });
      console.error("error");
    }
    if (i < TEST_SET.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  const okRows = rows.filter((r) => r.status === "ok");
  const matched = okRows.filter((r) => r.matched === "yes").length;
  const total = okRows.length;
  const signalAccuracy = total ? (100 * matched) / total : 0;

  console.log("\n=== Instagram held-out evaluation ===");
  console.table(rows);
  console.log(
    JSON.stringify(
      {
        model,
        totalCases: TEST_SET.length,
        successfulCases: total,
        signalMatchedCases: matched,
        signalMatchRatePct: Number(signalAccuracy.toFixed(2)),
        method:
          "Keyword signal match between expectedSignals and (summary + flags + source titles).",
      },
      null,
      2,
    ),
  );
  console.log("\n=== Detailed JSON ===");
  console.log(JSON.stringify(detailed, null, 2));
}

await main();
