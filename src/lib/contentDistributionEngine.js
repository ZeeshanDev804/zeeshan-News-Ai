const PLATFORMS = {
  WEBSITE: "website",
  YOUTUBE: "youtube",
  FACEBOOK: "facebook",
  X: "x",
  TIKTOK: "tiktok",
};

const DISTRIBUTION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  READY: "ready",
  PUBLISHED: "published",
  FAILED: "failed",
  BLOCKED: "blocked",
  HOLD: "hold",
};

const DEFAULT_PLATFORMS = [
  PLATFORMS.WEBSITE,
  PLATFORMS.YOUTUBE,
  PLATFORMS.FACEBOOK,
  PLATFORMS.X,
  PLATFORMS.TIKTOK,
];

/* =========================
   HELPERS
========================= */

function safeText(
  value,
  maxLength = 2000
) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safePlatform(
  platform
) {
  const value =
    safeText(
      platform,
      50
    ).toLowerCase();

  return Object.values(
    PLATFORMS
  ).includes(value)
    ? value
    : null;
}

function validArticleId(
  articleId
) {
  const id =
    Number(articleId);

  return (
    Number.isInteger(id) &&
    id > 0
  );
}

/* =========================
   ENSURE DISTRIBUTION TABLE
========================= */

export async function ensureContentDistributionTable(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS content_distribution (
      id SERIAL PRIMARY KEY,

      article_id INTEGER NOT NULL,

      platform TEXT NOT NULL,

      status TEXT NOT NULL DEFAULT 'pending',

      risk_level TEXT NOT NULL DEFAULT 'unknown',

      scheduled_at TIMESTAMP,

      published_at TIMESTAMP,

      external_id TEXT,

      external_url TEXT,

      error TEXT,

      attempts INTEGER NOT NULL DEFAULT 0,

      last_attempt_at TIMESTAMP,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(article_id, platform)
    )
  `);

  return {
    success: true,
  };
}

/* =========================
   GET ARTICLE
========================= */

async function getArticle(
  db,
  articleId
) {
  if (!validArticleId(articleId)) {
    throw new Error(
      "Valid article ID is required"
    );
  }

  const result =
    await db.query(
      `
      SELECT
        id,
        title,
        description,
        content,
        source,
        link,
        ai_headline,
        ai_summary,
        ai_category,
        seo_title,
        key_points,
        publication_status,
        publication_risk,
        publication_action,
        publication_score,
        legal_hold,
        legal_review_required,
        copyright_status,
        copyright_risk,
        takedown_status
      FROM articles
      WHERE id = $1
      LIMIT 1
      `,
      [
        Number(articleId),
      ]
    );

  if (
    result.rows.length === 0
  ) {
    throw new Error(
      `Article not found: ${articleId}`
    );
  }

  return result.rows[0];
}

/* =========================
   SAFETY CHECK
========================= */

function evaluateDistributionSafety(
  article
) {
  if (
    article.legal_hold === true
  ) {
    return {
      allowed: false,
      status:
        DISTRIBUTION_STATUS.BLOCKED,
      reason:
        "Legal hold is active",
    };
  }

  if (
    article.legal_review_required ===
    true
  ) {
    return {
      allowed: false,
      status:
        DISTRIBUTION_STATUS.BLOCKED,
      reason:
        "Legal review is required",
    };
  }

  const copyrightRisk =
    safeText(
      article.copyright_risk,
      100
    ).toLowerCase();

  const copyrightStatus =
    safeText(
      article.copyright_status,
      100
    ).toLowerCase();

  if (
    copyrightRisk === "high" ||
    copyrightStatus ===
      "blocked" ||
    copyrightStatus ===
      "takedown" ||
    copyrightStatus ===
      "high_risk"
  ) {
    return {
      allowed: false,
      status:
        DISTRIBUTION_STATUS.BLOCKED,
      reason:
        "Copyright protection blocked distribution",
    };
  }

  const takedownStatus =
    safeText(
      article.takedown_status,
      100
    ).toLowerCase();

  if (
    takedownStatus &&
    takedownStatus !== "none" &&
    takedownStatus !== "cleared" &&
    takedownStatus !== "rejected"
  ) {
    return {
      allowed: false,
      status:
        DISTRIBUTION_STATUS.BLOCKED,
      reason:
        "Active takedown issue",
    };
  }

  const publicationStatus =
    safeText(
      article.publication_status,
      100
    ).toLowerCase();

  if (
    publicationStatus ===
      "awaiting_ceo_approval" ||
    publicationStatus ===
      "held"
  ) {
    return {
      allowed: false,
      status:
        DISTRIBUTION_STATUS.HOLD,
      reason:
        "Article requires publication approval",
    };
  }

  if (
    publicationStatus !==
      "approved"
  ) {
    return {
      allowed: false,
      status:
        DISTRIBUTION_STATUS.HOLD,
      reason:
        "Article has not passed publication gate",
    };
  }

  return {
    allowed: true,

    status:
      DISTRIBUTION_STATUS.READY,

    reason:
      "Article passed distribution safety checks",
  };
}

/* =========================
   CREATE DISTRIBUTION JOBS
========================= */

export async function createDistributionJobs(
  db,
  articleId,
  platforms = DEFAULT_PLATFORMS
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(
    db
  );

  const article =
    await getArticle(
      db,
      articleId
    );

  const safety =
    evaluateDistributionSafety(
      article
    );

  const requestedPlatforms =
    Array.isArray(platforms)
      ? platforms
      : DEFAULT_PLATFORMS;

  const normalizedPlatforms =
    [
      ...new Set(
        requestedPlatforms
          .map(safePlatform)
          .filter(Boolean)
      ),
    ];

  if (
    normalizedPlatforms.length === 0
  ) {
    throw new Error(
      "At least
