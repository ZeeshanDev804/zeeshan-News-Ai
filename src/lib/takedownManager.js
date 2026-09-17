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
// SAVE COMPLAINT TO DATABASE
// ========================================

async function saveComplaint(
  db,
  complaint
) {
  const result =
    await db.query(
      `
      INSERT INTO takedown_complaints
        (
          article_id,
          complainant,
          contact,
          reason,
          evidence,
          status,
          received_at
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
      RETURNING
        id,
        article_id,
        complainant,
        contact,
        reason,
        evidence,
        status,
        received_at
      `,
      [
        complaint.articleId,
        complaint.complainant,
        complaint.contact,
        complaint.reason,
        complaint.evidence,
        complaint.status,
        complaint.receivedAt,
      ]
    );

  return result.rows[0];
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
  // Save complaint permanently
  // --------------------------------------

  const savedComplaint =
    await saveComplaint(
      db,
      complaint
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
  // Update article takedown status
  // --------------------------------------

  const statusResult =
    await updateTakedownStatus(
      db,
      complaint.articleId,
      "received",
      complaint.reason
    );


  // --------------------------------------
  // Save complaint audit
  // --------------------------------------

  await recordTakedownComplaint(
    db,
    complaint.articleId,
    {
      complaintId:
        savedComplaint.id,

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

    complaint:
      savedComplaint,

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
// CHANGE TAKEDOWN STATUS
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


  // --------------------------------------
  // Update article status
  // --------------------------------------

  const result =
    await updateTakedownStatus(
      db,
      safeArticleId,
      normalizedStatus,
      normalizedNote
    );


  // --------------------------------------
  // Update latest complaint record
  // --------------------------------------

  await db.query(
    `
    UPDATE takedown_complaints
    SET
      status = $1,
      review_notes =
        CASE
          WHEN $2 <> ''
          THEN $2
          ELSE review_notes
        END,

      reviewed_at =
        CASE
          WHEN $1 IN (
            'under_review',
            'action_taken',
            'rejected',
            'resolved'
          )
          THEN CURRENT_TIMESTAMP
          ELSE reviewed_at
        END,

      resolved_at =
        CASE
          WHEN $1 IN (
            'resolved',
            'rejected'
          )
          THEN CURRENT_TIMESTAMP
          ELSE resolved_at
        END

    WHERE id = (
      SELECT id
      FROM takedown_complaints
      WHERE article_id = $3
      ORDER BY created_at DESC
      LIMIT 1
    )
    `,
    [
      normalizedStatus,
      normalizedNote,
      safeArticleId,
    ]
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
// GET ARTICLE COMPLAINTS
// ========================================

export async function getArticleComplaints(
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
        complainant,
        contact,
        reason,
        evidence,
        status,
        received_at,
        reviewed_at,
        resolved_at,
        review_notes,
        created_at
      FROM takedown_complaints
      WHERE article_id = $1
      ORDER BY
        created_at DESC
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
// GET RECENT COMPLAINTS
// ========================================

export async function getRecentComplaints(
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
        tc.id,
        tc.article_id,
        tc.complainant,
        tc.contact,
        tc.reason,
        tc.evidence,
        tc.status,
        tc.received_at,
        tc.reviewed_at,
        tc.resolved_at,
        tc.review_notes,
        tc.created_at,

        a.title,
        a.source,
        a.link,
        a.copyright_status,
        a.copyright_risk,
        a.legal_hold,
        a.legal_review_required

      FROM takedown_complaints tc

      JOIN articles a
        ON a.id = tc.article_id

      ORDER BY
        tc.created_at DESC

      LIMIT $1
      `,
      [
        safeLimit,
      ]
    );


  return result.rows;
}


// ========================================
// CHECK IF ARTICLE SHOULD REMAIN BLOCKED
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