import {
  refreshTrendingScores,
} from "./trendingAutomation.js";

/* =========================
   RUN TRENDING CRON
========================= */

export async function runTrendingCron(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const startedAt =
    new Date().toISOString();

  console.log(
    "📈 Starting trending score refresh..."
  );

  try {
    const result =
      await refreshTrendingScores(
        db
      );

    const completedAt =
      new Date().toISOString();

    console.log(
      "✅ Trending score refresh completed"
    );

    console.log(
      `📊 Total articles: ${
        result.totalArticles || 0
      }`
    );

    console.log(
      `📊 Processed: ${
        result.processed || 0
      }`
    );

    console.log(
      `❌ Failed: ${
        result.failed || 0
      }`
    );

    return {
      success:
        result.success,

      type:
        "trending-refresh",

      source:
        "articles",

      destination:
        "article_trending_scores",

      startedAt,

      completedAt,

      totalArticles:
        result.totalArticles || 0,

      processed:
        result.processed || 0,

      failed:
        result.failed || 0,

      errors:
        result.errors || [],
    };
  } catch (error) {
    console.error(
      "❌ Trending cron error:",
      error.message
    );

    return {
      success: false,

      type:
        "trending-refresh",

      source:
        "articles",

      destination:
        "article_trending_scores",

      startedAt,

      completedAt:
        new Date().toISOString(),

      totalArticles: 0,

      processed: 0,

      failed: 0,

      errors: [],

      error:
        error.message,
    };
  }
}

/* =========================
   TRENDING CRON STATUS
========================= */

export function getTrendingCronStatus() {
  return {
    enabled: true,

    job:
      "Trending Score Refresh",

    source:
      "articles",

    destination:
      "article_trending_scores",

    automatic:
      true,

    maximumArticlesPerRun:
      500,

    legalHoldProtection:
      true,

    legalReviewProtection:
      true,

    fakeEngagement:
      false,

    artificialTraffic:
      false,
  };
}