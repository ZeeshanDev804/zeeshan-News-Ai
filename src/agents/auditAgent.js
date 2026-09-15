const ACTORS = [
  "AI",
  "CEO",
  "SYSTEM"
];

const ACTIONS = [
  "TASK_CREATED",
  "RESEARCH_STARTED",
  "ARTICLE_DRAFTED",
  "FACT_CHECKED",
  "ORIGINALITY_CHECKED",
  "MEDIA_CHECKED",
  "SEO_COMPLETED",
  "PUBLISH_APPROVED",
  "PUBLISHED",
  "PUBLISH_BLOCKED",
  "SOCIAL_PUBLISHED",
  "TASK_FAILED"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createAuditLog({
  taskId,
  actor = "AI",
  action,
  message,
  metadata = {}
}) {
  if (!taskId || !action || !message) {
    throw new Error(
      "Task ID, action and message are required."
    );
  }

  if (!ACTORS.includes(actor)) {
    throw new Error("Invalid audit actor.");
  }

  if (!ACTIONS.includes(action)) {
    throw new Error("Invalid audit action.");
  }

  return {
    id: `audit_${Date.now()}`,

    taskId: cleanText(taskId),

    actor,

    action,

    message: cleanText(message),

    metadata:
      metadata && typeof metadata === "object"
        ? metadata
        : {},

    timestamp: new Date().toISOString()
  };
}

export function addAuditEntry(logs, entry) {
  if (!Array.isArray(logs)) {
    throw new Error("Audit log collection is required.");
  }

  if (!entry || typeof entry !== "object") {
    throw new Error("Audit entry is required.");
  }

  logs.push(entry);

  return logs;
}

export function getTaskAuditHistory(logs, taskId) {
  if (!Array.isArray(logs)) {
    throw new Error("Audit log collection is required.");
  }

  return logs.filter(
    (entry) => entry.taskId === cleanText(taskId)
  );
}

export function getAuditActions() {
  return [...ACTIONS];
}
