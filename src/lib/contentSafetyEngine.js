const RISK_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

const DECISIONS = {
  AUTO_PUBLISH: "auto_publish",
  CEO_APPROVAL: "ceo_approval",
  HOLD: "hold",
};

const SUPPORTED_PLATFORMS = new Set([
  "general",
  "youtube",
  "youtube_shorts",
  "tiktok",
  "instagram",
  "facebook",
  "x",
]);

const SENSITIVE_CATEGORIES = new Set([
  "politics",
  "elections",
  "war",
  "conflict",
  "crime",
  "terrorism",
  "health",
  "medical",
  "finance",
  "financial",
  "legal",
]);

const HIGH_RISK_KEYWORDS = [
  "terrorist",
  "terrorism",
  "bomb",
  "explosive",
  "massacre",
  "assassination",
  "murder",
  "suicide",
  "self-harm",
  "rape",
  "child abuse",
  "extremist",
];

const MISLEADING_KEYWORDS = [
  "shocking",
  "you won't believe",
  "guaranteed",
  "100% confirmed",
  "secret revealed",
  "this will change everything",
  "breaking!!!",
  "must watch",
];

const UNSUPPORTED_CLAIM_PATTERNS = [
  /\baccording to sources\b/i,
  /\binsiders say\b/i,
  /\bexperts say\b/i,
  /\bpeople are saying\b/i,
  /\bit is believed\b/i,
  /\bconfirmed by everyone\b/i,
];

function normalizeText(
  value,
  maxLength = 10000
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}

function normalizePlatform(
  value
) {
  const platform =
    String(
      value || "general"
    )
      .trim()
      .toLowerCase();

  if (
    !SUPPORTED_PLATFORMS.has(
      platform
    )
  ) {
    return "general";
  }

  return platform;
}

function normalizeCategory(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function containsKeyword(
  text,
  keyword
) {
  return text
    .toLowerCase()
    .includes(
      keyword.toLowerCase()
    );
}

function findMatches(
  text,
  keywords
) {
  return keywords.filter(
    (keyword) =>
      containsKeyword(
        text,
        keyword
      )
  );
}

function detectSensitiveCategory(
  category
) {
  const normalized =
    normalizeCategory(
      category
    );

  if (
    SENSITIVE_CATEGORIES.has(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

function detectHighRiskContent(
  text
) {
  return findMatches(
    text,
    HIGH_RISK_KEYWORDS
  );
}

function detectMisleadingContent(
  text
) {
  return findMatches(
    text,
    MISLEADING_KEYWORDS
  );
}

function detectUnsupportedClaims(
  text
) {
  return UNSUPPORTED_CLAIM_PATTERNS.filter(
    (pattern) =>
      pattern.test(text)
  ).map(
    (pattern) =>
      pattern.source
  );
}

function checkLength(
  content,
  platform
) {
  const limits = {
    general: 5000,
    youtube: 5000,
    youtube_shorts: 2500,
    tiktok: 2500,
    instagram: 2500,
    facebook: 3000,
    x: 1000,
  };

  const limit =
    limits[platform] ||
    limits.general;

  return {
    valid:
      content.length <=
      limit,

    limit,

    actual:
      content.length,
  };
}

function checkEmptyContent(
  content
) {
  return {
    valid:
      Boolean(
        content &&
        content.trim()
      ),

    reason:
      content &&
      content.trim()
        ? null
        : "Content is empty",
  };
}

function checkPlatformSpecificRules(
  {
    content,
    headline,
    thumbnailText,
    platform,
  }
) {
  const issues = [];

  if (
    platform ===
    "youtube_shorts"
  ) {
    if (
      content.length > 2500
    ) {
      issues.push(
        "YouTube Shorts content is too long for the configured content limit."
      );
    }
  }

  if (
    platform === "tiktok"
  ) {
    if (
      content.length > 2500
    ) {
      issues.push(
        "TikTok content exceeds the configured content limit."
      );
    }
  }

  if (
    platform === "instagram"
  ) {
    if (
      content.length > 2500
    ) {
      issues.push(
        "Instagram content exceeds the configured content limit."
      );
    }
  }

  if (
    platform === "x" &&
    content.length > 1000
  ) {
    issues.push(
      "X content exceeds the configured content limit."
    );
  }

  if (
    thumbnailText &&
    thumbnailText.length > 100
  ) {
    issues.push(
      "Thumbnail text is too long."
    );
  }

  if (
    headline &&
    headline.length > 300
  ) {
    issues.push(
      "Headline is unusually long."
    );
  }

  return {
    valid:
      issues.length === 0,

    issues,
  };
}

function checkCopyrightRisk(
  {
    source,
    content,
    originalContent = "",
  }
) {
  const issues = [];

  if (
    !source ||
    source === "Unknown"
  ) {
    issues.push(
      "Original source attribution is missing."
    );
  }

  if (
    originalContent &&
    content &&
    content.length > 0
  ) {
    const normalizedContent =
      content
        .toLowerCase()
        .replace(
          /\s+/g,
          " "
        );

    const normalizedOriginal =
      originalContent
        .toLowerCase()
        .replace(
          /\s+/g,
          " "
        );

    if (
      normalizedOriginal.includes(
        normalizedContent
      )
    ) {
      issues.push(
        "Generated content appears to reproduce source content."
      );
    }
  }

  return {
    risk:
      issues.length > 0
        ? "medium"
        : "low",

    issues,
  };
}

function checkDuplicateRisk(
  {
    content,
    previousContent = [],
  }
) {
  if (
    !Array.isArray(
      previousContent
    ) ||
    previousContent.length === 0
  ) {
    return {
      risk: "low",
      issues: [],
    };
  }

  const normalized =
    normalizeText(
      content
    )
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      );

  const duplicate =
    previousContent.some(
      (item) => {
        const previous =
          normalizeText(
            item
          )
            .toLowerCase()
            .replace(
              /\s+/g,
              " "
            );

        return (
          previous ===
          normalized
        );
      }
    );

  return {
    risk:
      duplicate
        ? "high"
        : "low",

    issues:
      duplicate
        ? [
            "Generated content exactly matches previously generated content.",
          ]
        : [],
  };
}

function calculateRiskScore(
  checks
) {
  let score = 0;

  score +=
    checks.highRisk.length *
    40;

  score +=
    checks.misleading.length *
    15;

  score +=
    checks.unsupportedClaims
      .length * 20;

  score +=
    checks.sensitiveCategory
      ? 25
      : 0;

  score +=
    checks.copyright.issues
      .length * 30;

  score +=
    checks.duplicate.issues
      .length * 40;

  score +=
    checks.platform.issues
      .length * 15;

  if (
    !checks.empty.valid
  ) {
    score += 100;
  }

  if (
    !checks.length.valid
  ) {
    score += 20;
  }

  return Math.min(
    100,
    score
  );
}

function determineDecision(
  {
    score,
    checks,
  }
) {
  if (
    !checks.empty.valid
  ) {
    return {
      risk:
        RISK_LEVELS.HIGH,

      decision:
        DECISIONS.HOLD,

      reason:
        "Content is empty.",
    };
  }

  if (
    checks.highRisk.length > 0
  ) {
    return {
      risk:
        RISK_LEVELS.HIGH,

      decision:
        DECISIONS.HOLD,

      reason:
        "High-risk content detected.",
    };
  }

  if (
    checks.copyright.issues
      .length > 0
  ) {
    return {
      risk:
        RISK_LEVELS.HIGH,

      decision:
        DECISIONS.HOLD,

      reason:
        "Copyright risk requires review.",
    };
  }

  if (
    checks.duplicate.issues
      .length > 0
  ) {
    return {
      risk:
        RISK_LEVELS.HIGH,

      decision:
        DECISIONS.HOLD,

      reason:
        "Duplicate content detected.",
    };
  }

  if (
    checks.sensitiveCategory
  ) {
    return {
      risk:
        RISK_LEVELS.MEDIUM,

      decision:
        DECISIONS.CEO_APPROVAL,

      reason:
        "Sensitive category requires CEO review.",
    };
  }

  if (
    checks.misleading.length > 0 ||
    checks.unsupportedClaims
      .length > 0 ||
    checks.platform.issues
      .length > 0 ||
    !checks.length.valid
  ) {
    return {
      risk:
        RISK_LEVELS.MEDIUM,

      decision:
        DECISIONS.CEO_APPROVAL,

      reason:
        "Content requires additional review.",
    };
  }

  if (
    score >= 60
  ) {
    return {
      risk:
        RISK_LEVELS.HIGH,

      decision:
        DECISIONS.HOLD,

      reason:
        "Overall risk score is too high.",
    };
  }

  if (
    score >= 20
  ) {
    return {
      risk:
        RISK_LEVELS.MEDIUM,

      decision:
        DECISIONS.CEO_APPROVAL,

      reason:
        "Moderate risk detected.",
    };
  }

  return {
    risk:
      RISK_LEVELS.LOW,

    decision:
      DECISIONS.AUTO_PUBLISH,

    reason:
      "Content passed configured safety checks.",
  };
}

export function evaluateContentSafety(
  {
    title = "",
    content = "",
    headline = "",
    summary = "",
    category = "general",
    source = "Unknown",
    thumbnailText = "",
    platform = "general",
    originalContent = "",
    previousContent = [],
  } = {}
) {
  const normalizedTitle =
    normalizeText(
      title,
      1000
    );

  const normalizedContent =
    normalizeText(
      content,
      10000
    );

  const normalizedHeadline =
    normalizeText(
      headline,
      1000
    );

  const normalizedSummary =
    normalizeText(
      summary,
      5000
    );

  const normalizedSource =
    normalizeText(
      source,
      500
    );

  const normalizedThumbnail =
    normalizeText(
      thumbnailText,
      300
    );

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  const combinedText = [
    normalizedTitle,
    normalizedContent,
    normalizedHeadline,
    normalizedSummary,
    normalizedThumbnail,
  ]
    .filter(Boolean)
    .join(" ");


  const checks = {
    empty:
      checkEmptyContent(
        normalizedContent
      ),

    length:
      checkLength(
        normalizedContent,
        normalizedPlatform
      ),

    highRisk:
      detectHighRiskContent(
        combinedText
      ),

    misleading:
      detectMisleadingContent(
        combinedText
      ),

    unsupportedClaims:
      detectUnsupportedClaims(
        combinedText
      ),

    sensitiveCategory:
      detectSensitiveCategory(
        category
      ),

    copyright:
      checkCopyrightRisk({
        source:
          normalizedSource,

        content:
          normalizedContent,

        originalContent:
          normalizeText(
            originalContent,
            20000
          ),
      }),

    duplicate:
      checkDuplicateRisk({
        content:
          normalizedContent,

        previousContent,
      }),

    platform:
      checkPlatformSpecificRules({
        content:
          normalizedContent,

        headline:
          normalizedHeadline,

        thumbnailText:
          normalizedThumbnail,

        platform:
          normalizedPlatform,
      }),
  };


  const riskScore =
    calculateRiskScore(
      checks
    );


  const decision =
    determineDecision({
      score:
        riskScore,

      checks,
    });


  return {
    success: true,

    risk:
      decision.risk,

    decision:
      decision.decision,

    reason:
      decision.reason,

    riskScore,

    platform:
      normalizedPlatform,

    category:
      normalizeCategory(
        category
      ) ||
      "general",

    checks: {
      empty:
        checks.empty,

      length:
        checks.length,

      highRisk:
        checks.highRisk,

      misleading:
        checks.misleading,

      unsupportedClaims:
        checks.unsupportedClaims,

      sensitiveCategory:
        checks.sensitiveCategory,

      copyright:
        checks.copyright,

      duplicate:
        checks.duplicate,

      platform:
        checks.platform,
    },

    autoPublishEligible:
      decision.decision ===
      DECISIONS.AUTO_PUBLISH,

    requiresCEOApproval:
      decision.decision ===
      DECISIONS.CEO_APPROVAL,

    blocked:
      decision.decision ===
      DECISIONS.HOLD,

    evaluatedAt:
      new Date().toISOString(),
  };
}


export function canAutoPublish(
  safetyResult
) {
  return Boolean(
    safetyResult &&
    safetyResult.success ===
      true &&
    safetyResult.risk ===
      RISK_LEVELS.LOW &&
    safetyResult.decision ===
      DECISIONS.AUTO_PUBLISH &&
    safetyResult.autoPublishEligible ===
      true &&
    safetyResult.blocked !==
      true
  );
}


export function requiresCEOApproval(
  safetyResult
) {
  return Boolean(
    safetyResult &&
    safetyResult.success ===
      true &&
    safetyResult.decision ===
      DECISIONS.CEO_APPROVAL
  );
}


export function isContentBlocked(
  safetyResult
) {
  return Boolean(
    safetyResult &&
    safetyResult.success ===
      true &&
    safetyResult.decision ===
      DECISIONS.HOLD
  );
}


export function getRiskLevels() {
  return {
    ...RISK_LEVELS,
  };
}


export function getPublishingDecisions() {
  return {
    ...DECISIONS,
  };
}


export function getSupportedPlatforms() {
  return Array.from(
    SUPPORTED_PLATFORMS
  );
}
