const RISK_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
];

const RISK_TYPES = [
  "SOURCE_RISK",
  "FAKE_CLAIM",
  "UNVERIFIED_CLAIM",
  "COPYRIGHT_RISK",
  "DUPLICATE_CONTENT",
  "MALICIOUS_LINK",
  "MISLEADING_CONTENT",
  "SPAM_RISK"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createRiskAssessment({
  contentId,
  title,
  sourceUrl = null,
  sourceReliability = 50,
  verification = 50,
  originality = 50,
  mediaRights = 50
}) {
  if (!contentId || !title) {
    throw new Error("Content ID and title are required.");
  }

  const reliability = clamp(
    Number(sourceReliability) || 0,
    0,
    100
  );

  const verificationScore = clamp(
    Number(verification) || 0,
    0,
    100
  );

  const originalityScore = clamp(
    Number(originality) || 0,
    0,
    100
  );

  const mediaRightsScore = clamp(
    Number(mediaRights) || 0,
    0,
    100
  );

  const riskScore = Math.round(
    (100 - reliability) * 0.30 +
    (100 - verificationScore) * 0.30 +
    (100 - originalityScore) * 0.20 +
    (100 - mediaRightsScore) * 0.20
  );

  let level = "LOW";

  if (riskScore >= 35) {
    level = "MEDIUM";
  }

  if (riskScore >= 60) {
    level = "HIGH";
  }

  if (riskScore >= 80) {
    level = "CRITICAL";
  }

  return {
    id: `risk_${Date.now()}`,

    content: {
      id: cleanText(contentId),
      title: cleanText(title),
      sourceUrl: sourceUrl
        ? cleanText(sourceUrl)
        : null
    },

    scores: {
      sourceReliability: reliability,
      verification: verificationScore,
      originality: originalityScore,
      mediaRights: mediaRightsScore
    },

    riskScore,
    level,

    issues: [],

    decision: {
      publishAllowed: level === "LOW",
      distributionAllowed: level === "LOW",
      humanReviewRequired:
        level === "HIGH" ||
        level === "CRITICAL"
    },

    status: "ASSESSED",

    nextStep:
      level === "LOW"
        ? "CONTINUE_WORKFLOW"
        : "SAFETY_REVIEW",

    assessedAt: new Date().toISOString()
  };
}

export function addRiskIssue(task, {
  type,
  message,
  severity = "MEDIUM"
}) {
  if (!task || typeof task !== "object") {
    throw new Error("Risk assessment is required.");
  }

  if (!RISK_TYPES.includes(type)) {
    throw new Error("Invalid risk type.");
  }

  task.issues.push({
    type,
    message: cleanText(message),
    severity: cleanText(severity),
    createdAt: new Date().toISOString()
  });

  return task;
}

export function blockHighRiskContent(task, reason) {
  if (!task || typeof task !== "object") {
    throw new Error("Risk assessment is required.");
  }

  task.decision = {
    publishAllowed: false,
    distributionAllowed: false,
    humanReviewRequired: true
  };

  task.status = "BLOCKED";
  task.nextStep = "HUMAN_REVIEW";

  task.issues.push({
    type: "MISLEADING_CONTENT",
    message: cleanText(
      reason || "Content blocked by risk engine."
    ),
    severity: "CRITICAL",
    createdAt: new Date().toISOString()
  });

  return task;
}

export function getRiskLevels() {
  return [...RISK_LEVELS];
}

export function getRiskTypes() {
  return [...RISK_TYPES];
}
