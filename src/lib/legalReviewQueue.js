import {
  getCopyrightStatus,
} from "./copyrightProtection.js";

import {
  getArticleLegalAudit,
} from "./legalAudit.js";


// ========================================
// GET LEGAL REVIEW QUEUE
// ========================================

export async function getLegalReviewQueue(
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
        title,
        source,
        link,
        copyright_status,
        copyright_risk,
        source_attribution,
        legal_hold,
        takedown_status,
        legal_review_required,
        legal_notes,
        created_at,
        published_at
      FROM articles
      WHERE
        legal_review_required = TRUE
        OR legal_hold = TRUE
        OR copyright_status IN (
          'review_required',
          'held',
          'blocked'
        )
        OR takedown_status IN (
          'received',
          'under_review'
        )
      ORDER BY
        created_at DESC
      LIMIT $1
      `,
      [
        safeLimit,
      ]
    );

  return result.rows;
}


// ========================================
// GET SINGLE REVIEW ITEM
// ========================================

export async function getLegalReviewItem(
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

  const article =
    await getCopyrightStatus(
      db,
      safeArticleId
    );

  if (!article) {
    return null;
  }

  const audit =
    await getArticleLegalAudit(
      db,
      safeArticleId,
      100
    );

  return {
    article,
    audit,
  };
}


// ========================================
// APPROVE LEGAL REVIEW
// ========================================

export async function approveLegalReview(
  db,
  articleId,
  note =
    "Legal review approved",
  actor = "ceo"
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

  const normalizedNote =
    String(note).trim() ||
    "Legal review approved";

  await db.query(
    `
    UPDATE articles
    SET
      legal_review_required = FALSE,
      legal_hold = FALSE,
      copyright_status = 'cleared',
      legal_notes = $1
    WHERE id = $2
    `,
    [
      normalizedNote,
      safeArticleId,
    ]
  );

  return {
    success: true,

    articleId:
      safeArticleId,

    approved: true,

    copyrightStatus:
      "cleared",

    legalHold:
      false,

    legalReviewRequired:
      false,

    note:
      normalizedNote,

    actor,
  };
}


// ========================================
// REJECT LEGAL REVIEW
// ========================================

export async function rejectLegalReview(
  db,
  articleId,
  note =
    "Legal review rejected",
  actor = "ceo"
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

  const normalizedNote =
    String(note).trim() ||
    "Legal review rejected";

  await db.query(
    `
    UPDATE articles
    SET
      legal_review_required = TRUE,
      legal_hold = TRUE,
      copyright_status = 'blocked',
      legal_notes = $1
    WHERE id = $2
    `,
    [
      normalizedNote,
      safeArticleId,
    ]
  );

  return {
    success: true,

    articleId:
      safeArticleId,

    approved: false,

    copyrightStatus:
      "blocked",

    legalHold:
      true,

    legalReviewRequired:
      true,

    note:
      normalizedNote,

    actor,
  };
}


// ========================================
// CHECK IF REVIEW IS REQUIRED
// ========================================

export function isLegalReviewRequired(
  article = {}
) {
  if (
    article.legal_hold
  ) {
    return true;
  }

  if (
    article.legal_review_required
  ) {
    return true;
  }

  if (
    [
      "review_required",
      "held",
      "blocked",
    ].includes(
      String(
        article.copyright_status ||
          ""
      ).toLowerCase()
    )
  ) {
    return true;
  }

  if (
    [
      "received",
      "under_review",
    ].includes(
      String(
        article.takedown_status ||
          ""
      ).toLowerCase()
    )
  ) {
    return true;
  }

  return false;
}
