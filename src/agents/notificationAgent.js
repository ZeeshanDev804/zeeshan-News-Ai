const NOTIFICATION_TYPES = [
  "BREAKING_NEWS",
  "TRENDING",
  "SPORTS",
  "AI_TECH",
  "NEW_ARTICLE",
  "DAILY_DIGEST",
  "SYSTEM_ALERT"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createNotificationTask({
  title,
  message,
  url = null,
  type = "NEW_ARTICLE"
}) {
  const cleanTitle = cleanText(title);
  const cleanMessage = cleanText(message);

  if (!cleanTitle || !cleanMessage) {
    throw new Error("Notification title and message are required.");
  }

  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new Error("Invalid notification type.");
  }

  return {
    id: `notification_${Date.now()}`,

    notification: {
      title: cleanTitle,
      message: cleanMessage,
      url: url ? cleanText(url) : null,
      type
    },

    audience: {
      optedInOnly: true,
      returningVisitors: true
    },

    delivery: {
      channel: "WEB_PUSH",
      status: "QUEUED",
      sentAt: null
    },

    safety: {
      permissionRequired: true,
      unsubscribeAvailable: true,
      frequencyControl: true
    },

    status: "QUEUED",
    nextStep: "AUDIENCE_CHECK",

    createdAt: new Date().toISOString()
  };
}

export function approveNotification(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Notification task is required.");
  }

  if (!task.audience.optedInOnly) {
    throw new Error(
      "Notifications can only be sent to opted-in users."
    );
  }

  task.status = "APPROVED";
  task.nextStep = "SEND_NOTIFICATION";

  return task;
}

export function markNotificationSent(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Notification task is required.");
  }

  if (task.status !== "APPROVED") {
    throw new Error("Notification must be approved first.");
  }

  task.delivery.status = "SENT";
  task.delivery.sentAt = new Date().toISOString();
  task.status = "SENT";
  task.nextStep = "TRACK_ENGAGEMENT";

  return task;
}

export function getNotificationTypes() {
  return [...NOTIFICATION_TYPES];
}
