// 1. Updated Scraper Logic for content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCRAPE_POST") {
    
    // FIND THE ACTIVE POST
    // Priority 1: Check if the user has opened a post in a popup (Modal)
    let post = document.querySelector('div[role="dialog"] article');

    // Priority 2: If no modal, find the post closest to the center of the screen
    if (!post) {
      const articles = document.querySelectorAll('article');
      let minDistance = Infinity;
      const viewportCenter = window.innerHeight / 2;

      articles.forEach(art => {
        const rect = art.getBoundingClientRect();
        const articleCenter = rect.top + (rect.height / 2);
        const distance = Math.abs(viewportCenter - articleCenter);

        if (distance < minDistance) {
          minDistance = distance;
          post = art;
        }
      });
    }

    if (post) {
      // Improved data extraction
      const captionText = post.querySelector('h1, span._ap3a')?.innerText || "No caption found";
      const imageUrl = post.querySelector('img.x5yr21d, img[srcset]')?.src || "No image found";

      sendResponse({
        text: captionText,
        image: imageUrl,
        platform: "Instagram",
        timestamp: new Date().toISOString()
      });
    } else {
      sendResponse({ error: "Could not find an active post." });
    }
  }
  return true; 
});