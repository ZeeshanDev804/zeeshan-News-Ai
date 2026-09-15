const CHECK_STATUSES = [
  "PENDING",
  "PASS",
  "REVIEW",
  "FAIL"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createFactCheckTask({
  article,
  sources = []
}) {
  if (!article || typeof article !== "object") {
    throw new Error("Article is required.");
  }

  if (!article.title || !article.body) {
    throw new Error("Article title and body are required.");
  }

  return {
    id: `factcheck_${Date.now()}`,

    article: {
      title: cleanText(article.title),
      body: cleanText(article.body)
    },

    sources: Array.isArray(sources) ? sources : [],

    checks: {
      claims: "PENDING",
      dates: "PENDING",
      names: "PENDING",
      numbers: "PENDING",
      quotes: "PENDING",
      sources: "PENDING"
    },

    findings: [],

    risk: {
      level: "PENDING",
      issues: []
    },

    status: "CHECK_QUEUED",
    publishAllowed: false,

    nextStep: "VERIFY_CLAIMS",

    createdAt: new Date().toISOString()
  };
}

export function addFactFinding(task, finding) {
  if (!task || typeof task !== "object") {
    throw new Error("Fact-check task is required.");
  }

  const text = cleanText(finding);

  if (!text) {
    throw new Error("Fact-check finding is required.");
  }

  task.findings.push(text);

  return task;
}

export function completeFactCheck(task, result = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Fact-check task is required.");
  }

  task.checks = {
    claims: result.claims || "REVIEW",
    dates: result.dates || "REVIEW",
    names: result.names || "REVIEW",
    numbers: result.numbers || "REVIEW",
    quotes: result.quotes || "REVIEW",
    sources: result.sources || "REVIEW"
  };

  const values = Object.values(task.checks);

  const hasFailure = values.includes("FAIL");
  const needsReview = values.includes("REVIEW");

  task.status = hasFailure
    ? "FACT_CHECK_FAILED"
    : needsReview
      ? "FACT_CHECK_REVIEW"
      : "FACT_CHECK_PASSED";

  task.publishAllowed = !hasFailure && !needsReview;

  task.nextStep = task.publishAllowed
    ? "SAFETY_REVIEW"
    : "HUMAN_REVIEW";

  return task;
}

export function getCheckStatuses() {
  return [...CHECK_STATUSES];
}
