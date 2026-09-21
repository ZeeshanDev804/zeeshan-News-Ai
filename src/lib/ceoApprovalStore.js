const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "held",
];

const DEFAULT_STATUS = "pending";
const DEFAULT_PLATFORM = "website";
const DEFAULT_REGION = "worldwide";
const DEFAULT_DECISION = "ceo_approval";
const DEFAULT_RISK_LEVEL = "medium";

function safeText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function safePlatform(value) {
  const platform = safeText(
    value,
    DEFAULT_PLATFORM
  ).toLowerCase();

  return platform || DEFAULT_PLATFORM;
}

function safeRegion(value) {
  const region = safeText(
    value,
    DEFAULT_REGION
  ).toLowerCase();

  return region || DEFAULT_REGION;
}

function safeDecision(value) {
  return (
    safeText(
      value,
      DEFAULT_DECISION
    ) || DEFAULT_DECISION
  );
}

function safeRiskLevel(value) {
  const risk = safeText(
    value,
    DEFAULT_RISK_LEVEL
  ).toLowerCase();

  if (
    risk === "low" ||
    risk === "medium" ||
    risk === "high"
  ) {
    return risk;
  }

  return DEFAULT_RISK_LEVEL;
}

function safeStatus(value) {
  const status = safeText(
    value,
    DEFAULT_STATUS
  ).toLowerCase();

  return APPROVAL_STATUSES.includes(
    status
  )
    ? status
    : DEFAULT_STATUS;
}

function safeJSON(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return {};
  }

  if (
    typeof value === "object"
  ) {
    return value;
  }

  try {
    return JSON.parse(
      String(value)
    );
  } catch {
    return {};
  }
}

function safeLimit(value, fallback = 50) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return Math.min(
    Math.floor(number),
    200
  );
}

function normalizeArticleId(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (
    Number.isInteger(number) &&
    number > 0
  ) {
    return number;
  }

  return null;
}

export async function ensureCEOApprovalTable(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS ceo_approval_queue (
      id SERIAL PRIMARY KEY,
      article_id INTEGER,
      platform TEXT NOT NULL DEFAULT 'website',
      region TEXT NOT NULL DEFAULT 'worldwide',
      title TEXT,
      content TEXT,
      decision TEXT DEFAULT 'ceo_approval',
      risk_level TEXT DEFAULT 'medium',
      safety_result JSONB DEFAULT '{}'::jsonb,
      schedule_data JSONB DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TIMESTAMP,
      rejected_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  /*
   * Compatibility migrations for
   * older versions of the table.
   */
  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS article_id INTEGER
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS platform TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS region TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS title TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS content TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS decision TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS risk_level TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS safety_result JSONB
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS schedule_data JSONB
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS status TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS approved_by TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
  `);

  await db.query(`
    ALTER TABLE ceo_approval_queue
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
  `);

  /*
   * Fill safe defaults for rows created
   * by older versions.
   */
  await db.query(`
    UPDATE ceo_approval_queue
    SET platform = 'website'
    WHERE platform IS NULL
  `);

  await db.query(`
    UPDATE ceo_approval_queue
    SET region = 'worldwide'
    WHERE region IS NULL
  `);

  await db.query(`
    UPDATE ceo_approval_queue
    SET decision = 'ceo_approval'
    WHERE decision IS NULL
  `);

  await db.query(`
    UPDATE ceo_approval_queue
    SET risk_level = 'medium'
    WHERE risk_level IS NULL
  `);

  await db.query(`
    UPDATE ceo_approval_queue
    SET status = 'pending'
    WHERE status IS NULL
  `);

  await db.query(`
    UPDATE ceo_approval_queue
    SET safety_result = '{}'::jsonb
    WHERE safety_result IS NULL
  `);

  await db.query(`
    UPDATE ceo_approval_queue
    SET schedule_data = '{}'::jsonb
    WHERE schedule_data IS NULL
  `);

  await db.query(`
    UPDATE ceo_approval_queue
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL
  `);

  await db.query(`
    UPDATE ceo_approval_queue
    SET updated_at = CURRENT_TIMESTAMP
    WHERE updated_at IS NULL
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_ceo_approval_status
    ON ceo_approval_queue(status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_ceo_approval_created
    ON ceo_approval_queue(created_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_ceo_approval_article
    ON ceo_approval_queue(article_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_ceo_approval_platform_region
    ON ceo_approval_queue(platform, region)
  `);
}

export async function createCEOApproval(
  db,
  data = {}
) {
  await ensureCEOApprovalTable(db);

  const articleId =
    normalizeArticleId(
      data.articleId ??
        data.article_id
    );

  const platform =
    safePlatform(
      data.platform
    );

  const region =
    safeRegion(
      data.region
    );

  const title =
    safeText(
      data.title
    );

  const content =
    safeText(
      data.content ||
        data.caption
    );

  const decision =
    safeDecision(
      data.decision
    );

  const riskLevel =
    safeRiskLevel(
      data.riskLevel ||
        data.risk_level
    );

  /*
   * Prevent duplicate pending
   * approvals for the same
   * article/platform/region.
   */
  if (articleId !== null) {
    const duplicate =
      await db.query(
        `
        SELECT *
        FROM ceo_approval_queue
        WHERE article_id = $1
          AND platform = $2
          AND region = $3
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [
          articleId,
          platform,
          region,
        ]
      );

    if (
      duplicate.rows.length > 0
    ) {
      return duplicate.rows[0];
    }
  }

  const result =
    await db.query(
      `
      INSERT INTO ceo_approval_queue (
        article_id,
        platform,
        region,
        title,
        content,
        decision,
        risk_level,
        safety_result,
        schedule_data,
        status
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
        'pending'
      )
      RETURNING *
      `,
      [
        articleId,
        platform,
        region,
        title,
        content,
        decision,
        riskLevel,
        JSON.stringify(
          safeJSON(
            data.safetyResult ||
              data.safety_result
          )
        ),
        JSON.stringify(
          safeJSON(
            data.scheduleData ||
              data.schedule_data
          )
        ),
      ]
    );

  return result.rows[0];
}

export async function createCEOApprovalBatch(
  db,
  items = []
) {
  await ensureCEOApprovalTable(db);

  if (!Array.isArray(items)) {
    throw new Error(
      "items must be an array"
    );
  }

  const created = [];

  for (const item of items) {
    const approval =
      await createCEOApproval(
        db,
        item
      );

    if (approval) {
      created.push(approval);
    }
  }

  return created;
}

export async function getCEOApprovalQueue(
  db,
  options = {}
) {
  await ensureCEOApprovalTable(db);

  const status =
    safeStatus(
      options.status
    );

  const limit =
    safeLimit(
      options.limit
    );

  const result =
    await db.query(
      `
      SELECT *
      FROM ceo_approval_queue
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [
        status,
        limit,
      ]
    );

  return result.rows;
}

export async function getCEOApprovalById(
  db,
  id
) {
  await ensureCEOApprovalTable(db);

  const approvalId =
    Number(id);

  if (
    !Number.isInteger(
      approvalId
    ) ||
    approvalId <= 0
  ) {
    return null;
  }

  const result =
    await db.query(
      `
      SELECT *
      FROM ceo_approval_queue
      WHERE id = $1
      LIMIT 1
      `,
      [approvalId]
    );

  return (
    result.rows[0] ||
    null
  );
}

export async function approveCEOItem(
  db,
  id,
  approvedBy = "CEO"
) {
  await ensureCEOApprovalTable(db);

  const approvalId =
    Number(id);

  if (
    !Number.isInteger(
      approvalId
    ) ||
    approvalId <= 0
  ) {
    return null;
  }

  const result =
    await db.query(
      `
      UPDATE ceo_approval_queue
      SET
        status = 'approved',
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status = 'pending'
      RETURNING *
      `,
      [
        approvalId,
        safeText(
          approvedBy,
          "CEO"
        ) || "CEO",
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

export async function rejectCEOItem(
  db,
  id,
  reason = "Rejected by CEO"
) {
  await ensureCEOApprovalTable(db);

  const approvalId =
    Number(id);

  if (
    !Number.isInteger(
      approvalId
    ) ||
    approvalId <= 0
  ) {
    return null;
  }

  const result =
    await db.query(
      `
      UPDATE ceo_approval_queue
      SET
        status = 'rejected',
        rejected_reason = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status = 'pending'
      RETURNING *
      `,
      [
        approvalId,
        safeText(
          reason,
          "Rejected by CEO"
        ) || "Rejected by CEO",
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

export async function holdCEOItem(
  db,
  id,
  reason = "Held for review"
) {
  await ensureCEOApprovalTable(db);

  const approvalId =
    Number(id);

  if (
    !Number.isInteger(
      approvalId
    ) ||
    approvalId <= 0
  ) {
    return null;
  }

  const result =
    await db.query(
      `
      UPDATE ceo_approval_queue
      SET
        status = 'held',
        rejected_reason = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status = 'pending'
      RETURNING *
      `,
      [
        approvalId,
        safeText(
          reason,
          "Held for review"
        ) || "Held for review",
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

export async function getCEOApprovalStats(
  db
) {
  await ensureCEOApprovalTable(db);

  const result =
    await db.query(`
      SELECT
        COUNT(*)::INTEGER AS total,

        COUNT(*) FILTER (
          WHERE status = 'pending'
        )::INTEGER AS pending,

        COUNT(*) FILTER (
          WHERE status = 'approved'
        )::INTEGER AS approved,

        COUNT(*) FILTER (
          WHERE status = 'rejected'
        )::INTEGER AS rejected,

        COUNT(*) FILTER (
          WHERE status = 'held'
        )::INTEGER AS held

      FROM ceo_approval_queue
    `);

  return (
    result.rows[0] || {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      held: 0,
    }
  );
}

export async function getCEOApprovalHistory(
  db,
  options = {}
) {
  await ensureCEOApprovalTable(db);

  const limit =
    safeLimit(
      options.limit,
      100
    );

  const result =
    await db.query(
      `
      SELECT *
      FROM ceo_approval_queue
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

  return result.rows;
}

export function getCEOApprovalStoreStatus() {
  return {
    name:
      "CEO Approval Store",

    status:
      "ready",

    databaseTable:
      "ceo_approval_queue",

    supportedStatuses:
      APPROVAL_STATUSES,

    supports: [
      "pending approvals",
      "CEO approval",
      "CEO rejection",
      "hold",
      "duplicate pending protection",
      "approval history",
      "approval statistics",
      "platform tracking",
      "regional tracking",
      "risk tracking",
      "safety result persistence",
      "schedule data persistence",
    ],

    databaseRequired:
      true,

    duplicatePendingProtection:
      true,

    externalPublishing:
      false,
  };
}

export {
  APPROVAL_STATUSES,
};