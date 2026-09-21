import {
  evaluatePublicationRisk,
} from "./contentRiskEngine.js";

import {
  createApprovalRequest,
} from "./contentApprovalQueue.js";

/* =========================
   HELPERS
========================= */

function safeText(
  value,
  maxLength = 2000
) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validArticleId(
  articleId
) {
  const id =
    Number(articleId);

  return (
    Number.isInteger(id) &&
    id > 0
  );
}

/* =========================
   LOAD ARTICLE
========================= */

async function getArticle(
  db,
  articleId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (
    !validArticleId(
      articleId
    )
  ) {
    throw new Error(
      "Valid article ID is required"
    );
  }

  const id =
    Number(articleId);

  const result =
    await db.query(
      `
      SELECT
        id,
        title,
        description,
        content,
        source,
        link,
        category,
        ai_category,
        ai_summary,
        ai_headline,
        seo_title,
        ai_sentiment,
        key_points,
        copyright_status,
        copyright_risk,
        legal_hold,
        legal_review_required,
        legal_notes,
        takedown_status,
        published_at,
        created_at,
        updated_at
      FROM articles
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

  if (
    result.rows.length === 0
  ) {
    throw new Error(
      `Article not found: ${id}`
    );
  }

  return result.rows[0];
}

/* =========================
   ENSURE PUBLICATION COLUMNS
========================= */

export async function ensurePublicationGateTable(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS publication_status
    TEXT NOT NULL DEFAULT 'pending'
  `);

  await db.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS publication_risk
    TEXT NOT NULL DEFAULT 'unknown'
  `);

  await db.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS publication_action
    TEXT NOT NULL DEFAULT 'hold'
  `);

  await db.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS publication_score
    INTEGER NOT NULL DEFAULT 0
  `);

  await db.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS publication_reasons
    JSONB NOT NULL DEFAULT '[]'::jsonb
  `);

  await db.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS publication_checked_at
    TIMESTAMP
  `);

  return {
    success: true,
  };
}

/* =========================
   APPLY PUBLICATION DECISION
========================= */

export async function evaluateArticlePublication(
  db,
  articleId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensurePublicationGateTable(
    db
  );

  const article =
    await getArticle(
      db,
      articleId
    );

  const decision =
    evaluatePublicationRisk(
      article
    );

  await db.query(
    `
    UPDATE articles
    SET
      publication_status = $1,
      publication_risk = $2,
      publication_action = $3,
      publication_score = $4,
      publication_reasons = $5,
      publication_checked_at =
        CURRENT_TIMESTAMP,
      updated_at =
        CURRENT_TIMESTAMP
    WHERE id = $6
    `,
    [
      decision.publishAllowed
        ? "approved"
        : decision.requiresApproval
          ? "awaiting_ceo_approval"
          : "held",

      decision.risk,

      decision.action,

      Number(
        decision.score
      ) || 0,

      JSON.stringify(
        Array.isArray(
          decision.reasons
        )
          ? decision.reasons
          : []
      ),

      article.id,
    ]
  );

  return {
    success: true,

    articleId:
      article.id,

    risk:
      decision.risk,

    action:
      decision.action,

    score:
      decision.score,

    reasons:
      decision.reasons,

    publishAllowed:
      decision.publishAllowed,

    requiresApproval:
      decision.requiresApproval,

    legalBlock:
      decision.legalBlock,
  };
}

/* =========================
   CREATE CEO APPROVAL
========================= */

export async function sendArticleToCEOApproval(
  db,
  articleId,
  requestedBy = "system"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensurePublicationGateTable(
    db
  );

  const article =
    await getArticle(
      db,
      articleId
    );

  const decision =
    evaluatePublicationRisk(
      article
    );

  if (
    decision.legalBlock
  ) {
    await db.query(
      `
      UPDATE articles
      SET
        publication_status = 'held',
        publication_risk = 'high',
        publication_action = 'hold',
        publication_score = $1,
        publication_reasons = $2,
        publication_checked_at =
          CURRENT_TIMESTAMP,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE id = $3
      `,
      [
        decision.score,

        JSON.stringify(
          decision.reasons
        ),

        article.id,
      ]
    );

    return {
      success: true,

      articleId:
        article.id,

      status:
        "held",

      reason:
        "Legal protection blocked publication",

      approvalCreated:
        false,
    };
  }

  if (
    decision.risk !==
    "medium"
  ) {
    return {
      success: true,

      articleId:
        article.id,

      status:
        decision.risk === "low"
          ? "approved"
          : "held",

      risk:
        decision.risk,

      approvalCreated:
        false,
    };
  }

  const approval =
    await createApprovalRequest(
      db,
      {
        articleId:
          article.id,

        riskLevel:
          decision.risk,

        riskScore:
          decision.score,

        reason:
          decision.reasons.join(
            "; "
          ),

        requestedBy:
          safeText(
            requestedBy,
            200
          ) || "system",
      }
    );

  await db.query(
    `
    UPDATE articles
    SET
      publication_status =
        'awaiting_ceo_approval',

      publication_risk =
        $1,

      publication_action =
        'ceo_approval',

      publication_score =
        $2,

      publication_reasons =
        $3,

      publication_checked_at =
        CURRENT_TIMESTAMP,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE id = $4
    `,
    [
      decision.risk,

      decision.score,

      JSON.stringify(
        decision.reasons
      ),

      article.id,
    ]
  );

  return {
    success: true,

    articleId:
      article.id,

    status:
      "awaiting_ceo_approval",

    risk:
      decision.risk,

    score:
      decision.score,

    reasons:
      decision.reasons,

    approvalCreated:
      true,

    approval,
  };
}

/* =========================
   PUBLICATION GATE
========================= */

export async function checkPublicationGate(
  db,
  articleId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const article =
    await getArticle(
      db,
      articleId
    );

  const decision =
    evaluatePublicationRisk(
      article
    );

  if (
    decision.legalBlock
  ) {
    return {
      allowed: false,

      status:
        "held",

      risk:
        "high",

      action:
        "hold",

      reason:
        "Legal, copyright, or takedown protection is active",

      legalBlock:
        true,
    };
  }

  if (
    decision.risk === "high"
  ) {
    return {
      allowed: false,

      status:
        "held",

      risk:
        "high",

      action:
        "hold",

      reason:
        "High-risk content requires hold",

      legalBlock:
        false,
    };
  }

  if (
    decision.risk === "medium"
  ) {
    return {
      allowed: false,

      status:
        "awaiting_ceo_approval",

      risk:
        "medium",

      action:
        "ceo_approval",

      reason:
        "CEO approval is required",

      legalBlock:
        false,
    };
  }

  return {
    allowed: true,

    status:
      "approved",

    risk:
      "low",

    action:
      "auto_publish",

    reason:
      "Low-risk content passed publication gate",

    legalBlock:
      false,
  };
}

/* =========================
   MARK CEO APPROVED
========================= */

export async function approveArticleForPublication(
  db,
  articleId,
  approvedBy = "CEO"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensurePublicationGateTable(
    db
  );

  const article =
    await getArticle(
      db,
      articleId
    );

  const decision =
    evaluatePublicationRisk(
      article
    );

  if (
    decision.legalBlock
  ) {
    throw new Error(
      "Article cannot be approved because a legal/copyright/takedown block is active"
    );
  }

  if (
    decision.risk === "high"
  ) {
    throw new Error(
      "High-risk article cannot be manually converted into auto-publish status"
    );
  }

  const actor =
    safeText(
      approvedBy,
      200
    ) || "CEO";

  const result =
    await db.query(
      `
      UPDATE articles
      SET
        publication_status =
          'approved',

        publication_action =
          'auto_publish',

        updated_at =
          CURRENT_TIMESTAMP

      WHERE id = $1

      RETURNING
        id,
        publication_status,
        publication_action,
        updated_at
      `,
      [article.id]
    );

  return {
    success: true,

    articleId:
      article.id,

    approvedBy:
      actor,

    status:
      "approved",

    action:
      "auto_publish",

    record:
      result.rows[0] ||
      null,
  };
}

/* =========================
   FORCE HOLD
========================= */

export async function holdArticlePublication(
  db,
  articleId,
  reason = "Publication manually held",
  heldBy = "CEO"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensurePublicationGateTable(
    db
  );

  const article =
    await getArticle(
      db,
      articleId
    );

  const safeReason =
    safeText(
      reason,
      2000
    ) ||
    "Publication manually held";

  const actor =
    safeText(
      heldBy,
      200
    ) || "CEO";

  const existingReasons =
    Array.isArray(
      article.publication_reasons
    )
      ? article.publication_reasons
      : [];

  const reasons = [
    ...existingReasons,
    `${safeReason} (${actor})`,
  ].slice(
    0,
    20
  );

  const result =
    await db.query(
      `
      UPDATE articles
      SET
        publication_status =
          'held',

        publication_action =
          'hold',

        publication_risk =
          'high',

        publication_reasons =
          $1,

        publication_checked_at =
          CURRENT_TIMESTAMP,

        updated_at =
          CURRENT_TIMESTAMP

      WHERE id = $2

      RETURNING
        id,
        publication_status,
        publication_action,
        publication_risk,
        publication_reasons,
        updated_at
      `,
      [
        JSON.stringify(
          reasons
        ),

        article.id,
      ]
    );

  return {
    success: true,

    articleId:
      article.id,

    heldBy:
      actor,

    status:
      "held",

    action:
      "hold",

    record:
      result.rows[0] ||
      null,
  };
}

/* =========================
   STATUS
========================= */

export function getContentPublicationGateStatus() {
  return {
    enabled: true,

    component:
      "ZEESHAN NEWS AI Content Publication Gate",

    riskEngineConnected:
      true,

    approvalQueueConnected:
      true,

    lowRiskAutoPublish:
      true,

    mediumRiskCEOApproval:
      true,

    highRiskHold:
      true,

    legalBlockProtection:
      true,

    copyrightBlockProtection:
      true,

    takedownBlockProtection:
      true,

    databasePersistence:
      true,

    fakeTraffic:
      false,

    fakeEngagement:
      false,
  };
}
