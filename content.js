chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "SCRAPE_POST") return;

  console.log("SCRAPE_POST request received");

  const post = findActivePost();

  if (!post) {
    sendResponse({ error: "Could not find an active post." });
    return true;
  }

  console.log("Found post:", post);

  const captionText = extractCaption(post);
  const imageUrl = extractImage(post);

  console.log("Caption:", captionText);
  console.log("Image URL:", imageUrl);

  sendResponse({
    text: captionText || "",
    image: imageUrl || null,
    platform: "instagram",
    timestamp: new Date().toISOString()
  });

  return true;
});

function findActivePost() {
  let post = document.querySelector('div[role="dialog"] article');

  if (post) {
    console.log("Using modal post");
    return post;
  }

  const articles = document.querySelectorAll("article");
  let closestPost = null;
  let minDistance = Infinity;
  const viewportCenter = window.innerHeight / 2;

  articles.forEach((art) => {
    const rect = art.getBoundingClientRect();
    const articleCenter = rect.top + rect.height / 2;
    const distance = Math.abs(viewportCenter - articleCenter);

    if (distance < minDistance) {
      minDistance = distance;
      closestPost = art;
    }
  });

  if (closestPost) {
    console.log("Using closest feed post");
  }

  return closestPost;
}

function extractCaption(post) {
  const header = post.querySelector('header') || post.querySelector('div[style*="height: 60px"]');
  
  const textCandidates = [];
  // Target spans and h1s that are NOT inside the header
  const elements = post.querySelectorAll("h1, span");

  elements.forEach((el) => {
    // SKIP if the element is inside the header
    if (header && header.contains(el)) return;

    let text = el.innerText?.trim();
    if (!text || text.length < 8) return;

    const lower = text.toLowerCase();
    const blockedWords = ["follow", "following", "like", "reply", "comment", "share", "more", "view all"];
    if (blockedWords.some(word => lower.includes(word))) return;

    // Filter out strings that look like single usernames (no spaces)
    if (!text.includes(" ")) return;

    // Filter out common "Time ago" strings (e.g., "2 DAYS AGO")
    if (/\d+\s+(DAYS|HOURS|MINUTES|AGO)/i.test(text)) return;

    // Remove the leading username that Instagram often prepends to captions
    // This regex looks for a username-like string followed by a space
    text = text.replace(/^[a-zA-Z0-9._]{1,30}\s+/, "").trim();

    if (text.length > 10) {
      textCandidates.push(text);
    }
  });

  // Sort by length - the real caption is almost always the longest block of text
  const uniqueCandidates = [...new Set(textCandidates)];
  uniqueCandidates.sort((a, b) => b.length - a.length);

  console.log("Filtered Caption Candidates:", uniqueCandidates);
  return uniqueCandidates[0] || "";
}

function extractImage(post) {
  const images = [...post.querySelectorAll("img")];

  const candidates = images
    .map((img) => ({
      src: img.src || "",
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0,
      alt: img.alt || ""
    }))
    .filter((img) => {
      if (!img.src) return false;
      if (img.width < 150 || img.height < 150) return false;
      if (img.src.includes("profile_pic")) return false;
      if (img.src.includes("s150x150")) return false;
      return true;
    });

  candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));

  console.log("Image candidates:", candidates);

  return candidates.length > 0 ? candidates[0].src : null;
}