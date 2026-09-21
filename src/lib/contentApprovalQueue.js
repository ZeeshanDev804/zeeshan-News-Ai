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
  const status = safeText(value, 50).toLowerCase();

  return Object.values(APPROVAL_STATUSES).includes(status)
    ? status
    : null;
}

function validateArticleId(articleId) {
  const id = Number(articleId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Valid article ID is required");
  }

  return id;
}

function validateDb(db) {
  if (!db) {
    throw new Error("Database connection is required");
  }
}

/* =========================
   ENSURE APPROVAL QUEUE
========================= */

export async function ensureContentApprovalQueueTable(db) {
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

async function getArticle(db, articleId) {
  const id = validateArticleId(articleId);

  const result = await db.query(
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

  return result.rows[0] || null;
}

/* =========================
   CREATE CONTENT APPROVAL
========================= */

export async function createContentApprovalRequest(
  db,
  articleId,
  risk = {}
) {
  validateDb(db);

  const id = validateArticleId(articleId);

  await ensureContentApprovalQueueTable(db);

  const article = await getArticle(db, id);

  if (!article) {
    throw new Error(`Article not found: ${id}`);
  }

  if (
    article.legal_hold === true ||
    article.legal_hold === "true"
  ) {
    throw new Error(
      "Article is under legal hold and cannot enter normal approval flow"
    );
  }

  if (
    article.takedown_status &&
    !["none", "cleared", "rejected", "resolved"].includes(
      String(article.takedown_status).toLowerCase()
    )
  ) {
    throw new Error("Article has an active takedown issue");
  }

  const riskLevel =
    safeText(risk.risk, 50).toLowerCase() || "medium";

  const riskScore = Math.min(
    Math.max(Number(risk.score) || 0, 0),
    100
  );

  const reasons = Array.isArray(risk.reasons)
    ? risk.reasons
        .map((reason) => safeText(reason, 500))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const requestedBy =
    safeText(
      risk.requestedBy ||
        risk.requested_by ||
        "system",
      200
    ) || "system";

  const existing = await db.query(
    `
    SELECT *
    FROM content_approval_queue
    WHERE
      article_id = $1
      AND approval_type = $2
      AND status = $3
    ORDER BY requested_at DESC
    LIMIT 1
    `,
    [
      id,
      APPROVAL_TYPES.CONTENT,
      APPROVAL_STATUSES.PENDING,
    ]
  );

  if (existing.rows.length > 0) {
    return {
      success: true,
      created: false,
      existing: true,
      request: existing.rows[0],
    };
  }

  const result = await db.query(
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
      $2,
      $3,
      $4,
      $5,
      $6::jsonb,
      $7,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING *
    `,
    [
      id,
      APPROVAL_TYPES.CONTENT,
      APPROVAL_STATUSES.PENDING,
      riskLevel,
      riskScore,
      safeJson(reasons),
      requestedBy,
    ]
  );

  return {
    success: true,
    created: true,
    existing: false,
    request: result.rows[0],
  };
}

/* =========================
   COMPATIBILITY WRAPPER
   USED BY PUBLICATION GATE
========================= */

export async function createApprovalRequest(
  db,
  options = {}
) {
  validateDb(db);

  const articleId = validateArticleId(
    options.articleId
  );

  return createContentApprovalRequest(
    db,
    articleId,
    {
      risk: options.riskLevel || options.risk || "medium",
      score: options.riskScore ?? options.score ?? 0,
      reasons: Array.isArray(options.reasons)
        ? options.reasons
        : options.reason
          ? [options.reason]
          : [],
      requestedBy:
        options.requestedBy ||
        options.requested_by ||
        "system",
    }
  );
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

  const id = validateArticleId(requestId);

  await ensureContentApprovalQueueTable(db);

  const reviewerName =
    safeText(reviewer, 200) || "CEO";

  const reviewNotes = safeText(notes, 2000);

  const result = await db.query(
    `
    UPDATE content_approval_queue
    SET
      status = $1,
      reviewed_by = $2,
      review_notes = $3,
      reviewed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE