"use strict";

/*
==================================================
 ZEESHAN NEWS AI
 CONTENT APPROVAL QUEUE
==================================================

Purpose:
- Medium / High risk content approval
- CEO approval workflow
- Approve / Reject / Hold
- Pending queue
- Approval statistics
- Article safety checks
- Duplicate pending request protection
- Safe database handling
==================================================
*/

const APPROVAL_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  HOLD: "hold",
};

const APPROVAL_TYPES = {
  CONTENT: "content",
};


/* ==================================================
   SAFE HELPERS
================================================== */

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


function validateRequestId(requestId) {
  const id = Number(requestId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Valid approval request ID is required");
  }

  return id;
}


function validateDb(db) {
  if (!db || typeof db.query !== "function") {
    throw new Error("Database connection is required");
  }
}


/* ==================================================
   ENSURE TABLE
================================================== */

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


  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_content_approval_queue_risk
    ON content_approval_queue(risk_level)
  `);


  return {
    success: true,
  };
}


/* ==================================================
   GET ARTICLE
================================================== */

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


/* ==================================================
   GET APPROVAL REQUEST
================================================== */

export async function getApprovalRequest(
  db,
  requestId
) {
  validateDb(db);

  const id = validateRequestId(requestId);

  await ensureContentApprovalQueueTable(db);

  const result = await db.query(
    `
    SELECT
      q.*,
      a.title AS article_title,
      a.link AS article_link,
      a.source AS article_source,
      a.ai_category,
      a.ai_summary
    FROM content_approval_queue q
    LEFT JOIN articles a
      ON a.id = q.article_id
    WHERE q.id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}


/* ==================================================
   CREATE CONTENT APPROVAL
================================================== */

export async function createContentApprovalRequest(
  db,
  articleId,
  risk = {}
) {
  validateDb(db);

  const id = validateArticleId(articleId);

  await ensureContentApprovalQueueTable(db);

  const article = await getArticle(
    db,
    id
  );

  if (!article) {
    throw new Error(
      `Article not found: ${id}`
    );
  }


  /* -----------------------------------------------
     LEGAL HOLD
  ------------------------------------------------ */

  if (
    article.legal_hold === true ||
    article.legal_hold === "true"
  ) {
    throw new Error(
      "Article is under legal hold and cannot enter normal approval flow"
    );
  }


  /* -----------------------------------------------
     TAKEDOWN
  ------------------------------------------------ */

  if (
    article.takedown_status &&
    ![
      "none",
      "cleared",
      "rejected",
      "resolved"
    ].includes(
      String(
        article.takedown_status
      ).toLowerCase()
    )
  ) {
    throw new Error(
      "Article has an active takedown issue"
    );
  }


  /* -----------------------------------------------
     LEGAL REVIEW
  ------------------------------------------------ */

  if (
    article.legal_review_required === true ||
    article.legal_review_required === "true"
  ) {
    throw new Error(
      "Article requires legal review before normal approval"
    );
  }


  /* -----------------------------------------------
     RISK
  ------------------------------------------------ */

  let riskLevel =
    safeText(
      risk.risk ||
      risk.riskLevel ||
      "medium",
      50
    ).toLowerCase();


  if (
    ![
      "low",
      "medium",
      "high",
      "critical"
    ].includes(riskLevel)
  ) {
    riskLevel = "medium";
  }


  const riskScore = Math.min(
    Math.max(
      Number(
        risk.score ??
        risk.riskScore ??
        0
      ) || 0,
      0
    ),
    100
  );


  const reasons =
    Array.isArray(
      risk.reasons
    )
      ? risk.reasons
          .map(
            (reason) =>
              safeText(
                reason,
                500
              )
          )
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


  /* -----------------------------------------------
     EXISTING PENDING REQUEST
  ------------------------------------------------ */

  const existing =
    await db.query(
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


  if (
    existing.rows.length > 0
  ) {
    return {
      success: true,
      created: false,
      existing: true,
      request:
        existing.rows[0],
    };
  }


  /* -----------------------------------------------
     INSERT
  ------------------------------------------------ */

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
        safeJson(
          reasons
        ),
        requestedBy,
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


/* ==================================================
   COMPATIBILITY WRAPPER
================================================== */

export async function createApprovalRequest(
  db,
  options = {}
) {
  validateDb(db);

  const articleId =
    validateArticleId(
      options.articleId
    );


  return createContentApprovalRequest(
    db,
    articleId,
    {
      risk:
        options.riskLevel ||
        options.risk ||
        "medium",

      score:
        options.riskScore ??
        options.score ??
        0,

      reasons:
        Array.isArray(
          options.reasons
        )
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


/* ==================================================
   APPROVE CONTENT
================================================== */

export async function approveContent(
  db,
  requestId,
  reviewer = "CEO",
  notes = ""
) {
  validateDb(db);

  const id =
    validateRequestId(
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


  const existing =
    await db.query(
      `
      SELECT *
      FROM content_approval_queue
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );


  if (
    existing.rows.length === 0
  ) {
    throw new Error(
      "Approval request not found"
    );
  }


  if (
    existing.rows[0].status !==
    APPROVAL_STATUSES.PENDING
  ) {
    return {
      success: false,
      changed: false,
      message:
        `Request is already ${existing.rows[0].status}`,
      request:
        existing.rows[0],
    };
  }


  const result =
    await db.query(
      `
      UPDATE content_approval_queue
      SET
        status = $1,
        reviewed_by = $2,
        review_notes = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
      `,
      [
        APPROVAL_STATUSES.APPROVED,
        reviewerName,
        reviewNotes,
        id,
      ]
    );


  return {
    success: true,
    changed: true,
    request:
      result.rows[0],
  };
}


/* ==================================================
   REJECT CONTENT
================================================== */

export async function rejectContent(
  db,
  requestId,
  reviewer = "CEO",
  notes = ""
) {
  validateDb(db);

  const id =
    validateRequestId(
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


  const existing =
    await db.query(
      `
      SELECT *
      FROM content_approval_queue
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );


  if (
    existing.rows.length === 0
  ) {
    throw new Error(
      "Approval request not found"
    );
  }


  if (
    existing.rows[0].status !==
    APPROVAL_STATUSES.PENDING
  ) {
    return {
      success: false,
      changed: false,
      message:
        `Request is already ${existing.rows[0].status}`,
      request:
        existing.rows[0],
    };
  }


  const result =
    await db.query(
      `
      UPDATE content_approval_queue
      SET
        status = $1,
        reviewed_by = $2,
        review_notes = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
      `,
      [
        APPROVAL_STATUSES.REJECTED,
        reviewerName,
        reviewNotes,
        id,
      ]
    );


  return {
    success: true,
    changed: true,
    request:
      result.rows[0],
  };
}


/* ==================================================
   HOLD CONTENT
================================================== */

export async function holdContent(
  db,
  requestId,
  reviewer = "CEO",
  notes = ""
) {
  validateDb(db);

  const id =
    validateRequestId(
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
        status = $1,
        reviewed_by = $2,
        review_notes = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = $4
        AND status = $5
      RETURNING *
      `,
      [
        APPROVAL_STATUSES.HOLD,
        reviewerName,
        reviewNotes,
        id,
        APPROVAL_STATUSES.PENDING,
      ]
    );


  if (
    result.rows.length === 0
  ) {
    const request =
      await getApprovalRequest(
        db,
        id
      );

    if (!request) {
      throw new Error(
        "Approval request not found"
      );
    }

    return {
      success: false,
      changed: false,
      message:
        `Request is already ${request.status}`,
      request,
    };
  }


  return {
    success: true,
    changed: true,
    request:
      result.rows[0],
  };
}


/* ==================================================
   RETURN HOLD TO PENDING
================================================== */

export async function reopenApprovalRequest(
  db,
  requestId,
  reviewer = "CEO",
  notes = ""
) {
  validateDb(db);

  const id =
    validateRequestId(
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
        status = $1,
        reviewed_by = $2,
        review_notes = $3,
        reviewed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = $4
        AND status = $5
      RETURNING *
      `,
      [
        APPROVAL_STATUSES.PENDING,
        reviewerName,
        reviewNotes,
        id,
        APPROVAL_STATUSES.HOLD,
      ]
    );


  if (
    result.rows.length === 0
  ) {
    const request =
      await getApprovalRequest(
        db,
        id
      );

    if (!request) {
      throw new Error(
        "Approval request not found"
      );
    }

    return {
      success: false,
      changed: false,
      message:
        `Only held requests can be reopened. Current status: ${request.status}`,
      request,
    };
  }


  return {
    success: true,
    changed: true,
    request:
      result.rows[0],
  };
}


/* ==================================================
   LIST APPROVAL QUEUE
================================================== */

export async function listContentApprovalQueue(
  db,
  options = {}
) {
  validateDb(db);

  await ensureContentApprovalQueueTable(
    db
  );


  const status =
    normalizeStatus(
      options.status
    );


  const riskLevel =
    safeText(
      options.riskLevel ||
      options.risk,
      50
    ).toLowerCase();


  const limit = Math.min(
    Math.max(
      Number(
        options.limit
      ) || 50,
      1
    ),
    200
  );


  const offset = Math.max(
    Number(
      options.offset
    ) || 0,
    0
  );


  const conditions = [];

  const values = [];

  let index = 1;


  if (status) {
    conditions.push(
      `q.status = $${index++}`
    );

    values.push(status);
  }


  if (
    [
      "low",
      "medium",
      "high",
      "critical",
    ].includes(riskLevel)
  ) {
    conditions.push(
      `q.risk_level = $${index++}`
    );

    values.push(
      riskLevel
    );
  }


  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";


  values.push(limit);
  const limitIndex = index++;

  values.push(offset);
  const offsetIndex = index++;


  const result =
    await db.query(
      `
      SELECT
        q.*,
        a.title AS article_title,
        a.link AS article_link,
        a.source AS article_source,
        a.ai_category,
        a.ai_summary
      FROM content_approval_queue q
      LEFT JOIN articles a
        ON a.id = q.article_id
      ${whereClause}
      ORDER BY
        q.requested_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      values
    );


  return {
    success: true,
    items:
      result.rows,
    count:
      result.rows.length,
    limit,
    offset,
  };
}


/* ==================================================
   GET PENDING QUEUE
================================================== */

export async function getPendingContentApprovals(
  db,
  options = {}
) {
  return listContentApprovalQueue(
    db,
    {
      ...options,
      status:
        APPROVAL_STATUSES.PENDING,
    }
  );
}


/* ==================================================
   APPROVAL STATS
================================================== */

export async function getContentApprovalStats(
  db
) {
  validateDb(db);

  await ensureContentApprovalQueueTable(
    db
  );


  const result =
    await db.query(
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
          WHERE status = 'rejected'
        )::INTEGER AS rejected,

        COUNT(*) FILTER (
          WHERE status = 'hold'
        )::INTEGER AS hold,

        COUNT(*) FILTER (
          WHERE risk_level = 'low'
        )::INTEGER AS low_risk,

        COUNT(*) FILTER (
          WHERE risk_level = 'medium'
        )::INTEGER AS medium_risk,

        COUNT(*) FILTER (
          WHERE risk_level = 'high'
        )::INTEGER AS high_risk,

        COUNT(*) FILTER (
          WHERE risk_level = 'critical'
        )::INTEGER AS critical_risk

      FROM content_approval_queue
      `
    );


  const row =
    result.rows[0] || {};


  return {
    success: true,

    total:
      Number(
        row.total
      ) || 0,

    pending:
      Number(
        row.pending
      ) || 0,

    approved:
      Number(
        row.approved
      ) || 0,

    rejected:
      Number(
        row.rejected
      ) || 0,

    hold:
      Number(
        row.hold
      ) || 0,

    lowRisk:
      Number(
        row.low_risk
      ) || 0,

    mediumRisk:
      Number(
        row.medium_risk
      ) || 0,

    highRisk:
      Number(
        row.high_risk
      ) || 0,

    criticalRisk:
      Number(
        row.critical_risk
      ) || 0,
  };
}


/* ==================================================
   CHECK APPROVAL
================================================== */

export async function isContentApproved(
  db,
  articleId
) {
  validateDb(db);

  const id =
    validateArticleId(
      articleId
    );

  await ensureContentApprovalQueueTable(
    db
  );


  const result =
    await db.query(
      `
      SELECT *
      FROM content_approval_queue
      WHERE
        article_id = $1
        AND approval_type = $2
        AND status = $3
      ORDER BY
        reviewed_at DESC NULLS LAST,
        requested_at DESC
      LIMIT 1
      `,
      [
        id,
        APPROVAL_TYPES.CONTENT,
        APPROVAL_STATUSES.APPROVED,
      ]
    );


  return {
    approved:
      result.rows.length > 0,

    request:
      result.rows[0] || null,
  };
}


/* ==================================================
   CHECK PENDING APPROVAL
================================================== */

export async function hasPendingApproval(
  db,
  articleId
) {
  validateDb(db);

  const id =
    validateArticleId(
      articleId
    );

  await ensureContentApprovalQueueTable(
    db
  );


  const result =
    await db.query(
      `
      SELECT id
      FROM content_approval_queue
      WHERE
        article_id = $1
        AND approval_type = $2
        AND status = $3
      LIMIT 1
      `,
      [
        id,
        APPROVAL_TYPES.CONTENT,
        APPROVAL_STATUSES.PENDING,
      ]
    );


  return {
    pending:
      result.rows.length > 0,

    requestId:
      result.rows[0]?.id ||
      null,
  };
}


/* ==================================================
   DELETE OLD REQUESTS
   Only non-pending records
================================================== */

export async function cleanupApprovalQueue(
  db,
  olderThanDays = 90
) {
  validateDb(db);

  await ensureContentApprovalQueueTable(
    db
  );


  const days = Math.min(
    Math.max(
      Number(
        olderThanDays
      ) || 90,
      1
    ),
    3650
  );


  const result =
    await db.query(
      `
      DELETE FROM content_approval_queue
      WHERE
        status != 'pending'
        AND updated_at <
          CURRENT_TIMESTAMP -
          ($1 * INTERVAL '1 day')
      `,
      [days]
    );


  return {
    success: true,

    deleted:
      result.rowCount || 0,

    olderThanDays:
      days,
  };
}


/* ==================================================
   CONSTANTS
================================================== */

export {
  APPROVAL_STATUSES,
  APPROVAL_TYPES,
};


/* ==================================================
   DEFAULT EXPORT
================================================== */

const contentApprovalQueue = {
  ensureContentApprovalQueueTable,

  createContentApprovalRequest,

  createApprovalRequest,

  getApprovalRequest,

  approveContent,

  rejectContent,

  holdContent,

  reopenApprovalRequest,

  listContentApprovalQueue,

  getPendingContentApprovals,

  getContentApprovalStats,

  isContentApproved,

  hasPendingApproval,

  cleanupApprovalQueue,

  APPROVAL_STATUSES,

  APPROVAL_TYPES,
};


export default contentApprovalQueue;