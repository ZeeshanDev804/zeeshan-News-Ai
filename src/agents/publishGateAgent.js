const GATE_STATUSES = [
  "PENDING",
  "PASS",
  "REVIEW",
  "FAIL",
  "BLOCKED"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createPublishGate({
  contentId,
  contentType = "ARTICLE"
}) {
  if (!contentId) {
    throw new Error("Content ID is required.");
  }

  return {
    id: `gate_${Date.now()}`,

    content: {
      id: cleanText(contentId),
      type: cleanText(contentType)
    },

    checks: {
      factCheck: "PENDING",
      originality: "PENDING",
      mediaRights: "PENDING",
      seo: "PENDING",
      quality: "PENDING"
    },

    decision: {
      status: "PENDING",
      reason: "All required checks must be completed.",
      publishAllowed: false
    },

    status: "CHECKING",

    nextStep: "RUN_ALL_CHECKS",

    createdAt: new Date().toISOString()
  };
}

export function updateGateCheck(task, checkName, status) {
  if (!task || typeof task !== "object") {
    throw new Error("Publish gate is required.");
  }

  if (!Object.prototype.hasOwnProperty.call(task.checks, checkName)) {
    throw new Error("Invalid gate check.");
  }

  if (!GATE_STATUSES.includes(status)) {
    throw new Error("Invalid check status.");
  }

  task.checks[checkName] = status;

  return task;
}

export function evaluatePublishGate(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Publish gate is required.");
  }

  const values = Object.values(task.checks);

  const blocked =
    values.includes("FAIL") ||
    values.includes("BLOCKED");

  const pending =
    values.includes("PENDING");

  const review =
    values.includes("REVIEW");

  if (blocked) {
    task.decision = {
      status: "BLOCKED",
      reason: "A required safety or quality check failed.",
      publishAllowed: false
    };

    task.status = "BLOCKED";
    task.nextStep = "FIX_AND_RECHECK";

    return task;
  }

  if (pending || review) {
    task.decision = {
      status: "REVIEW_REQUIRED",
      reason: "One or more checks require verification.",
      publishAllowed: false
    };

    task.status = "WAITING_FOR_REVIEW";
    task.nextStep = "CEO_REVIEW";

    return task;
  }

  task.decision = {
    status: "PASS",
    reason: "All required checks passed.",
    publishAllowed: true
  };

  task.status = "READY_FOR_PUBLISH";
  task.nextStep = "PUBLISH";

  return task;
}

export function approvePublishGate(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Publish gate is required.");
  }

  if (!task.decision.publishAllowed) {
    throw new Error("Content is not eligible for approval.");
  }

  task.status = "APPROVED";
  task.nextStep = "PUBLISH";

  task.approvedAt = new Date().toISOString();

  return task;
}

export function blockPublishGate(task, reason) {
  if (!task || typeof task !== "object") {
    throw new Error("Publish gate is required.");
  }

  task.decision = {
    status: "BLOCKED",
    reason: cleanText(reason || "Blocked by CEO."),
    publishAllowed: false
  };

  task.status = "BLOCKED";
  task.nextStep = "FIX_AND_RECHECK";

  return task;
}

export function getGateStatuses() {
  return [...GATE_STATUSES];
}
