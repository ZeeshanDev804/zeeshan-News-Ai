const AUDIT_ACTIONS = [
  "copyright_check",
  "legal_hold",
  "legal_hold_released",
  "legal_review_required",
  "copyright_cleared",
  "copyright_blocked",
  "takedown_received",
  "takedown_review",
  "takedown_action",
  "takedown_resolved",
  "source_attribution",
  "manual_review",
];


// ========================================
// NORMALIZE VALUE
// ========================================

function normalizeValue(
  value,
  fallback = ""
) {
  return String(
    value ?? fallback
  ).trim();
}


// ========================================
// NORMALIZE ACTION
// ========================================

function normalizeAction(
  action
) {
  const value =
    normalizeValue(
      action,
      "manual_review"
    ).toLowerCase();

  return AUDIT_ACTIONS.includes(
    value
  )
    ? value
    : "manual_review";
}


// ========================================
// CREATE AUDIT RECORD
// ========================================

export function createLegalAuditRecord(
  data = {}
) {
  const action =
    normalizeAction(
      data.action
    );

  const articleId =
    data.articleId
      ? Number(data.articleId)
      : null;

  return {
    articleId:
      Number.isFinite(articleId)
        ? articleId
        : null,

    action,

    actor:
      normalizeValue(
        data.actor,
        "system"
      ),

    status:
      normalizeValue(
        data.status,
        "recorded"
      ),

    reason:
      normalizeValue(
        data.reason
    ),

    details:
      data.details &&
      typeof data.details ===
        "object"
        ? data.details
        : {},

    createdAt:
      new Date(),
  };
}


// ========================================
// SAVE LEGAL AUDIT
// ========================================

export async function saveLegalAudit(
  db,
  data = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }


  const record =
    createLegalAuditRecord(
      data
    );


  if (!record.articleId) {
    throw new Error(
      "Article ID is required"
    );
  }


  /*
    The audit table may be created by
    the database migration layer.
  */

  await db.query(
    `
    INSERT INTO legal_audit_logs
      (
        article_id,
        action,
        actor,
        status,
        reason,
        details,
        created_at
      )
    VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
    `,
    [
      record.articleId,
      record.action,
      record.actor,
      record.status,
      record.reason,
      JSON.stringify(
        record.details
      ),
      record.createdAt,
    ]
  );


  return {
    success: true,
    record,
  };
}


// ========================================
// GET ARTICLE AUDIT LOG
// ========================================

export async function getArticleLegalAudit(
  db,
  articleId,
  limit = 100
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }


  const safeArticleId =
    Number(articleId);

  if (
    !Number.isFinite(
      safeArticleId
    )
  ) {
    throw new Error(
      "Valid article ID is required"
    );
  }


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
        id,
        article_id,
        action,
        actor,
        status,
        reason,
        details,
        created_at
      FROM legal_audit_logs
      WHERE article_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [
        safeArticleId,
        safeLimit,
      ]
    );


  return result.rows;
}


// ========================================
// GET RECENT LEGAL AUDIT
// ========================================

export async function getRecentLegalAudit(
  db,
  limit = 100
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }


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
        id,
        article_id,
        action,
        actor,
        status,
        reason,
        details,
        created_at
      FROM legal_audit_logs
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [
        safeLimit,
      ]
    );


  return result.rows;
}


// ========================================
// RECORD COPYRIGHT CHECK
// ========================================

export async function recordCopyrightCheck(
  db,
  articleId,
  result = {},
  actor = "system"
) {
  return saveLegalAudit(
    db,
    {
      articleId,

      action:
        "copyright_check",

      actor,

      status:
        result?.copyrightStatus ||
        "recorded",

      reason:
        result?.reason ||
        "",

      details:
        result,
    }
  );
}


// ========================================
// RECORD LEGAL HOLD
// ========================================

export async function recordLegalHold(
  db,
  articleId,
  reason,
  actor = "system"
) {
  return saveLegalAudit(
    db,
    {
      articleId,

      action:
        "legal_hold",

      actor,

      status:
        "active",

      reason:
        reason ||
        "Legal hold placed",

      details: {
        legalHold: true,
      },
    }
  );
}


// ========================================
// RECORD LEGAL HOLD RELEASE
// ========================================

export async function recordLegalHoldRelease(
  db,
  articleId,
  reason,
  actor = "system"
) {
  return saveLegalAudit(
    db,
    {
      articleId,

      action:
        "legal_hold_released",

      actor,

      status:
        "released",

      reason:
        reason ||
        "Legal hold released",

      details: {
        legalHold: false,
      },
    }
  );
}


// ========================================
// RECORD TAKEDOWN COMPLAINT
// ========================================

export async function recordTakedownComplaint(
  db,
  articleId,
  details = {},
  actor = "system"
) {
  return saveLegalAudit(
    db,
    {
      articleId,

      action:
        "takedown_received",

      actor,

      status:
        "received",

      reason:
        details?.reason ||
        "Takedown complaint received",

      details,
    }
  );
}


// ========================================
// RECORD MANUAL REVIEW
// ========================================

export async function recordManualReview(
  db,
  articleId,
  details = {},
  actor = "ceo"
) {
  return saveLegalAudit(
    db,
    {
      articleId,

      action:
        "manual_review",

      actor,

      status:
        details?.status ||
        "reviewed",

      reason:
        details?.reason ||
        "Manual legal review completed",

      details,
    }
  );
}


// ========================================
// RECORD COPYRIGHT DECISION
// ========================================

export async function recordCopyrightDecision(
  db,
  articleId,
  decision = {},
  actor = "system"
) {
  let action =
    "copyright_check";


  const status =
    normalizeValue(
      decision?.copyrightStatus
    ).toLowerCase();


  if (
    status === "cleared"
  ) {
    action =
      "copyright_cleared";
  }

  if (
    status === "blocked"
  ) {
    action =
      "copyright_blocked";
  }

  if (
    status ===
    "review_required"
  ) {
    action =
      "legal_review_required";
  }

  if (
    status === "held"
  ) {
    action =
      "legal_hold";
  }


  return saveLegalAudit(
    db,
    {
      articleId,

      action,

      actor,

      status:
        status ||
        "recorded",

      reason:
        decision?.reason ||
        "",

      details:
        decision,
    }
  );
}


// ========================================
// AUDIT ACTION LIST
// ========================================

export function getLegalAuditActions() {
  return [
    ...AUDIT_ACTIONS,
  ];
}
