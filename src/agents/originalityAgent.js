const ORIGINALITY_STATUSES = [
  "PENDING",
  "PASS",
  "REVIEW",
  "FAIL"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createOriginalityTask({
  title,
  body,
  existingArticles = []
}) {
  const cleanTitle = cleanText(title);
  const cleanBody = cleanText(body);

  if (!cleanTitle || !cleanBody) {
    throw new Error("Article title and body are required.");
  }

  return {
    id: `originality_${Date.now()}`,

    article: {
      title: cleanTitle,
      body: cleanBody
    },

    existingArticles: Array.isArray(existingArticles)
      ? existingArticles
      : [],

    checks: {
      duplicateTitle: "PENDING",
      duplicateContent: "PENDING",
      sourceSimilarity: "PENDING",
      originalValue: "PENDING"
    },

    matches: [],

    status: "CHECK_QUEUED",
    publishAllowed: false,

    nextStep: "SIMILARITY_CHECK",

    createdAt: new Date().toISOString()
  };
}

export function addSimilarityMatch(task, match) {
  if (!task || typeof task !== "object") {
    throw new Error("Originality task is required.");
  }

  if (!match || typeof match !== "object") {
    throw new Error("Similarity match is required.");
  }

  task.matches.push({
    title: cleanText(match.title),
    url: cleanText(match.url),
    similarity: Number(match.similarity) || 0,
    reason: cleanText(match.reason)
  });

  return task;
}

export function completeOriginalityCheck(task, result = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Originality task is required.");
  }

  task.checks = {
    duplicateTitle: result.duplicateTitle || "REVIEW",
    duplicateContent: result.duplicateContent || "REVIEW",
    sourceSimilarity: result.sourceSimilarity || "REVIEW",
    originalValue: result.originalValue || "REVIEW"
  };

  const values = Object.values(task.checks);

  const hasFailure = values.includes("FAIL");
  const needsReview = values.includes("REVIEW");

  task.status = hasFailure
    ? "ORIGINALITY_FAILED"
    : needsReview
      ? "ORIGINALITY_REVIEW"
      : "ORIGINALITY_PASSED";

  task.publishAllowed = !hasFailure && !needsReview;

  task.nextStep = task.publishAllowed
    ? "MEDIA_RIGHTS_CHECK"
    : "HUMAN_REVIEW";

  return task;
}

export function getOriginalityStatuses() {
  return [...ORIGINALITY_STATUSES];
}
