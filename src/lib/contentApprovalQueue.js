const APPROVAL_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  HOLD: "hold",
};

const APPROVAL_TYPES = {
  CONTENT: "content",
};

function safeText(value, maxLength = 2000) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({});
  }
}

function normalizeStatus(value) {
  const status = safeText(
    value,
    50
  ).toLowerCase();

  return Object.values(
    APPROVAL_STATUSES
  ).includes(status)
    ? status
    : null;
}

function validateArticleId(articleId) {
  const id = Number(articleId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      "Valid article ID is required"
    );
  }

  return id;
}

function validateDb(db) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }
}

/* =========================
   ENSURE APPROVAL QUEUE
========================= */

export async function ensureContentApprovalQueueTable(
  db
) {
  validateDb(db);

  await db.query(`
    CREATE TABLE IF NOT EXISTS content_approval_queue (
      id BIGSERIAL PRIMARY KEY,

      article_id BIGINT NOT NULL,

      approval_type TEXT NOT NULL DEFAULT 'content',

      status TEXT NOT NULL DEFAULT 'pending',

      risk_level TEXT NOT NULL DEFAULT 'medium',

      risk_score INTEGER NOT NULL DEFAULT 0,

      risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

      requested_by TEXT NOT NULL DEFAULT 'system',

      reviewed_by TEXT,

      review_notes TEXT,

      requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      reviewed_at TIMESTAMP,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_content_approval_queue_status
    ON content_approval_queue(status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_content_approval_queue_article
    ON content_approval_queue(article_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_content_approval_queue_requested
    ON content_approval_queue(requested_at DESC)
  `);

  return {
    success: true,
  };
}

/* =========================
   CHECK ARTICLE
========================= */

async function getArticle(
  db,
  articleId
) {
  const id =
    validateArticleId(
      articleId
    );

  const result =
    await db.query(
      `
      SELECT
        id,
        title,
        link,
        description,
        content,
        source,
        ai_category,
        ai_summary,
        copyright_status,
        copyright_risk,
        legal_hold,
        legal_review_required,
        takedown_status
      FROM articles
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

  return (
    result.rows[0] ||
    null
  );
}

/* =========================
   CREATE APPROVAL REQUEST
========================= */

export async function createContentApprovalRequest(
  db,
  articleId,
  risk = {}
) {
  validateDb(db);

  const id =
    validateArticleId(
      articleId
    );

  await ensureContentApprovalQueueTable(
    db
  );

  const article =
    await getArticle(
      db,
      id
    );

  if (!article) {
    throw new Error(
      `Article not found: ${id}`
    );
  }

  if (article.legal_hold === true) {
    throw new Error(
      "Article is under legal hold and cannot enter normal approval flow"
    );
  }

  if (
    article.takedown_status &&
    article.takedown_status !== "none" &&
    article.takedown_status !== "cleared" &&
    article.takedown_status !== "rejected"
  ) {
    throw new Error(
      "Article has an active takedown issue"
    );
  }

  const riskLevel =
    safeText(
      risk.risk,
      50
    ).toLowerCase() ||
    "medium";

  const riskScore =
    Math.min(
      Math.max(
        Number(risk.score) || 0,
        0
      ),
      100
    );

  const reasons =
    Array.isArray(
      risk.reasons
    )
      ? risk.reasons
          .map((reason) =>
            safeText(
              reason,
              500
            )
          )
          .filter(Boolean)
          .slice(0, 20)
      : [];

  const existing =
    await db.query(
      `
      SELECT *
      FROM content_approval_queue
      WHERE
        article_id = $1
      AND
        approval_type = 'content'
      AND
        status = 'pending'
      ORDER BY requested_at DESC
      LIMIT 1
      `,
      [id]
    );

  if (existing.rows.length > 0) {
    return {
      success: true,
      created: false,
      existing: true,
      request: existing.rows[0],
    };
  }

  const result =
    await db.query(
      `
      INSERT INTO content_approval_queue (
        article_id,
        approval_type,
        status,
        risk_level,
        risk_score,
        risk_reasons,
        requested_by,
        requested_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        'content',
        'pending',
        $2,
        $3,
        $4::jsonb,
        'system',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *
      `,
      [
        id,
        riskLevel,
        riskScore,
        safeJson(reasons),
      ]
    );

  return {
    success: true,
    created: true,
    existing: false,
    request:
      result.rows[0],
  };
}

/* =========================
   APPROVE CONTENT
========================= */

export async function approveContent(
  db,
  requestId,
  reviewer = "CEO",
  notes = ""
) {
  validateDb(db);

  const id =
    validateArticleId(
      requestId
    );

  await ensureContentApprovalQueueTable(
    db
  );

  const reviewerName =
    safeText(
      reviewer,
      200
    ) || "CEO";

  const reviewNotes =
    safeText(
      notes,
      2000
    );

  const result =
    await db.query(
      `
      UPDATE content_approval_queue
      SET
        status = 'approved',

        reviewed_by = $1,

        review_notes = $2,

        reviewed_at = CURRENT_TIMESTAMP,

        updated_at = CURRENT_TIMESTAMP

      WHERE
        id = $3
      AND
        status = 'pending'

      RETURNING *
      `,
      [
        reviewerName,
        reviewNotes,
        id,
      ]
    );

  if (result.rows.length === 0) {
    throw new Error(
      "Approval request not found or is no longer pending"
    );
  }

  return {
    success: true,
    status:
      APPROVAL_STATUSES.APPROVED,
    request:
      result.rows[0],
  };
}

/* =========================
   REJECT CONTENT
========================= */

export async function rejectContent(
  db,
  requestId,
  reviewer = "CEO",
  notes = ""
) {
  validateDb(db);

  const id =
    validateArticleId(
      requestId
    );

  await ensureContentApprovalQueueTable(
    db
  );

  const reviewerName =
    safeText(
      reviewer,
      200
    ) || "CEO";

  const reviewNotes =
    safeText(
      notes,
      2000
    ) || "Content rejected";

  const result =
    await db.query(
      `
      UPDATE content_approval_queue
      SET
        status = 'rejected',

        reviewed_by = $1,

        review_notes = $2,

        reviewed_at = CURRENT_TIMESTAMP,

        updated_at = CURRENT_TIMESTAMP

      WHERE
        id = $3
      AND
        status = 'pending'

      RETURNING *
      `,
      [
        reviewerName,
        reviewNotes,
        id,
      ]
    );

  if (result.rows.length === 0) {
    throw new Error(
      "Approval request not found or is no longer pending"
    );
  }

  return {
    success: true,
    status:
      APPROVAL_STATUSES.REJECTED,
    request:
      result.rows[0],
  };
}

/* =========================
   HOLD CONTENT
========================= */

export async function holdContent(
  db,
  requestId,
  reviewer = "system",
  notes = ""
) {
  validateDb(db);

  const id =
    validateArticleId(
      requestId
    );

  await ensureContentApprovalQueueTable(
    db
  );

  const reviewerName =
    safeText(
      reviewer,
      200
    ) || "system";

  const reviewNotes =
    safeText(
      notes,
      2000
    ) || "Content placed on hold";

  const result =
    await db.query(
      `
      UPDATE content_approval_queue
      SET
        status = 'hold',

        reviewed_by = $1,

        review_notes = $2,

        reviewed_at = CURRENT_TIMESTAMP,

        updated_at = CURRENT_TIMESTAMP

      WHERE
        id = $3
      AND
        status IN ('pending', 'approved')

      RETURNING *
      `,
      [
        reviewerName,
        reviewNotes,
        id,
      ]
    );

  if (result.rows.length === 0) {
    throw new Error(
      "Approval request not found or cannot be placed on hold"
    );
  }

  return {
    success: true,
    status:
      APPROVAL_STATUSES.HOLD,
    request:
      result.rows[0],
  };
}

/* =========================
   GET PENDING QUEUE
========================= */

export async function getPendingContentApprovals(
  db,
  limit = 50
) {
  validateDb(db);

  await ensureContentApprovalQueueTable(
    db
  );

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 50,
        1
      ),
      200
    );

  const result =
    await db.query(
      `
      SELECT
        q.*,

        a.title,

        a.source,

        a.link,

        a.ai_category,

        a.ai_summary,

        a.published_at

      FROM content_approval_queue q

      LEFT JOIN articles a
        ON a.id = q.article_id

      WHERE q.status = 'pending'

      ORDER BY
        q.requested_at ASC

      LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows;
}

/* =========================
   GET QUEUE HISTORY
========================= */

export async function getContentApprovalHistory(
  db,
  limit = 100
) {
  validateDb(db);

  await ensureContentApprovalQueueTable(
    db
  );

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 100,
        1
      ),
      500
    );

  const result =
    await db.query(
      `
      SELECT
        q.*,

        a.title,

        a.source,

        a.link,

        a.ai_category

      FROM content_approval_queue q

      LEFT JOIN articles a
        ON a.id = q.article_id

      ORDER BY
        q.requested_at DESC

      LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows;
}

/* =========================
   GET SINGLE REQUEST
========================= */

export async function getContentApprovalRequest(
  db,
  requestId
) {
  validateDb(db);

  const id =
    validateArticleId(
      requestId
    );

  await ensureContentApprovalQueueTable(
    db
  );

  const result =
    await db.query(
      `
      SELECT
        q.*,

        a.title,

        a.source,

        a.link,

        a.description,

        a.content,

        a.ai_category,

        a.ai_summary

      FROM content_approval_queue
