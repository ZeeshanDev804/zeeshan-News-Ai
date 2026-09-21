const RISK_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

const RISK_ACTIONS = {
  AUTO_PUBLISH: "auto_publish",
  CEO_APPROVAL: "ceo_approval",
  HOLD: "hold",
};

const SENSITIVE_CATEGORIES = new Set([
  "politics",
  "political",
  "elections",
  "war",
  "conflict",
  "crime",
  "terrorism",
  "terror",
  "health",
  "medical",
  "finance",
  "financial",
  "business",
  "legal",
]);

const HIGH_RISK_KEYWORDS = [
  "terrorist",
  "terrorism",
  "bomb",
  "explosion",
  "mass shooting",
  "murder",
  "assassination",
  "war crime",
  "genocide",
  "coup",
  "martial law",
  "emergency",
  "breaking",
  "death toll",
  "dead",
  "killed",
  "injured",
  "missing",
  "evacuation",
  "nuclear",
];

const MEDIUM_RISK_KEYWORDS = [
  "election",
  "president",
  "prime minister",
  "government",
  "minister",
  "parliament",
  "court",
  "lawsuit",
  "legal",
  "sanction",
  "protest",
  "strike",
  "economy",
  "interest rate",
  "stock market",
  "crypto",
  "health",
  "disease",
  "medicine",
  "hospital",
];

function safeText(value, maxLength = 2000) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeCategory(value) {
  return safeText(value, 100).toLowerCase();
}

function normalizeRisk(value) {
  const risk = safeText(value, 50).toLowerCase();

  if (
    risk === RISK_LEVELS.HIGH ||
    risk === RISK_LEVELS.MEDIUM ||
    risk === RISK_LEVELS.LOW
  ) {
    return risk;
  }

  return null;
}

function containsKeyword(text, keywords) {
  const normalized = text.toLowerCase();

  return keywords.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );
}

function hasLegalHold(article) {
  return article?.legal_hold === true;
}

function requiresLegalReview(article) {
  return article?.legal_review_required === true;
}

function hasTakedownIssue(article) {
  const status = safeText(
    article?.takedown_status,
    100
  ).toLowerCase();

  return (
    status !== "" &&
    status !== "none" &&
    status !== "cleared" &&
    status !== "rejected"
  );
}

function hasCopyrightRisk(article) {
  const status = safeText(
    article?.copyright_status,
    100
  ).toLowerCase();

  const risk = safeText(
    article?.copyright_risk,
    100
  ).toLowerCase();

  return (
    risk === "high" ||
    status === "blocked" ||
    status === "high_risk" ||
    status === "takedown"
  );
}

function hasWeakSource(article) {
  const source = safeText(
    article?.source,
    200
  );

  const link = safeText(
    article?.link,
    1000
  );

  return !source || !link;
}

function hasUnverifiedClaimRisk(article) {
  const text = [
    article?.title,
    article?.description,
    article?.content,
    article?.ai_summary,
  ]
    .map((value) => safeText(value, 4000))
    .join(" ");

  const indicators = [
    "unconfirmed",
    "unverified",
    "allegedly",
    "rumor",
    "rumour",
    "reportedly",
    "claims that",
    "it is unclear",
    "not independently verified",
  ];

  return containsKeyword(text, indicators);
}

/* =========================
   SCORE CALCULATION
========================= */

export function calculateContentRisk(article = {}) {
  const category = normalizeCategory(
    article.ai_category ||
      article.category
  );

  const text = [
    article.title,
    article.description,
    article.content,
    article.ai_summary,
  ]
    .map((value) =>
      safeText(value, 5000)
    )
    .join(" ");

  let score = 0;
  const reasons = [];

  if (
    SENSITIVE_CATEGORIES.has(
      category
    )
  ) {
    score += 30;

    reasons.push(
      `Sensitive category: ${category}`
    );
  }

  if (
    containsKeyword(
      text,
      HIGH_RISK_KEYWORDS
    )
  ) {
    score += 50;

    reasons.push(
      "High-risk subject indicator detected"
    );
  }

  if (
    containsKeyword(
      text,
      MEDIUM_RISK_KEYWORDS
    )
  ) {
    score += 25;

    reasons.push(
      "Sensitive subject indicator detected"
    );
  }

  if (
    hasUnverifiedClaimRisk(
      article
    )
  ) {
    score += 30;

    reasons.push(
      "Unverified or uncertain claim indicator detected"
    );
  }

  if (
    hasWeakSource(article)
  ) {
    score += 20;

    reasons.push(
      "Source or source link is incomplete"
    );
  }

  if (
    hasCopyrightRisk(article)
  ) {
    score += 50;

    reasons.push(
      "Copyright risk detected"
    );
  }

  if (
    requiresLegalReview(article)
  ) {
    score += 50;

    reasons.push(
      "Legal review is required"
    );
  }

  if (
    hasTakedownIssue(article)
  ) {
    score += 100;

    reasons.push(
      "Active takedown issue detected"
    );
  }

  if (
    hasLegalHold(article)
  ) {
    score += 100;

    reasons.push(
      "Article is under legal hold"
    );
  }

  let risk = RISK_LEVELS.LOW;

  if (score >= 70) {
    risk = RISK_LEVELS.HIGH;
  } else if (score >= 30) {
    risk = RISK_LEVELS.MEDIUM;
  }

  let action =
    RISK_ACTIONS.AUTO_PUBLISH;

  if (risk === RISK_LEVELS.MEDIUM) {
    action =
      RISK_ACTIONS.CEO_APPROVAL;
  }

  if (risk === RISK_LEVELS.HIGH) {
    action =
      RISK_ACTIONS.HOLD;
  }

  return {
    risk,
    action,
    score: Math.min(score, 100),
    reasons: reasons.slice(0, 20),
  };
}

/* =========================
   FINAL PUBLICATION DECISION
========================= */

export function evaluatePublicationRisk(
  article = {}
) {
  const result =
    calculateContentRisk(
      article
    );

  if (
    hasLegalHold(article) ||
    hasTakedownIssue(article) ||
    requiresLegalReview(article) ||
    hasCopyrightRisk(article)
  ) {
    return {
      ...result,
      risk: RISK_LEVELS.HIGH,
      action: RISK_ACTIONS.HOLD,
      publishAllowed: false,
      requiresApproval: false,
      legalBlock: true,
    };
  }

  if (
    result.risk ===
    RISK_LEVELS.HIGH
  ) {
    return {
      ...result,
      publishAllowed: false,
      requiresApproval: false,
      legalBlock: false,
    };
  }

  if (
    result.risk ===
    RISK_LEVELS.MEDIUM
  ) {
    return {
      ...result,
      publishAllowed: false,
      requiresApproval: true,
      legalBlock: false,
    };
  }

  return {
    ...result,
    publishAllowed: true,
    requiresApproval: false,
    legalBlock: false,
  };
}

/* =========================
   DATABASE RISK UPDATE
========================= */

export async function applyContentRisk(
  db,
  articleId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id = Number(articleId);

  if (
    !Number.isInteger(id) ||
    id <= 0
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
        description,
        content,
        source,
        link,
        category,
        ai_category,
        ai_summary,
        copyright_status,
        copyright_risk,
        legal_hold,
        legal_review_required,
        takedown_status
      FROM articles
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

  const article =
    result.rows[0];

  if (!article) {
    throw new Error(
      `Article not found: ${id}`
    );
  }

  const decision =
    evaluatePublicationRisk(
      article
    );

  return {
    articleId: id,
    ...decision,
    evaluatedAt:
      new Date().toISOString(),
  };
}

/* =========================
   RISK ENGINE STATUS
========================= */

export function getContentRiskEngineStatus() {
  return {
    enabled: true,

    engine:
      "ZEESHAN NEWS AI Content Risk Engine",

    levels: [
      RISK_LEVELS.LOW,
      RISK_LEVELS.MEDIUM,
      RISK_LEVELS.HIGH,
    ],

    actions: [
      RISK_ACTIONS.AUTO_PUBLISH,
      RISK_ACTIONS.CEO_APPROVAL,
      RISK_ACTIONS.HOLD,
    ],

    lowRiskAutoPublish:
      true,

    mediumRiskApproval:
      true,

    highRiskHold:
      true,

    legalHoldProtection:
      true,

    legalReviewProtection:
      true,

    takedownProtection:
      true,

    copyrightProtection:
      true,

    unverifiedClaimProtection:
      true,

    fakeTraffic:
      false,

    fakeEngagement:
      false,
  };
}
