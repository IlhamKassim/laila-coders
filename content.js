chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SHOW_ANALYSIS_OVERLAY") {
    renderAnalysisOverlay(request.data);
    sendResponse({ ok: true });
    return true;
  }

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

function renderAnalysisOverlay(data) {
  const oldOverlay = document.getElementById("analysis-overlay");
  if (oldOverlay) oldOverlay.remove();

  const confidencePercent = Math.round((data.confidence || 0) * 100);

  const overlay = document.createElement("div");
  overlay.id = "analysis-overlay";

  overlay.innerHTML = `
    <div class="header">
      <div class="title">Integrity Check</div>
      <button class="close-btn">✕</button>
    </div>

    <div class="confidence">
      <div class="confidence-number">${confidencePercent}%</div>
      <div class="confidence-label">Confidence</div>
    </div>

    ${createMetricBar("Credibility", data.scores?.credibility || 0)}
    ${createMetricBar("Visual Integrity", data.scores?.visualIntegrity || 0)}
    ${createMetricBar("Factual Alignment", data.scores?.factualAlignment || 0)}

    <div class="summary">
      <div class="section-title">Summary</div>
      <div class="summary-text">${data.summary || "No summary available."}</div>
    </div>

    <div class="flags">
      ${(data.flags || []).map(flag => `<span class="flag">${flag}</span>`).join("")}
    </div>

    <div class="sources">
      <div class="section-title">Sources</div>
      ${(data.sources || []).slice(0, 3).map(source => `
        <a class="source-link" href="${source.uri}" target="_blank">
          ${source.title}
        </a>
      `).join("")}
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".close-btn").addEventListener("click", () => {
    overlay.remove();
  });
}

function createMetricBar(label, value) {
  return `
    <div class="metric">
      <div class="metric-row">
        <span>${label}</span>
        <span>${value}%</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width: ${value}%;"></div>
      </div>
    </div>
  `;
}

(function injectStyles() {
  if (document.getElementById("overlay-styles")) return;

  const style = document.createElement("style");
  style.id = "overlay-styles";
  style.textContent = `
    #analysis-overlay {
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 340px;
      max-height: 80vh;
      overflow-y: auto;
      z-index: 999999;
      padding: 16px;
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.82);
      color: #e2e8f0;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 10px 40px rgba(0,0,0,0.35);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .title {
      font-size: 1rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #cbd5e1;
      font-size: 16px;
      cursor: pointer;
    }

    .confidence {
      text-align: center;
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 14px;
      background: rgba(255,255,255,0.06);
    }

    .confidence-number {
      font-size: 32px;
      font-weight: 800;
      color: #60a5fa;
    }

    .confidence-label {
      font-size: 12px;
      color: #94a3b8;
    }

    .metric {
      margin-bottom: 12px;
    }

    .metric-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 6px;
    }

    .bar-bg {
      height: 8px;
      background: rgba(255,255,255,0.08);
      border-radius: 999px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #3b82f6, #6366f1);
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 6px;
      color: #f8fafc;
    }

    .summary {
      margin-top: 14px;
      margin-bottom: 14px;
      padding: 10px;
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
    }

    .summary-text {
      font-size: 13px;
      line-height: 1.45;
      color: #cbd5e1;
    }

    .flags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .flag {
      font-size: 11px;
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(96,165,250,0.18);
      color: #bfdbfe;
    }

    .sources {
      margin-top: 10px;
    }

    .source-link {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      color: #93c5fd;
      text-decoration: none;
    }

    .source-link:hover {
      text-decoration: underline;
    }
  `;
  document.head.appendChild(style);
})();