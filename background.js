// 1. Supabase project URL + anon/publishable key (Dashboard → Settings → API).
//    Never commit real keys; use local values here. Do not use the service_role secret in the extension.
const SUPABASE_URL = "https://djrykjbedbuvvyxqnfpf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ae-YDP98g63ZReDV1S5PXA_SJGaebO8";

// 2. Listen for the "Data Package" from content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "POST_SCRAPED") {
    console.log("Integrator: Received raw data from Instagram", request.data);
    
    // Pass the baton directly to Supabase
    handleDataPipeline(request.data)
      .then((row) => {
        sendResponse({
          status: "Data sent to database",
          id: row?.id ?? null,
        });
      })
      .catch((error) => {
        const msg = error?.message || String(error);
        console.error("Pipeline failed at the Supabase leg:", msg);
        sendResponse({
          status: "Failed to send data to database",
          error: msg,
        });
      });

    return true; 
  }
});

// 3. The Simplified Pipeline
async function handleDataPipeline(postData) {
    // Raw scrape → Supabase; Aqil's worker claims `pending_keywords` rows and fills `result`.
    const row = await sendToSupabase(postData);
    console.log("Success: Raw data is now in Supabase for Aqil!", row?.id);
    return row;
}

// 4. The Pipe to Supabase (shape must match ai-track/supabase/migrations/*social_posts*.sql)
//    RLS insert policy expects status=pending_keywords and result/error null — set those explicitly.
//    If you see 401/JWT errors: Dashboard → Settings → API → use the long "anon" "eyJ…" key for REST
//    (publishable keys sometimes differ by project; both are listed in the dashboard).
async function sendToSupabase(payload) {
    const rawText =
      typeof payload?.text === "string" ? payload.text : "";
    const imageUrl =
      typeof payload?.image === "string" && payload.image.trim()
        ? payload.image.trim()
        : null;
    const platform =
      typeof payload?.platform === "string" && payload.platform.trim()
        ? payload.platform.trim()
        : "instagram";

    const response = await fetch(`${SUPABASE_URL}/rest/v1/social_posts`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        raw_text: rawText,
        image_url: imageUrl,
        platform,
        status: "pending_keywords",
        result: null,
        error: null,
      }),
    });

    const responseText = await response.text();
    let parsed = null;
    if (responseText) {
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = { rawBody: responseText.slice(0, 500) };
      }
    }

    if (!response.ok) {
      const hint =
        parsed?.message ||
        parsed?.error_description ||
        parsed?.hint ||
        parsed?.code ||
        responseText?.slice(0, 200) ||
        response.status;
      console.error("Supabase insert failed:", response.status, parsed || responseText);
      throw new Error(
        typeof hint === "string" ? hint : `HTTP ${response.status}`,
      );
    }

    const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    const row = rows[0];
    console.log("Supabase row id (poll this for result):", row?.id);
    return row;
}