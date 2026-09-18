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

function normalizeValue(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeStatus(status) {
  const value = normalizeValue(
    status,
    "received"
  ).toLowerCase();

  return VALID_TAKEDOWN_STATUSES.includes(value)
    ? value
    : "received";
}

function validateArticleId(articleId) {
  const id = Number(articleId);

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Valid article ID is required");
  }

  return id;
}

export async function createTakedownComplaint(
  db,
  articleId,
  complaint = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id = validateArticleId(articleId);

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

  const details = {
    complainantName,
    complainantEmail,
    reason,
    sourceUrl,
    receivedAt: new Date(),
  };

  // Save complaint in dedicated database table
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

  await updateTakedownStatus(
    db,
    id,
    "received",
    reason
  );

  const holdResult =
    await placeLegalHold(
      db,
      id,
      `Takedown complaint received: ${reason}`
    );

  await recordTakedownComplaint(
    db,
    id,
    {
      ...details,
      complaintId:
        complaintResult.rows[0]?.id || null,
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
    complaint:
      complaintResult.rows[0],
    hold: holdResult,
  };
}

export async function changeTakedownStatus(
  db,
  articleId,
  status,
  note = "",
  actor = "ceo"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id = validateArticleId(articleId);

  const normalizedStatus =
    normalizeStatus(status);

  const normalizedNote =
    normalizeValue(note);

  const result =
    await updateTakedownStatus(
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
      takedownStatus:
        normalizedStatus,
    },
    actor
  );

  return {
    success: true,
    articleId: id,
    takedownStatus:
      result.takedownStatus,
    actor,
  };
}

export async function resolveTakedownComplaint(
  db,
  articleId,
  decision = {},
  actor = "ceo"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id = validateArticleId(articleId);

  const outcome = normalizeValue(
    decision.outcome
  ).toLowerCase();

  const note = normalizeValue(
    decision.note,
    "Takedown complaint resolved"
  );

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
      actor
    );

    await recordManualReview(
      db,
      id,
      {
        status: "resolved",
        reason: note,
        outcome: "cleared",
      },
      actor
    );

    return {
      success: true,
      articleId: id,
      outcome: "cleared",
      takedownStatus: "resolved",
      legalHold: false,
      legalReviewRequired: false,
      copyrightStatus: "cleared",
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
    actor
  );

  return {
    success: true,
    articleId: id,
    outcome: "action_taken",
    takedownStatus: "action_taken",
    legalHold: true,
    legalReviewRequired: true,
  };
}

export async function rejectTakedownComplaint(
  db,
  articleId,
  reason,
  actor = "ceo"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id = validateArticleId(articleId);

  const note = normalizeValue(
    reason,
    "Takedown complaint rejected after review"
  );

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
    actor
  );

  await recordManualReview(
    db,
    id,
    {
      status: "rejected",
      reason: note,
      outcome: "rejected",
    },
    actor
  );

  return {
    success: true,
    articleId: id,
    outcome: "rejected",
    takedownStatus: "rejected",
    legalHold: false,
    legalReviewRequired: false,
    copyrightStatus: "cleared",
  };
}

export async function getTakedownComplaints(
  db,
  status = null,
  limit = 100
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const safeLimit = Math.min(
    Math.max(Number(limit) || 100, 1),
    500
  );

  const normalizedStatus =
    status
      ? normalizeStatus(status)
      : null;

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

export async function getTakedownCase(
  db,
  articleId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

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

    WHERE tc.article_id = $1

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

export function getTakedownStatuses() {
  return [
    ...VALID_TAKEDOWN_STATUSES,
  ];
}