const DEFAULT_STATUS =
  "draft";

const VALID_STATUSES = [
  "draft",
  "ready",
  "ceo_approval",
  "held",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
];


function normalizeText(
  value,
  maxLength = 5000
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}


function normalizeStatus(
  status
) {
  const value =
    String(
      status ||
        DEFAULT_STATUS
    )
      .trim()
      .toLowerCase();

  if (
    VALID_STATUSES.includes(
      value
    )
  ) {
    return value;
  }

  return DEFAULT_STATUS;
}


function normalizePlatform(
  platform
) {
  return normalizeText(
    platform,
    50
  ).toLowerCase();
}


async function ensureSocialDistributionTable(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS social_distribution_queue (
      id SERIAL PRIMARY KEY,

      article_id INTEGER,

      platform TEXT NOT NULL,

      region TEXT DEFAULT 'Worldwide',

      status TEXT DEFAULT 'draft',

      title TEXT,

      caption TEXT,

      description TEXT,

      hook TEXT,

      closing TEXT,

      call_to_action TEXT,

      thumbnail_text TEXT,

      pinned_comment TEXT,

      hashtags JSONB DEFAULT '[]'::jsonb,

      safety_result JSONB DEFAULT '{}'::jsonb,

      publishing_result JSONB DEFAULT '{}'::jsonb,

      provider_name TEXT,

      provider_post_id TEXT,

      scheduled_at TIMESTAMP,

      published_at TIMESTAMP,

      error_message TEXT,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT fk_social_article
        FOREIGN KEY (article_id)
        REFERENCES articles(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_social_distribution_status
      ON social_distribution_queue(status);

    CREATE INDEX IF NOT EXISTS
      idx_social_distribution_platform
      ON social_distribution_queue(platform);

    CREATE INDEX IF NOT EXISTS
      idx_social_distribution_article
      ON social_distribution_queue(article_id);

    CREATE INDEX IF NOT EXISTS
      idx_social_distribution_scheduled
      ON social_distribution_queue(scheduled_at);

    CREATE INDEX IF NOT EXISTS
      idx_social_distribution_created
      ON social_distribution_queue(created_at DESC);
  `);

  return true;
}


export async function saveSocialDistributionPackage(
  db,
  {
    articleId = null,
    platform,
    region = "Worldwide",
    status = DEFAULT_STATUS,
    content = {},
    safety = {},
    publishing = {},
    providerName = null,
    providerPostId = null,
    scheduledAt = null,
    errorMessage = null,
  } = {}
) {
  await ensureSocialDistributionTable(
    db
  );

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  if (
    !normalizedPlatform
  ) {
    throw new Error(
      "Platform is required"
    );
  }

  const normalizedStatus =
    normalizeStatus(
      status
    );

  const result =
    await db.query(
      `
      INSERT INTO social_distribution_queue (
        article_id,
        platform,
        region,
        status,
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
        provider_name,
        provider_post_id,
        scheduled_at,
        error_message
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
        $13::jsonb,
        $14::jsonb,
        $15::jsonb,
        $16,
        $17,
        $18,
        $19
      )
      RETURNING *
      `,
      [
        articleId,

        normalizedPlatform,

        normalizeText(
          region,
          200
        ) || "Worldwide",

        normalizedStatus,

        normalizeText(
          content.title,
          1000
        ),

        normalizeText(
          content.caption,
          10000
        ),

        normalizeText(
          content.description,
          10000
        ),

        normalizeText(
          content.hook,
          1000
        ),

        normalizeText(
          content.closing,
          1000
        ),

        normalizeText(
          content.callToAction,
          500
        ),

        normalizeText(
          content.thumbnailText,
          300
        ),

        normalizeText(
          content.pinnedComment,
          1000
        ),

        JSON.stringify(
          Array.isArray(
            content.hashtags
          )
            ? content.hashtags
            : []
        ),

        JSON.stringify(
          safety || {}
        ),

        JSON.stringify(
          publishing || {}
        ),

        providerName,

        providerPostId,

        scheduledAt,

        errorMessage,
      ]
    );

  return result.rows[0];
}


export async function saveDistributionBatch(
  db,
  {
    articleId = null,
    region = "Worldwide",
    packages = [],
  } = {}
) {
  if (
    !Array.isArray(
      packages
    )
  ) {
    throw new Error(
      "Packages must be an array"
    );
  }

  const saved = [];

  for (
    const item of packages
  ) {
    try {
      const row =
        await saveSocialDistributionPackage(
          db,
          {
            articleId,

            platform:
              item.platform,

            region,

            status:
              item.status ||
              DEFAULT_STATUS,

            content:
              item.content ||
              {},

            safety:
              item.safety ||
              {},

            publishing:
              item.publishing ||
              {},
          }
        );

      saved.push({
        success: true,
        row,
      });

    } catch (error) {
      saved.push({
        success: false,

        platform:
          item.platform ||
          null,

        error:
          error.message,
      });
    }
  }

  return {
    success: true,

    total:
      packages.length,

    saved:
      saved.filter(
        (item) =>
          item.success
      ).length,

    failed:
      saved.filter(
        (item) =>
          !item.success
      ).length,

    items:
      saved,
  };
}


export async function getSocialDistributionQueue(
  db,
  {
    status,
    platform,
    articleId,
    limit = 50,
  } = {}
) {
  await ensureSocialDistributionTable(
    db
  );

  const values = [];
  const conditions = [];

  if (status) {
    values.push(
      normalizeStatus(
        status
      )
    );

    conditions.push(
      `status = $${values.length}`
    );
  }

  if (platform) {
    values.push(
      normalizePlatform(
        platform
      )
    );

    conditions.push(
      `platform = $${values.length}`
    );
  }

  if (
    articleId !==
      undefined &&
    articleId !==
      null &&
    String(
      articleId
    ).trim()
  ) {
    const numericArticleId =
      Number(
        articleId
      );

    if (
      Number.isInteger(
        numericArticleId
      )
    ) {
      values.push(
        numericArticleId
      );

      conditions.push(
        `article_id = $${values.length}`
      );
    }
  }

  const safeLimit =
    Math.min(
      200,
      Math.max(
        1,
        Number(limit) ||
          50
      )
    );

  const where =
    conditions.length
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  const result =
    await db.query(
      `
      SELECT *
      FROM social_distribution_queue
      ${where}
      ORDER BY
        COALESCE(
          scheduled_at,
          created_at
        ) ASC,
        id DESC
      LIMIT ${safeLimit}
      `,
      values
    );

  return result.rows;
}


export async function getSocialDistributionItem(
  db,
  id
) {
  await ensureSocialDistributionTable(
    db
  );

  const numericId =
    Number(id);

  if (
    !Number.isInteger(
      numericId
    )
  ) {
    throw new Error(
      "Valid distribution ID is required"
    );
  }

  const result =
    await db.query(
      `
      SELECT *
      FROM social_distribution_queue
      WHERE id = $1
      LIMIT 1
      `,
      [
        numericId,
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}


export async function updateSocialDistributionStatus(
  db,
  id,
  status,
  {
    providerName,
    providerPostId,
    scheduledAt,
    errorMessage,
    publishingResult,
  } = {}
) {
  await ensureSocialDistributionTable(
    db
  );

  const numericId =
    Number(id);

  if (
    !Number.isInteger(
      numericId
    )
  ) {
    throw new Error(
      "Valid distribution ID is required"
    );
  }

  const normalizedStatus =
    normalizeStatus(
      status
    );

  const result =
    await db.query(
      `
      UPDATE social_distribution_queue

      SET
        status = $2,

        provider_name =
          COALESCE(
            $3,
            provider_name
          ),

        provider_post_id =
          COALESCE(
            $4,
            provider_post_id
          ),

        scheduled_at =
          COALESCE(
            $5,
            scheduled_at
          ),

        published_at =
          CASE
            WHEN $2 = 'published'
              THEN CURRENT_TIMESTAMP
            ELSE published_at
          END,

        error_message =
          COALESCE(
            $6,
            error_message
          ),

        publishing_result =
          CASE
            WHEN $7::jsonb = '{}'::jsonb
              THEN publishing_result
            ELSE $7::jsonb
          END,

        updated_at =
          CURRENT_TIMESTAMP

      WHERE id = $1

      RETURNING *
      `,
      [
        numericId,

        normalizedStatus,

        providerName ||
          null,

        providerPostId ||
          null,

        scheduledAt ||
          null,

        errorMessage ||
          null,

        JSON.stringify(
          publishingResult ||
            {}
        ),
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}


export async function cancelSocialDistribution(
  db,
  id,
  reason = "Cancelled by CEO"
) {
  return updateSocialDistributionStatus(
    db,
    id,
    "cancelled",
    {
      errorMessage:
        normalizeText(
          reason,
          1000
        ),
    }
  );
}


export async function getScheduledSocialPosts(
  db,
  {
    beforeMinutes = 5,
    limit = 50,
  } = {}
) {
  await ensureSocialDistributionTable(
    db
  );

  const safeMinutes =
    Math.max(
      0,
      Number(
        beforeMinutes
      ) || 5
    );

  const safeLimit =
    Math.min(
      200,
      Math.max(
        1,
        Number(limit) ||
          50
      )
    );

  const result =
    await db.query(
      `
      SELECT *
      FROM social_distribution_queue

      WHERE status = 'scheduled'

      AND scheduled_at IS NOT NULL

      AND scheduled_at <=
        CURRENT_TIMESTAMP
        +
        ($1 * INTERVAL '1 minute')

      ORDER BY
        scheduled_at ASC

      LIMIT ${safeLimit}
      `,
      [
        safeMinutes,
      ]
    );

  return result.rows;
}


export async function getSocialDistributionStats(
  db
) {
  await ensureSocialDistributionTable(
    db
  );

  const result =
    await db.query(
      `
      SELECT
        COUNT(*)::INTEGER AS total,

        COUNT(*) FILTER (
          WHERE status = 'draft'
        )::INTEGER AS draft,

        COUNT(*) FILTER (
          WHERE status = 'ready'
        )::INTEGER AS ready,

        COUNT(*) FILTER (
          WHERE status = 'ceo_approval'
        )::INTEGER AS ceo_approval,

        COUNT(*) FILTER (
          WHERE status = 'held'
        )::INTEGER AS held,

        COUNT(*) FILTER (
          WHERE status = 'scheduled'
        )::INTEGER AS scheduled,

        COUNT(*) FILTER (
          WHERE status = 'publishing'
        )::INTEGER AS publishing,

        COUNT(*) FILTER (
          WHERE status = 'published'
        )::INTEGER AS published,

        COUNT(*) FILTER (
          WHERE status = 'failed'
        )::INTEGER AS failed,

        COUNT(*) FILTER (
          WHERE status = 'cancelled'
        )::INTEGER AS cancelled

      FROM social_distribution_queue
      `
    );

  const platformResult =
    await db.query(
      `
      SELECT
        platform,
        COUNT(*)::INTEGER AS total

      FROM social_distribution_queue

      GROUP BY platform

      ORDER BY total DESC
      `
    );

  return {
    ...(result.rows[0] || {}),

    platforms:
      platformResult.rows,
  };
}


export async function cleanupOldSocialDistribution(
  db,
  days = 90
) {
  await ensureSocialDistributionTable(
    db
  );

  const safeDays =
    Math.max(
      1,
      Number(days) ||
        90
    );

  const result =
    await db.query(
      `
      DELETE FROM
        social_distribution_queue

      WHERE created_at <
        CURRENT_TIMESTAMP
        -
        ($1 * INTERVAL '1 day')

      AND status IN (
        'published',
        'cancelled'
      )

      RETURNING id
      `,
      [
        safeDays,
      ]
    );

  return {
    deleted:
      result.rowCount,
  };
}


export function getSocialDistributionStatuses() {
  return [
    ...VALID_STATUSES,
  ];
}
