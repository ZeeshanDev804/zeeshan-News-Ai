import {
  placeLegalHold,
  releaseLegalHold,
  updateTakedownStatus,
} from "./copyrightProtection.js";

import {
  recordTakedownComplaint,
  recordLegalHold,
  recordLegalHoldRelease,
  recordManualReview,
} from "./legalAudit.js";

const VALID_TAKEDOWN_STATUSES = [
  "none",
  "received",
  "under_review",
  "action_taken",
  "rejected",
  "resolved",
];

const MAX_LIMIT = 500;

function normalizeValue(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeStatus(status) {
  const value = normalizeValue(status, "received").toLowerCase();

  if (!VALID_TAKEDOWN_STATUSES.includes(value)) {
    throw new Error(
      `Invalid takedown status. Allowed values: ${VALID_TAKEDOWN_STATUSES.join(", ")}`
    );
  }

  return value;
}

function validateArticleId(articleId) {
  const id = Number(articleId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Valid article ID is required");
  }

  return id;
}

function validateDatabase(db) {
  if (!db || typeof db.query !== "function") {
    throw new Error("Database connection is required");
  }
}

function normalizeLimit(limit) {
  const numericLimit = Number(limit);

  if (!Number.isFinite(numericLimit)) {
    return 100;
  }

  return Math.min(
    Math.max(Math.floor(numericLimit), 1),
    MAX_LIMIT
  );
}

function normalizeActor(actor) {
  return normalizeValue(actor, "ceo") || "ceo";
}

function normalizeComplaint(complaint = {}) {
  const complainantName = normalizeValue(
    complaint.complainantName,
    "Unknown"
  );

  const complainantEmail = normalizeValue(
    complaint.complainantEmail
  );

  const reason = normalizeValue(
    complaint.reason,
    "Copyright complaint received"
  );

  const sourceUrl = normalizeValue(
    complaint.sourceUrl
  );

  return {
    complainantName,
    complainantEmail,
    reason,
    sourceUrl,
  };
}

/**
 * Create a new copyright/takedown complaint.
 *
 * A new complaint immediately:
 * 1. Gets stored in takedown_complaints.
 * 2. Changes article takedown status to received.
 * 3. Places the article on legal hold.
 * 4. Marks the case for legal review.
 * 5. Writes audit records.
 */
export async function createTakedownComplaint(
  db,
  articleId,
  complaint = {}
) {
  validateDatabase(db);

  const id = validateArticleId(articleId);

  const {
    complainantName,
    complainantEmail,
    reason,
    sourceUrl,
  } = normalizeComplaint(complaint);

  const details = {
    complainantName,
    complainantEmail,
    reason,
    sourceUrl,
    receivedAt: new Date().toISOString(),
  };

  const complaintResult = await db.query(
    `
    INSERT INTO takedown_complaints
      (
        article_id,
        complainant_name,
        complainant_email,
        reason,
        source_url,
        status
      )
    VALUES
      ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      article_id,
      complainant_name,
      complainant_email,
      reason,
      source_url,
      status,
      created_at,
      updated_at
    `,
    [
      id,
      complainantName,
      complainantEmail,
      reason,
      sourceUrl,
      "received",
    ]
  );

  const complaintRow =
    complaintResult.rows[0] || null;

  await updateTakedownStatus(
    db,
    id,
    "received",
    reason
  );

  const holdResult = await placeLegalHold(
    db,
    id,
    `Takedown complaint received: ${reason}`
  );

  await recordTakedownComplaint(
    db,
    id,
    {
      ...details,
      complaintId: complaintRow?.id || null,
    },
    "system"
  );

  await recordLegalHold(
    db,
    id,
    `Takedown complaint received: ${reason}`,
    "system"
  );

  return {
    success: true,
    articleId: id,
    takedownStatus: "received",
    legalHold: true,
    legalReviewRequired: true,
    complaint: complaintRow,
    hold: holdResult,
  };
}

/**
 * Change the current takedown status.
 */
export async function changeTakedownStatus(
  db,
  articleId,
  status,
  note = "",
  actor = "ceo"
) {
  validateDatabase(db);

  const id = validateArticleId(articleId);

  const normalizedStatus =
    normalizeStatus(status);

  const normalizedNote =
    normalizeValue(note);

  const normalizedActor =
    normalizeActor(actor);

  const result = await updateTakedownStatus(
    db,
    id,
    normalizedStatus,
    normalizedNote
  );

  await db.query(
    `
    UPDATE takedown_complaints
    SET
      status = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE
      article_id = $2
      AND status NOT IN ('resolved', 'rejected')
    `,
    [
      normalizedStatus,
      id,
    ]
  );

  await recordManualReview(
    db,
    id,
    {
      status: normalizedStatus,
      reason:
        normalizedNote ||
        `Takedown status changed to ${normalizedStatus}`,
      takedownStatus: normalizedStatus,
    },
    normalizedActor
  );

  return {
    success: true,
    articleId: id,
    takedownStatus:
      result?.takedownStatus ||
      normalizedStatus,
    actor: normalizedActor,
  };
}

/**
 * Resolve a takedown complaint.
 *
 * cleared:
 * - Complaint resolved.
 * - Legal hold released.
 * - Legal review completed.
 *
 * action_taken:
 * - Action has been taken against the article.
 * - Legal hold remains active.
 * - Legal review remains required.
 */
export async function resolveTakedownComplaint(
  db,
  articleId,
  decision = {},
  actor = "ceo"
) {
  validateDatabase(db);

  const id = validateArticleId(articleId);

  const outcome = normalizeValue(
    decision.outcome
  ).toLowerCase();

  const note = normalizeValue(
    decision.note,
    "Takedown complaint resolved"
  );

  const normalizedActor =
    normalizeActor(actor);

  if (
    outcome !== "cleared" &&
    outcome !== "action_taken"
  ) {
    throw new Error(
      "Resolution outcome must be 'cleared' or 'action_taken'"
    );
  }

  if (outcome === "cleared") {
    await updateTakedownStatus(
      db,
      id,
      "resolved",
      note
    );

    await releaseLegalHold(
      db,
      id,
      note
    );

    await db.query(
      `
      UPDATE takedown_complaints
      SET
        status = 'resolved',
        updated_at = CURRENT_TIMESTAMP
      WHERE
        article_id = $1
        AND status NOT IN ('rejected')
      `,
      [id]
    );

    await recordLegalHoldRelease(
      db,
      id,
      note,
      normalizedActor
    );

    await recordManualReview(
      db,
      id,
      {
        status: "resolved",
        reason: note,
        outcome: "cleared",
      },
      normalizedActor
    );

    return {
      success: true,
      articleId: id,
      outcome: "cleared",
      takedownStatus: "resolved",
      legalHold: false,
      legalReviewRequired: false,
      copyrightStatus: "cleared",
      actor: normalizedActor,
    };
  }

  await updateTakedownStatus(
    db,
    id,
    "action_taken",
    note
  );

  await db.query(
    `
    UPDATE takedown_complaints
    SET
      status = 'action_taken',
      updated_at = CURRENT_TIMESTAMP
    WHERE
      article_id = $1
      AND status NOT IN ('resolved', 'rejected')
    `,
    [id]
  );

  await recordManualReview(
    db,
    id,
    {
      status: "action_taken",
      reason: note,
      outcome: "action_taken",
    },
    normalizedActor
  );

  return {
    success: true,
    articleId: id,
    outcome: "action_taken",
    takedownStatus: "action_taken",
    legalHold: true,
    legalReviewRequired: true,
    actor: normalizedActor,
  };
}

/**
 * Reject a takedown complaint after review.
 */
export async function rejectTakedownComplaint(
  db,
  articleId,
  reason,
  actor = "ceo"
) {
  validateDatabase(db);

  const id = validateArticleId(articleId);

  const note = normalizeValue(
    reason,
    "Takedown complaint rejected after review"
  );

  const normalizedActor =
    normalizeActor(actor);

  await updateTakedownStatus(
    db,
    id,
    "rejected",
    note
  );

  await releaseLegalHold(
    db,
    id,
    note
  );

  await db.query(
    `
    UPDATE takedown_complaints
    SET
      status = 'rejected',
      updated_at = CURRENT_TIMESTAMP
    WHERE
      article_id = $1
      AND status NOT IN ('resolved')
    `,
    [id]
  );

  await recordLegalHoldRelease(
    db,
    id,
    note,
    normalizedActor
  );

  await recordManualReview(
    db,
    id,
    {
      status: "rejected",
      reason: note,
      outcome: "rejected",
    },
    normalizedActor
  );

  return {
    success: true,
    articleId: id,
    outcome: "rejected",
    takedownStatus: "rejected",
    legalHold: false,
    legalReviewRequired: false,
    copyrightStatus: "cleared",
    actor: normalizedActor,
  };
}

/**
 * Get takedown complaints.
 *
 * Optional status filter:
 * none
 * received
 * under_review
 * action_taken
 * rejected
 * resolved
 */
export async function getTakedownComplaints(
  db,
  status = null,
  limit = 100
) {
  validateDatabase(db);

  const safeLimit =
    normalizeLimit(limit);

  const normalizedStatus =
    status === null ||
    status === undefined ||
    normalizeValue(status) === ""
      ? null
      : normalizeStatus(status);

  const result = await db.query(
    `
    SELECT
      tc.id,
      tc.article_id,
      tc.complainant_name,
      tc.complainant_email,
      tc.reason,
      tc.source_url,
      tc.status,
      tc.created_at,
      tc.updated_at,

      a.title,
      a.source,
      a.link,
      a.copyright_status,
      a.copyright_risk,
      a.source_attribution,
      a.legal_hold,
      a.takedown_status,
      a.legal_review_required,
      a.legal_notes

    FROM takedown_complaints tc

    INNER JOIN articles a
      ON a.id = tc.article_id

    WHERE
      (
        $1::text IS NULL
        OR tc.status = $1
      )

    ORDER BY
      tc.created_at DESC

    LIMIT $2
    `,
    [
      normalizedStatus,
      safeLimit,
    ]
  );

  return result.rows;
}

/**
 * Get the latest takedown case for an article.
 */
export async function getTakedownCase(
  db,
  articleId
) {
  validateDatabase(db);

  const id = validateArticleId(articleId);

  const result = await db.query(
    `
    SELECT
      tc.id AS complaint_id,
      tc.article_id,
      tc.complainant_name,
      tc.complainant_email,
      tc.reason,
      tc.source_url,
      tc.status AS complaint_status,
      tc.created_at AS complaint_created_at,
      tc.updated_at AS complaint_updated_at,

      a.title,
      a.source,
      a.link,
      a.copyright_status,
      a.copyright_risk,
      a.source_attribution,
      a.legal_hold,
      a.takedown_status,
      a.legal_review_required,
      a.legal_notes

    FROM takedown_complaints tc

    INNER JOIN articles a
      ON a.id = tc.article_id

    WHERE
      tc.article_id = $1

    ORDER BY
      tc.created_at DESC

    LIMIT 1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Return all supported takedown statuses.
 */
export function getTakedownStatuses() {
  return [...VALID_TAKEDOWN_STATUSES];
}