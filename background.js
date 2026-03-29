// 1. Supabase project URL + anon/publishable key (Dashboard → Settings → API).
//    Never commit real keys; use local values here. Do not use the service_role secret in the extension.
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY";

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
        console.error("Pipeline failed at the Supabase leg:", error);
        sendResponse({ status: "Failed to send data to database" });
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
async function sendToSupabase(payload) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/social_posts`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        // Return inserted row so UI can poll by id for `result` when worker finishes
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        raw_text: payload.text,
        image_url: payload.image,
        platform: payload.platform,
        status: "pending_keywords" // Worker (Aqil) picks up via claim_next_social_post()
      })
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Supabase Error:", errorData);
      throw new Error("Supabase insert failed");
    }
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    console.log("Supabase row id (poll this for result):", row?.id);
    return row;
}