import {
  placeLegalHold,
} from "./copyrightProtection.js";

import {
  recordLegalHold,
} from "./legalAudit.js";


// ========================================
// KILL SWITCH STATE
// ========================================

const killSwitchState = {
  enabled: false,
  reason: "",
  actor: "system",
  enabledAt: null,
};


// ========================================
// ENABLE GLOBAL KILL SWITCH
// ========================================

export async function enableKillSwitch(
  db,
  reason = "Emergency legal protection",
  actor = "ceo"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  killSwitchState.enabled = true;

  killSwitchState.reason =
    String(reason).trim() ||
    "Emergency legal protection";

  killSwitchState.actor =
    String(actor).trim() ||
    "ceo";

  killSwitchState.enabledAt =
    new Date();


  console.log(
    "🚨 EMERGENCY KILL SWITCH ENABLED"
  );

  console.log(
    `Reason: ${killSwitchState.reason}`
  );


  return {
    success: true,

    enabled: true,

    reason:
      killSwitchState.reason,

    actor:
      killSwitchState.actor,

    enabledAt:
      killSwitchState.enabledAt,
  };
}


// ========================================
// DISABLE GLOBAL KILL SWITCH
// ========================================

export function disableKillSwitch(
  actor = "ceo"
) {
  killSwitchState.enabled = false;

  killSwitchState.reason = "";

  killSwitchState.actor =
    String(actor).trim() ||
    "ceo";

  killSwitchState.enabledAt =
    null;


  console.log(
    "✅ EMERGENCY KILL SWITCH DISABLED"
  );


  return {
    success: true,

    enabled: false,

    actor:
      killSwitchState.actor,
  };
}


// ========================================
// GET KILL SWITCH STATUS
// ========================================

export function getKillSwitchStatus() {
  return {
    enabled:
      killSwitchState.enabled,

    reason:
      killSwitchState.reason,

    actor:
      killSwitchState.actor,

    enabledAt:
      killSwitchState.enabledAt,
  };
}


// ========================================
// CHECK PUBLICATION
// ========================================

export function isPublicationBlocked() {
  if (
    killSwitchState.enabled
  ) {
    return {
      blocked: true,

      reason:
        killSwitchState.reason ||
        "Emergency kill switch is enabled",
    };
  }

  return {
    blocked: false,

    reason:
      "Emergency kill switch is disabled",
  };
}


// ========================================
// HOLD SINGLE ARTICLE
// ========================================

export async function killArticle(
  db,
  articleId,
  reason =
    "Emergency copyright/legal hold",
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


  const holdResult =
    await placeLegalHold(
      db,
      safeArticleId,
      reason
    );


  await recordLegalHold(
    db,
    safeArticleId,
    reason,
    actor
  );


  return {
    success: true,

    articleId:
      safeArticleId,

    legalHold:
      holdResult.legalHold,

    copyrightStatus:
      holdResult.copyrightStatus,

    legalReviewRequired:
      true,
  };
}


// ========================================
// CHECK ARTICLE AGAINST KILL SWITCH
// ========================================

export function shouldBlockArticle(
  article = {}
) {
  const globalStatus =
    isPublicationBlocked();


  if (
    globalStatus.blocked
  ) {
    return {
      blocked: true,

      reason:
        globalStatus.reason,
    };
  }


  if (
    article.legal_hold
  ) {
    return {
      blocked: true,

      reason:
        "Article is under legal hold",
    };
  }


  if (
    article.legal_review_required
  ) {
    return {
      blocked: true,

      reason:
        "Article requires legal review",
    };
  }


  if (
    article.copyright_status ===
      "blocked"
  ) {
    return {
      blocked: true,

      reason:
        "Article is copyright blocked",
    };
  }


  if (
    article.copyright_status ===
      "held"
  ) {
    return {
      blocked: true,

      reason:
        "Article is under copyright hold",
    };
  }


  return {
    blocked: false,

    reason:
      "Article passed emergency protection checks",
  };
}
