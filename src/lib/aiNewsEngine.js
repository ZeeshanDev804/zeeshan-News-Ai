import { generateAIText } from "./aiProvider.js";

const ALLOWED_CATEGORIES = [
  "world",
  "politics",
  "technology",
  "business",
  "sports",
  "entertainment",
];

const ALLOWED_SENTIMENTS = [
  "neutral",
  "positive",
  "negative",
];

const MAX_AI_CONTENT_LENGTH = 12000;
const MAX_HEADLINE_LENGTH = 140;
const MAX_SUMMARY_LENGTH = 600;
const MAX_SEO_TITLE_LENGTH = 60;
const MAX_KEY_POINTS = 6;
const MAX_KEY_POINT_LENGTH = 220;

function cleanText(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value = "", maxLength = 1000) {
  const text = cleanText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
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
      "league",
      "tournament",
      "goal",
      "coach",
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
      "robot",
      "chip",
      "computer",
      "startup",
    ],

    business: [
      "business",
      "market",
      "company",
      "economy",
      "stock",
      "investment",
      "finance",
      "bank",
      "trade",
      "revenue",
      "industry",
    ],

    entertainment: [
      "movie",
      "film",
      "actor",
      "actress",
      "music",
      "celebrity",
      "hollywood",
      "television",
      "tv",
      "singer",
      "concert",
    ],

    politics: [
      "government",
      "president",
      "prime minister",
      "election",
      "parliament",
      "minister",
      "political",
      "senate",
      "congress",
      "policy",
      "vote",
    ],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return "world";
}

function createLocalSummary(content = "", title = "") {
  const text = cleanText(content);

  if (!text) {
    return limitText(title, MAX_SUMMARY_LENGTH);
  }

  return limitText(text, 280);
}

function createSeoTitle(title = "") {
  return limitText(title, MAX_SEO_TITLE_LENGTH);
}

function normalizeCategory(category, fallback = "world") {
  const value = cleanText(category).toLowerCase();

  if (ALLOWED_CATEGORIES.includes(value)) {
    return value;
  }

  return fallback;
}

function normalizeSentiment(sentiment) {
  const value = cleanText(sentiment).toLowerCase();

  if (ALLOWED_SENTIMENTS.includes(value)) {
    return value;
  }

  return "neutral";
}

function normalizeKeyPoints(keyPoints = []) {
  if (!Array.isArray(keyPoints)) {
    return [];
  }

  return keyPoints
    .map((item) => limitText(item, MAX_KEY_POINT_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_KEY_POINTS);
}

function removeCodeFence(text = "") {
  return String(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text = "") {
  const cleaned = removeCodeFence(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with object extraction below.
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const possibleJson = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(possibleJson);
  } catch {
    return null;
  }
}

function buildPrompt({
  source,
  title,
  content,
  category,
}) {
  return `
Analyze this news article for ZEESHAN NEWS AI.

Return ONLY valid JSON.
Do not use Markdown.
Do not use code fences.
Do not add explanations outside the JSON.

Required JSON structure:

{
  "headline": "",
  "summary": "",
  "category": "",
  "seo_title": "",
  "sentiment": "",
  "key_points": []
}

Rules:

1. Never invent facts.
2. Use ONLY information contained in the supplied source, title, and content.
3. Keep the article summary neutral and factual.
4. Do not copy the source article.
5. Do not reproduce long sentences from the source.
6. Create an original concise summary.
7. Keep important names, dates, numbers, places, and organizations accurate.
8. If information is uncertain or incomplete, do not present assumptions as facts.
9. "category" must be exactly one of:
   world, politics, technology, business, sports, entertainment.
10. "sentiment" must be exactly one of:
   neutral, positive, negative.
11. "summary" should be concise, approximately 2-4 sentences.
12. "key_points" should contain short factual points.
13. Use a maximum of 6 key points.
14. "seo_title" should be concise and suitable for a news webpage.
15. Do not create clickbait or misleading headlines.
16. Do not add information from your own knowledge.
17. The supplied content may be truncated, so only use the information actually provided.

Suggested local category:
${category}

SOURCE:
${source || "Unknown"}

TITLE:
${title}

CONTENT:
${content || "No article content available."}
`.trim();
}

export async function analyzeNewsArticle(article) {
  const title = cleanText(article?.title || "");

  const rawContent = cleanText(
    article?.content ||
      article?.description ||
      ""
  );

  const content = rawContent.slice(0, MAX_AI_CONTENT_LENGTH);

  const source = cleanText(article?.source || "");

  if (!title) {
    return {
      success: false,
      error: "Article title is required",
    };
  }

  const category = detectCategory(title, content);

  const localSummary = createLocalSummary(
    content,
    title
  );

  const seoTitle = createSeoTitle(title);

  const prompt = buildPrompt({
    source,
    title,
    content,
    category,
  });

  try {
    const aiText = await generateAIText(prompt);

    const aiResult = extractJsonObject(aiText);

    if (!aiResult || typeof aiResult !== "object") {
      console.error(
        "❌ Gemini returned invalid JSON for article:",
        article?.id
      );

      return {
        success: true,
        articleId: article?.id || null,
        source,
        originalTitle: title,
        headline: title,
        summary: localSummary,
        category,
        seoTitle,
        sentiment: "neutral",
        keyPoints: [],
        status: "local_fallback",
        aiError: "Gemini returned invalid JSON",
      };
    }

    const finalHeadline =
      limitText(
        aiResult.headline || title,
        MAX_HEADLINE_LENGTH
      ) || title;

    const finalSummary =
      limitText(
        aiResult.summary || localSummary,
        MAX_SUMMARY_LENGTH
      ) || localSummary;

    const finalCategory = normalizeCategory(
      aiResult.category,
      category
    );

    const finalSeoTitle =
      createSeoTitle(
        aiResult.seo_title || seoTitle
      ) || seoTitle;

    const finalSentiment = normalizeSentiment(
      aiResult.sentiment
    );

    const finalKeyPoints = normalizeKeyPoints(
      aiResult.key_points
    );

    return {
      success: true,
      articleId: article?.id || null,
      source,
      originalTitle: title,

      headline: finalHeadline,

      summary: finalSummary,

      category: finalCategory,

      seoTitle: finalSeoTitle,

      sentiment: finalSentiment,

      keyPoints: finalKeyPoints,

      status: "ai_analyzed",
    };
  } catch (error) {
    console.error(
      "❌ AI analysis failed:",
      error?.message || error
    );

    return {
      success: true,
      articleId: article?.id || null,
      source,
      originalTitle: title,

      headline: title,

      summary: localSummary,

      category,

      seoTitle,

      sentiment: "neutral",

      keyPoints: [],

      status: "local_fallback",

      aiError: error?.message || "Unknown AI error",
    };
  }
}

export async function analyzeNewsBatch(articles = []) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return [];
  }

  const results = [];

  for (const article of articles) {
    try {
      const result = await analyzeNewsArticle(article);

      if (result?.success) {
        results.push(result);
      }
    } catch (error) {
      console.error(
        "❌ Unexpected article analysis error:",
        error?.message || error
      );
    }
  }

  return results;
}