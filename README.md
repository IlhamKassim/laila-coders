# laila-coders

A Chrome extension **“Nutrition Label”** for social media: it scrapes a post, sends it through **Supabase**, and a **worker** runs **Gemini** (with Google Search grounding) to assess credibility, factual alignment, and visual integrity.

AI track (Path C) lives in [`ai-track/`](ai-track/) — **[documentation index](ai-track/docs/README.md)** (phases, Supabase bridge, Irfan contract). Phase 2 CLI, Phase 3 HTTP server or Supabase worker, `schemas/`.

---

## Extension pipeline

Extension inserts jobs; **worker** computes a **`post_hash`** (normalized caption + image URL) and checks **`post_analysis_cache`**. **Cache hit** → reuse stored JSON, set **`from_cache`**, no Gemini call. **Miss** → Gemini, then **upsert** cache and complete the row.

```mermaid
flowchart LR
  subgraph browser["Chrome — Instagram tab"]
    IG[(Instagram)]
    CS[content.js\nscrape caption + image]
    PU[popup.js\nSend to pipeline]
    BG[background.js\nPOST social_posts]
    IG --> CS
    PU -->|SCRAPE_POST| CS
    CS -->|text, image, platform| PU
    PU -->|POST_SCRAPED| BG
  end

  subgraph cloud["Supabase"]
    DB[(social_posts)]
    CACHE[(post_analysis_cache)]
  end

  subgraph backend["Your machine — worker.mjs"]
    W[claim + hash]
    G[Gemini +\nGoogle Search]
    W -->|lookup / upsert| CACHE
    W -->|miss| G
    G --> W
    W <-->|jobs + result| DB
  end

  BG -->|anon REST\npending_keywords| DB
```

```mermaid
sequenceDiagram
  participant U as User
  participant P as Popup
  participant C as content.js
  participant B as background.js
  participant S as Supabase
  participant W as worker.mjs
  participant G as Gemini

  U->>P: Click analyze on Instagram
  P->>C: SCRAPE_POST
  C-->>P: caption, image URL, platform
  P->>B: POST_SCRAPED
  B->>S: INSERT social_posts (pending_keywords)
  S-->>B: row id
  B-->>P: success + id
  W->>S: claim row → processing
  W->>S: SELECT post_analysis_cache by post_hash
  alt cache hit
    S-->>W: cached result
    W->>S: UPDATE completed, result, from_cache=true
  else cache miss
    W->>G: analyze (text + image)
    G-->>W: NutritionLabel JSON
    W->>S: INSERT/UPDATE post_analysis_cache
    W->>S: UPDATE completed, result, from_cache=false
  end
  Note over P,S: UI can poll social_posts by id; same post twice → hit count + cache reuse
```

More detail: [`ai-track/docs/supabase/SUPABASE_BRIDGE.md`](ai-track/docs/supabase/SUPABASE_BRIDGE.md) · cache: [`ai-track/docs/phases/PHASE4_CACHE.md`](ai-track/docs/phases/PHASE4_CACHE.md).
