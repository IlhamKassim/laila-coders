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
  const mainImage = [...post.querySelectorAll("img")]
    .map((img) => ({
      el: img,
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0,
      src: img.src || ""
    }))
    .filter((img) => {
      if (!img.src) return false;
      if (img.width < 150 || img.height < 150) return false;
      if (img.src.includes("profile_pic")) return false;
      if (img.src.includes("s150x150")) return false;
      return true;
    })
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0]?.el;

  const textCandidates = [];
  const elements = post.querySelectorAll("h1, span");

  elements.forEach((el) => {
    let text = el.innerText?.trim();
    if (!text) return;
    if (text.length < 8) return;

    const lower = text.toLowerCase();

    const blockedWords = [
      "follow",
      "following",
      "like",
      "likes",
      "reply",
      "replies",
      "view all",
      "see translation",
      "add a comment",
      "comment",
      "share",
      "more"
    ];

    if (blockedWords.includes(lower)) return;
    if (/^[a-zA-Z0-9._]{1,30}$/.test(text)) return;
    if (/^(@[a-zA-Z0-9._]+\s*)+$/.test(text)) return;

    // keep only text that is BELOW the main image
    if (mainImage) {
      const imageBottom = mainImage.getBoundingClientRect().bottom;
      const textTop = el.getBoundingClientRect().top;

      if (textTop < imageBottom) return;
    }

    // remove leading username if present
    text = text.replace(/^[a-zA-Z0-9._]{1,30}\s+/, "").trim();

    if (text.length < 8) return;

    const mentions = text.match(/@[a-zA-Z0-9._]+/g) || [];
    const words = text.split(/\s+/).filter(Boolean);

    if (words.length > 0 && mentions.length / words.length > 0.5) return;

    textCandidates.push(text);
  });

  const uniqueCandidates = [...new Set(textCandidates)];
  uniqueCandidates.sort((a, b) => b.length - a.length);

  console.log("Caption candidates below image:", uniqueCandidates);

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