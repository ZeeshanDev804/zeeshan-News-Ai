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

function normalizeQueueItem(item = {}) {
  return {
    articleId:
      validArticleId(item.articleId)
        ? Number(item.articleId)
        : null,

    platform:
      safePlatform(item.platform),

    region:
      safeText(item.region || "Worldwide", 100),

    status:
      normalizeStatus(item.status),

    riskLevel:
      normalizeRiskLevel(
        item.riskLevel ||
        item.safetyResult?.riskLevel ||
        item.publicationRisk
      ),

    title:
      safeText(
        item.title ||
        item.headline ||
        "",
        1000
      ),

    caption:
      safeText(
        item.caption ||
        item.content ||
        "",
        10000
      ),

    description:
      safeText(
        item.description || "",
        10000
      ),

    hook:
      safeText(
        item.hook || "",
        1000
      ),

    closing:
      safeText(
        item.closing || "",
        1000
      ),

    callToAction:
      safeText(
        item.callToAction || "",
        1000
      ),

    thumbnailText:
      safeText(
        item.thumbnailText || "",
        500
      ),

    pinnedComment:
      safeText(
        item.pinnedComment || "",
        2000
      ),

    hashtags:
      normalizeHashtags(
        item.hashtags
      ),

    safetyResult:
      item.safetyResult || null,

    publishingResult:
      item.publishingResult ||
      item.scheduleData ||
      null,

    scheduledAt:
      normalizeDate(
        item.scheduledAt ||
        item.publishingResult?.nextPublishAt ||
        item.publishingResult?.scheduledAt ||
        item.scheduleData?.nextPublishAt ||
        item.scheduleData?.scheduledAt
      ),

    providerName:
      safeText(
        item.providerName || "",
        200
      ) || null,

    providerPostId:
      safeText(
        item.providerPostId || "",
        500
      ) || null,

    externalUrl:
      safeText(
        item.externalUrl || "",
        2000
      ) || null,

    publishedAt:
      normalizeDate(
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

  /*
    Compatibility migration for older versions of this table.
  */

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'Worldwide'
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS title TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS caption TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS description TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS hook TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS closing TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS call_to_action TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS thumbnail_text TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS pinned_comment TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS hashtags JSONB NOT NULL DEFAULT '[]'::jsonb
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS safety_result JSONB
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS publishing_result JSONB
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS provider_name TEXT
  `);

  /*
    Old versions used external_id.
    Keep it and also support provider_post_id through the same field.
  */

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS external_url TEXT
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP
  `);

  await db.query(`
    ALTER TABLE content_distribution
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  `);

  /*
    Region is part of the distribution identity.
    One article can therefore be distributed to the same
    platform for different regions.
  */

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    content_distribution_article_platform_region_idx
    ON content_distribution(article_id, platform, region)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    content_distribution_status_idx
    ON content_distribution(status)
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
  if (article.legal_hold === true) {
    return {
      allowed: false,
      status: DISTRIBUTION_STATUS.BLOCKED,
      reason: "Legal hold is active",
    };
  }

  if (article.legal_review_required === true) {
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
    copyrightStatus === "blocked" ||
    copyrightStatus === "takedown" ||
    copyrightStatus === "high_risk" ||
    copyrightStatus === "held"
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
    takedownStatus !== "none" &&
    takedownStatus !== "cleared" &&
    takedownStatus !== "rejected" &&
    takedownStatus !== "resolved"
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
    publicationStatus ===
      "awaiting_ceo_approval" ||
    publicationStatus === "held" ||
    publicationStatus === "pending"
  ) {
    return {
      allowed: false,
      status: DISTRIBUTION_STATUS.HOLD,
      reason:
        "Article requires publication approval",
    };
  }

  /*
    An article with no publication status is not
    automatically published by this store.
  */

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

  if (normalizedPlatforms.length === 0) {
    throw new Error(
      "At least one valid distribution platform is required"
    );
  }

  const safeRegion =
    safeText(
      region || "Worldwide",
      100
    ) || "Worldwide";

  const jobs = [];

  for (const platform of normalizedPlatforms) {
    const status = safety.status;

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
      ON CONFLICT (article_id, platform, region)
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
        status,
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
          "Valid platform is required",
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
      ON CONFLICT (article_id, platform, region)
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
        JSON.stringify(item.safetyResult),
        JSON.stringify(item.publishingResult),
        item.scheduledAt,
        item.providerName,
        item.providerPostId,
        item.externalUrl,
        item.publishedAt,
        item.errorMessage,
      ]
    );

    saved.push(result.rows[0]);
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
      safeText(region, 100)
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

  values.push(safeLimit);

  const where =
    conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const result = await db.query(
    `
    SELECT *
    FROM content_distribution
    ${where}
    ORDER BY created_at DESC
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

  const distributionId =
    Number(id);

  if (
    !Number.isInteger(
      distributionId
    ) ||
    distributionId <= 0
  ) {
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
    [distributionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/* =========================
   MARK READY
========================= */

export async function markDistributionReady(
  db,
  id,
  riskLevel = "low"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const distributionId =
    Number(id);

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      status = $2,
      risk_level = $3,
      error = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      distributionId,
      DISTRIBUTION_STATUS.READY,
      normalizeRiskLevel(
        riskLevel
      ),
    ]
  );

  return result.rows[0] || null;
}

/* =========================
   APPROVE DISTRIBUTION
========================= */

export async function approveDistribution(
  db,
  id
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const distributionId =
    Number(id);

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      status = $2,
      error = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      distributionId,
      DISTRIBUTION_STATUS.APPROVED,
    ]
  );

  return result.rows[0] || null;
}

/* =========================
   HOLD DISTRIBUTION
========================= */

export async function holdDistribution(
  db,
  id,
  reason = "Distribution is on hold"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const distributionId =
    Number(id);

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      status = $2,
      error = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      distributionId,
      DISTRIBUTION_STATUS.HOLD,
      safeText(reason, 5000),
    ]
  );

  return result.rows[0] || null;
}

/* =========================
   BLOCK DISTRIBUTION
========================= */

export async function blockDistribution(
  db,
  id,
  reason = "Distribution blocked"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const distributionId =
    Number(id);

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      status = $2,
      error = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      distributionId,
      DISTRIBUTION_STATUS.BLOCKED,
      safeText(reason, 5000),
    ]
  );

  return result.rows[0] || null;
}

/* =========================
   RECORD ATTEMPT
========================= */

export async function recordDistributionAttempt(
  db,
  id
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const distributionId =
    Number(id);

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      attempts = attempts + 1,
      last_attempt_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [distributionId]
  );

  return result.rows[0] || null;
}

/* =========================
   MARK PUBLISHED
========================= */

export async function markDistributionPublished(
  db,
  id,
  {
    providerName = null,
    externalId = null,
    externalUrl = null,
  } = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const distributionId =
    Number(id);

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      status = $2,
      provider_name = $3,
      external_id = $4,
      external_url = $5,
      published_at = CURRENT_TIMESTAMP,
      error = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      distributionId,
      DISTRIBUTION_STATUS.PUBLISHED,
      safeText(
        providerName,
        200
      ) || null,
      safeText(
        externalId,
        500
      ) || null,
      safeText(
        externalUrl,
        2000
      ) || null,
    ]
  );

  return result.rows[0] || null;
}

/* =========================
   MARK FAILED
========================= */

export async function markDistributionFailed(
  db,
  id,
  error = "Distribution failed"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const distributionId =
    Number(id);

  await ensureContentDistributionTable(db);

  const result = await db.query(
    `
    UPDATE content_distribution
    SET
      status = $2,
      error = $3,
      attempts = attempts + 1,
      last_attempt_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      distributionId,
      DISTRIBUTION_STATUS.FAILED,
      safeText(error, 5000),
    ]
  );

  return result.rows[0] || null;
}

/* =========================
   GET READY QUEUE
========================= */

export async function getReadyDistributionQueue(
  db,
  limit = 100
) {
  return getDistribution(db, {
    status:
      DISTRIBUTION_STATUS.READY,
    limit,
  });
}

/* =========================
   GET SCHEDULED QUEUE
========================= */

export async function getScheduledDistributionQueue(
  db,
  limit = 100
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

  const result = await db.query(
    `
    SELECT *
    FROM content_distribution
    WHERE status = $1
      AND scheduled_at IS NOT NULL
    ORDER BY scheduled_at ASC
    LIMIT $2
    `,
    [
      DISTRIBUTION_STATUS.SCHEDULED,
      safeLimit,
    ]
  );

  return {
    success: true,
    count: result.rows.length,
    items: result.rows,
  };
}

/* =========================
   GET FAILED QUEUE
========================= */

export async function getFailedDistributionQueue(
  db,
  limit = 100
) {
  return getDistribution(db, {
    status:
      DISTRIBUTION_STATUS.FAILED,
    limit,
  });
}

/* =========================
   SUMMARY
========================= */

export async function getDistributionSummary(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(db);

  const result = await db.query(`
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
  `);

  return {
    success: true,
    summary:
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
  };
}

/* =========================
   PLATFORM SUMMARY
========================= */

export async function getDistributionPlatformSummary(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(db);

  const result = await db.query(`
    SELECT
      platform,
      COUNT(*)::INTEGER AS total,
      COUNT(*) FILTER (
        WHERE status = 'published'
      )::INTEGER AS published,
      COUNT(*) FILTER (
        WHERE status = 'scheduled'
      )::INTEGER AS scheduled,
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
    GROUP BY platform
    ORDER BY platform ASC
  `);

  return {
    success: true,
    platforms: result.rows,
  };
}

/* =========================
   REGION SUMMARY
========================= */

export async function getDistributionRegionSummary(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureContentDistributionTable(db);

  const result = await db.query(`
    SELECT
      region,
      COUNT(*)::INTEGER AS total,
      COUNT(*) FILTER (
        WHERE status = 'published'
      )::INTEGER AS published,
      COUNT(*) FILTER (
        WHERE status = 'scheduled'
      )::INTEGER AS scheduled,
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
    GROUP BY region
    ORDER BY region ASC
  `);

  return {
    success: true,
    regions: result.rows,
  };
}

/* =========================
   STATUS
========================= */

export function getDistributionStoreStatus() {
  return {
    success: true,

    store:
      "ZEESHAN NEWS AI Social Distribution Store",

    status: "ready",

    databasePersistence: true,

    regionalDistribution: true,

    supportedPlatforms: [
      ...DEFAULT_PLATFORMS,
    ],

    supportedStatuses: [
      ...Object.values(
        DISTRIBUTION_STATUS
      ),
    ],

    duplicateProtection: true,

    safetyAware: true,

    copyrightAware: true,

    takedownAware: true,

    retryTracking: true,

    actualPublishing:
      false,

    externalProviders:
      "not_connected",
  };
}

/* =========================
   EXPORT CONSTANTS
========================= */

export {
  PLATFORMS,
  DISTRIBUTION_STATUS,
  DEFAULT_PLATFORMS,
};