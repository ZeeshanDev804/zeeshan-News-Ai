import {
  saveTrendingScore,
  ensureTrendingTable,
} from "./trendingStore.js";

/* =========================
   REFRESH ALL TRENDING SCORES
========================= */

export async function refreshTrendingScores(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureTrendingTable(db);

  const result =
    await db.query(`
      SELECT *
      FROM articles

      WHERE
        COALESCE(
          legal_hold,
          FALSE
        ) = FALSE

      AND
        COALESCE(
          legal_review_required,
          FALSE
        ) = FALSE

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

        title:
          article.title || "",

        error:
          error.message,
      });
    }
  }

  return {
    success:
      failed === 0,

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

/* =========================
   REFRESH SINGLE ARTICLE
========================= */

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
      FROM articles

      WHERE
        id = $1

      AND
        COALESCE(
          legal_hold,
          FALSE
        ) = FALSE

      AND
        COALESCE(
          legal_review_required,
          FALSE
        ) = FALSE

      LIMIT 1
      `,
      [articleId]
    );

  const article =
    result.rows[0];

  if (!article) {
    throw new Error(
      "Article not found or unavailable for trending"
    );
  }

  return saveTrendingScore(
    db,
    article
  );
}

/* =========================
   TRENDING AUTOMATION STATUS
========================= */

export function getTrendingAutomationStatus() {
  return {
    enabled: true,

    engine:
      "ZEESHAN NEWS AI Trending Automation",

    source:
      "articles",

    destination:
      "article_trending_scores",

    maximumArticlesPerRun:
      500,

    databasePersistence:
      true,

    automaticRefresh:
      true,

    legalHoldProtection:
      true,

    legalReviewProtection:
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