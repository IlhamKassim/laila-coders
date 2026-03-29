#!/usr/bin/env node
/**
 * Local-only operational dashboard for NutriCheck (hackathon).
 * Uses service role to read ops views — bind is localhost only.
 *
 *   cd ai-track/supabase && node --env-file=.env dashboard.mjs
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (same as worker.mjs)
 * Optional: DASHBOARD_PORT (default 8790), DASHBOARD_HOST (default 127.0.0.1)
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const host = process.env.DASHBOARD_HOST || "127.0.0.1";
const port = Number(process.env.DASHBOARD_PORT) || 8790;
const logoPath =
  process.env.DASHBOARD_LOGO_PATH ||
  "/Users/aqilnazri/.cursor/projects/Users-aqilnazri-git-ws-laila-coders/assets/WhatsApp_Image_2026-03-29_at_10.30.51-d4e8262e-f68e-4000-bb68-713798bcd299.png";

if (!url || !serviceKey) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (same as worker).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function loadLogoDataUri() {
  try {
    const buf = readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

const logoDataUri = loadLogoDataUri();

async function fetchStats() {
  const [
    queueRes,
    completedRes,
    cacheRes,
    perfRes,
    failuresRes,
    recentCompletedRes,
  ] = await Promise.all([
    supabase.from("nutricheck_ops_queue_by_status").select("status, cnt"),
    supabase.from("nutricheck_ops_completed_cache").select("*").maybeSingle(),
    supabase.from("nutricheck_ops_cache_table").select("*").maybeSingle(),
    supabase.from("nutricheck_ops_perf_tokens").select("*").maybeSingle(),
    supabase.from("nutricheck_ops_recent_failures").select("*").order("created_at", {
      ascending: false,
    }),
    supabase.from("nutricheck_ops_recent_completed").select("*").order("created_at", {
      ascending: false,
    }),
  ]);

  const errors = [];
  if (queueRes.error) errors.push(queueRes.error.message);
  if (completedRes.error) errors.push(completedRes.error.message);
  if (cacheRes.error) errors.push(cacheRes.error.message);
  if (perfRes.error) errors.push(perfRes.error.message);
  if (failuresRes.error) errors.push(failuresRes.error.message);
  if (recentCompletedRes.error) errors.push(recentCompletedRes.error.message);

  return {
    ok: errors.length === 0,
    errors: errors.length ? errors : undefined,
    queueByStatus: queueRes.data ?? [],
    completedCache: completedRes.data ?? {
      from_cache_count: 0,
      fresh_gemini_count: 0,
    },
    cacheTable: cacheRes.data ?? { cache_entries: 0, total_cache_hits: 0 },
    perfTokens: perfRes.data ?? {
      completed_count: 0,
      avg_queue_latency_ms: 0,
      avg_processing_latency_ms: 0,
      max_processing_latency_ms: 0,
      total_token_prompt: 0,
      total_token_output: 0,
      total_token_thoughts: 0,
      total_token_all: 0,
      avg_token_per_completed: 0,
    },
    recentFailures: failuresRes.data ?? [],
    recentCompleted: recentCompletedRes.data ?? [],
  };
}

const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NutriCheck — Ops</title>
  <style>
    :root {
      --bg: #0f1419;
      --card: #1a2332;
      --text: #e7ecf3;
      --muted: #8b9cb3;
      --accent: #3d9cf0;
      --bad: #e85d6a;
      --ok: #3dd68c;
    }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 1.25rem;
      line-height: 1.45;
    }
    h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 0.25rem; }
    .header {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .logo {
      width: 140px;
      height: 140px;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.14);
    }
    .sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 1.25rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .card {
      background: var(--card);
      border-radius: 10px;
      padding: 0.9rem 1rem;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .card h2 {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin: 0 0 0.35rem;
      font-weight: 600;
    }
    .card .val { font-size: 1.5rem; font-weight: 700; }
    .panel {
      background: var(--card);
      border-radius: 10px;
      padding: 1rem;
      border: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 1rem;
    }
    .panel h2 {
      font-size: 0.85rem;
      margin: 0 0 0.75rem;
      font-weight: 600;
    }
    .table-wrap {
      max-height: 280px;
      overflow: auto;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    th, td {
      text-align: left;
      padding: 0.62rem 0.7rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      vertical-align: top;
    }
    th {
      color: #b9c7d9;
      font-weight: 700;
      letter-spacing: 0.02em;
      position: sticky;
      top: 0;
      background: #152033;
      z-index: 1;
    }
    tbody tr:nth-child(even) {
      background: rgba(255,255,255,0.025);
    }
    tbody tr:hover {
      background: rgba(61,156,240,0.12);
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
    }
    .cell-clip {
      max-width: 560px;
      white-space: pre-wrap;
      word-break: break-word;
      color: #d8e2ef;
    }
    .err-banner {
      background: rgba(232, 93, 106, 0.15);
      color: #f5a5ad;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.85rem;
      white-space: pre-wrap;
    }
    footer { color: var(--muted); font-size: 0.75rem; margin-top: 1rem; }
    code { font-size: 0.78em; background: rgba(0,0,0,0.25); padding: 0.1em 0.35em; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="Laila Coder logo" />` : ""}
    <h1>NutriCheck — Operational dashboard</h1>
  </div>
  <p class="sub">Local demo · <code>127.0.0.1</code> only · tracks dashboard poll latency and worker token usage.</p>
  <div id="err" class="err-banner" style="display:none"></div>
  <div class="grid" id="cards"></div>
  <div class="panel">
    <h2>Queue by status</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Status</th><th>Count</th></tr></thead>
        <tbody id="queue-body"></tbody>
      </table>
    </div>
  </div>
  <div class="panel">
    <h2>Recent completed (latency in seconds + tokens, up to 50)</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Platform</th><th>Cache</th><th>Queue s</th><th>Process s</th><th>Token total</th></tr></thead>
        <tbody id="done-body"></tbody>
      </table>
    </div>
  </div>
  <div class="panel">
    <h2>Recent failures (up to 50)</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Platform</th><th>Error</th></tr></thead>
        <tbody id="fail-body"></tbody>
      </table>
    </div>
  </div>
  <footer>Refresh: auto every 15s · Views: <code>nutricheck_ops_*</code> · poll latency appears in cards.</footer>
  <script>
    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s == null ? '' : String(s);
      return d.innerHTML;
    }
    async function load() {
      const t0 = performance.now();
      const r = await fetch('/api/stats');
      const j = await r.json();
      const pollLatencyMs = Math.round(performance.now() - t0);
      const pollLatencySec = (pollLatencyMs / 1000).toFixed(2);
      const errEl = document.getElementById('err');
      if (!j.ok && j.errors && j.errors.length) {
        errEl.style.display = 'block';
        errEl.textContent = 'Partial or failed load: ' + j.errors.join(' · ');
      } else {
        errEl.style.display = 'none';
      }
      const q = j.queueByStatus || [];
      const cc = j.completedCache || {};
      const ct = j.cacheTable || {};
      const perf = j.perfTokens || {};
      const totalCompleted = (Number(cc.from_cache_count) || 0) + (Number(cc.fresh_gemini_count) || 0);
      const cacheRate = totalCompleted > 0
        ? Math.round((100 * (Number(cc.from_cache_count) || 0)) / totalCompleted)
        : null;

      const cards = document.getElementById('cards');
      cards.innerHTML = [
        { label: 'Pending', val: sumStatus(q, 'pending_keywords') },
        { label: 'Processing', val: sumStatus(q, 'processing') },
        { label: 'Completed', val: sumStatus(q, 'completed') },
        { label: 'Failed', val: sumStatus(q, 'failed') },
        { label: 'Completed from cache', val: cc.from_cache_count ?? '—' },
        { label: 'Completed fresh Gemini', val: cc.fresh_gemini_count ?? '—' },
        { label: 'Cache hit rate (completed)', val: cacheRate != null ? cacheRate + '%' : '—' },
        { label: 'Cache entries', val: ct.cache_entries ?? '—' },
        { label: 'Total cache hits (sum)', val: ct.total_cache_hits ?? '—' },
        { label: 'Dashboard poll latency (s)', val: pollLatencySec },
        { label: 'Avg queue latency (s)', val: toSec(perf.avg_queue_latency_ms) },
        { label: 'Avg processing latency (s)', val: toSec(perf.avg_processing_latency_ms) },
        { label: 'Max processing latency (s)', val: toSec(perf.max_processing_latency_ms) },
        { label: 'Gemini tokens (total)', val: perf.total_token_all ?? '—' },
        { label: 'Avg tokens/completed', val: perf.avg_token_per_completed ?? '—' },
      ].map(function (c) {
        return '<div class="card"><h2>' + esc(c.label) + '</h2><div class="val">' + esc(c.val) + '</div></div>';
      }).join('');

      function toSec(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return '—';
        return (n / 1000).toFixed(2);
      }

      function sumStatus(rows, st) {
        const row = rows.find(function (r) { return r.status === st; });
        return row ? row.cnt : 0;
      }

      document.getElementById('queue-body').innerHTML = q.length
        ? q.map(function (r) {
            return '<tr><td>' + esc(r.status) + '</td><td>' + esc(r.cnt) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="2">No rows</td></tr>';

      const done = j.recentCompleted || [];
      document.getElementById('done-body').innerHTML = done.length
        ? done.map(function (d) {
            return '<tr><td class="mono">' + esc(d.created_at) + '</td><td>' + esc(d.platform) + '</td><td>' + esc(d.from_cache ? 'yes' : 'no') + '</td><td class="mono">' + esc(toSec(d.queue_latency_ms)) + '</td><td class="mono">' + esc(toSec(d.processing_latency_ms)) + '</td><td class="mono">' + esc(d.token_total ?? 0) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="6">None</td></tr>';

      const fails = j.recentFailures || [];
      document.getElementById('fail-body').innerHTML = fails.length
        ? fails.map(function (f) {
            return '<tr><td class="mono">' + esc(f.created_at) + '</td><td>' + esc(f.platform) + '</td><td class="cell-clip">' + esc(f.error) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="3">None</td></tr>';
    }
    load();
    setInterval(load, 15000);
  </script>
</body>
</html>`;

function json(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || "/", `http://${host}:${port}`);

  if (req.method === "GET" && u.pathname === "/api/stats") {
    try {
      const stats = await fetchStats();
      json(res, stats, stats.ok ? 200 : 503);
    } catch (e) {
      json(res, { ok: false, errors: [String(e?.message || e)] }, 500);
    }
    return;
  }

  if (req.method === "GET" && (u.pathname === "/" || u.pathname === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(htmlPage);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(port, host, () => {
  console.log(`[nutricheck-dashboard] http://${host}:${port}/  (service role, localhost only)`);
});
