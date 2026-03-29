#!/usr/bin/env node
/**
 * Phase 3 sanity check: read from public.social_posts (no Gemini).
 *
 * Prefer SERVICE ROLE so RLS never blocks you. Anon key works only if RLS allows SELECT.
 *
 *   cd ai-track/supabase
 *   cp .env.example .env   # set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   node --env-file=.env test-fetch.mjs
 *   node --env-file=.env test-fetch.mjs --id <uuid>
 *   node --env-file=.env test-fetch.mjs --limit 10
 */

import { createClient } from "@supabase/supabase-js";

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { limit: 5 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--limit") o.limit = Number(a[++i]) || 5;
    else if (a[i] === "--id") o.id = a[++i];
    else if (a[i] === "--help" || a[i] === "-h") o.help = true;
  }
  return o;
}

const args = parseArgs();
if (args.help) {
  console.log(`test-fetch.mjs — list or fetch social_posts rows

  node --env-file=.env test-fetch.mjs [--limit N] [--id UUID]

Env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY  (recommended)
  SUPABASE_ANON_KEY          (fallback; may be blocked by RLS)
`);
  process.exit(0);
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const key = serviceKey || anonKey;

if (!url || !key) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env",
  );
  process.exit(1);
}

if (!serviceKey && anonKey) {
  console.error(
    "[warn] Using anon key; if SELECT returns empty or RLS error, use service role.",
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

if (args.id) {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", args.id)
    .maybeSingle();

  if (error) {
    console.error("Supabase error:", error.message, error);
    process.exit(1);
  }
  if (!data) {
    console.error("No row with id:", args.id);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const { data, error } = await supabase
  .from("social_posts")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(Math.min(Math.max(args.limit, 1), 50));

if (error) {
  console.error("Supabase error:", error.message);
  console.error(
    "Hint: apply migration 20260329150000_social_posts.sql if the table is missing.",
  );
  process.exit(1);
}

console.log(`Rows: ${data?.length ?? 0} (newest first, limit ${args.limit})\n`);
console.log(JSON.stringify(data, null, 2));

if (!data?.length) {
  console.error(
    "\n[ok] Connection works; table is empty. Insert from the extension or SQL editor.",
  );
}
