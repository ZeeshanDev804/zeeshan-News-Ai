const SECURITY_LEVELS = {
  SAFE: "safe",
  WARNING: "warning",
  BLOCKED: "blocked",
};

const SECURITY_ACTIONS = {
  ALLOW: "allow",
  REVIEW: "review",
  BLOCK: "block",
};

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

function normalizeRole(
  role
) {
  return safeText(
    role,
    100
  ).toLowerCase();
}

function validId(
  value
) {
  const id =
    Number(value);

  return (
    Number.isInteger(id) &&
    id > 0
  );
}

/* =========================
   TRUSTED ROLES
========================= */

const TRUSTED_ROLES = new Set([
  "ceo",
  "admin",
  "editor",
  "system",
]);

const READ_ONLY_ROLES = new Set([
  "viewer",
  "analyst",
]);

/* =========================
   PROTECTED ACTIONS
========================= */

const PROTECTED_ACTIONS =
  new Set([
    "publish",
    "delete",
    "approve",
    "reject",
    "change_settings",
    "disable_automation",
    "emergency_stop",
    "clear_emergency_stop",
    "change_credentials",
    "change_platform",
  ]);

/* =========================
   ROLE PERMISSION CHECK
========================= */

export function checkRolePermission(
  role,
  action
) {
  const normalizedRole =
    normalizeRole(
      role
    );

  const normalizedAction =
    safeText(
      action,
      100
    ).toLowerCase();

  if (
    !normalizedRole ||
    !normalizedAction
  ) {
    return {
      allowed: false,

      securityLevel:
        SECURITY_LEVELS.BLOCKED,

      action:
        SECURITY_ACTIONS.BLOCK,

      reason:
        "Role and action are required",
    };
  }

  if (
    normalizedRole ===
    "ceo"
  ) {
    return {
      allowed: true,

      securityLevel:
        SECURITY_LEVELS.SAFE,

      action:
        SECURITY_ACTIONS.ALLOW,

      reason:
        "CEO permission accepted",
    };
  }

  if (
    PROTECTED_ACTIONS.has(
      normalizedAction
    )
  ) {
    return {
      allowed: false,

      securityLevel:
        SECURITY_LEVELS.BLOCKED,

      action:
        SECURITY_ACTIONS.BLOCK,

      reason:
        "Protected action requires CEO authorization",
    };
  }

  if (
    READ_ONLY_ROLES.has(
      normalizedRole
    )
  ) {
    return {
      allowed: false,

      securityLevel:
        SECURITY_LEVELS.WARNING,

      action:
        SECURITY_ACTIONS.REVIEW,

      reason:
        "Read-only role cannot perform this action",
    };
  }

  if (
    TRUSTED_ROLES.has(
      normalizedRole
    )
  ) {
    return {
      allowed: true,

      securityLevel:
        SECURITY_LEVELS.SAFE,

      action:
        SECURITY_ACTIONS.ALLOW,

      reason:
        "Trusted role accepted",
    };
  }

  return {
    allowed: false,

    securityLevel:
      SECURITY_LEVELS.BLOCKED,

    action:
      SECURITY_ACTIONS.BLOCK,

    reason:
      "Unknown role blocked",
  };
}

/* =========================
   ARTICLE SECURITY CHECK
========================= */

export function checkArticleSecurity(
  article = {}
) {
  const reasons = [];

  let blocked = false;

  if (
    article.legal_hold === true
  ) {
    blocked = true;

    reasons.push(
      "Legal hold is active"
    );
  }

  if (
    article.legal_review_required ===
    true
  ) {
    blocked = true;

    reasons.push(
      "Legal review is required"
    );
  }

  const copyrightRisk =
    safeText(
      article.copyright_risk,
      100
    ).toLowerCase();

  const copyrightStatus =
    safeText(
      article.copyright_status,
      100
    ).toLowerCase();

  if (
    copyrightRisk === "high" ||
    copyrightStatus === "blocked" ||
    copyrightStatus === "takedown" ||
    copyrightStatus === "high_risk"
  ) {
    blocked = true;

    reasons.push(
      "Copyright protection is active"
    );
  }

  const takedownStatus =
    safeText(
      article.takedown_status,
      100
    ).toLowerCase();

  if (
    takedownStatus &&
    takedownStatus !== "none" &&
    takedownStatus !== "cleared" &&
    takedownStatus !== "rejected"
  ) {
    blocked = true;

    reasons.push(
      "Active takedown case detected"
    );
  }

  const publicationStatus =
    safeText(
      article.publication_status,
      100
    ).toLowerCase();

  if (
    publicationStatus ===
      "held" ||
    publicationStatus ===
      "blocked"
  ) {
    blocked = true;

    reasons.push(
      "Publication is blocked"
    );
  }

  if (
    !safeText(
      article.source,
      200
    ) ||
    !safeText(
      article.link,
      1000
    )
  ) {
    reasons.push(
      "Source metadata is incomplete"
    );
  }

  if (blocked) {
    return {
      secure: false,

      securityLevel:
        SECURITY_LEVELS.BLOCKED,

      action:
        SECURITY_ACTIONS.BLOCK,

      reasons,
    };
  }

  if (
    reasons.length > 0
  ) {
    return {
      secure: true,

      securityLevel:
        SECURITY_LEVELS.WARNING,

      action:
        SECURITY_ACTIONS.REVIEW,

      reasons,
    };
  }

  return {
    secure: true,

    securityLevel:
      SECURITY_LEVELS.SAFE,

    action:
      SECURITY_ACTIONS.ALLOW,

    reasons: [],
  };
}

/* =========================
   DISTRIBUTION SECURITY
========================= */

export function checkDistributionSecurity(
  article = {},
  platform
) {
  const normalizedPlatform =
    safeText(
      platform,
      50
    ).toLowerCase();

  const allowedPlatforms =
    [
      "website",
      "youtube",
      "facebook",
      "x",
      "tiktok",
    ];

  if (
    !allowedPlatforms.includes(
      normalizedPlatform
    )
  ) {
    return {
      secure: false,

      securityLevel:
        SECURITY_LEVELS.BLOCKED,

      action:
        SECURITY_ACTIONS.BLOCK,

      reason:
        "Unsupported distribution platform",
    };
  }

  const articleSecurity =
    checkArticleSecurity(
      article
    );

  if (
    !articleSecurity.secure
  ) {
    return {
      secure: false,

      securityLevel:
        SECURITY_LEVELS.BLOCKED,

      action:
        SECURITY_ACTIONS.BLOCK,

      reason:
        articleSecurity.reasons.join(
          "; "
        ),
    };
  }

  const publicationStatus =
    safeText(
      article.publication_status,
      100
    ).toLowerCase();

  if (
    publicationStatus !==
    "approved"
  ) {
    return {
      secure: false,

      securityLevel:
        SECURITY_LEVELS.WARNING,

      action:
        SECURITY_ACTIONS.REVIEW,

      reason:
        "Article has not passed publication approval",
    };
  }

  return {
    secure: true,

    securityLevel:
      SECURITY_LEVELS.SAFE,

    action:
      SECURITY_ACTIONS.ALLOW,

    platform:
      normalizedPlatform,

    reason:
      "Distribution security checks passed",
  };
}

/* =========================
   DATABASE SECURITY LOG
========================= */

export async function ensureSecurityLogTable(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS content_security_log (
      id SERIAL PRIMARY KEY,

      article_id INTEGER,

      action TEXT NOT NULL,

      security_level TEXT NOT NULL,

      allowed BOOLEAN NOT NULL DEFAULT FALSE,

      actor TEXT NOT NULL DEFAULT 'system',

      reason TEXT,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return {
    success: true,
  };
}

/* =========================
   RECORD SECURITY EVENT
========================= */

export async function recordSecurityEvent(
  db,
  {
    articleId = null,
    action = "unknown",
    securityLevel =
      SECURITY_LEVELS.SAFE,
    allowed = false,
    actor = "system",
    reason = "",
    metadata = {},
  } = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureSecurityLogTable(
    db
  );

  const id =
    articleId === null
      ? null
      : validId(articleId)
        ? Number(articleId)
        : null;

  const safeAction =
    safeText(
      action,
      100
    ) || "unknown";

  const safeLevel =
    safeText(
      securityLevel,
      50
    ) || SECURITY_LEVELS.WARNING;

  const safeActor =
    safeText(
      actor,
      200
    ) || "system";

  const safeReason =
    safeText(
      reason,
      2000
    );

  const safeMetadata =
    metadata &&
    typeof metadata ===
      "object"
      ? metadata
      : {};

  const result =
    await db.query(
      `
      INSERT INTO content_security_log (
        article_id,
        action,
        security_level,
        allowed,
        actor,
        reason,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      RETURNING *
      `,
      [
        id,

        safeAction,

        safeLevel,

        allowed === true,

        safeActor,

        safeReason,

        JSON.stringify(
          safeMetadata
        ),
      ]
    );

  return {
    success: true,

    event:
      result.rows[0] ||
      null,
  };
}

/* =========================
   SECURE PUBLISH CHECK
========================= */

export async function authorizePublication(
  db,
  article,
  actor = "CEO"
) {
  const permission =
    checkRolePermission(
      actor,
      "publish"
    );

  if (
    !permission.allowed
  ) {
    if (db) {
      await recordSecurityEvent(
        db,
        {
          articleId:
            article?.id ||
            null,

          action:
            "publish",

          securityLevel:
            permission.securityLevel,

          allowed: false,

          actor,

          reason:
            permission.reason,
        }
      );
    }

    return {
      allowed: false,

      securityLevel:
        permission.securityLevel,

      action:
        SECURITY_ACTIONS.BLOCK,

      reason:
        permission.reason,
    };
  }

  const articleSecurity =
    checkArticleSecurity(
      article
    );

  if (
    !articleSecurity.secure
  ) {
    if (db) {
      await recordSecurityEvent(
        db,
        {
          articleId:
            article?.id ||
            null,

          action:
            "publish",

          securityLevel:
            articleSecurity.securityLevel,

          allowed: false,

          actor,

          reason:
            articleSecurity.reasons.join(
              "; "
            ),
        }
      );
    }

    return {
      allowed: false,

      securityLevel:
        articleSecurity.securityLevel,

      action:
        SECURITY_ACTIONS.BLOCK,

      reason:
        articleSecurity.reasons.join(
          "; "
        ),
    };
  }

  if (db) {
    await recordSecurityEvent(
      db,
      {
        articleId:
          article?.id ||
          null,

        action:
          "publish",

        securityLevel:
          SECURITY_LEVELS.SAFE,

        allowed: true,

        actor,

        reason:
          "Publication security checks passed",
      }
    );
  }

  return {
    allowed: true,

    securityLevel:
      SECURITY_LEVELS.SAFE,

    action:
      SECURITY_ACTIONS.ALLOW,

    reason:
      "Publication authorized",
  };
}

/* =========================
   SECURITY SUMMARY
========================= */

export async function getSecuritySummary(
  db,
  limit = 50
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureSecurityLogTable(
    db
  );

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 50,
        1
      ),
      200
    );

  const result =
    await db.query(
      `
      SELECT
        COUNT(*)::INTEGER AS total,

        COUNT(*) FILTER (
          WHERE allowed = TRUE
        )::INTEGER AS allowed,

        COUNT(*) FILTER (
          WHERE allowed = FALSE
        )::INTEGER AS blocked,

        COUNT(*) FILTER (
          WHERE security_level = 'warning'
        )::INTEGER AS warnings,

        COUNT(*) FILTER (
          WHERE security_level = 'blocked'
        )::INTEGER AS security_blocks

      FROM content_security_log
      `
    );

  const recent =
    await db.query(
      `
      SELECT *
      FROM content_security_log
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [
        safeLimit,
      ]
    );

  return {
    success: true,

    summary:
      result.rows[0] || {
        total: 0,
        allowed: 0,
        blocked: 0,
        warnings: 0,
        security_blocks: 0,
      },

    recentEvents:
      recent.rows,
  };
}

/* =========================
   STATUS
========================= */

export function getContentSecurityEngineStatus() {
  return {
    enabled: true,

    component:
      "ZEESHAN NEWS AI Content Security Engine",

    roleBasedAccess:
      true,

    ceoProtection:
      true,

    protectedActions:
      true,

    articleSecurity:
      true,

    distributionSecurity:
      true,

    securityLogging:
      true,

    publicationAuthorization:
      true,

    legalProtection:
      true,

    copyrightProtection:
      true,

    takedownProtection:
      true,

    unknownRoleBlocked:
      true,

    fakeTraffic:
      false,

    fakeEngagement:
      false,
  };
}
