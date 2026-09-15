const APPROVAL_TYPES = [
  "PUBLISH",
  "DELETE",
  "SPEND",
  "POLICY_CHANGE",
  "ACCOUNT_ACTION"
];

const APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createApprovalRequest({
  taskId,
  type = "PUBLISH",
  title,
  reason,
  risk = "MEDIUM"
}) {
  if (!taskId || !title) {
    throw new Error("Task ID and title are required.");
  }

  if (!APPROVAL_TYPES.includes(type)) {
    throw new Error("Invalid approval type.");
  }

  return {
    id: `approval_${Date.now()}`,

    taskId: cleanText(taskId),
    type,

    title: cleanText(title),
    reason: cleanText(reason),

    risk: cleanText(risk),

    status: "PENDING",

    decision: {
      decidedBy: null,
      note: null,
      decidedAt: null
    },

    createdAt: new Date().toISOString()
  };
}

export function approveRequest(request, note = "") {
  if (!request || typeof request !== "object") {
    throw new Error("Approval request is required.");
  }

  if (request.status !== "PENDING") {
    throw new Error("Approval request is no longer pending.");
  }

  request.status = "APPROVED";

  request.decision = {
    decidedBy: "CEO",
    note: cleanText(note),
    decidedAt: new Date().toISOString()
  };

  return request;
}

export function rejectRequest(request, reason = "") {
  if (!request || typeof request !== "object") {
    throw new Error("Approval request is required.");
  }

  if (request.status !== "PENDING") {
    throw new Error("Approval request is no longer pending.");
  }

  request.status = "REJECTED";

  request.decision = {
    decidedBy: "CEO",
    note: cleanText(reason || "Rejected by CEO."),
    decidedAt: new Date().toISOString()
  };

  return request;
}

export function expireRequest(request) {
  if (!request || typeof request !== "object") {
    throw new Error("Approval request is required.");
  }

  if (request.status !== "PENDING") {
    return request;
  }

  request.status = "EXPIRED";

  request.decision = {
    decidedBy: "SYSTEM",
    note: "Approval request expired.",
    decidedAt: new Date().toISOString()
  };

  return request;
}

export function getApprovalTypes() {
  return [...APPROVAL_TYPES];
}

export function getApprovalStatuses() {
  return [...APPROVAL_STATUSES];
}
