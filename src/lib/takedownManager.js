import {
  updateTakedownStatus,
  placeLegalHold,
} from "./copyrightProtection.js";

import {
  recordTakedownComplaint,
  recordLegalHold,
} from "./legalAudit.js";


// ========================================
// VALID TAKEDOWN STATUSES
// ========================================

const TAKEDOWN_STATUSES = [
  "none",
  "received",
  "under_review",
  "action_taken",
  "rejected",
  "resolved",
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
// NORMALIZE STATUS
// ========================================

function normalizeStatus(
  status
) {
  const value =
    normalizeValue(
      status,
      "received"
    ).toLowerCase();

  return TAKEDOWN_STATUSES.includes(
    value
  )
    ? value
    : "received";
}


// ========================================
// CREATE COMPLAINT RECORD
// ========================================

export function createTakedownComplaint(
  data = {}
) {
  const articleId =
    Number(data.articleId);

  if (
    !Number.isFinite(
      articleId
    )
  ) {
    throw new Error(
      "Valid article ID is required"
    );
  }

  const complainant =
    normalizeValue(
      data.complainant,
      "Unknown complainant"
    );

  const reason =
    normalizeValue(
      data.reason,
      "Copyright complaint received"
    );

  const contact =
    normalizeValue(
      data.contact
    );

  const evidence =
    normalizeValue(
      data.evidence
    );

  return {
    articleId,
    complainant,
    reason,
    contact,
    evidence,
    status: "received",
    receivedAt: new Date(),
  };
}


// ========================================
// RECEIVE TAKEDOWN COMPLAINT
// ========================================

export async function receiveTakedownComplaint(
  db,
  data = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const complaint =
    createTakedownComplaint(
      data
    );


  // --------------------------------------
  // Put article on legal hold
  // --------------------------------------

  const holdResult =
    await placeLegalHold(
      db,
      complaint.articleId,
      complaint.reason
    );


  // --------------------------------------
  // Update takedown status
  // --------------------------------------

  const statusResult =
    await updateTakedownStatus(
      db,
      complaint.articleId,
      "received",
      complaint.reason
    );


  // --------------------------------------
  // Save audit record
  // --------------------------------------

  await recordTakedownComplaint(
    db,
    complaint.articleId,
    {
      complainant:
        complaint.complainant,

      contact:
        complaint.contact,

      reason:
        complaint.reason,

      evidence:
        complaint.evidence,

      status:
        complaint.status,

      receivedAt:
        complaint.receivedAt,
    },
    "system"
  );


  // --------------------------------------
  // Save legal hold audit
  // --------------------------------------

  await recordLegalHold(
    db,
    complaint.articleId,
    complaint.reason,
    "system"
  );


  return {
    success: true,

    complaint,

    legalHold:
      holdResult.legalHold,

    copyrightStatus:
      holdResult.copyrightStatus,

    takedownStatus:
      statusResult.takedownStatus,

    legalReviewRequired:
      true,
  };
}


// ========================================
// CHANGE COMPLAINT STATUS
// ========================================

export async function changeTakedownStatus(
  db,
  articleId,
  status,
  note = ""
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

  const normalizedStatus =
    normalizeStatus(
      status
    );

  const normalizedNote =
    normalizeValue(
      note,
      `Takedown status changed to ${normalizedStatus}`
    );


  const result =
    await updateTakedownStatus(
      db,
      safeArticleId,
      normalizedStatus,
      normalizedNote
    );


  return {
    success: true,

    articleId:
      safeArticleId,

    takedownStatus:
      result.takedownStatus,

    note:
      normalizedNote,
  };
}


// ========================================
// GET TAKEDOWN STATUS
// ========================================

export async function getTakedownStatus(
  db,
  articleId
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

  const result =
    await db.query(
      `
      SELECT
        id,
        title,
        source,
        link,
        copyright_status,
        copyright_risk,
        legal_hold,
        legal_review_required,
        takedown_status,
        legal_notes
      FROM articles
      WHERE id = $1
      LIMIT 1
      `,
      [
        safeArticleId,
      ]
    );


  if (
    result.rows.length === 0
  ) {
    return null;
  }


  return result.rows[0];
}


// ========================================
// SHOULD ARTICLE REMAIN BLOCKED
// ========================================

export function shouldRemainBlocked(
  article = {}
) {
  const legalHold =
    Boolean(
      article.legal_hold
    );

  const legalReviewRequired =
    Boolean(
      article.legal_review_required
    );

  const status =
    normalizeStatus(
      article.takedown_status
    );


  if (legalHold) {
    return {
      blocked: true,
      reason:
        "Article is under legal hold",
    };
  }


  if (
    legalReviewRequired
  ) {
    return {
      blocked: true,
      reason:
        "Legal review is required",
    };
  }


  if (
    status === "received" ||
    status === "under_review"
  ) {
    return {
      blocked: true,
      reason:
        "Takedown complaint is active",
    };
  }


  return {
    blocked: false,
    reason:
      "No active takedown block",
  };
}


// ========================================
// EXPORT STATUSES
// ========================================

export {
  TAKEDOWN_STATUSES,
};
