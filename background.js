// 1. Import the SUPABASE URL and KEY
const SUPABASE_URL = "https://djrykjbedbuvvyxqnfpf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ae-YDP98g63ZReDV1S5PXA_SJGaebO8";

// 2. Listen for the "Data Package" from content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "POST_SCRAPED") {
    console.log("Integrator: Received raw data from Instagram", request.data);
    
    // Pass the baton directly to Supabase
    handleDataPipeline(request.data)
      .then(() => {
        sendResponse({ status: "Data sent to database" });
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
    // We no longer fetch truth sources here. 
    // We send the RAW data for Aqil to process with Gemini.
    await sendToSupabase(postData);
    console.log("Success: Raw data is now in Supabase for Aqil!");
}

// 4. The Pipe to Supabase
async function sendToSupabase(payload) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/social_posts`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        raw_text: payload.text,
        image_url: payload.image,
        platform: payload.platform,
        status: "pending_keywords" // This is the 'signal' for Aqil's script
      })
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Supabase Error:", errorData);
      throw new Error("Supabase insert failed");
    }
    return response;
}