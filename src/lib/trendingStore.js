import {
  calculateTrendingScore,
  calculateRecencyScore,
  calculateSourceScore,
  calculateEngagementScore,
  calculateVelocityScore,
  calculateUniquenessScore,
  getTrendLevel,
} from "./trendingIntelligence.js";

/* =========================
   TABLE SETUP
========================= */

export async function ensureTrendingTable(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS article_trending_scores (
      id BIGSERIAL PRIMARY KEY,

      article_id INTEGER NOT NULL,

      trending_score
        NUMERIC(8,2)
        NOT NULL DEFAULT 0,

      trend_level
        TEXT
        NOT NULL DEFAULT 'normal',

      recency_score
        NUMERIC(8,2)
        NOT NULL DEFAULT 0,

      source_score
        NUMERIC(8,2)
        NOT NULL DEFAULT 0,

      engagement_score
        NUMERIC(8,2)
        NOT NULL DEFAULT 0,

      velocity_score
        NUMERIC(8,2)
        NOT NULL DEFAULT 0,

      uniqueness_score
        NUMERIC(8,2)
        NOT NULL DEFAULT 0,

      analyzed_at
        TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      updated_at
        TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(article_id)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_trending_score
    ON article_trending_scores(
      trending_score DESC
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_trending_level
    ON article_trending_scores(
      trend_level
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_trending_updated
    ON article_trending_scores(
      updated_at DESC
    )
  `);
}

/* =========================
   SAVE TRENDING SCORE
========================= */

export async function saveTrendingScore(
  db,
  article
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureTrendingTable(
    db
  );

  const articleId =
    article?.id ??
    article?.article_id;

  if (!articleId) {
    throw new Error(
      "Article ID is required"
    );
  }

  const trendingScore =
    calculateTrendingScore(
      article
    );

  const publishedAt =
    article?.published_at ??
    article?.publishedAt ??
    article?.created_at;

  const recencyScore =
    calculateRecencyScore(
      publishedAt
    );

  const sourceScore =
    calculateSourceScore(
      article
    );

  const engagementScore =
    calculateEngagementScore(
      article
    );

  const velocityScore =
    calculateVelocityScore(
      article
    );

  const uniquenessScore =
    calculateUniquenessScore(
      article
    );

  const trendLevel =
    getTrendLevel(
      trendingScore
    );

  const result =
    await db.query(
      `
      INSERT INTO article_trending_scores (
        article_id,
        trending_score,
        trend_level,
        recency_score,
        source_score,
        engagement_score,
        velocity_score,
        uniqueness_score,
        analyzed_at,
        updated_at
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )

      ON CONFLICT (
        article_id
      )

      DO UPDATE SET

        trending_score =
          EXCLUDED.trending_score,

        trend_level =
          EXCLUDED.trend_level,

        recency_score =
          EXCLUDED.recency_score,

        source_score =
          EXCLUDED.source_score,

        engagement_score =
          EXCLUDED.engagement_score,

        velocity_score =
          EXCLUDED.velocity_score,

        uniqueness_score =
          EXCLUDED.uniqueness_score,

        analyzed_at =
          CURRENT_TIMESTAMP,

        updated_at =
          CURRENT_TIMESTAMP

      RETURNING *
      `,
      [
        articleId,
        trendingScore,
        trendLevel,
        recencyScore,
        sourceScore,
        engagementScore,
        velocityScore,
        uniquenessScore,
      ]
    );

  return result.rows[0];
}

/* =========================
   GET STORED TRENDING
========================= */

export async function getStoredTrendingArticles(
  db,
  limit = 20
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureTrendingTable(
    db
  );

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      100
    );

  const result =
    await db.query(
      `
      SELECT
        ts.*,

        a.title,

        a.source,

        a.link,

        a.category,

        a.published_at

      FROM article_trending_scores ts

      LEFT JOIN articles a
        ON a.id = ts.article_id

      WHERE
        COALESCE(
          a.legal_hold,
          FALSE
        ) = FALSE

      ORDER BY
        ts.trending_score DESC

      LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows;
}

/* =========================
   GET ARTICLE SCORE
========================= */

export async function getStoredTrendingScore(
  db,
  articleId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureTrendingTable(
    db
  );

  const result =
    await db.query(
      `
      SELECT *
      FROM article_trending_scores
      WHERE article_id = $1
      LIMIT 1
      `,
      [articleId]
    );

  return (
    result.rows[0] ||
    null
  );
}

/* =========================
   TRENDING STORE STATUS
========================= */

export function getTrendingStoreStatus() {
  return {
    enabled: true,

    table:
      "article_trending_scores",

    sourceTable:
      "articles",

    databasePersistence:
      true,

    uniqueArticleScores:
      true,

    supportedLevels: [
      "viral",
      "hot",
      "rising",
      "normal",
      "low",
    ],
  };
}