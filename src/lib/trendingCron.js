import {
  refreshTrendingScores,
} from "./trendingAutomation.js";

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
      `📊 Processed: ${result.processed}`
    );

    console.log(
      `❌ Failed: ${result.failed}`
    );

    return {
      success:
        result.success,

      type:
        "trending-refresh",

      startedAt,

      completedAt,

      ...result,
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

      startedAt,

      completedAt:
        new Date().toISOString(),

      processed: 0,

      failed: 0,

      error:
        error.message,
    };
  }
}

export function getTrendingCronStatus() {
  return {
    enabled: true,

    job:
      "Trending Score Refresh",

    source:
      "news_articles",

    destination:
      "article_trending_scores",

    automatic:
      true,

    fakeEngagement:
      false,

    artificialTraffic:
      false,
  };
}
