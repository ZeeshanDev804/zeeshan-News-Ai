import {
  saveTrendingScore,
  ensureTrendingTable,
} from "./trendingStore.js";

export async function refreshTrendingScores(db) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureTrendingTable(db);

  const result = await db.query(`
    SELECT *
    FROM news_articles
    WHERE
      COALESCE(
        status,
        'published'
      ) = 'published'
    ORDER BY
      COALESCE(
        published_at,
        created_at
      ) DESC
    LIMIT 500
  `);

  const articles =
    result.rows || [];

  let processed = 0;
  let failed = 0;

  const errors = [];

  for (const article of articles) {
    try {
      await saveTrendingScore(
        db,
        article
      );

      processed += 1;
    } catch (error) {
      failed += 1;

      errors.push({
        articleId:
          article.id ??
          article.article_id ??
          null,

        error:
          error.message,
      });
    }
  }

  return {
    success: failed === 0,

    totalArticles:
      articles.length,

    processed,

    failed,

    errors:
      errors.slice(0, 20),

    completedAt:
      new Date().toISOString(),
  };
}

export async function refreshSingleTrendingScore(
  db,
  articleId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!articleId) {
    throw new Error(
      "Article ID is required"
    );
  }

  const result =
    await db.query(
      `
      SELECT *
      FROM news_articles
      WHERE id = $1
      LIMIT 1
      `,
      [articleId]
    );

  const article =
    result.rows[0];

  if (!article) {
    throw new Error(
      "Article not found"
    );
  }

  return saveTrendingScore(
    db,
    article
  );
}

export function getTrendingAutomationStatus() {
  return {
    enabled: true,

    engine:
      "ZEESHAN NEWS AI Trending Automation",

    source:
      "news_articles",

    maximumArticlesPerRun:
      500,

    databasePersistence:
      true,

    automaticRefresh:
      true,

    fakeEngagement:
      false,

    artificialTraffic:
      false,

    supportedLevels: [
      "viral",
      "hot",
      "rising",
      "normal",
      "low",
    ],
  };
}
