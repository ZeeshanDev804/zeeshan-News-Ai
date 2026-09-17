const COPYRIGHT_STATUSES = [
  "pending",
  "cleared",
  "review_required",
  "held",
  "blocked",
];

const COPYRIGHT_RISKS = [
  "low",
  "medium",
  "high",
];

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
// NORMALIZE COPYRIGHT STATUS
// ========================================

function normalizeCopyrightStatus(
  status
) {
  const value =
    normalizeValue(
      status,
      "pending"
    ).toLowerCase();

  return COPYRIGHT_STATUSES.includes(
    value
  )
    ? value
    : "pending";
}


// ========================================
// NORMALIZE COPYRIGHT RISK
// ========================================

function normalizeCopyrightRisk(
  risk
) {
  const value =
    normalizeValue(
      risk,
      "low"
    ).toLowerCase();

  return COPYRIGHT_RISKS.includes(
    value
  )
    ? value
    : "low";
}


// ========================================
// NORMALIZE TAKEDOWN STATUS
// ========================================

function normalizeTakedownStatus(
  status
) {
  const value =
    normalizeValue(
      status,
      "none"
    ).toLowerCase();

  return TAKEDOWN_STATUSES.includes(
    value
  )
    ? value
    : "none";
}


// ========================================
// CREATE SOURCE ATTRIBUTION
// ========================================

export function createSourceAttribution(
  article = {}
) {
  const source =
    normalizeValue(
      article.source,
      "Unknown Source"
    );

  const link =
    normalizeValue(
      article.link
    );

  return {
    source,
    originalUrl:
      link || null,
    attributionText:
      link
        ? `Source: ${source}. Original article: ${link}`
        : `Source: ${source}.`,
  };
}


// ========================================
// ANALYZE COPYRIGHT RISK
// ========================================

export function analyzeCopyrightRisk(
  article = {}
) {
  const title =
    normalizeValue(
      article.title
    );

  const content =
    normalizeValue(
      article.content
    );

  const source =
    normalizeValue(
      article.source,
      "Unknown Source"
    );

  const link =
    normalizeValue(
      article.link
    );

  let risk = "low";

  const reasons = [];

  // --------------------------------------
  // Missing source information
  // --------------------------------------

  if (!source || source === "Unknown Source") {

    risk = "high";

    reasons.push(
      "Source information is missing"
    );
  }


  // --------------------------------------
  // Missing original URL
  // --------------------------------------

  if (!link) {

    if (risk !== "high") {
      risk = "medium";
    }

    reasons.push(
      "Original source URL is missing"
    );
  }


  // --------------------------------------
  // Very long imported content
  // --------------------------------------

  if (content.length > 5000) {

    if (risk === "low") {
      risk = "medium";
    }

    reasons.push(
      "Imported content is unusually long"
    );
  }


  // --------------------------------------
  // Empty article
  // --------------------------------------

  if (!title && !content) {

    risk = "high";

    reasons.push(
      "Article contains insufficient content"
    );
  }


  return {
    risk,
    reasons,
    source,
    originalUrl:
      link || null,
  };
}


// ========================================
// CREATE COPYRIGHT DECISION
// ========================================

export function createCopyrightDecision(
  article = {}
) {
  const riskReport =
    analyzeCopyrightRisk(
      article
    );

  const attribution =
    createSourceAttribution(
      article
    );

  let status = "cleared";
  let legalReviewRequired = false;
  let legalHold = false;

  if (
    riskReport.risk === "high"
  ) {

    status = "held";

    legalReviewRequired = true;

    legalHold = true;

  } else if (
    riskReport.risk === "medium"
  ) {

    status = "review_required";

    legalReviewRequired = true;

  }


  return {

    copyrightStatus:
      status,

    copyrightRisk:
      riskReport.risk,

    sourceAttribution:
      attribution.attributionText,

    legalHold,

    legalReviewRequired,

    reasons:
      riskReport.reasons,

  };
}


// ========================================
// SAVE COPYRIGHT STATUS
// ========================================

export async function saveCopyrightStatus(
  db,
  articleId,
  decision
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!articleId) {
    throw new Error(
      "Article ID is required"
    );
  }

  const copyrightStatus =
    normalizeCopyrightStatus(
      decision?.copyrightStatus
    );

  const copyrightRisk =
    normalizeCopyrightRisk(
      decision?.copyrightRisk
    );

  const sourceAttribution =
    normalizeValue(
      decision?.sourceAttribution
    );

  const legalHold =
    Boolean(
      decision?.legalHold
    );

  const legalReviewRequired =
    Boolean(
      decision?.legalReviewRequired
    );

  const legalNotes =
    Array.isArray(
      decision?.reasons
    )
      ? decision.reasons.join(
          "; "
        )
      : normalizeValue(
          decision?.legalNotes
        );


  await db.query(
    `
    UPDATE articles
    SET
      copyright_status = $1,
      copyright_risk = $2,
      source_attribution = $3,
      legal_hold = $4,
      legal_review_required = $5,
      legal_notes = $6
    WHERE id = $7
    `,
    [
      copyrightStatus,
      copyrightRisk,
      sourceAttribution,
      legalHold,
      legalReviewRequired,
      legalNotes,
      articleId,
    ]
  );


  return {
    articleId,
    copyrightStatus,
    copyrightRisk,
    sourceAttribution,
    legalHold,
    legalReviewRequired,
    legalNotes,
  };
}


// ========================================
// GET COPYRIGHT STATUS
// ========================================

export async function getCopyrightStatus(
  db,
  articleId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!articleId) {
    throw new Error(
      "Article ID is required"
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
        source_attribution,
        legal_hold,
        takedown_status,
        legal_review_required,
        legal_notes
      FROM articles
      WHERE id = $1
      LIMIT 1
      `,
      [articleId]
    );


  if (
    result.rows.length === 0
  ) {
    return null;
  }


  return result.rows[0];
}


// ========================================
// MARK LEGAL HOLD
// ========================================

export async function placeLegalHold(
  db,
  articleId,
  reason = "Manual legal hold"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!articleId) {
    throw new Error(
      "Article ID is required"
    );
  }


  await db.query(
    `
    UPDATE articles
    SET
      legal_hold = TRUE,
      legal_review_required = TRUE,
      copyright_status = 'held',
      legal_notes = $1
    WHERE id = $2
    `,
    [
      normalizeValue(
        reason,
        "Manual legal hold"
      ),
      articleId,
    ]
  );


  return {
    success: true,
    articleId,
    legalHold: true,
    legalReviewRequired: true,
    copyrightStatus: "held",
  };
}


// ========================================
// RELEASE LEGAL HOLD
// ========================================

export async function releaseLegalHold(
  db,
  articleId,
  note = "Legal hold released"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!articleId) {
    throw new Error(
      "Article ID is required"
    );
  }


  await db.query(
    `
    UPDATE articles
    SET
      legal_hold = FALSE,
      legal_review_required = FALSE,
      copyright_status = 'cleared',
      legal_notes = $1
    WHERE id = $2
    `,
    [
      normalizeValue(
        note,
        "Legal hold released"
      ),
      articleId,
    ]
  );


  return {
    success: true,
    articleId,
    legalHold: false,
    legalReviewRequired: false,
    copyrightStatus: "cleared",
  };
}


// ========================================
// UPDATE TAKEDOWN STATUS
// ========================================

export async function updateTakedownStatus(
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

  if (!articleId) {
    throw new Error(
      "Article ID is required"
    );
  }


  const takedownStatus =
    normalizeTakedownStatus(
      status
    );


  await db.query(
    `
    UPDATE articles
    SET
      takedown_status = $1,
      legal_notes =
        CASE
          WHEN $2 <> ''
          THEN $2
          ELSE legal_notes
        END
    WHERE id = $3
    `,
    [
      takedownStatus,
      normalizeValue(note),
      articleId,
    ]
  );


  return {
    success: true,
    articleId,
    takedownStatus,
  };
}


// ========================================
// SHOULD PUBLISH ARTICLE
// ========================================

export function shouldPublishArticle(
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

  const copyrightStatus =
    normalizeCopyrightStatus(
      article.copyright_status
    );

  const takedownStatus =
    normalizeTakedownStatus(
      article.takedown_status
    );


  if (legalHold) {
    return {
      publish: false,
      reason:
        "Article is under legal hold",
    };
  }


  if (
    legalReviewRequired
  ) {
    return {
      publish: false,
      reason:
        "Legal review is required",
    };
  }


  if (
    copyrightStatus ===
      "blocked"
  ) {
    return {
      publish: false,
      reason:
        "Article is copyright blocked",
    };
  }


  if (
    copyrightStatus ===
      "held"
  ) {
    return {
      publish: false,
      reason:
        "Article is on copyright hold",
    };
  }


  if (
    takedownStatus ===
      "received"
  ) {
    return {
      publish: false,
      reason:
        "Takedown complaint received",
    };
  }


  if (
    takedownStatus ===
      "under_review"
  ) {
    return {
      publish: false,
      reason:
        "Takedown complaint is under review",
    };
  }


  return {
    publish: true,
    reason:
      "Article passed copyright publication checks",
  };
}


// ========================================
// EXPORT CONSTANTS
// ========================================

export {
  COPYRIGHT_STATUSES,
  COPYRIGHT_RISKS,
  TAKEDOWN_STATUSES,
};
