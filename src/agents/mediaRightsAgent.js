const MEDIA_TYPES = [
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "OTHER"
];

const RIGHTS_STATUSES = [
  "PENDING",
  "LICENSED",
  "ORIGINAL",
  "PUBLIC_DOMAIN",
  "REVIEW",
  "BLOCKED"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createMediaRightsTask({
  articleId,
  media = []
}) {
  if (!articleId) {
    throw new Error("Article ID is required.");
  }

  return {
    id: `media_rights_${Date.now()}`,
    articleId: cleanText(articleId),

    media: Array.isArray(media)
      ? media.map((item) => ({
          type: item.type || "OTHER",
          url: cleanText(item.url),
          source: cleanText(item.source),
          license: cleanText(item.license),
          rightsStatus: item.rightsStatus || "PENDING"
        }))
      : [],

    checks: {
      ownership: "PENDING",
      license: "PENDING",
      attribution: "PENDING",
      commercialUse: "PENDING"
    },

    issues: [],

    status: "CHECK_QUEUED",
    publishAllowed: false,

    nextStep: "VERIFY_MEDIA_RIGHTS",

    createdAt: new Date().toISOString()
  };
}

export function addMedia(task, item) {
  if (!task || typeof task !== "object") {
    throw new Error("Media rights task is required.");
  }

  if (!item?.url) {
    throw new Error("Media URL is required.");
  }

  if (!MEDIA_TYPES.includes(item.type || "OTHER")) {
    throw new Error("Invalid media type.");
  }

  task.media.push({
    type: item.type || "OTHER",
    url: cleanText(item.url),
    source: cleanText(item.source),
    license: cleanText(item.license),
    rightsStatus: item.rightsStatus || "PENDING"
  });

  return task;
}

export function completeMediaRightsCheck(task, result = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Media rights task is required.");
  }

  task.checks = {
    ownership: result.ownership || "REVIEW",
    license: result.license || "REVIEW",
    attribution: result.attribution || "REVIEW",
    commercialUse: result.commercialUse || "REVIEW"
  };

  const values = Object.values(task.checks);

  const hasBlocked = values.includes("BLOCKED");
  const needsReview = values.includes("REVIEW");

  task.status = hasBlocked
    ? "MEDIA_BLOCKED"
    : needsReview
      ? "MEDIA_REVIEW"
      : "MEDIA_RIGHTS_PASSED";

  task.publishAllowed = !hasBlocked && !needsReview;

  task.nextStep = task.publishAllowed
    ? "SEO_OPTIMIZATION"
    : "HUMAN_REVIEW";

  return task;
}

export function getMediaTypes() {
  return [...MEDIA_TYPES];
}

export function getRightsStatuses() {
  return [...RIGHTS_STATUSES];
}
