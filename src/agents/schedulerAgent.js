const CONTENT_TYPES = [
  "NEWS",
  "TRENDING",
  "SPORTS",
  "ENTERTAINMENT",
  "AI_TECH",
  "BUSINESS",
  "HOW_TO",
  "VIDEO",
  "QUIZ",
  "POLL"
];

const PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createScheduleTask({
  contentId,
  title,
  type = "NEWS",
  priority = "NORMAL",
  publishAt = null
}) {
  if (!contentId || !title) {
    throw new Error("Content ID and title are required.");
  }

  if (!CONTENT_TYPES.includes(type)) {
    throw new Error("Invalid content type.");
  }

  if (!PRIORITIES.includes(priority)) {
    throw new Error("Invalid priority.");
  }

  return {
    id: `schedule_${Date.now()}`,

    content: {
      id: cleanText(contentId),
      title: cleanText(title),
      type
    },

    priority,

    schedule: {
      publishAt,
      timezone: "UTC",
      status: publishAt ? "SCHEDULED" : "UNSCHEDULED"
    },

    strategy: {
      reason: "AI scheduling analysis pending.",
      recommendedTime: null
    },

    status: "QUEUED",

    nextStep: "ANALYZE_BEST_TIME",

    createdAt: new Date().toISOString()
  };
}

export function setRecommendedTime(task, recommendedTime, reason) {
  if (!task || typeof task !== "object") {
    throw new Error("Schedule task is required.");
  }

  if (!recommendedTime) {
    throw new Error("Recommended time is required.");
  }

  task.strategy = {
    reason: cleanText(
      reason || "AI recommended publishing time."
    ),
    recommendedTime
  };

  task.nextStep = "SCHEDULE_CONTENT";

  return task;
}

export function scheduleContent(task, publishAt) {
  if (!task || typeof task !== "object") {
    throw new Error("Schedule task is required.");
  }

  if (!publishAt) {
    throw new Error("Publish time is required.");
  }

  task.schedule = {
    publishAt,
    timezone: "UTC",
    status: "SCHEDULED"
  };

  task.status = "SCHEDULED";
  task.nextStep = "PUBLISH";

  return task;
}

export function cancelSchedule(task, reason = "") {
  if (!task || typeof task !== "object") {
    throw new Error("Schedule task is required.");
  }

  task.schedule.status = "CANCELLED";
  task.status = "CANCELLED";
  task.nextStep = "REVIEW";

  if (reason) {
    task.strategy.reason = cleanText(reason);
  }

  return task;
}

export function getContentTypes() {
  return [...CONTENT_TYPES];
}

export function getPriorities() {
  return [...PRIORITIES];
}
