const PUBLISH_PLATFORMS = [
  "BLOGGER",
  "WEBSITE",
  "SOCIAL_QUEUE"
];

const PUBLISH_STATUSES = [
  "QUEUED",
  "READY",
  "WAITING_FOR_APPROVAL",
  "PUBLISHED",
  "FAILED",
  "BLOCKED"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createPublishTask({
  article,
  seo,
  safety = {},
  platform = "BLOGGER"
}) {
  if (!article || typeof article !== "object") {
    throw new Error("Article is required.");
  }

  if (!seo || typeof seo !== "object") {
    throw new Error("SEO data is required.");
  }

  if (!PUBLISH_PLATFORMS.includes(platform)) {
    throw new Error("Invalid publishing platform.");
  }

  return {
    id: `publish_${Date.now()}`,

    article: {
      title: cleanText(article.title),
      body: cleanText(article.body)
    },

    seo: {
      title: cleanText(seo.title),
      description: cleanText(seo.description),
      slug: cleanText(seo.slug),
      canonicalPath: cleanText(seo.canonicalPath)
    },

    safety: {
      factCheck: safety.factCheck || "PENDING",
      originality: safety.originality || "PENDING",
      mediaRights: safety.mediaRights || "PENDING"
    },

    platform,

    status: "QUEUED",

    approval: {
      required: true,
      status: "WAITING"
    },

    publishResult: null,

    nextStep: "SAFETY_VERIFICATION",

    createdAt: new Date().toISOString()
  };
}

export function markPublishReady(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Publish task is required.");
  }

  const safetyValues = Object.values(task.safety);

  const hasFailure = safetyValues.some(
    (value) => value === "FAIL" || value === "BLOCKED"
  );

  const needsReview = safetyValues.some(
    (value) => value === "PENDING" || value === "REVIEW"
  );

  if (hasFailure) {
    task.status = "BLOCKED";
    task.nextStep = "SAFETY_REVIEW";
    return task;
  }

  if (needsReview) {
    task.status = "WAITING_FOR_APPROVAL";
    task.nextStep = "CEO_APPROVAL";
    return task;
  }

  task.status = "READY";
  task.nextStep = "CEO_APPROVAL";

  return task;
}

export function approvePublish(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Publish task is required.");
  }

  if (task.status !== "READY" &&
      task.status !== "WAITING_FOR_APPROVAL") {
    throw new Error("Article is not ready for approval.");
  }

  task.approval.status = "APPROVED";
  task.approval.approvedAt = new Date().toISOString();

  task.status = "QUEUED";
  task.nextStep = "PUBLISH_TO_PLATFORM";

  return task;
}

export function markPublished(task, result = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Publish task is required.");
  }

  if (task.approval.status !== "APPROVED") {
    throw new Error("CEO approval is required before publishing.");
  }

  task.status = "PUBLISHED";

  task.publishResult = {
    url: result.url || null,
    platform: task.platform,
    publishedAt: new Date().toISOString()
  };

  task.nextStep = "DISTRIBUTION";

  return task;
}

export function markPublishFailed(task, reason) {
  if (!task || typeof task !== "object") {
    throw new Error("Publish task is required.");
  }

  task.status = "FAILED";

  task.publishResult = {
    error: cleanText(reason),
    failedAt: new Date().toISOString()
  };

  task.nextStep = "RETRY_OR_REVIEW";

  return task;
}

export function getPublishPlatforms() {
  return [...PUBLISH_PLATFORMS];
}

export function getPublishStatuses() {
  return [...PUBLISH_STATUSES];
}
