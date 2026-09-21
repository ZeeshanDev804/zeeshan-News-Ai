const PLATFORMS = {
  WEBSITE: "website",
  YOUTUBE: "youtube",
  YOUTUBE_SHORTS: "youtube_shorts",
  FACEBOOK: "facebook",
  X: "x",
  TIKTOK: "tiktok",
  INSTAGRAM: "instagram",
};

const DISTRIBUTION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  READY: "ready",
  SCHEDULED: "scheduled",
  PUBLISHED: "published",
  FAILED: "failed",
  BLOCKED: "blocked",
  HOLD: "hold",
};

const DEFAULT_PLATFORMS = [
  PLATFORMS.WEBSITE,
  PLATFORMS.YOUTUBE,
  PLATFORMS.YOUTUBE_SHORTS,
  PLATFORMS.FACEBOOK,
  PLATFORMS.X,
  PLATFORMS.TIKTOK,
  PLATFORMS.INSTAGRAM,
];

/* =========================
   HELPERS
========================= */

function safeText(value, maxLength = 2000) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safePlatform(platform) {
  const value = safeText(platform, 50).toLowerCase();

  return Object.values(PLATFORMS).includes(value)
    ? value
    : null;
}

function validArticleId(articleId) {
  const id = Number(articleId);

  return Number.isInteger(id) && id > 0;
}

function validDistributionId(id) {
  const value = Number(id);

  return Number.isInteger(value) && value > 0;
}

function normalizeStatus(status) {
  const value = safeText(status, 50).toLowerCase();

  return Object.values(DISTRIBUTION_STATUS).includes(value)
    ? value
    : DISTRIBUTION_STATUS.PENDING;
}

function normalizeRiskLevel(riskLevel) {
  const value = safeText(riskLevel, 50).toLowerCase();

  if (["low", "medium", "high"].includes(value)) {
    return value;
  }

  return "unknown";
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeHashtags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => safeText(item, 100))
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeRegion(region) {
  return (
    safeText(region || "Worldwide", 100) ||
    "Worldwide"
  );
}

function normalizeJSON(value, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizeQueueItem(item = {}) {
  return {
    articleId: validArticleId(item.articleId)
      ? Number(item.articleId)
      : null,

    platform: safePlatform(item.platform),

    region: normalizeRegion(item.region),

    status: normalizeStatus(item.status),

    riskLevel: normalizeRiskLevel(
      item.riskLevel ||
        item.safetyResult?.riskLevel ||
        item.safety?.riskLevel ||
        item.publicationRisk
    ),

    title: safeText(
      item.title ||
        item.headline ||
        item.content?.title ||
        "",
      1000
    ),

    caption: safeText(
      item.caption ||
        item.content?.caption ||
        "",
      10000
    ),

    description: safeText(
      item.description ||
        item.content?.description ||
        "",
      10000
    ),

    hook: safeText(
      item.hook ||
        item.content?.hook ||
        "",
      1000
    ),

    closing: safeText(
      item.closing ||
        item.content?.closing ||
        "",
      1000
    ),

    callToAction: safeText(
      item.callToAction ||
        item.content?.callToAction ||
        "",
      1000
    ),

    thumbnailText: safeText(
      item.thumbnailText ||
        item.content?.thumbnailText ||
        "",
      500
    ),

    pinnedComment: safeText(
      item.pinnedComment ||
        item.content?.pinnedComment ||
        "",
      2000
    ),

    hashtags: normalizeHashtags(
      item.hashtags ||
        item.content?.hashtags
    ),

    safetyResult: normalizeJSON(
      item.safetyResult ||
        item.safety,
      null
    ),

    publishingResult: normalizeJSON(
      item.publishingResult ||
        item.publishing ||
        item.scheduleData,
      null
    ),

    scheduledAt: normalizeDate(
      item.scheduledAt ||
        item.publishingResult?.nextPublishAt ||
        item.publishingResult?.scheduledAt ||
        item.publishing?.nextPublishAt ||
        item.publishing?.scheduledAt ||
        item.scheduleData?.nextPublishAt ||
        item.scheduleData?.scheduledAt
    ),

    providerName:
      safeText(
        item.providerName ||
          item.publishingResult?.providerName ||
          "",
        200
      ) || null,

    providerPostId:
      safeText(
        item.providerPostId ||
          item.externalId ||
          item.publishingResult?.externalId ||
          "",
        500
      ) || null,

    externalUrl:
      safeText(
        item.externalUrl ||
          item.publishingResult?.externalUrl ||
          "",
        2000
      ) || null,

    publishedAt: normalizeDate(
      item.publishedAt
    ),

    errorMessage:
      safeText(
        item.errorMessage ||
          item.error ||
          "",
        5000
      ) || null,
  };
}

/* =========================
   ENSURE DISTRIBUTION TABLE
========================= */

export async function ensureContentDistributionTable(db) {
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

      region TEXT NOT NULL DEFAULT 'Worldwide',

      status TEXT NOT NULL DEFAULT 'pending',

      risk_level TEXT NOT NULL DEFAULT 'unknown',

      title TEXT,

      caption TEXT,

      description TEXT,

      hook TEXT,

      closing TEXT,

      call_to_action TEXT,

      thumbnail_text TEXT,

      pinned_comment TEXT,

      hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,

      safety_result JSONB,

      publishing_result JSONB,

      scheduled_at TIMESTAMP,

      published_at TIMESTAMP,

      provider_name TEXT,

      external_id TEXT,

      external_url TEXT,

      error TEXT,

      attempts INTEGER NOT NULL DEFAULT 0,

      last_attempt_at TIMESTAMP,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS region
      TEXT NOT NULL DEFAULT 'Worldwide';

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS risk_level
      TEXT NOT NULL DEFAULT 'unknown';

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS title TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS caption TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS description TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS hook TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS closing TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS call_to_action TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS thumbnail_text TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS pinned_comment TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS hashtags
      JSONB NOT NULL DEFAULT '[]'::jsonb;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS safety_result JSONB;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS publishing_result JSONB;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS provider_name TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS external_id TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS external_url TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS attempts
      INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS created_at
      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE content_distribution
      ADD COLUMN IF NOT EXISTS updated_at
      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      content_distribution_article_platform_region_idx
    ON content_distribution(
      article_id,
      platform,
      region
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
      content_distribution_status_idx
    ON content_distribution(status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
      content_distribution_platform_idx
    ON content_distribution(platform)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
      content_distribution_region_idx
    ON content_distribution(region)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
      content_distribution_scheduled_idx
    ON content_distribution(scheduled_at)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
      content