document.getElementById('scrapeBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.innerText = "Connecting to page...";

    try{
      // 1. Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
      // 2. Send a message to content.js to scrape the data
      chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_POST" }, (response) => {
        if (chrome.runtime.lastError) {
          statusDiv.innerText = "Error: Please refresh the Instagram page!";
          console.error(chrome.runtime.lastError);
          return;
        }
    
        if (!response || response.error) {
          statusDiv.innerText = "Couldn't find a post here, please try again";
          console.error("Response error:", response?.error);
          return;
        } 

        console.log("Succesfully scraped post data:", response);
        statusDiv.innerText = "Data grabbed! Sending to Pipeline...";
          
        // 3. Send the scraped data to background.js for API calls
        chrome.runtime.sendMessage({ type: "POST_SCRAPED", data: response }, async (bgResponse) => {
          if (chrome.runtime.lastError) {
            statusDiv.innerText = "Database error.";
            console.error(chrome.runtime.lastError);
            return;
          }
          
          console.log("Background response:", bgResponse);
          statusDiv.innerText = bgResponse?.status || "Done.";

          if (bgResponse?.status === "Data sent to database") {
            console.log("Updating streak...");
            const streak = await updateDailyStreak();
            console.log("New streak:", streak);
            renderStreak(streak);
          }
          }
        );
      });
    } catch (error) {
      console.error("Popup error:", error);
      statusDiv.innerText = "Unexpected error.";
    }
  });

  async function updateDailyStreak() {
    const today = new Date().toISOString().slice(0, 10);

    const { streakCount = 0, lastUsedDate = "" } = await chrome.storage.local.get([
      "streakCount",
      "lastUsedDate"
    ]);

    if (lastUsedDate === today) {
      return streakCount;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let newStreak = 1;

    if (lastUsedDate === yesterdayStr) {
      newStreak = streakCount + 1;
    }

    await chrome.storage.local.set({
      streakCount: newStreak,
      lastUsedDate: today
    });

    return newStreak;
  }

  async function loadStreak() {
    const { streakCount = 0 } = await chrome.storage.local.get("streakCount");
    renderStreak(streakCount);
  }

  function renderStreak(streak) {
    const streakText = document.getElementById("streakText");
    if (!streakText) return;

    streakText.innerText = `${streak} day${streak === 1 ? "" : "s"} streak`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadStreak();
  });