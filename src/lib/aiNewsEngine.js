import { generateAIText } from "./aiProvider.js";

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(title = "", content = "") {
  const text = `${title} ${content}`.toLowerCase();

  const categories = {
    sports: [
      "football",
      "cricket",
      "tennis",
      "match",
      "player",
      "team",
      "championship",
    ],

    technology: [
      "ai",
      "artificial intelligence",
      "software",
      "technology",
      "google",
      "apple",
      "microsoft",
      "cyber",
    ],

    business: [
      "business",
      "market",
      "company",
      "economy",
      "stock",
      "investment",
      "finance",
    ],

    entertainment: [
      "movie",
      "film",
      "actor",
      "actress",
      "music",
      "celebrity",
      "hollywood",
    ],

    politics: [
      "government",
      "president",
      "prime minister",
      "election",
      "parliament",
      "minister",
    ],
  };

  for (const [category, keywords] of Object.entries(
    categories
  )) {
    if (
      keywords.some((keyword) =>
        text.includes(keyword)
      )
    ) {
      return category;
    }
  }

  return "world";
}

function createLocalSummary(
  content = "",
  title = ""
) {
  const text = cleanText(content);

  if (!text) {
    return title;
  }

  if (text.length <= 280) {
    return text;
  }

  return `${text.slice(0, 277)}...`;
}

function createSeoTitle(title = "") {
  const cleanTitle = cleanText(title);

  if (cleanTitle.length <= 60) {
    return cleanTitle;
  }

  return `${cleanTitle.slice(0, 57)}...`;
}

function normalizeCategory(category, fallback) {
  const allowed = [
    "world",
    "politics",
    "technology",
    "business",
    "sports",
    "entertainment",
  ];

  const value = cleanText(category).toLowerCase();

  return allowed.includes(value)
    ? value
    : fallback;
}

export async function analyzeNewsArticle(article) {
  const title = cleanText(article?.title || "");

  const content = cleanText(
    article?.content ||
      article?.description ||
      ""
  );

  const source = cleanText(
    article?.source || ""
  );

  if (!title) {
    return {
      success: false,
      error: "Article title is required",
    };
  }

  const category = detectCategory(
    title,
    content
  );

  const localSummary = createLocalSummary(
    content,
    title
  );

  const seoTitle = createSeoTitle(title);

  const prompt = `
Analyze this news article for ZEESHAN NEWS AI.

Return ONLY valid JSON with these fields:

{
  "headline": "",
  "summary": "",
  "category": "",
  "seo_title": "",
  "sentiment": "",
  "key_points": []
}

Rules:
- Do not invent facts.
- Keep the summary neutral.
- Use only information available in the supplied article.
- Category must be one of:
  world, politics, technology, business, sports, entertainment.
- Sentiment must be one of:
  neutral, positive, negative.
- Keep summary concise.
- key_points must contain short factual points.
- Do not add information that is not in the source article.

SOURCE:
${source}

TITLE:
${title}

CONTENT:
${content}
`;

  try {
    const aiText = await generateAIText(prompt);

    let aiResult;

    try {
      aiResult = JSON.parse(aiText);
    } catch {
      aiResult = {
        headline: title,
        summary: aiText,
        category,
        seo_title: seoTitle,
        sentiment: "neutral",
        key_points: [],
      };
    }

    const finalCategory = normalizeCategory(
      aiResult.category,
      category
    );

    const finalSentiment = [
      "neutral",
      "positive",
      "negative",
    ].includes(
      String(
        aiResult.sentiment || ""
      ).toLowerCase()
    )
      ? String(
          aiResult.sentiment
        ).toLowerCase()
      : "neutral";

    return {
      success: true,

      articleId:
        article?.id || null,

      source,

      originalTitle: title,

      headline:
        cleanText(
          aiResult.headline || title
        ) || title,

      summary:
        cleanText(
          aiResult.summary || localSummary
        ) || localSummary,

      category: finalCategory,

      seoTitle:
        cleanText(
          aiResult.seo_title || seoTitle
        ) || seoTitle,

      sentiment: finalSentiment,

      keyPoints:
        Array.isArray(
          aiResult.key_points
        )
          ? aiResult.key_points
              .map((item) =>
                cleanText(item)
              )
              .filter(Boolean)
          : [],

      status: "ai_analyzed",
    };
  } catch (error) {
    console.error(
      "❌ AI analysis failed:",
      error.message
    );

    return {
      success: true,

      articleId:
        article?.id || null,

      source,

      originalTitle: title,

      headline: title,

      summary: localSummary,

      category,

      seoTitle,

      sentiment: "neutral",

      keyPoints: [],

      status: "local_fallback",

      aiError: error.message,
    };
  }
}

export async function analyzeNewsBatch(
  articles = []
) {
  const results = [];

  for (const article of articles) {
    const result =
      await analyzeNewsArticle(article);

    if (result.success) {
      results.push(result);
    }
  }

  return results;
}