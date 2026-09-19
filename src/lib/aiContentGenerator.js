import {
  generateAIText,
  isAIConfigured,
} from "./aiProvider.js";


const CONTENT_TYPES = new Set([
  "social_post",
  "short_caption",
  "seo_description",
  "breaking_post",
  "engagement_post",
  "video_script",
  "youtube_short",
  "tiktok_script",
  "instagram_reel",
  "facebook_video",
  "x_post",
  "thumbnail_text",
]);


const PLATFORM_RULES = {
  general: {
    name: "General",
    maxLength: 5000,
    style:
      "Professional, factual, concise and internationally understandable.",
  },

  youtube: {
    name: "YouTube",
    maxLength: 5000,
    style:
      "Suitable for YouTube news content. Avoid misleading titles, unsupported claims and repetitive low-value content.",
  },

  youtube_shorts: {
    name: "YouTube Shorts",
    maxLength: 2500,
    style:
      "Fast, clear and factual short-form news content suitable for vertical video.",
  },

  tiktok: {
    name: "TikTok",
    maxLength: 2500,
    style:
      "Short, engaging and factual vertical-video content. Do not use misleading hooks.",
  },

  instagram: {
    name: "Instagram",
    maxLength: 2500,
    style:
      "Concise Reel/social content with a strong but factual opening.",
  },

  facebook: {
    name: "Facebook",
    maxLength: 3000,
    style:
      "Clear and accessible news content suitable for Facebook audiences.",
  },

  x: {
    name: "X",
    maxLength: 1000,
    style:
      "Concise factual post suitable for X. Avoid unsupported claims and sensational wording.",
  },
};


function normalizeText(
  value,
  maxLength = 5000
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}


function normalizeContentType(
  value
) {
  const type =
    String(
      value || "social_post"
    )
      .trim()
      .toLowerCase();

  if (
    !CONTENT_TYPES.has(type)
  ) {
    throw new Error(
      "Invalid content type"
    );
  }

  return type;
}


function normalizePlatform(
  value
) {
  const platform =
    String(
      value || "general"
    )
      .trim()
      .toLowerCase();

  if (
    !PLATFORM_RULES[platform]
  ) {
    return "general";
  }

  return platform;
}


function cleanGeneratedText(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /^```(?:json|text)?/i,
      ""
    )
    .replace(
      /```$/g,
      ""
    )
    .trim();
}


function safeParseJSON(
  value
) {
  try {
    return JSON.parse(
      String(value || "").trim()
    );
  } catch {
    return null;
  }
}


function cleanGeneratedJSON(
  value
) {
  const text =
    String(value || "").trim();

  const parsed =
    safeParseJSON(text);

  if (parsed) {
    return parsed;
  }

  const firstBrace =
    text.indexOf("{");

  const lastBrace =
    text.lastIndexOf("}");

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    return safeParseJSON(
      text.slice(
        firstBrace,
        lastBrace + 1
      )
    );
  }

  return null;
}


function buildPrompt({
  title,
  summary,
  category,
  source,
  contentType,
  platform,
  region,
}) {
  const platformRule =
    PLATFORM_RULES[platform] ||
    PLATFORM_RULES.general;


  const typeInstructions = {
    social_post:
      "Create a professional social media news post.",

    short_caption:
      "Create a short social media caption.",

    seo_description:
      "Create an SEO-friendly meta description without clickbait.",

    breaking_post:
      "Create a breaking-news style post using only confirmed information.",

    engagement_post:
      "Create an engagement-focused post ending with a neutral question.",

    video_script:
      "Create a short-form news video script with a strong factual opening, clear body and concise ending.",

    youtube_short:
      "Create a vertical YouTube Shorts news script designed for concise delivery.",

    tiktok_script:
      "Create a TikTok-style news script that is engaging but factual and non-misleading.",

    instagram_reel:
      "Create an Instagram Reel news script with concise narration and visual suggestions.",

    facebook_video:
      "Create a Facebook video news script that is clear, factual and accessible.",

    x_post:
      "Create a concise factual X post.",

    thumbnail_text:
      "Create very short thumbnail text. Do not use misleading or exaggerated claims.",
  };


  return `
You are the AI Content Factory
for ZEESHAN NEWS AI.

Your job is to transform supplied
news information into original,
value-added content.

IMPORTANT CONTENT RULES:

1. Never invent facts.
2. Never invent statistics.
3. Never invent quotes.
4. Never invent sources.
5. Never present speculation as fact.
6. Do not copy the source article.
7. Do not reproduce long source text.
8. Keep wording original.
9. Preserve the factual meaning.
10. Do not use misleading clickbait.
11. Do not exaggerate breaking news.
12. Clearly distinguish confirmed information.
13. For political topics, remain neutral.
14. Do not promote or attack political actors.
15. Do not fabricate a person's opinion.
16. Do not pretend AI-generated text is a direct quote.
17. Do not create fake engagement.
18. Do not create fake views or fake likes.
19. Do not encourage manipulation of platform metrics.
20. Content must be suitable for human review before publishing.
21. Follow the requested platform style.
22. Keep the content useful for international audiences.
23. Do not include unsupported claims about people, companies or organizations.
24. If information is insufficient, stay general rather than inventing details.

CONTENT TYPE:
${contentType}

PLATFORM:
${platformRule.name}

PLATFORM STYLE:
${platformRule.style}

TARGET REGION:
${region || "Worldwide"}

CONTENT INSTRUCTION:
${typeInstructions[contentType]}

NEWS TITLE:
${title}

NEWS SUMMARY:
${summary}

CATEGORY:
${category}

SOURCE:
${source}

RETURN FORMAT:

Return ONLY valid JSON.

{
  "headline": "...",
  "content": "...",
  "hook": "...",
  "closing": "...",
  "visualSuggestions": [
    "...",
    "...",
    "..."
  ],
  "thumbnailText": "...",
  "hashtags": [
    "..."
  ],
  "seoKeywords": [
    "..."
  ]
}

Additional rules:

- headline must be factual.
- content must be original.
- hook must not be misleading.
- closing must not make unsupported claims.
- visualSuggestions must describe safe, relevant visuals.
- thumbnailText must be short and factual.
- hashtags must be relevant and limited.
- seoKeywords must be relevant to the supplied news.
- Never create fake quotes.
- Never claim that a video, image or source exists if it was not supplied.
- Never state that content was published unless an actual publishing system confirms it.
- Never state that views or likes were generated.
- Do not add explanations outside the JSON.
`;
}


export async function generateNewsContent(
  {
    title,
    summary = "",
    category = "general",
    source = "Unknown",
    contentType = "social_post",
    platform = "general",
    region = "Worldwide",
  } = {}
) {
  const normalizedTitle =
    normalizeText(
      title,
      1000
    );

  if (!normalizedTitle) {
    throw new Error(
      "News title is required"
    );
  }


  const normalizedSummary =
    normalizeText(
      summary,
      4000
    );


  const normalizedCategory =
    normalizeText(
      category,
      100
    ) ||
    "general";


  const normalizedSource =
    normalizeText(
      source,
      300
    ) ||
    "Unknown";


  const normalizedRegion =
    normalizeText(
      region,
      200
    ) ||
    "Worldwide";


  const normalizedContentType =
    normalizeContentType(
      contentType
    );


  const normalizedPlatform =
    normalizePlatform(
      platform
    );


  if (
    !isAIConfigured()
  ) {
    throw new Error(
      "AI provider is not configured"
    );
  }


  const prompt =
    buildPrompt({
      title:
        normalizedTitle,

      summary:
        normalizedSummary,

      category:
        normalizedCategory,

      source:
        normalizedSource,

      contentType:
        normalizedContentType,

      platform:
        normalizedPlatform,

      region:
        normalizedRegion,
    });


  const generated =
    await generateAIText(
      prompt
    );


  const cleaned =
    cleanGeneratedText(
      generated
    );


  if (!cleaned) {
    throw new Error(
      "AI content generator returned empty content"
    );
  }


  const structured =
    cleanGeneratedJSON(
      cleaned
    );


  if (!structured) {
    return {
      success: true,

      content:
        cleaned,

      headline:
        normalizedTitle,

      hook: "",

      closing: "",

      visualSuggestions: [],

      thumbnailText: "",

      hashtags: [],

      seoKeywords: [],

      contentType:
        normalizedContentType,

      platform:
        normalizedPlatform,

      region:
        normalizedRegion,

      category:
        normalizedCategory,

      source:
        normalizedSource,

      generatedAt:
        new Date().toISOString(),
    };
  }


  const content =
    normalizeText(
      structured.content,
      5000
    );


  if (!content) {
    throw new Error(
      "AI content generator returned empty content field"
    );
  }


  const visualSuggestions =
    Array.isArray(
      structured.visualSuggestions
    )
      ? structured.visualSuggestions
          .map((item) =>
            normalizeText(
              item,
              500
            )
          )
          .filter(Boolean)
          .slice(0, 6)
      : [];


  const hashtags =
    Array.isArray(
      structured.hashtags
    )
      ? structured.hashtags
          .map((item) =>
            normalizeText(
              item,
              100
            )
          )
          .filter(Boolean)
          .slice(0, 10)
      : [];


  const seoKeywords =
    Array.isArray(
      structured.seoKeywords
    )
      ? structured.seoKeywords
          .map((item) =>
            normalizeText(
              item,
              150
            )
          )
          .filter(Boolean)
          .slice(0, 15)
      : [];


  return {
    success: true,

    content,

    headline:
      normalizeText(
        structured.headline,
        1000
      ) ||
      normalizedTitle,

    hook:
      normalizeText(
        structured.hook,
        1000
      ),

    closing:
      normalizeText(
        structured.closing,
        1000
      ),

    visualSuggestions,

    thumbnailText:
      normalizeText(
        structured.thumbnailText,
        200
      ),

    hashtags,

    seoKeywords,

    contentType:
      normalizedContentType,

    platform:
      normalizedPlatform,

    region:
      normalizedRegion,

    category:
      normalizedCategory,

    source:
      normalizedSource,

    generatedAt:
      new Date().toISOString(),
  };
}


export async function generateArticleContent(
  article,
  contentType = "social_post",
  options = {}
) {
  if (
    !article ||
    typeof article !== "object"
  ) {
    throw new Error(
      "Article data is required"
    );
  }


  return generateNewsContent({
    title:
      article.title,

    summary:
      article.ai_summary ||
      article.description ||
      article.content ||
      "",

    category:
      article.ai_category ||
      "general",

    source:
      article.source ||
      "Unknown",

    contentType,

    platform:
      options.platform ||
      "general",

    region:
      options.region ||
      "Worldwide",
  });
}


export async function generateVideoContent(
  article,
  {
    platform = "youtube_shorts",
    region = "Worldwide",
  } = {}
) {
  return generateArticleContent(
    article,
    "video_script",
    {
      platform,
      region,
    }
  );
}


export async function generateSocialContent(
  article,
  {
    platform = "general",
    region = "Worldwide",
  } = {}
) {
  return generateArticleContent(
    article,
    "social_post",
    {
      platform,
      region,
    }
  );
}


export function getSupportedContentTypes() {
  return [
    "social_post",
    "short_caption",
    "seo_description",
    "breaking_post",
    "engagement_post",
    "video_script",
    "youtube_short",
    "tiktok_script",
    "instagram_reel",
    "facebook_video",
    "x_post",
    "thumbnail_text",
  ];
}


export function getSupportedPlatforms() {
  return Object.keys(
    PLATFORM_RULES
  );
}
