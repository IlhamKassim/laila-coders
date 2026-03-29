#!/usr/bin/env node
/**
 * Matches Irfan's flow: `social_posts` rows with status `pending_keywords`.
 * Claims the oldest pending row via REST (service role bypasses RLS), then runs the
 * same Gemini pipeline as HTTP /analyze. Optional SQL RPC `claim_next_social_post()`
 * exists in migrations for SKIP LOCKED; not required for this worker.
 *
 *   cd ai-track/supabase && npm install && node --env-file=.env worker.mjs
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 * Optional: WORKER_CACHE_DISABLED=1 to skip post_analysis_cache (always call Gemini).
 */
import { createClient } from "@supabase/supabase-js";
import { formatGeminiUsageLine } from "../scripts/lib/gemini-nutrition-analyze.mjs";
import { computePostHash } from "../scripts/lib/post-hash.mjs";
import {
  runNutritionAnalyzePipeline,
  socialPostRowToAnalyzeInput,
} from "../scripts/lib/run-nutrition-analyze-pipeline.mjs";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const pollMs = Number(process.env.WORKER_POLL_IDLE_MS) || 1500;
const cacheDisabled =
  process.env.WORKER_CACHE_DISABLED === "1" ||
  process.env.WORKER_CACHE_DISABLED === "true";
/** Optional: only claim this UUID (table `id` is uuid, not an integer). */
const onlyPostId = process.env.WORKER_POST_ID?.trim() || "";
/** Optional ISO timestamp: only claim rows with created_at >= this (e.g. start-of-day test). */
const minCreatedAt = process.env.WORKER_MIN_CREATED_AT?.trim() || "";

if (!url || !serviceKey) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!geminiKey) {
  console.error("Need GEMINI_API_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let hintedPostgrestSchema = false;
function hintPostgrestSchemaCache(errMsg) {
  if (hintedPostgrestSchema) return;
  if (typeof errMsg !== "string" || !errMsg.includes("schema cache")) return;
  hintedPostgrestSchema = true;
  console.error(
    "[nutricheck-worker] PostgREST schema cache is missing table columns (or DB never had them).",
  );
  console.error(
    "[nutricheck-worker] Run in Supabase → SQL Editor:  ai-track/supabase/sql/fix_postgrest_social_posts_columns.sql",
  );
  console.error(
    "[nutricheck-worker] That adds result/error if needed and runs: select pg_notify('pgrst', 'reload schema');",
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Claim one job without PostgREST RPC (avoids "function not in schema cache" when
 * the SQL migration was not applied). Atomic enough for a single worker; multiple
 * workers may race — only one update wins per row.
 */
async function claimNextSocialPostRest() {
  let sel = supabase
    .from("social_posts")
    .select("*")
    .eq("status", "pending_keywords")
    .order("created_at", { ascending: true })
    .limit(1);

  if (onlyPostId) sel = sel.eq("id", onlyPostId);
  if (minCreatedAt) sel = sel.gte("created_at", minCreatedAt);

  const { data: rows, error: selErr } = await sel;

  if (selErr) return { job: null, error: selErr };

  const row = rows?.[0];
  if (!row) return { job: null, error: null };

  const { data: updated, error: updErr } = await supabase
    .from("social_posts")
    .update({ status: "processing" })
    .eq("id", row.id)
    .eq("status", "pending_keywords")
    .select("*")
    .maybeSingle();

  if (updErr) return { job: null, error: updErr };
  if (!updated) return { job: null, error: null };

  return { job: updated, error: null };
}

/** Insert or update cached result without resetting hit_count. */
async function savePostAnalysisCache(postHash, result) {
  const { data: existing } = await supabase
    .from("post_analysis_cache")
    .select("post_hash")
    .eq("post_hash", postHash)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("post_analysis_cache")
      .update({ result })
      .eq("post_hash", postHash);
    return { error };
  }
  const { error } = await supabase.from("post_analysis_cache").insert({
    post_hash: postHash,
    result,
  });
  return { error };
}

async function markFailed(jobId, message) {
  const { error } = await supabase
    .from("social_posts")
    .update({ status: "failed", error: message })
    .eq("id", jobId);
  if (error) {
    hintPostgrestSchemaCache(error.message);
    console.error("[nutricheck-worker] failed to write error state:", error.message, jobId);
  }
}

/** Rows left `processing` (crash, hung Gemini, failed DB write) can be retried. */
async function resetStaleProcessingRows() {
  const ms = Number(process.env.WORKER_RESET_STALE_PROCESSING_MS);
  if (!Number.isFinite(ms) || ms < 1) return;
  const cutoff = new Date(Date.now() - ms).toISOString();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      status: "pending_keywords",
      error:
        "Worker reset stale processing (see WORKER_RESET_STALE_PROCESSING_MS); will retry",
    })
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .select("id");

  if (error) {
    hintPostgrestSchemaCache(error.message);
    console.error("[nutricheck-worker] stale-processing reset error:", error.message);
    return;
  }
  if (data?.length) {
    console.error(
      "[nutricheck-worker] reset stale processing → pending_keywords:",
      data.map((r) => r.id).join(", "),
    );
  }
}

async function processJob(job) {
  const { postText, imageUrls } = socialPostRowToAnalyzeInput(job);
  const postHash = computePostHash({ postText, imageUrls });
  console.error(
    "[nutricheck-worker] Gemini input:",
    `caption ${postText.length} chars,`,
    imageUrls.length ? `image ${imageUrls[0].slice(0, 80)}…` : "no image URL",
    `post_hash=${postHash.slice(0, 16)}…`,
  );

  let merged;
  let fromCache = false;

  if (!cacheDisabled) {
    const { data: cached, error: cacheErr } = await supabase
      .from("post_analysis_cache")
      .select("result, hit_count")
      .eq("post_hash", postHash)
      .maybeSingle();

    if (cacheErr) {
      console.error("[nutricheck-worker] cache read error:", cacheErr.message);
    } else if (cached?.result) {
      merged = structuredClone(cached.result);
      if (process.env.STRIP_GROUNDING_DEBUG === "1" && merged?.groundingDebug) {
        delete merged.groundingDebug;
      }
      fromCache = true;
      const nextHits = (cached.hit_count ?? 0) + 1;
      await supabase
        .from("post_analysis_cache")
        .update({ hit_count: nextHits })
        .eq("post_hash", postHash);
      console.error(
        "[nutricheck-worker] CACHE HIT — skipping Gemini",
        `(hits=${nextHits})`,
      );
      console.log("[nutricheck-worker] tokens (cache hit — no Gemini call)");
    }
  } else {
    console.error("[nutricheck-worker] cache disabled (WORKER_CACHE_DISABLED)");
  }

  if (!merged) {
    try {
      const out = await runNutritionAnalyzePipeline({
        apiKey: geminiKey,
        postText,
        imageUrls,
      });
      merged = out.merged;
      console.log(formatGeminiUsageLine("[nutricheck-worker]", out.usage));

      const { error: cacheWriteErr } = await savePostAnalysisCache(
        postHash,
        merged,
      );
      if (cacheWriteErr) {
        console.error(
          "[nutricheck-worker] cache write error:",
          cacheWriteErr.message,
        );
      }
    } catch (e) {
      const msg = e.message || "Analyze pipeline failed";
      console.error("[nutricheck-worker] pipeline error:", msg);
      await markFailed(job.id, msg);
      console.error("[nutricheck-worker] social_post", job.id, "→ failed");
      return;
    }
  }

  const { error: doneErr } = await supabase
    .from("social_posts")
    .update({
      status: "completed",
      result: merged,
      error: null,
      from_cache: fromCache,
    })
    .eq("id", job.id);

  if (doneErr) {
    hintPostgrestSchemaCache(doneErr.message);
    console.error(
      "[nutricheck-worker] completed update failed (row may stay processing):",
      doneErr.message,
    );
    await markFailed(
      job.id,
      `DB write failed after Gemini: ${doneErr.message}`,
    );
    return;
  }
  console.error("[nutricheck-worker] social_post", job.id, "→ completed");
}

console.error(
  "[nutricheck-worker] social_posts REST claim (pending_keywords → processing)",
);
if (onlyPostId) {
  console.error("[nutricheck-worker] WORKER_POST_ID filter:", onlyPostId);
}
if (minCreatedAt) {
  console.error("[nutricheck-worker] WORKER_MIN_CREATED_AT filter:", minCreatedAt);
}
console.error(
  "[nutricheck-worker] post_analysis_cache:",
  cacheDisabled ? "disabled" : "enabled (same post_hash → skip Gemini)",
);

await resetStaleProcessingRows();

for (;;) {
  const { job, error } = await claimNextSocialPostRest();
  if (error) {
    hintPostgrestSchemaCache(error.message);
    console.error("[nutricheck-worker] claim error:", error.message);
    await sleep(3000);
    continue;
  }
  if (!job?.id) {
    await sleep(pollMs);
    continue;
  }
  console.error("[nutricheck-worker] claimed social_post", job.id);
  await processJob(job);
}
