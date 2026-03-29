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
  const textCandidates = [];
  
  // 1. Target elements with 'dir="auto"' - Instagram almost ALWAYS 
  // uses this attribute for user-generated text like captions.
  const elements = post.querySelectorAll('span[dir="auto"], h1[dir="auto"], div[dir="auto"]');

  elements.forEach((el) => {
    let text = el.innerText?.trim();
    if (!text || text.length < 5) return;

    // 2. The "Profile Name" Filter:
    // Captions usually contain spaces, hashtags (#), or emojis.
    // Usernames usually do not.
    const hasSpace = text.includes(" ");
    const hasSpecial = /[#\u{1F300}-\u{1F9FF}]/u.test(text); // Checks for hashtags or emojis

    // 3. Exclude the Header (Username area)
    const isInsideHeader = el.closest('header') || el.closest('div[role="menuitem"]');
    if (isInsideHeader) return;

    // 4. Score the text
    let score = text.length;
    if (hasSpace) score += 20; 
    if (hasSpecial) score += 30;

    // 5. Clean leading usernames (IG often repeats the username at the start of a caption)
    text = text.replace(/^[a-zA-Z0-9._]{1,30}\s+/, "").trim();

    textCandidates.push({ text, score });
  });

  // Sort by score instead of just length
  textCandidates.sort((a, b) => b.score - a.score);

  console.log("Ranked Caption Candidates:", textCandidates);

  return textCandidates.length > 0 ? textCandidates[0].text : "";
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