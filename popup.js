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
        chrome.runtime.sendMessage({ type: "POST_SCRAPED", data: response }, (bgResponse) => {
          if (chrome.runtime.lastError) {
            statusDiv.innerText = "Database error.";
            console.error(chrome.runtime.lastError);
            return;
          }
          
          console.log("Background response:", bgResponse);
          statusDiv.innerText = bgResponse?.status || "Done.";
          }
        );
      });
    } catch (error) {
      console.error("Popup error:", error);
      statusDiv.innerText = "Unexpected error.";
    }
  });