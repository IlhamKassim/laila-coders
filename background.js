// 1. Import the "envelope" file
importScripts('config.js');

const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_KEY = CONFIG.SUPABASE_KEY;

// 2. Listen for the "Data Package" from content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "POST_SCRAPED") {
    console.log("Integrator: Received raw data from Instagram", request.data);
    
    // Pass the baton directly to Supabase
    handleDataPipeline(request.data);
    
    sendResponse({ status: "Data sent to database" });
  }
  return true; 
});

// 3. The Simplified Pipeline
async function handleDataPipeline(postData) {
  try {
    // We no longer fetch truth sources here. 
    // We send the RAW data for Aqil to process with Gemini.
    await sendToSupabase(postData);
    console.log("Success: Raw data is now in Supabase for Aqil!");

  } catch (error) {
    console.error("Pipeline failed at the Supabase leg:", error);
  }
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