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
      content_distribution_article_idx
    ON content_distribution(article_id)
  `);

  return {
    success: true,
    table: "content_distribution",
  };
}

/* =========================
   GET ARTICLE
========================= */

async function getArticle(db, articleId) {
  if (!validArticleId(articleId)) {
    throw new Error(
      "Valid article ID is required"
    );
  }

  const result = await db.query(
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
    [Number(articleId)]
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Article not found: ${articleId}`
    );
  }

  return result.rows[0];
}

/* =========================
   SAFETY CHECK
========================= */

function evaluateDistributionSafety(article) {
  const legalHold =
    article.legal_hold === true ||
    String(article.legal_hold).toLowerCase() ===
      "true";

  const legalReview =
    article.legal_review_required === true ||
    String(article.legal_review_required).toLowerCase() ===
      "true";

  if (legalHold) {
    return {
      allowed: false,
      status: DISTRIBUTION_STATUS.BLOCKED,
      reason: "Legal hold is active",
    };
  }

  if (legalReview) {
    return {
      allowed: false,
      status: DISTRIBUTION_STATUS.BLOCKED,
      reason: "Legal review is required",
    };
  }

  const copyrightRisk = safeText(
    article.copyright_risk,
    100
  ).toLowerCase();

  const copyrightStatus = safeText(
    article.copyright_status,
    100
  ).toLowerCase();

  if (
    copyrightRisk === "high" ||
    copyrightRisk === "critical" ||
    [
      "blocked",
      "takedown",
      "high_risk",
      "held",
    ].includes(copyrightStatus)
  ) {
    return {
      allowed: false,
      status: DISTRIBUTION_STATUS.BLOCKED,
      reason:
        "Copyright protection blocked distribution",
    };
  }

  const takedownStatus = safeText(
    article.takedown_status,
    100
  ).toLowerCase();

  if (
    takedownStatus &&
    ![
      "none",
      "cleared",
      "rejected",
      "resolved",
    ].includes(takedownStatus)
  ) {
    return {
      allowed: false,
      status: DISTRIBUTION_STATUS.BLOCKED,
      reason: "Active takedown issue",
    };
  }

  const publicationStatus = safeText(
    article.publication_status,
    100
  ).toLowerCase();

  if (
    [
      "awaiting_ceo_approval",
      "held",
      "pending",
    ].includes(publicationStatus)
  ) {
    return {
      allowed: false,
      status: DISTRIBUTION_STATUS.HOLD,
      reason:
        "Article requires publication approval",
    };
  }

  if (publicationStatus !== "approved") {
    return {
      allowed: false,
      status: DISTRIBUTION_STATUS.HOLD,
      reason:
        "Article has not passed publication gate",
    };
  }

  return {
    allowed: true,
    status: DISTRIBUTION_STATUS.READY,
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
  platforms = DEFAULT_PLATFORMS,
  region = "Worldwide"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(db);

  const article = await getArticle(
    db,
    articleId
  );

  const safety =
    evaluateDistributionSafety(article);

  const requestedPlatforms =
    Array.isArray(platforms)
      ? platforms
      : DEFAULT_PLATFORMS;

  const normalizedPlatforms = [
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
      "At least one valid distribution platform is required"
    );
  }

  const safeRegion =
    normalizeRegion(region);

  const jobs = [];

  for (
    const platform of normalizedPlatforms
  ) {
    const result = await db.query(
      `
      INSERT INTO content_distribution (
        article_id,
        platform,
        region,
        status,
        risk_level,
        title,
        description,
        safety_result,
        created_at,
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
        $8::jsonb,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (
        article_id,
        platform,
        region
      )
      DO UPDATE SET
        status = EXCLUDED.status,
        risk_level = EXCLUDED.risk_level,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        safety_result = EXCLUDED.safety_result,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        Number(articleId),
        platform,
        safeRegion,
        safety.status,
        normalizeRiskLevel(
          article.publication_risk
        ),
        safeText(
          article.ai_headline ||
            article.title,
          1000
        ),
        safeText(
          article.ai_summary ||
            article.description ||
            "",
          10000
        ),
        JSON.stringify(safety),
      ]
    );

    jobs.push(result.rows[0]);
  }

  return {
    success: true,
    articleId: Number(articleId),
    region: safeRegion,
    safety,
    jobs,
  };
}

/* =========================
   SAVE DISTRIBUTION BATCH
========================= */

export async function saveDistributionBatch(
  db,
  items = []
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!Array.isArray(items)) {
    throw new Error(
      "Distribution items must be an array"
    );
  }

  await ensureContentDistributionTable(db);

  const saved = [];
  const skipped = [];

  for (const rawItem of items) {
    try {
      const item =
        normalizeQueueItem(rawItem);

      if (!item.articleId) {
        skipped.push({
          reason:
            "Valid articleId is required",
          item: rawItem,
        });

        continue;
      }

      if (!item.platform) {
        skipped.push({
          reason:
            "Valid distribution platform is required",
          item: rawItem,
        });

        continue;
      }

      const result = await db.query(
        `
        INSERT INTO content_distribution (
          article_id,
          platform,
          region,
          status,
          risk_level,
          title,
          caption,
          description,
          hook,
          closing,
          call_to_action,
          thumbnail_text,
          pinned_comment,
          hashtags,
          safety_result,
          publishing_result,
          scheduled_at,
          provider_name,
          external_id,
          external_url,
          published_at,
          error,
          created_at,
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
          $9,
          $10,
          $11,
          $12,
          $13,
          $14::jsonb,
          $15::jsonb,
          $16::jsonb,
          $17,
          $18,
          $19,
          $20,
          $21,
          $22,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (
          article_id,
          platform,
          region
        )
        DO UPDATE SET
          status = EXCLUDED.status,
          risk_level = EXCLUDED.risk_level,
          title = EXCLUDED.title,
          caption = EXCLUDED.caption,
          description = EXCLUDED.description,
          hook = EXCLUDED.hook,
          closing = EXCLUDED.closing,
          call_to_action = EXCLUDED.call_to_action,
          thumbnail_text = EXCLUDED.thumbnail_text,
          pinned_comment = EXCLUDED.pinned_comment,
          hashtags = EXCLUDED.hashtags,
          safety_result = EXCLUDED.safety_result,
          publishing_result = EXCLUDED.publishing_result,
          scheduled_at = EXCLUDED.scheduled_at,
          provider_name = EXCLUDED.provider_name,
          external_id = EXCLUDED.external_id,
          external_url = EXCLUDED.external_url,
          published_at = EXCLUDED.published_at,
          error = EXCLUDED.error,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
        `,
        [
          item.articleId,
          item.platform,
          item.region,
          item.status,
          item.riskLevel,
          item.title,
          item.caption,
          item.description,
          item.hook,
          item.closing,
          item.callToAction,
          item.thumbnailText,
          item.pinnedComment,
          JSON.stringify(item.hashtags),
          JSON.stringify(
            item.safetyResult || {}
          ),
          JSON.stringify(
            item.publishingResult || {}
          ),
          item.scheduledAt,
          item.providerName,
          item.providerPostId,
          item.externalUrl,
          item.publishedAt,
          item.errorMessage,
        ]
      );

      saved.push(result.rows[0]);
    } catch (error) {
      skipped.push({
        reason:
          error?.message ||
          "Distribution save failed",
        item: rawItem,
      });
    }
  }

  return {
    success: true,
    savedCount: saved.length,
    skippedCount: skipped.length,
    saved,
    skipped,
  };
}

/* =========================
   GET DISTRIBUTION
========================= */

export async function getDistribution(
  db,
  {
    articleId = null,
    platform = null,
    region = null,
    status = null,
    limit = 100,
  } = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(db);

  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 100,
      1
    ),
    500
  );

  const conditions = [];
  const values = [];

  if (validArticleId(articleId)) {
    values.push(Number(articleId));

    conditions.push(
      `article_id = $${values.length}`
    );
  }

  const normalizedPlatform =
    safePlatform(platform);

  if (normalizedPlatform) {
    values.push(normalizedPlatform);

    conditions.push(
      `platform = $${values.length}`
    );
  }

  if (region) {
    values.push(
      normalizeRegion(region)
    );

    conditions.push(
      `region = $${values.length}`
    );
  }

  if (status) {
    values.push(
      normalizeStatus(status)
    );

    conditions.push(
      `status = $${values.length}`
    );
  }

  const where =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  values.push(safeLimit);

  const result = await db.query(
    `
    SELECT *
    FROM content_distribution
    ${where}
    ORDER BY
      COALESCE(
        scheduled_at,
        created_at
      ) ASC,
      id DESC
    LIMIT $${values.length}
    `,
    values
  );

  return {
    success: true,
    count: result.rows.length,
    items: result.rows,
  };
}

/* =========================
   GET SINGLE DISTRIBUTION
========================= */

export async function getDistributionById(
  db,
  id
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!validDistributionId(id)) {
    throw new Error(
      "Valid distribution ID is required"
    );
  }

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    SELECT *
    FROM content_distribution
    WHERE id = $1
    LIMIT 1
    `,
    [Number(id)]
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Distribution job not found: ${id}`
    );
  }

  return {
    success: true,
    item: result.rows[0],
  };
}

/* =========================
   UPDATE DISTRIBUTION STATUS
========================= */

export async function updateDistributionStatus(
  db,
  id,
  status,
  options = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!validDistributionId(id)) {
    throw new Error(
      "Valid distribution ID is required"
    );
  }

  await ensureContentDistributionTable(db);

  const normalizedStatus =
    normalizeStatus(status);

  const scheduledAt =
    normalizeDate(
      options.scheduledAt
    );

  const publishedAt =
    normalizeDate(
      options.publishedAt
    );

  const errorMessage =
    safeText(
      options.errorMessage ||
        options.error ||
        "",
      5000
    ) || null;

  const providerName =
    safeText(
      options.providerName || "",
      200
    ) || null;

  const externalId =
    safeText(
      options.externalId ||
        options.providerPostId ||
        "",
      500
    ) || null;

  const externalUrl =
    safeText(
      options.externalUrl || "",
      2000
    ) || null;

  const publishingResult =
    normalizeJSON(
      options.publishingResult ||
        options.publishing,
      null
    );

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      status = $1,

      scheduled_at =
        COALESCE(
          $2,
          scheduled_at
        ),

      published_at =
        COALESCE(
          $3,
          published_at
        ),

      provider_name =
        COALESCE(
          $4,
          provider_name
        ),

      external_id =
        COALESCE(
          $5,
          external_id
        ),

      external_url =
        COALESCE(
          $6,
          external_url
        ),

      error = $7,

      publishing_result =
        COALESCE(
          $8::jsonb,
          publishing_result
        ),

      attempts =
        CASE
          WHEN $1 = 'failed'
          THEN attempts + 1
          ELSE attempts
        END,

      last_attempt_at =
        CASE
          WHEN $1 IN (
            'failed',
            'published',
            'scheduled'
          )
          THEN CURRENT_TIMESTAMP
          ELSE last_attempt_at
        END,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE id = $9

    RETURNING *
    `,
    [
      normalizedStatus,
      scheduledAt,
      publishedAt,
      providerName,
      externalId,
      externalUrl,
      errorMessage,
      publishingResult
        ? JSON.stringify(
            publishingResult
          )
        : null,
      Number(id),
    ]
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Distribution job not found: ${id}`
    );
  }

  return {
    success: true,
    item: result.rows[0],
  };
}

/* =========================
   MARK READY
========================= */

export async function markDistributionReady(
  db,
  id,
  options = {}
) {
  return updateDistributionStatus(
    db,
    id,
    DISTRIBUTION_STATUS.READY,
    options
  );
}

/* =========================
   MARK APPROVED
========================= */

export async function approveDistribution(
  db,
  id,
  options = {}
) {
  return updateDistributionStatus(
    db,
    id,
    DISTRIBUTION_STATUS.APPROVED,
    options
  );
}

/* =========================
   MARK SCHEDULED
========================= */

export async function markDistributionScheduled(
  db,
  id,
  scheduledAt,
  options = {}
) {
  return updateDistributionStatus(
    db,
    id,
    DISTRIBUTION_STATUS.SCHEDULED,
    {
      ...options,
      scheduledAt,
    }
  );
}

/* =========================
   MARK PUBLISHED
========================= */

export async function markDistributionPublished(
  db,
  id,
  options = {}
) {
  return updateDistributionStatus(
    db,
    id,
    DISTRIBUTION_STATUS.PUBLISHED,
    {
      ...options,
      publishedAt:
        options.publishedAt ||
        new Date(),
    }
  );
}

/* =========================
   MARK FAILED
========================= */

export async function markDistributionFailed(
  db,
  id,
  error,
  options = {}
) {
  return updateDistributionStatus(
    db,
    id,
    DISTRIBUTION_STATUS.FAILED,
    {
      ...options,
      errorMessage:
        error ||
        options.errorMessage ||
        "Distribution failed",
    }
  );
}

/* =========================
   BLOCK DISTRIBUTION
========================= */

export async function blockDistribution(
  db,
  id,
  reason = "Distribution blocked",
  options = {}
) {
  return updateDistributionStatus(
    db,
    id,
    DISTRIBUTION_STATUS.BLOCKED,
    {
      ...options,
      errorMessage: reason,
    }
  );
}

/* =========================
   HOLD DISTRIBUTION
========================= */

export async function holdDistribution(
  db,
  id,
  reason = "Distribution placed on hold",
  options = {}
) {
  return updateDistributionStatus(
    db,
    id,
    DISTRIBUTION_STATUS.HOLD,
    {
      ...options,
      errorMessage: reason,
    }
  );
}

/* =========================
   DELETE DISTRIBUTION JOB
========================= */

export async function deleteDistributionJob(
  db,
  id
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!validDistributionId(id)) {
    throw new Error(
      "Valid distribution ID is required"
    );
  }

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    DELETE FROM content_distribution
    WHERE id = $1
    RETURNING *
    `,
    [Number(id)]
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Distribution job not found: ${id}`
    );
  }

  return {
    success: true,
    deleted: result.rows[0],
  };
}

/* =========================
   GET DISTRIBUTION STATS
========================= */

export async function getDistributionStats(
  db,
  {
    articleId = null,
    region = null,
  } = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(db);

  const conditions = [];
  const values = [];

  if (validArticleId(articleId)) {
    values.push(Number(articleId));

    conditions.push(
      `article_id = $${values.length}`
    );
  }

  if (region) {
    values.push(
      normalizeRegion(region)
    );

    conditions.push(
      `region = $${values.length}`
    );
  }

  const where =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const result = await db.query(
    `
    SELECT
      COUNT(*)::INTEGER AS total,

      COUNT(*) FILTER (
        WHERE status = 'pending'
      )::INTEGER AS pending,

      COUNT(*) FILTER (
        WHERE status = 'approved'
      )::INTEGER AS approved,

      COUNT(*) FILTER (
        WHERE status = 'ready'
      )::INTEGER AS ready,

      COUNT(*) FILTER (
        WHERE status = 'scheduled'
      )::INTEGER AS scheduled,

      COUNT(*) FILTER (
        WHERE status = 'published'
      )::INTEGER AS published,

      COUNT(*) FILTER (
        WHERE status = 'failed'
      )::INTEGER AS failed,

      COUNT(*) FILTER (
        WHERE status = 'blocked'
      )::INTEGER AS blocked,

      COUNT(*) FILTER (
        WHERE status = 'hold'
      )::INTEGER AS hold

    FROM content_distribution
    ${where}
    `,
    values
  );

  const platformResult =
    await db.query(
      `
      SELECT
        platform,
        COUNT(*)::INTEGER AS count
      FROM content_distribution
      ${where}
      GROUP BY platform
      ORDER BY platform ASC
      `,
      values
    );

  const regionResult =
    await db.query(
      `
      SELECT
        region,
        COUNT(*)::INTEGER AS count
      FROM content_distribution
      ${where}
      GROUP BY region
      ORDER BY region ASC
      `,
      values
    );

  return {
    success: true,
    filters: {
      articleId: validArticleId(articleId)
        ? Number(articleId)
        : null,
      region: region
        ? normalizeRegion(region)
        : null,
    },
    stats:
      result.rows[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        ready: 0,
        scheduled: 0,
        published: 0,
        failed: 0,
        blocked: 0,
        hold: 0,
      },
    byPlatform:
      platformResult.rows,
    byRegion:
      regionResult.rows,
  };
}

/* =========================
   GET SCHEDULED DISTRIBUTION
========================= */

export async function getScheduledDistribution(
  db,
  {
    platform = null,
    region = null,
    limit = 100,
  } = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(db);

  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 100,
      1
    ),
    500
  );

  const conditions = [
    `status = 'scheduled'`,
    `scheduled_at IS NOT NULL`,
  ];

  const values = [];

  const normalizedPlatform =
    safePlatform(platform);

  if (normalizedPlatform) {
    values.push(normalizedPlatform);

    conditions.push(
      `platform = $${values.length}`
    );
  }

  if (region) {
    values.push(
      normalizeRegion(region)
    );

    conditions.push(
      `region = $${values.length}`
    );
  }

  values.push(safeLimit);

  const result = await db.query(
    `
    SELECT *
    FROM content_distribution
    WHERE ${conditions.join(" AND ")}
    ORDER BY scheduled_at ASC
    LIMIT $${values.length}
    `,
    values
  );

  return {
    success: true,
    count: result.rows.length,
    items: result.rows,
  };
}

/* =========================
   GET DUE DISTRIBUTION
========================= */

export async function getDueDistribution(
  db,
  {
    platform = null,
    region = null,
    limit = 100,
  } = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(db);

  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 100,
      1
    ),
    500
  );

  const conditions = [
    `status = 'scheduled'`,
    `scheduled_at IS NOT NULL`,
    `scheduled_at <= CURRENT_TIMESTAMP`,
  ];

  const values = [];

  const normalizedPlatform =
    safePlatform(platform);

  if (normalizedPlatform) {
    values.push(normalizedPlatform);

    conditions.push(
      `platform = $${values.length}`
    );
  }

  if (region) {
    values.push(
      normalizeRegion(region)
    );

    conditions.push(
      `region = $${values.length}`
    );
  }

  values.push(safeLimit);

  const result = await db.query(
    `
    SELECT *
    FROM content_distribution
    WHERE ${conditions.join(" AND ")}
    ORDER BY scheduled_at ASC
    LIMIT $${values.length}
    `,
    values
  );

  return {
    success: true,
    count: result.rows.length,
    items: result.rows,
  };
}

/* =========================
   RETRY FAILED JOB
========================= */

export async function retryDistributionJob(
  db,
  id
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!validDistributionId(id)) {
    throw new Error(
      "Valid distribution ID is required"
    );
  }

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      status = 'pending',
      error = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [Number(id)]
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Distribution job not found: ${id}`
    );
  }

  return {
    success: true,
    retried: true,
    item: result.rows[0],
  };
}

/* =========================
   DISTRIBUTION ENGINE STATUS
========================= */

export async function getContentDistributionEngineStatus(
  db
) {
  if (!db) {
    return {
      success: false,
      engine: "contentDistributionEngine",
      databaseRequired: true,
      databaseConnected: false,
    };
  }

  try {
    await ensureContentDistributionTable(db);

    const result = await db.query(`
      SELECT
        COUNT(*)::INTEGER AS total_jobs,

        COUNT(*) FILTER (
          WHERE status = 'scheduled'
        )::INTEGER AS scheduled_jobs,

        COUNT(*) FILTER (
          WHERE status = 'published'
        )::INTEGER AS published_jobs,

        COUNT(*) FILTER (
          WHERE status = 'failed'
        )::INTEGER AS failed_jobs,

        COUNT(*) FILTER (
          WHERE status = 'blocked'
        )::INTEGER AS blocked_jobs,

        COUNT(*) FILTER (
          WHERE status = 'hold'
        )::INTEGER AS hold_jobs

      FROM content_distribution
    `);

    return {
      success: true,
      engine: "contentDistributionEngine",
      databaseConnected: true,
      multiPlatform: true,
      regionalDistribution: true,
      duplicateProtection: true,
      legalProtection: true,
      copyrightProtection: true,
      takedownProtection: true,
      schedulingSupport: true,
      retrySupport: true,
      externalPublishing: false,
      stats:
        result.rows[0] || {
          total_jobs: 0,
          scheduled_jobs: 0,
          published_jobs: 0,
          failed_jobs: 0,
          blocked_jobs: 0,
          hold_jobs: 0,
        },
      supportedPlatforms:
        Object.values(PLATFORMS),
      supportedStatuses:
        Object.values(DISTRIBUTION_STATUS),
    };
  } catch (error) {
    return {
      success: false,
      engine: "contentDistributionEngine",
      databaseConnected: false,
      error:
        error?.message ||
        "Unable to read distribution engine status",
    };
  }
}

/* =========================
   EXPORTS
========================= */

export {
  PLATFORMS,
  DISTRIBUTION_STATUS,
  DEFAULT_PLATFORMS,
  evaluateDistributionSafety,
  normalizeQueueItem,
  normalizeRegion,
  normalizeRiskLevel,
  safePlatform,
};