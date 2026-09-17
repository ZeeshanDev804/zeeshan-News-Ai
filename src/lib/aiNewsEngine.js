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

export async function analyzeNewsArticle(article) {
  const title = cleanText(article?.title || "");
  const content = cleanText(article?.content || "");
  const source = cleanText(article?.source || "");

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
  "key_points": []
}

Rules:
- Do not invent facts.
- Keep the summary neutral.
- Use only information available in the supplied article.
- Category must be one of:
  world, politics, technology, business, sports, entertainment.
- Keep summary concise.
- key_points must contain short factual points.

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
        key_points: [],
      };
    }

    return {
      success: true,
      articleId: article?.id || null,
      source,
      originalTitle: title,
      headline:
        aiResult.headline || title,
      summary:
        aiResult.summary || localSummary,
      category:
        aiResult.category || category,
      seoTitle:
        aiResult.seo_title || seoTitle,
      keyPoints:
        Array.isArray(aiResult.key_points)
          ? aiResult.key_points
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
      articleId: article?.id || null,
      source,
      originalTitle: title,
      headline: title,
      summary: localSummary,
      category,
      seoTitle,
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